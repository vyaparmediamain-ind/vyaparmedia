import { z } from "zod";
import { disputeSchema, disputeEvidenceSchema } from "@/lib/validations";

export { disputeSchema, disputeEvidenceSchema };
export type CreateDisputeInput = z.infer<typeof disputeSchema>;
export type DisputeEvidenceInput = z.infer<typeof disputeEvidenceSchema>;

/**
 * Standardized dispute item for user & admin dashboards.
 * Amount is in integer paise.
 */
export const disputeItemSchema = z
  .object({
    id: z.string(),
    status: z.string(),
    type: z.string(),
    description: z.string(),
    createdAt: z.union([z.string(), z.date()]).transform((val) =>
      typeof val === "string" ? val : val.toISOString()
    ),
    deal: z.object({
      id: z.string(),
      amount: z.number().int(),
      totalAmount: z.number().int().optional(),
      campaign: z.object({ title: z.string() }),

      influencer: z
        .object({
          displayName: z.string().nullable().optional(),
          name: z.string().nullable().optional(),
        })
        .optional(),
      brand: z
        .object({
          companyName: z.string().nullable().optional(),
          name: z.string().nullable().optional(),
        })
        .optional(),
    }),
  })
  .catchall(z.unknown());

export type DisputeItem = z.infer<typeof disputeItemSchema>;

/**
 * GET /api/disputes response schema.
 */
export const disputesResponseSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
  disputes: z.array(disputeItemSchema).default([]),
});

export type DisputesResponse = z.infer<typeof disputesResponseSchema>;
