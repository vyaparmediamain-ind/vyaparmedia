import { z } from "zod";

/**
 * Standard pagination query parameters schema.
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().trim().optional(),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/**
 * Standard cursor & offset pagination metadata schema.
 */
export const paginationMetaSchema = z.object({
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).optional(),
  total: z.number().int().min(0).optional(),
  totalPages: z.number().int().min(0).optional(),
  nextCursor: z.string().nullable().optional(),
  hasMore: z.boolean().default(false),
});

export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

/**
 * Standard Cursor-based Page Response wrapper schema for infinite feeds.
 */
export function createCursorPageSchema<TItemSchema extends z.ZodTypeAny>(itemSchema: TItemSchema) {
  return z.object({
    items: z.array(itemSchema),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
    total: z.number().int().optional(),
  });
}

/**
 * Standard enterprise ApiResponse envelope schema.
 */
export function createApiResponseSchema<TDataSchema extends z.ZodTypeAny>(dataSchema: TDataSchema) {
  return z.object({
    success: z.boolean(),
    message: z.string().optional(),
    data: dataSchema,
  });
}
