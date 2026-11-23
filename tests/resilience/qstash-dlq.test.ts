import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import prisma from "@/lib/db";
import { publishJob, recordDeadLetterJob } from "@/lib/qstash";
import { logger } from "@/lib/logger";

describe("Part 2 Resilience: QStash Failure & Dead-Letter Queue (DLQ)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("QStash Publish Failure: writes job to DeadLetterJob table with registered topic dlq.payment_release", async () => {
    const errorSpy = vi.spyOn(logger, "error");
    const criticalSpy = vi.spyOn(logger, "critical");

    const mockDlqRecord = {
      id: "dlq_rec_12345",
      jobId: null,
      endpoint: "/api/cron/release-escrow",
      category: "TIME_CRITICAL",
      topic: "dlq.payment_release",
      deduplicationId: "dedup_escrow_deal_99",
      payload: { dealId: "deal_99", amountPaise: 500000 },
      errorMessage: "QStash cluster connection timeout after 5000ms",
      errorStack: "Error: Connection timeout\n at qstash.ts",
      attempts: 1,
      maxRetries: 3,
      status: "FAILED",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const dlqCreateSpy = vi
      .spyOn(prisma.deadLetterJob, "create")
      .mockResolvedValue(mockDlqRecord as never);
    vi.spyOn(prisma.user, "findMany").mockResolvedValue([]);

    const result = await recordDeadLetterJob({
      endpoint: "/api/cron/release-escrow",
      category: "time-critical",
      topic: "dlq.payment_release",
      deduplicationId: "dedup_escrow_deal_99",
      payload: { dealId: "deal_99", amountPaise: 500000 },
      errorMessage: "QStash cluster connection timeout after 5000ms",
      errorStack: "Error: Connection timeout\n at qstash.ts",
      attempts: 1,
      maxRetries: 3,
    });

    expect(result).not.toBeNull();
    expect(result?.topic).toBe("dlq.payment_release");
    expect(result?.status).toBe("FAILED");
    expect(dlqCreateSpy).toHaveBeenCalledWith({
      data: expect.objectContaining({
        topic: "dlq.payment_release",
        endpoint: "/api/cron/release-escrow",
        category: "TIME_CRITICAL",
        deduplicationId: "dedup_escrow_deal_99",
        attempts: 1,
        maxRetries: 3,
        status: "FAILED",
      }),
    });

    // Observability: Logged critical error without PII
    expect(criticalSpy).toHaveBeenCalled();
    const logCalls = [...criticalSpy.mock.calls, ...errorSpy.mock.calls].map((c) =>
      JSON.stringify(c)
    );
    const combinedLog = logCalls.join(" ");
    expect(combinedLog).toContain("DEAD_LETTER_JOB_RECORDED");
    expect(combinedLog).not.toContain("password");
    expect(combinedLog).not.toContain("secret");
  });

  it("Shipping Reconcile Failure: routes failed reconciliation job to DeadLetterJob", async () => {
    const criticalSpy = vi.spyOn(logger, "critical");

    const mockDlqRecord = {
      id: "dlq_rec_67890",
      jobId: null,
      endpoint: "/api/cron/shipping-reconcile",
      category: "SCHEDULED",
      topic: "shipping.unbilled_shipment_reconcile",
      deduplicationId: "dedup_ship_batch_42",
      payload: { shipmentIds: ["ship_1", "ship_2"], cycleDate: "2026-11-24" },
      errorMessage: "Courier partner API rate limit exceeded (429)",
      errorStack: "Error: 429 Too Many Requests",
      attempts: 3,
      maxRetries: 3,
      status: "FAILED",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.spyOn(prisma.deadLetterJob, "create").mockResolvedValue(mockDlqRecord as never);
    vi.spyOn(prisma.user, "findMany").mockResolvedValue([]);

    const result = await recordDeadLetterJob({
      endpoint: "/api/cron/shipping-reconcile",
      category: "scheduled",
      topic: "shipping.unbilled_shipment_reconcile",
      deduplicationId: "dedup_ship_batch_42",
      payload: { shipmentIds: ["ship_1", "ship_2"], cycleDate: "2026-11-24" },
      errorMessage: "Courier partner API rate limit exceeded (429)",
      attempts: 3,
      maxRetries: 3,
    });

    expect(result).not.toBeNull();
    expect(result?.topic).toBe("shipping.unbilled_shipment_reconcile");
    expect(result?.attempts).toBe(3);
    expect(criticalSpy).toHaveBeenCalled();
  });

  it("enqueueJob DLQ Fallback: failed background delivery logs error and records dead letter entry", async () => {
    const errorSpy = vi.spyOn(logger, "error");
    vi.spyOn(prisma.deadLetterJob, "create").mockResolvedValue({
      id: "dlq_fallback_1",
      jobId: null,
      endpoint: "/api/jobs/payout",
      category: "TIME_CRITICAL",
      topic: "dlq.payment_release",
      deduplicationId: "payout_fail_1",
      payload: { userId: "usr_99", amountPaise: 100000 },
      errorMessage: "Network socket terminated",
      errorStack: undefined,
      attempts: 1,
      maxRetries: 3,
      status: "FAILED",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const failingProcessor = vi.fn().mockRejectedValue(new Error("Network socket terminated"));

    await publishJob({
      endpoint: "/api/jobs/payout",
      topic: "dlq.payment_release",
      category: "time-critical",
      deduplicationId: "payout_fail_1",
      payload: { userId: "usr_99", amountPaise: 100000 },
      directProcessor: failingProcessor,
    });

    // Wait for the direct processor setTimeout to fire
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(failingProcessor).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    const errorOutput = errorSpy.mock.calls.map((c) => JSON.stringify(c)).join(" ");
    expect(errorOutput).toContain("Direct fallback job execution failed");
  });
});
