"use client";

import React, { useMemo } from "react";
import { type RawDealItem } from "@/lib/schemas";
import { ShieldCheck, AlertTriangle, Clock, ArrowRight, CheckCircle2, Zap } from "lucide-react";
import { Button } from "@/components/ui";

interface ActionRequiredBannerProps {
  deals: RawDealItem[];
  isBrand: boolean;
  isInfluencer: boolean;
}

export interface ActionItem {
  dealId: string;
  title: string;
  counterparty: string;
  reason: string;
  urgency: "HIGH" | "MEDIUM" | "NORMAL";
  actionLabel: string;
  href: string;
}

export function extractActionItems(
  deals: RawDealItem[],
  isBrand: boolean,
  isInfluencer: boolean
): ActionItem[] {
  const items: ActionItem[] = [];

  for (const deal of deals) {
    const state = (deal.state || deal.status || "").toUpperCase();
    const dealTitle = deal.title || deal.campaign?.title || "Campaign Collaboration";
    const counterparty =
      deal.counterpartyName ||
      (isBrand
        ? deal.influencer?.displayName || deal.influencer?.user?.name || "Creator"
        : deal.brand?.companyName || deal.brand?.user?.name || "Brand Partner");

    if (isInfluencer) {
      if (state === "PENDING_SIGNATURE") {
        items.push({
          dealId: deal.id,
          title: dealTitle,
          counterparty,
          reason: "Digital contract awaiting your countersignature to lock escrow",
          urgency: "HIGH",
          actionLabel: "Sign Agreement",
          href: `/dashboard/deals/${deal.id}`,
        });
      } else if (state === "REVISION_REQUESTED") {
        items.push({
          dealId: deal.id,
          title: dealTitle,
          counterparty,
          reason: "Brand requested revisions on submitted content draft",
          urgency: "HIGH",
          actionLabel: "Submit Revision",
          href: `/dashboard/deals/${deal.id}`,
        });
      } else if (state === "CONTENT_APPROVED") {
        items.push({
          dealId: deal.id,
          title: dealTitle,
          counterparty,
          reason: "Content approved! Ready to publish live on social media",
          urgency: "MEDIUM",
          actionLabel: "Submit Live Link",
          href: `/dashboard/deals/${deal.id}`,
        });
      }
    } else if (isBrand) {
      if (state === "CONTENT_SUBMITTED") {
        items.push({
          dealId: deal.id,
          title: dealTitle,
          counterparty,
          reason: "Creator submitted deliverable — 48h review window active",
          urgency: "HIGH",
          actionLabel: "Review Submission",
          href: `/dashboard/deals/${deal.id}`,
        });
      } else if (state === "POSTED") {
        items.push({
          dealId: deal.id,
          title: dealTitle,
          counterparty,
          reason: "Live post link submitted — verify post to release escrow payout",
          urgency: "MEDIUM",
          actionLabel: "Verify Post",
          href: `/dashboard/deals/${deal.id}`,
        });
      }
    }
  }

  return items;
}

export function ActionRequiredBanner({
  deals,
  isBrand,
  isInfluencer,
}: Readonly<ActionRequiredBannerProps>) {
  const actionItems: ActionItem[] = useMemo(() => {
    return extractActionItems(deals, isBrand, isInfluencer);
  }, [deals, isBrand, isInfluencer]);

  if (actionItems.length > 0) {
    const topItem = actionItems[0];
    const remainingCount = actionItems.length - 1;

    return (
      <section
        aria-label="Action required notification"
        className="relative overflow-hidden rounded-2xl border border-pending-border bg-pending-muted p-4 sm:p-5 shadow-xs transition-all"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pending text-card shadow-xs">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider text-pending">
                  <Zap className="w-3 h-3 fill-current" /> Priority Action
                </span>
                {remainingCount > 0 && (
                  <span className="inline-flex items-center rounded-full bg-pending/15 px-2 py-0.5 text-[10px] font-bold text-pending">
                    +{remainingCount} more in queue
                  </span>
                )}
              </div>
              <h3 className="text-sm sm:text-base font-bold text-foreground mt-0.5">
                {topItem?.title} • <span className="font-semibold text-muted-foreground">{topItem?.counterparty}</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-2xl flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 shrink-0 text-pending" />
                {topItem?.reason}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            {topItem && (
              <Button
                href={topItem.href}
                variant="primary"
                size="sm"
                className="font-bold text-xs gap-1.5 shadow-xs"
              >
                {topItem.actionLabel}
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            )}
            {remainingCount > 0 && (
              <Button
                href="/dashboard/deals"
                variant="secondary"
                size="sm"
                className="text-xs font-semibold"
              >
                View All ({actionItems.length})
              </Button>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Workflow status summary"
      className="rounded-2xl border border-verified-border bg-verified-muted p-4 sm:p-5 transition-all"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-verified/20 text-verified">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-verified uppercase tracking-wider">
                Workstream Active &amp; Up to Date
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                <ShieldCheck className="w-3.5 h-3.5 text-verified" /> 100% Escrow Protected
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              No pending approvals or missed deadlines. All current deliverables are moving on schedule.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <Button
            href={isBrand ? "/dashboard/campaigns/create" : "/dashboard/campaigns"}
            variant="ghost"
            size="sm"
            className="text-xs font-semibold text-primary hover:text-primary/80"
          >
            {isBrand ? "Create New Campaign →" : "Discover Campaigns →"}
          </Button>
        </div>
      </div>
    </section>
  );
}
