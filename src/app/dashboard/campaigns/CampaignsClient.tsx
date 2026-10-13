"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import useSWR from "swr";
import { createSchemaFetcher } from "@/lib/fetcher";
import {
  type DashboardCampaign as Campaign,
  type RawCampaignApiItem as RawCampaign,
  type CampaignsListResponse as CampaignsPayload,
  campaignsListResponseSchema,
} from "@/lib/schemas";
import { normalizeStringArray, normalizeDeliverables } from "@/lib/utils-client";
import EmptyState from "@/components/ui/EmptyState";
import { Button, PageHeader } from "@/components/ui";
import { CampaignDiscoveryCard } from "@/components/dashboard/campaigns/CampaignDiscoveryCard";
import { CampaignFiltersBar } from "@/components/dashboard/campaigns/CampaignFiltersBar";
import {
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  ShieldCheck,
  Zap,
  Layers,
  LayoutGrid,
  List,
  Sparkles,
  FileText,
} from "lucide-react";

export function buildCampaignQueryParams(
  canCreateCampaign: boolean,
  selectedCategory: string,
  debouncedSearch: string,
  sortBy: string,
  page: number,
  selectedStatus: string = "ALL"
): string {
  const queryParams = new URLSearchParams();

  if (canCreateCampaign) {
    queryParams.set("scope", "mine");
    queryParams.set("status", selectedStatus || "ALL");
  } else {
    queryParams.set("status", "ACTIVE");
  }

  if (selectedCategory !== "All") {
    queryParams.set("category", selectedCategory);
  }

  if (debouncedSearch.trim()) {
    queryParams.set("search", debouncedSearch.trim());
  }

  if (sortBy === "budget_high") {
    queryParams.set("sortBy", "perInfluencerBudget");
    queryParams.set("sortOrder", "desc");
  } else if (sortBy === "budget_low") {
    queryParams.set("sortBy", "perInfluencerBudget");
    queryParams.set("sortOrder", "asc");
  } else if (sortBy === "deadline") {
    queryParams.set("sortBy", "applicationDeadline");
    queryParams.set("sortOrder", "asc");
  } else {
    queryParams.set("sortBy", "createdAt");
    queryParams.set("sortOrder", "desc");
  }

  queryParams.set("page", String(page));
  queryParams.set("limit", "12");

  return queryParams.toString();
}

export function mapRawCampaigns(rawCampaigns: RawCampaign[]): Campaign[] {
  return rawCampaigns.map((campaign: RawCampaign) => ({
    id: campaign.id || "",
    title: campaign.title || "Untitled Campaign",
    status: campaign.status || "ACTIVE",
    description: campaign.description || "",
    createdAt:
      campaign.createdAt instanceof Date
        ? campaign.createdAt.toISOString()
        : campaign.createdAt ?? new Date(0).toISOString(),
    perInfluencerBudget: Number(campaign.perInfluencerBudget || 0),
    minFollowers: Number(campaign.minFollowers || 0),
    postingDeadline: campaign.postingDeadline || new Date(0).toISOString(),
    targetCategories: normalizeStringArray(campaign.targetCategories),
    totalApplications: Number(campaign.totalApplications || campaign._count?.applications || 0),
    brandId: campaign.brandId || campaign.userId || null,
    brand: {
      id: (campaign.brand as { id?: string } | null | undefined)?.id || campaign.brandId || null,
      userId: campaign.userId || null,
      companyName: campaign.brand?.companyName || "Verified Brand",
      logo: campaign.brand?.logo || null,
      avgRating: Number(campaign.brand?.avgRating || campaign.brand?.averageRating || 0) / 100,
    },
    deliverables: normalizeDeliverables(campaign.deliverables),
    maxInfluencers: campaign.maxInfluencers ?? null,
    acceptedCount:
      typeof (campaign as Record<string, unknown>).openDealCount === "number"
        ? Number((campaign as Record<string, unknown>).openDealCount)
        : (Array.isArray(campaign.applications) ? campaign.applications.length : 0),
  }));
}

