import { describe, it, expect, vi, beforeEach } from "vitest";
import * as Sentry from "@sentry/nextjs";
import { logger } from "@/lib/logger";
import {
  captureCriticalError,
  recordPaymentFailure,
  recordWebhookAnomaly,
  structuredLog,
} from "@/lib/observability";

vi.mock("@sentry/nextjs", () => {
  return {
    captureException: vi.fn().mockReturnValue("mock-sentry-id-123"),
  };
});

vi.mock("@/lib/logger", () => {
  return {
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      critical: vi.fn(),
      debug: vi.fn(),
    },
  };
});

describe("Observability Layer (Sentry + Structured Logs)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("captures critical errors with high_priority Sentry tags and structured JSON logs", () => {
    const error = new Error("Test critical payment issue");
    const eventId = captureCriticalError(error, {
      category: "PAYMENT",
      priority: "high",
      action: "escrow_payout_failed",
      userId: "user_test_99",
      transactionId: "tx_test_88",
    });

    expect(eventId).toBe("mock-sentry-id-123");
    expect(Sentry.captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        tags: expect.objectContaining({
          category: "PAYMENT",
          priority: "high",
          high_priority: "true",
          action: "escrow_payout_failed",
          userId: "user_test_99",
          transactionId: "tx_test_88",
        }),
      }),
    );
    expect(logger.critical).toHaveBeenCalled();
  });

  it("records payment failures with category PAYMENT and structured details", () => {
    const error = new Error("Gateway 4xx rejection");
    recordPaymentFailure("PAYOUT_REJECTED_4XX", error, {
      userId: "user_123",
      withdrawalId: "w_123",
      amount: 50000,
    });

    expect(Sentry.captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        tags: expect.objectContaining({
          category: "PAYMENT",
          priority: "high",
          high_priority: "true",
        }),
      }),
    );
  });

  it("records webhook anomalies (SIGNATURE_MISMATCH, AMOUNT_MISMATCH) with critical priority", () => {
    recordWebhookAnomaly("AMOUNT_MISMATCH", {
      orderId: "order_999",
      expectedAmount: 10000,
      receivedAmount: 5000,
    });

    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: expect.objectContaining({
          category: "WEBHOOK",
          priority: "critical",
          high_priority: "true",
          action: "AMOUNT_MISMATCH",
        }),
      }),
    );
  });

  it("structuredLog emits timestamp, event name, and environment context", () => {
    structuredLog("info", "RECONCILIATION_COMPLETED", { processedDeals: 15 });

    expect(logger.info).toHaveBeenCalledWith(
      "[OBSERVABILITY] RECONCILIATION_COMPLETED",
      expect.objectContaining({
        event: "RECONCILIATION_COMPLETED",
        processedDeals: 15,
        timestamp: expect.any(String),
      }),
    );
  });
});
