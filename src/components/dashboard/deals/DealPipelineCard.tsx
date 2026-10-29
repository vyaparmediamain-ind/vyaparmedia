"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { type Deal } from "@/lib/schemas";
import { formatCurrency, formatDate } from "@/lib/utils-client";
import {
  Clock,
  Layers,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  MessageSquare,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Lock,
  Calendar,
  Package,
  Flame,
  Zap,
  XCircle,
} from "lucide-react";
import { Button, Badge, ListItem } from "@/components/ui";
import {
  checkContentSubmissionEligibility,
  checkContractSigningEligibility,
} from "@/lib/action-eligibility";

interface DealPipelineCardProps {
  deal: Deal;
  isSelected: boolean;
  onToggleSelect: () => void;
  isInfluencer: boolean;
}

export function getDealStatusInfo(status: string): {
  label: string;
  tone: "warning" | "success" | "cyan" | "danger" | "muted";
  icon: React.ReactNode;
} {
  switch (status.toUpperCase()) {
    case "PENDING_SIGNATURE":
      return { label: "Awaiting Signature", tone: "warning", icon: <Clock className="w-3 h-3" /> };
    case "ACTIVE":
      return { label: "Active", tone: "cyan", icon: <Layers className="w-3 h-3" /> };
    case "PAYMENT_HELD":
      return { label: "Payment Secured", tone: "success", icon: <Lock className="w-3 h-3" /> };
    case "CONTENT_SUBMITTED":
      return { label: "Awaiting Review", tone: "warning", icon: <Clock className="w-3 h-3" /> };
    case "REVISION_REQUESTED":
      return { label: "Revision Needed", tone: "danger", icon: <AlertTriangle className="w-3 h-3" /> };
    case "CONTENT_APPROVED":
      return { label: "Ready to Post", tone: "success", icon: <CheckCircle2 className="w-3 h-3" /> };
    case "POSTED":
      return { label: "Post Submitted", tone: "cyan", icon: <ExternalLink className="w-3 h-3" /> };
    case "VERIFICATION_PENDING":
      return { label: "Verifying", tone: "warning", icon: <Clock className="w-3 h-3" /> };
    case "VERIFIED":
    case "COMPLETED":
      return { label: "Completed", tone: "success", icon: <ShieldCheck className="w-3 h-3" /> };
    case "DISPUTED":
      return { label: "Disputed", tone: "danger", icon: <AlertCircle className="w-3 h-3" /> };
    case "CANCELLED":
      return { label: "Cancelled", tone: "muted", icon: <Clock className="w-3 h-3" /> };
    default:
      return { label: status.replaceAll("_", " "), tone: "muted", icon: <Clock className="w-3 h-3" /> };
  }
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

function getDeliverableLabel(type: string): string {
  switch (type.toUpperCase()) {
    case "INSTAGRAM_REEL":
      return "IG Reel";
    case "INSTAGRAM_STORY":
      return "IG Story";
    case "INSTAGRAM_POST":
      return "IG Post";
    case "YOUTUBE_VIDEO":
      return "YT Video";
    case "YOUTUBE_SHORT":
      return "YT Short";
    case "TWITTER_POST":
      return "X Post";
    case "LINKEDIN_POST":
      return "LinkedIn";
    default:
      return type.replaceAll("_", " ");
  }
}

export function getDealProgressStep(status: string): { step: number; total: number; label: string } {
  const total = 8;
  switch (status.toUpperCase()) {
    case "PENDING_SIGNATURE":
      return { step: 1, total, label: "Contract Signing" };
    case "ACTIVE":
      return { step: 2, total, label: "Deal Active" };
    case "PAYMENT_HELD":
      return { step: 3, total, label: "Escrow Funded" };
    case "CONTENT_SUBMITTED":
      return { step: 4, total, label: "Content Submitted" };
    case "REVISION_REQUESTED":
      return { step: 4, total, label: "Revision Requested" };
    case "CONTENT_APPROVED":
      return { step: 5, total, label: "Content Approved" };
    case "POSTED":
      return { step: 6, total, label: "Content Live" };
    case "VERIFICATION_PENDING":
      return { step: 7, total, label: "Verifying Reach" };
    case "VERIFIED":
    case "COMPLETED":
      return { step: 8, total, label: "Completed & Released" };
    case "DISPUTED":
      return { step: 4, total, label: "Disputed" };
    case "CANCELLED":
      return { step: 0, total, label: "Cancelled" };
    default:
      return { step: 1, total, label: "In Progress" };
  }
}

function checkIsDueSoon(deadlineStr?: string | null, status?: string): boolean {
  if (!deadlineStr) return false;
  const s = (status || "").toUpperCase();
  if (s === "CANCELLED" || s === "COMPLETED" || s === "VERIFIED" || s === "DISPUTED") return false;
  try {
    const deadline = new Date(deadlineStr).getTime();
    const now = Date.now();
    const diffHours = (deadline - now) / (1000 * 60 * 60);
    return diffHours > 0 && diffHours <= 48;
  } catch {
    return false;
  }
}

export function DealPipelineCard({
  deal,
  isSelected,
  onToggleSelect,
  isInfluencer,
}: Readonly<DealPipelineCardProps>) {
  const statusInfo = getDealStatusInfo(deal.status);
  const progress = getDealProgressStep(deal.status);
  const isBrand = !isInfluencer;

  const submitEligibility = checkContentSubmissionEligibility(deal as unknown as Parameters<typeof checkContentSubmissionEligibility>[0]);
  const signingEligibility = checkContractSigningEligibility(deal as unknown as Parameters<typeof checkContractSigningEligibility>[0], false);

  const dueSoon = checkIsDueSoon(deal.postingDeadline, deal.status);

  const isActionRequired =
    (isInfluencer && ["PENDING_SIGNATURE", "REVISION_REQUESTED", "CONTENT_APPROVED"].includes(deal.status)) ||
    (isBrand && ["CONTENT_SUBMITTED", "POSTED"].includes(deal.status));

  const brandIdentifier =
    deal.brand?.id ||
    deal.brand?.userId ||
    encodeURIComponent(deal.brand?.companyName || "");
  const brandProfileHref = `/brand/${brandIdentifier}`;

  return (
    <ListItem
      as="article"
      variant="card"
      active={isSelected}
      unread={isActionRequired}
      onClick={onToggleSelect}
      aria-expanded={isSelected}
      aria-label={`Deal for ${deal.campaign.title}`}
      className={`overflow-hidden ${
        isActionRequired
          ? "border-pending-border/90 hover:border-pending"
          : ""
      }`}
      leading={
        <Link
          href={brandProfileHref}
          onClick={(e) => e.stopPropagation()}
          className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-full overflow-hidden bg-muted border border-border shrink-0 flex items-center justify-center text-foreground font-bold text-base shadow-2xs hover:ring-2 hover:ring-primary/40 hover:border-primary/50 transition-all cursor-pointer"
          title={`View ${deal.brand?.companyName || "Brand"} public profile`}
        >
          {deal.brand?.logo ? (
            <Image
              src={deal.brand.logo}
              alt={deal.brand.companyName}
              fill
              className="object-cover"
            />
          ) : (
            <span>{deal.brand?.companyName?.[0]?.toUpperCase() || "B"}</span>
          )}
        </Link>
      }
      title={deal.campaign?.title || "Campaign Collaboration"}
      titleBadge={
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant={getBadgeVariant(statusInfo.tone)} className="gap-1 text-[11px]">
            {statusInfo.icon}
            {statusInfo.label}
          </Badge>
          {dueSoon && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-pending-muted text-pending border border-pending-border shrink-0 whitespace-nowrap">
              <Flame className="w-3 h-3 fill-current" /> Due Soon
            </span>
          )}
          {isActionRequired && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-pending-muted text-pending border border-pending-border shrink-0 whitespace-nowrap">
              <Zap className="w-3 h-3 fill-current" /> Action Required
            </span>
          )}
        </div>
      }
      subtitle={
        <span className="flex items-center gap-2 flex-wrap">
          <Link
            href={brandProfileHref}
            onClick={(e) => e.stopPropagation()}
            className="font-semibold text-foreground/90 hover:text-primary transition-colors hover:underline"
            title={`View ${deal.brand?.companyName || "Brand"} public profile`}
          >
            {deal.brand?.companyName || "Brand Partner"}
          </Link>
          <span>•</span>
          {deal.status === "COMPLETED" || deal.status === "VERIFIED" ? (
            <span className="flex items-center gap-1 text-verified font-medium">
              <CheckCircle2 className="w-3 h-3" />
              Completed
            </span>
          ) : deal.status === "CANCELLED" ? (
            <span className="flex items-center gap-1 text-destructive font-medium">
              <XCircle className="w-3 h-3" />
              Cancelled
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Due {formatDate(deal.postingDeadline, "-", { day: "numeric", month: "short" })}
            </span>
          )}
        </span>
      }
      meta={
        deal.deliverables && deal.deliverables.length > 0 ? (
          <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
            {deal.deliverables.map((d, idx) => (
              <span
                key={idx}
                className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-md bg-muted text-muted-foreground"
              >
                {getDeliverableLabel(d.type)} ×{d.count}
              </span>
            ))}
          </div>
        ) : null
      }
      trailing={
        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 w-full sm:w-auto">
          <div className="text-left sm:text-right">
            <div className={`text-[10px] font-bold uppercase tracking-wider flex items-center sm:justify-end gap-1 ${
              deal.status === "COMPLETED" || deal.status === "VERIFIED"
                ? "text-verified"
                : deal.status === "CANCELLED"
                ? "text-destructive"
                : "text-escrow"
            }`}>
              {deal.status === "COMPLETED" || deal.status === "VERIFIED" ? (
                <>
                  <CheckCircle2 className="w-3 h-3" /> Escrow Released
                </>
              ) : deal.status === "CANCELLED" ? (
                <>
                  <XCircle className="w-3 h-3" /> Cancelled
                </>
              ) : (
                <>
                  <Lock className="w-3 h-3" /> Escrow Locked
                </>
              )}
            </div>
            <div className="text-base sm:text-lg font-extrabold font-mono tabular-nums text-foreground">
              {formatCurrency(deal.amount)}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link
              href={`/dashboard/messages?deal=${deal.id}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center justify-center min-h-[40px] min-w-[40px] rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label={`Message about ${deal.campaign.title}`}
            >
              <MessageSquare className="w-4 h-4" />
            </Link>
            <Link
              href={`/dashboard/deals/${deal.id}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 px-3 min-h-[40px] rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
            >
              <span>Deal Room</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <div
              className="min-h-[40px] min-w-[32px] flex items-center justify-center text-muted-foreground hover:text-foreground"
              aria-hidden="true"
            >
              {isSelected ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>
        </div>
      }
    >
      {/* Milestone Progress Bar */}
      <div className="mt-2 pt-2 border-t border-border/40 space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
            <span>Pipeline:</span>
            <span className="text-foreground font-medium">{progress.label}</span>
          </span>
          <span className="font-mono font-bold text-muted-foreground tabular-nums">
            Step {progress.step} of {progress.total} ({Math.round((progress.step / progress.total) * 100)}%)
          </span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              deal.status === "DISPUTED"
                ? "bg-disputed"
                : deal.status === "COMPLETED" || deal.status === "VERIFIED"
                ? "bg-verified"
                : "bg-primary"
            }`}
            style={{ width: `${Math.max(6, (progress.step / progress.total) * 100)}%` }}
          />
        </div>
      </div>

      {/* Expandable Deal Timeline & Actions Drawer */}
      {isSelected && (
        <div className="border-t border-border bg-muted/30 p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Timeline */}
            <div className="rounded-xl border border-border bg-card p-3.5 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Calendar className="w-3.5 h-3.5 text-primary" /> Deal Timeline
              </div>
              <div className="text-xs space-y-1 text-muted-foreground">
                <div className="flex justify-between">
                  <span>Started:</span>
                  <span className="font-semibold text-foreground">{formatDate(deal.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span>
                    {deal.status === "COMPLETED" || deal.status === "VERIFIED"
                      ? "Status:"
                      : deal.status === "CANCELLED"
                      ? "Status:"
                      : "Post Deadline:"}
                  </span>
                  <span
                    className={`font-semibold ${
                      deal.status === "CANCELLED"
                        ? "text-destructive"
                        : deal.status === "COMPLETED" || deal.status === "VERIFIED"
                        ? "text-verified"
                        : "text-primary"
                    }`}
                  >
                    {deal.status === "COMPLETED" || deal.status === "VERIFIED"
                      ? "Completed"
                      : deal.status === "CANCELLED"
                      ? "Cancelled"
                      : formatDate(deal.postingDeadline)}
                  </span>
                </div>
              </div>
            </div>

            {/* Deliverables Breakdown */}
            <div className="rounded-xl border border-border bg-card p-3.5 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Package className="w-3.5 h-3.5 text-primary" /> Deliverables Breakdown
              </div>
              <div className="flex flex-wrap gap-1.5">
                {deal.deliverables.map((d, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-lg bg-muted text-foreground border border-border/60"
                  >
                    {getDeliverableLabel(d.type)} <span className="text-muted-foreground ml-1">×{d.count}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Contextual Action CTAs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-border">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Button
                href={`/dashboard/messages?deal=${deal.id}`}
                variant="secondary"
                size="sm"
                className="w-full sm:w-auto min-h-[44px] text-xs font-semibold gap-1.5 justify-center"
              >
                <MessageSquare className="w-3.5 h-3.5" /> Message Partner
              </Button>
              <Button
                href={`/dashboard/deals/${deal.id}`}
                variant="ghost"
                size="sm"
                className="w-full sm:w-auto min-h-[44px] text-xs font-semibold justify-center"
              >
                Full Agreement →
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              {deal.status === "PENDING_SIGNATURE" && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5">
                  <Button
                    href={`/dashboard/deals/${deal.id}`}
                    variant="primary"
                    size="sm"
                    disabled={!signingEligibility.allowed}
                    title={signingEligibility.reason}
                    className="w-full sm:w-auto min-h-[44px] font-bold text-xs justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {signingEligibility.allowed ? "✍️ Sign Contract" : "✍️ Contract Pending"}
                  </Button>
                  {!signingEligibility.allowed && (
                    <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      <span>{signingEligibility.reason}</span>
                    </span>
                  )}
                </div>
              )}
              {isInfluencer && ["ACTIVE", "PAYMENT_HELD", "REVISION_REQUESTED"].includes(deal.status) && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5">
                  <Button
                    href={`/dashboard/deals/${deal.id}`}
                    variant="primary"
                    size="sm"
                    disabled={!submitEligibility.allowed}
                    title={submitEligibility.reason}
                    className="w-full sm:w-auto min-h-[44px] font-bold text-xs justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    📤 Submit Content
                  </Button>
                  {!submitEligibility.allowed && (
                    <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      <span>{submitEligibility.reason}</span>
                      {submitEligibility.ctaText && (
                        <Link
                          href={`/dashboard/deals/${deal.id}`}
                          className="font-bold underline text-primary"
                        >
                          {submitEligibility.ctaText} →
                        </Link>
                      )}
                    </span>
                  )}
                </div>
              )}
              {isInfluencer && deal.status === "CONTENT_APPROVED" && (
                <Button href={`/dashboard/deals/${deal.id}`} variant="primary" size="sm" className="w-full sm:w-auto min-h-[44px] font-bold text-xs justify-center">
                  🔗 Submit Post URL
                </Button>
              )}
              {isBrand && deal.status === "CONTENT_SUBMITTED" && (
                <Button href={`/dashboard/deals/${deal.id}`} variant="primary" size="sm" className="w-full sm:w-auto min-h-[44px] font-bold text-xs justify-center">
                  👀 Review Content
                </Button>
              )}
              {isBrand && ["POSTED", "VERIFIED", "VERIFICATION_PENDING"].includes(deal.status) && (
                <Button href={`/dashboard/deals/${deal.id}`} variant="primary" size="sm" className="w-full sm:w-auto min-h-[44px] font-bold text-xs justify-center">
                  💰 Release Payment
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </ListItem>
  );
}
