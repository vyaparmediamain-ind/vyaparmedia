import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/lib/db";
import { PaymentService } from "@/services/payment.service";
import { processWebhookEventInternal } from "@/lib/razorpay-webhook-processor";
import { WebhookJobPayload } from "@/lib/qstash";

describe("RZP-PAYOUT-01: RazorpayX Payout Reversal & Re-Credit Idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("successfully reverses a COMPLETED withdrawal exactly once and re-credits wallet", async () => {
    const withdrawalId = "w_completed_123";
    const walletId = "wallet_user_123";
    const amountPaise = 50000;

    // Mock initial state: withdrawal is COMPLETED
    const mockWithdrawal = {
      id: withdrawalId,
      walletId,
      amount: amountPaise,
      status: "COMPLETED",
      razorpayPayoutId: "pout_12345",
      wallet: {
        id: walletId,
        balance: 10000,
        totalWithdrawn: 50000,
        user: { email: "creator@example.com" },
      },
    };

    let currentWithdrawalStatus = "COMPLETED";
    let walletBalance = 10000;
    let totalWithdrawn = 50000;

    vi.spyOn(prisma.processedWebhookEvent, "findUnique").mockResolvedValue(null as never);
    vi.spyOn(prisma.processedWebhookEvent, "create").mockResolvedValue({} as never);

    vi.spyOn(prisma.withdrawal, "findUnique").mockImplementation((async () => ({
      ...mockWithdrawal,
      status: currentWithdrawalStatus,
    })) as any);

    vi.spyOn(prisma.withdrawal, "updateMany").mockImplementation((async (args: any) => {
      // Check if filter matches
      const statusFilter = args.where.status;
      if (statusFilter && typeof statusFilter === "object") {
        if (statusFilter.notIn && statusFilter.notIn.includes(currentWithdrawalStatus)) {
          return { count: 0 };
        }
        if (statusFilter.in && !statusFilter.in.includes(currentWithdrawalStatus)) {
          return { count: 0 };
        }
      }
      currentWithdrawalStatus = args.data.status;
      return { count: 1 };
    }) as any);

    vi.spyOn(prisma.wallet, "update").mockImplementation((async (args: any) => {
      if (args.data.balance?.increment) {
        walletBalance += args.data.balance.increment;
      }
      if (args.data.totalWithdrawn?.decrement) {
        totalWithdrawn -= args.data.totalWithdrawn.decrement;
      }
      return {} as never;
    }) as any);

    vi.spyOn(prisma.transaction, "findFirst").mockResolvedValue({
      id: "tx_w_123",
      status: "COMPLETED",
      type: "WITHDRAWAL",
    } as never);
    vi.spyOn(prisma.transaction, "updateMany").mockResolvedValue({ count: 1 } as never);
    const txCreateSpy = vi.spyOn(prisma.transaction, "create").mockResolvedValue({} as never);
    vi.spyOn(prisma, "$transaction").mockImplementation(async (cb: any) => cb(prisma));

    const job: WebhookJobPayload = {
      eventId: "payout.reversed:pout_12345_evt1",
      eventType: "payout.reversed",
      rawBody: "{}",
      payload: {
        event: "payout.reversed",
        payload: {
          payout: {
            entity: {
              id: "pout_12345",
              amount: amountPaise,
              status: "reversed",
              reference_id: withdrawalId,
              failure_reason: "Beneficiary bank account closed",
              utr: "UTR999999",
            },
          },
        },
      },
    };

    // First arrival: should process reversal and re-credit wallet
    const result1 = await processWebhookEventInternal(job);
    expect(result1.success).toBe(true);
    expect(currentWithdrawalStatus).toBe("REVERSED");
    expect(walletBalance).toBe(60000); // 10000 + 50000
    expect(totalWithdrawn).toBe(0); // 50000 - 50000
    expect(txCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "REFUND",
          amount: amountPaise,
          walletId,
        }),
      }),
    );
  });

  it("handles duplicate payout.reversed webhook idempotently without double-refunding", async () => {
    const withdrawalId = "w_already_reversed_123";
    const walletId = "wallet_user_123";
    const amountPaise = 50000;

    // Withdrawal is ALREADY REVERSED
    vi.spyOn(prisma.withdrawal, "findUnique").mockResolvedValue({
      id: withdrawalId,
      walletId,
      amount: amountPaise,
      status: "REVERSED",
      razorpayPayoutId: "pout_12345",
      wallet: { id: walletId, user: { email: "creator@example.com" } },
    } as never);

    vi.spyOn(prisma.processedWebhookEvent, "findUnique").mockResolvedValue(null as never);
    vi.spyOn(prisma.processedWebhookEvent, "create").mockResolvedValue({} as never);
    const walletUpdateSpy = vi.spyOn(prisma.wallet, "update");

    const job: WebhookJobPayload = {
      eventId: "payout.reversed:pout_12345_evt2",
      eventType: "payout.reversed",
      rawBody: "{}",
      payload: {
        event: "payout.reversed",
        payload: {
          payout: {
            entity: {
              id: "pout_12345",
              amount: amountPaise,
              status: "reversed",
              reference_id: withdrawalId,
            },
          },
        },
      },
    };

    const result = await processWebhookEventInternal(job);
    expect(result.success).toBe(true);
    // Crucial: wallet.update must NOT be called on second attempt
    expect(walletUpdateSpy).not.toHaveBeenCalled();
  });
});
