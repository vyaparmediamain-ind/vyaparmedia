import { createCampaignSchema } from "@/lib/validations/campaign";
import {
  DEFAULT_BRAND_PLATFORM_FEE_PERCENT,
  DEFAULT_GATEWAY_FEE_PERCENT,
  DEFAULT_PRODUCT_HANDLING_FEE_PERCENT,
} from "@/constants/deals";
export { createCampaignSchema };

export interface CampaignFormData {
title: string;
description: string;
requirements: string;
totalBudget: number;
perInfluencerBudget: number;
targetCategories: string[];
targetCities: string[];
targetGender: string;
targetAgeMin: number | null;
targetAgeMax: number | null;
minFollowers: number;
maxFollowers: number;
maxInfluencers: number | null;
applicationDeadline: string;
contentDeadline: string;
postingDeadline: string;
requiresProduct: boolean;
productName: string;
productValue: number;
productDescription: string;
deliverables: Array<{ type: string; count: number; rate: number }>;
matchingPriority?: "BALANCED" | "REACH_FOCUSED" | "TRUST_FOCUSED" | "ROI_FOCUSED" | "CUSTOM" | undefined;
customWeights?: { category: number; engagement: number; authenticity: number; quality: number; roi: number } | undefined;
}

type ValidationResult = { success: boolean; fieldErrors?: Record<string, string>; error?: string };

function validateBudget(formData: CampaignFormData): ValidationResult | null {
  if (formData.requiresProduct && formData.totalBudget === 0) {
    if (formData.productValue < 500) {
      return { success: false, error: "Product-only campaigns must specify a product value of at least ₹500" };
    }
    if (formData.minFollowers > 10000) {
      return { success: false, error: "Product-only campaigns can only target influencers with up to 10,000 followers" };
    }
  } else {
    if (formData.perInfluencerBudget < 500) {
      return { success: false, error: "Minimum budget per influencer is ₹500" };
    }
    if (formData.totalBudget < 1000) {
      return { success: false, error: "Minimum campaign budget is ₹1,000" };
    }
  }
  return null;
}

function validateDeadlines(formData: CampaignFormData): ValidationResult | null {
  if (!formData.applicationDeadline || !formData.contentDeadline || !formData.postingDeadline) {
    return { success: false, error: "Please select application, content, and posting deadlines" };
  }
const contentDate = new Date(formData.contentDeadline);
const postingDate = new Date(formData.postingDeadline);
if (Number.isNaN(contentDate.getTime()) || Number.isNaN(postingDate.getTime())) {
return { success: false, error: "Please select valid content and posting deadlines" };
}
if (postingDate < contentDate) {
return { success: false, error: "Posting deadline must be after content deadline" };
}
if (formData.applicationDeadline) {
const appDate = new Date(formData.applicationDeadline);
if (Number.isNaN(appDate.getTime())) {
return { success: false, error: "Please select a valid application deadline" };
}
const today = new Date();
today.setHours(0, 0, 0, 0);
const appDateStart = new Date(appDate);
appDateStart.setHours(0, 0, 0, 0);
if (appDateStart < today) {
return { success: false, error: "Application deadline cannot be in the past" };
}
if (appDateStart > contentDate) {
return { success: false, error: "Application deadline must be before content deadline" };
}
}
return null;
}

export function validateCampaignForm(formData: CampaignFormData): ValidationResult {
const result = createCampaignSchema.safeParse({
title: formData.title.trim(),
description: formData.description.trim(),
requirements: formData.requirements.trim(),
perInfluencerBudget: formData.perInfluencerBudget,
maxInfluencers: formData.maxInfluencers ?? 1,
minFollowers: formData.minFollowers,
targetCategories: formData.targetCategories,
applicationDeadline: formData.applicationDeadline || undefined,
postingDeadline: formData.postingDeadline,
matchingPriority: formData.matchingPriority || "BALANCED",
customWeights: formData.customWeights,
});

if (!result.success) {
const fieldErrors: Record<string, string> = {};
result.error.issues.forEach((issue) => {
const path = issue.path[0];
if (typeof path === "string") {
fieldErrors[path] = issue.message;
}
});
return { success: false, fieldErrors };
}

const budgetError = validateBudget(formData);
if (budgetError) return budgetError;

if (formData.targetCategories.length === 0) {
return { success: false, error: "Please select at least one category" };
}
if (formData.perInfluencerBudget > formData.totalBudget) {
return { success: false, error: "Per influencer budget cannot exceed total budget" };
}
if (!formData.maxFollowers || formData.maxFollowers <= 0) {
  return { success: false, error: "Max followers is required" };
}
if (formData.maxFollowers < formData.minFollowers) {
  return { success: false, error: "Max followers must be greater than or equal to min followers" };
}

const deadlineError = validateDeadlines(formData);
if (deadlineError) return deadlineError;

return { success: true };
}

