import { Client } from "@upstash/qstash";
import { logger } from "./logger";
import prisma from "./db";
import { JobCategory, JobStatus, Prisma } from "@prisma/client";
import { NotificationService } from "@/services/notification.service";

/**
 * Upstash QStash Enterprise Queue Engine
 * 
 * Implements:
 * 1. Categorized job tiers (time-critical, scheduled, best-effort) with explicit retry & backoff
 * 2. Mandatory deduplicationId for sensitive workflows (payments, reconciliations)
 * 3. Payload size validation (<8KB) to enforce ID/reference passing over bloated state
 * 4. Dead-Letter Queue (DLQ) persistent storage and automatic admin escalation
 */

let _qstashClient: Client | null = null;

export function getQStashClient(): Client | null {
  const token = process.env.QSTASH_TOKEN;
  if (!token) {
    return null;
  }
  if (!_qstashClient) {
    _qstashClient = new Client({ token });
  }
  return _qstashClient;
}

export type QStashJobCategory = "time-critical" | "scheduled" | "best-effort";

export interface QStashJobConfig {
  retries: number;
  timeoutSeconds: number;
  backoffMode: "exponential" | "linear";
  failureCallbackPath: string;
}

export const JOB_CATEGORY_CONFIGS: Record<QStashJobCategory, QStashJobConfig> = {
  "time-critical": {
    retries: 5,
    timeoutSeconds: 60,
    backoffMode: "exponential",
    failureCallbackPath: "/api/jobs/dlq",
  },
  "scheduled": {
    retries: 3,
    timeoutSeconds: 120,
    backoffMode: "exponential",
    failureCallbackPath: "/api/jobs/dlq",
  },
  "best-effort": {
    retries: 2,
    timeoutSeconds: 30,
    backoffMode: "linear",
    failureCallbackPath: "/api/jobs/dlq",
  },
};

export interface BaseJobPayload {
  topic?: string | undefined;
  category?: QStashJobCategory | undefined;
  deduplicationId?: string | undefined;
  timestamp?: number | undefined;
  [key: string]: unknown;
}

export interface WebhookJobPayload extends BaseJobPayload {
  eventId: string;
  eventType: string;
  rawBody: string;
  payload: unknown;
  topic?: string | undefined;
  category?: QStashJobCategory | undefined;
}

export interface PublishJobOptions<T extends Record<string, unknown>> {
  endpoint: string;
  topic: string;
  category: QStashJobCategory;
  payload: T;
  deduplicationId?: string | undefined;
  delaySeconds?: number | undefined;
  cronExpression?: string | undefined;
  directProcessor?: ((payload: T) => Promise<unknown>) | undefined;
}

export interface PublishJobResult {
  enqueued: boolean;
  messageId?: string | undefined;
  deduplicationId?: string | undefined;
}

const MAX_PAYLOAD_BYTES = 8192; // 8KB payload budget to enforce light reference passing

/**
 * Validates that the payload only passes light IDs and references, not bulk records.
 */
function validatePayloadBudget(payload: unknown): void {
  try {
    const json = JSON.stringify(payload);
    const size = Buffer.byteLength(json, "utf-8");
    if (size > MAX_PAYLOAD_BYTES) {
      throw new Error(
        `QStash payload size of ${size} bytes exceeds maximum allowed budget of ${MAX_PAYLOAD_BYTES} bytes. Pass entity IDs instead of full records.`,
      );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("exceeds maximum")) throw err;
    // circular structures etc
    throw new Error(`Invalid JSON payload: ${message}`);
  }
}

function getBaseAppUrl(): string {
  return (
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_BASE_URL ||
    "https://vyaparmedia-nine.vercel.app"
  ).replace(/\/$/, "");
}

/**
 * Publishes a background job into QStash with explicit category configs, backoff headers, and DLQ callback.
 */
