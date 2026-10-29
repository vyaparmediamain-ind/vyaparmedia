export type NotificationCategory =
  | "payments"
  | "deals"
  | "messages"
  | "disputes"
  | "security"
  | "system"
  | "marketing";

export type NotificationChannel = "push" | "email" | "inApp";

export interface ChannelPreferences {
  push: boolean;
  email: boolean;
  inApp: boolean;
}

export interface QuietHours {
  enabled: boolean;
  startHour: number; // 0-23
  endHour: number;   // 0-23
  timeZone?: string; // defaults to "Asia/Kolkata"
}

export const DEFAULT_QUIET_HOURS: QuietHours = {
  enabled: false,
  startHour: 22, // 10 PM
  endHour: 8,    // 8 AM
  timeZone: "Asia/Kolkata",
};

export type GranularNotificationPreferences = Record<NotificationCategory, ChannelPreferences>;

export const DEFAULT_NOTIFICATION_PREFERENCES: GranularNotificationPreferences = {
  payments: { push: true, email: true, inApp: true },
  deals: { push: true, email: true, inApp: true },
  messages: { push: true, email: false, inApp: true },
  disputes: { push: true, email: true, inApp: true },
  security: { push: true, email: true, inApp: true },
  system: { push: false, email: false, inApp: true },
  marketing: { push: false, email: true, inApp: true },
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

    case "marketing":
    case "promotional":
    case "newsletter":
    case "announcement":
    case "weekly_digest":
    case "blog_post":
      return "marketing";

    default:
      return "system";
  }
}

/**
 * Checks if a specific notification type is considered business-critical.
 * Critical events (payment received, deal accepted, dispute raised) require
 * priority push delivery even when quiet hours are active.
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
 * Checks if a notification type is marketing or promotional.
 */
export function isMarketingNotification(type: string): boolean {
  return mapNotificationTypeToCategory(type) === "marketing";
}

/**
 * Normalizes quiet hours configuration.
 */
export function normalizeQuietHours(input: unknown): QuietHours {
  if (!input || typeof input !== "object") {
    return { ...DEFAULT_QUIET_HOURS };
  }
  const q = input as Record<string, unknown>;
  const startHour = typeof q.startHour === "number" && q.startHour >= 0 && q.startHour <= 23 ? q.startHour : DEFAULT_QUIET_HOURS.startHour;
  const endHour = typeof q.endHour === "number" && q.endHour >= 0 && q.endHour <= 23 ? q.endHour : DEFAULT_QUIET_HOURS.endHour;
  const enabled = typeof q.enabled === "boolean" ? q.enabled : false;
  const timeZone = typeof q.timeZone === "string" && q.timeZone.trim() !== "" ? q.timeZone.trim() : "Asia/Kolkata";

  return { enabled, startHour, endHour, timeZone };
}

/**
 * Checks if quiet hours are currently active for the given date/time.
 */
export function isQuietHoursActive(
  quietHours?: QuietHours | null,
  date: Date = new Date(),
): boolean {
  if (!quietHours?.enabled) return false;

  const timeZone = quietHours.timeZone || "Asia/Kolkata";
  let hour: number;
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone,
    });
    const formatted = formatter.format(date);
    hour = Number.parseInt(formatted, 10) % 24;
  } catch {
    hour = date.getUTCHours();
  }

  const { startHour, endHour } = quietHours;
  if (startHour === endHour) return false;

  if (startHour > endHour) {
    // Spans midnight, e.g. 22:00 to 08:00
    return hour >= startHour || hour < endHour;
  }
  // Intra-day, e.g. 13:00 to 15:00
  return hour >= startHour && hour < endHour;
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
    "marketing",
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
 * according to the user's granular preferences and quiet hours.
 */
export function shouldSendNotification(
  preferences: unknown,
  type: string,
  channel: NotificationChannel,
  options?: { now?: Date }
): boolean {
  const normalized = normalizeNotificationPreferences(preferences);
  const category = mapNotificationTypeToCategory(type);
  const channelPrefs = normalized[category];

  if (channelPrefs && !channelPrefs[channel]) {
    return false;
  }

  // Quiet hours check for non-inApp channels (push, email)
  if (channel !== "inApp" && !isCriticalNotification(type)) {
    const rawPrefs = preferences && typeof preferences === "object" ? (preferences as Record<string, unknown>) : null;
    const quietHours = rawPrefs?.quietHours ? normalizeQuietHours(rawPrefs.quietHours) : undefined;
    if (isQuietHoursActive(quietHours, options?.now)) {
      return false;
    }
  }

  return true;
}
