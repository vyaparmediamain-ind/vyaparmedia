"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { createSchemaFetcher } from "@/lib/fetcher";
import {
  type Deal,
  type RawDealItem as RawDeal,
  type DealsListResponse as DealsApiResponse,
  dealsListResponseSchema,
} from "@/lib/schemas";
import { useSession } from "next-auth/react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { formatDate, normalizeDeliverables } from "@/lib/utils-client";
import EmptyState from "@/components/ui/EmptyState";
import { Button, PullToRefresh, PageContainer, PageHeader } from "@/components/ui";
import { DealsMetricsBar } from "@/components/dashboard/deals/DealsMetricsBar";
import { DealsFilterToolbar } from "@/components/dashboard/deals/DealsFilterToolbar";
import { DealPipelineCard } from "@/components/dashboard/deals/DealPipelineCard";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

function normalizeDeal(raw: RawDeal): Deal {
  const campaign = raw?.campaign || {};
  const brand = raw?.brand || {};

  return {
    id: String(raw?.id || ""),
    status: String(raw?.status || "PENDING_SIGNATURE"),
    amount: Number(raw?.amount || 0),
    createdAt: raw?.createdAt ? formatDate(raw.createdAt) : "Not started",
    postingDeadline: raw?.postingDeadline || campaign?.postingDeadline || new Date().toISOString(),
    campaign: {
      title: String(campaign?.title || "Untitled Campaign"),
    },
    brand: {
      id: brand?.id ? String(brand.id) : undefined,
      companyName: String(brand?.companyName || "Brand Partner"),
      logo: brand?.logo || null,
    },
    deliverables: normalizeDeliverables(raw?.deliverables || campaign?.deliverables),
  };
}

function DealsLoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-hidden="true">
      {/* Metrics skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-card border border-border p-5 flex flex-col justify-between">
            <div className="w-24 h-4 bg-muted rounded-md" />
            <div className="w-32 h-8 bg-muted rounded-lg" />
            <div className="w-40 h-3 bg-muted rounded-md" />
          </div>
        ))}
      </div>

      {/* Filter skeleton */}
      <div className="h-10 bg-muted/50 rounded-xl mb-6" />

      {/* Cards skeleton */}
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-2xl border border-border bg-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-full bg-muted shrink-0" />
            <div className="space-y-2">
              <div className="w-48 h-4 bg-muted rounded-md" />
              <div className="w-32 h-3 bg-muted rounded-md" />
            </div>
          </div>
          <div className="w-32 h-9 bg-muted rounded-xl" />
        </div>
      ))}
    </div>
  );
}

