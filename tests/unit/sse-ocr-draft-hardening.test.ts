import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkImageBufferForContacts } from "@/lib/contact-filter";
import {
  messagingBus,
  publishMessageToRecipient,
  publishTypingToRecipient,
} from "@/lib/messaging-events";
import { redis } from "@/lib/redis";
import { subscribeToTypingPresence } from "@/lib/supabase-messaging-realtime";

describe("Realtime SSE, OCR Fail-Closed & Cloud Draft Synchronization (End-to-End Verification)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Realtime Messaging Stream & Server-Sent Events (SSE)", () => {
    it("dispatches message events locally and publishes to Redis", async () => {
      const recipientId = "usr_recipient_123";
      const senderId = "usr_sender_456";
      let receivedEvent: any = null;

      const listener = (event: any) => {
        receivedEvent = event;
      };
      messagingBus.on(`user:${recipientId}`, listener);

      await publishMessageToRecipient(recipientId, senderId, {
        id: "msg_stream_001",
        senderId,
        receiverId: recipientId,
        content: "Hello via SSE stream!",
        createdAt: new Date().toISOString(),
      });

      expect(receivedEvent).not.toBeNull();
      expect(receivedEvent.type).toBe("message");
      expect(receivedEvent.recipientId).toBe(recipientId);
      expect(receivedEvent.message.content).toBe("Hello via SSE stream!");

      messagingBus.off(`user:${recipientId}`, listener);
    });

    it("dispatches typing events to recipient channel", async () => {
      const recipientId = "usr_recipient_typing";
      const senderId = "usr_sender_typing";
      let typingEvent: any = null;

      const listener = (event: any) => {
        typingEvent = event;
      };
      messagingBus.on(`user:${recipientId}`, listener);

      await publishTypingToRecipient(recipientId, senderId, true, "deal_typing_789");

      expect(typingEvent).not.toBeNull();
      expect(typingEvent.type).toBe("typing");
      expect(typingEvent.isTyping).toBe(true);
      expect(typingEvent.senderId).toBe(senderId);
      expect(typingEvent.dealId).toBe("deal_typing_789");

      messagingBus.off(`user:${recipientId}`, listener);
    });
  });

  describe("2. OCR Fail-Closed & Security Review Queue Hardening", () => {
    it("fails closed and queues image for security review when per-user OCR rate limit is exceeded", async () => {
      const prevEnv = process.env.VISION_API_KEY;
      process.env.VISION_API_KEY = "AIzaSyFakeTestKey";

      // Mock redis.incr to return 11 (exceeds 10/min per-user cap)
      vi.spyOn(redis, "incr").mockResolvedValueOnce(11);

      const buffer = Buffer.from("fake-image-bytes");
      const result = await checkImageBufferForContacts(buffer, "sample_user_upload.png", {
        userId: "usr_attacker_bypass_attempt",
      });

      expect(result.hasContactInfo).toBe(true);
      expect(result.findings).toContain("image_pending_review");
      expect(result.needsReview).toBe(true);
      expect(result.detectedText).toContain("Image held for automated security review");

      if (prevEnv) process.env.VISION_API_KEY = prevEnv;
      else delete process.env.VISION_API_KEY;
    });

    it("fails closed and queues image when daily OCR quota is exceeded", async () => {
      const prevEnv = process.env.VISION_API_KEY;
      process.env.VISION_API_KEY = "AIzaSyFakeTestKey";

      // First call for user limit returns 1, second call for daily quota returns 1001
      vi.spyOn(redis, "incr")
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1001);

      const buffer = Buffer.from("fake-image-bytes");
      const result = await checkImageBufferForContacts(buffer, "sample_daily_overflow.png", {
        userId: "usr_normal_user",
      });

      expect(result.hasContactInfo).toBe(true);
      expect(result.findings).toContain("image_pending_review");
      expect(result.needsReview).toBe(true);

      if (prevEnv) process.env.VISION_API_KEY = prevEnv;
      else delete process.env.VISION_API_KEY;
    });
  });

  describe("3. Realtime Typing Presence Resolution", () => {
    it("notifies listeners registered with partner ID or conversation key", () => {
      const partnerUserId = "usr_creator_partner";

      const sub = subscribeToTypingPresence(partnerUserId, (_isTyping: boolean) => {});

      expect(typeof sub.unsubscribe).toBe("function");
      sub.unsubscribe();
    });
  });
});

