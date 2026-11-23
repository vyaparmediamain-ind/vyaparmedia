"use client";

import React, { useState, useEffect } from "react";
import useSWR from "swr";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { fetcher } from "@/lib/fetcher";
import { FlaskConical, ChevronRight, X, MessageSquareHeart } from "lucide-react";

interface RegistrationConfigResponse {
  success: boolean;
  requireReferral: boolean;
  inviteOnly: boolean;
}

export default function BetaModeBanner() {
  const pathname = usePathname();
  const { data } = useSWR<RegistrationConfigResponse>(
    "/api/auth/registration-config",
    fetcher,
    { revalidateOnFocus: true, refreshInterval: 30000 }
  );

  const [isDismissed, setIsDismissed] = useState(false);

  // Read dismissal from session storage so user can collapse on current session if needed
  useEffect(() => {
    try {
      const dismissed = sessionStorage.getItem("vm_beta_banner_dismissed");
      if (dismissed === "true") {
        setIsDismissed(true);
      }
    } catch (_err: unknown) {
    // Handled fallback: Storage quota or restriction failure
    void _err;
  }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem("vm_beta_banner_dismissed", "true");
    } catch (_err: unknown) {
    // Handled fallback: Storage restriction failure
    void _err;
  }
  };

  const handleRestore = () => {
    setIsDismissed(false);
    try {
      sessionStorage.removeItem("vm_beta_banner_dismissed");
    } catch (_err: unknown) {
    // Handled fallback: ignore
    void _err;
  }
  };

  // Only render when invite-only beta mode is active
  if (!data?.requireReferral) {
    return null;
  }

  // Minimized floating badge in the bottom corner
  if (isDismissed) {
    return (
      <aside
        aria-label="Beta Testing Indicator"
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/90 text-amber-950 font-bold text-xs shadow-lg backdrop-blur-md border border-amber-300 hover:bg-amber-400 transition-all cursor-pointer animate-fade-in"
        onClick={handleRestore}
        title="VyaparMedia is currently in Invite-Only Beta Testing. Click to view full details."
      >
        <span className="w-2 h-2 rounded-full bg-amber-950 animate-ping shrink-0" />
        <span className="flex items-center gap-1.5">
          <FlaskConical className="w-3.5 h-3.5" />
          <span>Beta Testing Active</span>
        </span>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Platform Beta Status Banner"
      className="relative z-50 w-full bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-amber-500/20 border-b border-amber-500/30 text-amber-500 dark:text-amber-400 backdrop-blur-md px-3 sm:px-4 py-2 transition-all shadow-xs"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs">
        {/* Left: Beta Pill & Description */}
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 border border-amber-500/40 text-amber-500 dark:text-amber-300 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Live Beta
          </span>

          <p className="font-semibold text-foreground truncate sm:text-clip">
            <span className="hidden sm:inline">
              🚀 <strong>VyaparMedia Private Beta Testing</strong> is live. Platform onboarding currently requires an active referral or invite code.
            </span>
            <span className="sm:hidden">
              🚀 Private Beta Active • Invite Code Required
            </span>
          </p>
        </div>

        {/* Right: Action Buttons & Collapse */}
        <div className="flex items-center gap-2 shrink-0">
          {pathname !== "/register" && (
            <Link
              href="/register"
              className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 text-amber-950 font-bold hover:bg-amber-400 transition-colors shadow-xs text-[11px]"
            >
              <span>Join with Invite Code</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          )}

          <Link
            href="/help"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-foreground transition-colors text-[11px] font-medium border border-amber-500/20"
            title="Provide feedback or report beta issues"
          >
            <MessageSquareHeart className="w-3 h-3 text-amber-500" />
            <span className="hidden sm:inline">Beta Feedback</span>
          </Link>

          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-amber-500/10 transition-colors cursor-pointer"
            title="Minimize beta banner"
            aria-label="Minimize beta banner"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
