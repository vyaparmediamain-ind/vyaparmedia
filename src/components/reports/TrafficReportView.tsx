"use client";

import React from "react";
import { ReportLetterhead } from "./ReportLetterhead";
import { ReportMetaBlock } from "./ReportMetaBlock";
import { ReportFooter } from "./ReportFooter";
import { DataQualityLegend } from "./DataQualityLegend";
import { Badge } from "@/components/ui/Badge";
import { Activity, Globe, Smartphone, Users, Filter } from "lucide-react";
import type { TrafficReportData } from "@/lib/traffic-analytics";
import type { ReportMeta } from "@/lib/report-meta";

export interface TrafficReportViewProps {
  readonly meta: ReportMeta;
  readonly data: TrafficReportData;
  readonly className?: string | undefined;
}

export function TrafficReportView({ meta, data, className = "" }: TrafficReportViewProps) {
  const { summary, topRoutes, funnels, devices, roles, referrers } = data;

  return (
    <div className={`space-y-8 bg-card text-foreground print:bg-card print:text-foreground ${className}`}>
      {/* 1. Official Platform Letterhead */}
      <ReportLetterhead
        title="Platform Traffic & User Behaviour Report"
        subtitle="Official Administrative Traffic, Engagement & Conversion Funnel Analysis"
        categoryLabel="PLATFORM AUDIT & TRAFFIC ANALYTICS"
        isAdmin={true}
      />

      {/* 2. Canonical Report Metadata Block */}
      <ReportMetaBlock meta={meta} />

      {/* 3. Executive Traffic & Engagement Summary */}
      <section aria-label="Traffic Summary KPIs" className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <span>Executive Traffic & Engagement Summary</span>
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="rounded-xl border border-border bg-muted/20 p-3 text-center">
            <span className="text-2xs text-muted-foreground uppercase font-bold block">Unique Visitors</span>
            <span className="text-lg font-black text-foreground font-mono tabular-nums">
              {summary.totalUniqueVisitors.toLocaleString("en-IN")}
            </span>
            <span className="text-3xs text-verified font-bold block mt-0.5">VERIFIED</span>
          </div>

          <div className="rounded-xl border border-border bg-muted/20 p-3 text-center">
            <span className="text-2xs text-muted-foreground uppercase font-bold block">Page Views</span>
            <span className="text-lg font-black text-foreground font-mono tabular-nums">
              {summary.totalPageViews.toLocaleString("en-IN")}
            </span>
            <span className="text-3xs text-verified font-bold block mt-0.5">VERIFIED</span>
          </div>

          <div className="rounded-xl border border-border bg-muted/20 p-3 text-center">
            <span className="text-2xs text-muted-foreground uppercase font-bold block">Avg Active Time</span>
            <span className="text-lg font-black text-foreground font-mono tabular-nums">
              {summary.avgActiveSec}s
            </span>
            <span className="text-3xs text-verified font-bold block mt-0.5">VERIFIED</span>
          </div>

          <div className="rounded-xl border border-border bg-muted/20 p-3 text-center">
            <span className="text-2xs text-muted-foreground uppercase font-bold block">Avg Scroll Depth</span>
            <span className="text-lg font-black text-foreground font-mono tabular-nums">
              {summary.avgScrollPct}%
            </span>
            <span className="text-3xs text-verified font-bold block mt-0.5">VERIFIED</span>
          </div>

          <div className="rounded-xl border border-border bg-muted/20 p-3 text-center col-span-2 sm:col-span-1">
            <span className="text-2xs text-muted-foreground uppercase font-bold block">Bounce Rate</span>
            <span className="text-lg font-black text-amber font-mono tabular-nums">
              ~{summary.bouncePercent}%
            </span>
            <span className="text-3xs text-amber font-bold block mt-0.5">ESTIMATED*</span>
          </div>
        </div>

        <p className="text-3xs text-muted-foreground italic">
          * Bounce rate is an estimated metric calculated as single-page sessions with active dwell time under 10 seconds.
        </p>
      </section>

      {/* 4. Top Routes Table */}
      <section aria-label="Top Routes Breakdown" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            <span>Top Platform Routes (Telemetry Rollups)</span>
          </h2>
          <span className="text-2xs font-mono text-muted-foreground">
            {topRoutes.length} routes monitored
          </span>
        </div>

        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-muted/50 border-b border-border text-2xs uppercase tracking-wider text-muted-foreground font-bold">
              <tr>
                <th className="p-2.5">Route</th>
                <th className="p-2.5 text-right">Visitors</th>
                <th className="p-2.5 text-right">Page Views</th>
                <th className="p-2.5 text-right">Avg Active</th>
                <th className="p-2.5 text-right">Scroll</th>
                <th className="p-2.5 text-right">Bounce (est.)*</th>
                <th className="p-2.5 text-center">Quality</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {topRoutes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-muted-foreground text-xs italic">
                    No traffic recorded for this date range.
                  </td>
                </tr>
              ) : (
                topRoutes.map((r) => (
                  <tr key={r.routeKey} className="hover:bg-muted/10 transition-colors">
                    <td className="p-2.5 font-mono text-foreground font-medium text-xs break-all">
                      {r.routeKey}
                    </td>
                    <td className="p-2.5 text-right font-mono tabular-nums text-foreground">
                      {r.uniqueVisitors.toLocaleString("en-IN")}
                    </td>
                    <td className="p-2.5 text-right font-mono tabular-nums text-foreground">
                      {r.pageViews.toLocaleString("en-IN")}
                    </td>
                    <td className="p-2.5 text-right font-mono tabular-nums text-muted-foreground">
                      {Math.round(r.avgActiveMs / 1000)}s
                    </td>
                    <td className="p-2.5 text-right font-mono tabular-nums text-muted-foreground">
                      {r.avgScrollPct}%
                    </td>
                    <td className="p-2.5 text-right font-mono tabular-nums text-amber">
                      ~{r.bouncePercent}%
                    </td>
                    <td className="p-2.5 text-center">
                      <Badge variant="success" className="text-3xs py-0 px-1 font-bold">
                        VERIFIED
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 5. Device & Role Split Grid */}
      <section aria-label="Device and Role Split" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Device Split */}
        <div className="rounded-xl border border-border p-4 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Smartphone className="w-3.5 h-3.5 text-primary" />
            <span>Device Distribution</span>
          </h3>
          <div className="space-y-2">
            {devices.map((d) => (
              <div key={d.key} className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-foreground">{d.label}</span>
                  <span className="font-mono tabular-nums text-muted-foreground">
                    {d.percentShare}% ({d.pageViews.toLocaleString("en-IN")} views)
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${Math.min(100, Math.max(2, d.percentShare))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Role Split */}
        <div className="rounded-xl border border-border p-4 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-primary" />
            <span>User Persona / Role Distribution</span>
          </h3>
          <div className="space-y-2">
            {roles.map((r) => (
              <div key={r.key} className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-foreground">{r.label}</span>
                  <span className="font-mono tabular-nums text-muted-foreground">
                    {r.percentShare}% ({r.visitors.toLocaleString("en-IN")} visitors)
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full"
                    style={{ width: `${Math.min(100, Math.max(2, r.percentShare))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Referrer Host Distribution */}
      {referrers.length > 0 && (
        <section aria-label="Referrer Hosts" className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Top Inbound Traffic Sources
          </h3>
          <div className="flex flex-wrap gap-2">
            {referrers.slice(0, 10).map((ref) => (
              <div
                key={ref.key}
                className="px-2.5 py-1 rounded-lg border border-border bg-muted/20 text-xs font-mono flex items-center gap-2"
              >
                <span className="text-foreground font-bold">{ref.key}</span>
                <span className="text-muted-foreground">({ref.pageViews} views)</span>
                <span className="text-primary font-bold">{ref.percentShare}%</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 7. Conversion Funnels with Drop-off % */}
      <section aria-label="Conversion Funnels" className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Filter className="w-4 h-4 text-primary" />
          <span>Conversion Funnels & Drop-Off Telemetry</span>
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {funnels.map((funnel) => (
            <div
              key={funnel.funnelKey}
              className="rounded-xl border border-border bg-muted/10 p-4 space-y-3 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between border-b border-border pb-2 mb-3">
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-tight">
                    {funnel.funnelTitle}
                  </h3>
                  <Badge variant="primary" className="text-3xs font-mono font-bold">
                    {funnel.completionRatePercent}% Total
                  </Badge>
                </div>

                <div className="space-y-3">
                  {funnel.steps.map((step, idx) => (
                    <div key={step.stepKey} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-foreground text-2xs truncate max-w-[180px]">
                          {step.label}
                        </span>
                        <span className="font-mono tabular-nums text-muted-foreground text-2xs">
                          {step.sessions.toLocaleString("en-IN")} sessions
                        </span>
                      </div>

                      {/* Drop-off / Conversion indicator */}
                      <div className="flex items-center justify-between text-3xs text-muted-foreground">
                        <span>Conv: {step.conversionPercent}%</span>
                        {idx > 0 && (
                          <span className={step.dropOffPercent > 50 ? "text-danger font-bold" : "text-amber"}>
                            -{step.dropOffPercent}% drop-off
                          </span>
                        )}
                      </div>

                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-verified rounded-full"
                          style={{
                            width: `${Math.min(100, Math.max(2, step.conversionPercent))}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-border/60 text-2xs text-muted-foreground flex justify-between">
                <span>Completed Goal:</span>
                <strong className="font-mono text-foreground font-bold">
                  {funnel.completedSessions} sessions
                </strong>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 8. Data Quality Summary & Legend */}
      <DataQualityLegend summary={meta.dataQualitySummary} />

      {/* 9. Canonical Report Footer */}
      <ReportFooter
        integrityCode={meta.integrityCode}
        reportId={meta.reportId}
        disclaimer="Estimated figures (such as bounce rates and dwell times) are indicative heuristics computed from client beacons. This report is not tax, legal or financial advice."
      />
    </div>
  );
}
