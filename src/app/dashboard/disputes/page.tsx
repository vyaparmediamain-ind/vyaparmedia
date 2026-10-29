"use client";

import React, { useState, useMemo } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import Link from "next/link";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { useSession } from "next-auth/react";
import EmptyState from "@/components/ui/EmptyState";
import { Skeleton, PageContainer, PageHeader } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils-client";
import { type DisputeItem, type DisputesResponse } from "@/lib/schemas/dispute.schema";
import {
  Scale,
  ArrowRight,
  Search,
  X,
  Lock,
  CheckCircle2,
  AlertCircle,
  Clock,
  Building2,
  User,
  HelpCircle,
  AlertTriangle,
  Paperclip,
  Upload,
  Activity,
  TrendingDown,
  Shield,
} from "lucide-react";

type FilterTab = "all" | "active" | "resolved";

/* ── Skeleton ───────────────────────────────────────────────────────────── */
function DisputeSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-2">
            <Skeleton width="40%" height={14} borderRadius={4} />
            <Skeleton width="60%" height={24} borderRadius={6} />
          </div>
        ))}
      </div>
      <div className="space-y-3 pt-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <Skeleton width={100} height={24} borderRadius={12} />
                <Skeleton width={70} height={24} borderRadius={12} />
              </div>
              <Skeleton width={90} height={24} borderRadius={12} />
            </div>
            <Skeleton width="70%" height={22} borderRadius={4} />
            <div className="flex gap-4">
              <Skeleton width={120} height={16} borderRadius={4} />
              <Skeleton width={120} height={16} borderRadius={4} />
            </div>
            <Skeleton width="100%" height={56} borderRadius={8} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Timeline ───────────────────────────────────────────────────────────── */
interface TimelineStepProps {
  label: string;
  isComplete: boolean;
  isActive: boolean;
  isLast?: boolean;
}

function TimelineStep({ label, isComplete, isActive, isLast = false }: TimelineStepProps) {
  return (
    <div className="flex items-center flex-1 last:flex-none">
      <div className="flex items-center gap-2">
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
            isComplete
              ? "bg-verified text-white"
              : isActive
              ? "bg-pending text-white animate-pulse"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {isComplete ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
          {!isComplete && isActive ? <Clock className="w-3.5 h-3.5" /> : null}
          {!isComplete && !isActive ? "•" : null}
        </div>
        <span
          className={`text-xs font-medium ${
            isActive
              ? "text-foreground font-semibold"
              : isComplete
              ? "text-muted-foreground"
              : "text-muted-foreground/60"
          }`}
        >
          {label}
        </span>
      </div>
      {!isLast && (
        <div
          className={`h-0.5 flex-1 mx-2 transition-colors ${
            isComplete ? "bg-verified" : "bg-border"
          }`}
        />
      )}
    </div>
  );
}

function DisputeTimeline({ status }: { status: string }) {
  const isResolvedOrClosed = status === "RESOLVED" || status === "CLOSED";
  const isTier2 = status === "TIER2_MEDIATION";
  const isOpenOrTier1 = status === "OPEN" || status === "TIER1_AUTO";

  const step2Complete = isTier2 || isResolvedOrClosed;
  const step3Complete = isResolvedOrClosed;
  const step4Complete = isResolvedOrClosed;

  return (
    <div className="hidden sm:flex items-center py-2 px-3 bg-muted/40 rounded-xl border border-border/60">
      <TimelineStep label="Filed" isComplete isActive={false} />
      <TimelineStep label="Mutual Talk" isComplete={step2Complete} isActive={isOpenOrTier1} />
      <TimelineStep label="Escrow Mediation" isComplete={step3Complete} isActive={isTier2} />
      <TimelineStep label="Resolution" isComplete={step4Complete} isActive={false} isLast />
    </div>
  );
}

/* ── Helpers ────────────────────────────────────────────────────────────── */
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

/** Returns a relative "X ago" string for last-activity display */
function timeAgo(dateStr: string): string {
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  } catch {
    return "";
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "TIER1_AUTO":
    case "OPEN":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-pending-muted text-pending border border-pending-border shrink-0 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5" />
          Tier 1: Mutual Negotiation
        </span>
      );
    case "TIER2_MEDIATION":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-disputed-muted text-disputed border border-disputed-border animate-pulse shrink-0 whitespace-nowrap">
          <AlertCircle className="w-3.5 h-3.5" />
          Tier 2: Escrow Mediation
        </span>
      );
    case "RESOLVED":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-verified-muted text-verified border border-verified-border shrink-0 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Resolved
        </span>
      );
    case "CLOSED":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border shrink-0 whitespace-nowrap">
          Closed
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border shrink-0 whitespace-nowrap">
          {status.replaceAll("_", " ")}
        </span>
      );
  }
}

