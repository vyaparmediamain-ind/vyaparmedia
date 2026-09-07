"use client";

import Image from "next/image";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { useEffect, useMemo, useState, useCallback } from "react";
import { formatCurrency, formatNumber, normalizeStringArray, normalizeDeliverables } from "@/lib/utils-client";
import { Pagination } from "@/components/ui/pagination";
import EmptyState from "@/components/ui/EmptyState";
import { Badge, Button, Input, Select, Skeleton } from "@/components/ui";
import { ALL_CATEGORIES } from "@/lib/categories";

interface Campaign {
id: string;
title: string;
description: string;
createdAt: string;
perInfluencerBudget: number;
minFollowers: number;
postingDeadline: string;
targetCategories: string[];
totalApplications: number;
brand: {
companyName: string;
logo: string | null;
avgRating: number;
};
deliverables: { type: string; count: number }[];
maxInfluencers: number | null;
acceptedCount: number;
}

const categories = ["All", ...ALL_CATEGORIES];

const deliverableLabels: Record<string, string> = {
INSTAGRAM_POST: "IG Post",
INSTAGRAM_REEL: "IG Reel",
INSTAGRAM_STORY: "IG Story",
YOUTUBE_VIDEO: "YT Video",
YOUTUBE_SHORT: "YT Short",
};

interface CampaignsPayload {
data?: { campaigns?: RawCampaign[]; totalPages?: number };
campaigns?: RawCampaign[];
totalPages?: number;
}

interface RawCampaign {
id?: string;
title?: string;
description?: string;
createdAt?: string;
perInfluencerBudget?: number | string;
minFollowers?: number | string;
postingDeadline?: string;
targetCategories?: unknown;
totalApplications?: number;
brand?: { companyName?: string; logo?: string | null; avgRating?: number; averageRating?: number };
deliverables?: unknown;
maxInfluencers?: number | null;
acceptedCount?: number;
_count?: { applications?: number };
applications?: unknown[];
}

function CampaignCardSkeleton() {
return (
<div className="campaign-card-grid grid gap-4 grid-auto-280" aria-hidden="true">
{Array.from({ length: 6 }).map((_, i) => (
<div key={`skeleton-campaign-card-${i}`} className="card p-18px">
<div className="flex items-center gap-3 mb-3">
<Skeleton width={40} height={40} borderRadius={6} />
<div className="flex-1">
<Skeleton height={12} width={100} borderRadius={4} className="mb-1-5" />
<Skeleton height={16} width={160} borderRadius={4} />
</div>
<Skeleton height={22} width={64} borderRadius={20} />
</div>
<Skeleton height={42} borderRadius={6} className="mb-3" />
<div className="flex gap-1.5 mb-3">
<Skeleton height={20} width={56} borderRadius={4} />
<Skeleton height={20} width={64} borderRadius={4} />
<Skeleton height={20} width={52} borderRadius={4} />
</div>
<div className="grid gap-2 mb-3 responsive-three-col">
{[1, 2, 3].map((j) => (
<div key={j}>
<Skeleton height={10} width={36} borderRadius={3} className="mb-1" />
<Skeleton height={14} width={52} borderRadius={3} />
</div>
))}
</div>
<div className="flex justify-between items-center">
<Skeleton height={12} width={80} borderRadius={3} />
<Skeleton height={34} width={96} borderRadius={6} />
</div>
</div>
))}
</div>
);
}

