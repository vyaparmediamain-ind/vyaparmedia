import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";
import { dispatchPushNotification } from "@/lib/push-notifications";

type NotificationType =
| "deal_update"
| "payment"
| "payout"
| "review"
| "kyc"
| "verification"
| "challenge"
| "referral"
| "security_alert"
| "dispute"
| "system"
| "referral_tier_up"
| "referral_bonus"
| "new_message"
| "system_warning"
| "admin_alert"
| "alert"
| "ledger_drift"
| "contact_violation"
| "trust_warning"
| "badge"
| "verification_update";

export class NotificationService {
  static async listNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, Math.min(100, limit));

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });

    // Fast-path: If on page 1 and count < limit, total and unreadCount are known in memory!
    // This avoids 2 redundant remote DB network roundtrips.
    if (safePage === 1 && notifications.length < safeLimit) {
      const unreadCount = notifications.filter((n) => !n.isRead).length;
      return { notifications, total: notifications.length, unreadCount };
    }

    const notificationGroups = await prisma.notification.groupBy({
      by: ["isRead"],
      where: { userId },
      _count: { _all: true },
    });

    let total = 0;
    let unreadCount = 0;
    for (const g of notificationGroups) {
      total += g._count._all;
      if (!g.isRead) {
        unreadCount += g._count._all;
      }
    }

    return { notifications, total, unreadCount };
  }

static async markAsRead(userId: string, notificationIds?: string[]) {
const where: Prisma.NotificationWhereInput = { userId, isRead: false };

if (notificationIds && notificationIds.length > 0) {
where.id = { in: notificationIds };
}

await prisma.notification.updateMany({
where,
data: { isRead: true },
});

return { success: true };
}

// Internal use for system events
static async createNotification(
  data: {
    userId: string;
    type: NotificationType | (string & {});
    title: string;
    message: string;
    data?: Record<string, unknown>;
  },
  _tx?: Prisma.TransactionClient
) {
  const client = _tx || prisma;
  try {
    const created = await client.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        data: (data.data || {}) as Prisma.InputJsonValue,
      },
    });

    // Asynchronously dispatch push notification to user's registered devices
    dispatchPushNotification(data.userId, {
      title: data.title,
      message: data.message,
      type: data.type,
      data: data.data,
    }).catch((pushErr) => {
      logger.warn("[Notification Service] Non-blocking push notification dispatch failed", {
        userId: data.userId,
        error: pushErr,
      });
    });

    return created;
  } catch (error) {
    logger.error("[Notification Service] Failed to create notification", error, { data });
    return null;
  }
}

// Support for batch notification creation (createMany)
static async createNotifications(
  data: Array<{
    userId: string;
    type: NotificationType | (string & {});
    title: string;
    message: string;
    data?: Record<string, unknown>;
  }>,
  _tx?: Prisma.TransactionClient
) {
  if (!data || data.length === 0) {
    return { count: 0 };
  }
  const client = _tx || prisma;
  try {
    return await client.notification.createMany({
      data: data.map((n) => ({
        userId: n.userId,
        type: n.type,
        title: n.title,
        message: n.message,
        data: (n.data || {}) as Prisma.InputJsonValue,
      })),
    });
  } catch (error) {
    logger.error("[Notification Service] Failed to create batch notifications", error, { count: data.length });
    return null;
  }
}
}