/* ── Main Page ──────────────────────────────────────────────────────────── */
export default function DisputesPage() {
  const { data: session } = useSession();
  const { data, isLoading } = useSWR<DisputesResponse>("/api/disputes", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  });
  const disputes = useMemo(() => data?.disputes || [], [data?.disputes]);

  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredDisputes = useMemo(() => {
    return disputes.filter((dispute) => {
      if (activeTab === "active") {
        const isActive =
          dispute.status === "OPEN" ||
          dispute.status === "TIER1_AUTO" ||
          dispute.status === "TIER2_MEDIATION";
        if (!isActive) return false;
      } else if (activeTab === "resolved") {
        const isResolved = dispute.status === "RESOLVED" || dispute.status === "CLOSED";
        if (!isResolved) return false;
      }

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const campaignTitle = dispute.deal?.campaign?.title?.toLowerCase() || "";
      const caseId = dispute.id.toLowerCase();
      const influencerName =
        dispute.deal?.influencer?.displayName?.toLowerCase() ||
        dispute.deal?.influencer?.name?.toLowerCase() ||
        "";
      const brandName =
        dispute.deal?.brand?.companyName?.toLowerCase() ||
        dispute.deal?.brand?.name?.toLowerCase() ||
        "";

      return (
        campaignTitle.includes(q) ||
        caseId.includes(q) ||
        influencerName.includes(q) ||
        brandName.includes(q)
      );
    });
  }, [disputes, activeTab, searchQuery]);

  const metrics = useMemo(() => {
    let activeMediationCount = 0;
    let resolvedCount = 0;
    let totalDisputedAmount = 0;

    for (const d of disputes) {
      if (
        d.status === "OPEN" ||
        d.status === "TIER1_AUTO" ||
        d.status === "TIER2_MEDIATION"
      ) {
        activeMediationCount++;
      } else if (d.status === "RESOLVED" || d.status === "CLOSED") {
        resolvedCount++;
      }
      totalDisputedAmount += d.deal?.amount || 0;
    }

    return {
      totalCount: disputes.length,
      activeMediationCount,
      resolvedCount,
      totalDisputedAmount,
    };
  }, [disputes]);

  return (
    <DashboardShell user={session?.user}>
      <PageContainer maxWidth="6xl" className="space-y-6 animate-fade-in pt-4 pb-0 sm:py-6">

        {/* ── HEADER ──────────────────────────────────────────────────── */}
        <PageHeader
          backHref="/dashboard/deals"
          backLabel="Back to Deals"
          icon={
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Scale className="w-5 h-5" />
            </div>
          }
          title="Dispute & Resolution Center"
          subtitle="Escrow-backed dispute arbitration, evidence examination, and neutral mediation"
          actions={
            <Link
              href="/help"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground border border-border transition-colors"
            >
              <HelpCircle className="w-4 h-4 text-muted-foreground" />
              Resolution Guide
            </Link>
          }
          border={false}
        />

        {/* ── METRIC CARDS ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Total */}
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-2">
              <Activity className="w-3.5 h-3.5" />
              Total Cases
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-foreground tabular-nums">
                {metrics.totalCount}
              </span>
              <span className="text-xs text-muted-foreground">recorded</span>
            </div>
          </div>

          {/* Active */}
          <div className="bg-card border border-pending-border rounded-2xl p-4 shadow-sm">
            <span className="text-xs font-medium text-pending flex items-center gap-1.5 mb-2">
              <Clock className="w-3.5 h-3.5" />
              In Mediation
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-foreground tabular-nums">
                {metrics.activeMediationCount}
              </span>
              {metrics.activeMediationCount > 0 && (
                <span className="text-xs text-pending font-semibold">need action</span>
              )}
            </div>
          </div>

          {/* Resolved */}
          <div className="bg-card border border-verified-border rounded-2xl p-4 shadow-sm">
            <span className="text-xs font-medium text-verified flex items-center gap-1.5 mb-2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Resolved &amp; Closed
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-foreground tabular-nums">
                {metrics.resolvedCount}
              </span>
              <span className="text-xs text-verified font-medium">settled</span>
            </div>
          </div>

          {/* Escrow */}
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-2">
              <Shield className="w-3.5 h-3.5 text-primary" />
              Disputed Escrow
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-black text-foreground tabular-nums">
                {formatCurrency(metrics.totalDisputedAmount)}
              </span>
            </div>
          </div>
        </div>

        {/* ── FILTER BAR ──────────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-2xl p-3 sm:p-4 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
            {/* Tabs */}
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/50 overflow-x-auto no-scrollbar max-w-full flex-nowrap">
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 whitespace-nowrap cursor-pointer ${
                  activeTab === "all"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All Cases ({metrics.totalCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("active")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer ${
                  activeTab === "active"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                In Mediation
                {metrics.activeMediationCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-pending text-white text-[10px] font-bold leading-none">
                    {metrics.activeMediationCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("resolved")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 whitespace-nowrap cursor-pointer ${
                  activeTab === "resolved"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Resolved ({metrics.resolvedCount})
              </button>
            </div>

            {/* Search */}
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                id="disputes-search"
                placeholder="Search campaign, case #, or party..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 text-xs rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── CONTENT ─────────────────────────────────────────────────── */}
        {isLoading ? (
          <DisputeSkeleton />
        ) : disputes.length === 0 ? (
          <EmptyState
            emoji="🛡️"
            title="No Open Disputes"
            description="All your escrow deals are running smoothly with zero disputes or hold-ups."
            actionLabel="View Active Deals"
            actionHref="/dashboard/deals"
          />
        ) : filteredDisputes.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-10 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-pending mx-auto" />
            <h3 className="text-base font-bold text-foreground">No Disputes Found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              No dispute cases match your current search query or filter tab.
            </p>
            <button
              type="button"
              onClick={() => {
                setActiveTab("all");
                setSearchQuery("");
              }}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground border border-border transition-colors"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="space-y-4" role="list" aria-label="Dispute cases">
            {filteredDisputes.map((dispute) => {
              const raw = dispute as DisputeItem & Record<string, unknown>;
              const caseNumber = dispute.id.slice(-6).toUpperCase();
              const influencerName =
                dispute.deal?.influencer?.displayName ||
                dispute.deal?.influencer?.name ||
                "Creator";
              const brandName =
                dispute.deal?.brand?.companyName ||
                dispute.deal?.brand?.name ||
                "Brand";

              const isActive =
                dispute.status === "OPEN" ||
                dispute.status === "TIER1_AUTO" ||
                dispute.status === "TIER2_MEDIATION";
              const isTier2 = dispute.status === "TIER2_MEDIATION";
              const isResolved =
                dispute.status === "RESOLVED" || dispute.status === "CLOSED";

              // Last-activity: prefer updatedAt from API catchall, else createdAt
              const lastActivityStr =
                (typeof raw.updatedAt === "string" ? raw.updatedAt : null) ||
                dispute.createdAt;
              const lastActivityLabel = timeAgo(lastActivityStr);

              // Dynamic claim amounts if available from API
              const brandClaimAmount =
                typeof raw.brandClaimAmount === "number"
                  ? raw.brandClaimAmount
                  : dispute.deal?.amount || 0;
              const creatorClaimAmount =
                typeof raw.creatorClaimAmount === "number"
                  ? raw.creatorClaimAmount
                  : dispute.deal?.amount || 0;
              const brandClaimLabel =
                brandClaimAmount === dispute.deal?.amount
                  ? `Full Refund (${formatCurrency(brandClaimAmount)})`
                  : formatCurrency(brandClaimAmount);
              const creatorClaimLabel =
                creatorClaimAmount === dispute.deal?.amount
                  ? `Full Release (${formatCurrency(creatorClaimAmount)})`
                  : formatCurrency(creatorClaimAmount);

              return (
                <div
                  key={dispute.id}
                  role="listitem"
                  className={`bg-card border rounded-2xl shadow-sm hover:shadow-md transition-all space-y-4 overflow-hidden ${
                    isTier2
                      ? "border-disputed/40"
                      : isActive
                      ? "border-pending/30"
                      : "border-border"
                  }`}
                >
                  {/* ── Urgency strip ────────────────── */}
                  {isActive && (
                    <div
                      className={`flex items-center justify-between px-5 py-2 text-[11px] font-semibold border-b ${
                        isTier2
                          ? "bg-disputed-muted border-disputed-border text-disputed"
                          : "bg-pending-muted border-pending-border text-pending"
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        {isTier2 ? (
                          <>
                            <AlertCircle className="w-3.5 h-3.5" />
                            Arbiter reviewing — response required
                          </>
                        ) : (
                          <>
                            <Clock className="w-3.5 h-3.5 animate-pulse" />
                            Mutual negotiation window: {getDisputeCountdown(dispute.createdAt)}
                          </>
                        )}
                      </span>
                      {/* Last activity */}
                      {lastActivityLabel && (
                        <span className="flex items-center gap-1 text-muted-foreground font-medium">
                          <Activity className="w-3 h-3" />
                          Last activity {lastActivityLabel}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="px-5 pb-5 space-y-4">
                    {/* ── Top row: identifiers + status + escrow amount ── */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-border/50">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-muted text-foreground border border-border">
                          #CASE-{caseNumber}
                        </span>
                        {getStatusBadge(dispute.status)}
                        <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
                          {dispute.type} Issue
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-md border border-border">
                          <Paperclip className="w-3 h-3 text-primary" />
                          Evidence Vault Active
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {isResolved && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-verified bg-verified-muted px-2.5 py-1 rounded-full border border-verified-border">
                            <CheckCircle2 className="w-3 h-3" />
                            Settlement Disbursed
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-primary/10 text-primary border border-primary/20 tabular-nums">
                          <Lock className="w-3.5 h-3.5" />
                          {formatCurrency(dispute.deal?.amount || 0)} Protected
                        </span>
                      </div>
                    </div>

                    {/* ── Timeline progress ──────────────────────────── */}
                    <DisputeTimeline status={dispute.status} />

                    {/* ── Campaign info & parties ────────────────────── */}
                    <div className="space-y-1.5">
                      <h2 className="text-lg font-bold text-foreground hover:text-primary transition-colors">
                        <Link href={`/dashboard/disputes/${dispute.id}`}>
                          {dispute.deal?.campaign?.title || "Campaign Deal"}
                        </Link>
                      </h2>

                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5" />
                          <strong className="text-foreground font-semibold">Brand:</strong>{" "}
                          {brandName}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" />
                          <strong className="text-foreground font-semibold">Creator:</strong>{" "}
                          {influencerName}
                        </span>
                        <span className="text-muted-foreground/60">
                          Deal #{dispute.deal?.id?.slice(-6)?.toUpperCase()}
                        </span>
                        {/* Last activity for resolved disputes */}
                        {isResolved && lastActivityLabel && (
                          <span className="flex items-center gap-1 text-muted-foreground/70">
                            <Activity className="w-3 h-3" />
                            Closed {lastActivityLabel}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ── Party claim amounts ── */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 rounded-xl overflow-hidden border border-border/70 text-xs">
                      <div className="flex items-center justify-between px-3 py-2.5 bg-pending-muted/40 border-b sm:border-b-0 sm:border-r border-border/60">
                        <span className="flex items-center gap-1.5 text-muted-foreground font-medium">
                          <TrendingDown className="w-3.5 h-3.5 text-pending" />
                          Brand Claim
                        </span>
                        <span className="font-bold font-mono text-pending tabular-nums">
                          {brandClaimLabel}
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-3 py-2.5 bg-verified-muted/30">
                        <span className="flex items-center gap-1.5 text-muted-foreground font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 text-verified" />
                          Creator Claim
                        </span>
                        <span className="font-bold font-mono text-verified tabular-nums">
                          {creatorClaimLabel}
                        </span>
                      </div>
                    </div>

                    {/* ── Description excerpt ────────────────────────── */}
                    <div className="bg-background/80 border border-border/80 rounded-xl p-3 text-xs text-muted-foreground leading-relaxed italic">
                      &ldquo;{dispute.description.length > 180
                        ? dispute.description.slice(0, 180) + "..."
                        : dispute.description}&rdquo;
                    </div>

                    {/* ── Bottom row: timestamp + actions */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" />
                        Filed on {formatDate(dispute.createdAt)}
                      </span>

                      <div className="flex items-center gap-2">
                        {/* Inline "Submit Evidence" CTA for active disputes */}
                        {isActive && (
                          <Link
                            href={`/dashboard/disputes/${dispute.id}#evidence`}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-border bg-card text-foreground hover:bg-muted transition-all"
                            aria-label={`Submit evidence for case #CASE-${caseNumber}`}
                          >
                            <Upload className="w-3.5 h-3.5 text-primary" />
                            Submit Evidence
                          </Link>
                        )}

                        <Link
                          href={`/dashboard/disputes/${dispute.id}`}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-white hover:bg-primary/90 shadow-sm hover:translate-x-0.5 transition-all"
                          aria-label={`Enter dispute room for case #CASE-${caseNumber}`}
                        >
                          {isResolved ? "View Resolution" : "Enter Dispute Room"}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PageContainer>
    </DashboardShell>
  );
}
