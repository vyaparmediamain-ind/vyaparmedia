import { z } from "zod";
import { createCampaignSchema } from "@/lib/validations";

// Re-export input validation schema for single source of truth
export { createCampaignSchema };
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

/**
 * Standardized campaign item in discovery and feed views.
 * Currency is strictly in integer paise.
 */
export const campaignDiscoveryItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(""),
  coverImage: z.string().nullable().optional(),
  brandId: z.string().default(""),
  brandName: z.string().default("Brand Partner"),
  brandAvatar: z.string().nullable().optional(),
  isBrandGstVerified: z.boolean().default(true),
  budgetPaise: z.number().int().min(0),
  perInfluencerBudgetPaise: z.number().int().min(0).optional(),
  isEscrowSecured: z.boolean().default(true),
  niche: z.string().default("General"),
  city: z.string().optional(),
  deadline: z.string().optional(),
  deliverables: z.array(z.string()).optional(),
  isSaved: z.boolean().optional(),
});

export type CampaignDiscoveryItem = z.infer<typeof campaignDiscoveryItemSchema>;

/**
 * Raw item shape returned by the backend campaigns API.
 * Standardizes mapping from database/search engine representations.
 */
export const rawCampaignApiItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string().optional(),
  description: z.string().nullable().optional(),
  coverImage: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  brandId: z.string().nullable().optional(),
  userId: z.string().nullable().optional(),
  brand: z
    .object({
      name: z.string().nullable().optional(),
      companyName: z.string().nullable().optional(),
      image: z.string().nullable().optional(),
      logo: z.string().nullable().optional(),
      gstin: z.string().nullable().optional(),
      industry: z.string().nullable().optional(),
      avgRating: z.number().optional(),
      averageRating: z.number().optional(),
    })
    .nullable()
    .optional(),
  brandName: z.string().nullable().optional(),
  brandAvatar: z.string().nullable().optional(),
  isBrandGstVerified: z.boolean().optional(),
  totalBudget: z.number().optional(),
  totalBudgetPaise: z.number().optional(),
  budgetPaise: z.number().optional(),
  budget: z.number().optional(),
  perInfluencerBudget: z.union([z.number(), z.string()]).nullable().optional(),
  perInfluencerBudgetPaise: z.number().optional(),
  minFollowers: z.union([z.number(), z.string()]).optional(),
  isEscrowSecured: z.boolean().optional(),
  category: z.string().nullable().optional(),
  targetCategories: z.unknown().optional(),
  niche: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  targetCities: z.array(z.string()).optional(),
  createdAt: z.union([z.string(), z.date()]).optional(),
  applicationDeadline: z.string().or(z.date()).nullable().optional(),
  postingDeadline: z.string().optional(),
  deadline: z.string().optional(),
  deliverables: z.unknown().optional(),
  totalApplications: z.number().optional(),
  _count: z.object({ applications: z.number().optional() }).optional(),
  applications: z.unknown().optional(),
  isSaved: z.boolean().optional(),
  maxInfluencers: z.number().nullable().optional(),
  acceptedCount: z.number().optional(),
});

export type RawCampaignApiItem = z.infer<typeof rawCampaignApiItemSchema>;

export const dashboardCampaignSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string().default("ACTIVE"),
  description: z.string(),
  createdAt: z.string(),
  perInfluencerBudget: z.number(),
  minFollowers: z.number(),
  postingDeadline: z.string(),
  targetCategories: z.array(z.string()),
  totalApplications: z.number(),
  brandId: z.string().nullable().optional(),
  brand: z.object({
    id: z.string().nullable().optional(),
    userId: z.string().nullable().optional(),
    companyName: z.string(),
    logo: z.string().nullable(),
    avgRating: z.number(),
  }),
  deliverables: z.array(z.object({ type: z.string(), count: z.number() })),
  maxInfluencers: z.number().nullable(),
  acceptedCount: z.number(),
});

export type DashboardCampaign = z.infer<typeof dashboardCampaignSchema>;

/**
 * Output shape for GET /api/campaigns
 */
export const campaignsListResponseSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
  data: z
    .object({
      campaigns: z.array(rawCampaignApiItemSchema).default([]),
      total: z.number().int().optional(),
      totalPages: z.number().int().optional(),
      page: z.number().int().optional(),
      limit: z.number().int().optional(),
      nextCursor: z.string().nullable().optional(),
      hasMore: z.boolean().optional().default(false),
    })
    .optional(),
  campaigns: z.array(rawCampaignApiItemSchema).optional(),
  total: z.number().int().optional(),
  totalPages: z.number().int().optional(),
  page: z.number().int().optional(),
  limit: z.number().int().optional(),
  nextCursor: z.string().nullable().optional(),
  hasMore: z.boolean().optional().default(false),
});

