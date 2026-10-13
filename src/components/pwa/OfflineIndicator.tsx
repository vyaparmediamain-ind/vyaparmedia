"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, Wifi, RefreshCw } from "lucide-react";
import { useOptimizedMotion } from "@/hooks/useOptimizedMotion";

export default function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);
  const { shouldReduceMotion } = useOptimizedMotion();

  useEffect(() => {
    // Initial check
    if (typeof window !== "undefined") {
      setIsOffline(!navigator.onLine);
    }

    const handleOffline = () => {
      setIsOffline(true);
      setShowReconnected(false);
    };

    const handleOnline = () => {
      setIsOffline(false);
      setShowReconnected(true);
      // Auto-hide reconnect banner after 3.5s
      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 3500);
      return () => clearTimeout(timer);
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (!isOffline && !showReconnected) return null;

  return (
    <AnimatePresence>
      <motion.div
        role="alert"
        aria-live="assertive"
        initial={{ y: shouldReduceMotion ? 0 : -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: shouldReduceMotion ? 0 : -30, opacity: 0 }}
        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.25, ease: "easeOut" }}
        className="fixed top-0 left-0 right-0 z-[100000] flex items-center justify-center pt-[max(0.5rem,env(safe-area-inset-top,0px))] px-3 pb-2 text-xs font-semibold shadow-md"
      >
        {isOffline ? (
          <div className="w-full max-w-xl mx-auto flex items-center justify-between gap-3 px-4 py-2 rounded-xl bg-amber-600 text-white shadow-lg">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 shrink-0 animate-pulse" />
              <span>You are currently offline. Showing cached last-seen data.</span>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-foreground/15 hover:bg-foreground/25 text-white text-[11px] transition-colors shrink-0"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        ) : (
          <div className="w-full max-w-xl mx-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white shadow-lg">
            <Wifi className="w-4 h-4 shrink-0" />
            <span>Back online! Synchronizing latest deal and wallet data...</span>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
