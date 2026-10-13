"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { type RawDealItem } from "@/lib/schemas";
import { formatCurrency, formatDate, normalizeDeliverables } from "@/lib/utils-client";
import {
  Lock,
  Clock,
  MessageSquare,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ExternalLink,
  Sparkles,
  ChevronRight,
  Flame,
} from "lucide-react";
import { Button, Badge } from "@/components/ui";

interface ActiveDealsFeedProps {
  deals: RawDealItem[];
  isLoading: boolean;
  isBrand: boolean;
  isInfluencer: boolean;
}

export function getStatusBadgeConfig(status: string): {
  label: string;
  tone: "warning" | "success" | "cyan" | "danger" | "muted";
  icon: React.ReactNode;
} {
  switch (status.toUpperCase()) {
    case "PENDING_SIGNATURE":
      return { label: "Awaiting Signature", tone: "warning", icon: <Clock className="w-3 h-3" /> };
    case "ACTIVE":
      return { label: "In Progress", tone: "cyan", icon: <Layers className="w-3 h-3" /> };
    case "CONTENT_SUBMITTED":
      return { label: "Awaiting Review", tone: "warning", icon: <Clock className="w-3 h-3" /> };
    case "REVISION_REQUESTED":
      return { label: "Revision Needed", tone: "danger", icon: <AlertTriangle className="w-3 h-3" /> };
    case "CONTENT_APPROVED":
      return { label: "Ready to Post", tone: "success", icon: <CheckCircle2 className="w-3 h-3" /> };
    case "POSTED":
      return { label: "Post Submitted", tone: "cyan", icon: <ExternalLink className="w-3 h-3" /> };
    case "VERIFIED":
    case "COMPLETED":
      return { label: "Completed", tone: "success", icon: <ShieldCheck className="w-3 h-3" /> };
    default:
      return { label: status, tone: "muted", icon: <Clock className="w-3 h-3" /> };
  }
}

export function filterActiveDeals(deals: RawDealItem[]): RawDealItem[] {
  return deals.filter((d) => {
    const s = (d.state || d.status || "").toUpperCase();
    return s !== "CANCELLED" && s !== "COMPLETED" && s !== "DISPUTED";
  });
}

function getBadgeVariant(tone: string): "primary" | "success" | "danger" | "warning" | "ghost" {
  switch (tone) {
    case "warning":
      return "warning";
    case "success":
      return "success";
    case "danger":
      return "danger";
    case "cyan":
      return "primary";
    default:
      return "ghost";
  }
}

function checkIsDueSoon(deadlineStr?: string | null, status?: string): boolean {
  if (!deadlineStr) return false;
  if (status) {
    const s = status.toUpperCase();
    if (s === "CANCELLED" || s === "COMPLETED" || s === "VERIFIED" || s === "DISPUTED") {
      return false;
    }
  }
  try {
    const deadline = new Date(deadlineStr).getTime();
    const now = Date.now();
    const diffHours = (deadline - now) / (1000 * 60 * 60);
    return diffHours > 0 && diffHours <= 48;
  } catch {
    return false;
  }
}

