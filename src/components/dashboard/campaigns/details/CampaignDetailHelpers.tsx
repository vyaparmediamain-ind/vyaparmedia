"use client";

import { normalizeStringArray, normalizeDeliverables, formatCurrency } from "@/lib/utils-client";
export { normalizeDeliverables };

interface CampaignDetail {
id: string;
title: string;
description: string;
requirements: string;
guidelines: string | null;
status: string;
createdAt?: string | Date | undefined;
totalBudget: number;
perInfluencerBudget: number | null;
minFollowers: number;
maxFollowers: number | null;
targetCategories: string[];
targetCities: string[];
targetLanguages: string[];
applicationDeadline: string | null;
contentDeadline: string;
postingDeadline: string;
totalApplications: number;
selectedInfluencers: number;
deliverables: Array<{ type: string; count: number; specs?: string }>;
brand: {
id?: string | undefined;
userId: string;
companyName: string;
logo: string | null;
averageRating: number;
isGstVerified: boolean;
} | null;
_count?: {
applications?: number;
deals?: number;
};
openDealCount?: number | undefined;
disputedDealCount?: number | undefined;
maxInfluencers: number | null;
acceptedCount: number;
requiresProduct?: boolean | null;
productValue?: number | null;
}

export interface CampaignApplication {
id: string;
status: string;
proposal: string;
proposedRate: number;
estimatedDelivery: string | null;
createdAt: string;
influencer: {
id: string;
displayName: string;
avatar: string | null;
instagramFollowers: number | null;
instagramEngagementRate: number | null;
categories: string;
averageRating: number;
completedDeals: number;
followerAuthenticityScore?: number | null | undefined;
user?: { trustScore?: number | null };
};
matchScore?: number;
matchBreakdown?: {
categoryScore: number;
engagementScore: number;
authenticityScore: number;
qualityScore: number;
roiScore: number;
estimatedViews: number;
estimatedCpvPaise: number;
categoryBaselineCpvPaise?: number;
categoryBenchmarkSource?: string;
relativeCpvRatio?: number;
categoryName?: string;
matchingPriority?: import("@/lib/matching-priority").MatchingPriorityPreset;
weights?: import("@/lib/matching-priority").MatchingWeights;
};
dealId?: string | null;
dealStatus?: string | null;
}
import {
  type SingleCampaignResponse as CampaignDetailResponse,
  type CampaignDetail as RawCampaign,
} from "@/lib/schemas";
export type { CampaignDetailResponse, RawCampaign };


export function normalizeCampaign(raw: RawCampaign): CampaignDetail {
return {
id: raw.id,
title: raw.title || "Untitled Campaign",
description: raw.description || "",
requirements: raw.requirements || "",
guidelines: raw.guidelines || null,
status: raw.status || "DRAFT",
totalBudget: Number(raw.totalBudget || 0),
perInfluencerBudget:
raw.perInfluencerBudget === null || raw.perInfluencerBudget === undefined
? null
: Number(raw.perInfluencerBudget),
minFollowers: Number(raw.minFollowers || 0),
maxFollowers:
raw.maxFollowers === null || raw.maxFollowers === undefined
? null
: Number(raw.maxFollowers),
targetCategories: normalizeStringArray(raw.targetCategories),
targetCities: normalizeStringArray(raw.targetCities),
targetLanguages: normalizeStringArray(raw.targetLanguages),
applicationDeadline: raw.applicationDeadline || null,
contentDeadline: raw.contentDeadline || "",
postingDeadline: raw.postingDeadline || "",
totalApplications: Number(raw.totalApplications || raw?._count?.applications || 0),
selectedInfluencers: Number(raw.selectedInfluencers || 0),
deliverables: normalizeDeliverables(raw.deliverables),
brand: raw.brand
? {
id: String((raw.brand as { id?: string })?.id || (raw as Record<string, unknown>).brandId || "") || undefined,
userId: raw.brand.userId || "",
companyName: raw.brand.companyName || "Unknown Brand",
logo: raw.brand.logo || null,
averageRating: Number(raw.brand.averageRating || 0) / 100,
isGstVerified: Boolean(raw.brand.isGstVerified),
}
: null,
_count: {
applications: Number(raw?._count?.applications || 0),
deals: Number(raw?._count?.deals || 0),
},
openDealCount: typeof raw.openDealCount === "number" ? raw.openDealCount : undefined,
disputedDealCount: typeof raw.disputedDealCount === "number" ? raw.disputedDealCount : undefined,
maxInfluencers: raw.maxInfluencers ?? null,
acceptedCount: typeof raw.openDealCount === "number" ? raw.openDealCount : (raw.applications ? raw.applications.length : 0),
requiresProduct: Boolean(raw.requiresProduct),
productValue: raw.productValue !== null && raw.productValue !== undefined ? Number(raw.productValue) : null,
createdAt: raw.createdAt ? (raw.createdAt instanceof Date ? raw.createdAt.toISOString() : String(raw.createdAt)) : undefined,
};
}

