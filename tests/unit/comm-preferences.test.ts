import { describe, it, expect } from "vitest";
import {
  mapNotificationTypeToCategory,
  isCriticalNotification,
  isMarketingNotification,
  isQuietHoursActive,
  normalizeQuietHours,
  normalizeNotificationPreferences,
  shouldSendNotification,
  DEFAULT_NOTIFICATION_PREFERENCES,
  GranularNotificationPreferences,
  QuietHours,
} from "@/lib/notification-preferences-types";

describe("COMM-PREF-01: Notification Preferences & Quiet Hours Security", () => {
  describe("Marketing vs Transactional Classification", () => {
    it("correctly identifies marketing/promotional notification types", () => {
      expect(isMarketingNotification("marketing")).toBe(true);
      expect(isMarketingNotification("promotional")).toBe(true);
      expect(isMarketingNotification("newsletter")).toBe(true);
      expect(isMarketingNotification("announcement")).toBe(true);
      expect(isMarketingNotification("weekly_digest")).toBe(true);
      expect(isMarketingNotification("blog_post")).toBe(true);
    });

    it("correctly identifies transactional/operational notification types as non-marketing", () => {
      expect(isMarketingNotification("payment")).toBe(false);
      expect(isMarketingNotification("payout")).toBe(false);
      expect(isMarketingNotification("deal_accepted")).toBe(false);
      expect(isMarketingNotification("dispute_raised")).toBe(false);
      expect(isMarketingNotification("security_alert")).toBe(false);
      expect(isMarketingNotification("new_message")).toBe(false);
    });

    it("maps marketing events to the marketing category", () => {
      expect(mapNotificationTypeToCategory("newsletter")).toBe("marketing");
      expect(mapNotificationTypeToCategory("promotional")).toBe("marketing");
    });
  });

  describe("Marketing Preferences Delivery Controls", () => {
    it("respects user setting disabling marketing emails while keeping transactional emails enabled", () => {
      const userPrefs: GranularNotificationPreferences = {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        marketing: { push: false, email: false, inApp: true }, // User opted out of marketing emails
        payments: { push: true, email: true, inApp: true },
      };

      // Marketing email should be suppressed
      expect(shouldSendNotification(userPrefs, "newsletter", "email")).toBe(false);
      // Marketing push should be suppressed
      expect(shouldSendNotification(userPrefs, "promotional", "push")).toBe(false);
      // Marketing in-app should still be allowed
      expect(shouldSendNotification(userPrefs, "promotional", "inApp")).toBe(true);

      // Transactional payment email should be delivered
      expect(shouldSendNotification(userPrefs, "payment", "email")).toBe(true);
      // Transactional payment push should be delivered
      expect(shouldSendNotification(userPrefs, "payment", "push")).toBe(true);
    });
  });

  describe("Quiet Hours Time Window Calculations", () => {
    it("returns false when quiet hours are disabled", () => {
      const quietHours: QuietHours = {
        enabled: false,
        startHour: 22,
        endHour: 8,
        timeZone: "Asia/Kolkata",
      };

      // Even at 23:00 IST, returns false if disabled
      const nightDate = new Date("2026-10-15T17:30:00.000Z"); // 23:00 IST
      expect(isQuietHoursActive(quietHours, nightDate)).toBe(false);
    });

    it("identifies active overnight quiet hours spanning midnight (22:00 to 08:00 IST)", () => {
      const quietHours: QuietHours = {
        enabled: true,
        startHour: 22,
        endHour: 8,
        timeZone: "Asia/Kolkata",
      };

      // 23:30 IST (18:00 UTC) -> should be active
      const lateNight = new Date("2026-10-15T18:00:00.000Z");
      expect(isQuietHoursActive(quietHours, lateNight)).toBe(true);

      // 04:00 IST (22:30 UTC previous day) -> should be active
      const earlyMorning = new Date("2026-10-15T22:30:00.000Z");
      expect(isQuietHoursActive(quietHours, earlyMorning)).toBe(true);

      // 14:00 IST (08:30 UTC) -> outside quiet hours, should be false
      const afternoon = new Date("2026-10-15T08:30:00.000Z");
      expect(isQuietHoursActive(quietHours, afternoon)).toBe(false);
    });

    it("normalizes malformed quiet hours inputs with safe defaults", () => {
      const normalized = normalizeQuietHours(null);
      expect(normalized.enabled).toBe(false);
      expect(normalized.startHour).toBe(22);
      expect(normalized.endHour).toBe(8);
      expect(normalized.timeZone).toBe("Asia/Kolkata");

      const partial = normalizeQuietHours({ enabled: true, startHour: 23 });
      expect(partial.enabled).toBe(true);
      expect(partial.startHour).toBe(23);
      expect(partial.endHour).toBe(8);
    });
  });

  describe("Quiet Hours Notification Suppression & Critical Bypass", () => {
    const preferencesWithQuietHours = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      quietHours: {
        enabled: true,
        startHour: 22,
        endHour: 8,
        timeZone: "Asia/Kolkata",
      },
    };

    // 23:00 IST is active quiet hours
    const activeQuietTime = new Date("2026-10-15T17:30:00.000Z");

    it("suppresses non-critical push notifications during active quiet hours", () => {
      // Direct message push suppressed during quiet hours
      expect(
        shouldSendNotification(preferencesWithQuietHours, "new_message", "push", {
          now: activeQuietTime,
        })
      ).toBe(false);

      // System update push suppressed during quiet hours
      expect(
        shouldSendNotification(preferencesWithQuietHours, "system", "push", {
          now: activeQuietTime,
        })
      ).toBe(false);

      // Marketing push suppressed during quiet hours
      expect(
        shouldSendNotification(preferencesWithQuietHours, "newsletter", "push", {
          now: activeQuietTime,
        })
      ).toBe(false);
    });

    it("NEVER suppresses in-app notifications during quiet hours (stored in inbox for morning)", () => {
      expect(
        shouldSendNotification(preferencesWithQuietHours, "new_message", "inApp", {
          now: activeQuietTime,
        })
      ).toBe(true);

      expect(
        shouldSendNotification(preferencesWithQuietHours, "deal_update", "inApp", {
          now: activeQuietTime,
        })
      ).toBe(true);
    });

    it("ALWAYS allows business-critical notifications (payment, dispute, security) to bypass quiet hours", () => {
      // Payment received must wake up user / alert immediately
      expect(
        shouldSendNotification(preferencesWithQuietHours, "payment", "push", {
          now: activeQuietTime,
        })
      ).toBe(true);

      // Payout released must alert immediately
      expect(
        shouldSendNotification(preferencesWithQuietHours, "payout", "push", {
          now: activeQuietTime,
        })
      ).toBe(true);

      // Dispute raised requires immediate attention
      expect(
        shouldSendNotification(preferencesWithQuietHours, "dispute_raised", "push", {
          now: activeQuietTime,
        })
      ).toBe(true);

      // Security alert (e.g. login from new device, password reset) must never be muted
      expect(
        shouldSendNotification(preferencesWithQuietHours, "security_alert", "push", {
          now: activeQuietTime,
        })
      ).toBe(true);
    });
  });
});
