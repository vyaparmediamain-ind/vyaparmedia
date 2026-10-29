import { z } from "zod";

/**
 * Deal representation for active escrow stories and quick status widgets.
 * Amounts are in integer paise.
 */
export const storyDealSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  state: z.string(),
  counterpartyName: z.string().default("Partner"),
  counterpartyAvatar: z.string().nullable().optional(),
  amount: z.number().int().optional(),
});

export type StoryDeal = z.infer<typeof storyDealSchema>;

/**
 * Raw deal item shape from DealService.listDeals
 */
export const rawDealItemSchema = z.object({
  id: z.string(),
  state: z.string().optional(),
  status: z.string().optional(),
  amount: z.number().int().optional(),
  totalAmount: z.number().int().optional(),
  title: z.string().optional(),
  campaign: z
    .object({
      id: z.string().optional(),
      title: z.string().optional(),
      postingDeadline: z.string().optional(),
      deliverables: z.unknown().optional(),
    })
    .optional(),
  influencer: z
    .object({
      id: z.string().optional(),
      displayName: z.string().nullable().optional(),
      avatar: z.string().nullable().optional(),
      user: z
        .object({
          name: z.string().nullable().optional(),
          image: z.string().nullable().optional(),
        })
        .optional(),
    })
    .optional(),
  brand: z
    .object({
      id: z.string().optional(),
      companyName: z.string().nullable().optional(),
      logo: z.string().nullable().optional(),
      user: z
        .object({
          name: z.string().nullable().optional(),
          image: z.string().nullable().optional(),
        })
        .optional(),
    })
    .optional(),
  createdAt: z.union([z.string(), z.date()]).optional(),
  postingDeadline: z.string().optional(),
  deliverables: z.unknown().optional(),
  counterpartyName: z.string().optional(),
  counterpartyAvatar: z.string().nullable().optional(),
});

export type RawDealItem = z.infer<typeof rawDealItemSchema>;

export const dashboardDealSchema = z.object({
  id: z.string(),
  status: z.string(),
  amount: z.number(),
  createdAt: z.string(),
  postingDeadline: z.string(),
  campaign: z.object({ title: z.string() }),
  brand: z.object({
    id: z.string().nullable().optional(),
    userId: z.string().nullable().optional(),
    companyName: z.string(),
    logo: z.string().nullable(),
  }),
  deliverables: z.array(z.object({ type: z.string(), count: z.number() })),
});

export type Deal = z.infer<typeof dashboardDealSchema>;

/**
 * Response schema for GET /api/deals
 */
export const dealsListResponseSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
  data: z
    .object({
      deals: z.array(rawDealItemSchema).default([]),
      pagination: z
        .object({
          page: z.number().int().optional(),
          limit: z.number().int().optional(),
          total: z.number().int().optional(),
          totalPages: z.number().int().optional(),
        })
        .optional(),
      stats: z
        .object({
          active: z.number().optional(),
          completed: z.number().optional(),
          totalEarnings: z.number().optional(),
        })
        .catchall(z.unknown())
        .optional(),
    })
    .optional(),
  deals: z.array(rawDealItemSchema).optional(),
  pagination: z
    .object({
      page: z.number().int().optional(),
      limit: z.number().int().optional(),
      total: z.number().int().optional(),
      totalPages: z.number().int().optional(),
    })
    .optional(),
  stats: z
    .object({
      active: z.number().optional(),
      completed: z.number().optional(),
      totalEarnings: z.number().optional(),
    })
    .catchall(z.unknown())
    .optional(),
});

export type DealsListResponse = z.infer<typeof dealsListResponseSchema>;

/**
 * Content URL Entry schema.
 */
export const contentUrlEntrySchema = z.object({
  type: z.string(),
  url: z.string(),
  status: z.string().optional(),
  feedback: z.string().optional(),
});

export type ContentUrlEntry = z.infer<typeof contentUrlEntrySchema>;

/**
 * Content Submission Item attached to a deal.
 */
