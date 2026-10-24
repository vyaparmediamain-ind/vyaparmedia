"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { createSchemaFetcher } from "@/lib/fetcher";
import {
  creatorsListResponseSchema,
  type CreatorsListResponse,
  type RawInfluencerApiItem,
} from "@/lib/schemas";
import DashboardShell from "@/components/dashboard/DashboardShell";
import EmptyState from "@/components/ui/EmptyState";
import { Button, Input, PageContainer, PageHeader } from "@/components/ui";
import CreatorDiscoveryCard from "@/components/discovery/CreatorDiscoveryCard";
import DiscoveryCardSkeleton from "@/components/discovery/DiscoveryCardSkeleton";
import FilterBottomSheet from "@/components/discovery/FilterBottomSheet";
import {
  type CreatorDiscoveryItem,
  type DiscoveryFilters,
} from "@/components/discovery/types";
import { apiClient } from "@/lib/api-client";
import {
  Search,
  SlidersHorizontal,
  X,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Zap,
  TrendingUp,
  Bookmark,
  Users,
  Flame,
  ArrowUpDown,
  Clock,
  Award,
} from "lucide-react";

const CATEGORY_CHIPS = [
  "All",
  "Tech & Gadgets",
  "Fashion & Style",
  "Beauty & Skincare",
  "Fitness & Health",
  "Food & Beverage",
  "Travel & Hospitality",
  "Gaming & Esports",
  "Fintech & Crypto",
] as const;

type SortOption = "recency" | "relevance" | "followers" | "rating" | "rate";

const SORT_OPTIONS: { id: SortOption; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "recency", label: "Recently Active", icon: Clock },
  { id: "relevance", label: "Top Match", icon: Sparkles },
  { id: "followers", label: "Audience Reach", icon: Users },
  { id: "rating", label: "Trust Score", icon: Award },
  { id: "rate", label: "Starting Rate", icon: Flame },
];

export function normalizeCreatorItem(inf: RawInfluencerApiItem): CreatorDiscoveryItem {
  const followers =
    inf.followersCount ?? inf.followers ?? inf.instagramFollowers ?? inf.youtubeSubscribers ?? 0;
  const engagement =
    typeof inf.engagementRate === "number"
      ? inf.engagementRate
      : typeof inf.instagramEngagementRate === "number"
      ? Number((inf.instagramEngagementRate / 100).toFixed(2))
      : 3.5;
  const startingRate =
    inf.startingRatePaise ?? (inf.minRate ? inf.minRate * 100 : 1500000);
  const niche =
    inf.niche ||
    inf.category ||
    (inf.categories ? inf.categories.split(",")[0]?.trim() : "Lifestyle") ||
    "Lifestyle";
  const name = inf.displayName || inf.name || inf.user?.name || "Creator";
  const handle =
    inf.handle || inf.instagramHandle || name.toLowerCase().replaceAll(/[^a-z0-9]/g, "_");

  return {
    id: inf.id || inf.userId || "",
    name,
    handle,
    avatar: inf.avatar || inf.user?.image || null,
    coverImage:
      inf.coverImage || inf.topPostImages?.[0] || inf.portfolioImages?.[0] || null,
    niche,
    city: inf.city || inf.state || "India",
    followers,
    engagementRate: Number(engagement.toFixed(1)),
    isKycVerified: Boolean(inf.isKycVerified ?? inf.user?.isKycVerified ?? true),
    trustScore: inf.trustScore ?? inf.user?.trustScore ?? 750,
    startingRatePaise: startingRate,
    isSaved: Boolean(inf.isSaved),
  };
}

