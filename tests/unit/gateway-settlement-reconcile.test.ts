import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/lib/db";

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

vi.mock("@/lib/razorpay", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/razorpay")>();
  return {
    ...actual,
    fetchRazorpayPayments: vi.fn(),
  };
});

import { fetchRazorpayPayments } from "@/lib/razorpay";
import {
  getYesterdayISTWindow,
  reconcileGatewayPaymentsIST,
} from "@/app/api/cron/reconcile-ledger-settlements/route";

describe("RZP-RECON-01 (Checklist G): Daily IST Gateway Settlement Reconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("calculates yesterday IST time window accurately in UTC epoch seconds", () => {
    const { from, to } = getYesterdayISTWindow();
    expect(to).toBeGreaterThan(from);
    // Difference should be 24 hours (86399 or 86400 seconds)
    expect(to - from).toBe(86399);
  });

  it("paginates gateway payments up to max 100 per page and enqueues missing transactions to DLQ", async () => {
    const mockPaymentsBatch1 = Array.from({ length: 100 }, (_, i) => ({
      id: `pay_batch1_${i}`,
      entity: "payment",
      amount: 100000,
      currency: "INR",
      status: "captured",
      created_at: 1700000000 + i,
    }));

    const mockPaymentsBatch2 = [
      {
        id: "pay_batch2_0",
        entity: "payment",
        amount: 250000,
        currency: "INR",
        status: "captured",
        created_at: 1700000101,
      },
      {
        id: "pay_batch2_1_mismatch",
        entity: "payment",
        amount: 50000,
        currency: "INR",
        status: "captured",
        created_at: 1700000102,
      },
    ];

    vi.mocked(fetchRazorpayPayments)
      .mockResolvedValueOnce(mockPaymentsBatch1)
      .mockResolvedValueOnce(mockPaymentsBatch2);

    // Mock prisma.transaction.findFirst:
    // Batch 1: all match
    // Batch 2: pay_batch2_0 missing (returns null), pay_batch2_1 amount mismatch (amount 40000 vs 50000)
    vi.spyOn(prisma.transaction, "findFirst").mockImplementation((async ({ where }: any) => {
      const pid = where?.razorpayPaymentId;
      if (pid === "pay_batch2_0") return null;
      if (pid === "pay_batch2_1_mismatch") {
        return { id: "tx_mismatch", amount: 40000, razorpayPaymentId: pid } as any;
      }
      return { id: `tx_${pid}`, amount: 100000, razorpayPaymentId: pid } as any;
    }) as any);

    const dlqCreateSpy = vi.spyOn(prisma.deadLetterJob, "create").mockResolvedValue({ id: "dlq_1" } as any);

    const result = await reconcileGatewayPaymentsIST();

    // Checked pagination: called twice (skip 0, skip 100)
    expect(fetchRazorpayPayments).toHaveBeenCalledTimes(2);
    expect(fetchRazorpayPayments).toHaveBeenNthCalledWith(1, expect.objectContaining({ count: 100, skip: 0 }));
    expect(fetchRazorpayPayments).toHaveBeenNthCalledWith(2, expect.objectContaining({ count: 100, skip: 100 }));

    expect(result.totalGatewayPayments).toBe(102);
    expect(result.matchedCount).toBe(100);
    expect(result.mismatchCount).toBe(2);

    // 2 DLQ records created: 1 for missing payment, 1 for amount mismatch
    expect(dlqCreateSpy).toHaveBeenCalledTimes(2);
    expect(dlqCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          topic: "reconciliation.gateway_mismatch",
          payload: expect.objectContaining({ reason: "MISSING_FROM_LEDGER" }),
        }),
      }),
    );
    expect(dlqCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          topic: "reconciliation.gateway_mismatch",
          payload: expect.objectContaining({ reason: "AMOUNT_MISMATCH" }),
        }),
      }),
    );
  });
});
