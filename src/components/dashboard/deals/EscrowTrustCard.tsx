"use client";

import React from "react";
import { ShieldCheck, Lock, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils-client";

import { Card } from "@/components/ui";

export interface EscrowTrustCardProps {
  amountInPaise: number;
  totalAmountInPaise?: number | undefined;
  platformFeeInPaise?: number | undefined;
  gatewayFeeInPaise?: number | undefined;
  creatorPayoutInPaise?: number | undefined;
  isEscrowLocked: boolean;
  isCompleted: boolean;
  isDisputed: boolean;
  isCancelled: boolean;
  brandCompanyName?: string | undefined;
  creatorName?: string | undefined;
  isBrand: boolean;
}

/**
 * Formats currency strictly to the Indian numbering system:
 * e.g. 100000 rupees -> ₹1,00,000
 */
export const formatIndianRupees = formatCurrency;

export function EscrowTrustCard({
  amountInPaise,
  totalAmountInPaise,
  platformFeeInPaise = 0,
  gatewayFeeInPaise = 0,
  creatorPayoutInPaise,
  isEscrowLocked,
  isCompleted,
  isDisputed,
  isCancelled,
  brandCompanyName = "Brand",
  creatorName = "Creator",
  isBrand,
}: EscrowTrustCardProps) {
  const principal = amountInPaise || 0;
  const grossPayable = totalAmountInPaise || (principal + platformFeeInPaise + gatewayFeeInPaise);
  const netCreatorPayout = creatorPayoutInPaise ?? Math.max(0, principal - platformFeeInPaise);

  return (
    <Card className="p-5 sm:p-6 mb-6 transition-colors">
      {/* Escrow Status Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-escrow-muted text-escrow flex items-center justify-center shrink-0 border border-escrow-border">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
              Escrow Protection
            </span>
            <h3 className="text-base font-heading font-bold text-foreground leading-tight">
              VyaparMedia Secured Escrow
            </h3>
          </div>
        </div>

        {/* Status Pill */}
        {isCompleted ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-verified-muted text-verified border border-verified-border shrink-0 whitespace-nowrap">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Payout Released
          </div>
        ) : isDisputed ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-disputed-muted text-disputed border border-disputed-border shrink-0 whitespace-nowrap">
            <Lock className="w-3.5 h-3.5" />
            Escrow Frozen (Disputed)
          </div>
        ) : isCancelled ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-disputed-muted text-disputed border border-disputed-border shrink-0 whitespace-nowrap">
            Escrow Refunded
          </div>
        ) : isEscrowLocked ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-escrow-muted text-escrow border border-escrow-border shrink-0 whitespace-nowrap">
            <ShieldCheck className="w-3.5 h-3.5" />
            100% Escrow Locked
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-muted text-muted-foreground border border-border shrink-0 whitespace-nowrap">
            Pending Escrow Funding
          </div>
        )}
      </div>

      {/* Main Currency Display */}
      <div className="py-5 sm:py-6 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-4">
        <div>
          <span className="text-xs sm:text-sm font-medium text-muted-foreground">
            {isBrand ? "Total Escrow Secured (Funded by Brand)" : "Guaranteed Deal Value"}
          </span>
          <div className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-tight tabular-nums mt-1 font-mono">
            {formatIndianRupees(isBrand ? grossPayable : principal)}
          </div>
        </div>

        <div className="flex flex-col sm:items-end">
          <span className="text-xs text-muted-foreground font-medium">
            {isBrand ? "Creator Payout (Net)" : "Your Net Payout"}
          </span>
          <div className="text-xl sm:text-2xl font-bold text-verified tabular-nums font-mono mt-0.5">
            {formatIndianRupees(netCreatorPayout)}
          </div>
          <span className="text-[11px] text-muted-foreground mt-0.5">
            Subject to statutory 194-O TDS reporting
          </span>
        </div>
      </div>

      {/* Itemized Financial Breakdown Table */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-muted border border-border text-xs mb-5">
        <div>
          <span className="text-muted-foreground block font-medium">Contract Value</span>
          <span className="font-bold text-foreground tabular-nums text-sm">
            {formatIndianRupees(principal)}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground block font-medium">Platform Fee</span>
          <span className="font-bold text-foreground tabular-nums text-sm">
            {formatIndianRupees(platformFeeInPaise)}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground block font-medium">Gateway & GST</span>
          <span className="font-bold text-foreground tabular-nums text-sm">
            {formatIndianRupees(gatewayFeeInPaise)}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground block font-medium">Settlement Status</span>
          <span className="font-bold text-primary text-sm">
            {isCompleted ? "Transferred" : isEscrowLocked ? "Locked in Escrow" : "Pending Signature"}
          </span>
        </div>
      </div>

      {/* "Funds Are Safe" Trust Callout */}
      {isEscrowLocked && !isCancelled && (
        <div className="p-4 rounded-xl bg-escrow-muted border border-escrow-border text-escrow">
          <div className="flex items-start gap-3">
            <div className="p-1.5 rounded-lg bg-escrow/15 text-escrow shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold flex items-center gap-1.5">
                Funds are 100% Safe & Protected in Escrow
              </h4>
              <p className="text-xs mt-1 leading-relaxed text-escrow/90">
                Money is held in an RBI-compliant escrow account. Neither{" "}
                <span className="font-semibold">{brandCompanyName}</span> nor{" "}
                <span className="font-semibold">{creatorName}</span> can unilaterally withdraw or forfeit
                funds. Payout is released automatically only when deliverables are verified and
                approved according to the contract.
              </p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
