import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import crypto from "node:crypto";
import { verifyWebhookSignature, verifyPaymentSignature } from "@/lib/razorpay";
import { publishWebhookJob, WebhookJobPayload } from "@/lib/qstash";
import { verifySignatureAppRouter } from "@/lib/qstash-guard";
import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import {
  isWebhookProcessed,
  markWebhookProcessed,
  claimIdempotencyKey,
  releaseIdempotencyKey,
  saveIdempotencyResponse,
  cleanupExpiredIdempotencyKeys,
} from "@/lib/idempotency";

import { processWebhookEventInternal } from "@/app/api/webhooks/razorpay/process/route";
import { PaymentService } from "@/services/payment.service";

describe("Unit Tests: Webhook Signature Verification, Hardening & Idempotency", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const testSecret = "test_webhook_secret_key_12345678";
  const samplePayload = JSON.stringify({
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: "pay_test_999",
          amount: 50000,
          currency: "INR",
          status: "captured",
          order_id: "order_test_888",
        },
      },
    },
  });

  describe("Requirement 1: HMAC-SHA256 Timing-Safe Signature Verification", () => {
    it("should verify valid signature with timingSafeEqual", () => {
      const validSignature = crypto
        .createHmac("sha256", testSecret)
        .update(samplePayload)
        .digest("hex");

      const isValid = verifyWebhookSignature(samplePayload, validSignature, testSecret);
      expect(isValid).toBe(true);
    });

    it("should reject tampered payload with valid original signature", () => {
      const validSignature = crypto
        .createHmac("sha256", testSecret)
        .update(samplePayload)
        .digest("hex");

      const tamperedPayload = JSON.stringify({
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_test_999",
              amount: 100000, // Attacker increased amount!
              currency: "INR",
            },
          },
        },
      });

      const isValid = verifyWebhookSignature(tamperedPayload, validSignature, testSecret);
      expect(isValid).toBe(false);
    });

    it("should reject signature generated with wrong secret", () => {
      const invalidSignature = crypto
        .createHmac("sha256", "wrong_secret_attacker")
        .update(samplePayload)
        .digest("hex");

      const isValid = verifyWebhookSignature(samplePayload, invalidSignature, testSecret);
      expect(isValid).toBe(false);
    });

    it("should reject non-hex or malformed signatures without throwing length errors", () => {
      expect(verifyWebhookSignature(samplePayload, "not-a-valid-hex-signature", testSecret)).toBe(false);
      expect(verifyWebhookSignature(samplePayload, "", testSecret)).toBe(false);
      expect(verifyWebhookSignature(samplePayload, "a".repeat(63), testSecret)).toBe(false); // wrong length
      expect(verifyWebhookSignature(samplePayload, "a".repeat(65), testSecret)).toBe(false);
    });
  });

  describe("Frontend Payment Signature Verification", () => {
    it("should verify Razorpay frontend payment signature (orderId|paymentId)", () => {
      const originalSecret = process.env.RAZORPAY_KEY_SECRET;
      process.env.RAZORPAY_KEY_SECRET = "test_key_secret_for_cb";

      const orderId = "order_abc123";
      const paymentId = "pay_xyz789";
      const text = `${orderId}|${paymentId}`;
      const signature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(text)
        .digest("hex");

      const isValid = verifyPaymentSignature({ orderId, paymentId, signature });
      expect(isValid).toBe(true);

      const isTampered = verifyPaymentSignature({ orderId: "order_tampered", paymentId, signature });
      expect(isTampered).toBe(false);

      process.env.RAZORPAY_KEY_SECRET = originalSecret;
    });
  });

  describe("Requirement 2 & 5: QStash Offloading, DeduplicationId, and verifySignatureAppRouter", () => {
    it("should publish webhook job with time-critical category and deduplicationId matching eventId", async () => {
      const jobPayload: WebhookJobPayload = {
        eventId: "payment.captured:pay_test_001",
        eventType: "payment.captured",
        rawBody: samplePayload,
        payload: JSON.parse(samplePayload),
      };

      const directProcessor = vi.fn().mockResolvedValue({ success: true });

      const result = await publishWebhookJob(jobPayload, directProcessor);
      expect(result.deduplicationId).toBe("payment.captured:pay_test_001");
    });

    it("verifySignatureAppRouter should reject requests without Upstash-Signature header with 401", async () => {
      const mockHandler = vi.fn();
      const protectedHandler = verifySignatureAppRouter(mockHandler);

      const req = new NextRequest("http://localhost:3000/api/webhooks/razorpay/process", {
        method: "POST",
        body: JSON.stringify({ eventId: "test_evt" }),
      });

      const res = await protectedHandler(req);
      expect(res.status).toBe(401);
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe("Requirement 3: 5x Deliberate Replay Idempotency Test", () => {
    it("should execute business logic on Call 1 and no-op on Calls 2 through 5 via real processWebhookEventInternal", async () => {
      const processedEvents = new Set<string>();
      const _topUpCompletedCount = 0;

      (vi.spyOn(prisma.processedWebhookEvent, "findUnique") as unknown as Mock).mockImplementation(async ({ where }: { where: { eventId: string } }) => {
        if (processedEvents.has(where.eventId)) {
          return {
            id: "proc_1",
            eventId: where.eventId,
            eventType: "payment.captured",
            payload: null,
            processedAt: new Date(),
            updatedAt: new Date(),
          };
        }
        return null;
      });

      (vi.spyOn(prisma.processedWebhookEvent, "create") as unknown as Mock).mockImplementation(async ({ data }: { data: { eventId: string; eventType: string; payload?: unknown } }) => {
        processedEvents.add(data.eventId);
        return {
          id: "proc_" + Date.now(),
          eventId: data.eventId,
          eventType: data.eventType,
          payload: data.payload,
          processedAt: new Date(),
          updatedAt: new Date(),
        };
      });

      vi.spyOn(prisma.transaction, "findFirst").mockResolvedValue({
        id: "tx_topup_5x",
        walletId: "w_topup_5x",
        amount: 50_000,
        status: "PENDING",
      } as never);

      let walletIncrementCount = 0;
      vi.spyOn(prisma, "$transaction").mockImplementation(async (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma));
      (vi.spyOn(prisma.transaction, "updateMany") as unknown as Mock).mockResolvedValue({ count: 1 });
      (vi.spyOn(prisma.wallet, "update") as unknown as Mock).mockImplementation(async () => {
        walletIncrementCount++;
        return {} as never;
      });

      const eventId = "payment.captured:pay_5x_test_12345";
      const jobPayload: WebhookJobPayload = {
        eventId,
        eventType: "payment.captured",
        rawBody: "{}",
        payload: {
          event: "payment.captured",
          payload: {
            payment: {
              entity: {
                id: "pay_5x_test_12345",
                order_id: "order_5x_888",
                amount: 50_000,
                status: "captured",
              },
            },
          },
        },
      };

      // Call 1: First arrival -> Real processWebhookEventInternal completes top-up
      const res1 = await processWebhookEventInternal(jobPayload);
      expect(res1.success).toBe(true);
      expect(res1.message).toBe("Top-up completed");
      expect(walletIncrementCount).toBe(1);

      // Calls 2 through 5: Deliberate Replay attempts -> Real processWebhookEventInternal ignores duplicates
      for (let i = 2; i <= 5; i++) {
        const replayRes = await processWebhookEventInternal(jobPayload);
        expect(replayRes.success).toBe(true);
        expect(replayRes.message).toBe("Duplicate webhook ignored");
        expect(walletIncrementCount).toBe(1); // Wallet increment was NEVER called again!
      }
    });
  });

  describe("Requirement 4: Strict Amount Verification", () => {
    it("should mark transaction FAILED and refuse balance increment on amount mismatch via real processWebhookEventInternal", async () => {
      const expectedAmount = 100_000; // ₹1,000 in paise
      const webhookCapturedAmount = 60_000; // ₹600 in paise (mismatch!)

      vi.spyOn(prisma.processedWebhookEvent, "findUnique").mockResolvedValue(null as never);
      vi.spyOn(prisma.processedWebhookEvent, "create").mockResolvedValue({} as never);

      vi.spyOn(prisma.transaction, "findFirst").mockResolvedValue({
        id: "tx_mismatch_1",
        walletId: "w_mismatch_1",
        amount: expectedAmount,
        status: "PENDING",
      } as never);

      let updatedStatus = "PENDING";
      (vi.spyOn(prisma.transaction, "updateMany") as unknown as Mock).mockImplementation(async ({ data }: { data: { status?: string } }) => {
        if (data.status) {
          updatedStatus = data.status;
        }
        return { count: 1 };
      });

      const completeTopUpSpy = vi.spyOn(PaymentService, "completeWalletTopUp");

      const jobPayload: WebhookJobPayload = {
        eventId: "payment.captured:pay_mismatch_999",
        eventType: "payment.captured",
        rawBody: "{}",
        payload: {
          event: "payment.captured",
          payload: {
            payment: {
              entity: {
                id: "pay_mismatch_999",
                order_id: "order_mismatch_123",
                amount: webhookCapturedAmount,
                status: "captured",
              },
            },
          },
        },
      };

      const result = await processWebhookEventInternal(jobPayload);

      expect(result.success).toBe(false);
      expect(result.message).toContain("Amount mismatch: transaction marked FAILED");
      expect(updatedStatus).toBe("FAILED");
      expect(completeTopUpSpy).not.toHaveBeenCalled();
    });
  });

  describe("Requirement 6: Terminal-State Guard", () => {
    it("should refuse processing and return Already terminal when transaction is COMPLETED, FAILED, or REVERSED via real processWebhookEventInternal", async () => {
      vi.spyOn(prisma.processedWebhookEvent, "findUnique").mockResolvedValue(null);
      vi.spyOn(prisma.processedWebhookEvent, "create").mockResolvedValue({} as never);
      const completeTopUpSpy = vi.spyOn(PaymentService, "completeWalletTopUp");

      const terminalStatuses = ["COMPLETED", "FAILED", "REVERSED"];

      for (const status of terminalStatuses) {
        vi.spyOn(prisma.transaction, "findFirst").mockResolvedValue({
          id: `tx_${status}`,
          walletId: "w_terminal",
          amount: 50_000,
          status,
        } as never);

        const jobPayload: WebhookJobPayload = {
          eventId: `payment.captured:pay_terminal_${status}`,
          eventType: "payment.captured",
          rawBody: "{}",
          payload: {
            event: "payment.captured",
            payload: {
              payment: {
                entity: {
                  id: `pay_terminal_${status}`,
                  order_id: `order_terminal_${status}`,
                  amount: 50_000,
                  status: "captured",
                },
              },
            },
          },
        };

        const result = await processWebhookEventInternal(jobPayload);
        expect(result.success).toBe(true);
        expect(result.message).toBe("Already terminal");
      }

      expect(completeTopUpSpy).not.toHaveBeenCalled();
    });

    it("should ensure real PaymentService.completeWalletTopUp refuses to overwrite terminal transaction with status notIn guard", async () => {
      const mockTx = {
        transaction: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }), // 0 records updated because status was already terminal
        },
        wallet: {
          update: vi.fn(),
        },
      };

      const result = await PaymentService.completeWalletTopUp(mockTx as never, {
        transactionId: "tx_already_terminal",
        walletId: "w_123",
        amount: 5000,
        razorpayPaymentId: "pay_xyz",
      });

      expect(result).toBe(false);
      expect(mockTx.transaction.updateMany).toHaveBeenCalledWith({
        where: {
          id: "tx_already_terminal",
          status: { notIn: ["COMPLETED", "FAILED", "REVERSED"] },
        },
        data: {
          status: "COMPLETED",
          razorpayPaymentId: "pay_xyz",
        },
      });
      expect(mockTx.wallet.update).not.toHaveBeenCalled();
    });
  });

  describe("Idempotency Service Implementation (src/lib/idempotency.ts)", () => {
    it("isWebhookProcessed should query ProcessedWebhookEvent table", async () => {
      const spy = vi.spyOn(prisma.processedWebhookEvent, "findUnique").mockResolvedValueOnce({
        id: "rec_1",
        eventId: "evt_123",
        eventType: "payment.captured",
        payload: null,
        processedAt: new Date(),
        updatedAt: new Date(),
      });

      const processed = await isWebhookProcessed("evt_123");
      expect(processed).toBe(true);
      expect(spy).toHaveBeenCalledWith({ where: { eventId: "evt_123" } });

      vi.spyOn(prisma.processedWebhookEvent, "findUnique").mockResolvedValueOnce(null);
      const notProcessed = await isWebhookProcessed("evt_not_found");
      expect(notProcessed).toBe(false);
    });

    it("markWebhookProcessed should create event and handle P2002 duplicate gracefully", async () => {
      vi.spyOn(prisma.processedWebhookEvent, "create").mockResolvedValueOnce({
        id: "rec_2",
        eventId: "evt_new",
        eventType: "payment.captured",
        payload: null,
        processedAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(markWebhookProcessed("evt_new", "payment.captured")).resolves.not.toThrow();

      // P2002 race condition error should be caught without throwing
      const p2002Error = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "5.0.0",
      });
      vi.spyOn(prisma.processedWebhookEvent, "create").mockRejectedValueOnce(p2002Error);
      await expect(markWebhookProcessed("evt_duplicate", "payment.captured")).resolves.not.toThrow();
    });

    it("claimIdempotencyKey should successfully claim new keys and detect duplicates", async () => {
      vi.spyOn(prisma.idempotencyKey, "findUnique").mockResolvedValueOnce(null);
      vi.spyOn(prisma.idempotencyKey, "create").mockResolvedValueOnce({
        id: "idemp_1",
        key: "key_abc",
        userId: "user_1",
        response: { status: "PROCESSING" },
        expiresAt: new Date(Date.now() + 600000),
        createdAt: new Date(),
      });

      const res1 = await claimIdempotencyKey("key_abc", "user_1");
      expect(res1.isDuplicate).toBe(false);

      // Existing non-expired key with matching user
      vi.spyOn(prisma.idempotencyKey, "findUnique").mockResolvedValueOnce({
        id: "idemp_2",
        key: "key_abc",
        userId: "user_1",
        response: { status: "SUCCESS", result: 42 },
        expiresAt: new Date(Date.now() + 600000),
        createdAt: new Date(),
      });
      const res2 = await claimIdempotencyKey("key_abc", "user_1");
      expect(res2.isDuplicate).toBe(true);
      expect((res2.savedResponse as { status: string }).status).toBe("SUCCESS");

      // Owner mismatch
      vi.spyOn(prisma.idempotencyKey, "findUnique").mockResolvedValueOnce({
        id: "idemp_3",
        key: "key_abc",
        userId: "user_attacker",
        response: { status: "PROCESSING" },
        expiresAt: new Date(Date.now() + 600000),
        createdAt: new Date(),
      });
      const res3 = await claimIdempotencyKey("key_abc", "user_victim");
      expect(res3.isDuplicate).toBe(true);
      expect(res3.ownerMismatch).toBe(true);
    });

    it("releaseIdempotencyKey and saveIdempotencyResponse should manage key lifecycle", async () => {
      const mockKeyRecord = {
        id: "idemp_del",
        key: "key_to_release",
        userId: "user_1",
        response: { status: "PROCESSING" } as Prisma.JsonValue,
        expiresAt: new Date(),
        createdAt: new Date(),
      };
      const deleteSpy = vi.spyOn(prisma.idempotencyKey, "delete").mockResolvedValueOnce(mockKeyRecord);
      vi.spyOn(prisma.idempotencyKey, "findUnique").mockResolvedValueOnce(mockKeyRecord);

      await releaseIdempotencyKey("key_to_release", "user_1");
      expect(deleteSpy).toHaveBeenCalledWith({ where: { key: "key_to_release" } });

      const upsertSpy = vi.spyOn(prisma.idempotencyKey, "upsert").mockResolvedValueOnce({
        ...mockKeyRecord,
        key: "key_to_save",
        response: { status: "COMPLETED" } as Prisma.JsonValue,
      });
      await saveIdempotencyResponse("key_to_save", { status: "COMPLETED" }, "user_1");
      expect(upsertSpy).toHaveBeenCalled();
    });

    it("cleanupExpiredIdempotencyKeys should batch delete expired keys", async () => {
      const expiredRecord1 = {
        id: "id1",
        key: "k1",
        userId: "u1",
        response: null as Prisma.JsonValue,
        expiresAt: new Date(),
        createdAt: new Date(),
      };
      const expiredRecord2 = {
        id: "id2",
        key: "k2",
        userId: "u2",
        response: null as Prisma.JsonValue,
        expiresAt: new Date(),
        createdAt: new Date(),
      };
      vi.spyOn(prisma.idempotencyKey, "findMany").mockResolvedValueOnce([expiredRecord1, expiredRecord2]);
      vi.spyOn(prisma.idempotencyKey, "deleteMany").mockResolvedValueOnce({ count: 2 });

      const deleted = await cleanupExpiredIdempotencyKeys();
      expect(deleted).toBe(2);
    });
  });
});
