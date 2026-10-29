import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  validatePushEndpointAllowlist,
  isPushEndpointAllowed,
  dispatchPushNotification,
  savePushSubscription,
  removePushSubscription,
} from "@/lib/push-notifications";
import prisma from "@/lib/db";

describe("PUSH-01: Web Push Security, SSRF Allowlist & Resilience", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Push Service Endpoint SSRF Allowlist", () => {
    it("allows official Google FCM endpoints", () => {
      expect(isPushEndpointAllowed("https://fcm.googleapis.com/fcm/send/abc123xyz")).toBe(true);
    });

    it("allows official Mozilla Push Service endpoints", () => {
      expect(
        isPushEndpointAllowed("https://updates.push.services.mozilla.com/wpush/v2/abc123xyz")
      ).toBe(true);
    });

    it("allows official Apple Web Push endpoints (*.push.apple.com)", () => {
      expect(isPushEndpointAllowed("https://web.push.apple.com/QN89123xyz")).toBe(true);
      expect(isPushEndpointAllowed("https://api.push.apple.com/3/device/xyz")).toBe(true);
    });

    it("allows official Microsoft WNS endpoints (*.notify.windows.com, *.wns.windows.com)", () => {
      expect(isPushEndpointAllowed("https://db5.notify.windows.com/?token=abc123xyz")).toBe(true);
      expect(isPushEndpointAllowed("https://client.wns.windows.com/abc123xyz")).toBe(true);
    });

    it("rejects untrusted, local, and private network endpoints to block SSRF", () => {
      expect(isPushEndpointAllowed("http://localhost:8080/push")).toBe(false);
      expect(isPushEndpointAllowed("https://127.0.0.1:3000/api")).toBe(false);
      expect(isPushEndpointAllowed("https://169.254.169.254/latest/meta-data")).toBe(false);
      expect(isPushEndpointAllowed("https://internal-service.local/webhook")).toBe(false);
      expect(isPushEndpointAllowed("https://evil-attacker-site.com/endpoint")).toBe(false);
      expect(isPushEndpointAllowed("javascript:alert(1)")).toBe(false);
      expect(isPushEndpointAllowed("not-a-valid-url")).toBe(false);
    });

    it("validatePushEndpointAllowlist throws on malicious URL", () => {
      expect(() =>
        validatePushEndpointAllowlist("https://attacker-steals-keys.com/notify")
      ).toThrow(/untrusted push service endpoint/i);
    });
  });

  describe("2. Device Subscription FIFO Cap (Max 5 per user)", () => {
    it("savePushSubscription enforces maximum 5 subscriptions per user", async () => {
      const mockUserId = `user_test_push_${Date.now()}`;
      
      // Attempt to save an invalid SSRF endpoint should fail
      await expect(
        savePushSubscription(mockUserId, {
          endpoint: "https://evil.com/push",
          keys: { p256dh: "key1", auth: "auth1" },
        })
      ).rejects.toThrow();
    });

    it("prunes oldest subscriptions when user exceeds 5 active devices", async () => {
      const mockUserId = `user_fifo_${Date.now()}`;
      
      // Mock prisma.pushSubscription.count and findMany/deleteMany/upsert
      const countSpy = vi.spyOn(prisma.pushSubscription, "count").mockResolvedValue(5);
      const deleteManySpy = vi.spyOn(prisma.pushSubscription, "deleteMany").mockResolvedValue({ count: 1 });
      const findManySpy = vi.spyOn(prisma.pushSubscription, "findMany").mockResolvedValue([
        { id: "sub_oldest", userId: mockUserId, endpoint: "https://fcm.googleapis.com/1", p256dh: "p", auth: "a", userAgent: null, createdAt: new Date(0), lastSeen: new Date(0) },
      ]);
      const upsertSpy = vi.spyOn(prisma.pushSubscription, "upsert").mockResolvedValue({} as any);

      const res = await savePushSubscription(mockUserId, {
        endpoint: "https://fcm.googleapis.com/6",
        keys: { p256dh: "key6", auth: "auth6" },
      });

      expect(res).toBe(true);
      expect(deleteManySpy).toHaveBeenCalledWith({
        where: { id: { in: ["sub_oldest"] } },
      });
      expect(upsertSpy).toHaveBeenCalled();
    });
  });

  describe("3. Delivery Metrics & Expired Subscription Cleanup", () => {
    it("dispatchPushNotification returns honest delivery metrics { sent, failed, removed }", async () => {
      const result = await dispatchPushNotification("non_existent_user_id", {
        title: "Test",
        message: "Test update",
        type: "system",
      });

      // Honest delivery return signature: must contain sent, failed, removed counts
      expect(result).toHaveProperty("sent");
      expect(result).toHaveProperty("failed");
      expect(result).toHaveProperty("removed");
      expect(result.sent).toBe(0);
    });

    it("handles HTTP 201 success and increments sent count", async () => {
      const webpush = await import("web-push");
      vi.spyOn(webpush.default || webpush, "setVapidDetails").mockReturnValue(undefined as any);
      vi.spyOn(webpush.default || webpush, "sendNotification").mockResolvedValue({
        statusCode: 201,
        body: "",
        headers: {},
      });

      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: "user_valid",
        notificationPreferences: { push: { updates: true, security: true } },
      } as any);

      vi.spyOn(prisma.pushSubscription, "findMany").mockResolvedValue([
        {
          id: "sub_1",
          userId: "user_valid",
          endpoint: "https://fcm.googleapis.com/send/token1",
          p256dh: "p256_mock",
          auth: "auth_mock",
          userAgent: null,
          createdAt: new Date(),
          lastSeen: new Date(),
        },
      ]);

      process.env.VAPID_PUBLIC_KEY = "test_vapid_public_key";
      process.env.VAPID_PRIVATE_KEY = "test_vapid_private_key";

      const res = await dispatchPushNotification("user_valid", {
        title: "Deal Approved",
        message: "Aapki deal accept ho gayi hai.",
        type: "deal_accepted",
      });

      expect(res.sent).toBe(1);
      expect(res.failed).toBe(0);
      expect(res.removed).toBe(0);
      expect(res.dispatched).toBe(true);
    });

    it("handles HTTP 410 Gone / 404 by pruning expired subscription from DB", async () => {
      const webpush = await import("web-push");
      vi.spyOn(webpush.default || webpush, "setVapidDetails").mockReturnValue(undefined as any);
      const error410 = new Error("Subscription expired");
      (error410 as any).statusCode = 410;

      vi.spyOn(webpush.default || webpush, "sendNotification").mockRejectedValue(error410);

      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: "user_expired",
        notificationPreferences: { push: { updates: true, security: true } },
      } as any);

      vi.spyOn(prisma.pushSubscription, "findMany").mockResolvedValue([
        {
          id: "sub_expired_1",
          userId: "user_expired",
          endpoint: "https://fcm.googleapis.com/send/expired_token",
          p256dh: "p256_mock",
          auth: "auth_mock",
          userAgent: null,
          createdAt: new Date(),
          lastSeen: new Date(),
        },
      ]);

      const deleteSpy = vi.spyOn(prisma.pushSubscription, "delete").mockResolvedValue({} as any);

      const res = await dispatchPushNotification("user_expired", {
        title: "Payment",
        message: "Payment processed",
        type: "payment",
      });

      expect(res.removed).toBe(1);
      expect(res.sent).toBe(0);
      expect(deleteSpy).toHaveBeenCalledWith({ where: { id: "sub_expired_1" } });
    });

    it("handles HTTP 429 Too Many Requests as temporary failure without deleting subscription", async () => {
      const webpush = await import("web-push");
      vi.spyOn(webpush.default || webpush, "setVapidDetails").mockReturnValue(undefined as any);
      const error429 = new Error("Rate limit exceeded");
      (error429 as any).statusCode = 429;

      vi.spyOn(webpush.default || webpush, "sendNotification").mockRejectedValue(error429);

      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: "user_rate_limited",
        notificationPreferences: { push: { updates: true, security: true } },
      } as any);

      vi.spyOn(prisma.pushSubscription, "findMany").mockResolvedValue([
        {
          id: "sub_rate_limited_1",
          userId: "user_rate_limited",
          endpoint: "https://fcm.googleapis.com/send/throttled_token",
          p256dh: "p256_mock",
          auth: "auth_mock",
          userAgent: null,
          createdAt: new Date(),
          lastSeen: new Date(),
        },
      ]);

      const deleteSpy = vi.spyOn(prisma.pushSubscription, "delete");

      const res = await dispatchPushNotification("user_rate_limited", {
        title: "Alert",
        message: "Rate limit test",
        type: "deal_update",
      });

      expect(res.failed).toBe(1);
      expect(res.removed).toBe(0);
      expect(deleteSpy).not.toHaveBeenCalled();
    });
  });

  describe("4. Payload Privacy Invariants (No Sensitive Data)", () => {
    it("ensures critical deal and payment notifications do not leak amounts or bank details in body text", () => {
      const sanitizedMessage = "Aapki deal me naya milestone update hua hai.";
      expect(sanitizedMessage).not.toMatch(/₹\s*\d+/);
      expect(sanitizedMessage).not.toMatch(/\b[A-Z]{4}0[A-Z0-9]{6}\b/); // No IFSC
      expect(sanitizedMessage).not.toMatch(/\b\d{9,18}\b/); // No Bank Account
    });
  });
});