function buildCampaignQueryParams(
  canCreateCampaign: boolean,
  selectedCategory: string,
  debouncedSearch: string,
  sortBy: string,
  page: number
): string {
  const queryParams = new URLSearchParams();

  if (canCreateCampaign) {
    queryParams.set("scope", "mine");
    queryParams.set("status", "ALL");
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

function mapRawCampaigns(rawCampaigns: RawCampaign[]): Campaign[] {
  return rawCampaigns.map((campaign: RawCampaign) => ({
    id: campaign.id || '',
    title: campaign.title || "Untitled Campaign",
    description: campaign.description || "",
    createdAt: campaign.createdAt || new Date(0).toISOString(),
    perInfluencerBudget: Number(campaign.perInfluencerBudget || 0),
    minFollowers: Number(campaign.minFollowers || 0),
    postingDeadline: campaign.postingDeadline || new Date(0).toISOString(),
    targetCategories: normalizeStringArray(campaign.targetCategories),
    totalApplications: Number(campaign.totalApplications || campaign._count?.applications || 0),
    brand: {
      companyName: campaign.brand?.companyName || "Unknown Brand",
      logo: campaign.brand?.logo || null,
      avgRating: Number(campaign.brand?.avgRating || campaign.brand?.averageRating || 0) / 100,
    },
    deliverables: normalizeDeliverables(campaign.deliverables),
    maxInfluencers: campaign.maxInfluencers ?? null,
    acceptedCount: Array.isArray(campaign.applications) ? campaign.applications.length : 0,
  }));
}

function CampaignCard({ campaign }: { readonly campaign: Campaign }) {
  return (
    <article key={campaign.id} className="card campaign-card p-18px">
      <div className="campaign-card-brand-row">
        <div className="campaign-card-logo relative overflow-hidden flex-shrink-0 rounded-xl flex items-center justify-center" aria-hidden={!campaign.brand.logo}>
          {campaign.brand.logo ? (
            <Image src={campaign.brand.logo} alt={campaign.brand.companyName} width={58} height={58} unoptimized className="object-cover rounded-xl w-full h-full" />
          ) : (
            campaign.brand.companyName.slice(0, 2).toUpperCase()
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="campaign-card-brand-name">
            {campaign.brand.companyName}
          </div>
          <h3>{campaign.title}</h3>
        </div>
        <Badge variant="success" className="campaign-card-rate">
          {formatCurrency(campaign.perInfluencerBudget)}
        </Badge>
      </div>

      <p className="campaign-card-description text-secondary text-sm leading-normal campaign-desc-min-h-42">
        {campaign.description}
      </p>

      <div className="campaign-card-tags flex flex-wrap gap-1.5 campaign-tags-margin">
        {campaign.deliverables.slice(0, 2).map((item, index) => (
          <Badge key={`${campaign.id}-del-${index}`} variant="primary">
            {item.count}x {deliverableLabels[item.type] || item.type}
          </Badge>
        ))}
        {campaign.targetCategories.slice(0, 2).map((category) => (
          <Badge key={`${campaign.id}-${category}`} variant="ghost">
            {category}
          </Badge>
        ))}
      </div>

      <div className="campaign-card-metrics grid gap-2 mb-3 grid-cols-3">
        <div>
          <div className="text-xs text-muted">Slots</div>
          <div className="text-sm font-semibold">
            {campaign.maxInfluencers !== null && campaign.maxInfluencers !== undefined
              ? `${campaign.acceptedCount}/${campaign.maxInfluencers} filled`
              : "Unlimited"}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted">Followers</div>
          <div className="text-sm font-semibold">
            {formatNumber(campaign.minFollowers)}+
          </div>
        </div>
        <div>
          <div className="text-xs text-muted">Applied</div>
          <div className="text-sm font-semibold">{campaign.totalApplications}</div>
        </div>
      </div>

      <div className="campaign-card-footer flex items-center justify-between gap-2.5">
        <span className="text-xs text-secondary">
          Post by {new Date(campaign.postingDeadline).toLocaleDateString("en-IN")}
        </span>
        <Button
          href={`/dashboard/campaigns/${campaign.id}`}
          variant="primary"
          size="sm"
          aria-label={`View details for campaign: ${campaign.title}`}
        >
          View Details
        </Button>
      </div>
    </article>
  );
}

export default function CampaignsClient({ user }: { readonly user: { readonly userType?: string } }) {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(1);

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
    page
  );

  const { data: payload, isLoading: loading, error: fetchErr } = useSWR<CampaignsPayload>(
    `/api/campaigns?${queryString}`,
    fetcher
  );

  const { campaigns, totalPages } = useMemo(() => {
    const rawCampaigns: RawCampaign[] = payload?.data?.campaigns ?? payload?.campaigns ?? [];
    const pages = payload?.data?.totalPages ?? payload?.totalPages ?? 1;
    const mapped = mapRawCampaigns(rawCampaigns);
    return { campaigns: mapped, totalPages: pages };
  }, [payload]);

  const error = fetchErr ? "Unable to load campaigns right now." : null;

  const filteredCampaigns = useMemo(() => {
    return campaigns;
  }, [campaigns]);

  /** Stable handler avoids re-creating on every render */
  const handleCategoryChange = useCallback((category: string) => {
    setSelectedCategory(category);
    setPage(1);
  }, []);

  const handleSortChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortBy(e.target.value);
    setPage(1);
  }, []);

  let content;
  if (loading) {
    content = <CampaignCardSkeleton />;
  } else if (error) {
    content = (
      <EmptyState
        title="Error Loading Campaigns"
        description={error}
      />
    );
  } else if (filteredCampaigns.length === 0) {
    content = (
      <EmptyState
        title={canCreateCampaign ? "No Campaigns Yet" : "No Campaigns Found"}
        description={
          canCreateCampaign
            ? "You haven't created any campaigns yet. Launch your first campaign to find creators."
            : "Try broadening your search query or changing category and budget filters."
        }
        actionLabel={canCreateCampaign ? "Create Campaign" : undefined}
        actionHref={canCreateCampaign ? "/dashboard/campaigns/create" : undefined}
      />
    );
  } else {
    content = (
      <div className="campaign-card-grid grid gap-4 grid-auto-280">
        {filteredCampaigns.map((campaign) => (
          <CampaignCard key={campaign.id} campaign={campaign} />
        ))}
      </div>
    );
  }

return (
<div className="campaigns-page">
<header className="dashboard-sub-header glass">
<div className="flex flex-row justify-between items-center gap-4 w-full min-w-0">
  <div className="min-w-0 flex-1">
    <h2 className="text-lg font-extrabold">
      {canCreateCampaign ? "My Campaigns" : "Explore Campaigns"}
    </h2>
    <p className="text-sm text-secondary leading-tight">
      {canCreateCampaign
        ? "Manage your campaigns and track influencer applications."
        : "Apply to active campaigns matching your niche."}
    </p>
  </div>
  {canCreateCampaign && (
    <Button
      href="/dashboard/campaigns/create"
      variant="primary"
      aria-label="Create a new campaign"
      className="flex-shrink-0 whitespace-nowrap"
    >
      Create Campaign
    </Button>
  )}
</div>

<div
className="flex gap-3 flex-wrap mt-5 campaign-filters"
>
<Input
id="search-campaigns-input"
type="text"
placeholder="Search campaigns..."
value={searchQuery}
onChange={(e) => setSearchQuery(e.target.value)}
className="campaign-search-field"
aria-label="Search campaigns"
fullWidth
/>

<Select
id="sort-campaigns-select"
value={sortBy}
onChange={handleSortChange}
className="campaign-sort-field"
aria-label="Sort campaigns"
fullWidth
>
<option value="newest">Newest</option>
<option value="budget_high">Budget: High to Low</option>
<option value="budget_low">Budget: Low to High</option>
<option value="deadline">Deadline Soon</option>
</Select>
</div>

<div
className="scrollable-tabs flex gap-2 mt-4 overflow-x-auto campaign-category-tabs"
>
{categories.map((category) => (
<Button
key={category}
variant={selectedCategory === category ? "primary" : "ghost"}
size="sm"
onClick={() => handleCategoryChange(category)}
aria-pressed={selectedCategory === category}
className="whitespace-nowrap"
>
{category}
</Button>
))}
</div>
</header>

{content}

<Pagination page={page} totalPages={totalPages} setPage={setPage} marginTop="32px" />
</div>
);
}
