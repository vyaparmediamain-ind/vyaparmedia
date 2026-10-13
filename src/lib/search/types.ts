export type SearchSortBy = "relevance" | "followers" | "rate" | "rating" | "recency" | "budget";
export type SortOrder = "asc" | "desc";

export interface CursorPayload {
  sortValue: string | number;
  id: string;
}

export interface CursorPaginationResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
  total?: number | undefined;
  totalEstimated?: number | undefined;
  durationMs?: number | undefined;
}

export interface CreatorSearchParams {
  searchTerm?: string | undefined;
  category?: string | undefined;
  city?: string | undefined;
  minFollowers?: number | undefined;
  maxFollowers?: number | undefined;
  minEngagementRate?: number | undefined;
  minRate?: number | undefined;
  maxRate?: number | undefined;
  platform?: "instagram" | "youtube" | string | undefined;
  isFeatured?: boolean | undefined;
  brandUserId?: string | undefined;
  sortBy?: SearchSortBy | undefined;
  sortOrder?: SortOrder | undefined;
  cursor?: string | undefined;
  limit?: number | undefined;
  page?: number | undefined; // Backward compatibility fallback
}

export interface CampaignSearchParams {
  search?: string | undefined;
  query?: string | undefined; // Alias for search
  category?: string | undefined;
  city?: string | undefined;
  minBudget?: number | undefined;
  maxBudget?: number | undefined;
  status?: string | undefined;
  ownerOnly?: boolean | undefined;
  userId?: string | undefined;
  userType?: string | undefined;
  sortBy?: string | undefined;
  sortOrder?: SortOrder | undefined;
  cursor?: string | undefined;
  limit?: number | undefined;
  page?: number | undefined; // Backward compatibility fallback
}

export interface CreatorRankFactors {
  textRelevance: number; // 0 - 1.0 (from ts_rank_cd / similarity)
  trustScore: number;    // 0 - 900
  engagementRate: number; // 0 - 100% or basis points
  averageRating: number;  // 0 - 500
  completedDeals: number;
  accountAgeDays?: number | undefined;
  isFeatured: boolean;
}

export interface CampaignRankFactors {
  textRelevance: number; // 0 - 1.0
  totalBudgetPaise?: number | undefined;
  perInfluencerBudgetPaise: number;
  brandTrustScore: number; // 0 - 900
  daysUntilDeadline?: number | undefined;
  createdAt: Date;
}
