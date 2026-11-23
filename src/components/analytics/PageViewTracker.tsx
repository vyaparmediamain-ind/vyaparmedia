"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { normalizeRouteKey } from "@/lib/route-key";

const TAB_STORAGE_KEY = "vm_telemetry_tab_id";
const MIN_ACTIVE_MS = 1000; // Ignore < 1 second
const MAX_ACTIVE_MS = 1_800_000; // Cap at 30 minutes (30 * 60 * 1000)

function isBot(): boolean {
  if (typeof navigator === "undefined") return true;
  if (navigator.webdriver) return true;
  const ua = navigator.userAgent || "";
  return /bot|crawler|spider|headless|lighthouse|phantom/i.test(ua);
}

function getOrCreateTabId(): string {
  try {
    let tabId = sessionStorage.getItem(TAB_STORAGE_KEY);
    if (!tabId || tabId.length < 8) {
      if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        tabId = crypto.randomUUID().replaceAll("-", "");
      } else if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
        const buf = new Uint8Array(16);
        crypto.getRandomValues(buf);
        tabId = Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
      } else {
        tabId = Date.now().toString(16).padStart(16, "0") + "0000000000000000";
      }
      sessionStorage.setItem(TAB_STORAGE_KEY, tabId);
    }
    return tabId;
  } catch {
    // SessionStorage restricted/disabled fallback
    return "00000000000000000000000000000000";
  }
}

export function PageViewTracker() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const sessionRef = useRef(session);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const activeStartRef = useRef<number | null>(null);
  const accumulatedMsRef = useRef<number>(0);
  const maxScrollPctRef = useRef<number>(0);
  const currentPathRef = useRef<string>(pathname);

  // Helper to flush beacon
  const flushEvent = useCallback((targetPath: string) => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return;
    if (!navigator.sendBeacon) return;

    // Skip conditions: bots, prerender, admin
    if (isBot()) return;
    if ((document.visibilityState as string) === "prerender") return;
    if (sessionRef.current?.user?.userType === "ADMIN" || targetPath.startsWith("/admin")) return;

    // Check Do Not Track
    if (navigator.doNotTrack === "1" || (window as unknown as { doNotTrack?: string }).doNotTrack === "1") {
      return;
    }

    // Tally any active time still in flight
    let totalActiveMs = accumulatedMsRef.current;
    if (activeStartRef.current !== null) {
      totalActiveMs += performance.now() - activeStartRef.current;
    }

    // Ignore < 1s
    if (totalActiveMs < MIN_ACTIVE_MS) {
      return;
    }

    // Cap at 30 minutes
    const boundedActiveMs = Math.min(Math.round(totalActiveMs), MAX_ACTIVE_MS);
    const tabId = getOrCreateTabId();
    const deviceType = window.innerWidth < 768 ? "mobile" : "desktop";
    const routeKey = normalizeRouteKey(targetPath);

    const payload = JSON.stringify({
      tabId,
      pathname: targetPath,
      routeKey,
      deviceType,
      referrerHost: document.referrer || null,
      activeMs: boundedActiveMs,
      maxScrollPct: maxScrollPctRef.current,
    });

    const blob = new Blob([payload], { type: "text/plain" });
    navigator.sendBeacon("/api/telemetry/track", blob);
  }, []);

  // Scroll depth tracking
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset || 0;
      const docHeight = document.documentElement.scrollHeight || document.body.scrollHeight || 0;
      const clientHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      const maxScrollable = docHeight - clientHeight;
      const pct = maxScrollable > 0 ? Math.round((scrollY / maxScrollable) * 100) : 100;
      const bounded = Math.min(100, Math.max(0, pct));
      if (bounded > maxScrollPctRef.current) {
        maxScrollPctRef.current = bounded;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initial check

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [pathname]);

  // Page Visibility API tracking
  useEffect(() => {
    // Start active timer if visible
    if (document.visibilityState === "visible") {
      activeStartRef.current = performance.now();
    } else {
      activeStartRef.current = null;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (activeStartRef.current !== null) {
          accumulatedMsRef.current += performance.now() - activeStartRef.current;
          activeStartRef.current = null;
        }
        // Flush on visibilitychange -> hidden (per prompt specification)
        flushEvent(currentPathRef.current);
        accumulatedMsRef.current = 0;
      } else if (document.visibilityState === "visible") {
        activeStartRef.current = performance.now();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [flushEvent]);

  // Route change tracking (flush previous path and reset for new path)
  useEffect(() => {
    if (currentPathRef.current !== pathname) {
      const prevPath = currentPathRef.current;
      flushEvent(prevPath);

      // Reset state for new route
      currentPathRef.current = pathname;
      accumulatedMsRef.current = 0;
      maxScrollPctRef.current = 0;
      if (document.visibilityState === "visible") {
        activeStartRef.current = performance.now();
      } else {
        activeStartRef.current = null;
      }
    }
  }, [pathname, flushEvent]);

  return null;
}
