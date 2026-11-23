"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ShieldCheck, Eye, EyeOff, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface ConsentData {
  consent: boolean;
  consentAt: string | null;
  version: string | null;
}

interface TelemetryConsentPanelProps {
  readonly showToast?: (message: string, type?: "success" | "error" | "info") => void;
  readonly className?: string | undefined;
}

export function TelemetryConsentPanel({ showToast, className = "" }: Readonly<TelemetryConsentPanelProps> = {}) {
  const [data, setData] = useState<ConsentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConsent = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/settings/telemetry-consent");
      if (!res.ok) {
        throw new Error("Failed to load telemetry consent settings");
      }
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConsent();
  }, [fetchConsent]);

  const handleToggle = async () => {
    if (!data) return;
    setIsUpdating(true);
    const newConsent = !data.consent;
    try {
      const res = await fetch("/api/settings/telemetry-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consent: newConsent,
          version: "2026.1",
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to update consent preferences");
      }

      setData(json.data);
      showToast?.(
        newConsent
          ? "Identified analytics enabled. Brands and creators can see when you view profiles."
          : "Identified analytics disabled. Profile views are now completely anonymous.",
        "success"
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Update failed";
      showToast?.(msg, "error");
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className={`p-5 rounded-2xl border border-border bg-card animate-pulse space-y-3 ${className}`}>
        <div className="h-5 w-48 bg-muted rounded" />
        <div className="h-4 w-72 bg-muted rounded" />
      </div>
    );
  }

  return (
    <div className={`p-5 sm:p-6 rounded-2xl border border-border bg-card shadow-xs space-y-4 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0 mt-0.5">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-foreground">
              Identified Profile Analytics &amp; Visit Telemetry
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
              Under India&apos;s Digital Personal Data Protection (DPDP) Act 2023, you control whether your account identity is linked to creator profile and campaign views. When disabled, all telemetry is 100% anonymous with zero persistent cookies.
            </p>
          </div>
        </div>

        <div className="shrink-0 self-start sm:self-auto">
          {data?.consent ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-verified-muted text-verified border border-verified-border">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Opted In (Identified)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-muted text-muted-foreground border border-border">
              <EyeOff className="w-3.5 h-3.5" />
              Anonymous Only
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl border border-disputed-border bg-disputed-muted text-disputed text-xs flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </span>
          <Button size="sm" variant="ghost" onClick={fetchConsent} className="h-6 text-xs">
            Retry
          </Button>
        </div>
      )}

      <div className="pt-2 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="text-muted-foreground font-mono text-[11px] space-y-0.5">
          {data?.consentAt && (
            <div>
              Consent recorded: {new Date(data.consentAt).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })} (Policy v{data.version || "2026.1"})
            </div>
          )}
          <div>Raw event retention: 30 days maximum · Aggregates anonymized</div>
        </div>

        <Button
          size="sm"
          variant={data?.consent ? "secondary" : "primary"}
          onClick={handleToggle}
          disabled={isUpdating}
          className="font-semibold text-xs gap-1.5 self-start sm:self-auto"
        >
          {isUpdating ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : data?.consent ? (
            <EyeOff className="w-3.5 h-3.5" />
          ) : (
            <Eye className="w-3.5 h-3.5" />
          )}
          <span>{data?.consent ? "Opt-Out to Anonymous" : "Allow Identified Analytics"}</span>
        </Button>
      </div>
    </div>
  );
}
