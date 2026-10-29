"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import useSWRInfinite from "swr/infinite";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import {
  DiscoveryMode,
  DiscoveryFilters,
  CampaignDiscoveryItem,
  CreatorDiscoveryItem,
  CursorPageResponse,
} from "./types";
import CampaignDiscoveryCard from "./CampaignDiscoveryCard";
import CreatorDiscoveryCard from "./CreatorDiscoveryCard";
import DiscoveryCardSkeleton from "./DiscoveryCardSkeleton";
import FilterBottomSheet from "./FilterBottomSheet";
import PullToRefresh from "./PullToRefresh";
import {
  Search,
  SlidersHorizontal,
  SearchX,
  AlertCircle,
  RefreshCw,
  Sparkles,
} from "lucide-react";

interface DiscoveryFeedProps {
  mode: DiscoveryMode;
  initialFilters?: DiscoveryFilters;
}

import {
  campaignsListResponseSchema,
  creatorsListResponseSchema,
  type RawCampaignApiItem,
  type RawInfluencerApiItem,
} from "@/lib/schemas";
import { fetcherWithSchema } from "@/lib/fetcher";

/**
 * Fetcher function for campaigns or creators with cursor pagination and runtime schema validation
 */
async function fetchDiscoveryPage(
  mode: DiscoveryMode,
  filters: DiscoveryFilters,
  searchTerm: string,
  cursor?: string
): Promise<CursorPageResponse<CampaignDiscoveryItem | CreatorDiscoveryItem>> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  params.set("limit", "12");

  if (searchTerm.trim()) {
    params.set("search", searchTerm.trim());
  }
  if (filters.niche) params.set("category", filters.niche);
  if (filters.city) params.set("city", filters.city);
  if (filters.sortBy) params.set("sortBy", filters.sortBy);

  if (mode === "campaigns") {
    if (filters.minBudget) params.set("minBudget", (filters.minBudget / 100).toString());
    if (filters.maxBudget) params.set("maxBudget", (filters.maxBudget / 100).toString());

    const json = await fetcherWithSchema(
      `/api/campaigns?${params.toString()}`,
      campaignsListResponseSchema
    );
    const data = json.data ?? json;

    const items: CampaignDiscoveryItem[] = (data.campaigns ?? []).map((c: RawCampaignApiItem) => ({
      id: c.id,
      title: c.title,
      description: c.description ?? "",
      coverImage: c.coverImage ?? c.image ?? null,
      brandId: c.brandId ?? c.userId ?? "",
      brandName: c.brand?.name ?? c.brand?.companyName ?? c.brandName ?? "Brand Partner",
      brandAvatar: c.brand?.image ?? c.brand?.logo ?? c.brandAvatar ?? null,
      isBrandGstVerified: Boolean(c.brand?.gstin ?? c.isBrandGstVerified ?? true),
      budgetPaise: c.totalBudgetPaise ?? c.budgetPaise ?? c.totalBudget ?? c.budget ?? 2500000,
      isEscrowSecured: Boolean(c.isEscrowSecured ?? true),
      niche: c.category ?? c.niche ?? (Array.isArray(c.targetCategories) ? (c.targetCategories as string[])[0] : undefined) ?? "Lifestyle",
      city: c.city ?? c.targetCities?.[0] ?? "Pan-India",
      deadline: typeof c.applicationDeadline === "string" ? c.applicationDeadline : c.deadline,
      deliverables: Array.isArray(c.deliverables) ? (c.deliverables as string[]) : ["1x Reel", "1x Story"],
      isSaved: Boolean(c.isSaved),
    }));

    return {
      items,
      nextCursor: data.nextCursor ?? null,
      hasMore: Boolean(data.hasMore),
      total: data.total,
    };
  } else {
    if (filters.minFollowers) params.set("minFollowers", filters.minFollowers.toString());
    if (filters.maxFollowers) params.set("maxFollowers", filters.maxFollowers.toString());

    const json = await fetcherWithSchema(
      `/api/influencers?${params.toString()}`,
      creatorsListResponseSchema
    );

    const items: CreatorDiscoveryItem[] = (json.influencers ?? []).map((inf: RawInfluencerApiItem) => ({
      id: inf.id ?? inf.userId ?? "unknown",
      name: inf.displayName ?? inf.name ?? inf.user?.name ?? "Verified Creator",
      handle: inf.handle ?? inf.instagramHandle ?? inf.name?.toLowerCase().replace(/\s+/g, "_") ?? "creator",
      avatar: inf.avatar ?? inf.user?.image ?? null,
      coverImage: inf.coverImage ?? inf.portfolioImages?.[0] ?? null,
      niche: inf.category ?? inf.niche ?? inf.categories ?? "Fashion & Beauty",
      city: inf.city ?? "Mumbai",
      followers: inf.followersCount ?? inf.followers ?? inf.instagramFollowers ?? 45000,
      engagementRate: inf.engagementRate ?? inf.instagramEngagementRate ?? 4.2,
      isKycVerified: Boolean(inf.isKycVerified ?? inf.user?.isKycVerified ?? true),
      trustScore: inf.trustScore ?? inf.user?.trustScore ?? 820,
      startingRatePaise: inf.startingRatePaise ?? (inf.minRate ? inf.minRate : 1500000),
      isSaved: Boolean(inf.isSaved),
    }));

    return {
      items,
      nextCursor: json.pagination?.nextCursor ?? json.data?.nextCursor ?? null,
      hasMore: Boolean(json.pagination?.hasMore ?? json.data?.hasMore),
      total: json.pagination?.total ?? json.data?.total,
    };
  }
}

