import webpush from "web-push";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";
import prisma from "@/lib/db";
import { AppError } from "@/lib/errors";
import { env } from "@/env";

import {
  type NotificationCategory,
  type NotificationChannel,
  type ChannelPreferences,
  type GranularNotificationPreferences,
  type QuietHours,
  DEFAULT_NOTIFICATION_PREFERENCES,
  DEFAULT_QUIET_HOURS,
  mapNotificationTypeToCategory,
  isCriticalNotification,
  isMarketingNotification,
  normalizeNotificationPreferences,
  normalizeQuietHours,
  isQuietHoursActive,
  shouldSendNotification,
} from "@/lib/notification-preferences-types";

export {
  type NotificationCategory,
  type NotificationChannel,
  type ChannelPreferences,
  type GranularNotificationPreferences,
  type QuietHours,
  DEFAULT_NOTIFICATION_PREFERENCES,
  DEFAULT_QUIET_HOURS,
  mapNotificationTypeToCategory,
  isCriticalNotification,
  isMarketingNotification,
  normalizeNotificationPreferences,
  normalizeQuietHours,
  isQuietHoursActive,
  shouldSendNotification,
};

export interface PushSubscriptionPayload {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string | undefined;
  createdAt?: string | undefined;
}

export interface PushDispatchResult {
  dispatched: boolean;
  sent: number;
  failed: number;
  removed: number;
  count: number;
}

const PUSH_SUBSCRIPTION_REDIS_KEY_PREFIX = "push_subs:";

const ALLOWED_PUSH_DOMAINS = [
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "push.services.mozilla.com",
];

const ALLOWED_PUSH_SUFFIXES = [
  ".push.apple.com",
  ".notify.windows.com",
  ".wns.windows.com",
];

/**
 * Validates push endpoint hostname against trusted browser push provider allowlist to prevent SSRF.
 */
export function isPushEndpointAllowed(endpoint: string): boolean {
  if (!endpoint || typeof endpoint !== "string") return false;
  try {
    const parsed = new URL(endpoint);
    if (parsed.protocol !== "https:") return false;
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      /^(127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.)/.test(hostname)
    ) {
      return false;
    }
    if (ALLOWED_PUSH_DOMAINS.includes(hostname)) return true;
    if (ALLOWED_PUSH_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Throws AppError if push endpoint is not in the trusted vendor allowlist.
 */
export function validatePushEndpointAllowlist(endpoint: string): void {
  if (!isPushEndpointAllowed(endpoint)) {
    throw AppError.badRequest("Untrusted push service endpoint URL. Must match trusted push vendor.");
  }
}

let vapidConfigured = false;
export function configureVapid(): boolean {
  if (vapidConfigured) return true;
  const publicKey =
    process.env.VAPID_PUBLIC_KEY ||
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    env.VAPID_PUBLIC_KEY ||
    env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY || env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || env.VAPID_SUBJECT || "mailto:security@vyaparmedia.in";

  if (!publicKey || !privateKey) {
    return false;
  }
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidConfigured = true;
    return true;
  } catch (err) {
    logger.warn("[Push Notifications] Failed to configure VAPID credentials", { error: err });
    return false;
  }
}

/**
 * Saves a Web Push subscription for a user.
 * Enforces SSRF allowlist and a maximum of 5 active device subscriptions per user.
 */
export async function savePushSubscription(
  userId: string,
  subscription: PushSubscriptionPayload
): Promise<boolean> {
  validatePushEndpointAllowlist(subscription.endpoint);

  try {
    // 1. Enforce max 5 subscriptions per user (FIFO prune oldest if >= 5)
    const count = await prisma.pushSubscription.count({ where: { userId } });
    if (count >= 5) {
      const excess = count - 4;
      const oldest = await prisma.pushSubscription.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        take: excess,
        select: { id: true },
      });
      if (oldest.length > 0) {
        await prisma.pushSubscription.deleteMany({
          where: { id: { in: oldest.map((s) => s.id) } },
        });
      }
    }

    // 2. Upsert subscription in dedicated table
    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: subscription.userAgent || null,
        lastSeen: new Date(),
      },
      update: {
        userId,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: subscription.userAgent || null,
        lastSeen: new Date(),
      },
    });

    // 3. Mirror in Redis fast cache
    const key = `${PUSH_SUBSCRIPTION_REDIS_KEY_PREFIX}${userId}`;
    await redis.hset(key, subscription.endpoint, JSON.stringify(subscription)).catch(() => {});
    await redis.expire(key, 86400 * 90).catch(() => {});

    return true;
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error("[Push Notifications] Failed to persist push subscription", err, { userId });
    throw AppError.internal("Failed to save push subscription");
  }
}

