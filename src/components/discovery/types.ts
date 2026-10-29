import { z } from "zod";
import type {
  CampaignDiscoveryItem,
  CreatorDiscoveryItem,
} from "@/lib/schemas";

export type { CampaignDiscoveryItem, CreatorDiscoveryItem };

export type DiscoveryMode = "campaigns" | "creators";

export const discoveryFiltersSchema = z.object({
  niche: z.string().optional(),
  minBudget: z.number().optional(),
  maxBudget: z.number().optional(),
  minFollowers: z.number().optional(),
  maxFollowers: z.number().optional(),
  city: z.string().optional(),
  sortBy: z
    .enum(["relevance", "budget", "rate", "followers", "rating", "recency"])
    .optional(),
});

export type DiscoveryFilters = z.infer<typeof discoveryFiltersSchema>;

export interface CursorPageResponse<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
  total?: number | undefined;
}
