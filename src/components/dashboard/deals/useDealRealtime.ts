"use client";

import { useEffect, useRef, useState } from "react";
import { subscribeToDealUpdates, getSupabaseRealtimeClient } from "@/lib/supabase-realtime";

interface UseDealRealtimeOptions {
  dealId: string;
  currentStatus?: string | undefined;
  onRefresh: () => void;
  showToast?: ((type: "success" | "error" | "info", message: string) => void) | undefined;
}

export function useDealRealtime({
  dealId,
  currentStatus,
  onRefresh,
  showToast,
}: UseDealRealtimeOptions) {
  const [justUpdated, setJustUpdated] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(() => new Date());
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);
  const lastKnownStatusRef = useRef(currentStatus);

  // Keep ref up-to-date
  useEffect(() => {
    lastKnownStatusRef.current = currentStatus;
  }, [currentStatus]);

  // 1. Supabase Realtime Subscription
  useEffect(() => {
    if (!dealId) return;

    const client = getSupabaseRealtimeClient();
    setIsRealtimeActive(Boolean(client));

    const unsubscribe = subscribeToDealUpdates(dealId, (newRow) => {
      const newStatus = typeof newRow.status === "string" ? newRow.status : undefined;
      const prevStatus = lastKnownStatusRef.current;

      setLastSyncTime(new Date());
      setJustUpdated(true);
      setTimeout(() => setJustUpdated(false), 3500);

      if (newStatus && newStatus !== prevStatus) {
        lastKnownStatusRef.current = newStatus;
        if (showToast) {
          showToast(
            "info",
            `Deal updated to ${newStatus.replaceAll("_", " ")}`
          );
        }
      }

      onRefresh();
    });

    return () => {
      unsubscribe();
    };
  }, [dealId, onRefresh, showToast]);

  // 2. Adaptive Fallback Polling (Every 2 seconds during active/in-progress deals)
  useEffect(() => {
    if (!dealId) return;

    // Terminal states do not require high frequency polling
    if (currentStatus === "COMPLETED" || currentStatus === "CANCELLED") {
      return;
    }

    const interval = setInterval(() => {
      // Only poll if document is visible
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
    isRealtimeActive,
  };
}