export function calculateRecommendedPayout(
  influencerProfile: {
    readonly instagramFollowers: number | null;
    readonly instagramEngagementRate: number | null;
    readonly youtubeSubscribers: number | null;
    readonly youtubeEngagementRate: number | null;
  },
  deliverables: Array<{ type: string; count: number }>,
  campaignBudgetPaise?: number | null
): number {
  if (campaignBudgetPaise !== null && campaignBudgetPaise !== undefined && campaignBudgetPaise > 0) {
    return campaignBudgetPaise;
  }

  let instagramCount = 0;
  let youtubeCount = 0;

  deliverables.forEach((d) => {
    const type = d.type.toUpperCase();
    if (type.startsWith("INSTAGRAM")) {
      instagramCount += d.count;
    } else if (type.startsWith("YOUTUBE")) {
      youtubeCount += d.count;
    }
  });

  const igFollowers = influencerProfile.instagramFollowers || 0;
  const igER = influencerProfile.instagramEngagementRate || 0;
  const instagramPayoutRupees = (igFollowers * (igER / 100)) * 2 * instagramCount;

  const ytSubscribers = influencerProfile.youtubeSubscribers || 0;
  const ytER = influencerProfile.youtubeEngagementRate || 0;
  const youtubePayoutRupees = (ytSubscribers * (ytER / 100)) * 2.5 * youtubeCount;

  // Return strictly in paise for consistent formatCurrency rendering
  return Math.round((instagramPayoutRupees + youtubePayoutRupees) * 100);
}

function promptNegotiatedRate(proposedRate: number): number | null {
const proposedRateInRupees = proposedRate / 100;
  const rateInput = prompt(
    `Accept application at the proposed rate of ${formatCurrency(proposedRate)}?\n\nOr enter a custom negotiated payout rate in INR:`,
    proposedRateInRupees.toString()
  );
if (rateInput === null) {
return null;
}
const customRateRupees = Number(rateInput);
if (Number.isNaN(customRateRupees) || customRateRupees <= 0) {
alert("Please enter a valid rate");
return null;
}
return Math.round(customRateRupees * 100);
}

export function buildApplicationActionRequest(
action: "accept" | "reject",
applicationId: string,
applications: CampaignApplication[]
): RequestInit | null {
const requestInit: RequestInit = {
method: "POST",
headers: { "Content-Type": "application/json" },
};

if (action === "reject") {
requestInit.body = JSON.stringify({
reason: "Application rejected by brand.",
});
return requestInit;
}

const app = applications.find((a: CampaignApplication) => a.id === applicationId);
if (app) {
const customRatePaise = promptNegotiatedRate(app.proposedRate);
if (customRatePaise === null) {
return null;
}
requestInit.body = JSON.stringify({ customRate: customRatePaise });
}
return requestInit;
}
