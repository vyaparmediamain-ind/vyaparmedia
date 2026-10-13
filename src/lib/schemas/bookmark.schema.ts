import { z } from "zod";

/**
 * Bookmark toggle action request schema.
 */
export const bookmarkRequestSchema = z.object({
  targetId: z.string().min(1, "Target ID is required"),
  targetType: z.enum(["campaign", "creator", "deal"]),
  isSaved: z.boolean(),
});

export type BookmarkRequest = z.infer<typeof bookmarkRequestSchema>;

/**
 * Bookmark API response schema.
 */
export const bookmarkResponseSchema = z.object({
  success: z.boolean(),
  savedIds: z.array(z.string()).optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export type BookmarkResponse = z.infer<typeof bookmarkResponseSchema>;
