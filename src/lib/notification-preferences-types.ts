export type NotificationCategory =
  | "payments"
  | "deals"
  | "messages"
  | "disputes"
  | "security"
  | "system";

export type NotificationChannel = "push" | "email" | "inApp";

export interface ChannelPreferences {
  push: boolean;
  email: boolean;
  inApp: boolean;
}

export type GranularNotificationPreferences = Record<NotificationCategory, ChannelPreferences>;

export const DEFAULT_NOTIFICATION_PREFERENCES: GranularNotificationPreferences = {
  payments: { push: true, email: true, inApp: true },
  deals: { push: true, email: true, inApp: true },
  messages: { push: true, email: false, inApp: true },
  disputes: { push: true, email: true, inApp: true },
  security: { push: true, email: true, inApp: true },
  system: { push: false, email: false, inApp: true },
};

/**
 * Maps a Notification `type` to its higher-level business category.
 */
export function mapNotificationTypeToCategory(type: string): NotificationCategory {
  switch (type) {
    case "payment":
    case "payout":
    case "referral_bonus":
    case "ledger_drift":
      return "payments";

    case "deal_update":
    case "deal_accepted":
    case "content_submitted":
    case "content_approved":
    case "content_rejected":
    case "challenge":
    case "review":
      return "deals";

    case "new_message":
    case "chat":
      return "messages";

    case "dispute":
    case "dispute_raised":
    case "dispute_resolved":
      return "disputes";

    case "security_alert":
    case "admin_alert":
    case "system_warning":
    case "contact_violation":
    case "trust_warning":
    case "kyc":
    case "verification":
    case "verification_update":
      return "security";

    default:
      return "system";
  }
}

/**
 * Checks if a specific notification type is considered business-critical.
 * Critical events (payment received, deal accepted, dispute raised) require
 * priority push delivery even when the app is closed.
 */
export function isCriticalNotification(type: string): boolean {
  return [
    "payment",
    "payout",
    "deal_accepted",
    "dispute",
    "dispute_raised",
    "security_alert",
  ].includes(type);
}

/**
 * Normalizes unknown/partial user preferences to the full GranularNotificationPreferences object.
 */
export function normalizeNotificationPreferences(
  input: unknown
): GranularNotificationPreferences {
  if (!input || typeof input !== "object") {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }

  const record = input as Record<string, unknown>;
  const result = { ...DEFAULT_NOTIFICATION_PREFERENCES };

  const categories: NotificationCategory[] = [
    "payments",
    "deals",
    "messages",
    "disputes",
    "security",
    "system",
  ];

  for (const cat of categories) {
    const catVal = record[cat];
    if (catVal && typeof catVal === "object") {
      const c = catVal as Record<string, unknown>;
      result[cat] = {
        push: typeof c.push === "boolean" ? c.push : DEFAULT_NOTIFICATION_PREFERENCES[cat].push,
        email: typeof c.email === "boolean" ? c.email : DEFAULT_NOTIFICATION_PREFERENCES[cat].email,
        inApp: typeof c.inApp === "boolean" ? c.inApp : DEFAULT_NOTIFICATION_PREFERENCES[cat].inApp,
      };
    }
  }

  return result;
}

/**
 * Checks whether a notification should be delivered to the specified channel
 * according to the user's granular preferences.
 */
export function shouldSendNotification(
  preferences: unknown,
  type: string,
  channel: NotificationChannel
): boolean {
  const normalized = normalizeNotificationPreferences(preferences);
  const category = mapNotificationTypeToCategory(type);
  const channelPrefs = normalized[category];

  if (!channelPrefs) {
    return true;
  }

  return Boolean(channelPrefs[channel]);
}
