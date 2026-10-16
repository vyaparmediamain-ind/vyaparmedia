"use client";

import { useEffect, useRef, useState } from "react";

interface UseDealRealtimeOptions {
  dealId: string;
  currentStatus?: string | undefined;
  onRefresh: () => void;
  showToast?: ((type: "success" | "error" | "info", message: string) => void) | undefined;
}

/**
 * useDealRealtime — Adaptive Live Deal Synchronization
 * 
 * ARCHITECTURE (Option A):
 * Uses 2-second adaptive visibility-aware polling during active deal lifecycles.
 * Halts polling when tab is hidden or deal reaches terminal states (COMPLETED/CANCELLED).
 */
export function useDealRealtime({
  dealId,
  currentStatus,
  onRefresh,
  showToast,
}: UseDealRealtimeOptions) {
  const [justUpdated, setJustUpdated] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(() => new Date());
  const lastKnownStatusRef = useRef(currentStatus);

  // Status transition detection
  useEffect(() => {
    const prevStatus = lastKnownStatusRef.current;
    if (currentStatus && prevStatus && currentStatus !== prevStatus) {
      setJustUpdated(true);
      const timer = setTimeout(() => setJustUpdated(false), 3500);
      if (showToast) {
        showToast("info", `Deal updated to ${currentStatus.replaceAll("_", " ")}`);
      }
      lastKnownStatusRef.current = currentStatus;
      return () => clearTimeout(timer);
    }
    lastKnownStatusRef.current = currentStatus;
    return undefined;
  }, [currentStatus, showToast]);

  // Adaptive Visibility-Aware Polling (2 seconds for active in-progress deals)
  useEffect(() => {
    if (!dealId) return;

    // Terminal states do not require high-frequency polling
    if (currentStatus === "COMPLETED" || currentStatus === "CANCELLED") {
      return;
    }

    const interval = setInterval(() => {
      // Only poll when document is visible to save battery and network bandwidth
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        onRefresh();
        setLastSyncTime(new Date());
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [dealId, currentStatus, onRefresh]);

  return {
    justUpdated,
    lastSyncTime,
    isRealtimeActive: true,
  };
}
