"use client";

import React from "react";
import { Badge } from "@/components/ui/Badge";
import {
  FileText,
  Info,
  Layers,
} from "lucide-react";
import type { BrandCampaignVisibilityKpis } from "@/lib/visibility-analytics";

export interface BrandCampaignVisibilitySectionProps {
  readonly visibility?: BrandCampaignVisibilityKpis | null | undefined;
}

export function BrandCampaignVisibilitySection({ visibility }: BrandCampaignVisibilitySectionProps) {
  const hasViews = visibility && visibility.campaignBriefViews > 0;

  return (
    <section
      aria-label="Campaign Brief Visibility & Creator Response"
      className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-4">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <span>Campaign Brief Visibility (30 Days)</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Creator viewership, reading dwell times, and conversion to applications across your active briefs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success" className="text-2xs font-bold uppercase tracking-wider">
            VERIFIED TELEMETRY
          </Badge>
        </div>
      </div>

      {!hasViews ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center space-y-3 bg-muted/10">
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <FileText className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-foreground">Campaign Brief Tracking In Progress</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
            Campaign brief tracking requires live traffic. As creators browse and read your campaign guidelines, performance metrics will appear here.
          </p>
        </div>
      ) : (
        <>
          {/* Key Brief Performance Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-muted/30 border border-border">
              <span className="text-2xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                Brief Views
              </span>
              <span className="text-xl font-extrabold text-foreground font-mono tabular-nums">
                {visibility.campaignBriefViews.toLocaleString("en-IN")}
              </span>
              <span className="text-3xs text-muted-foreground block mt-0.5">Across Campaigns</span>
            </div>

            <div className="p-3.5 rounded-xl bg-muted/30 border border-border">
              <span className="text-2xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                Unique Creators
              </span>
              <span className="text-xl font-extrabold text-foreground font-mono tabular-nums">
                {visibility.uniqueViewers.toLocaleString("en-IN")}
              </span>
              <span className="text-3xs text-muted-foreground block mt-0.5">Distinct Viewers</span>
            </div>

            <div className="p-3.5 rounded-xl bg-muted/30 border border-border">
              <span className="text-2xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                Avg Read Time
              </span>
              <span className="text-xl font-extrabold text-foreground font-mono tabular-nums">
                {visibility.avgReadTimeSec}s
              </span>
              <span className="text-3xs text-muted-foreground block mt-0.5">Dwell Duration</span>
            </div>

            <div className="p-3.5 rounded-xl bg-muted/30 border border-border">
              <span className="text-2xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                Apps / 100 Views
              </span>
              <span className="text-xl font-extrabold text-foreground font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                {visibility.applicationsPer100Views}
              </span>
              <span className="text-3xs text-muted-foreground block mt-0.5">
                {visibility.totalApplications} Applications Received
              </span>
            </div>
          </div>

          {/* Best Categories / Niches Distribution */}
          {visibility.bestCategories.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-primary" />
                  <span>Top Responding Creator Categories</span>
                </h3>
                <span className="text-3xs text-muted-foreground font-mono">
                  Ranked by Pitch Volume
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {visibility.bestCategories.map((cat) => (
                  <div
                    key={cat.category}
                    className="p-3 rounded-xl border border-border bg-muted/20 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-foreground">{cat.category}</span>
                      <span className="font-mono tabular-nums text-primary font-bold">
                        {cat.applicationsCount} apps ({cat.percentShare}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${Math.min(100, Math.max(3, cat.percentShare))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Opt-out / Privacy Disclaimer */}
      <div className="p-3 rounded-xl bg-muted/40 border border-border/80 text-3xs text-muted-foreground flex items-start gap-2">
        <Info className="w-4 h-4 shrink-0 text-muted-foreground mt-0.5" />
        <p className="leading-relaxed">
          <strong>Privacy Notice:</strong> Visitor counts respect creator privacy choices. Creators who opt out of telemetry in settings are counted strictly as aggregated anonymous sessions.
        </p>
      </div>
    </section>
  );
}
