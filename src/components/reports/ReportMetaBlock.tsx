"use client";

import React from "react";
import type { ReportMeta } from "@/lib/report-meta";

export interface ReportMetaBlockProps {
  meta: ReportMeta;
  className?: string | undefined;
}

export function ReportMetaBlock({ meta, className = "" }: ReportMetaBlockProps) {
  return (
    <section className={`report-meta-block mb-8 ${className}`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
        {/* Dossier 1: Entity & Beneficiary */}
        <div className="border border-border rounded-xl p-3.5 bg-muted/40 space-y-1.5">
          <span className="text-2xs font-bold text-muted-foreground uppercase tracking-wider block">
            Generated For
          </span>
          <div className="text-sm font-bold text-foreground truncate">
            {meta.user.name || "Platform Member"}
          </div>
          <div className="text-muted-foreground flex items-center justify-between">
            <span>Account Role:</span>
            <span className="font-semibold text-foreground">{meta.user.role}</span>
          </div>
          <div className="text-muted-foreground flex items-center justify-between">
            <span>Registered Email:</span>
            <span className="font-mono text-foreground">{meta.user.maskedEmail}</span>
          </div>
          {meta.user.id && (
            <div className="text-muted-foreground flex items-center justify-between font-mono text-2xs">
              <span>Account ID:</span>
              <span className="text-muted-foreground">{meta.user.id.slice(-8).toUpperCase()}</span>
            </div>
          )}
        </div>

        {/* Dossier 2: Report Parameters & Timing */}
        <div className="border border-border rounded-xl p-3.5 bg-muted/40 space-y-1.5">
          <span className="text-2xs font-bold text-muted-foreground uppercase tracking-wider block">
            Statement Scope &amp; Period
          </span>
          <div className="text-sm font-bold text-foreground truncate">{meta.period}</div>
          <div className="text-muted-foreground flex items-center justify-between">
            <span>Scope:</span>
            <span className="font-semibold text-foreground truncate max-w-[160px]" title={meta.scope}>
              {meta.scope}
            </span>
          </div>
          <div className="text-muted-foreground flex items-center justify-between">
            <span>Generated (IST):</span>
            <span className="font-mono text-2xs text-foreground">{meta.generatedAtIst}</span>
          </div>
          <div className="text-muted-foreground flex items-center justify-between font-mono text-2xs">
            <span>UTC Timestamp:</span>
            <span className="truncate max-w-[150px]">{meta.generatedAtUtc}</span>
          </div>
        </div>

        {/* Dossier 3: Technical & Engine Integrity */}
        <div className="border border-border rounded-xl p-3.5 bg-muted/40 space-y-1.5 sm:col-span-2 lg:col-span-1">
          <span className="text-2xs font-bold text-muted-foreground uppercase tracking-wider block">
            Integrity &amp; Engine Versions
          </span>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Report ID:</span>
            <span className="font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20 text-2xs">
              {meta.reportId}
            </span>
          </div>
          <div className="text-muted-foreground flex items-center justify-between">
            <span>Engine Version:</span>
            <span className="font-mono text-foreground text-2xs">
              {meta.versions.analyticsEngine || "v3.0"} / {meta.versions.pricingModel || "v3.0"}
            </span>
          </div>
          <div className="text-muted-foreground">
            <span className="block text-2xs font-semibold mb-0.5">Data Sources:</span>
            <span className="text-2xs text-muted-foreground block line-clamp-1">
              {meta.dataSources.join(", ")}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ReportMetaBlock;