export default function DiscoverInfluencersPage() {
  const { data: session } = useSession();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [filters, setFilters] = useState<DiscoveryFilters>({ sortBy: "recency" });
  const [viewTab, setViewTab] = useState<"all" | "saved">("all");
  const [savedOverrides, setSavedOverrides] = useState<Record<string, boolean>>({});
  const [visibleCount, setVisibleCount] = useState(12);

  // Reset pagination window when filters or tabs change
  useEffect(() => {
    setVisibleCount(12);
  }, [search, selectedCategory, filters, viewTab]);

  const isBrandOrAdmin =
    session?.user?.userType === "BRAND" || session?.user?.userType === "ADMIN";

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (selectedCategory && selectedCategory !== "All") {
      params.set("category", selectedCategory);
    }
    if (filters.city) params.set("city", filters.city);
    if (typeof filters.minFollowers === "number") {
      params.set("minFollowers", filters.minFollowers.toString());
    }
    if (typeof filters.minBudget === "number") {
      params.set("minRate", Math.round(filters.minBudget / 100).toString());
    }
    if (typeof filters.maxBudget === "number") {
      params.set("maxRate", Math.round(filters.maxBudget / 100).toString());
    }
    if (filters.sortBy) params.set("sortBy", filters.sortBy);
    return params;
  }, [search, selectedCategory, filters]);

  const creatorsFetcher = createSchemaFetcher(creatorsListResponseSchema);
  const { data: payload, isLoading: loading } = useSWR<CreatorsListResponse>(
    isBrandOrAdmin ? `/api/influencers?${queryParams.toString()}` : null,
    creatorsFetcher,
    { revalidateOnFocus: false },
  );

  const creators = useMemo(() => {
    const rawInfluencers: RawInfluencerApiItem[] =
      payload?.influencers || payload?.data?.influencers || [];
    return rawInfluencers.map((raw) => {
      const normalized = normalizeCreatorItem(raw);
      if (typeof savedOverrides[normalized.id] === "boolean") {
        return { ...normalized, isSaved: savedOverrides[normalized.id] };
      }
      return normalized;
    });
  }, [payload, savedOverrides]);

  const savedCount = useMemo(() => {
    return creators.filter((c) => Boolean(c.isSaved)).length;
  }, [creators]);

  const displayedCreators = useMemo(() => {
    if (viewTab === "saved") {
      return creators.filter((c) => Boolean(c.isSaved));
    }
    return creators;
  }, [creators, viewTab]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCategory !== "All") count++;
    if (filters.city) count++;
    if (filters.minFollowers) count++;
    if (filters.minBudget || filters.maxBudget) count++;
    if (filters.sortBy && filters.sortBy !== "recency") count++;
    return count;
  }, [selectedCategory, filters]);

  const handleClearAllFilters = useCallback(() => {
    setSearch("");
    setSelectedCategory("All");
    setFilters({ sortBy: "recency" });
    setViewTab("all");
  }, []);

  const handleToggleBookmark = useCallback(async (id: string, nextState: boolean) => {
    setSavedOverrides((prev) => ({ ...prev, [id]: nextState }));
    try {
      await apiClient.users.toggleBookmark({
        targetId: id,
        targetType: "creator",
        isSaved: nextState,
      });
    } catch {
      // Revert optimistic update
      setSavedOverrides((prev) => ({ ...prev, [id]: !nextState }));
      throw new Error("Failed to toggle bookmark");
    }
  }, []);

  if (!session) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </DashboardShell>
    );
  }

  if (!isBrandOrAdmin) {
    return (
      <DashboardShell user={session.user}>
        <PageContainer maxWidth="4xl" className="pt-4 pb-0 sm:py-6">
          <div className="max-w-lg mx-auto p-8 rounded-2xl bg-card border border-border text-center mt-12 shadow-sm space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-heading font-bold text-foreground">
              Brand Access Required
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Influencer discovery, engagement metrics, and rate cards are reserved for verified brand partners. Browse available campaigns instead.
            </p>
            <Button href="/dashboard/campaigns" variant="primary">
              Explore Campaigns
            </Button>
          </div>
        </PageContainer>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell user={session.user}>
      <PageContainer maxWidth="7xl" className="space-y-6 animate-fade-in pt-4 pb-0 sm:py-6">
        {/* ── 1. HEADER (INSTAGRAM + COLLABR BENCHMARK) ───────────────────── */}
        <PageHeader
          title="Creator Discovery"
          badge={
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-verified-muted text-verified border border-verified-border shrink-0 whitespace-nowrap">
              <ShieldCheck className="w-3.5 h-3.5" /> KYC &amp; DRS Verified
            </span>
          }
          subtitle="Discover verified Indian creators with audited engagement, pre-negotiated rate cards, and escrow protection."
          actions={
            <>
              {/* View Tab Segment: All Creators vs Saved Shortlist */}
              <div className="inline-flex items-center p-1 rounded-xl bg-muted border border-border text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setViewTab("all")}
                  className={`px-3.5 py-2 min-h-[44px] inline-flex items-center justify-center rounded-lg transition-all cursor-pointer ${
                    viewTab === "all"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All Creators
                </button>
                <button
                  type="button"
                  onClick={() => setViewTab("saved")}
                  className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-lg transition-all cursor-pointer ${
                    viewTab === "saved"
                      ? "bg-card text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Bookmark className={`w-3.5 h-3.5 ${viewTab === "saved" ? "fill-current text-primary" : ""}`} />
                  <span>Shortlist</span>
                  {savedCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-primary/10 text-primary shrink-0 whitespace-nowrap">
                      {savedCount}
                    </span>
                  )}
                </button>
              </div>

              <Button
                variant="secondary"
                onClick={() => setIsFilterSheetOpen(true)}
                className="gap-2 text-xs font-semibold cursor-pointer shadow-xs min-h-[44px] px-3.5 py-2"
              >
                <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </>
          }
        />

        {/* ── 2. TRUST HIGHLIGHT RIBBON (COLLABR ANTI-FRAUD GUARANTEE) ─────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-card border border-border shadow-xs text-xs">
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-muted/40">
            <div className="w-7 h-7 rounded-lg bg-verified-muted text-verified flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-foreground block">DRS™ Anti-Fraud Audited</span>
              <span className="text-[11px] text-muted-foreground">Bot followers &amp; fake engagement filtered out</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-muted/40">
            <div className="w-7 h-7 rounded-lg bg-escrow-muted text-escrow flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-foreground block">100% Escrow Protection</span>
              <span className="text-[11px] text-muted-foreground">Funds released only after deliverable signoff</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-muted/40">
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-foreground block">Transparent Rate Cards</span>
              <span className="text-[11px] text-muted-foreground">Pre-negotiated INR pricing with 0 hidden fees</span>
            </div>
          </div>
        </div>

        {/* ── 3. SEARCH BAR, RECENT SORT PILLS & INSTAGRAM CATEGORY CAROUSEL ─── */}
        <div className="space-y-3.5">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Live Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
              <Input
                type="text"
                placeholder="Search creators by name, Instagram handle, niche, or city..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-10 text-sm min-h-[44px] h-11 rounded-2xl"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                  aria-label="Clear search input"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Quick Sort Selector (Recency Default) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none text-xs">
              <span className="text-muted-foreground font-semibold flex items-center gap-1 shrink-0 px-1">
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span>Sort:</span>
              </span>
              {SORT_OPTIONS.map((opt) => {
                const isSelected = (filters.sortBy || "recency") === opt.id;
                const IconComponent = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setFilters((prev) => ({ ...prev, sortBy: opt.id }))}
                    className={`shrink-0 inline-flex items-center gap-1 px-3 py-2 min-h-[44px] rounded-xl font-semibold border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-foreground text-background border-foreground shadow-xs font-bold"
                        : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <IconComponent className="w-3.5 h-3.5" />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Horizontally Scrollable Category Chips Carousel */}
          <nav
            aria-label="Creator category filters"
            className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none -mx-1 px-1 text-xs"
          >
            {CATEGORY_CHIPS.map((chip) => {
              const isSelected = selectedCategory === chip;
              return (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setSelectedCategory(chip)}
                  className={`shrink-0 px-3.5 py-2 min-h-[44px] inline-flex items-center rounded-full font-bold whitespace-nowrap transition-all cursor-pointer border ${
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {chip}
                </button>
              );
            })}
          </nav>
        </div>

        {/* ── 4. ACTIVE FILTERS PILL BAR ──────────────────────────────────── */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-2 flex-wrap text-xs pt-1">
            <span className="text-muted-foreground font-medium">Active filters:</span>
            {selectedCategory !== "All" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold border border-primary/20">
                {selectedCategory}
                <button type="button" onClick={() => setSelectedCategory("All")} className="hover:opacity-75 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filters.city && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-muted text-foreground font-semibold border border-border">
                City: {filters.city}
                <button type="button" onClick={() => setFilters((p) => ({ ...p, city: undefined }))} className="hover:opacity-75 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filters.minFollowers && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-muted text-foreground font-semibold border border-border">
                {filters.minFollowers >= 1000 ? `${filters.minFollowers / 1000}K+ Reach` : `${filters.minFollowers}+ Reach`}
                <button type="button" onClick={() => setFilters((p) => ({ ...p, minFollowers: undefined }))} className="hover:opacity-75 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filters.sortBy && filters.sortBy !== "recency" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-muted text-foreground font-semibold border border-border">
                Sorted: {SORT_OPTIONS.find((s) => s.id === filters.sortBy)?.label || filters.sortBy}
                <button type="button" onClick={() => setFilters((p) => ({ ...p, sortBy: "recency" }))} className="hover:opacity-75 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="text-muted-foreground hover:text-foreground underline flex items-center gap-1 ml-1 cursor-pointer font-medium"
            >
              <RotateCcw className="w-3 h-3" />
              Reset All
            </button>
          </div>
        )}

        {/* ── 5. CREATOR SHOWCASE GRID ──────── */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <DiscoveryCardSkeleton />
            <DiscoveryCardSkeleton />
            <DiscoveryCardSkeleton />
          </div>
        ) : displayedCreators.length === 0 ? (
          <div className="py-12">
            {viewTab === "saved" ? (
              <EmptyState
                title="No Shortlisted Creators Yet"
                description="Click the bookmark icon on any creator card to save them to your shortlist for fast campaign outreach."
                actionLabel="Explore All Creators"
                onActionClick={() => setViewTab("all")}
              />
            ) : (
              <EmptyState
                title="Zero Creators Match Filters"
                description="No creator dossiers match your active category, keyword, or reach filters. Try clearing criteria or exploring other niches."
                actionLabel="Reset All Filters"
                onActionClick={handleClearAllFilters}
              />
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayedCreators.slice(0, visibleCount).map((creator) => (
                <CreatorDiscoveryCard
                  key={creator.id}
                  creator={creator}
                  showInviteButton={true}
                  onToggleBookmark={handleToggleBookmark}
                />
              ))}
            </div>

            {displayedCreators.length > visibleCount && (
              <div className="flex flex-col items-center justify-center pt-4 pb-2 gap-2">
                <p className="text-xs text-muted-foreground font-medium">
                  Showing {Math.min(visibleCount, displayedCreators.length)} of {displayedCreators.length} creators
                </p>
                <Button
                  variant="secondary"
                  onClick={() => setVisibleCount((prev) => prev + 12)}
                  className="min-h-[44px] px-6 text-xs font-bold gap-2 cursor-pointer shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  Load More Creators ({displayedCreators.length - visibleCount} remaining)
                </Button>
              </div>
            )}
          </div>
        )}
      </PageContainer>

      {/* ── 6. FILTER BOTTOM SHEET MODAL ─────────────────────────────────── */}
      <FilterBottomSheet
        isOpen={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        filters={filters}
        onApplyFilters={(newFilters) => {
          setFilters(newFilters);
        }}
        mode="creators"
      />
    </DashboardShell>
  );
}
