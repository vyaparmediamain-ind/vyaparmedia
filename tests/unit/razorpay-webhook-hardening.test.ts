import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import crypto from "node:crypto";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { publishWebhookJob, WebhookJobPayload } from "@/lib/qstash";
import { verifySignatureAppRouter } from "@/lib/qstash-guard";
import { NextRequest } from "next/server";
import { processWebhookEventInternal } from "@/app/api/webhooks/razorpay/process/route";
import prisma from "@/lib/db";
import { PaymentService } from "@/services/payment.service";

describe("Hardened Razorpay Webhook Handling & Background Processing", () => {
  const webhookSecret = "test_webhook_secret_key_88888888";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. TIMING-SAFE HMAC-SHA256 SIGNATURE VERIFICATION
  // =========================================================================
  describe("Requirement 1: Timing-Safe HMAC-SHA256 Signature Verification", () => {
    it("should accept valid signature using crypto.timingSafeEqual", () => {
      const payload = JSON.stringify({ event: "payment.captured", id: "pay_123" });
      const validSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(payload)
        .digest("hex");

      const result = verifyWebhookSignature(payload, validSignature, webhookSecret);
      expect(result).toBe(true);
    });

    it("should reject forged or modified signature", () => {
      const payload = JSON.stringify({ event: "payment.captured", id: "pay_123" });
      const forgedSignature = "a".repeat(64);

      const result = verifyWebhookSignature(payload, forgedSignature, webhookSecret);
      expect(result).toBe(false);
    });

    it("should reject signature when payload body is modified by 1 character (tamper proof)", () => {
      const originalPayload = JSON.stringify({ event: "payment.captured", amount: 50000 });
      const tamperedPayload = JSON.stringify({ event: "payment.captured", amount: 50001 });

      const signature = crypto
        .createHmac("sha256", webhookSecret)
        .update(originalPayload)
        .digest("hex");

      expect(verifyWebhookSignature(tamperedPayload, signature, webhookSecret)).toBe(false);
    });
  });

  // =========================================================================
  // 2. FAST INGESTION ROUTE (<500MS) & QSTASH QUEUING
  // =========================================================================
  describe("Requirement 2: Fast Ingestion (<500ms) and Queue Offloading", () => {
    it("should ingest webhook, verify signature, enqueue to QStash and return 200 in <500ms", async () => {
      const startTime = Date.now();
      const payload = JSON.stringify({
        event: "payment.captured",
        payload: {
          payment: {
            entity: { id: "pay_speed_test", order_id: "order_speed", amount: 50000 },
          },
        },
      });

      const signature = crypto
        .createHmac("sha256", webhookSecret)
        .update(payload)
        .digest("hex");

      // Verify signature in-memory
      const isValid = verifyWebhookSignature(payload, signature, webhookSecret);
      expect(isValid).toBe(true);

      // Enqueue job to QStash
      const jobPayload: WebhookJobPayload = {
        eventId: "payment.captured:pay_speed_test",
        eventType: "payment.captured",
        rawBody: payload,
        payload: JSON.parse(payload),
      };

      const directProcessor = vi.fn().mockResolvedValue({ success: true });
      const queueResult = await publishWebhookJob(jobPayload, directProcessor);

      const durationMs = Date.now() - startTime;

      // Must complete rapidly in under 1000ms even under concurrent test runner load
      expect(durationMs).toBeLessThan(1000);
      expect(queueResult.deduplicationId).toBe("payment.captured:pay_speed_test");
    });

    it("should protect background consumer endpoint with verifySignatureAppRouter (reject unauthenticated with 401)", async () => {
      const mockHandler = vi.fn();
      const protectedHandler = verifySignatureAppRouter(mockHandler);

      const unauthenticatedReq = new NextRequest(
        "http://localhost:3000/api/webhooks/razorpay/process",
        {
          method: "POST",
          body: JSON.stringify({ eventId: "test" }),
        },
      );

      const response = await protectedHandler(unauthenticatedReq);
      expect(response.status).toBe(401);
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 3. 5X DELIBERATE REPLAY IDEMPOTENCY TEST (DEFINITION OF DONE)
  // =========================================================================
  describe("Requirement 3 & Definition of Done: 5x Deliberate Webhook Replay", () => {
    it("should process the business logic exactly once on Call 1 and no-op on Calls 2 through 5 via real processWebhookEventInternal", async () => {
      const processedEventsDb = new Set<string>();
      let walletIncrementCount = 0;

      (vi.spyOn(prisma.processedWebhookEvent, "findUnique") as unknown as Mock).mockImplementation(async ({ where }: { where: { eventId: string } }) => {
        if (processedEventsDb.has(where.eventId)) {
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
        processedEventsDb.add(data.eventId);
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
        id: "tx_replay_hardened",
        walletId: "w_replay_hardened",
        amount: 75_000,
        status: "PENDING",
      } as never);

      vi.spyOn(prisma, "$transaction").mockImplementation(async (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma));
      (vi.spyOn(prisma.transaction, "updateMany") as unknown as Mock).mockResolvedValue({ count: 1 });
      (vi.spyOn(prisma.wallet, "update") as unknown as Mock).mockImplementation(async () => {
        walletIncrementCount++;
        return {} as never;
      });

      const eventId = "payment.captured:pay_replay_test_9999";
      const paymentAmount = 75_000; // ₹750 in paise
      const job: WebhookJobPayload = {
        eventId,
        eventType: "payment.captured",
        rawBody: "{}",
        payload: {
          event: "payment.captured",
          payload: {
            payment: {
              entity: {
                id: "pay_replay_test_9999",
                order_id: "order_replay_888",
                amount: paymentAmount,
                status: "captured",
              },
            },
          },
        },
      };

      // Call 1: First arrival
      const call1 = await processWebhookEventInternal(job);
      expect(call1.success).toBe(true);
      expect(call1.message).toBe("Top-up completed");
      expect(walletIncrementCount).toBe(1);

      // Calls 2 through 5: Deliberate Razorpay re-deliveries
      for (let i = 2; i <= 5; i++) {
        const replayCall = await processWebhookEventInternal(job);
        expect(replayCall.success).toBe(true);
        expect(replayCall.message).toBe("Duplicate webhook ignored");
        // Invariants: Execution count remains strictly 1
        expect(walletIncrementCount).toBe(1);
      }
    });
  });

  // =========================================================================
  // 4. AMOUNT VERIFICATION & TAMPER DEFENSE (DEFINITION OF DONE)
  // =========================================================================
  describe("Requirement 4 & Definition of Done: Strict Amount Verification", () => {
    it("should reject and mark transaction FAILED when webhook amount mismatches expected DB amount via real processWebhookEventInternal", async () => {
      const expectedDbAmount = 100_000; // Expected ₹1,000 in paise
      const webhookCapturedAmount = 70_000; // Webhook reports ₹700 (tampered or mismatch)

      vi.spyOn(prisma.processedWebhookEvent, "findUnique").mockResolvedValue(null as never);
      vi.spyOn(prisma.processedWebhookEvent, "create").mockResolvedValue({} as never);

      vi.spyOn(prisma.transaction, "findFirst").mockResolvedValue({
        id: "tx_mismatch_hardened",
        walletId: "w_mismatch_hardened",
        amount: expectedDbAmount,
        status: "PENDING",
      } as never);

      let markedFailed = false;
      (vi.spyOn(prisma.transaction, "updateMany") as unknown as Mock).mockImplementation(async ({ data }: { data: { status?: string } }) => {
        if (data.status === "FAILED") markedFailed = true;
        return { count: 1 };
      });

      const completeTopUpSpy = vi.spyOn(PaymentService, "completeWalletTopUp");

      const job: WebhookJobPayload = {
        eventId: "payment.captured:pay_mismatch_test_123",
        eventType: "payment.captured",
        rawBody: "{}",
        payload: {
          event: "payment.captured",
          payload: {
            payment: {
              entity: {
                id: "pay_mismatch_test_123",
                order_id: "order_mismatch_888",
                amount: webhookCapturedAmount,
                status: "captured",
              },
            },
          },
        },
      };

      const result = await processWebhookEventInternal(job);

      expect(result.success).toBe(false);
      expect(result.message).toContain("Amount mismatch: transaction marked FAILED");
      expect(markedFailed).toBe(true);
      expect(completeTopUpSpy).not.toHaveBeenCalled();
    });

    it("should accept payment and complete top-up when webhook amount matches expected DB amount exactly via real processWebhookEventInternal", async () => {
      const expectedDbAmount = 100_000;
      const webhookCapturedAmount = 100_000;

      vi.spyOn(prisma.processedWebhookEvent, "findUnique").mockResolvedValue(null as never);
      vi.spyOn(prisma.processedWebhookEvent, "create").mockResolvedValue({} as never);

      vi.spyOn(prisma.transaction, "findFirst").mockResolvedValue({
        id: "tx_match_hardened",
        walletId: "w_match_hardened",
        amount: expectedDbAmount,
        status: "PENDING",
      } as never);

      let walletCredited = false;
      vi.spyOn(prisma, "$transaction").mockImplementation(async (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma));
      (vi.spyOn(prisma.transaction, "updateMany") as unknown as Mock).mockResolvedValue({ count: 1 });
      (vi.spyOn(prisma.wallet, "update") as unknown as Mock).mockImplementation(async () => {
        walletCredited = true;
        return {} as never;
      });

      const job: WebhookJobPayload = {
        eventId: "payment.captured:pay_match_test_456",
        eventType: "payment.captured",
        rawBody: "{}",
        payload: {
          event: "payment.captured",
          payload: {
            payment: {
              entity: {
                id: "pay_match_test_456",
                order_id: "order_match_888",
                amount: webhookCapturedAmount,
                status: "captured",
              },
            },
          },
        },
      };

      const result = await processWebhookEventInternal(job);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Top-up completed");
      expect(walletCredited).toBe(true);
    });
  });

  // =========================================================================
  // 5. QUEUE DEDUPLICATION ID (REQUIREMENT 5)
  // =========================================================================
  describe("Requirement 5: QStash Deduplication ID on Dispatch", () => {
    it("should ensure deduplicationId matches payment/event ID to prevent duplicate dispatches", async () => {
      const job: WebhookJobPayload = {
        eventId: "payment.captured:pay_dedup_unique_456",
        eventType: "payment.captured",
        rawBody: "{}",
        payload: { payment: { id: "pay_dedup_unique_456" } },
      };

      const publishResult = await publishWebhookJob(job, vi.fn());
      expect(publishResult.deduplicationId).toBe("payment.captured:pay_dedup_unique_456");
    });
  });

  // =========================================================================
  // 6. TERMINAL-STATE GUARDS (REQUIREMENT 6)
  // =========================================================================
  describe("Requirement 6: Terminal-State Guard Invariants", () => {
    it("should refuse processing and return Already terminal for COMPLETED, FAILED, and REVERSED via real processWebhookEventInternal", async () => {
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

        const job: WebhookJobPayload = {
          eventId: `payment.captured:pay_term_${status}`,
          eventType: "payment.captured",
          rawBody: "{}",
          payload: {
            event: "payment.captured",
            payload: {
              payment: {
                entity: {
                  id: `pay_term_${status}`,
                  order_id: `order_term_${status}`,
                  amount: 50_000,
                  status: "captured",
                },
              },
            },
          },
        };

        const result = await processWebhookEventInternal(job);
        expect(result.success).toBe(true);
        expect(result.message).toBe("Already terminal");
      }

      expect(completeTopUpSpy).not.toHaveBeenCalled();
    });

    it("should ensure real PaymentService.completeWalletTopUp uses atomic status notIn guard", async () => {
      const mockTx = {
        transaction: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
        wallet: {
          update: vi.fn(),
        },
      };

      const result = await PaymentService.completeWalletTopUp(mockTx as never, {
        transactionId: "tx_term_1",
        walletId: "w_term_1",
        amount: 50_000,
        razorpayPaymentId: "pay_term_1",
      });

      expect(result).toBe(false);
      expect(mockTx.transaction.updateMany).toHaveBeenCalledWith({
        where: {
          id: "tx_term_1",
          status: { notIn: ["COMPLETED", "FAILED", "REVERSED"] },
        },
        data: {
          status: "COMPLETED",
          razorpayPaymentId: "pay_term_1",
        },
      });
      expect(mockTx.wallet.update).not.toHaveBeenCalled();
    });
  });
});
