import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/lib/db";
import { PaymentService } from "@/services/payment.service";

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({
    get: (name: string) => {
      if (name.toLowerCase() === "authorization") return "Bearer test_cron_secret_32_characters_long_1234";
      return null;
    },
  })),
}));

vi.mock("@/lib/api-wrapper", () => ({
  apiWrapper: (fn: any) => fn,
}));

// Mock fetchPayoutByReferenceId
vi.mock("@/lib/razorpay", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/razorpay")>();
  return {
    ...actual,
    fetchPayoutByReferenceId: vi.fn(),
    fetchRazorpayXBalance: vi.fn().mockResolvedValue({ balance: 50000000, currency: "INR" }),
  };
});

import { fetchPayoutByReferenceId } from "@/lib/razorpay";
import { POST as reconcilePayoutsHandler } from "@/app/api/cron/reconcile-payouts/route";
import { NextRequest } from "next/server";

describe("RZP-RECON-01 (TP-04): Payout Reconcile by Deterministic reference_id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    process.env.CRON_SECRET = "test_cron_secret_32_characters_long_1234";
    vi.spyOn(prisma, "$transaction").mockImplementation(async (cb: any) => cb(prisma));
  });

  it("reconciles stuck withdrawal with gateway when found by reference_id (instead of blindly refunding)", async () => {
    const withdrawalId = "w_stuck_with_gateway_payout";
    const payoutId = "pout_found_on_gateway_777";

    vi.spyOn(prisma.deal, "findMany").mockResolvedValue([]);
    vi.spyOn(prisma.withdrawal, "findMany").mockResolvedValue([
      {
        id: withdrawalId,
        walletId: "w_123",
        amount: 25000,
        status: "PROCESSING",
        razorpayPayoutId: null, // timed out before receiving payoutId!
        updatedAt: new Date(Date.now() - 40 * 60 * 1000),
      },
    ] as never);

    // Razorpay reports the payout was actually processed!
    vi.mocked(fetchPayoutByReferenceId).mockResolvedValue({
      id: payoutId,
      entity: "payout",
      amount: 25000,
      currency: "INR",
      status: "processed",
      utr: "UTR_RECON_888",
      reference_id: withdrawalId,
    });

    const updateManySpy = vi.spyOn(prisma.withdrawal, "updateMany").mockResolvedValue({ count: 1 } as never);
    const refundSpy = vi.spyOn(PaymentService, "refundFailedWithdrawal");

    const req = new NextRequest("http://localhost:3000/api/cron/reconcile-payouts", {
      method: "POST",
      headers: { Authorization: "Bearer test_cron_secret_32_characters_long_1234" },
    });

    const res = await reconcilePayoutsHandler(req);
    expect(res.status).toBe(200);

    // MUST NOT refund wallet because the payout actually processed on Razorpay!
    expect(refundSpy).not.toHaveBeenCalled();
    // MUST update withdrawal to COMPLETED with the retrieved payout ID
    expect(updateManySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: withdrawalId }),
        data: expect.objectContaining({
          status: "COMPLETED",
          razorpayPayoutId: payoutId,
        }),
      }),
    );
  });

  it("safely refunds wallet when Razorpay confirms NO payout exists for reference_id (404/empty)", async () => {
    const withdrawalId = "w_stuck_no_gateway_record";

    vi.spyOn(prisma.deal, "findMany").mockResolvedValue([]);
    vi.spyOn(prisma.withdrawal, "findMany").mockResolvedValue([
      {
        id: withdrawalId,
        walletId: "w_123",
        amount: 25000,
        status: "PROCESSING",
        razorpayPayoutId: null,
        updatedAt: new Date(Date.now() - 40 * 60 * 1000),
      },
    ] as never);

    // Razorpay confirms no payout ever reached the gateway
    vi.mocked(fetchPayoutByReferenceId).mockResolvedValue(null);

    const refundSpy = vi.spyOn(PaymentService, "refundFailedWithdrawal").mockResolvedValue(true);

    const req = new NextRequest("http://localhost:3000/api/cron/reconcile-payouts", {
      method: "POST",
      headers: { Authorization: "Bearer test_cron_secret_32_characters_long_1234" },
    });

    const res = await reconcilePayoutsHandler(req);
    expect(res.status).toBe(200);

    // MUST safely refund wallet since gateway never created the payout
    expect(refundSpy).toHaveBeenCalledWith(
      withdrawalId,
      expect.anything(),
      expect.stringContaining("never reached gateway"),
      undefined,
      false,
    );
  });
});
