"use client";

import { Button } from "@/components/ui";
import {
MediatorAnalysis,
DisputeDetail,
getFindingIcon,
} from "./DisputeHelpers";

interface DisputeAnalysisCardProps {
readonly analysis: MediatorAnalysis | null;
readonly dispute: DisputeDetail;
readonly canTakeAction: boolean;
readonly actionLoading: string | null;
readonly handleDisputeAction: (action: string) => Promise<void>;
}

export function DisputeAnalysisCard({
analysis,
dispute,
canTakeAction,
actionLoading,
handleDisputeAction,
}: Readonly<DisputeAnalysisCardProps>) {
if (!analysis) return null;

let confidenceTone: "success" | "warning" | "danger" = "danger";
if (analysis.confidence === "HIGH") {
confidenceTone = "success";
} else if (analysis.confidence === "MEDIUM") {
confidenceTone = "warning";
}

const trustTone = (value: number) => (value >= 0 ? "positive" : "negative");
const verdictTone = (() => {
switch (analysis.verdict) {
case "INFLUENCER_FAVORED":
return "influencer";
case "BRAND_FAVORED":
return "brand";
case "SPLIT":
return "warning";
case "ESCALATE":
return "danger";
case "DISMISSED":
return "muted";
default:
return "neutral";
}
})();

return (
<div className="card mb-6 dispute-analysis-card">
<div className="flex justify-between items-center mb-4">
<div className="flex items-center gap-3">
  <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-blue-500">
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <rect x="9" y="9" width="6" height="6" />
    <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 15h3M1 9h3M1 15h3" />
  </svg>
<div>
<h2 className="text-lg font-bold">AI Mediator Analysis</h2>
<span className="text-xs text-secondary">
Tier {analysis.tier} Auto-Resolution Engine
</span>
</div>
</div>
<span
className="font-bold rounded-lg text-xs px-2 py-1 dispute-confidence"
data-tone={confidenceTone}
>
{analysis.confidence} CONFIDENCE
</span>
</div>

{/* Verdict */}
{analysis.verdict && analysis.verdict !== "PENDING" && (
<div className="p-4 mb-4 bg-tertiary rounded-md">
<div className="text-xs text-secondary mb-1">VERDICT</div>
<div className="text-base font-bold dispute-verdict" data-tone={verdictTone}>
{analysis.verdict.replaceAll("_", " ")}
</div>
</div>
)}

{/* Explanation */}
<div className="mb-4">
<div className="text-xs text-secondary mb-1">EXPLANATION</div>
<p className="text-sm leading-1-6">{analysis.explanation}</p>
</div>

{/* Financial Outcome */}
{(analysis.refundPercentage > 0 || analysis.influencerPayoutPercentage > 0) && (
<div className="grid gap-3 mb-4 dispute-two-grid">
<div className="p-3 bg-tertiary rounded-md">
<div className="text-secondary text-xs">Brand Refund</div>
<div className="text-xl font-bold">{analysis.refundPercentage}%</div>
</div>
<div className="p-3 bg-tertiary rounded-md">
<div className="text-secondary text-xs">Influencer Payout</div>
<div className="text-xl font-bold">{analysis.influencerPayoutPercentage}%</div>
</div>
</div>
)}

{/* Trust Score Changes */}
{(analysis.trustScoreChanges.influencer !== 0 || analysis.trustScoreChanges.brand !== 0) && (
<div className="grid gap-3 mb-4 dispute-two-grid">
<div className="p-3 bg-tertiary rounded-md">
<div className="text-secondary text-xs">Influencer Trust </div>
<div
className="text-base font-bold dispute-trust-delta"
data-tone={trustTone(analysis.trustScoreChanges.influencer)}
>
{analysis.trustScoreChanges.influencer >= 0 ? "+" : ""}
{analysis.trustScoreChanges.influencer}
</div>
</div>
<div className="p-3 bg-tertiary rounded-md">
<div className="text-secondary text-xs">Brand Trust </div>
<div
className="text-base font-bold dispute-trust-delta"
data-tone={trustTone(analysis.trustScoreChanges.brand)}
>
{analysis.trustScoreChanges.brand >= 0 ? "+" : ""}
{analysis.trustScoreChanges.brand}
</div>
</div>
</div>
)}

{/* Findings */}
{analysis.findings && analysis.findings.length > 0 && (
<div className="mb-4">
<div className="text-xs text-secondary mb-2">FINDINGS</div>
<div className="flex flex-col gap-1.5">
{analysis.findings.map((f, idx) => (
<div
key={f.check + "_" + idx}
className="flex items-center gap-2 bg-tertiary px-3 py-2 rounded-md dispute-finding-row"
data-result={f.result}
>
<span>{getFindingIcon(f.result)}</span>
<div className="flex-1">
<div className="text-sm font-semibold">{f.check}</div>
<div className="text-xs text-secondary">{f.detail}</div>
</div>
<span className="font-bold text-xs dispute-finding-result" data-result={f.result}>
{f.result}
</span>
</div>
))}
</div>
</div>
)}

{/* Action Buttons */}
{canTakeAction && dispute.status !== "RESOLVED" && dispute.status !== "CLOSED" && (
  <div className="flex gap-3 flex-wrap border-t border-card pt-4">
    <Button
      variant="primary"
      onClick={() => {
        if (!confirm("Accept the AI mediator's resolution? This action is final and will apply the proposed financial outcome.")) return;
        handleDisputeAction("accept");
      }}
      disabled={!!actionLoading}
      className="flex-1 flex items-center justify-center gap-2"
    >
      {actionLoading === "accept" ? (
        "Processing..."
      ) : (
        <>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Accept Resolution
        </>
      )}
    </Button>
    <Button
      variant="secondary"
      onClick={() => {
        if (!confirm("Reject this resolution and escalate to the next tier? You cannot undo this.")) return;
        handleDisputeAction("reject");
      }}
      disabled={!!actionLoading}
      className="flex-1 flex items-center justify-center gap-2"
    >
      {actionLoading === "reject" ? (
        "Processing..."
      ) : (
        <>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          Reject & Escalate
        </>
      )}
    </Button>
  </div>
)}
</div>
);
}
