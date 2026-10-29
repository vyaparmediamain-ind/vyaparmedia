import { z } from "zod";

/**
 * Standardized campaign application schema for influencer & brand dashboards.
 */
export const applicationItemSchema = z.object({
  id: z.string(),
  status: z.string(),
  proposedRate: z.number().int().min(0),
  finalRate: z.number().int().nullable().optional(),
  dealId: z.string().nullable().optional(),
  rejectionReason: z.string().nullable().optional(),
  createdAt: z.union([z.string(), z.date()]).transform((val) =>
    typeof val === "string" ? val : val.toISOString()
  ),
  campaign: z.object({
    id: z.string(),
    title: z.string(),
    perInfluencerBudget: z.number().int().default(0),
    brand: z
      .object({
        companyName: z.string(),
        logo: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
  }),
  matchScore: z.number().optional(),
  matchBreakdown: z.record(z.string(), z.any()).nullable().optional(),
  dealStatus: z.string().nullable().optional(),
});

export type ApplicationItem = z.infer<typeof applicationItemSchema>;

/**
 * Output shape for GET /api/campaigns/applications or /api/applications
 */
export const applicationsResponseSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
  data: z
    .object({
      applications: z.array(applicationItemSchema).default([]),
      totalPages: z.number().int().optional(),
    })
    .optional(),
  applications: z.array(applicationItemSchema).optional(),
  totalPages: z.number().int().optional(),
});

export type ApplicationsResponse = z.infer<typeof applicationsResponseSchema>;
