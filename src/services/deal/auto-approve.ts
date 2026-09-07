import { PaymentService } from "@/services/payment.service";
import { redis } from "@/lib/redis";
import { invalidateDealCache, ExpiredDealCandidate } from "./helpers";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";
import { sendDealNotificationEmail } from "@/lib/email";
import { NotificationService } from "@/services/notification.service";

async function sendAutoApproveEmails(deal: ExpiredDealCandidate) {
try {
const [influencerUser, brandUser] = await Promise.all([
prisma.user.findUnique({ where: { id: deal.influencer.userId }, select: { email: true } }),
deal.brand?.userId
? prisma.user.findUnique({ where: { id: deal.brand.userId }, select: { email: true } })
: null
]);

if (influencerUser?.email) {
await sendDealNotificationEmail(
influencerUser.email,
deal.campaign.title,
`Your content for "${deal.campaign.title}" was auto-approved because the brand's review window expired.`
);
}

if (brandUser?.email) {
await sendDealNotificationEmail(
brandUser.email,
deal.campaign.title,
`Content for "${deal.campaign.title}" was auto-approved because your ${deal.reviewPeriodHours || 48}-hour brand review window expired.`
);
}
} catch (mailErr) {
logger.warn("Auto-approval email notification failed - non-fatal", { error: mailErr, dealId: deal.id });
}
}
async function autoApproveDealTx(
  deal: ExpiredDealCandidate,
  now: Date,
  latestSubmission: { id: string; status: string }
): Promise<boolean> {
return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
const submissionUpdate = await tx.contentSubmission.updateMany({
where: { id: latestSubmission.id, status: "PENDING" },
data: { status: "APPROVED", reviewedAt: now },
});

    if (submissionUpdate.count === 0) {
      // H12 FIX: Must throw (not return false) to trigger Prisma transaction rollback.
      // Returning false COMMITS the transaction, leaving contentSubmission=APPROVED
      // while deal status remains unchanged — a permanently inconsistent state.
      throw new Error("SUBMISSION_ALREADY_PROCESSED");
    }

    const dealUpdate = await tx.deal.updateMany({
      where: { id: deal.id, status: "CONTENT_SUBMITTED" },
      data: {
        status: "CONTENT_APPROVED",
        approvedAt: now,
        rejectionReason: null,
      },
    });

    if (dealUpdate.count === 0) {
      throw new Error("DEAL_NOT_ELIGIBLE_FOR_AUTO_APPROVE");
    }

await NotificationService.createNotification({
userId: deal.influencer.userId,
type: "deal_update",
title: "Content auto-approved",
message: `Your content for "${deal.campaign.title}" was auto-approved after the brand review window expired.`,
data: { link: `/dashboard/deals/${deal.id}` },
}, tx);

if (deal.brand?.userId) {
await NotificationService.createNotification({
userId: deal.brand.userId,
type: "deal_update",
title: "Review window expired",
message: `Content for "${deal.campaign.title}" was auto-approved because the review window expired.`,
data: { link: `/dashboard/deals/${deal.id}` },
}, tx);
}

return true;
});
}



async function autoApproveSingleExpiredDeal(deal: ExpiredDealCandidate, now: Date): Promise<boolean> {
const latestSubmission = deal.contentSubmissions[0];
if (latestSubmission?.status !== "PENDING") {
return false;
}

const updated = await autoApproveDealTx(deal, now, latestSubmission);

if (updated) {
await invalidateDealCache(deal.id);

if (deal.requiresPostVerification === false) {
try {
await PaymentService.processDealCompletion(deal.id);
await invalidateDealCache(deal.id);
} catch (error) {
logger.error("Failed to process auto-approved deal payment immediately", {
dealId: deal.id,
error,
});
}
}

sendAutoApproveEmails(deal).catch(() => {});
return true;
}
return false;
}


