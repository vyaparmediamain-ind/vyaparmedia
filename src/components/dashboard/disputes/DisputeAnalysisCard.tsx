"use client";

import React from "react";
import { Button } from "@/components/ui";
import {
  MediatorAnalysis,
  DisputeDetail,
} from "./DisputeHelpers";
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Scale,
  TrendingUp,
  TrendingDown,
  Percent,
} from "lucide-react";

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

  const isHighConfidence = analysis.confidence === "HIGH";
  const isMediumConfidence = analysis.confidence === "MEDIUM";

  const getVerdictLabel = (verdict: string) => {
    switch (verdict) {
      case "INFLUENCER_FAVORED":
        return "Influencer Favored Resolution";
      case "BRAND_FAVORED":
        return "Brand Favored Resolution";
      case "SPLIT":
        return "Split Compromise Settlement";
      case "ESCALATE":
        return "Escalation Recommended";
      case "DISMISSED":
        return "Dispute Dismissed";
      default:
        return verdict.replaceAll("_", " ");
    }
  };

  const getFindingIcon = (result: string) => {
    switch (result) {
      case "PASS":
        return <CheckCircle2 className="w-4 h-4 text-verified flex-shrink-0" />;
      case "FAIL":
        return <XCircle className="w-4 h-4 text-disputed flex-shrink-0" />;
      case "WARNING":
        return <AlertTriangle className="w-4 h-4 text-pending flex-shrink-0" />;
      default:
        return <Scale className="w-4 h-4 text-muted-foreground flex-shrink-0" />;
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4 mb-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              AI Mediator Analysis & Proposal
            </h2>
            <p className="text-xs text-muted-foreground">
              Tier {analysis.tier} Automated Escrow Resolution Engine
            </p>
          </div>
        </div>

        <span
          className={`px-2.5 py-1 rounded-full text-xs font-bold border shrink-0 whitespace-nowrap ${
            isHighConfidence
              ? "bg-verified-muted text-verified border-verified-border"
              : isMediumConfidence
              ? "bg-pending-muted text-pending border-pending-border"
              : "bg-muted text-muted-foreground border-border"
          }`}
        >
          {analysis.confidence} CONFIDENCE
        </span>
      </div>

      {/* Recommended Verdict Banner */}
      {analysis.verdict && analysis.verdict !== "PENDING" && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
          <div className="text-[11px] font-bold text-primary uppercase tracking-wider mb-0.5">
            Proposed Verdict
          </div>
          <div className="text-base font-bold text-foreground">
            {getVerdictLabel(analysis.verdict)}
          </div>
        </div>
      )}

      {/* Explanation */}
      <div className="space-y-1">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
          Mediator Reasoning
        </span>
        <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed bg-muted/30 p-3.5 rounded-xl border border-border/60">
          {analysis.explanation}
        </p>
      </div>

      {/* Financial Split Breakdown */}
      {(analysis.refundPercentage > 0 || analysis.influencerPayoutPercentage > 0) && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/40 border border-border rounded-xl p-3.5 space-y-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Percent className="w-3.5 h-3.5" />
              Brand Refund
            </span>
            <div className="text-xl font-black text-foreground tabular-nums">
              {analysis.refundPercentage}%
            </div>
          </div>
          <div className="bg-muted/40 border border-border rounded-xl p-3.5 space-y-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Percent className="w-3.5 h-3.5" />
              Creator Payout
            </span>
            <div className="text-xl font-black text-foreground tabular-nums">
              {analysis.influencerPayoutPercentage}%
            </div>
          </div>
        </div>
      )}

      {/* Trust Score Delta Impact */}
      {(analysis.trustScoreChanges.influencer !== 0 || analysis.trustScoreChanges.brand !== 0) && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/30 border border-border rounded-xl p-3 flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Creator Trust (DRS)</span>
            <span
              className={`text-xs font-bold flex items-center gap-1 ${
                analysis.trustScoreChanges.influencer >= 0
                  ? "text-verified"
                  : "text-disputed"
              }`}
            >
              {analysis.trustScoreChanges.influencer >= 0 ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5" />
              )}
              {analysis.trustScoreChanges.influencer >= 0 ? "+" : ""}
              {analysis.trustScoreChanges.influencer} pts
            </span>
          </div>

          <div className="bg-muted/30 border border-border rounded-xl p-3 flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Brand Trust (DRS)</span>
            <span
              className={`text-xs font-bold flex items-center gap-1 ${
                analysis.trustScoreChanges.brand >= 0
                  ? "text-verified"
                  : "text-disputed"
              }`}
            >
              {analysis.trustScoreChanges.brand >= 0 ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5" />
              )}
              {analysis.trustScoreChanges.brand >= 0 ? "+" : ""}
              {analysis.trustScoreChanges.brand} pts
            </span>
          </div>
        </div>
      )}

      {/* Objective Findings Checks */}
      {analysis.findings && analysis.findings.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
            Objective Contract & Evidence Audit
          </span>
          <div className="space-y-2">
            {analysis.findings.map((f, idx) => (
              <div
                key={f.check + "_" + idx}
                className="flex items-start gap-2.5 bg-background/80 border border-border/80 p-3 rounded-xl"
              >
                {getFindingIcon(f.result)}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-foreground">{f.check}</div>
                  <div className="text-[11px] text-muted-foreground leading-normal mt-0.5">
                    {f.detail}
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-muted text-foreground border border-border">
                  {f.result}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Triggers */}
      {canTakeAction && dispute.status !== "RESOLVED" && dispute.status !== "CLOSED" && (
        <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-border/60">
          <Button
            variant="primary"
            onClick={() => {
              if (
                !confirm(
                  "Accept the proposed resolution? This action is final and will disburse escrow funds accordingly."
                )
              )
                return;
              handleDisputeAction("accept");
            }}
            disabled={!!actionLoading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-xs"
          >
            {actionLoading === "accept" ? (
              "Processing Settlement..."
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Accept Proposed Settlement
              </>
            )}
          </Button>

          <Button
            variant="secondary"
            onClick={() => {
              if (
                !confirm(
                  "Reject this recommendation and escalate to next tier? A human mediator will review."
                )
              )
                return;
              handleDisputeAction("reject");
            }}
            disabled={!!actionLoading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-xs border border-border"
          >
            {actionLoading === "reject" ? (
              "Escalating..."
            ) : (
              <>
                <XCircle className="w-4 h-4 text-disputed" />
                Reject & Request Human Review
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
