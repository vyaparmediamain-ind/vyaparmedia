"use client";

import React from "react";
import { ReportLetterhead } from "./ReportLetterhead";
import { ReportMetaBlock } from "./ReportMetaBlock";
import { ReportFooter } from "./ReportFooter";
import { DataQualityLegend } from "./DataQualityLegend";
import { MarketRangeReportData } from "@/services/market-range-report.service";
import { Badge } from "@/components/ui/Badge";
import {
  TrendingUp,
  ShieldCheck,
  Calendar,
  AlertTriangle,
  User,
} from "lucide-react";

interface Props {
  readonly data: MarketRangeReportData;
  readonly className?: string | undefined;
}

export function MarketRangeReportView({ data, className = "" }: Props) {
  const { creator, marketRange, snapshots, dataQualitySummary, reportMeta, disclaimer } = data;

  const minRupeesFormatted = Math.round(marketRange.minPaise / 100).toLocaleString("en-IN");
  const maxRupeesFormatted = Math.round(marketRange.maxPaise / 100).toLocaleString("en-IN");
  const baseRupeesFormatted = Math.round(marketRange.basePaise / 100).toLocaleString("en-IN");

  return (
    <div className={`space-y-8 bg-card text-foreground print:bg-card print:text-foreground ${className}`}>
      {/* 1. Official Platform Letterhead */}
      <ReportLetterhead
        title="Estimated Market Range Report"
        subtitle="Algorithmic Valuation Assessment & Benchmark Telemetry"
        categoryLabel="MARKET RANGE ASSESSMENT & BENCHMARK REPORT"
      />

      {/* 2. Canonical Report Metadata Block */}
      <ReportMetaBlock meta={reportMeta} />

      {/* 3. Creator Profile Header Section */}
      <section aria-label="Creator Profile Overview" className="rounded-2xl border border-border bg-muted/20 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <span>{creator.displayName}</span>
                <Badge variant="primary" className="text-2xs font-bold uppercase tracking-wider">
                  {creator.followerTier}
                </Badge>
              </h2>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-0.5">
                {creator.instagramHandle && (
                  <span className="flex items-center gap-1">
                    <svg
                      width={14}
                      height={14}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-3.5 h-3.5 text-primary"
                      aria-hidden="true"
                    >
                      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                    </svg>
                    @{creator.instagramHandle}
                  </span>
                )}
                {creator.youtubeHandle && (
                  <span className="flex items-center gap-1">
                    <svg
                      width={14}
                      height={14}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-3.5 h-3.5 text-danger"
                      aria-hidden="true"
                    >
                      <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
                      <polygon points="10 15 15 12 10 9" />
                    </svg>
                    @{creator.youtubeHandle}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="text-right">
              <span className="text-2xs text-muted-foreground block uppercase font-sans">
                Follower Base
              </span>
              <strong className="text-sm font-bold text-foreground">
                {creator.followers.toLocaleString("en-IN")}
              </strong>
            </div>
            <div className="text-right border-l border-border pl-4">
              <span className="text-2xs text-muted-foreground block uppercase font-sans">
                Authenticity
              </span>
              <strong className="text-sm font-bold text-foreground">
                {creator.authenticityScore != null ? `${creator.authenticityScore}/100` : "Unmeasured"}
              </strong>
            </div>
            <div className="text-right border-l border-border pl-4">
              <span className="text-2xs text-muted-foreground block uppercase font-sans">
                DRS Trust
              </span>
              <strong className="text-sm font-bold text-foreground">
                {creator.drsScore}/900
              </strong>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-2xs font-bold text-muted-foreground uppercase tracking-wider">
            Content Niches:
          </span>
          {creator.categories.map((cat) => (
            <span
              key={cat}
              className="px-2 py-0.5 rounded-md text-2xs font-semibold bg-card border border-border text-foreground"
            >
              {cat}
            </span>
          ))}
        </div>
      </section>

      {/* 4. Estimated Market Range Valuation Card */}
      <section
        aria-label="Estimated Market Range Valuation"
        className="rounded-2xl border border-primary/20 bg-primary/5 p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Estimated Market Range (Standard Deliverable)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="primary" className="text-2xs font-bold uppercase">
              Confidence: {marketRange.confidence}
            </Badge>
            <Badge variant="ghost" className="text-2xs font-bold uppercase">
              Quality: {marketRange.dataQuality}
            </Badge>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <div className="text-3xl sm:text-4xl font-extrabold text-foreground font-mono">
              ₹{minRupeesFormatted} – ₹{maxRupeesFormatted}
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-1">
              Estimated Valuation Midpoint: <strong>₹{baseRupeesFormatted}</strong>
            </p>
          </div>
          <div className="text-2xs text-muted-foreground font-mono sm:text-right">
            <div>Engine Version: {marketRange.engineVersion}</div>
            <div>Config Version: v{marketRange.configVersion}</div>
          </div>
        </div>
      </section>

      {/* 5. Waterfall Valuation Explanation Table */}
      <section aria-label="Valuation Methodology Waterfall" className="space-y-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          Valuation Waterfall Breakdown
        </h3>
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 text-muted-foreground uppercase font-mono tracking-wider text-2xs border-b border-border">
              <tr>
                <th className="p-3">Step</th>
                <th className="p-3">Calculation / Description</th>
                <th className="p-3 text-right">Running Total (INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {marketRange.explanation.map((e, idx) => (
                <tr key={idx} className="hover:bg-muted/10 font-mono">
                  <td className="p-3 font-sans font-bold text-foreground">{e.step}</td>
                  <td className="p-3 font-sans text-muted-foreground">{e.description}</td>
                  <td className="p-3 text-right font-bold text-foreground">
                    ₹{e.runningTotalRupees}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 6. Data Quality Summary & Legend */}
      <DataQualityLegend summary={dataQualitySummary} />

      {/* 7. 12-Week Creator Metric Snapshot Table */}
      <section aria-label="12-Week Historical Delivery Table" className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            12-Week Historical Delivery &amp; Telemetry Basis
          </h3>
          <span className="text-2xs text-muted-foreground font-mono">
            {snapshots.length} Snapshot(s) Available
          </span>
        </div>

        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 text-muted-foreground uppercase font-mono tracking-wider text-2xs border-b border-border">
              <tr>
                <th className="p-3">Week / Date</th>
                <th className="p-3">Platform</th>
                <th className="p-3 font-mono">Followers</th>
                <th className="p-3 font-mono">Average Views</th>
                <th className="p-3 font-mono">Engagement Rate</th>
                <th className="p-3 text-right">Data Quality</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {snapshots.length > 0 ? (
                snapshots.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/10 font-mono">
                    <td className="p-3 font-sans text-foreground">
                      <span className="font-bold">Week #{s.weekIndex}</span>
                      <span className="text-muted-foreground text-2xs block">{s.dateStr}</span>
                    </td>
                    <td className="p-3 font-sans font-medium text-foreground">{s.platform}</td>
                    <td className="p-3 font-bold text-foreground">{s.followersFormatted}</td>
                    <td className="p-3">
                      <span
                        className={
                          s.isEstimated
                            ? "font-semibold text-warning"
                            : "font-bold text-verified"
                        }
                      >
                        {s.avgViewsFormatted}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground">{s.engagementRatePercent}</td>
                    <td className="p-3 text-right">
                      {s.dataQuality === "VERIFIED" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-bold bg-verified-muted text-verified border border-verified-border">
                          VERIFIED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-bold bg-warning/10 text-warning border border-warning/20">
                          ESTIMATED
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-muted-foreground">
                    No historical metric snapshots captured yet. Expected views projected via reach-rate bands.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-2xs text-muted-foreground italic">
          * Note: View metrics flagged as ESTIMATED (prefixed with ~) indicate heuristic reach estimations applied prior to API token connection.
        </p>
      </section>

      {/* 8. Valuation Flags (if applicable) */}
      {marketRange.flags.length > 0 && (
        <section aria-label="Valuation Indicators & Advisory Flags" className="p-4 rounded-xl border border-warning/30 bg-warning/5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-warning">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Valuation Advisory Flags</span>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {marketRange.flags.map((flag) => (
              <Badge key={flag} variant="warning" className="text-2xs font-mono font-bold">
                {flag}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {/* 9. Statutory Advisory Disclaimer */}
      <section aria-label="Statutory Disclaimer" className="p-4 rounded-xl border border-border bg-muted/10 text-2xs text-muted-foreground space-y-1">
        <strong className="text-foreground block uppercase tracking-wider text-2xs">
          Indicative Market Range Disclaimer
        </strong>
        <p>{disclaimer}</p>
      </section>

      {/* 10. Official Document Footer with Integrity Code */}
      <ReportFooter integrityCode={reportMeta.integrityCode} />
    </div>
  );
}
