"use client";

import React from "react";
import Link from "next/link";
import { Lock, Shield, AlertTriangle, ExternalLink, Clock } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils-client";

export interface DealContextData {
  id: string;
  title: string;
  amountInPaise: number;
  status: string;
  submissionDeadline?: string | null | undefined;
  brandName?: string | null | undefined;
  creatorName?: string | null | undefined;
}

export interface DealContextMiniCardProps {
  deal: DealContextData | null;
}

function getDealStatusConfig(status: string): {
  label: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  icon: React.ReactNode;
} {
  const isDisputed = status === "DISPUTED";
  const isPending =
    status === "PENDING_SIGNATURE" ||
    status === "PENDING_PAYMENT" ||
    status === "AWAITING_SIGNATURE";
  const isEscrowLocked = [
    "PAYMENT_HELD",
    "ACTIVE",
    "CONTENT_SUBMITTED",
    "REVISION_REQUESTED",
    "CONTENT_APPROVED",
    "POSTED",
    "VERIFIED",
  ].includes(status);

  if (isDisputed) {
    return {
      label: "Dispute Active",
      colorClass: "text-disputed",
      bgClass: "bg-disputed-muted",
      borderClass: "border-disputed-border",
      icon: <AlertTriangle className="w-3 h-3" />,
    };
  }
  if (isPending) {
    return {
      label: "Awaiting Signature",
      colorClass: "text-pending",
      bgClass: "bg-pending-muted",
      borderClass: "border-pending-border",
      icon: <Clock className="w-3 h-3" />,
    };
  }
  if (isEscrowLocked) {
    return {
      label: "Escrow Protected",
      colorClass: "text-escrow",
      bgClass: "bg-escrow-muted",
      borderClass: "border-escrow-border",
      icon: <Lock className="w-3 h-3" />,
    };
  }
  return {
    label: status.toLowerCase().replaceAll("_", " "),
    colorClass: "text-muted-foreground",
    bgClass: "bg-muted",
    borderClass: "border-border",
    icon: <Shield className="w-3 h-3" />,
  };
}

/**
 * DealContextMiniCard — Collabr-style sticky pinned deal banner.
 * Renders as a compact always-visible bar at the top of the chat panel
 * (above the message scroll area). Color-coded by deal status.
 */
export function DealContextMiniCard({ deal }: Readonly<DealContextMiniCardProps>) {
  if (!deal) return null;

  const { label, colorClass, bgClass, borderClass, icon } = getDealStatusConfig(deal.status);

  return (
    <aside
      aria-label="Pinned deal context"
      className={`shrink-0 flex items-center justify-between gap-2 px-4 py-2 border-b ${borderClass} ${bgClass} transition-colors`}
    >
      {/* Left: Status pill + deal info */}
      <div className="flex items-center gap-2.5 min-w-0 overflow-hidden">
        {/* Status chip */}
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${colorClass} ${bgClass} ${borderClass}`}
        >
          {icon}
          {label}
        </span>

        {/* Title */}
        <span className="font-semibold text-xs text-foreground truncate max-w-[120px] sm:max-w-[220px]">
          {deal.title}
        </span>

        {/* Amount */}
        <span className="font-extrabold text-xs text-foreground tabular-nums font-mono shrink-0">
          {formatCurrency(deal.amountInPaise)}
        </span>

        {/* Deadline — only if present */}
        {deal.submissionDeadline && (
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
            <Clock className="w-3 h-3" />
            Due{" "}
            {formatDate(deal.submissionDeadline, "-", {
              day: "numeric",
              month: "short",
            })}
          </span>
        )}
      </div>

      {/* Right: Deal Room link */}
      <Link
        href={`/dashboard/deals/${deal.id}`}
        className={`inline-flex items-center gap-1 text-[11px] font-bold ${colorClass} hover:underline shrink-0`}
      >
        <span className="hidden sm:inline">Deal Room</span>
        <ExternalLink className="w-3 h-3" />
      </Link>
    </aside>
  );
}
