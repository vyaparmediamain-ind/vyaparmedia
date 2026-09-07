"use client";

import { normalizeStringArray, normalizeDeliverables } from "@/lib/utils-client";
export { normalizeDeliverables };

interface CampaignDetail {
id: string;
title: string;
description: string;
requirements: string;
guidelines: string | null;
status: string;
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
maxInfluencers: number | null;
acceptedCount: number;
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
};
}

export interface RawCampaign {
id: string;
title?: string;
description?: string;
requirements?: string;
guidelines?: string | null;
status?: string;
totalBudget?: number;
perInfluencerBudget?: number | null;
minFollowers?: number;
maxFollowers?: number | null;
targetCategories?: unknown;
targetCities?: unknown;
targetLanguages?: unknown;
applicationDeadline?: string | null;
contentDeadline?: string | null;
postingDeadline?: string | null;
totalApplications?: number;
selectedInfluencers?: number;
maxInfluencers?: number | null;
requiresProduct?: boolean;
productName?: string;
productValue?: number;
productDescription?: string;
deliverables?: unknown;
brand?: { userId?: string; companyName?: string; logo?: string | null; averageRating?: number; isGstVerified?: boolean };
createdAt?: string;
updatedAt?: string;
_count?: { applications?: number; deals?: number };
applications?: { id: string; proposedRate: number; [key: string]: unknown }[];
hasApplied?: boolean;
applicationStatus?: string | null;
}

export interface CampaignDetailResponse {
data?: { campaign?: RawCampaign; hasApplied?: boolean; applicationStatus?: string };
campaign?: RawCampaign;
hasApplied?: boolean;
applicationStatus?: string;
message?: string;
}

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
maxInfluencers: raw.maxInfluencers ?? null,
acceptedCount: raw.applications ? raw.applications.length : 0,
};
}

export function calculateRecommendedPayout(
influencerProfile: {
readonly instagramFollowers: number | null;
readonly instagramEngagementRate: number | null;
readonly youtubeSubscribers: number | null;
readonly youtubeEngagementRate: number | null;
},
deliverables: Array<{ type: string; count: number }>
): number {
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
const instagramPayout = (igFollowers * (igER / 100)) * 2 * instagramCount;

const ytSubscribers = influencerProfile.youtubeSubscribers || 0;
const ytER = influencerProfile.youtubeEngagementRate || 0;
const youtubePayout = (ytSubscribers * (ytER / 100)) * 2.5 * youtubeCount;

return Math.round(instagramPayout + youtubePayout);
}

function promptNegotiatedRate(proposedRate: number): number | null {
const proposedRateInRupees = proposedRate / 100;
  const rateInput = prompt(
    `Accept application at the proposed rate of ₹${proposedRateInRupees.toLocaleString()}?\n\nOr enter a custom negotiated payout rate in INR:`,
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
