"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  Loader2,
} from "lucide-react";
import type {
  PlatformConfigFieldStatus,
  TaxReportValidationResult,
} from "@/lib/platform-config-check";

interface PlatformConfigApiResponse {
  success: boolean;
  data: {
    fields: PlatformConfigFieldStatus[];
    taxCheck: TaxReportValidationResult;
  };
}

export default function ReportConfigManager() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { data, error, isLoading, isValidating, mutate } =
    useSWR<PlatformConfigApiResponse>(
      "/api/admin/system/platform-config",
      fetcher,
      { revalidateOnFocus: true },
    );

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const fields = data?.data?.fields ?? [];
  const taxCheck = data?.data?.taxCheck ?? {
    valid: false,
    missingFields: [],
    missingFieldLabels: [],
    errorMessage: "Loading server configuration...",
  };

  const taxRequiredFields = fields.filter((f) => f.isTaxRequired);
  const recommendedFields = fields.filter((f) => !f.isTaxRequired);

  return (
    <div className="space-y-6">
      {/* Header Status Banner */}
      <div
        className={`p-5 rounded-2xl border transition-all ${
          isLoading && !data
            ? "bg-muted/40 border-border text-foreground"
            : taxCheck.valid
              ? "bg-verified-muted/60 border-verified-border text-foreground"
              : "bg-amber-500/10 border-amber-500/30 text-foreground"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {isLoading && !data ? (
              <Loader2 className="w-6 h-6 text-muted-foreground animate-spin shrink-0 mt-0.5" />
            ) : taxCheck.valid ? (
              <ShieldCheck className="w-6 h-6 text-verified shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold">
                  {isLoading && !data
                    ? "Checking Platform Configuration..."
                    : taxCheck.valid
                      ? "Statutory Report Configuration Complete"
                      : "Statutory Report Configuration Incomplete"}
                </h2>
                {!isLoading && (
                  <span
                    className={`text-2xs font-bold px-2 py-0.5 rounded-full uppercase ${
                      taxCheck.valid
                        ? "bg-verified-muted text-verified border border-verified-border"
                        : "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40"
                    }`}
                  >
                    {taxCheck.valid
                      ? "Ready for Tax Exports"
                      : "External Exports Blocked"}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {isLoading && !data
                  ? "Retrieving live environment variables directly from server runtime..."
                  : taxCheck.valid
                    ? "All mandatory corporate identity fields (legalName, GSTIN, address) are active in server environment. Official tax and commercial exports (GST TCS, TDS, Invoices, Spend & Income ledgers) will generate with legal validity."
                    : `External tax reports are currently BLOCKED. You must configure: ${taxCheck.missingFieldLabels.join(
                        ", ",
                      )} in server environment variables before external reports can be generated.`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => mutate()}
            disabled={isLoading || isValidating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer shrink-0"
            title="Recheck environment variables"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isValidating ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">Refresh Status</span>
          </button>
        </div>
      </div>

      {/* Mandatory Statutory Tax Fields Card */}
      <div className="p-6 rounded-2xl bg-card border border-border shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <span>Mandatory Statutory Fields (Tax &amp; Legal Requirement)</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Required by Section 65B of Indian Evidence Act, GST Rules &amp; Income Tax Act for valid official documents. Zero hardcoded fallbacks allowed.
            </p>
          </div>
          <span className="text-2xs font-mono text-muted-foreground">
            {taxRequiredFields.filter((f) => f.isConfigured).length} of {taxRequiredFields.length || 3} Configured
          </span>
        </div>

        {isLoading && !data ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-border bg-muted/20 animate-pulse h-28"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {taxRequiredFields.map((field) => (
              <div
                key={field.key}
                className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                  field.isConfigured
                    ? "bg-muted/40 border-border"
                    : "bg-amber-500/5 border-amber-500/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground truncate">{field.label}</span>
                  {field.isConfigured ? (
                    <span className="inline-flex items-center gap-1 text-2xs text-verified font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Active</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-2xs text-amber-600 dark:text-amber-400 font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Missing</span>
                    </span>
                  )}
                </div>

                <div className="p-2 rounded-lg bg-background border border-border/70 font-mono text-2xs break-all">
                  <span className="text-muted-foreground block text-[10px] mb-0.5">Current Value:</span>
                  <span className={field.isConfigured ? "text-foreground font-semibold" : "text-amber-600 dark:text-amber-400 italic"}>
                    {field.value}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="font-mono text-2xs text-muted-foreground">{field.envVar}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(field.envVar, field.envVar)}
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    title="Copy Environment Variable Name"
                  >
                    {copiedKey === field.envVar ? (
                      <Check className="w-3.5 h-3.5 text-verified" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recommended Corporate Identity Fields Card */}
      <div className="p-6 rounded-2xl bg-card border border-border shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-muted-foreground" />
              <span>Recommended Corporate Details (Letterheads &amp; Footers)</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Configured strictly via server environment variables. Zero hardcoded fallbacks.
            </p>
          </div>
          <span className="text-2xs font-mono text-muted-foreground">
            {recommendedFields.filter((f) => f.isConfigured).length} of {recommendedFields.length || 9} Configured
          </span>
        </div>

        {isLoading && !data ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl border border-border bg-muted/20 animate-pulse h-24"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recommendedFields.map((field) => (
              <div
                key={field.key}
                className="p-3 rounded-xl border border-border bg-muted/30 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground truncate">{field.label}</span>
                  {field.isConfigured ? (
                    <span className="text-2xs text-verified font-medium">Configured</span>
                  ) : (
                    <span className="text-2xs text-muted-foreground italic">Optional</span>
                  )}
                </div>

                <div className="font-mono text-2xs truncate text-muted-foreground">
                  {field.value}
                </div>

                <div className="flex items-center justify-between text-2xs text-muted-foreground pt-1 border-t border-border/40">
                  <span className="font-mono truncate">{field.envVar}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(field.envVar, field.envVar)}
                    className="p-0.5 hover:text-foreground transition-colors cursor-pointer"
                    title="Copy Variable"
                  >
                    {copiedKey === field.envVar ? (
                      <Check className="w-3 h-3 text-verified" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
