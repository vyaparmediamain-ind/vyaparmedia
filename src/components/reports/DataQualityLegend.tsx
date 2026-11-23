"use client";

import React from "react";
import { ShieldCheck, Sparkles, UserCheck } from "lucide-react";
import type { DataQualitySummary } from "@/lib/report-meta";

export interface DataQualityLegendProps {
  summary?: DataQualitySummary | undefined;
  className?: string | undefined;
  showColumnFootnotes?: boolean | undefined;
}

export function DataQualityLegend({
  summary,
  className = "",
  showColumnFootnotes = true,
}: DataQualityLegendProps) {
  const verified = summary ? Math.round(summary.verifiedPercent) : 100;
  const estimated = summary ? Math.round(summary.estimatedPercent) : 0;
  const selfReported = summary ? Math.round(summary.selfReportedPercent) : 0;

  return (
    <div className={`data-quality-legend space-y-2 mb-6 ${className}`}>
      {/* Summary Row */}
      <div className="p-3 rounded-xl bg-muted/50 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-verified shrink-0" />
          <span className="font-bold text-foreground">
            Data Quality Audit:
          </span>
          <span className="text-muted-foreground font-medium">
            {verified}% verified, {estimated}% estimated, {selfReported}% self-reported
          </span>
        </div>

        {/* Visual Pill Stack */}
        <div className="flex items-center gap-1.5 shrink-0 text-2xs font-semibold">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-verified-muted text-verified border border-verified-border">
            <span className="w-1.5 h-1.5 rounded-full bg-verified" />
            <span>Verified API ({verified}%)</span>
          </span>

          {estimated > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>Estimated ({estimated}%)</span>
            </span>
          )}

          {selfReported > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
              <span>Self-Reported ({selfReported}%)</span>
            </span>
          )}
        </div>
      </div>

      {/* Explanatory Legend & Footnotes */}
      {showColumnFootnotes && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-2xs text-muted-foreground px-1">
          <div className="flex items-start gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-verified shrink-0 mt-0.5" />
            <span>
              <strong>Verified (API):</strong> Measured directly via platform OAuth APIs (Meta Graph API / YouTube Data API v3).
            </span>
          </div>
          <div className="flex items-start gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
            <span>
              <strong>Estimated (~ or est.):</strong> Derived from statistical reach distribution and verified category baselines.
            </span>
          </div>
          <div className="flex items-start gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <span>
              <strong>Self-Reported:</strong> Provided directly by brand or creator without third-party cryptographic verification.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataQualityLegend;