export function ActiveDealsFeed({
  deals,
  isLoading,
  isBrand,
  isInfluencer: _isInfluencer,
}: Readonly<ActiveDealsFeedProps>) {
  if (isLoading) {
    return (
      <section aria-label="Active collaborations loading" className="space-y-4">
        <div className="h-6 w-48 bg-muted rounded-md animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-border bg-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-pulse"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-full bg-muted shrink-0" />
              <div className="space-y-2">
                <div className="w-48 h-4 bg-muted rounded-md" />
                <div className="w-32 h-3 bg-muted rounded-md" />
              </div>
            </div>
            <div className="w-28 h-8 bg-muted rounded-lg" />
          </div>
        ))}
      </section>
    );
  }

  const activeDeals = filterActiveDeals(deals);

  if (activeDeals.length === 0) {
    return (
      <section
        aria-label="Active collaborations feed"
        className="rounded-2xl border border-dashed border-border bg-card p-8 sm:p-10 text-center"
      >
        <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-3">
          <Sparkles className="w-7 h-7" />
        </div>
        <h3 className="text-base sm:text-lg font-bold text-foreground">
          No Active Collaborations Right Now
        </h3>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto mt-1 mb-5">
          {isBrand
            ? "Launch a new campaign or browse top-ranked creators to begin escrow-protected partnerships."
            : "Explore open brand campaigns matching your niche and submit proposals with guaranteed escrow protection."}
        </p>
        <Button
          href={isBrand ? "/dashboard/campaigns/create" : "/dashboard/campaigns"}
          variant="primary"
          size="md"
          className="font-bold text-xs sm:text-sm gap-1.5 shadow-xs"
        >
          {isBrand ? "Create New Campaign" : "Discover Open Campaigns"}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </section>
    );
  }

  return (
    <section aria-label="Active collaborations feed" className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
            Active Collaborations
          </h2>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary shrink-0 whitespace-nowrap">
            {activeDeals.length}
          </span>
        </div>
        <Link
          href="/dashboard/deals"
          className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5"
        >
          View Pipeline ({deals.length}) <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {activeDeals.slice(0, 5).map((deal) => {
          const status = (deal.state || deal.status || "ACTIVE").toUpperCase();
          const badgeConfig = getStatusBadgeConfig(status);
          const counterpartyName =
            deal.counterpartyName ||
            (isBrand
              ? deal.influencer?.displayName || deal.influencer?.user?.name || "Creator"
              : deal.brand?.companyName || deal.brand?.user?.name || "Brand Partner");
          const counterpartyAvatar =
            deal.counterpartyAvatar ||
            (isBrand
              ? deal.influencer?.avatar || deal.influencer?.user?.image
              : deal.brand?.logo || deal.brand?.user?.image);

          const deliverables = normalizeDeliverables(deal.deliverables || deal.campaign?.deliverables);
          const dealAmount = deal.amount ?? deal.totalAmount ?? 0;
          const deadline = deal.postingDeadline || deal.campaign?.postingDeadline;
          const dueSoon = checkIsDueSoon(deadline, status);

          return (
            <article
              key={deal.id}
              className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs hover:border-primary/50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              {/* Left: Avatar & Collaboration Metadata */}
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="relative w-12 h-12 rounded-full overflow-hidden bg-muted border border-border shrink-0 flex items-center justify-center text-foreground font-bold text-base">
                  {counterpartyAvatar ? (
                    <Image
                      src={counterpartyAvatar}
                      alt={counterpartyName}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <span>{counterpartyName[0]?.toUpperCase() || "C"}</span>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-bold text-foreground">
                      {deal.title || deal.campaign?.title || "Campaign Collaboration"}
                    </h3>
                    <Badge variant={getBadgeVariant(badgeConfig.tone)} className="gap-1 text-[11px]">
                      {badgeConfig.icon}
                      {badgeConfig.label}
                    </Badge>
                    {dueSoon && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-pending-muted text-pending border border-pending-border shrink-0 whitespace-nowrap">
                        <Flame className="w-3 h-3 fill-current" /> Due Soon
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-foreground/90">{counterpartyName}</span>
                    {deadline && (
                      <>
                        <span>•</span>
                        {status === "COMPLETED" || status === "VERIFIED" ? (
                          <span className="flex items-center gap-1 text-verified font-medium">
                            <ShieldCheck className="w-3 h-3" /> Completed
                          </span>
                        ) : status === "CANCELLED" ? (
                          <span className="flex items-center gap-1 text-destructive font-medium">
                            Cancelled
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-muted-foreground" /> Due {formatDate(deadline)}
                          </span>
                        )}
                      </>
                    )}
                  </p>

                  {/* Deliverable Tags */}
                  {deliverables.length > 0 && (
                    <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                      {deliverables.map((d, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-md bg-muted text-muted-foreground"
                        >
                          {d.type.replaceAll("_", " ")} ×{d.count}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Escrow Badge & CTAs */}
              <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-border">
                <div className="text-left md:text-right">
                  <div className={`text-[10px] font-bold uppercase tracking-wider flex items-center md:justify-end gap-1 ${
                    status === "COMPLETED" || status === "VERIFIED"
                      ? "text-verified"
                      : status === "CANCELLED"
                      ? "text-destructive"
                      : "text-escrow"
                  }`}>
                    {status === "COMPLETED" || status === "VERIFIED" ? (
                      <>
                        <ShieldCheck className="w-3 h-3" /> Escrow Released
                      </>
                    ) : status === "CANCELLED" ? (
                      <>
                        Cancelled
                      </>
                    ) : (
                      <>
                        <Lock className="w-3 h-3" /> Escrow Locked
                      </>
                    )}
                  </div>
                  <div className="text-base sm:text-lg font-extrabold font-mono tabular-nums text-foreground">
                    {formatCurrency(dealAmount)}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    href={`/dashboard/messages?deal=${deal.id}`}
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted"
                    aria-label={`Chat about ${deal.title || "deal"}`}
                  >
                    <MessageSquare className="w-4 h-4" />
                  </Button>
                  <Button
                    href={`/dashboard/deals/${deal.id}`}
                    variant="primary"
                    size="sm"
                    className="font-bold text-xs gap-1 shadow-xs"
                  >
                    Manage
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
