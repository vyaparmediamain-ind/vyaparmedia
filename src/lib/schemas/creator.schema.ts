import { z } from "zod";

/**
 * Standardized creator/influencer item in discovery and feed views.
 * Rates are strictly in integer paise.
 */
export const creatorDiscoveryItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  handle: z.string().min(1),
  avatar: z.string().nullable().optional(),
  coverImage: z.string().nullable().optional(),
  niche: z.string().default("General"),
  city: z.string().optional(),
  followers: z.number().int().min(0),
  engagementRate: z.number().min(0),
  isKycVerified: z.boolean().default(true),
  trustScore: z.number().int().min(0).max(1000).default(750),
  startingRatePaise: z.number().int().min(0),
  topPostImages: z.array(z.string()).optional(),
  isSaved: z.boolean().optional(),
});

export type CreatorDiscoveryItem = z.infer<typeof creatorDiscoveryItemSchema>;

/**
 * Raw influencer item shape from search engine or database.
 */
export const rawInfluencerApiItemSchema = z.object({
  id: z.string().optional(),
  userId: z.string().optional(),
  name: z.string().nullable().optional(),
  displayName: z.string().nullable().optional(),
  user: z
    .object({
      name: z.string().nullable().optional(),
      image: z.string().nullable().optional(),
      isKycVerified: z.boolean().optional(),
      trustScore: z.number().optional(),
      level: z.number().optional(),
      xp: z.number().optional(),
    })
    .nullable()
    .optional(),
  handle: z.string().nullable().optional(),
  instagramHandle: z.string().nullable().optional(),
  youtubeHandle: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
  coverImage: z.string().nullable().optional(),
  portfolioImages: z.array(z.string()).optional(),
  topPostImages: z.array(z.string()).optional(),
  category: z.string().nullable().optional(),
  categories: z.string().nullable().optional(),
  niche: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  followersCount: z.number().optional(),
  followers: z.number().optional(),
  instagramFollowers: z.number().nullable().optional(),
  youtubeSubscribers: z.number().nullable().optional(),
  engagementRate: z.number().optional(),
  instagramEngagementRate: z.number().nullable().optional(),
  isKycVerified: z.boolean().optional(),
  trustScore: z.number().optional(),
  startingRatePaise: z.number().optional(),
  minRate: z.number().nullable().optional(),
  totalCompletedDeals: z.number().optional(),
  isFeatured: z.boolean().optional(),
  isSaved: z.boolean().optional(),
});

export type RawInfluencerApiItem = z.infer<typeof rawInfluencerApiItemSchema>;

export const dashboardInfluencerSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  bio: z.string().nullable(),
  avatar: z.string().nullable(),
  city: z.string().nullable(),
  instagramFollowers: z.number().nullable(),
  youtubeSubscribers: z.number().nullable(),
  categories: z.string(),
  totalCompletedDeals: z.number().default(0),
  trustScore: z.number().default(750),
  userId: z.string(),
  isFeatured: z.boolean().optional(),
});

export type DashboardInfluencer = z.infer<typeof dashboardInfluencerSchema>;

/**
 * Output shape for GET /api/influencers
 */
export const creatorsListResponseSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
  influencers: z.array(rawInfluencerApiItemSchema).default([]),
  pagination: z
    .object({
      page: z.number().int().optional(),
      limit: z.number().int().optional(),
      total: z.number().int().optional(),
      totalPages: z.number().int().optional(),
      nextCursor: z.string().nullable().optional(),
      hasMore: z.boolean().optional().default(false),
    })
    .optional(),
  data: z
    .object({
      influencers: z.array(rawInfluencerApiItemSchema).optional(),
      nextCursor: z.string().nullable().optional(),
      hasMore: z.boolean().optional(),
      total: z.number().int().optional(),
    })
    .optional(),
});

export type CreatorsListResponse = z.infer<typeof creatorsListResponseSchema>;
