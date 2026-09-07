import { Campaign, BrandProfile, Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { tierErrorResponse } from "@/lib/verification-tiers";

export class TierError extends AppError {
tierError: ReturnType<typeof tierErrorResponse>;
constructor(message: string, tierError: ReturnType<typeof tierErrorResponse>) {
super(message, 403); // Tier violations are 403 Forbidden
this.name = "TierError";
this.tierError = tierError;
}
}

export function safeStringCast(val: unknown): string {
if (val === null || val === undefined) return "";
if (typeof val === "object") return "";
if (typeof val === "symbol" || typeof val === "function") return "";
return String(val as string | number | boolean);
}

export function safeStringOrNullCast(val: unknown): string | null {
if (val === null || val === undefined) return null;
if (typeof val === "object") return null;
if (typeof val === "symbol" || typeof val === "function") return null;
return String(val as string | number | boolean);
}

export function estimateCampaignDealSlots(
totalBudget: number,
perInfluencerBudget: number | null,
maxInfluencers: number | null | undefined,
) {
// Priority 1: explicit influencer cap use as-is.
if (maxInfluencers && maxInfluencers > 0) return maxInfluencers;

// Priority 2: per-influencer budget derive a safe slot count.
if (perInfluencerBudget && perInfluencerBudget > 0) {
return Math.max(1, Math.floor(totalBudget / perInfluencerBudget));
}

// Neither constraint set refuse to silently treat this as a 1-slot campaign.
// Campaigns without either maxInfluencers or perInfluencerBudget are ambiguous:
// they could be meant for 1 or 1000 influencers, and assuming 1 would silently
// reject every applicant after the first. Throw so the caller surfaces an error.
throw new AppError(
"Campaign configuration error: at least one of 'maxInfluencers' or 'perInfluencerBudget' must be set so the platform can determine how many deals to allow.",
400,
);
}

export interface DirectInviteParams {
tx: Prisma.TransactionClient;
newCampaign: Campaign;
data: Record<string, unknown>;
profile: BrandProfile;
totalBudgetPaise: number;
perInfluencerBudgetPaise: number | null;
normalizedDeliverables: Prisma.InputJsonValue;
requirements: string;
contentDeadline: Date;
postingDeadline: Date;
requiresProduct: boolean;
productName: string | null;
productValuePaise: number | null;
productHandlingFee: number;
}

export interface ListCampaignsParams {
page: number;
limit: number;
status?: string;
category?: string;
city?: string;
minBudget?: number;
maxBudget?: number;
sortBy?: string;
sortOrder?: "asc" | "desc";
ownerOnly?: boolean;
search?: string;
}

export const CAMPAIGN_INCLUDE = {
brand: {
select: {
id: true,
userId: true,
companyName: true,
logo: true,
averageRating: true,
isGstVerified: true,
totalCampaigns: true,
},
},
applications: {
where: { status: "SELECTED" as const },
select: { id: true },
},
_count: {
select: {
applications: true,
deals: true,
},
},
} as const;

