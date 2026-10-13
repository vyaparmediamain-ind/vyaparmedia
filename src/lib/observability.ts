import "server-only";
import * as Sentry from "@sentry/nextjs";
import { logger } from "@/lib/logger";

export type ObservabilityCategory =
  | "PAYMENT"
  | "WEBHOOK"
  | "ESCROW"
  | "LEDGER"
  | "KYC"
  | "STATE_MACHINE"
  | "SYSTEM";

export type ObservabilityPriority = "low" | "medium" | "high" | "critical";

export interface ErrorReportingOptions {
  category: ObservabilityCategory;
  priority?: ObservabilityPriority | undefined;
  action?: string | undefined;
  userId?: string | undefined;
  transactionId?: string | undefined;
  orderId?: string | undefined;
  dealId?: string | undefined;
  details?: Record<string, unknown> | undefined;
}

/**
 * Structured logger formatted for Axiom / Better Stack JSON ingestion.
 */
export function structuredLog(
  level: "info" | "warn" | "error" | "debug" | "critical",
  event: string,
  payload: Record<string, unknown> = {},
) {
  const structuredEntry = {
    timestamp: new Date().toISOString(),
    event,
    environment: process.env.NODE_ENV || "development",
    ...payload,
  };

  if (level === "critical") {
    logger.critical(`[OBSERVABILITY] ${event}`, structuredEntry);
  } else if (level === "error") {
    logger.error(`[OBSERVABILITY] ${event}`, undefined, structuredEntry);
  } else if (level === "warn") {
    logger.warn(`[OBSERVABILITY] ${event}`, structuredEntry);
  } else if (level === "debug") {
    logger.debug(`[OBSERVABILITY] ${event}`, structuredEntry);
  } else {
    logger.info(`[OBSERVABILITY] ${event}`, structuredEntry);
  }
}

/**
 * Capture a critical application error with Sentry tags (high_priority, category, priority)
 * and structured JSON logging.
 */
export function captureCriticalError(
  error: unknown,
  options: ErrorReportingOptions,
): string {
  const {
    category,
    priority = "high",
    action = "unknown_action",
    userId,
    transactionId,
    orderId,
    dealId,
    details = {},
  } = options;

  const isHighPriority = priority === "high" || priority === "critical";

  // 1. Send to Sentry with explicit tags and extras
  let sentryEventId = "";
  try {
    sentryEventId = Sentry.captureException(error, {
      tags: {
        category,
        priority,
        high_priority: isHighPriority ? "true" : "false",
        action,
        ...(userId ? { userId } : {}),
        ...(transactionId ? { transactionId } : {}),
        ...(dealId ? { dealId } : {}),
      },
      extra: {
        ...details,
        userId,
        transactionId,
        orderId,
        dealId,
        capturedAt: new Date().toISOString(),
      },
    });
  } catch (sentryErr) {
    logger.warn("Failed to capture exception in Sentry", { sentryErr });
  }

  // 2. Structured JSON logging
  const errorObj =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { raw: String(error) };

  structuredLog(isHighPriority ? "critical" : "error", `CRITICAL_ERROR_${category}`, {
    category,
    priority,
    action,
    sentryEventId,
    userId,
    transactionId,
    orderId,
    dealId,
    error: errorObj,
    ...details,
  });

  return sentryEventId;
}

/**
 * Helper specifically for payment failures (e.g. gateway rejections, ambiguous states).
 */
export function recordPaymentFailure(
  action: string,
  error: unknown,
  context: {
    userId?: string;
    transactionId?: string;
    orderId?: string;
    amount?: number;
    reason?: string;
    [key: string]: unknown;
  },
) {
  return captureCriticalError(error, {
    category: "PAYMENT",
    priority: "high",
    action,
    userId: context.userId,
    transactionId: context.transactionId,
    orderId: context.orderId,
    details: context,
  });
}

/**
 * Helper specifically for webhook anomalies (e.g. invalid signature, amount mismatch).
 */
export function recordWebhookAnomaly(
  action: "SIGNATURE_MISMATCH" | "AMOUNT_MISMATCH" | "ORPHAN_EVENT" | "MALFORMED_PAYLOAD",
  context: {
    eventId?: string;
    eventType?: string;
    orderId?: string;
    paymentId?: string;
    expectedAmount?: number;
    receivedAmount?: number;
    [key: string]: unknown;
  },
) {
  const isHighPriority = action === "AMOUNT_MISMATCH" || action === "SIGNATURE_MISMATCH";

  return captureCriticalError(
    new Error(`Webhook Anomaly: ${action}`),
    {
      category: "WEBHOOK",
      priority: isHighPriority ? "critical" : "high",
      action,
      orderId: context.orderId,
      details: context,
    },
  );
}
