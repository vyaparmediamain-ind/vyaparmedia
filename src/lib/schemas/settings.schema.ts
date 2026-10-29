import { z } from "zod";

/**
 * Standardized notification item schema.
 */
export const notificationItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: z.string(),
  title: z.string(),
  message: z.string(),
  isRead: z.boolean().default(false),
  data: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.union([z.string(), z.date()]).transform((val) =>
    typeof val === "string" ? val : val.toISOString()
  ),
});

export type NotificationItem = z.infer<typeof notificationItemSchema>;

/**
 * GET /api/notifications response schema.
 */
export const notificationsResponseSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
  notifications: z.array(notificationItemSchema).default([]),
  unreadCount: z.number().int().default(0),
  pagination: z
    .object({
      page: z.number().int().optional(),
      limit: z.number().int().optional(),
      total: z.number().int().optional(),
      totalPages: z.number().int().optional(),
    })
    .optional(),
});

export type NotificationsResponse = z.infer<typeof notificationsResponseSchema>;

/**
 * GET /api/settings response schema.
 */
export const userSettingsResponseSchema = z
  .object({
    success: z.boolean().optional(),
    message: z.string().optional(),
    user: z
      .object({
        id: z.string().optional(),
        name: z.string().nullable().optional(),
        email: z.string().nullable().optional(),
        phone: z.string().nullable().optional(),
        isTwoFactorEnabled: z.boolean().optional(),
        isEmailVerified: z.boolean().optional(),
        isPhoneVerified: z.boolean().optional(),
      })
      .catchall(z.unknown())
      .optional(),
  })
  .catchall(z.unknown());

export type UserSettingsResponse = z.infer<typeof userSettingsResponseSchema>;

/**
 * Login Activity item schema.
 */
export const loginActivityItemSchema = z
  .object({
    id: z.string().optional(),
    device: z.string().default("Unknown device"),
    browser: z.string().optional(),
    os: z.string().optional(),
    ipAddress: z.string().optional(),
    location: z.string().default("Unknown location"),
    lastActive: z.union([z.string(), z.date()]).optional(),
    time: z.string().optional(),
    success: z.boolean().optional(),
    active: z.boolean().optional(),
    current: z.boolean().optional(),
  })
  .catchall(z.unknown());

export type LoginActivityItem = z.infer<typeof loginActivityItemSchema>;

/**
 * GET /api/user/activity response schema.
 */
export const loginActivityResponseSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
  activity: z.array(loginActivityItemSchema).default([]),
});

export type LoginActivityResponse = z.infer<typeof loginActivityResponseSchema>;

