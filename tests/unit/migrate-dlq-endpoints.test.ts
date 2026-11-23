import { describe, it, expect, vi, beforeEach } from "vitest";
import { migrateDlqEndpoints } from "../../scripts/migrate-dlq-endpoints";

describe("DLQ Endpoints Migration Script", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("dry-run scans records, maps valid topics to /api/jobs/consumer, and does NOT update database", async () => {
    const mockJobs = [
      {
        id: "dlq_1",
        topic: "payment.escrow_release_gateway_failed",
        endpoint: "/api/escrow/release",
        status: "FAILED",
      },
      {
        id: "dlq_2",
        topic: "unregistered.fake_topic",
        endpoint: "/api/fake/endpoint",
        status: "FAILED",
      },
      {
        id: "dlq_3",
        topic: "shipping.unbilled_shipment_reconcile",
        endpoint: "/api/jobs/consumer",
        status: "RETRYING",
      },
    ];

    const mockPrisma = {
      deadLetterJob: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce(mockJobs)
          .mockResolvedValueOnce([]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };

    const summary = await migrateDlqEndpoints({
      apply: false,
      batchSize: 10,
      prismaClient: mockPrisma,
    });

    expect(summary.scanned).toBe(3);
    expect(summary.mappable).toBe(1);
    expect(summary.unmappable).toBe(1);
    expect(summary.alreadyMigrated).toBe(1);
    expect(summary.updated).toBe(0); // Dry-run does not write
    expect(mockPrisma.deadLetterJob.updateMany).not.toHaveBeenCalled();
  });

  it("apply mode updates mappable records to /api/jobs/consumer in batch", async () => {
    const mockJobs = [
      {
        id: "dlq_1",
        topic: "payment.escrow_release_gateway_failed",
        endpoint: "/api/escrow/release",
        status: "FAILED",
      },
      {
        id: "dlq_2",
        topic: "dispute.gateway_refund",
        endpoint: "/api/payments/razorpay/refund",
        status: "FAILED",
      },
    ];

    const mockPrisma = {
      deadLetterJob: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce(mockJobs)
          .mockResolvedValueOnce([]),
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
    };

    const summary = await migrateDlqEndpoints({
      apply: true,
      batchSize: 10,
      prismaClient: mockPrisma,
    });

    expect(summary.scanned).toBe(2);
    expect(summary.mappable).toBe(2);
    expect(summary.unmappable).toBe(0);
    expect(summary.updated).toBe(2);
    expect(mockPrisma.deadLetterJob.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["dlq_1", "dlq_2"] },
      },
      data: {
        endpoint: "/api/jobs/consumer",
      },
    });
  });
});