export const contentSubmissionItemSchema = z.object({
  id: z.string().optional(),
  version: z.number().optional(),
  contentUrl: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.union([z.string(), z.date()]).optional(),
  submittedAt: z.union([z.string(), z.date()]).optional(),
  reviewedAt: z.union([z.string(), z.date()]).optional(),
  status: z.string().optional(),
  feedback: z.string().optional(),
  contentUrls: z.array(contentUrlEntrySchema).optional(),
});

export type ContentSubmissionItem = z.infer<typeof contentSubmissionItemSchema>;

/**
 * Comprehensive Deal Detail schema matching GET /api/deals/:id.
 */
export const dealDetailSchema = z
  .object({
    id: z.string(),
    campaignId: z.string().optional(),
    influencerId: z.string().optional(),
    brandId: z.string().optional(),
    amount: z.number().int(),
    totalAmount: z.number().int().optional(),
    status: z.string(),


    state: z.string().optional(),
    createdAt: z.union([z.string(), z.date()]),
    updatedAt: z.union([z.string(), z.date()]).optional(),
    postingDeadline: z.string().nullable().optional(),
    submissionDeadline: z.string().nullable().optional(),
    maxRevisions: z.number().optional(),
    platformFee: z.number().optional(),
    gatewayFee: z.number().optional(),
    influencerPayout: z.number().optional(),
    productValue: z.number().optional(),
    productHandlingFee: z.number().optional(),
    requiresProduct: z.boolean().optional(),
    productFulfillmentStatus: z.string().nullable().optional(),
    productShipped: z.boolean().optional(),
    productReceived: z.boolean().optional(),
    trackingNumber: z.string().nullable().optional(),
    carrier: z.string().nullable().optional(),
    dispatchTrackingNumber: z.string().nullable().optional(),
    dispatchCarrier: z.string().nullable().optional(),
    dispatchedAt: z.union([z.string(), z.date()]).nullable().optional(),
    productReceivedAt: z.union([z.string(), z.date()]).nullable().optional(),
    shippingOrderId: z.string().nullable().optional(),
    shippingShipmentId: z.string().nullable().optional(),
    shippingAwbCode: z.string().nullable().optional(),
    shippingLabelUrl: z.string().nullable().optional(),
    shippingManifestUrl: z.string().nullable().optional(),
    shippingStatus: z.string().nullable().optional(),
    shippingCourierName: z.string().nullable().optional(),
    shippingTrackingHistory: z.unknown().optional(),
    postUrl: z.string().nullable().optional(),
    postVerified: z.boolean().optional(),
    postVerifiedAt: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),

    contractTerms: z.unknown().optional(),
    shippingAddress: z.unknown().optional(),
    contractSignature: z.unknown().optional(),
    campaign: z.object({
      id: z.string().optional(),
      title: z.string(),
      requirements: z.string().optional(),
      guidelines: z.string().nullable().optional(),
      deliverables: z.unknown().optional(),
      postingDeadline: z.union([z.string(), z.date()]).optional(),
    }),
    brand: z
      .object({
        id: z.string().optional(),
        companyName: z.string().nullable().optional(),
        logo: z.string().nullable().optional(),
        userId: z.string().optional(),
        isGstVerified: z.boolean().optional(),
        averageRating: z.number().optional(),
      })
      .optional(),
    influencer: z.object({
      id: z.string().optional(),
      displayName: z.string().nullable().optional(),
      avatar: z.string().nullable().optional(),
      userId: z.string().optional(),
      instagramHandle: z.string().nullable().optional(),
      averageRating: z.number().optional(),
    }),
    contentSubmissions: z.array(contentSubmissionItemSchema).optional(),
  })
  .catchall(z.unknown());

export type DealDetail = z.infer<typeof dealDetailSchema>;

/**
 * Single deal API response envelope schema (GET /api/deals/:id).
 */
export const singleDealResponseSchema = z.object({
  deal: dealDetailSchema,
  message: z.string().optional(),
  success: z.boolean().optional(),
});

export type SingleDealResponse = z.infer<typeof singleDealResponseSchema>;

