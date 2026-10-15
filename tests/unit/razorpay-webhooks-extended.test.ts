import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/lib/db";
import { processWebhookEventInternal } from "@/app/api/webhooks/razorpay/process/route";
import { WebhookJobPayload } from "@/lib/qstash";

describe("RZP-HOOK-01: Razorpay Extended Webhook Event Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();

    vi.spyOn(prisma.processedWebhookEvent, "findUnique").mockResolvedValue(null as never);
    vi.spyOn(prisma.processedWebhookEvent, "create").mockResolvedValue({} as never);
    vi.spyOn(prisma, "$transaction").mockImplementation(async (cb: any) => cb(prisma));
  });

  describe("payment.failed handling", () => {
    it("marks pending transaction as FAILED when payment.failed event arrives", async () => {
      vi.spyOn(prisma.paymentHold, "findUnique").mockResolvedValue(null as never);
      vi.spyOn(prisma.transaction, "findFirst").mockResolvedValue({
        id: "tx_topup_fail",
        walletId: "w_123",
        amount: 20000,
        status: "PENDING",
      } as never);

      const updateManySpy = vi.spyOn(prisma.transaction, "updateMany").mockResolvedValue({ count: 1 } as never);

      const job: WebhookJobPayload = {
        eventId: "payment.failed:pay_fail_001",
        eventType: "payment.failed",
        rawBody: "{}",
        payload: {
          event: "payment.failed",
          payload: {
            payment: {
              entity: {
                id: "pay_fail_001",
                order_id: "order_fail_001",
                amount: 20000,
                error_code: "BAD_REQUEST_ERROR",
                error_description: "Payment was cancelled by user at bank page",
              },
            },
          },
        },
      };

      const result = await processWebhookEventInternal(job);
      expect(result.success).toBe(true);
      expect(updateManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ razorpayOrderId: "order_fail_001" }),
          data: expect.objectContaining({
            status: "FAILED",
            description: expect.stringContaining("Payment was cancelled"),
          }),
        }),
      );
    });
  });

  describe("refund.failed distinction", () => {
    it("does NOT trigger wallet clawback when refund.failed arrives", async () => {
      vi.spyOn(prisma.transaction, "findFirst").mockResolvedValue({
        id: "tx_topup_123",
        walletId: "w_123",
        type: "CREDIT",
        status: "COMPLETED",
      } as never);
      vi.spyOn(prisma.wallet, "findUnique").mockResolvedValue({
        id: "w_123",
        balance: 100000,
        userId: "u_123",
      } as never);

      const walletUpdateSpy = vi.spyOn(prisma.wallet, "update");
      const txCreateSpy = vi.spyOn(prisma.transaction, "create");

      const job: WebhookJobPayload = {
        eventId: "refund.failed:rfnd_fail_001",
        eventType: "refund.failed",
        rawBody: "{}",
        payload: {
          event: "refund.failed",
          payload: {
            refund: {
              entity: {
                id: "rfnd_fail_001",
                payment_id: "pay_prior_123",
                amount: 50000,
                status: "failed",
              },
            },
          },
        },
      };

      const result = await processWebhookEventInternal(job);
      expect(result.success).toBe(true);
      expect(walletUpdateSpy).not.toHaveBeenCalled();
      expect(txCreateSpy).not.toHaveBeenCalled();
    });
  });

  describe("transfer.reversed handling", () => {
    it("updates PaymentHold when transfer.reversed arrives for a Route deal", async () => {
      vi.spyOn(prisma.paymentHold, "findUnique").mockResolvedValue({
        id: "ph_route_deal_1",
        dealId: "deal_123",
        status: "HELD",
      } as never);

      const holdUpdateSpy = vi.spyOn(prisma.paymentHold, "update").mockResolvedValue({} as never);

      const job: WebhookJobPayload = {
        eventId: "transfer.reversed:trf_rev_001",
        eventType: "transfer.reversed",
        rawBody: "{}",
        payload: {
          event: "transfer.reversed",
          payload: {
            transfer: {
              entity: {
                id: "trf_rev_001",
                source: "pay_route_123",
                recipient: "acc_route_creator",
                amount: 45000,
                status: "reversed",
                notes: { deal_id: "deal_123" },
              },
            },
          },
        },
      };

      const result = await processWebhookEventInternal(job);
      expect(result.success).toBe(true);
      expect(holdUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "ph_route_deal_1" },
          data: expect.objectContaining({ status: "FAILED" }),
        }),
      );
    });
  });
});