function CampaignGridSkeleton({ listView }: { listView: boolean }) {
  return (
    <div
      className={`animate-pulse ${
        listView ? "space-y-4" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      }`}
      aria-hidden="true"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-muted shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="w-24 h-3.5 bg-muted rounded" />
              <div className="w-40 h-4 bg-muted rounded" />
            </div>
            <div className="w-16 h-6 bg-muted rounded-full" />
          </div>
          <div className="h-10 bg-muted/60 rounded" />
          <div className="flex gap-2">
            <div className="w-16 h-5 bg-muted rounded" />
            <div className="w-20 h-5 bg-muted rounded" />
          </div>
          <div className="h-16 bg-muted/40 rounded-xl" />
          <div className="flex justify-between items-center pt-2">
            <div className="w-24 h-4 bg-muted rounded" />
            <div className="w-24 h-8 bg-muted rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CampaignsClient({
  user,
}: {
  readonly user: { readonly userType?: string };
}) {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [listView, setListView] = useState(false);

  const canCreateCampaign = user?.userType === "BRAND";

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const queryString = buildCampaignQueryParams(
    canCreateCampaign,
    selectedCategory,
    debouncedSearch,
    sortBy,
    page,
    selectedStatus
  );

  const campaignsFetcher = createSchemaFetcher(campaignsListResponseSchema);
  const {
    data: payload,
    isLoading: loading,
    error: fetchErr,
  } = useSWR<CampaignsPayload>(`/api/campaigns?${queryString}`, campaignsFetcher);

  const { campaigns, totalPages } = useMemo(() => {
    const rawCampaigns: RawCampaign[] = payload?.data?.campaigns ?? payload?.campaigns ?? [];
    const pages = payload?.data?.totalPages ?? payload?.totalPages ?? 1;
    const mapped = mapRawCampaigns(rawCampaigns);
    return { campaigns: mapped, totalPages: pages };
  }, [payload]);

  const error = fetchErr ? "Unable to load campaigns right now." : null;

  const handleCategoryChange = useCallback((category: string) => {
    setSelectedCategory(category);
    setPage(1);
  }, []);

  const handleSortChange = useCallback((sort: string) => {
    setSortBy(sort);
    setPage(1);
  }, []);

  const handleStatusChange = useCallback((status: string) => {
    setSelectedStatus(status);
    setPage(1);
  }, []);

  // Split into "recommended" (top 3 on page 1 with no filters) and rest
  const isDefaultView =
    !canCreateCampaign &&
    selectedCategory === "All" &&
    !debouncedSearch.trim() &&
    sortBy === "newest" &&
    page === 1;

  const recommendedCampaigns = isDefaultView ? campaigns.slice(0, 3) : [];
  const remainingCampaigns = isDefaultView ? campaigns.slice(3) : campaigns;

  return (
    <div className="space-y-6 pb-16 animate-fade-in">
      {/* ── 1. HEADER ───────────────────────────────────────────────── */}
      <PageHeader
        title={canCreateCampaign ? "Campaign Management" : "Campaign Discovery"}
        badge={
          <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-escrow-muted text-escrow border border-escrow-border shrink-0 whitespace-nowrap">
            <ShieldCheck className="w-3.5 h-3.5" /> 100% Escrow Funded
          </span>
        }
        subtitle={
          canCreateCampaign
            ? "Oversee your live brand briefs, review incoming creator pitches, and allocate escrow milestones."
            : "Explore verified brand collaborations with pre-funded escrow milestones and instant settlements."
        }
        actions={
          <>
            {/* Grid/List toggle (Instagram Explore pattern) */}
            {!canCreateCampaign && (
              <div className="flex items-center gap-0.5 bg-muted p-1 rounded-xl border border-border">
                <button
                  type="button"
                  id="campaign-grid-view-toggle"
                  onClick={() => setListView(false)}
                  aria-label="Grid view"
                  className={`p-1.5 rounded-lg transition-all ${
                    !listView
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  id="campaign-list-view-toggle"
                  onClick={() => setListView(true)}
                  aria-label="List view"
                  className={`p-1.5 rounded-lg transition-all ${
                    listView
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            )}

            {canCreateCampaign ? (
              <Button
                href="/dashboard/campaigns/create"
                variant="primary"
                className="font-bold text-xs gap-1.5 shadow-sm"
              >
                <PlusCircle className="w-4 h-4" /> Create New Brief
              </Button>
            ) : (
              <Button
                href="/dashboard/applications"
                variant="secondary"
                className="font-bold text-xs gap-1.5 shadow-sm"
              >
                <FileText className="w-4 h-4" /> My Applications
              </Button>
            )}
          </>
        }
      />

      {/* ── 2. TRUST HIGHLIGHT RIBBON ────────── */}
      {!canCreateCampaign && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-card border border-border shadow-xs text-xs">
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-muted/40">
            <div className="w-7 h-7 rounded-lg bg-verified-muted text-verified flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-foreground block">Guaranteed Escrow</span>
              <span className="text-[11px] text-muted-foreground">Budgets locked before briefs go live</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-muted/40">
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-foreground block">Instant IMPS Release</span>
              <span className="text-[11px] text-muted-foreground">Auto-disbursed within 60s of verification</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-muted/40">
            <div className="w-7 h-7 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-foreground block">0% Creator Cuts</span>
              <span className="text-[11px] text-muted-foreground">Keep 100% of your quoted deal rate</span>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. FILTER & CATEGORY CAROUSEL ───────────────────────────── */}
      <CampaignFiltersBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedCategory={selectedCategory}
        setSelectedCategory={handleCategoryChange}
        sortBy={sortBy}
        setSortBy={handleSortChange}
        isBrand={canCreateCampaign}
        selectedStatus={selectedStatus}
        setSelectedStatus={handleStatusChange}
      />

      {/* ── 4. CAMPAIGN CARDS ────────────────────────────────────────── */}
      {loading && <CampaignGridSkeleton listView={listView} />}

      {!loading && error && (
        <EmptyState
          title="Error Loading Campaigns"
          description={error}
          actionLabel="Try Again"
          onActionClick={() => window.location.reload()}
        />
      )}

      {!loading && !error && campaigns.length === 0 && (
        <EmptyState
          title={canCreateCampaign ? "No Campaigns Active Yet" : "No Campaigns Match Filters"}
          description={
            canCreateCampaign
              ? "You haven't launched any campaign briefs yet. Create your first brief to invite verified creators."
              : "No active opportunities match your category and keyword filters. Try clearing filters or exploring other niches."
          }
          actionLabel={canCreateCampaign ? "Create New Campaign" : "Reset All Filters"}
          actionHref={canCreateCampaign ? "/dashboard/campaigns/create" : undefined}
          onActionClick={
            !canCreateCampaign
              ? () => {
                  setSelectedCategory("All");
                  setSearchQuery("");
                }
              : undefined
          }
        />
      )}

      {!loading && !error && campaigns.length > 0 && (
        <>
          {/* Recommended for You section — page 1 default view */}
          {recommendedCampaigns.length > 0 && (
            <section aria-label="Recommended campaigns">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-pending" />
                <h2 className="text-sm font-bold text-foreground">Recommended for You</h2>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-pending-muted text-pending border border-pending-border">
                  Top Match
                </span>
              </div>
              <div
                className={
                  listView
                    ? "space-y-4"
                    : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                }
              >
                {recommendedCampaigns.map((campaign) => (
                  <CampaignDiscoveryCard
                    key={campaign.id}
                    campaign={campaign}
                    isBrand={canCreateCampaign}
                    listView={listView}
                    isRecommended
                  />
                ))}
              </div>
            </section>
          )}

          {/* Remaining campaigns */}
          {remainingCampaigns.length > 0 && (
            <section
              aria-label={isDefaultView ? "More campaigns" : "Campaign opportunities"}
            >
              {isDefaultView && (
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-bold text-foreground">All Active Briefs</h2>
                </div>
              )}
              <div
                className={
                  listView
                    ? "space-y-4"
                    : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                }
              >
                {remainingCampaigns.map((campaign) => (
                  <CampaignDiscoveryCard
                    key={campaign.id}
                    campaign={campaign}
                    isBrand={canCreateCampaign}
                    listView={listView}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <nav aria-label="Campaigns pagination" className="flex justify-center items-center gap-3 pt-8">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="text-xs font-semibold gap-1.5 cursor-pointer shadow-xs"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Previous
              </Button>
              <span className="text-xs font-medium text-muted-foreground px-3">
                Page <strong className="text-foreground font-mono">{page}</strong> of{" "}
                <span className="font-mono">{totalPages}</span>
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="text-xs font-semibold gap-1.5 cursor-pointer shadow-xs"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
