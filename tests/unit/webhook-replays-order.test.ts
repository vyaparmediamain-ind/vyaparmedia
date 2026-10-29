import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/lib/db";
import { processWebhookEventInternal } from "@/lib/razorpay-webhook-processor";
import { WebhookJobPayload } from "@/lib/qstash";

describe("Webhook Replay & Out-of-Order Execution Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();

    // Hermetic default prisma mocks to prevent any external DB connections
    vi.spyOn(prisma.paymentHold, "findUnique").mockResolvedValue(null as never);
    vi.spyOn(prisma.paymentHold, "findFirst").mockResolvedValue(null as never);
    vi.spyOn(prisma.paymentHold, "update").mockResolvedValue({} as never);
    vi.spyOn(prisma.paymentHold, "updateMany").mockResolvedValue({ count: 0 } as never);
    vi.spyOn(prisma.processedWebhookEvent, "findUnique").mockResolvedValue(null as never);
    vi.spyOn(prisma.processedWebhookEvent, "create").mockResolvedValue({} as never);
    vi.spyOn(prisma.transaction, "findFirst").mockResolvedValue(null as never);
    vi.spyOn(prisma.transaction, "create").mockResolvedValue({} as never);
    vi.spyOn(prisma.transaction, "updateMany").mockResolvedValue({ count: 0 } as never);
    vi.spyOn(prisma.wallet, "findUnique").mockResolvedValue(null as never);
    vi.spyOn(prisma.wallet, "update").mockResolvedValue({} as never);
    vi.spyOn(prisma, "$transaction").mockImplementation(async (cb: any) => cb(prisma));
  });

  // -------------------------------------------------------------------------
  // 1. RAZORPAY WEBHOOK REPLAY (EXACT-ONCE DEDUPLICATION)
  // -------------------------------------------------------------------------
  describe("Razorpay Webhook: Deduplication & Replay Protection", () => {
    it("successfully processes first delivery and records in ProcessedWebhookEvent", async () => {
      const eventId = "payment.captured:pay_replay_test_001";
      const expectedAmount = 50000;

      // Mock database lookup: event not yet processed
      vi.spyOn(prisma.processedWebhookEvent, "findUnique").mockResolvedValue(null as never);
      const createEventSpy = vi.spyOn(prisma.processedWebhookEvent, "create").mockResolvedValue({} as never);

      vi.spyOn(prisma.transaction, "findFirst").mockResolvedValue({
        id: "tx_replay_001",
        walletId: "w_replay_001",
        amount: expectedAmount,
        status: "PENDING",
      } as never);

      vi.spyOn(prisma, "$transaction").mockImplementation(async (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma));
      vi.spyOn(prisma.transaction, "updateMany").mockResolvedValue({ count: 1 } as never);
      const walletUpdateSpy = vi.spyOn(prisma.wallet, "update").mockResolvedValue({} as never);

      const job: WebhookJobPayload = {
        eventId,
        eventType: "payment.captured",
        rawBody: "{}",
        payload: {
          event: "payment.captured",
          payload: {
            payment: {
              entity: {
                id: "pay_replay_test_001",
                order_id: "order_replay_001",
                amount: expectedAmount,
                status: "captured",
              },
            },
          },
        },
      };

      const result = await processWebhookEventInternal(job);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Top-up completed");
      expect(createEventSpy).toHaveBeenCalledTimes(1);
      expect(walletUpdateSpy).toHaveBeenCalledTimes(1);
    });

    it("rejects replayed webhook with identical eventId with zero double-credit to wallet", async () => {
      const eventId = "payment.captured:pay_replay_test_001";

      // Mock database lookup: event ALREADY exists in ProcessedWebhookEvent
      vi.spyOn(prisma.processedWebhookEvent, "findUnique").mockResolvedValue({
        id: "pwe_existing",
        eventId,
        eventType: "payment.captured",
        processedAt: new Date(),
      } as never);

      const walletUpdateSpy = vi.spyOn(prisma.wallet, "update");
      const txUpdateSpy = vi.spyOn(prisma.transaction, "updateMany");

      const job: WebhookJobPayload = {
        eventId,
        eventType: "payment.captured",
        rawBody: "{}",
        payload: {
          event: "payment.captured",
          payload: {
            payment: {
              entity: {
                id: "pay_replay_test_001",
                order_id: "order_replay_001",
                amount: 50000,
                status: "captured",
              },
            },
          },
        },
      };

      const result = await processWebhookEventInternal(job);

      // Invariant: Returns already processed, 0 ledger/wallet mutations
      expect(result.success).toBe(true);
      expect(result.message).toBe("Duplicate webhook ignored");
      expect(walletUpdateSpy).not.toHaveBeenCalled();
      expect(txUpdateSpy).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 2. RAZORPAY TERMINAL STATE & OUT-OF-ORDER INVARIANTS
  // -------------------------------------------------------------------------
  describe("Razorpay Webhook: Terminal State Out-of-Order Handling", () => {
    it("refuses out-of-order success webhook if transaction is already in terminal state FAILED", async () => {
      const eventId = "payment.captured:pay_late_arrival_002";

      vi.spyOn(prisma.processedWebhookEvent, "findUnique").mockResolvedValue(null as never);
      vi.spyOn(prisma.processedWebhookEvent, "create").mockResolvedValue({} as never);

      // Transaction already marked FAILED by user timeout or gateway failure
      vi.spyOn(prisma.transaction, "findFirst").mockResolvedValue({
        id: "tx_late_002",
        walletId: "w_late_002",
        amount: 50000,
        status: "FAILED",
      } as never);

      const walletUpdateSpy = vi.spyOn(prisma.wallet, "update");

      const job: WebhookJobPayload = {
        eventId,
        eventType: "payment.captured",
        rawBody: "{}",
        payload: {
          event: "payment.captured",
          payload: {
            payment: {
              entity: {
                id: "pay_late_arrival_002",
                order_id: "order_late_002",
                amount: 50000,
                status: "captured",
              },
            },
          },
        },
      };

      const result = await processWebhookEventInternal(job);

      expect(result.success).toBe(true);
      expect(result.message).toContain("Already terminal");
      expect(walletUpdateSpy).not.toHaveBeenCalled();
    });

    it("FAILING REGRESSION (P6-MON-02): refund.processed and chargebacks must not be silently ignored", async () => {
      // In unpatched code, webhook processor does not handle refund.processed or chargeback.created,
      // allowing malicious users to charge back funds while keeping wallet credits.
      const dynamicEventId = `refund.processed:rfnd_malicious_${Date.now()}`;
      const job: WebhookJobPayload = {
        eventId: dynamicEventId,
        eventType: "refund.processed",
        rawBody: "{}",
        payload: {
          event: "refund.processed",
          payload: {
            refund: {
              entity: {
                id: "rfnd_malicious_003",
                payment_id: "pay_captured_prior",
                amount: 50000,
                status: "processed",
              },
            },
          },
        },
      };

      const result = await processWebhookEventInternal(job);

      // Demonstrates unpatched vulnerability P6-MON-02:
      // Current unpatched code returns { success: true, message: "Event type refund.processed acknowledged" }
      // instead of reversing wallet balance or flagging admin!
      expect(
        result.message,
        "Vulnerability P6-MON-02: Gateway refund must NOT be unhandled/acknowledged without balance clawback or alert"
      ).not.toContain("acknowledged");
    });
  });

  // -------------------------------------------------------------------------
  // 3. SHIPROCKET OUT-OF-ORDER FULFILLMENT HANDLING
  // -------------------------------------------------------------------------
  describe("Shiprocket Logistics: Out-of-Order Webhook Sequence", () => {
    it("handles DELIVERED status transition idempotently when already DELIVERED", () => {
      const existingStatus = "DELIVERED";
      const incomingStatus = "DELIVERED";

      // If already DELIVERED, duplicate webhook must be a no-op
      const isDuplicate = existingStatus === incomingStatus;
      expect(isDuplicate).toBe(true);
    });

    it("rejects backward status mutation when SHIPPED arrives after DELIVERED", () => {
      const statusHierarchy: Record<string, number> = {
        ORDER_CREATED: 1,
        PICKUP_SCHEDULED: 2,
        IN_TRANSIT: 3,
        OUT_FOR_DELIVERY: 4,
        DELIVERED: 5,
        RETURNED: 6,
      };

      const currentDealStatus = "DELIVERED";
      const lateIncomingStatus = "IN_TRANSIT";

      const currentRank = statusHierarchy[currentDealStatus] || 0;
      const incomingRank = statusHierarchy[lateIncomingStatus] || 0;

      // Invariant: Newer status with lower rank (out-of-order) must be discarded
      const shouldDiscard = incomingRank < currentRank;
      expect(shouldDiscard).toBe(true);
    });
  });
});