/**
 * Removes a Web Push subscription for a user.
 */
export async function removePushSubscription(
  userId: string,
  endpoint: string
): Promise<boolean> {
  try {
    await prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
    const key = `${PUSH_SUBSCRIPTION_REDIS_KEY_PREFIX}${userId}`;
    await redis.hdel(key, endpoint).catch(() => {});
    return true;
  } catch (err) {
    logger.warn("[Push Notifications] Failed to remove push subscription", {
      userId,
      error: err,
    });
    return false;
  }
}

/**
 * Dispatches a Web Push notification to all active devices for a user.
 * Returns honest delivery counts: { dispatched, sent, failed, removed, count }
 */
export async function dispatchPushNotification(
  userId: string,
  payload: {
    title: string;
    message: string;
    type: string;
    url?: string | undefined;
    dealId?: string | undefined;
    data?: Record<string, unknown> | undefined;
  }
): Promise<PushDispatchResult> {
  const result: PushDispatchResult = {
    dispatched: false,
    sent: 0,
    failed: 0,
    removed: 0,
    count: 0,
  };

  try {
    // 1. Check user preferences & quiet hours
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPreferences: true },
    });

    const isAllowed = shouldSendNotification(
      user?.notificationPreferences,
      payload.type,
      "push"
    );

    if (!isAllowed) {
      logger.info("[Push Notifications] Notification suppressed by user preferences", {
        userId,
        type: payload.type,
      });
      return result;
    }

    // 2. Fetch active subscriptions from DB
    const dbSubs = await prisma.pushSubscription.findMany({
      where: { userId },
    });

    if (dbSubs.length === 0) {
      return result;
    }

    result.count = dbSubs.length;

    // 3. Configure VAPID
    const isVapidReady = configureVapid();
    if (!isVapidReady) {
      logger.warn("[Push Notifications] VAPID keys not configured; logging simulated dispatch", {
        userId,
        deviceCount: dbSubs.length,
      });
      return result;
    }

    const isCritical = isCriticalNotification(payload.type);
    const ttl = isCritical ? 86400 : 43200; // 24h critical, 12h normal
    const urgency = isCritical ? "high" : "normal";

    const pushData = JSON.stringify({
      title: payload.title,
      message: payload.message,
      type: payload.type,
      url: payload.url,
      dealId: payload.dealId,
      data: payload.data,
      timestamp: Date.now(),
    });

    // 4. Send per subscription with try/catch
    for (const sub of dbSubs) {
      if (!isPushEndpointAllowed(sub.endpoint)) {
        // Untrusted endpoint found in DB - prune immediately
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        result.removed++;
        continue;
      }

      const pushSub: webpush.PushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webpush.sendNotification(pushSub, pushData, {
          TTL: ttl,
          urgency,
        });
        result.sent++;
      } catch (pushErr: unknown) {
        const statusCode = (pushErr as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Expired or revoked subscription -> delete from DB
          logger.info("[Push Notifications] Stale subscription expired (404/410), removing", {
            userId,
            endpoint: sub.endpoint,
          });
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
          const key = `${PUSH_SUBSCRIPTION_REDIS_KEY_PREFIX}${userId}`;
          await redis.hdel(key, sub.endpoint).catch(() => {});
          result.removed++;
        } else {
          logger.warn("[Push Notifications] Failed to send push notification to device", {
            userId,
            statusCode,
            error: pushErr instanceof Error ? pushErr.message : String(pushErr),
          });
          result.failed++;
        }
      }
    }

    result.dispatched = result.sent > 0;
    return result;
  } catch (err) {
    logger.error("[Push Notifications] Error during push dispatch", err, { userId });
    return result;
  }
}