export const getRecommendedRate = (type: string, minFollowers: number) => {
const isYoutube = type.startsWith("YOUTUBE");
const multiplier = isYoutube ? 2.5 : 2;
const estimatedEngagement = minFollowers * 0.03;
const calculated = Math.round(estimatedEngagement * multiplier);
const floor = isYoutube ? 750 : 500;
return Math.max(floor, Math.round(calculated / 10) * 10);
};

export const deliverableTypes = [
{ value: "INSTAGRAM_POST", label: "Instagram Post" },
{ value: "INSTAGRAM_REEL", label: "Instagram Reel" },
{ value: "INSTAGRAM_STORY", label: "Instagram Story" },
{ value: "YOUTUBE_VIDEO", label: "YouTube Video" },
{ value: "YOUTUBE_SHORT", label: "YouTube Short" },
];

export interface CampaignEscrowBreakdown {
  creatorPayoutPoolPaise: number;
  platformFeePaise: number;
  basePlatformFeePaise: number;
  gatewayFeePaise: number;
  totalEscrowRequiredPaise: number;
  platformFeePercent: number;
  gatewayFeePercent: number;
  productHandlingFeePaise: number;
}

export function calculateCampaignEscrowPaise(
  totalBudgetRupees: number,
  platformFeePercent: number = DEFAULT_BRAND_PLATFORM_FEE_PERCENT,
  gatewayFeePercent: number = DEFAULT_GATEWAY_FEE_PERCENT,
  options?: {
    requiresProduct?: boolean;
    productValueRupees?: number;
    maxInfluencers?: number | null;
    perInfluencerBudgetRupees?: number;
  },
): CampaignEscrowBreakdown {
  const creatorPayoutPoolPaise = Math.round((Number(totalBudgetRupees) || 0) * 100);
  const productValuePaise = Math.round((Number(options?.productValueRupees) || 0) * 100);
  const requiresProduct = Boolean(options?.requiresProduct);

  let slots = 1;
  if (options?.maxInfluencers && options.maxInfluencers > 0) {
    slots = options.maxInfluencers;
  } else if (
    options?.perInfluencerBudgetRupees &&
    options.perInfluencerBudgetRupees > 0 &&
    creatorPayoutPoolPaise > 0
  ) {
    slots = Math.max(1, Math.floor(creatorPayoutPoolPaise / (options.perInfluencerBudgetRupees * 100)));
  }

  const isProductOnly = requiresProduct && creatorPayoutPoolPaise === 0;
  let handlingFeePerSlot = 0;
  if (requiresProduct && productValuePaise > 0) {
    if (isProductOnly) {
      handlingFeePerSlot = Math.max(0, Math.round((productValuePaise * platformFeePercent) / 100));
    } else {
      handlingFeePerSlot = Math.max(
        0,
        Math.round((productValuePaise * DEFAULT_PRODUCT_HANDLING_FEE_PERCENT) / 100),
      );
    }
  }

  const totalProductHandlingFee = handlingFeePerSlot * slots;
  const basePlatformFeePaise = Math.round((creatorPayoutPoolPaise * platformFeePercent) / 100);
  const platformFeePaise = basePlatformFeePaise + totalProductHandlingFee;
  const gatewayFeePaise = Math.round(
    ((creatorPayoutPoolPaise + platformFeePaise) * gatewayFeePercent) / 100,
  );
  const totalEscrowRequiredPaise = creatorPayoutPoolPaise + platformFeePaise + gatewayFeePaise;

  return {
    creatorPayoutPoolPaise,
    platformFeePaise,
    basePlatformFeePaise,
    gatewayFeePaise,
    totalEscrowRequiredPaise,
    platformFeePercent,
    gatewayFeePercent,
    productHandlingFeePaise: totalProductHandlingFee,
  };
}

