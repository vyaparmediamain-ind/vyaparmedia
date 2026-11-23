"use client";

import React from "react";
import { Badge } from "@/components/ui/Badge";
import {
  Eye,
  TrendingUp,
  TrendingDown,
  Building2,
  ShieldAlert,
  Info,
} from "lucide-react";
import type { CreatorVisibilityKpis } from "@/lib/visibility-analytics";

export interface CreatorVisibilitySectionProps {
  readonly visibility?: CreatorVisibilityKpis | null | undefined;
}

export function CreatorVisibilitySection({ visibility }: CreatorVisibilitySectionProps) {
  const hasViews = visibility && visibility.views > 0;

  return (
    <section
      aria-label="Profile Visibility & Brand Interest"
      className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-4">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary" />
            <span>Profile Visibility (30 Days)</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Verified viewer impressions, dwell times, and inbound brand interest.
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
            <Eye className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-foreground">Profile Tracking In Progress</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
            Profile tracking needs time to accumulate. As verified brands discover your content and media kit, your audience insights will populate here.
          </p>
        </div>
      ) : (
        <>
          {/* Key Visibility Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3.5 rounded-xl bg-muted/30 border border-border">
              <span className="text-2xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                Profile Views
              </span>
              <span className="text-xl font-extrabold text-foreground font-mono tabular-nums">
                {visibility.views.toLocaleString("en-IN")}
              </span>
              <span className="text-3xs text-muted-foreground block mt-0.5">Last 30 Days</span>
            </div>

            <div className="p-3.5 rounded-xl bg-muted/30 border border-border">
              <span className="text-2xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                Unique Viewers
              </span>
              <span className="text-xl font-extrabold text-foreground font-mono tabular-nums">
                {visibility.uniqueViewers.toLocaleString("en-IN")}
              </span>
              <span className="text-3xs text-muted-foreground block mt-0.5">Distinct Sessions</span>
            </div>

            <div className="p-3.5 rounded-xl bg-muted/30 border border-border">
              <span className="text-2xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                Avg Dwell Time
              </span>
              <span className="text-xl font-extrabold text-foreground font-mono tabular-nums">
                {visibility.avgTimeOnProfileSec}s
              </span>
              <span className="text-3xs text-muted-foreground block mt-0.5">Active Engagement</span>
            </div>

            <div className="p-3.5 rounded-xl bg-muted/30 border border-border">
              <span className="text-2xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                30d Trend
              </span>
              <div className="flex items-center gap-1">
                <span className="text-xl font-extrabold text-foreground font-mono tabular-nums">
                  {visibility.trendVsPrevious30d.trendPercent > 0 ? "+" : ""}
                  {visibility.trendVsPrevious30d.trendPercent}%
                </span>
                {visibility.trendVsPrevious30d.direction === "up" && (
                  <TrendingUp className="w-4 h-4 text-verified" />
                )}
                {visibility.trendVsPrevious30d.direction === "down" && (
                  <TrendingDown className="w-4 h-4 text-danger" />
                )}
              </div>
              <span className="text-3xs text-muted-foreground block mt-0.5">vs Previous 30 Days</span>
            </div>

            <div className="p-3.5 rounded-xl bg-muted/30 border border-border col-span-2 sm:col-span-1">
              <span className="text-2xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                Views → Deals
              </span>
              <span className="text-xl font-extrabold text-foreground font-mono tabular-nums">
                {visibility.conversionRatePercent}%
              </span>
              <span className="text-3xs text-muted-foreground block mt-0.5">
                {visibility.applicationsCount} Deals / Invites
              </span>
            </div>
          </div>

          {/* Identified Brand Viewers Section */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-primary" />
                <span>Identified Brand Viewers</span>
              </h3>
              <span className="text-3xs text-muted-foreground font-mono">
                Consenting Brand Profiles Only
              </span>
            </div>

            {visibility.isSmallNumberSuppressed && (
              <div className="p-3 rounded-xl bg-amber/10 border border-amber/30 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Privacy Threshold Applied:</strong> Fewer than 5 unique brands visited your profile in this window. To protect visitor privacy, views per brand are reported as <strong>&lt;5</strong>.
                </span>
              </div>
            )}

            {visibility.identifiedBrands.length === 0 ? (
              <div className="p-4 rounded-xl border border-border bg-muted/20 text-center text-xs text-muted-foreground">
                No identified brands in this window. Anonymous views and guest traffic are counted in totals above.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {visibility.identifiedBrands.map((brand) => (
                  <div
                    key={brand.companyName}
                    className="p-3 rounded-xl border border-border bg-muted/20 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Building2 className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-bold text-foreground truncate">
                        {brand.companyName}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold font-mono tabular-nums text-foreground">
                        {brand.viewsDisplay} views
                      </span>
                      {brand.isSuppressed && (
                        <span className="block text-3xs text-muted-foreground font-mono">
                          (&lt;5 threshold)
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Opt-out / Privacy Disclaimer */}
      <div className="p-3 rounded-xl bg-muted/40 border border-border/80 text-3xs text-muted-foreground flex items-start gap-2">
        <Info className="w-4 h-4 shrink-0 text-muted-foreground mt-0.5" />
        <p className="leading-relaxed">
          <strong>Privacy Notice:</strong> Telemetry identification applies only to brand accounts with explicit telemetry consent. Viewers who opt out in Settings are counted strictly in aggregated, anonymous session statistics. You can manage your own tracking preferences at any time in <strong>Settings → Security &amp; Privacy</strong>.
        </p>
      </div>
    </section>
  );
}
