import { NextRequest, NextResponse } from "next/server";
import { apiWrapper } from "@/lib/api-wrapper";
import { validateCronSecret } from "../guard";
import prisma from "@/lib/db";
import { PaymentService } from "@/services/payment.service";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";
import { acquireDistributedLock, releaseDistributedLock } from "@/lib/lock";

const CRON_LAST_RUN_KEY = "cron:reconcile-payouts:last_run";
const CRON_LOCK_KEY = "cron:reconcile-payouts:lock";
const LOCK_TTL_SECS = 300;

interface ReconcileResult {
  success: boolean;
  escalated: boolean;
}

async function reconcileSingleDeal(dealId: string): Promise<ReconcileResult> {
  try {
    await PaymentService.processDealCompletion(dealId);
    await prisma.deal.update({
      where: { id: dealId },
      data: { reconcileFailures: 0 },
    });
    return { success: true, escalated: false };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    let count = 1;
    try {
      const updated = await prisma.deal.update({
        where: { id: dealId },
        data: { reconcileFailures: { increment: 1 } },
        select: { reconcileFailures: true },
      });
      count = updated.reconcileFailures;
    } catch (updateErr) {
      logger.error("Failed to increment reconcileFailures on deal", { dealId, error: updateErr });
    }

    if (count >= 3) {
      logger.critical(
        "RECONCILE_ESCALATION: Deal has failed reconciliation 3+ times requires manual admin intervention",
        { dealId, failureCount: count, error: errMsg },
      );
      return { success: false, escalated: true };
    }

    logger.error("Failed to reconcile verified deal payout", { dealId, attempt: count, error: errMsg });
    return { success: false, escalated: false };
  }
}

async function _handler_POST(_req: NextRequest) {
  await validateCronSecret(_req);

  const lockToken = await acquireDistributedLock(CRON_LOCK_KEY, LOCK_TTL_SECS);
  if (!lockToken) {
    logger.warn("cron:reconcile-payouts: Lock already held, skipping concurrent run.");
    return NextResponse.json({
      success: true,
      message: "Another reconciliation instance is currently running",
      data: { locked: true },
    });
  }

  try {
    const verifiedDeals = await prisma.deal.findMany({
      where: {
        OR: [
          { status: "VERIFIED" },
          { status: "CONTENT_APPROVED", requiresPostVerification: false },
        ],
        completedAt: null,
        deletedAt: null,
        reconcileFailures: { lt: 3 },
      },
      select: { id: true },
      take: 100,
      orderBy: { createdAt: "asc" },
    });

    logger.info("Found verified deals needing payout reconciliation", { count: verifiedDeals.length });

    let successCount = 0;
    let failureCount = 0;
    const escalated: string[] = [];

    for (const deal of verifiedDeals) {
      try {
        const result = await reconcileSingleDeal(deal.id);
        if (result.success) {
          successCount++;
        } else {
          failureCount++;
          if (result.escalated) escalated.push(deal.id);
        }
      } catch (loopErr) {
        failureCount++;
        logger.error("Unexpected error in reconcile loop for deal", { dealId: deal.id, error: loopErr });
      }
    }

    try {
      await redis.set(CRON_LAST_RUN_KEY, String(Date.now()), "EX", 172800);
    } catch (redisErr) {
      logger.warn("reconcile-payouts: failed to write last_run timestamp to Redis", { error: redisErr });
    }

    return NextResponse.json({
      success: true,
      message: "Reconciliation complete",
      totalProcessed: verifiedDeals.length,
      successCount,
      failureCount,
      escalated,
    });
  } finally {
    await releaseDistributedLock(CRON_LOCK_KEY, lockToken);
  }
}

export const GET = apiWrapper(_handler_POST);
export const POST = apiWrapper(_handler_POST);

