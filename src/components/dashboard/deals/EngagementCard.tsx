"use client";

import React from "react";
import { Card } from "@/components/ui";
import { formatCurrency, formatNumber } from "@/lib/utils-client";
import { BarChart3, DollarSign } from "lucide-react";
import { EngagementReport, EngagementSnapshot } from "./DealDetailHelpers";

export function EngagementCard({
  engagement,
  disclaimer,
  isClient,
}: {
  readonly engagement: EngagementReport | null;
  readonly disclaimer: string | null;
  readonly isClient: boolean;
}) {
  if (!engagement || engagement.snapshots.length === 0) return null;

  const trendLabels: Record<string, string> = {
    GROWING: "↗ Growing",
    STABLE: "→ Stable",
    DECLINING: "↘ Declining",
    INSUFFICIENT_DATA: "— Insufficient data",
  };
  const latestSnap = engagement.snapshots.at(-1);
  const roi = engagement.roi;
  const trend = engagement.trend ?? "INSUFFICIENT_DATA";

  return (
    <Card className="p-5 sm:p-6 rounded-2xl border border-border bg-card shadow-sm mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-base sm:text-lg font-heading font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          Post Performance
        </h2>
        <span
          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border shrink-0 whitespace-nowrap ${
            trend === "GROWING"
              ? "bg-verified-muted text-verified border-verified-border"
              : trend === "DECLINING"
              ? "bg-disputed-muted text-disputed border-disputed-border"
              : "bg-muted text-muted-foreground border-border"
          }`}
        >
          {trendLabels[trend]}
        </span>
      </div>

      {disclaimer && (
        <div className="text-xs rounded-xl bg-pending-muted border border-pending-border text-pending px-3 py-2 mb-3">
          {disclaimer}
        </div>
      )}

      <div className="flex gap-2 flex-wrap mb-4">
        {engagement.snapshots.map((snap: EngagementSnapshot & { interval?: string; isEstimated?: boolean }, idx: number) => (
          <div
            key={`${snap.timestamp || snap.interval || "snapshot"}_${idx}`}
            className="p-3 bg-muted/40 rounded-xl border border-border text-xs flex-1 min-w-[140px]"
          >
            <div className="text-muted-foreground mb-2 font-bold text-[11px] uppercase tracking-wider">
              {snap.interval || "Interval"}{snap.isEstimated ? " (est.)" : ""}
            </div>
            <div className="grid gap-1">
              {([
                ["Views", formatNumber(snap.metrics.views)],
                ["Likes", formatNumber(snap.metrics.likes)],
                ["Comments", formatNumber(snap.metrics.comments)],
                ["Shares", formatNumber(snap.metrics.shares || 0)],
                ["Reach", formatNumber(snap.metrics.estimatedReach ?? 0)],
                ["Eng. Rate", `${(snap.metrics.engagementRate ?? 0).toFixed(2)}%`],
              ] as [string, string][]).map(([label, val]) => (
                <div key={label} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-semibold text-foreground tabular-nums font-mono">{val}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {isClient && roi && (
        <div className="rounded-xl p-4 bg-muted/40 border border-border">
          <div className="text-sm font-heading font-bold text-foreground mb-2 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-verified" />
            ROI Summary
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {([
              ["Est. Value", formatCurrency(roi.estimatedValue ?? 0)],
              ["ROI", `${(roi.roiPercentage ?? 0) >= 0 ? "+" : ""}${roi.roiPercentage ?? 0}%`],
              ["Cost/View", `₹${((roi.costPerView ?? 0) / 100).toFixed(2)}`],
              ["Cost/Eng.", `₹${((roi.costPerEngagement ?? 0) / 100).toFixed(2)}`],
            ] as [string, string][]).map(([label, val]) => (
              <div key={label} className="p-2.5 bg-card rounded-lg border border-border">
                <div className="text-muted-foreground text-[10px] mb-0.5 font-medium">{label}</div>
                <div
                  className={`text-sm font-extrabold tabular-nums font-mono ${
                    label === "ROI"
                      ? (roi.roiPercentage ?? 0) >= 0
                        ? "text-verified"
                        : "text-disputed"
                      : "text-foreground"
                  }`}
                >
                  {val}
                </div>
              </div>
            ))}
          </div>
          <div className="text-muted-foreground mt-2 text-[11px]">
            Based on {latestSnap?.interval || "latest"} data. EMV: views=₹0.20, engagements=₹1.00, clicks=₹5.00.
          </div>
        </div>
      )}
    </Card>
  );
}
