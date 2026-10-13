/**
 * apiClient.settings — Settings, preferences, and compliance API calls.
 */
import { get, post, patch, put } from "./http";
import type { HttpOptions } from "./http";
import {
  notificationsResponseSchema,
  userSettingsResponseSchema,
  type NotificationsResponse,
  type UserSettingsResponse,
} from "@/lib/schemas";

/** GET /api/settings — fetch full user settings (validated against userSettingsResponseSchema) */
export function get_(options?: HttpOptions): Promise<UserSettingsResponse> {
  return get<UserSettingsResponse>("/api/settings", {
    schema: userSettingsResponseSchema,
    ...options,
  });
}

/** PUT /api/settings — save profile/account settings */
export function save(data: unknown, options?: HttpOptions) {
  return put("/api/settings", data, options);
}

/** GET /api/notifications — list user notifications (validated against notificationsResponseSchema) */
export function getNotifications(
  params: { limit?: number; page?: number } = {},
  options?: HttpOptions,
): Promise<NotificationsResponse> {
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  ).toString();
  return get<NotificationsResponse>(`/api/notifications${qs ? `?${qs}` : ""}`, {
    schema: notificationsResponseSchema,
    ...options,
  });
}


/** POST /api/notifications — mark notifications as read */
export function markNotificationsAsRead(
  data: { notificationIds?: string[]; markAll?: boolean },
  options?: HttpOptions,
) {
  return post("/api/notifications", data, options);
}

/** GET /api/notifications/preferences */
export function getNotificationPrefs(options?: HttpOptions) {
  return get("/api/notifications/preferences", options);
}

/** PATCH /api/notifications/preferences */
export function saveNotificationPrefs(
  data: Record<string, unknown>,
  options?: HttpOptions,
) {
  return patch("/api/notifications/preferences", data, options);
}

/** POST /api/notifications/push-subscription — register push subscription */
export function savePushSubscription(
  data: Record<string, unknown>,
  options?: HttpOptions,
) {
  return post("/api/notifications/push-subscription", data, options);
}


/** GET /api/compliance/india-tax */
export function getComplianceInfo(options?: HttpOptions) {
  return get("/api/compliance/india-tax", options);
}

/** Alias for getComplianceInfo */
export const getIndiaTaxCompliance = getComplianceInfo;

/** PUT /api/compliance/india-tax */
export function saveComplianceInfo(
  data: Record<string, unknown>,
  options?: HttpOptions,
) {
  return put("/api/compliance/india-tax", data, options);
}

/** POST /api/disputes */
export function createDispute(
  data: Record<string, unknown>,
  options?: HttpOptions,
) {
  return post("/api/disputes", data, options);
}

/** PATCH /api/disputes */
export function patchDispute(
  data: Record<string, unknown>,
  options?: HttpOptions,
) {
  return patch("/api/disputes", data, options);
}

/** POST /api/reviews */
export function submitReview(
  data: Record<string, unknown>,
  options?: HttpOptions,
) {
  return post("/api/reviews", data, options);
}

/** POST /api/blog/subscribe */
export function blogSubscribe(
  data: { email: string },
  options?: HttpOptions,
) {
  return post("/api/blog/subscribe", data, options);
}

