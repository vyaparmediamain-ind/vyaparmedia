import { NextRequest, NextResponse } from "next/server";
import { apiWrapper, type AuthenticatedRequest } from "@/lib/api-wrapper";
import { requireActiveAdmin } from "@/lib/admin-auth";
import prisma from "@/lib/db";
import { JobCategory, JobStatus, Prisma } from "@prisma/client";
import { publishJob, type PublishJobOptions } from "@/lib/qstash";
import { logger } from "@/lib/logger";
import { createActivityLog } from "@/lib/audit";
import { getTopicDefinition } from "@/lib/job-topics";

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

  // Enrich with registry metadata (payload schema/preview, manual status, runbook)
  const enrichedJobs = failedJobs.map((job) => {
    const topicDef = getTopicDefinition(job.topic);
    return {
      ...job,
      registry: topicDef
        ? {
            isMoneyImpacting: topicDef.isMoneyImpacting,
            requiresAdminApproval: topicDef.requiresAdminApproval,
            isManualOnly: topicDef.isManualOnly ?? false,
            runbookNote: topicDef.runbookNote ?? null,
            maxReplays: topicDef.maxReplays,
          }
        : null,
    };
  });

  return NextResponse.json({
    success: true,
    total,
    jobs: enrichedJobs,
  });
}

async function _handler_POST(req: NextRequest) {
  const session = (req as AuthenticatedRequest).session;
  await requireActiveAdmin(session.user);

  const body = await req.json();
  const { dlqId, action, confirm } = body;

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

    await createActivityLog({
      userId: session.user.id,
      action: "ADMIN_DLQ_JOB_DISCARDED",
      entityType: "DEAD_LETTER_JOB",
      entityId: dlqId,
      metadata: {
        topic: deadJob.topic,
        attempts: deadJob.attempts,
      },
    });

    return NextResponse.json({ success: true, message: "Job discarded", job: updated });
  }

  // Validate topic in registry
  const topicDef = getTopicDefinition(deadJob.topic);
  if (!topicDef) {
    logger.critical("Admin attempted replay of unregistered DLQ topic", { dlqId, topic: deadJob.topic });
    return NextResponse.json(
      {
        error: `Topic "${deadJob.topic}" is not registered in JOB_TOPICS_REGISTRY. Automated replay is forbidden.`,
      },
      { status: 400 }
    );
  }

  if (topicDef.isManualOnly || topicDef.maxReplays === 0) {
    return NextResponse.json(
      {
        error: `Topic "${deadJob.topic}" is marked as manual-only or has maxReplays set to 0. Automated replay is forbidden.`,
        runbookNote: topicDef.runbookNote,
      },
      { status: 400 }
    );
  }

  // Strict Max Replays Enforcement (prevent infinite replay loops on money-impacting and system topics)
  if (deadJob.attempts >= topicDef.maxReplays) {
    return NextResponse.json(
      {
        error: `Topic "${deadJob.topic}" has reached its maximum replay limit of ${topicDef.maxReplays} attempts. Manual intervention or discard required.`,
        attempts: deadJob.attempts,
        maxReplays: topicDef.maxReplays,
        runbookNote: topicDef.runbookNote,
      },
      { status: 400 }
    );
  }

  if ((topicDef.isMoneyImpacting || topicDef.requiresAdminApproval) && !confirm) {
    return NextResponse.json(
      {
        error: `Topic "${deadJob.topic}" impacts money or ledger state. Replay requires explicit confirmation (confirm: true).`,
        requiresConfirmation: true,
      },
      { status: 400 }
    );
  }

  // Re-enqueue job back to QStash targeting the universal /api/jobs/consumer endpoint
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

  await createActivityLog({
    userId: session.user.id,
    action: "ADMIN_DLQ_JOB_REPLAY_INITIATED",
    entityType: "DEAD_LETTER_JOB",
    entityId: dlqId,
    metadata: {
      topic: deadJob.topic,
      attemptsBefore: deadJob.attempts,
      endpoint: "/api/jobs/consumer",
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

  // Universal target is /api/jobs/consumer
  const publishOptions: PublishJobOptions<Record<string, unknown>> = {
    endpoint: "/api/jobs/consumer",
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
        { status: 502 }
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