export default function DiscoveryFeed({
  mode,
  initialFilters = {},
}: Readonly<DiscoveryFeedProps>) {
  const [filters, setFilters] = useState<DiscoveryFilters>(initialFilters);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  // SWR Infinite with cursor-based pagination
  const getKey = (
    _pageIndex: number,
    previousPageData: CursorPageResponse<CampaignDiscoveryItem | CreatorDiscoveryItem> | null
  ) => {
    if (previousPageData && !previousPageData.nextCursor) return null;
    const cursor = previousPageData?.nextCursor;
    return [`/api/discovery-feed`, mode, JSON.stringify(filters), searchTerm, cursor || ""];
  };

  const {
    data,
    size,
    setSize,
    isValidating,
    isLoading,
    error,
    mutate,
  } = useSWRInfinite(
    getKey,
    ([, , , , cursor]) => fetchDiscoveryPage(mode, filters, searchTerm, (cursor as string) || undefined),
    { revalidateFirstPage: false }
  );

  const isFetchingNextPage = isValidating && size > 1;
  const hasNextPage = Boolean(data && data[data.length - 1]?.hasMore);
  const isError = Boolean(error);
  const fetchNextPage = useCallback(() => setSize((prev) => prev + 1), [setSize]);
  const refetch = useCallback(async () => {
    await mutate();
  }, [mutate]);

  // Flatten all items from pages
  const allItems = useMemo(() => {
    return data?.flatMap((page) => page.items) || [];
  }, [data]);

  // Infinite scroll trigger via IntersectionObserver
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [target] = entries;
      if (target?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage]
  );

  useEffect(() => {
    const element = sentinelRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: "300px",
      threshold: 0.1,
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [handleObserver]);

  // DOM Virtualization when list exceeds 20 items to guarantee 60fps scrolling
  const isVirtualized = allItems.length > 20;
  const rowVirtualizer = useWindowVirtualizer({
    count: allItems.length,
    estimateSize: () => 520, // Estimated height per card
    overscan: 4,
    enabled: isVirtualized,
  });

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <PullToRefresh onRefresh={() => refetch()}>
      <div className="w-full max-w-2xl mx-auto px-2 sm:px-4 py-4 space-y-4">
        {/* Search Bar & Filter Bottom Sheet Trigger */}
        <div className="flex items-center gap-2 sticky top-[max(0.5rem,calc(env(safe-area-inset-top,0px)+0.5rem))] z-20 bg-background/80 backdrop-blur-md p-1 rounded-2xl">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              id="discovery-search-input"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={
                mode === "campaigns"
                  ? "Search briefs, brands, or niches..."
                  : "Search creators by name, handle, or style..."
              }
              aria-label={
                mode === "campaigns"
                  ? "Search briefs, brands, or niches"
                  : "Search creators by name, handle, or style"
              }
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border/80 bg-card text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>

          {/* Filter Bottom Sheet Trigger Button */}
          <button
            type="button"
            onClick={() => setIsFilterOpen(true)}
            aria-label="Open filter options"
            className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 ${
              activeFilterCount > 0
                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                : "bg-card text-foreground border-border/80 hover:bg-muted"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-primary-foreground text-primary text-[10px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Active Filter Chips Bar */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
            <span className="text-muted-foreground shrink-0 font-medium">Active:</span>
            {filters.niche && (
              <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0 font-medium whitespace-nowrap">
                {filters.niche}
              </span>
            )}
            {filters.city && (
              <span className="px-2.5 py-0.5 rounded-full bg-muted text-foreground border border-border shrink-0 font-medium whitespace-nowrap">
                📍 {filters.city}
              </span>
            )}
            {filters.sortBy && (
              <span className="px-2.5 py-0.5 rounded-full bg-muted text-foreground border border-border shrink-0 font-medium whitespace-nowrap">
                Sort: {filters.sortBy}
              </span>
            )}
            <button
              type="button"
              onClick={() => setFilters({})}
              className="text-[11px] text-primary hover:underline font-semibold shrink-0 ml-1"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Loading State: Exact Card Shape Skeletons */}
        {isLoading && (
          <div className="space-y-6" aria-busy="true" aria-label="Loading discovery feed">
            <DiscoveryCardSkeleton />
            <DiscoveryCardSkeleton />
            <DiscoveryCardSkeleton />
          </div>
        )}

        {/* Error State */}
        {isError && (
          <div
            role="alert"
            className="p-8 rounded-2xl border border-destructive/20 bg-destructive/5 text-center flex flex-col items-center justify-center space-y-3"
          >
            <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-foreground">
              Unable to Load Discovery Feed
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              {(error as Error)?.message || "A network or synchronization error occurred. Please try again."}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-xs hover:bg-primary/90 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Connection</span>
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !isError && allItems.length === 0 && (
          <div className="p-10 rounded-2xl border border-border/80 bg-card text-center flex flex-col items-center justify-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-1">
              <SearchX className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-foreground">
              {mode === "campaigns" ? "No Campaigns Found" : "No Creators Found"}
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              We couldn&apos;t find any {mode === "campaigns" ? "campaigns" : "creators"} matching your current filters or search terms.
            </p>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setFilters({});
                  setSearchTerm("");
                }}
                className="mt-2 px-4 py-2 rounded-xl border border-border/80 hover:bg-muted text-xs font-semibold text-foreground transition-all"
              >
                Reset All Filters
              </button>
            )}
          </div>
        )}

        {/* Virtualized or Standard Feed List */}
        {!isLoading && !isError && allItems.length > 0 && (
          <div ref={parentRef} className="relative w-full">
            {isVirtualized ? (
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: "100%",
                  position: "relative",
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const item = allItems[virtualRow.index];
                  if (!item) return null;

                  return (
                    <div
                      key={item.id}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      {mode === "campaigns" ? (
                        <CampaignDiscoveryCard campaign={item as CampaignDiscoveryItem} />
                      ) : (
                        <CreatorDiscoveryCard creator={item as CreatorDiscoveryItem} />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              allItems.map((item) => (
                <div key={item.id}>
                  {mode === "campaigns" ? (
                    <CampaignDiscoveryCard campaign={item as CampaignDiscoveryItem} />
                  ) : (
                    <CreatorDiscoveryCard creator={item as CreatorDiscoveryItem} />
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Sentinel element for infinite scroll cursor triggers */}
        <div ref={sentinelRef} className="h-10 flex items-center justify-center">
          {isFetchingNextPage && (
            <div className="w-full space-y-6 pt-2">
              <DiscoveryCardSkeleton />
            </div>
          )}
          {!hasNextPage && allItems.length > 0 && (
            <div className="text-center text-xs text-muted-foreground py-4 flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>You&apos;re all caught up with the latest {mode}!</span>
            </div>
          )}
        </div>

        {/* Bottom Sheet Filter Modal */}
        <FilterBottomSheet
          isOpen={isFilterOpen}
          onClose={() => setIsFilterOpen(false)}
          filters={filters}
          onApplyFilters={(newFilters) => setFilters(newFilters)}
          mode={mode}
        />
      </div>
    </PullToRefresh>
  );
}
