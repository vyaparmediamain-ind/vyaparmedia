"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

const STORAGE_KEY = "vm_telemetry_banner_dismissed_v1";

export function TelemetryConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Only show if not previously dismissed
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (!dismissed) {
        setVisible(true);
      }
    } catch {
      // LocalStorage access failure fallback
      setVisible(false);
    }
  }, []);

  const handleConsent = async (allowIdentified: boolean) => {
    setIsSubmitting(true);
    try {
      localStorage.setItem(STORAGE_KEY, "true");

      // If user is authenticated, sync preference to database
      await fetch("/api/settings/telemetry-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consent: allowIdentified,
          version: "2026.1",
        }),
      }).catch(() => {
        // Silently tolerate failure if user is not signed in
      });
    } finally {
      setIsSubmitting(false);
      setVisible(false);
    }
  };

  if (!visible) return null;

  return (
    <aside
      aria-label="Privacy and Telemetry Consent"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-lg space-y-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-foreground font-bold text-sm">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <span>Privacy &amp; Analytics Notice</span>
        </div>
        <button
          type="button"
          onClick={() => handleConsent(false)}
          className="text-muted-foreground hover:text-foreground rounded p-1"
          aria-label="Dismiss consent notice with essential settings only"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        We collect anonymous aggregate performance metrics (zero cookies, no IP logging) to improve marketplace matching. You can also allow identified profile views so creators know when your brand discovers their media kit.
      </p>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-1">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => handleConsent(false)}
          disabled={isSubmitting}
          className="text-xs font-semibold"
        >
          Anonymous Only
        </Button>
        <Button
          size="sm"
          variant="primary"
          onClick={() => handleConsent(true)}
          disabled={isSubmitting}
          className="text-xs font-semibold"
        >
          Accept Identified Analytics
        </Button>
      </div>

      <div className="text-[11px] text-muted-foreground pt-1 border-t border-border flex items-center justify-between">
        <span>30-day raw retention limit</span>
        <div className="space-x-2">
          <Link href="/privacy" className="text-primary hover:underline font-medium">
            Privacy Policy
          </Link>
          <span>·</span>
          <Link href="/cookie-policy" className="text-primary hover:underline font-medium">
            Cookie Policy
          </Link>
        </div>
      </div>
    </aside>
  );
}