async function processBatchOfCandidateDeals(
  candidateDeals: ExpiredDealCandidate[],
  now: Date,
): Promise<{ processed: number; skipped: number }> {
  let processed = 0;
  let skipped = 0;

  const expiredDeals = candidateDeals.filter((deal) => {
    if (!deal.submittedAt) return false;
    const reviewWindowMs =
      Math.max(deal.reviewPeriodHours || 48, 1) * 60 * 60 * 1000;
    return now.getTime() - deal.submittedAt.getTime() >= reviewWindowMs;
  });

  for (const deal of expiredDeals) {
    try {
      const approved = await autoApproveSingleExpiredDeal(deal, now);
      if (approved) {
        processed += 1;
      } else {
        skipped += 1;
      }
    } catch (err) {
      logger.error("auto-approve: failed to process deal, skipping to next", {
        dealId: deal.id,
        error: err instanceof Error ? err.message : String(err),
      });
      skipped += 1;
    }
  }

  return { processed, skipped };
}

export async function autoApproveExpiredContent(now: Date = new Date()) {
  const lockKey = "cron:auto_approve_expired_content:lock";
  const acquired = await redis.set(lockKey, "LOCKED", "EX", 300, "NX");
  if (!acquired) {
    logger.info("autoApproveExpiredContent already running, skipping to avoid race condition.");
    return { processed: 0, skipped: 0, scanned: 0, locked: true };
  }

  try {
    // Batch processing to prevent OOM - process 200 deals at a time
    const BATCH_SIZE = 200;
    let processed = 0;
    let skipped = 0;
    let scanned = 0;
    let hasMore = true;
    let cursor: string | undefined = undefined;

    while (hasMore) {
      // Extend the lock for another 5 minutes during processing to prevent expiration under heavy backlog
      await redis.expire(lockKey, 300);

      const candidateDeals = await prisma.deal.findMany({
        where: {
          status: "CONTENT_SUBMITTED",
          submittedAt: { not: null },
          deletedAt: null,
          ...(cursor ? { id: { gt: cursor } } : {}),
        },
        select: {
          id: true,
          submittedAt: true,
          reviewPeriodHours: true,
          requiresPostVerification: true,
          campaign: { select: { title: true } },
          influencer: { select: { userId: true } },
          brand: { select: { userId: true } },
          contentSubmissions: {
            orderBy: { version: "desc" },
            take: 1,
            select: { id: true, status: true },
          },
        },
        orderBy: { id: "asc" },
        take: BATCH_SIZE,
      });

      scanned += candidateDeals.length;
      hasMore = candidateDeals.length === BATCH_SIZE;

      if (candidateDeals.length > 0) {
        cursor = candidateDeals.at(-1)?.id as string;
      }

      const result = await processBatchOfCandidateDeals(candidateDeals, now);
      processed += result.processed;
      skipped += result.skipped;
    }

    return {
      processed,
      skipped,
      scanned,
    };
  } finally {
    await redis.del("cron:auto_approve_expired_content:lock");
  }
}
export function accumulateVerificationFlags(
verificationResult: { action: string; passed: boolean; flags: Array<{ rule?: string; description?: string }> },
uniquenessResult: { action: string; passed: boolean; flags: Array<{ rule?: string; description?: string }> } | null,
privacyResult: { action: string; passed: boolean; flags: Array<{ rule?: string; description?: string }> },
): { isBlocked: boolean; needsReview: boolean; verificationFlags: Array<{ rule?: string; description?: string }> } {
let isBlocked = verificationResult.action === "BLOCK";
let needsReview = verificationResult.action === "REVIEW" || !verificationResult.passed;
const verificationFlags = [...verificationResult.flags];

if (uniquenessResult) {
if (uniquenessResult.action === "BLOCK") {
isBlocked = true;
}
if (uniquenessResult.action === "REVIEW" || uniquenessResult.action === "FLAG" || !uniquenessResult.passed) {
needsReview = true;
}
verificationFlags.push(...uniquenessResult.flags);
}

if (privacyResult.action === "BLOCK") {
isBlocked = true;
}
if (privacyResult.action === "REVIEW" || privacyResult.action === "FLAG" || !privacyResult.passed) {
needsReview = true;
}
verificationFlags.push(...privacyResult.flags);

return { isBlocked, needsReview, verificationFlags };
}

