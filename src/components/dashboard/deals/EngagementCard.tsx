"use client";

import { Card } from "@/components/ui";
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
<Card className="card mb-6">
<div className="flex justify-between items-center mb-4">
<h2 className="text-lg font-bold mb-0 flex items-center gap-2">
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4.5 h-4.5 text-blue-500">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
  Post Performance
</h2>
<span className="text-sm font-semibold engagement-trend" data-trend={trend}>
{trendLabels[trend]}
</span>
</div>

{disclaimer && (
<div className="text-xs rounded-sm text-amber px-3 py-2 mb-3 engagement-disclaimer">
{disclaimer}
</div>
)}

<div className="flex gap-2 flex-wrap mb-4">
{engagement.snapshots.map((snap: EngagementSnapshot & { interval?: string; isEstimated?: boolean }, idx: number) => (
<div key={`${snap.timestamp || snap.interval || "snapshot"}_${idx}`} className="p-3 bg-tertiary rounded-sm border-card engagement-snapshot">
<div className="text-muted mb-2 font-bold text-xs uppercase">
{snap.interval || "Interval"}{snap.isEstimated ? " (est.)" : ""}
</div>
<div className="grid gap-1">
{([
["Views", snap.metrics.views.toLocaleString("en-IN")],
["Likes", snap.metrics.likes.toLocaleString("en-IN")],
["Comments", snap.metrics.comments.toLocaleString("en-IN")],
["Shares", (snap.metrics.shares || 0).toLocaleString("en-IN")],
["Reach", (snap.metrics.estimatedReach ?? 0).toLocaleString("en-IN")],
["Eng. Rate", `${(snap.metrics.engagementRate ?? 0).toFixed(2)}%`],
] as [string, string][]).map(([label, val]) => (
<div key={label} className="flex justify-between text-xs">
<span className="text-muted">{label}</span>
<span className="font-semibold">{val}</span>
</div>
))}
</div>
</div>
))}
</div>

{isClient && roi && (
  <div className="rounded-sm p-3.5 engagement-roi-card">
    <div className="text-sm font-bold mb-2 flex items-center gap-2">
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-emerald">
        <rect width="20" height="12" x="2" y="6" rx="2" />
        <circle cx="12" cy="12" r="2" />
        <path d="M6 12h.01M18 12h.01" />
      </svg>
      ROI Summary
    </div>
    <div className="grid gap-2.5 engagement-roi-grid">
      {([
        ["Est. Value", `₹${((roi.estimatedValue ?? 0) / 100).toLocaleString("en-IN")}`],
        ["ROI", `${(roi.roiPercentage ?? 0) >= 0 ? "+" : ""}${roi.roiPercentage ?? 0}%`],
        ["Cost/View", `₹${((roi.costPerView ?? 0) / 100).toFixed(2)}`],
        ["Cost/Eng.", `₹${((roi.costPerEngagement ?? 0) / 100).toFixed(2)}`],
      ] as [string, string][]).map(([label, val]) => (
        <div key={label} className="p-2 bg-secondary rounded-sm">
          <div className="text-muted text-2xs mb-0.5">{label}</div>
          <div className="text-sm font-extrabold engagement-roi-value" data-positive={(roi.roiPercentage ?? 0) >= 0 ? "true" : "false"}>{val}</div>
        </div>
      ))}
    </div>
    <div className="text-muted mt-2 text-xs">
      Based on {latestSnap?.interval || "latest"} data. EMV: views=₹0.20, engagements=₹1.00, clicks=₹5.00.
    </div>
  </div>
)}
</Card>
);
}