export default function DealsPage() {
  const { data: session } = useSession();
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [selectedDeal, setSelectedDeal] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const DEALS_PER_PAGE = 50;

  const isInfluencer = session?.user?.userType === "INFLUENCER";

  const searchParams = useSearchParams();
  const campaignId = searchParams.get("campaignId");
  const campaignParam = campaignId ? `&campaignId=${encodeURIComponent(campaignId)}` : "";

  const statusParam = statusFilter === "all" ? "" : `&status=${statusFilter}`;
  const dealsListFetcher = createSchemaFetcher(dealsListResponseSchema);
  const { data: payload, isLoading: loading, mutate } = useSWR<DealsApiResponse>(
    `/api/deals?page=${currentPage}&limit=${DEALS_PER_PAGE}${statusParam}${campaignParam}`,
    dealsListFetcher
  );

  const { deals, totalPages, stats } = useMemo(() => {
    const data = payload?.data || payload;
    const rawDeals: unknown[] = Array.isArray(data?.deals) ? data.deals : [];
    const mappedDeals = rawDeals
      .map((raw) => normalizeDeal(raw as RawDeal))
      .filter((deal) => deal.id);
    const pages = data?.pagination?.totalPages || 1;
    const dealStats = data?.stats || { active: 0, completed: 0, totalEarnings: 0 };
    return { deals: mappedDeals, totalPages: pages, stats: dealStats };
  }, [payload]);

  // Compute status counts for toolbar pills
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: deals.length };
    for (const d of deals) {
      counts[d.status] = (counts[d.status] || 0) + 1;
    }
    return counts;
  }, [deals]);

  // Client-side search and multi-criteria sorting
  const sortedAndFilteredDeals = useMemo(() => {
    let result = deals;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (d) =>
          d.campaign.title.toLowerCase().includes(query) ||
          d.brand.companyName.toLowerCase().includes(query) ||
          d.status.toLowerCase().includes(query)
      );
    }

    const list = [...result];
    switch (sortBy) {
      case "deadline":
        return list.sort((a, b) => new Date(a.postingDeadline).getTime() - new Date(b.postingDeadline).getTime());
      case "amount_desc":
        return list.sort((a, b) => b.amount - a.amount);
      case "amount_asc":
        return list.sort((a, b) => a.amount - b.amount);
      case "newest":
      default:
        return list;
    }
  }, [deals, searchQuery, sortBy]);

  if (!session) {
    return (
      <div className="p-8 text-center text-muted-foreground text-sm">
        Loading session...
      </div>
    );
  }

  const isAll = statusFilter === "all";
  const emptyTitle = isAll ? "No Collaborations Yet" : `No ${statusFilter.replaceAll("_", " ").toLowerCase()} deals`;
  const emptyDescription = isAll
    ? isInfluencer
      ? "Apply to open brand campaigns to start collaborating and unlock guaranteed escrow payouts!"
      : "Create a campaign and invite top-ranked creators to launch escrow-backed collaborations."
    : "No collaborations match your current filter criteria. Try selecting another status or clear search.";

  const emptyActionLabel = isAll
    ? isInfluencer
      ? "Browse Open Campaigns"
      : "Create New Campaign"
    : "View All Deals";

  const emptyActionHref = isAll
    ? isInfluencer
      ? "/dashboard/campaigns"
      : "/dashboard/campaigns/create"
    : undefined;

  const onEmptyActionClick = !isAll
    ? () => {
        setStatusFilter("all");
        setSearchQuery("");
      }
    : undefined;

  return (
    <DashboardShell user={session.user}>
      <PullToRefresh onRefresh={async () => { await mutate(); }}>
        <PageContainer maxWidth="7xl" className="space-y-6 pb-12 animate-fade-in py-4 sm:py-6">
          <PageHeader
            title="My Collaborations"
            subtitle={
              isInfluencer
                ? "Track your contract milestones, upload deliverables, and receive verified escrow payouts."
                : "Manage campaign deliverables, approve creator submissions, and release escrow funds safely."
            }
            actions={
              <Button
                href={isInfluencer ? "/dashboard/campaigns" : "/dashboard/campaigns/create"}
                variant="primary"
                size="sm"
                className="text-xs font-bold gap-1 shadow-xs"
              >
                {isInfluencer ? (
                  "Explore Campaigns"
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" /> New Campaign
                  </>
                )}
              </Button>
            }
          />

        {loading ? (
          <DealsLoadingSkeleton />
        ) : (
          <>
            {/* Top Telemetry Stat Cards */}
            <DealsMetricsBar
              activeCount={stats.active || 0}
              completedCount={stats.completed || 0}
              totalEarningsPaise={stats.totalEarnings || 0}
              isInfluencer={isInfluencer}
            />

            {campaignId && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary font-medium w-fit">
                <span>Filtering by campaign: <strong className="font-semibold">{campaignId}</strong></span>
                <Link href="/dashboard/deals" className="underline font-bold hover:opacity-80 ml-1">
                  Clear filter ✕
                </Link>
              </div>
            )}

            {/* Filter and Search Bar with Sort Controls */}
            <DealsFilterToolbar
              statusFilter={statusFilter}
              setStatusFilter={(status) => {
                setStatusFilter(status);
                setCurrentPage(1);
              }}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              sortBy={sortBy}
              setSortBy={setSortBy}
              tabCounts={tabCounts}
            />

            {/* Pipeline Deals List */}
            {sortedAndFilteredDeals.length > 0 ? (
              <section aria-label="Deals pipeline list" className="space-y-4">
                {sortedAndFilteredDeals.map((deal) => (
                  <DealPipelineCard
                    key={deal.id}
                    deal={deal}
                    isSelected={selectedDeal === deal.id}
                    onToggleSelect={() => setSelectedDeal(selectedDeal === deal.id ? null : deal.id)}
                    isInfluencer={isInfluencer}
                  />
                ))}
              </section>
            ) : (
              <EmptyState
                title={emptyTitle}
                description={emptyDescription}
                actionLabel={emptyActionLabel}
                actionHref={emptyActionHref}
                onActionClick={onEmptyActionClick}
              />
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <nav aria-label="Pagination" className="flex justify-center items-center gap-3 pt-6">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="text-xs font-semibold gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Previous
                </Button>
                <span className="text-xs font-medium text-muted-foreground px-2">
                  Page <strong className="text-foreground">{currentPage}</strong> of {totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="text-xs font-semibold gap-1"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </nav>
            )}
          </>
        )}
        </PageContainer>
    </PullToRefresh>
  </DashboardShell>
  );
}
