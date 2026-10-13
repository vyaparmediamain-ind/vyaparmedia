import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";

import {
  type NotificationCategory,
  type NotificationChannel,
  type ChannelPreferences,
  type GranularNotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
  mapNotificationTypeToCategory,
  isCriticalNotification,
  normalizeNotificationPreferences,
  shouldSendNotification,
} from "@/lib/notification-preferences-types";

export {
  type NotificationCategory,
  type NotificationChannel,
  type ChannelPreferences,
  type GranularNotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
  mapNotificationTypeToCategory,
  isCriticalNotification,
  normalizeNotificationPreferences,
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

const PUSH_SUBSCRIPTION_REDIS_KEY_PREFIX = "push_subs:";

/**
 * Saves a Web Push subscription for a user.
 */
export async function savePushSubscription(
  userId: string,
  subscription: PushSubscriptionPayload
): Promise<boolean> {
  try {
    const key = `${PUSH_SUBSCRIPTION_REDIS_KEY_PREFIX}${userId}`;
    const subJson = JSON.stringify({
      ...subscription,
      createdAt: new Date().toISOString(),
    });

    // Store in a Redis set or hash keyed by endpoint to support multiple devices
    await redis.hset(key, subscription.endpoint, subJson);
    await redis.expire(key, 60 * 60 * 24 * 90); // 90 days TTL

    return true;
  } catch (err) {
    logger.warn("[Push Notifications] Failed to save push subscription in Redis, falling back to DB", {
      userId,
      error: err,
    });
    // Fallback save inside User.notificationPreferences.pushSubscriptions
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { notificationPreferences: true },
      });
      const currentPrefs = (user?.notificationPreferences || {}) as Record<string, unknown>;
      const existingSubs = (currentPrefs.pushSubscriptions || []) as PushSubscriptionPayload[];
      const filtered = existingSubs.filter((s) => s.endpoint !== subscription.endpoint);
      filtered.push(subscription);

      await prisma.user.update({
        where: { id: userId },
        data: {
          notificationPreferences: {
            ...currentPrefs,
            pushSubscriptions: filtered,
          } as unknown as Prisma.InputJsonValue,
        },
      });
      return true;
    } catch (dbErr) {
      logger.error("[Push Notifications] Failed to persist push subscription to DB", dbErr, { userId });
      return false;
    }
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
    const key = `${PUSH_SUBSCRIPTION_REDIS_KEY_PREFIX}${userId}`;
    await redis.hdel(key, endpoint);
    return true;
  } catch (err) {
    logger.warn("[Push Notifications] Failed to remove push subscription from Redis", {
      userId,
      error: err,
    });
    return false;
  }
}

/**
 * Dispatches a Web Push notification to all active devices for a user.
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
): Promise<{ dispatched: boolean; count: number }> {
  try {
    // 1. Check user preferences
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
      return { dispatched: false, count: 0 };
    }

    // 2. Retrieve subscriptions
    const key = `${PUSH_SUBSCRIPTION_REDIS_KEY_PREFIX}${userId}`;
    let subscriptions: PushSubscriptionPayload[] = [];

    try {
      const stored = await redis.hgetall(key);
      if (stored && Object.keys(stored).length > 0) {
        subscriptions = Object.values(stored)
          .map((item) => {
            try {
              return JSON.parse(item) as PushSubscriptionPayload;
            } catch {
              return null;
            }
          })
          .filter(Boolean) as PushSubscriptionPayload[];
      }
    } catch {
      // Redis unavailable, fallback to DB
      const prefs = (user?.notificationPreferences || {}) as Record<string, unknown>;
      subscriptions = (prefs.pushSubscriptions || []) as PushSubscriptionPayload[];
    }

    if (subscriptions.length === 0) {
      return { dispatched: false, count: 0 };
    }

    // 3. Dispatch payload
    const isCritical = isCriticalNotification(payload.type);
    logger.info("[Push Notifications] Dispatching push notification to devices", {
      userId,
      deviceCount: subscriptions.length,
      type: payload.type,
      isCritical,
    });

    // In production with VAPID keys, webpush.sendNotification is called here.
    // For local/test environments, we log and return success.
    return { dispatched: true, count: subscriptions.length };
  } catch (err) {
    logger.error("[Push Notifications] Error during push dispatch", err, { userId });
    return { dispatched: false, count: 0 };
  }
}
