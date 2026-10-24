"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import EmptyState from "@/components/ui/EmptyState";
import { Badge, Button, PageContainer, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/utils-client";
import { ShieldAlert, CheckCircle2, XCircle, AlertTriangle, RefreshCw } from "lucide-react";

type SuspiciousReviewPair = {
  id: string;
  influencerUserId: string;
  brandUserId: string;
  totalDealsInPair: number;
  suspiciousDealCount: number;
  avgDealAmountPaise: number;
  qualifyingThresholdPaise: number;
  flagReason: string;
  riskScore: number;
  status: "PENDING" | "CONFIRMED" | "DISMISSED";
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
  influencerUser: {
    id: string;
    email: string;
    trustScore: number;
    influencerProfile: { completedDeals: number } | null;
  };
  brandUser: {
    id: string;
    email: string;
    trustScore: number;
  };
};

type ApiResponseData = {
  success: boolean;
  data: SuspiciousReviewPair[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export default function AdminSuspiciousReviewsPage() {
  const [statusFilter, setStatusFilter] = useState<"PENDING" | "CONFIRMED" | "DISMISSED">("PENDING");
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const { data, error, isLoading, mutate } = useSWR<ApiResponseData>(
    `/api/admin/reports/suspicious-reviews?status=${statusFilter}`,
    fetcher
  );

  const flags = data?.data || [];

  const handleResolve = async (flagId: string, resolution: "CONFIRMED" | "DISMISSED") => {
    setResolvingId(flagId);
    try {
      const res = await fetch("/api/admin/reports/suspicious-reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flagId,
          status: resolution,
          note: resolution === "CONFIRMED"
            ? "Confirmed wash-trading / collusion pattern by admin review."
            : "Reviewed by admin and verified as legitimate collaboration.",
        }),
      });
      if (res.ok) {
        await mutate();
      }
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <PageContainer maxWidth="6xl" className="space-y-6 py-2 sm:py-4">
      {/* ── Page Header ── */}
      <PageHeader
        icon={
          <div className="w-10 h-10 rounded-xl bg-disputed/10 border border-disputed-border flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-disputed" />
          </div>
        }
        title="Suspicious Review Patterns"
        badge={
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-disputed-muted border border-disputed-border text-disputed shrink-0 whitespace-nowrap">
            DRS Anti-Collusion
          </span>
        }
        subtitle="Detects wash-trading, reciprocal 5-star rating rings, and repeat low-value collusion deals."
        actions={
          <button
            type="button"
            onClick={() => mutate()}
            aria-label="Refresh suspicious reviews list"
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-xl border border-border bg-card hover:bg-muted text-foreground transition-colors cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        }
      />

      {/* ── Status Tabs ── */}
      <div className="flex border-b border-border gap-2 overflow-x-auto no-scrollbar flex-nowrap" role="tablist" aria-label="Review pattern status filter">
        {(["PENDING", "CONFIRMED", "DISMISSED"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={statusFilter === tab}
            onClick={() => setStatusFilter(tab)}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              statusFilter === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            {tab.charAt(0) + tab.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* ── Content List ── */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-disputed-muted border border-disputed-border text-disputed text-sm">
          Failed to load suspicious review reports. Please try refreshing.
        </div>
      ) : flags.length === 0 ? (
        <EmptyState
          title={`No ${statusFilter.toLowerCase()} collusion patterns found`}
          description="The DRS anti-collusion engine is continuously monitoring counterparty review diversity."
        />
      ) : (
        <div className="space-y-4">
          {flags.map((flag) => {
            const riskBg =
              flag.riskScore >= 80
                ? "bg-disputed-muted border-disputed-border text-disputed"
                : flag.riskScore >= 50
                ? "bg-pending-muted border-pending-border text-pending"
                : "bg-muted text-muted-foreground border-border";

            return (
              <div
                key={flag.id}
                className="p-5 rounded-2xl bg-card border border-border shadow-xs hover:border-border/80 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-5"
              >
                {/* Left: Account Pair Info & Evidence */}
                <div className="space-y-3 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-black border shrink-0 whitespace-nowrap ${riskBg}`}>
                      Risk Score: {flag.riskScore}/100
                    </span>
                    <span className="text-xs font-bold text-muted-foreground">
                      Detected {formatDate(flag.createdAt)}
                    </span>
                    {flag.status !== "PENDING" && (
                      <Badge variant={flag.status === "CONFIRMED" ? "danger" : "ghost"}>
                        {flag.status}
                      </Badge>
                    )}
                  </div>

                  {/* Pair Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-muted/30 p-3 rounded-xl border border-border/50">
                    <div>
                      <span className="text-muted-foreground block font-medium">Influencer Counterparty</span>
                      <span className="font-bold text-foreground block truncate">{flag.influencerUser.email}</span>
                      <span className="text-[11px] text-muted-foreground">
                        DRS Trust: <strong className="text-foreground">{flag.influencerUser.trustScore}</strong> • Total Deals: {flag.influencerUser.influencerProfile?.completedDeals ?? "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block font-medium">Brand Counterparty</span>
                      <span className="font-bold text-foreground block truncate">{flag.brandUser.email}</span>
                      <span className="text-[11px] text-muted-foreground">
                        DRS Trust: <strong className="text-foreground">{flag.brandUser.trustScore}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Evidence Text */}
                  <div className="flex items-start gap-2 text-xs">
                    <AlertTriangle className="w-4 h-4 text-pending shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-foreground font-semibold">Evidence: </strong>
                      <span className="text-muted-foreground">{flag.flagReason}</span>
                    </div>
                  </div>

                  {/* Anti-Gaming Metric Note */}
                  <p className="text-[11px] text-muted-foreground italic">
                    ℹ️ Counterparty diversity metric active: DRS review bonus for this influencer is throttled by their unique-brand ratio ({((1 / Math.max(1, flag.totalDealsInPair)) * 100).toFixed(0)}% max).
                  </p>
                </div>

                {/* Right: Actions */}
                {flag.status === "PENDING" && (
                  <div className="flex items-center gap-2 lg:flex-col lg:items-end shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-border">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleResolve(flag.id, "CONFIRMED")}
                      disabled={resolvingId === flag.id}
                      className="text-xs"
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" />
                      Confirm Collusion
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleResolve(flag.id, "DISMISSED")}
                      disabled={resolvingId === flag.id}
                      className="text-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Dismiss
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
