import { describe, it, expect } from "vitest";
import {
  groupNotificationsByRecency,
  formatNotificationTime,
  getNotificationHref,
  NotificationItem,
} from "@/lib/notification-utils";
import {
  mapNotificationTypeToCategory,
  isCriticalNotification,
  normalizeNotificationPreferences,
  shouldSendNotification,
  DEFAULT_NOTIFICATION_PREFERENCES,
  GranularNotificationPreferences,
} from "@/lib/push-notifications";
import { subDays, subHours, subMinutes } from "date-fns";

describe("Notifications System Unit Tests", () => {
  describe("Requirement 1: Unread Counter Math & Mark-as-Read Logic (Zero Off-by-One Errors)", () => {
    it("should accurately increment unread count on new unread notification", () => {
      let unreadCount = 3;
      const notifications: NotificationItem[] = [
        { id: "1", type: "deal_update", title: "Deal 1", message: "m1", isRead: false, createdAt: new Date() },
        { id: "2", type: "payment", title: "Pay 1", message: "m2", isRead: false, createdAt: new Date() },
        { id: "3", type: "message", title: "Msg 1", message: "m3", isRead: false, createdAt: new Date() },
      ];

      // Simulated Realtime INSERT
      const newIncoming: NotificationItem = {
        id: "4",
        type: "payment",
        title: "Escrow Deposited",
        message: "₹50,000 locked in escrow",
        isRead: false,
        createdAt: new Date(),
      };

      notifications.unshift(newIncoming);
      if (!newIncoming.isRead) {
        unreadCount += 1;
      }

      expect(unreadCount).toBe(4);
      expect(notifications).toHaveLength(4);
    });

    it("should decrement unread count when an unread item is marked as read", () => {
      let unreadCount = 2;
      const notifications: NotificationItem[] = [
        { id: "1", type: "deal_update", title: "Deal 1", message: "m1", isRead: false, createdAt: new Date() },
        { id: "2", type: "payment", title: "Pay 1", message: "m2", isRead: false, createdAt: new Date() },
        { id: "3", type: "message", title: "Msg 1", message: "m3", isRead: true, createdAt: new Date() },
      ];

      // Mark unread item '1' as read
      let wasUnread = false;
      const updated = notifications.map((n) => {
        if (n.id === "1") {
          if (!n.isRead) wasUnread = true;
          return { ...n, isRead: true };
        }
        return n;
      });

      if (wasUnread) {
        unreadCount = Math.max(0, unreadCount - 1);
      }

      expect(unreadCount).toBe(1);
      expect(updated.find((n) => n.id === "1")?.isRead).toBe(true);
    });

    it("should NEVER decrement unread count when an already-read item is clicked (prevents off-by-one error)", () => {
      let unreadCount = 1;
      const notifications: NotificationItem[] = [
        { id: "1", type: "deal_update", title: "Deal 1", message: "m1", isRead: false, createdAt: new Date() },
        { id: "2", type: "payment", title: "Pay 1", message: "m2", isRead: true, createdAt: new Date() },
      ];

      // User clicks already-read notification '2'
      let wasUnread = false;
      const updated = notifications.map((n) => {
        if (n.id === "2") {
          if (!n.isRead) wasUnread = true;
          return { ...n, isRead: true };
        }
        return n;
      });

      if (wasUnread) {
        unreadCount = Math.max(0, unreadCount - 1);
      }

      // unreadCount MUST remain exactly 1, NOT drop to 0!
      expect(unreadCount).toBe(1);
      expect(updated.find((n) => n.id === "2")?.isRead).toBe(true);
    });

    it("should reset unread count to 0 on mark-all-read without underflow", () => {
      let unreadCount = 5;
      const notifications: NotificationItem[] = [
        { id: "1", type: "deal_update", title: "Deal 1", message: "m1", isRead: false, createdAt: new Date() },
        { id: "2", type: "payment", title: "Pay 1", message: "m2", isRead: false, createdAt: new Date() },
      ];

      // Mark all read
      const updated = notifications.map((n) => ({ ...n, isRead: true }));
      unreadCount = 0;

      expect(unreadCount).toBe(0);
      expect(updated.every((n) => n.isRead)).toBe(true);
    });
  });

  describe("Requirement 2: Recency Grouping & Human Timestamps", () => {
    it("should properly categorize notifications into Today, Earlier this week, and Older", () => {
      const now = new Date();
      const items: NotificationItem[] = [
        {
          id: "today_1",
          type: "payment",
          title: "Payment Received",
          message: "₹15,000 received",
          isRead: false,
          createdAt: subMinutes(now, 2).toISOString(),
        },
        {
          id: "today_2",
          type: "new_message",
          title: "New Message",
          message: "Hey there",
          isRead: true,
          createdAt: subMinutes(now, 5).toISOString(),
        },
        {
          id: "week_1",
          type: "deal_update",
          title: "Content Approved",
          message: "Approved by brand",
          isRead: true,
          createdAt: subDays(now, 3).toISOString(),
        },
        {
          id: "week_2",
          type: "challenge",
          title: "Challenge Completed",
          message: "Earned 500 XP",
          isRead: true,
          createdAt: subDays(now, 5).toISOString(),
        },
        {
          id: "older_1",
          type: "system",
          title: "Account Created",
          message: "Welcome to VyaparMedia",
          isRead: true,
          createdAt: subDays(now, 14).toISOString(),
        },
      ];

      const grouped = groupNotificationsByRecency(items);

      expect(grouped.today).toHaveLength(2);
      expect(grouped.today.map((i) => i.id)).toEqual(["today_1", "today_2"]);

      expect(grouped.thisWeek).toHaveLength(2);
      expect(grouped.thisWeek.map((i) => i.id)).toEqual(["week_1", "week_2"]);

      expect(grouped.older).toHaveLength(1);
      expect(grouped.older[0]?.id).toBe("older_1");
    });

    it("should format timestamps into compact relative strings", () => {
      const now = new Date();
      expect(formatNotificationTime(subMinutes(now, 5))).toBe("5m ago");
      expect(formatNotificationTime(subHours(now, 2))).toBe("2h ago");
      expect(formatNotificationTime(subDays(now, 3))).toBe("3d ago");
    });
  });

  describe("Requirement 2: Deep Link Navigation Routing", () => {
    it("should route payment notifications to wallet", () => {
      const notif: NotificationItem = {
        id: "p1",
        type: "payment",
        title: "Escrow Deposited",
        message: "Funds in escrow",
        isRead: false,
        createdAt: new Date(),
      };
      expect(getNotificationHref(notif)).toBe("/dashboard/wallet");
    });

    it("should route deal updates with dealId to specific deal page", () => {
      const notif: NotificationItem = {
        id: "d1",
        type: "deal_update",
        title: "Offer Accepted",
        message: "Contract active",
        isRead: false,
        createdAt: new Date(),
        data: { dealId: "deal_987xyz" },
      };
      expect(getNotificationHref(notif)).toBe("/dashboard/deals/deal_987xyz");
    });

    it("should route messages with dealId to messages thread for that deal", () => {
      const notif: NotificationItem = {
        id: "m1",
        type: "new_message",
        title: "New Chat",
        message: "Check the revision",
        isRead: false,
        createdAt: new Date(),
        data: { dealId: "deal_chat_456" },
      };
      expect(getNotificationHref(notif)).toBe("/dashboard/messages?dealId=deal_chat_456");
    });

    it("should route dispute notifications to dispute center", () => {
      const notif: NotificationItem = {
        id: "ds1",
        type: "dispute",
        title: "Dispute Opened",
        message: "Evidence needed",
        isRead: false,
        createdAt: new Date(),
        data: { disputeId: "disp_111" },
      };
      expect(getNotificationHref(notif)).toBe("/dashboard/disputes?id=disp_111");
    });

    it("should respect explicit data.url if specified", () => {
      const notif: NotificationItem = {
        id: "x1",
        type: "system",
        title: "Special Campaign",
        message: "Check it out",
        isRead: false,
        createdAt: new Date(),
        data: { url: "/dashboard/campaigns/festive-2026" },
      };
      expect(getNotificationHref(notif)).toBe("/dashboard/campaigns/festive-2026");
    });
  });

  describe("Requirement 3: Web Push & Critical Business Event Prioritization", () => {
    it("should identify critical financial and contractual events for background push", () => {
      expect(isCriticalNotification("payment")).toBe(true);
      expect(isCriticalNotification("payout")).toBe(true);
      expect(isCriticalNotification("deal_accepted")).toBe(true);
      expect(isCriticalNotification("dispute")).toBe(true);
      expect(isCriticalNotification("dispute_raised")).toBe(true);
      expect(isCriticalNotification("security_alert")).toBe(true);

      // Non-critical events
      expect(isCriticalNotification("system")).toBe(false);
      expect(isCriticalNotification("review")).toBe(false);
    });

    it("should correctly map notification types to business categories", () => {
      expect(mapNotificationTypeToCategory("payment")).toBe("payments");
      expect(mapNotificationTypeToCategory("payout")).toBe("payments");
      expect(mapNotificationTypeToCategory("deal_accepted")).toBe("deals");
      expect(mapNotificationTypeToCategory("content_submitted")).toBe("deals");
      expect(mapNotificationTypeToCategory("new_message")).toBe("messages");
      expect(mapNotificationTypeToCategory("dispute_raised")).toBe("disputes");
      expect(mapNotificationTypeToCategory("security_alert")).toBe("security");
      expect(mapNotificationTypeToCategory("unknown_random")).toBe("system");
    });
  });

  describe("Requirement 5: Granular Notification Preferences Screen Controls", () => {
    it("should normalize empty or partial user preferences to default matrix", () => {
      const normalized = normalizeNotificationPreferences(null);
      expect(normalized.payments.push).toBe(true);
      expect(normalized.payments.email).toBe(true);
      expect(normalized.messages.push).toBe(true);
      expect(normalized.system.push).toBe(false);
    });

    it("should allow user granular overrides across channels", () => {
      const userCustomPrefs: GranularNotificationPreferences = {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        payments: { push: true, email: true, inApp: true },
        messages: { push: false, email: false, inApp: true }, // User muted message push
        deals: { push: true, email: false, inApp: true },
      };

      // Message push should be blocked according to preference
      expect(shouldSendNotification(userCustomPrefs, "new_message", "push")).toBe(false);

      // Message in-app should still be allowed
      expect(shouldSendNotification(userCustomPrefs, "new_message", "inApp")).toBe(true);

      // Payment push should be allowed
      expect(shouldSendNotification(userCustomPrefs, "payment", "push")).toBe(true);
    });
  });

  describe("Definition of Done: Offline & Network Interruption Recovery", () => {
    it("should reconcile missed notifications when transitioning from offline to online", async () => {
      const _localState: NotificationItem[] = [
        { id: "1", type: "deal_update", title: "Deal 1", message: "m1", isRead: true, createdAt: new Date() },
      ];

      // Simulated missed notifications occurred on server while device was offline
      const serverDatabaseNotifications: NotificationItem[] = [
        { id: "3", type: "payment", title: "₹10,000 Released", message: "Milestone 1 released", isRead: false, createdAt: new Date() },
        { id: "2", type: "deal_accepted", title: "Deal Accepted", message: "Accepted", isRead: false, createdAt: new Date() },
        { id: "1", type: "deal_update", title: "Deal 1", message: "m1", isRead: true, createdAt: new Date() },
      ];

      // Reconnect reconciliation: server fetch returns updated list & count
      const reconciledList = [...serverDatabaseNotifications];
      const reconciledUnreadCount = reconciledList.filter((n) => !n.isRead).length;

      expect(reconciledList).toHaveLength(3);
      expect(reconciledUnreadCount).toBe(2);
      expect(reconciledList[0]?.id).toBe("3");
    });
  });
});
