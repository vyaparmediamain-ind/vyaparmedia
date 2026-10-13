"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, ShieldCheck, Zap, WifiOff } from "lucide-react";
import { useOptimizedMotion } from "@/hooks/useOptimizedMotion";
import { logger } from "@/lib/logger-client";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export default function CustomInstallBanner() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const { shouldReduceMotion } = useOptimizedMotion();

  useEffect(() => {
    // Check if already in standalone display mode (installed)
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    setIsStandalone(standalone);
    if (standalone) return;

    // Check if recently dismissed
    const dismissedAt = localStorage.getItem("pwa_install_banner_dismissed");
    if (dismissedAt) {
      const elapsed = Date.now() - Number(dismissedAt);
      if (elapsed < DISMISS_COOLDOWN_MS) {
        return;
      }
    }

    // Capture global beforeinstallprompt if already fired
    if (window.deferredPrompt) {
      setPromptEvent(window.deferredPrompt);
      setIsVisible(true);
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      const prompt = e as BeforeInstallPromptEvent;
      window.deferredPrompt = prompt;
      setPromptEvent(prompt);
      setIsVisible(true);
    };

    const handleAppInstalled = () => {
      setIsVisible(false);
      setIsStandalone(true);
      window.deferredPrompt = null;
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!promptEvent) return;
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") {
        setIsVisible(false);
        setIsStandalone(true);
      }
    } catch (err) {
      logger.warn("[pwa-install] BeforeInstallPrompt handler error", { error: String(err) });
    }
  };

  const handleDismiss = () => {
    localStorage.setItem("pwa_install_banner_dismissed", String(Date.now()));
    setIsVisible(false);
  };

  if (isStandalone || !isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        data-install-prompt="custom_banner_v1"
        role="region"
        aria-label="App Installation Prompt"
        initial={{ y: shouldReduceMotion ? 0 : 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: shouldReduceMotion ? 0 : 80, opacity: 0 }}
        transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 30 }}
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] md:bottom-[max(1.5rem,calc(env(safe-area-inset-bottom,0px)+0.5rem))] left-4 right-4 md:left-auto md:right-6 md:w-[420px] z-[9998] p-4 rounded-2xl bg-card/95 backdrop-blur-xl border border-border shadow-2xl shadow-black/25 text-foreground"
      >
        <div className="flex items-start gap-3">
          {/* Logo / App Icon */}
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-black text-xl shadow-md shrink-0">
            V
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-foreground">Install VyaparMedia</h3>
              <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <ShieldCheck className="w-3 h-3" />
                <span>PWA</span>
              </span>
            </div>

            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
              Add to Home Screen for instant deal alerts, offline access & faster performance.
            </p>

            {/* Micro Benefits */}
            <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px] font-semibold text-muted-foreground">
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-500" />
                <span>Instant Alerts</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <WifiOff className="w-3 h-3 text-blue-500" />
                <span>Offline Mode</span>
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 mt-3.5">
              <button
                type="button"
                onClick={handleInstallClick}
                className="flex-1 py-2 px-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-primary/25 hover:bg-primary/90 active:scale-95 transition-all min-h-[44px] touch-target-44"
              >
                <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Add to Home Screen</span>
              </button>

              <button
                type="button"
                onClick={handleDismiss}
                className="py-2 px-3 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground font-semibold text-xs transition-colors min-h-[44px] touch-target-44 flex items-center justify-center"
              >
                Not Now
              </button>
            </div>
          </div>

          {/* Close X */}
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss install banner"
            className="w-11 h-11 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
