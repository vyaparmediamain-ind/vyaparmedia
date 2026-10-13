"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  AlertCircle,
} from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import EmptyState from "@/components/ui/EmptyState";
import { formatCurrency, formatNumber } from "@/lib/utils-client";
import { CampaignApplication } from "./CampaignDetailHelpers";
import { checkApplicationAcceptanceEligibility } from "@/lib/action-eligibility";
import { MatchScoreBadge } from "../MatchScoreBadge";

interface ApplicationsListProps {
  readonly loading: boolean;
  readonly applications: readonly CampaignApplication[];
  readonly actionId: string | null;
  readonly onAction: (id: string, action: "accept" | "reject") => void;
  readonly campaign?: {
    status: string;
    maxInfluencers?: number | null | undefined;
    selectedInfluencers?: number | null | undefined;
  } | null | undefined;
}

export function ApplicationsList({
  loading,
  applications,
  actionId,
  onAction,
  campaign,
}: ApplicationsListProps) {
  if (loading) {
    return (
      <div className="space-y-4" aria-label="Loading candidate applications" aria-busy="true">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="p-5 rounded-2xl bg-card border border-border animate-pulse space-y-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-muted" />
              <div className="space-y-1.5 flex-1">
                <div className="h-4 w-36 bg-muted rounded" />
                <div className="h-3 w-24 bg-muted rounded" />
              </div>
            </div>
            <div className="h-12 bg-muted/50 rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <EmptyState
        emoji=""
        title="No Creator Pitches Yet"
        description="Your campaign is live in the discovery feed. Applications and pitches from qualified creators will appear here."
        compact
      />
    );
  }

  return (
    <div className="space-y-4">
      {applications.map((application) => {
        const canAct = ["PENDING", "SHORTLISTED"].includes(
          application.status.toUpperCase()
        );
        const isSelected =
          application.status.toUpperCase() === "SELECTED" ||
          application.status.toUpperCase() === "ACCEPTED";
        const isRejected = application.status.toUpperCase() === "REJECTED";
        const matchScore = application.matchScore;
        const acceptanceEligibility = checkApplicationAcceptanceEligibility(application, campaign);

        return (
          <article
            key={application.id}
            className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4 shadow-xs hover:border-border/80 transition-all"
          >
            {/* Top Row: Creator Identity & Status */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-muted border border-border flex items-center justify-center font-bold text-sm text-foreground overflow-hidden relative flex-shrink-0">
                  {application.influencer.avatar ? (
                    <Image
                      src={application.influencer.avatar}
                      alt={application.influencer.displayName}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  ) : (
                    application.influencer.displayName.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/dashboard/influencers/${application.influencer.id}`}
                      className="font-bold text-base text-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
                    >
                      {application.influencer.displayName}
                      <ArrowUpRight className="w-3.5 h-3.5 opacity-60" />
                    </Link>
                    {application.influencer.user?.trustScore ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold bg-verified-muted text-verified border border-verified-border shrink-0 whitespace-nowrap">
                        <ShieldCheck className="w-3 h-3" />
                        DRS {application.influencer.user.trustScore}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span>
                      {application.influencer.categories?.split(",")[0] || "General Creator"}
                    </span>
                    <span>•</span>
                    <span>{formatNumber(application.influencer.instagramFollowers || 0)} Followers</span>
                    <span>•</span>
                    <span>{application.influencer.completedDeals || 0} Deals Done</span>
                  </div>
                </div>
              </div>

              {/* Status & Match Score Badges */}
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                {matchScore !== undefined && (
                  <MatchScoreBadge
                    score={matchScore}
                    breakdown={application.matchBreakdown}
                    creatorName={application.influencer.displayName}
                  />
                )}

                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border shrink-0 whitespace-nowrap ${
                    isSelected
                      ? "bg-verified-muted text-verified border-verified-border"
                      : isRejected
                      ? "bg-disputed-muted text-disputed border-disputed-border"
                      : "bg-muted text-muted-foreground border-border"
                  }`}
                >
                  {isSelected ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : isRejected ? (
                    <XCircle className="w-3.5 h-3.5" />
                  ) : null}
                  {application.status}
                </span>
              </div>
            </div>

            {/* Proposal Pitch Text */}
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/80">
              <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Creator Proposal & Pitch
              </span>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {application.proposal}
              </p>
            </div>

            {/* Financial Metrics & Projections */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-muted/60 border border-border text-xs">
              <div>
                <span className="text-2xs text-muted-foreground block font-medium mb-0.5">
                  PROPOSED RATE
                </span>
                <span className="font-extrabold text-foreground tabular-nums text-sm">
                  {formatCurrency(application.proposedRate)}
                </span>
              </div>
              <div>
                <span className="text-2xs text-muted-foreground block font-medium mb-0.5">
                  AUDIENCE REACH
                </span>
                <span className="font-bold text-foreground tabular-nums">
                  {formatNumber(application.influencer.instagramFollowers || 0)}
                </span>
              </div>
              <div>
                <span className="text-2xs text-muted-foreground block font-medium mb-0.5">
                  ESTIMATED VIEWS
                </span>
                <span className="font-bold text-foreground tabular-nums">
                  {application.matchBreakdown?.estimatedViews
                    ? formatNumber(application.matchBreakdown.estimatedViews)
                    : "—"}
                </span>
              </div>
              <div>
                <span className="text-2xs text-muted-foreground block font-medium mb-0.5">
                  PROJECTED CPV
                </span>
                <span className="font-bold text-primary tabular-nums">
                  {application.matchBreakdown?.estimatedCpvPaise
                    ? `₹${((application.matchBreakdown.estimatedCpvPaise / 100).toFixed(2))}`
                    : "—"}
                </span>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between gap-3 pt-1 border-t border-border/60">
              <Button
                href={`/dashboard/influencers/${application.influencer.id}`}
                variant="secondary"
                size="sm"
                className="text-xs"
              >
                View Full Creator Profile
              </Button>

              <div className="flex items-center gap-2">
                {isSelected && (application as { dealId?: string }).dealId && (
                  <Button
                    href={`/dashboard/deals/${(application as { dealId?: string }).dealId}`}
                    variant="primary"
                    size="sm"
                    className="font-bold"
                  >
                    ✍️ Deal Room Active
                  </Button>
                )}

                {canAct && (
                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                    <div className="flex flex-col items-end gap-1">
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        disabled={actionId === application.id || !acceptanceEligibility.allowed}
                        onClick={() => onAction(application.id, "accept")}
                        className="font-semibold shadow-xs disabled:opacity-50"
                      >
                        {actionId === application.id ? <Spinner size="sm" /> : "Accept & Fund Deal"}
                      </Button>
                      {!acceptanceEligibility.allowed && (
                        <span className="text-[11px] text-amber-500 flex items-center gap-1 font-medium">
                          <AlertCircle className="w-3 h-3 flex-shrink-0" />
                          {acceptanceEligibility.reason}
                        </span>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      disabled={actionId === application.id}
                      onClick={() => onAction(application.id, "reject")}
                      className="font-semibold"
                    >
                      Decline
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
