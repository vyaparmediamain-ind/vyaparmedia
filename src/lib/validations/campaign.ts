/**
 * Re-exports from canonical validation module @/lib/validations
 * Maintains backward compatibility for consumers of @/lib/validations/campaign
 */
export {
  campaignFormSchema as createCampaignSchema,
  createDisputeSchema,
  createSupportSchema,
} from "@/lib/validations";
