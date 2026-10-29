import { isToday, differenceInDays, parseISO } from "date-fns";
import { formatRelativeTime } from "@/lib/utils-client";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string | Date;
  data?: Record<string, unknown> | null | undefined;
}

export type RecencyGroup = "Today" | "Earlier this week" | "Older";

export interface GroupedNotifications {
  today: NotificationItem[];
  thisWeek: NotificationItem[];
  older: NotificationItem[];
}

/**
 * Groups an array of notifications into Instagram Activity-style recency buckets:
 * - "Today"
 * - "Earlier this week"
 * - "Older"
 */
export function groupNotificationsByRecency(
  notifications: NotificationItem[]
): GroupedNotifications {
  const result: GroupedNotifications = {
    today: [],
    thisWeek: [],
    older: [],
  };

  const now = new Date();

  for (const item of notifications) {
    const date = typeof item.createdAt === "string" ? parseISO(item.createdAt) : item.createdAt;

    if (isNaN(date.getTime())) {
      result.older.push(item);
      continue;
    }

    if (isToday(date)) {
      result.today.push(item);
    } else {
      const daysDiff = differenceInDays(now, date);
      if (daysDiff <= 7) {
        result.thisWeek.push(item);
      } else {
        result.older.push(item);
      }
    }
  }

  return result;
}


/**
 * Formats a notification timestamp to a compact, human-readable string.
 * Example: "Just now", "5m ago", "2h ago", "Yesterday", "3d ago".
 */
export function formatNotificationTime(createdAt: string | Date): string {
  return formatRelativeTime(createdAt);
}

export interface NotificationTypeMeta {
  category: "payment" | "deal" | "message" | "dispute" | "security" | "system";
  badgeBg: string;
  textColor: string;
  borderColor: string;
  iconName: "wallet" | "briefcase" | "message" | "shield-alert" | "star" | "bell" | "badge";
  label: string;
}

/**
 * Returns type-specific styling, icon names, and labels for notifications.
 */
export function getNotificationTypeMeta(type: string): NotificationTypeMeta {
  switch (type) {
    case "payment":
    case "payout":
    case "referral_bonus":
    case "ledger_drift":
      return {
        category: "payment",
        badgeBg: "bg-emerald-500/10 dark:bg-emerald-500/20",
        textColor: "text-emerald-600 dark:text-emerald-400",
        borderColor: "border-emerald-500/30",
        iconName: "wallet",
        label: "Payment",
      };

    case "deal_update":
    case "deal_accepted":
    case "content_submitted":
    case "content_approved":
    case "content_rejected":
    case "challenge":
      return {
        category: "deal",
        badgeBg: "bg-blue-500/10 dark:bg-blue-500/20",
        textColor: "text-blue-600 dark:text-blue-400",
        borderColor: "border-blue-500/30",
        iconName: "briefcase",
        label: "Deal Update",
      };

    case "new_message":
    case "chat":
      return {
        category: "message",
        badgeBg: "bg-purple-500/10 dark:bg-purple-500/20",
        textColor: "text-purple-600 dark:text-purple-400",
        borderColor: "border-purple-500/30",
        iconName: "message",
        label: "Message",
      };

    case "dispute":
    case "dispute_raised":
    case "dispute_resolved":
      return {
        category: "dispute",
        badgeBg: "bg-rose-500/10 dark:bg-rose-500/20",
        textColor: "text-rose-600 dark:text-rose-400",
        borderColor: "border-rose-500/30",
        iconName: "shield-alert",
        label: "Dispute",
      };

    case "review":
      return {
        category: "deal",
        badgeBg: "bg-amber-500/10 dark:bg-amber-500/20",
        textColor: "text-amber-600 dark:text-amber-400",
        borderColor: "border-amber-500/30",
        iconName: "star",
        label: "Review",
      };

    case "kyc":
    case "verification":
    case "verification_update":
    case "security_alert":
    case "contact_violation":
    case "trust_warning":
      return {
        category: "security",
        badgeBg: "bg-amber-500/10 dark:bg-amber-500/20",
        textColor: "text-amber-600 dark:text-amber-400",
        borderColor: "border-amber-500/30",
        iconName: "badge",
        label: "Security & Trust",
      };

    default:
      return {
        category: "system",
        badgeBg: "bg-muted",
        textColor: "text-muted-foreground",
        borderColor: "border-border",
        iconName: "bell",
        label: "Notification",
      };
  }
}

/**
 * Resolves the destination URL for tapping a notification.
 */
export function getNotificationHref(notif: NotificationItem): string {
  const data = (notif.data || {}) as Record<string, unknown>;

  // Direct explicit URL if provided
  if (typeof data.url === "string" && data.url.startsWith("/")) {
    return data.url;
  }

  // Deal-specific notifications
  if (data.dealId) {
    if (notif.type === "new_message") {
      return `/dashboard/messages?dealId=${data.dealId}`;
    }
    return `/dashboard/deals/${data.dealId}`;
  }

  // Campaign-specific notifications
  if (data.campaignId) {
    return `/dashboard/campaigns/${data.campaignId}`;
  }

  // Dispute-specific notifications
  if (data.disputeId) {
    return `/dashboard/disputes?id=${data.disputeId}`;
  }

  // Type-based fallbacks
  switch (notif.type) {
    case "payment":
    case "payout":
    case "referral_bonus":
    case "ledger_drift":
      return "/dashboard/wallet";

    case "new_message":
      return "/dashboard/messages";

    case "dispute":
    case "dispute_raised":
    case "dispute_resolved":
      return "/dashboard/disputes";

    case "kyc":
    case "verification":
    case "verification_update":
      return "/dashboard/settings?tab=verification";

    case "review":
      return "/dashboard/settings?tab=profile";

    case "deal_update":
    case "deal_accepted":
      return "/dashboard/deals";

    default:
      return "/dashboard/notifications";
  }
}
