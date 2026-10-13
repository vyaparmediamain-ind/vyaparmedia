/**
 * apiClient.campaigns — All campaign-related API calls.
 */
import { get, post, put, patch } from "./http";
import type { HttpOptions } from "./http";
import {
  campaignsListResponseSchema,
  singleCampaignResponseSchema,
  type CampaignsListResponse,
  type SingleCampaignResponse,
} from "@/lib/schemas";

/** GET /api/campaigns — list with filter/sort/page params (validated against campaignsListResponseSchema) */
export function list(
  params: Record<string, string | number> = {},
  options?: HttpOptions,
): Promise<CampaignsListResponse> {
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  ).toString();
  return get<CampaignsListResponse>(`/api/campaigns${qs ? `?${qs}` : ""}`, {
    schema: campaignsListResponseSchema,
    ...options,
  });
}

/** GET /api/campaigns/:id (validated against singleCampaignResponseSchema) */
export function getById(id: string, options?: HttpOptions): Promise<SingleCampaignResponse> {
  return get<SingleCampaignResponse>(`/api/campaigns/${encodeURIComponent(id)}`, {
    schema: singleCampaignResponseSchema,
    ...options,
  });
}


/** POST /api/campaigns — create new campaign */
export function create(data: Record<string, unknown>, options?: HttpOptions) {
  return post("/api/campaigns", data, options);
}

/** PUT /api/campaigns/:id — full update (edit draft) */
export function update(
  id: string,
  data: Record<string, unknown>,
  options?: HttpOptions,
) {
  return put(`/api/campaigns/${encodeURIComponent(id)}`, data, options);
}

/** PATCH /api/campaigns/:id — partial update (ACTIVATE / CANCEL action) */
export function patchAction(
  id: string,
  action: "ACTIVATE" | "CANCEL",
  options?: HttpOptions,
) {
  return patch(`/api/campaigns/${encodeURIComponent(id)}`, { action }, options);
}

/** GET /api/reports/brand/campaign/:id/roi — Campaign ROI & Deliverable Analytics */
export function getRoiReport(id: string, options?: HttpOptions) {
  return get<{
    data: {
      campaign: {
        id: string;
        title: string;
        status: string;
        totalBudgetPaise: number;
        totalBudgetRupees: string;
        targetCategories: string[];
      };
      summary: {
        totalSpendPaise: number;
        totalSpendRupees: string;
        totalReach: number;
        totalViews: number;
        totalEngagements: number;
        avgEngagementRate: number;
        blendedCPE: string;
        effectiveCpvPaise: number;
        effectiveCpvRupees: string;
        effectiveCprRupees: string;
        categoryBaselineCpvPaise: number;
        categoryBaselineCpvRupees: string;
        efficiencyMultiplier: number | null;
        influencerCount: number;
      };
      influencers: Array<{
        dealId: string;
        influencerId: string;
        influencer: string;
        handle?: string | null;
        followers: number | null;
        paid: number;
        paidRupees: string;
        reach: number;
        views: number;
        likes: number;
        comments: number;
        shares: number;
        saves: number;
        totalEngagements: number;
        engagementRate: number;
        cpvPaise: number;
        costPerView: string;
        costPerEngagement: string;
        costPerReach: string;
        rating?: number | null;
        isEstimated: boolean;
        snapshotInterval: string;
      }>;
      dataDisclaimer?: string | null;
    };
  }>(`/api/reports/brand/campaign/${encodeURIComponent(id)}/roi`, options);
}
