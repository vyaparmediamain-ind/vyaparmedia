"use client";

import React from "react";
import { ShieldAlert, Scale, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui";

export interface DealDisputeSectionProps {
  dealId: string;
  status: string;
  isBrand: boolean;
}

export function DealDisputeSection({ dealId, status, isBrand }: DealDisputeSectionProps) {
  const isDisputed = status === "DISPUTED";
  const isCancelled = status === "CANCELLED";
  const isCompleted = status === "COMPLETED";

  if (isCancelled) {
    return null;
  }

  // 1. ACTIVE DISPUTE STATE: Mediation Alert Banner
  if (isDisputed) {
    return (
      <div className="rounded-2xl border-2 border-disputed-border bg-disputed-muted p-5 sm:p-6 mb-6 shadow-sm">
        <div className="flex items-start gap-3.5">
          <div className="p-2 rounded-xl bg-disputed/20 text-disputed shrink-0 mt-0.5">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-heading font-bold text-disputed">
                Dispute Under Active Mediation
              </h3>
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-disputed/20 text-disputed border border-disputed-border shrink-0 whitespace-nowrap">
                Escrow Frozen
              </span>
            </div>
            <p className="text-sm text-disputed/90 mt-2 leading-relaxed">
              A formal dispute has been logged for this contract. All escrow funds are frozen
              securely in accordance with VyaparMedia mediation policy. A dedicated admin arbitrator
              is currently reviewing the contract obligations, chat records, and submission timestamps.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                href={`/dashboard/deals/${dealId}/dispute`}
                variant="danger"
                size="sm"
                className="gap-1.5"
              >
                <Scale className="w-4 h-4" />
                View Mediation Case & Evidence
              </Button>
              <Button
                href={`/dashboard/messages?deal=${dealId}`}
                variant="secondary"
                size="sm"
                className="text-xs"
              >
                Open Deal Chat
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. NORMAL / ACTIVE STATE: Calm secondary entry point
  if (!isCompleted) {
    return (
      <div className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border mb-6 text-xs text-muted-foreground shadow-sm">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-muted-foreground shrink-0" />
          <span>
            Need help or facing an unresolved issue with this {isBrand ? "creator" : "brand"}?
          </span>
        </div>
        <Button
          href={`/dashboard/deals/${dealId}/dispute`}
          variant="secondary"
          size="sm"
          className="text-xs shrink-0"
        >
          Resolve Issue / Mediate
        </Button>
      </div>
    );
  }

  return null;
}