export type CampaignsListResponse = z.infer<typeof campaignsListResponseSchema>;

/**
 * Detailed Campaign Item returned by GET /api/campaigns/:id.
 */
export const campaignDetailSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string().nullable().optional(),
    requirements: z.string().nullable().optional(),
    guidelines: z.string().nullable().optional(),
    status: z.string().optional(),
    totalBudget: z.number().optional(),
    perInfluencerBudget: z.number().nullable().optional(),
    minFollowers: z.number().optional(),
    maxFollowers: z.number().nullable().optional(),
    targetCategories: z.unknown().optional(),
    targetCities: z.unknown().optional(),
    targetLanguages: z.unknown().optional(),
    targetGender: z.string().optional(),
    targetAgeMin: z.number().nullable().optional(),
    targetAgeMax: z.number().nullable().optional(),
    minEngagementRate: z.number().optional(),
    applicationDeadline: z.string().nullable().optional(),
    contentDeadline: z.string().nullable().optional(),
    postingDeadline: z.string().nullable().optional(),

    totalApplications: z.number().optional(),
    selectedInfluencers: z.number().optional(),
    maxInfluencers: z.number().nullable().optional(),
    requiresProduct: z.boolean().optional(),
    productName: z.string().optional(),
    productValue: z.number().optional(),
    productDescription: z.string().optional(),
    deliverables: z.unknown().optional(),
    brand: z
      .object({
        userId: z.string().optional(),
        companyName: z.string().optional(),
        logo: z.string().nullable().optional(),
        averageRating: z.number().optional(),
        isGstVerified: z.boolean().optional(),
      })
      .nullable()
      .optional(),
    createdAt: z.union([z.string(), z.date()]).optional(),
    updatedAt: z.union([z.string(), z.date()]).optional(),
    _count: z.object({ applications: z.number().optional(), deals: z.number().optional() }).optional(),
    applications: z.array(z.record(z.string(), z.unknown())).optional(),
    hasApplied: z.boolean().optional(),
    applicationStatus: z.string().nullable().optional(),
    openDealCount: z.number().optional(),
    disputedDealCount: z.number().optional(),
    dealId: z.string().nullable().optional(),
  })
  .catchall(z.unknown());

export type CampaignDetail = z.infer<typeof campaignDetailSchema>;

/**
 * GET /api/campaigns/:id response schema.
 */
export const singleCampaignResponseSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
  data: z
    .object({
      campaign: campaignDetailSchema.optional(),
      hasApplied: z.boolean().optional(),
      applicationStatus: z.string().nullable().optional(),
      dealId: z.string().nullable().optional(),
    })
    .catchall(z.unknown())
    .optional(),
  campaign: campaignDetailSchema.optional(),
  hasApplied: z.boolean().optional(),
  applicationStatus: z.string().nullable().optional(),
  dealId: z.string().nullable().optional(),
});

export type SingleCampaignResponse = z.infer<typeof singleCampaignResponseSchema>;

/**
 * Draft Campaign schema used during creation/editing.
 */
export const draftCampaignDataSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    requirements: z.string().optional(),
    guidelines: z.string().optional(),
    totalBudget: z.number().optional(),
    perInfluencerBudget: z.number().optional(),
    maxInfluencers: z.number().nullable().optional(),
    targetCategories: z.array(z.string()).optional(),
    targetCities: z.array(z.string()).optional(),
    targetLanguages: z.array(z.string()).optional(),
    targetGender: z.string().optional(),
    targetAgeMin: z.number().nullable().optional(),
    targetAgeMax: z.number().nullable().optional(),
    minFollowers: z.number().optional(),
    maxFollowers: z.number().optional(),
    minEngagementRate: z.number().optional(),
    applicationDeadline: z.string().nullable().optional(),
    contentDeadline: z.string().optional(),

    postingDeadline: z.string().optional(),
    requiresProduct: z.boolean().optional(),
    productName: z.string().optional(),
    productValue: z.number().optional(),
    productDescription: z.string().optional(),
    deliverables: z.array(z.object({ type: z.string(), count: z.number(), rate: z.number().optional() })).optional(),
  })
  .catchall(z.unknown());

export type DraftCampaignData = z.infer<typeof draftCampaignDataSchema>;

export const draftCampaignResponseSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
  campaign: draftCampaignDataSchema.optional(),
  data: z.object({ campaign: draftCampaignDataSchema.optional() }).optional(),
});

export type DraftCampaignResponse = z.infer<typeof draftCampaignResponseSchema>;

