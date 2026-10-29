import { NextRequest, NextResponse } from "next/server";
import { secureQStashEndpoint } from "@/lib/qstash-guard";
import { logger } from "@/lib/logger";
import prisma from "@/lib/db";
import {
  claimIdempotencyKey,
  saveIdempotencyResponse,
  releaseIdempotencyKey,
} from "@/lib/idempotency";
import { sendWithdrawalEmail } from "@/lib/email";
import { checkAndAwardBadges } from "@/lib/gamification-engine";
import { checkChallengeProgress } from "@/lib/weekly-challenges";
import { DealService } from "@/services/deal.service";

export const dynamic = "force-dynamic";

/**
 * General QStash Background Job Consumer Endpoint
 * 
 * Protected by `secureQStashEndpoint`.
 * Expects lightweight payloads with entity IDs only, then loads full models fresh from DB.
 */
async function _handler_POST(request: NextRequest) {
  const job = (await request.json()) as {
    topic: string;
    category: string;
    deduplicationId?: string;
    // Lightweight reference IDs:
    userId?: string;
    dealId?: string;
    withdrawalId?: string;
    action?: string;
    metadata?: Record<string, unknown>;
  };

  logger.info("QStash consumer processing job", {
    topic: job.topic,
    category: job.category,
    deduplicationId: job.deduplicationId,
  });

  const dedupKey = job.deduplicationId ? `job:dedup:${job.deduplicationId}` : null;

  if (dedupKey) {
    const claim = await claimIdempotencyKey(dedupKey);
    if (claim.isDuplicate) {
      logger.info("QStash consumer skipping duplicate job execution", {
        deduplicationId: job.deduplicationId,
        topic: job.topic,
      });
      return NextResponse.json({
        success: true,
        message: "Duplicate job skipped",
        deduplicationId: job.deduplicationId,
        savedResponse: claim.savedResponse,
      });
    }
  }

  try {
    const response = await processJobPayload(job);
    if (dedupKey) {
      await saveIdempotencyResponse(dedupKey, {
        success: true,
        topic: job.topic,
        completedAt: new Date().toISOString(),
      });
    }
    return response;
  } catch (err) {
    if (dedupKey) {
      await releaseIdempotencyKey(dedupKey);
    }
    throw err;
  }
}

async function processJobPayload(job: {
  topic: string;
  category: string;
  deduplicationId?: string;
  userId?: string;
  dealId?: string;
  withdrawalId?: string;
  action?: string;
  metadata?: Record<string, unknown>;
}): Promise<NextResponse> {
  switch (job.topic) {
    case "email.withdrawal": {
      if (!job.withdrawalId) {
        return NextResponse.json({ error: "Missing withdrawalId reference" }, { status: 400 });
      }
      const withdrawal = await prisma.withdrawal.findUnique({
        where: { id: job.withdrawalId },
        include: { wallet: { include: { user: { select: { email: true } } } } },
      });
      if (withdrawal?.wallet.user.email) {
        await sendWithdrawalEmail(
          withdrawal.wallet.user.email,
          withdrawal.amount,
          withdrawal.status === "COMPLETED" ? "success" : "failed",
        );
      }
      return NextResponse.json({ success: true, processed: "email.withdrawal" });
    }

    case "gamification.evaluate_badges": {
      if (!job.userId) {
        return NextResponse.json({ error: "Missing userId reference" }, { status: 400 });
      }
      const trigger = (job.action as Parameters<typeof checkAndAwardBadges>[1]) || "LOGIN";
      await checkAndAwardBadges(job.userId, trigger);
      return NextResponse.json({ success: true, processed: "gamification.evaluate_badges" });
    }

    case "gamification.evaluate_challenge": {
      if (!job.userId || !job.action) {
        return NextResponse.json({ error: "Missing userId or action reference" }, { status: 400 });
      }
      const metricValue = typeof job.metadata?.metricValue === "number" ? job.metadata.metricValue : 1;
      await checkChallengeProgress(job.userId, job.action as Parameters<typeof checkChallengeProgress>[1], metricValue);
      return NextResponse.json({ success: true, processed: "gamification.evaluate_challenge" });
    }

    case "deal.auto_approve_timeout":
    case "cron.auto_approve_timeout": {
      const result = await DealService.autoApproveExpiredContent();
      return NextResponse.json({ success: true, processed: job.topic, result });
    }

    case "test.deliberate_failure": {
      // Endpoint used to verify retry and DLQ routing
      throw new Error(`Deliberate failure triggered for test: ${job.metadata?.reason || "Testing DLQ"}`);
    }

    default:
      logger.warn("Unhandled job topic in consumer", { topic: job.topic });
      return NextResponse.json({ success: true, message: `Topic ${job.topic} acknowledged` });
  }
}

export const POST = secureQStashEndpoint(_handler_POST);
