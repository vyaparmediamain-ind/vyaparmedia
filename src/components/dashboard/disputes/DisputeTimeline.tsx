"use client";

import React from "react";
import { DisputeDetail } from "./DisputeHelpers";
import { formatDateTime } from "@/lib/utils-client";
import { History, CheckCircle2, Clock, AlertCircle, Scale, ShieldCheck } from "lucide-react";

interface DisputeTimelineProps {
  readonly dispute: DisputeDetail;
}

function getDisputeCountdown(createdAtStr: string): string {
  try {
    const created = new Date(createdAtStr).getTime();
    const deadline = created + 48 * 60 * 60 * 1000;
    const diffMs = deadline - Date.now();
    if (diffMs <= 0) return "SLA Expired";
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  } catch {
    return "48h window";
  }
}

export function DisputeTimeline({ dispute }: Readonly<DisputeTimelineProps>) {
  const isResolved = dispute.status === "RESOLVED" || dispute.status === "CLOSED";
  const isTier2 = dispute.tier >= 2 || dispute.status === "TIER2_MEDIATION";
  const isTier3 = dispute.tier >= 3 || dispute.status === "TIER3_ARBITRATION";

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-border/60 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-primary" />
          <h2 className="text-base font-bold text-foreground">Dispute Timeline</h2>
        </div>
        {!isResolved && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-pending bg-pending-muted px-2.5 py-0.5 rounded-full border border-pending-border">
            <Clock className="w-3 h-3 animate-pulse" />
            48h Window: {getDisputeCountdown(dispute.createdAt)}
          </span>
        )}
      </div>

      <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
        {/* Step 1: Dispute Filed */}
        <div className="relative">
          <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-verified text-white flex items-center justify-center">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-xs font-bold text-foreground">Dispute Filed</div>
            <div className="text-[11px] text-muted-foreground">
              {formatDateTime(dispute.createdAt)}
            </div>
          </div>
        </div>

        {/* Step 2: Auto-Resolution Engine */}
        <div className="relative">
          <div
            className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs ${
              isTier2 || isResolved
                ? "bg-verified text-white"
                : "bg-pending text-white animate-pulse"
            }`}
          >
            {isTier2 || isResolved ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <Clock className="w-3.5 h-3.5" />
            )}
          </div>
          <div>
            <div className="text-xs font-bold text-foreground">AI Mediator Analyzed</div>
            <div className="text-[11px] text-muted-foreground">
              {isTier2 || isResolved
                ? "Direct mutual resolution concluded"
                : "Auto-resolution and claim review in progress"}
            </div>
          </div>
        </div>

        {/* Step 3: Human Mediation (Tier 2) */}
        {dispute.tier >= 2 && (
          <div className="relative">
            <div
              className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                isResolved || isTier3
                  ? "bg-verified text-white"
                  : "bg-disputed text-white animate-pulse"
              }`}
            >
              {isResolved || isTier3 ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5" />
              )}
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">
                Escalated to Human Mediation
              </div>
              <div className="text-[11px] text-muted-foreground">
                {isResolved
                  ? "Mediator evidence review concluded"
                  : "Tier 2 neutral arbitrator review in progress"}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Final Arbitration (Tier 3) */}
        {dispute.tier >= 3 && (
          <div className="relative">
            <div
              className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                isResolved
                  ? "bg-verified text-white"
                  : "bg-disputed text-white animate-pulse"
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">Senior Arbitration</div>
              <div className="text-[11px] text-muted-foreground">
                Final binding review by platform escrow legal team
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Resolved */}
        {isResolved && (
          <div className="relative">
            <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-verified text-white flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-xs font-bold text-verified">Case Resolved & Closed</div>
              <div className="text-[11px] text-muted-foreground">
                {dispute.resolvedAt
                  ? formatDateTime(dispute.resolvedAt)
                  : "Settlement terms finalized"}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