export async function publishJob<T extends Record<string, unknown>>(
  options: PublishJobOptions<T>,
): Promise<PublishJobResult> {
  const {
    endpoint,
    topic,
    category,
    payload,
    deduplicationId,
    delaySeconds,
    cronExpression,
    directProcessor,
  } = options;

  // 1. Validate payload size
  validatePayloadBudget(payload);

  // 2. Validate deduplicationId for critical and scheduled jobs
  if ((category === "time-critical" || category === "scheduled") && !deduplicationId) {
    throw new Error(`deduplicationId is mandatory for ${category} jobs to guarantee at-most-once delivery.`);
  }

  const categoryConfig = JOB_CATEGORY_CONFIGS[category];
  const baseUrl = getBaseAppUrl();
  const destinationUrl = endpoint.startsWith("http") ? endpoint : `${baseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
  const failureCallbackUrl = `${baseUrl}${categoryConfig.failureCallbackPath}`;

  const client = getQStashClient();

  if (client) {
    try {
      const publishHeaders: Record<string, string> = {
        "Upstash-Retries": String(categoryConfig.retries),
        "Upstash-Timeout": `${categoryConfig.timeoutSeconds}s`,
        "Upstash-Failure-Callback": failureCallbackUrl,
      };

      if (deduplicationId) {
        publishHeaders["Upstash-Deduplication-Id"] = deduplicationId;
      }

      if (delaySeconds && delaySeconds > 0) {
        publishHeaders["Upstash-Delay"] = `${delaySeconds}s`;
      }

      if (cronExpression) {
        publishHeaders["Upstash-Cron"] = cronExpression;
      }

      const enrichedPayload: BaseJobPayload = {
        ...payload,
        topic,
        category,
        deduplicationId,
        timestamp: Date.now(),
      };

      const publishOptions: Parameters<typeof client.publishJSON>[0] = {
        url: destinationUrl,
        body: enrichedPayload,
        headers: publishHeaders,
        retries: categoryConfig.retries,
      };

      if (deduplicationId) {
        publishOptions.deduplicationId = deduplicationId;
      }

      const res = (await client.publishJSON(publishOptions)) as { messageId?: string } | { messageId?: string }[] | undefined;
      const returnedMessageId = Array.isArray(res) ? res[0]?.messageId : res?.messageId;

      logger.info("Background job published to QStash", {
        topic,
        category,
        messageId: returnedMessageId,
        deduplicationId,
        destinationUrl,
      });

      return {
        enqueued: true,
        messageId: returnedMessageId,
        deduplicationId,
      };
    } catch (error: unknown) {
      logger.error("Failed to publish job to QStash, checking fallback", {
        topic,
        category,
        deduplicationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // 3. Fallback when QStash is not configured or in local development
  if (directProcessor) {
    setImmediate(async () => {
      try {
        await directProcessor(payload);
      } catch (err: unknown) {
        logger.error("Direct fallback job execution failed", {
          topic,
          category,
          error: err instanceof Error ? err.message : String(err),
        });

        // Record directly into DLQ so failed fallback operations aren't silently lost
        await recordDeadLetterJob({
          endpoint,
          topic,
          category,
          deduplicationId,
          payload,
          errorMessage: err instanceof Error ? err.message : String(err),
          errorStack: err instanceof Error ? err.stack : undefined,
          attempts: 1,
          maxRetries: categoryConfig.retries,
        });
      }
    });
  }

  return {
    enqueued: false,
    deduplicationId,
  };
}

export interface DeadLetterJobInput {
  jobId?: string | undefined;
  endpoint: string;
  category: QStashJobCategory;
  topic: string;
  deduplicationId?: string | undefined;
  payload: unknown;
  errorMessage: string;
  errorStack?: string | undefined;
  attempts?: number | undefined;
  maxRetries?: number | undefined;
}

/**
 * Persists an exhausted/failed job into the Dead-Letter Queue (DLQ) table
 * and notifies admins for high-severity failures.
 */
export async function recordDeadLetterJob(entry: DeadLetterJobInput) {
  try {
    const prismaCategory =
      entry.category === "time-critical"
        ? JobCategory.TIME_CRITICAL
        : entry.category === "scheduled"
        ? JobCategory.SCHEDULED
        : JobCategory.BEST_EFFORT;

    const dlqRecord = await prisma.deadLetterJob.create({
      data: {
        jobId: entry.jobId || null,
        endpoint: entry.endpoint,
        category: prismaCategory,
        topic: entry.topic,
        deduplicationId: entry.deduplicationId || null,
        payload: (entry.payload as Prisma.InputJsonValue) || {},
        errorMessage: entry.errorMessage || "Unknown background job error",
        errorStack: entry.errorStack || null,
        attempts: entry.attempts || 1,
        maxRetries: entry.maxRetries || 3,
        status: JobStatus.FAILED,
      },
    });

    logger.critical("DEAD_LETTER_JOB_RECORDED: Job exhausted retries and moved to DLQ", {
      dlqId: dlqRecord.id,
      topic: entry.topic,
      category: entry.category,
      endpoint: entry.endpoint,
    });

    // Alert admins immediately for critical or scheduled jobs
    if (entry.category === "time-critical" || entry.category === "scheduled") {
      const adminUsers = await prisma.user.findMany({
        where: { userType: "ADMIN", status: "ACTIVE" },
        select: { id: true },
        take: 10,
      });

      if (adminUsers.length > 0) {
        const notifications = adminUsers.map((admin) => ({
          userId: admin.id,
          type: "admin_alert",
          title: `🚨 Dead-Letter Queue Alert: [${entry.category.toUpperCase()}] ${entry.topic}`,
          message: `A background job permanently failed after max retries: ${entry.errorMessage.substring(0, 180)}...`,
          data: {
            dlqId: dlqRecord.id,
            topic: entry.topic,
            endpoint: entry.endpoint,
          },
        }));

        await NotificationService.createNotifications(notifications).catch((nErr) => {
          logger.warn("Failed to dispatch admin notification for DLQ", { error: nErr });
        });
      }
    }

    return dlqRecord;
  } catch (dlqErr) {
    logger.error("FATAL: Failed to record job to DeadLetterJob table", {
      error: dlqErr instanceof Error ? dlqErr.message : String(dlqErr),
      entry,
    });
    return null;
  }
}

/**
 * Backward-compatible wrapper for publishWebhookJob
 */
export async function publishWebhookJob(
  job: WebhookJobPayload,
  directProcessor?: (job: WebhookJobPayload) => Promise<unknown>,
): Promise<{ enqueued: boolean; deduplicationId: string }> {
  const options: PublishJobOptions<WebhookJobPayload> = {
    endpoint: "/api/webhooks/razorpay/process",
    topic: `webhook.${job.eventType}`,
    category: "time-critical",
    deduplicationId: job.eventId,
    payload: job,
  };

  if (directProcessor) {
    options.directProcessor = directProcessor;
  }

  const result = await publishJob(options);

  return {
    enqueued: result.enqueued,
    deduplicationId: job.eventId,
  };
}
