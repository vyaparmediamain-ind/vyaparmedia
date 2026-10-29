import { NextRequest, NextResponse } from "next/server";
import { apiWrapper, type AuthenticatedRequest } from "@/lib/api-wrapper";
import { requireActiveAdmin } from "@/lib/admin-auth";
import prisma from "@/lib/db";
import { JobCategory, JobStatus, Prisma } from "@prisma/client";
import { publishJob, type PublishJobOptions } from "@/lib/qstash";
import { logger } from "@/lib/logger";

/**
 * Admin Failed-Jobs (Dead-Letter Queue) Management API
 * 
 * GET: List permanently failed jobs with filtering by category, status, and search.
 * POST: Manually re-dispatch / retry a failed job back into the QStash queue.
 */

async function _handler_GET(req: NextRequest) {
  const session = (req as AuthenticatedRequest).session;
  await requireActiveAdmin(session.user);

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status")?.toUpperCase();
  const categoryParam = searchParams.get("category")?.toUpperCase();
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 50)));

  const where: Prisma.DeadLetterJobWhereInput = {};
  if (statusParam && Object.values(JobStatus).includes(statusParam as JobStatus)) {
    where.status = statusParam as JobStatus;
  }
  if (categoryParam && Object.values(JobCategory).includes(categoryParam as JobCategory)) {
    where.category = categoryParam as JobCategory;
  }

  const [failedJobs, total] = await Promise.all([
    prisma.deadLetterJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.deadLetterJob.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    total,
    jobs: failedJobs,
  });
}

async function _handler_POST(req: NextRequest) {
  const session = (req as AuthenticatedRequest).session;
  await requireActiveAdmin(session.user);

  const body = await req.json();
  const { dlqId, action } = body;

  if (!dlqId) {
    return NextResponse.json({ error: "Missing dlqId" }, { status: 400 });
  }

  const deadJob = await prisma.deadLetterJob.findUnique({
    where: { id: dlqId },
  });

  if (!deadJob) {
    return NextResponse.json({ error: "Dead letter job not found" }, { status: 404 });
  }

  if (action === "discard") {
    const updated = await prisma.deadLetterJob.update({
      where: { id: dlqId },
      data: {
        status: JobStatus.DISCARDED,
        resolvedAt: new Date(),
        resolvedBy: session.user.id,
      },
    });
    return NextResponse.json({ success: true, message: "Job discarded", job: updated });
  }

  // Re-enqueue job back to QStash
  const mappedCategory =
    deadJob.category === JobCategory.TIME_CRITICAL
      ? "time-critical"
      : deadJob.category === JobCategory.SCHEDULED
      ? "scheduled"
      : "best-effort";

  await prisma.deadLetterJob.update({
    where: { id: dlqId },
    data: {
      status: JobStatus.RETRYING,
      attempts: { increment: 1 },
      lastAttemptAt: new Date(),
    },
  });

  logger.info("Admin re-dispatching DLQ job back into queue", {
    dlqId,
    adminId: session.user.id,
    topic: deadJob.topic,
  });

  const payloadObj = (deadJob.payload as Record<string, unknown>) || {};
  const rawEventId =
    (payloadObj.eventId as string) ||
    ((payloadObj.job as Record<string, unknown>)?.eventId as string) ||
    (payloadObj.rawEntityId && payloadObj.eventType
      ? `${payloadObj.eventType}:${payloadObj.rawEntityId}`
      : undefined);

  if (rawEventId) {
    await prisma.processedWebhookEvent
      .deleteMany({
        where: { eventId: rawEventId },
      })
      .catch((delErr) => {
        logger.warn("Failed to clear stale ProcessedWebhookEvent during DLQ replay", { rawEventId, delErr });
      });
  }

  const publishOptions: PublishJobOptions<Record<string, unknown>> = {
    endpoint: deadJob.endpoint,
    topic: deadJob.topic,
    category: mappedCategory,
    payload: (deadJob.payload as Record<string, unknown>) || {},
  };

  if (deadJob.deduplicationId) {
    publishOptions.deduplicationId = `${deadJob.deduplicationId}-retry-${Date.now()}`;
  }

  try {
    const result = await publishJob(publishOptions);

    if (!result.enqueued) {
      await prisma.deadLetterJob.update({
        where: { id: dlqId },
        data: { status: JobStatus.FAILED },
      });
      return NextResponse.json(
        {
          success: false,
          error: "Failed to re-enqueue job into QStash",
          dlqId,
          enqueued: false,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Job re-enqueued for processing",
      dlqId,
      enqueued: result.enqueued,
      messageId: result.messageId,
    });
  } catch (err: unknown) {
    await prisma.deadLetterJob
      .update({
        where: { id: dlqId },
        data: { status: JobStatus.FAILED },
      })
      .catch(() => {});
    throw err;
  }
}

export const GET = apiWrapper(_handler_GET, { requirePermission: "SYSTEM_ADMIN" });
export const POST = apiWrapper(_handler_POST, { requirePermission: "SYSTEM_ADMIN" });
