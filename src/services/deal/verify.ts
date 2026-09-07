import { checkChallengeProgress } from "@/lib/weekly-challenges";
import { accumulateVerificationFlags } from "./auto-approve";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { checkPostVerification, checkContentUniqueness, checkAccountPrivacyFlip } from "@/lib/fraud-detection";
import { PaymentService } from "@/services/payment.service";
import { logger } from "@/lib/logger";
import { getErrorMessage } from "@/lib/utils";
import { invalidateDealCache, normalizeMandatoryElements, formatFraudFlags } from "./helpers";

export async function verifyPost(userId: string, dealId: string, postUrl: string): Promise<{ success: boolean; status: "VERIFIED" | "VERIFICATION_PENDING" }> {
const deal = await prisma.deal.findUnique({
where: { id: dealId },
include: { influencer: { select: { userId: true } }, campaign: true },
});

  if (!deal) {
    throw AppError.notFound("Deal not found");
  }
  if (deal.influencer.userId !== userId) {
    throw AppError.forbidden("Unauthorized");
  }
if (!["CONTENT_APPROVED", "POSTED"].includes(deal.status))
throw AppError.badRequest("Content must be approved before posting");

const contractTerms = deal.contractTerms as {
mandatoryElements?: unknown;
mandatoryTags?: unknown;
} | null;
const mandatoryElements = normalizeMandatoryElements(contractTerms);

// Fetch influencer follower count so Rule 7 (engagement anomaly) has real data
const influencerProfile = await prisma.influencerProfile.findUnique({
where: { userId: deal.influencer.userId },
select: { instagramFollowers: true, youtubeSubscribers: true },
});
const followerCount =
(influencerProfile?.instagramFollowers ?? 0) +
(influencerProfile?.youtubeSubscribers ?? 0);

const verificationResult = await checkPostVerification({
dealId: deal.id,
influencerUserId: deal.influencer.userId,
postUrl,
requiredTags: mandatoryElements.filter((element) => !element.startsWith("#")),
requiredHashtags: mandatoryElements.filter((element) => element.startsWith("#")),
postingDeadline: deal.postingDeadline,
followerCount,
dealAmount: deal.amount,
});

  const uniquenessResult =
    deal.verificationHash && deal.verificationHash.trim().length > 0
      ? await checkContentUniqueness(deal.verificationHash, deal.id)
      : null;

const privacyResult = await checkAccountPrivacyFlip(deal.influencer.userId, postUrl);

const { isBlocked, needsReview, verificationFlags } = accumulateVerificationFlags(
verificationResult,
uniquenessResult,
privacyResult,
);

// BLOCK: hard failure influencer cannot proceed
if (isBlocked) {
throw AppError.badRequest(`Post verification failed: ${formatFraudFlags(verificationFlags)}`,
);
}

const resultStatus = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
// LOCK THE DEAL ROW to prevent race conditions during verification using raw SQL SELECT FOR UPDATE
await tx.$queryRaw`SELECT id FROM "Deal" WHERE id = ${dealId} FOR UPDATE`;
const lockedDeal = await tx.deal.findUnique({
where: { id: dealId },
});

if (!lockedDeal) {
throw AppError.notFound("Deal not found");
}

if (!["CONTENT_APPROVED", "POSTED"].includes(lockedDeal.status)) {
throw AppError.badRequest("Deal must be in CONTENT_APPROVED or POSTED status. It might have already been verified.");
}

const finalStatus = needsReview ? "VERIFICATION_PENDING" : "VERIFIED";

const updated = await tx.deal.update({
where: { id: dealId },
data: {
status: finalStatus,
postUrl,
postedAt: new Date(),
...(needsReview ? {} : { verifiedAt: new Date() }),
},
});

return updated.status;
});

await invalidateDealCache(dealId);

if (resultStatus === "VERIFIED") {
// Process Payment (Capture & Credit)
try {
await PaymentService.processDealCompletion(dealId);
await invalidateDealCache(dealId);

// Track weekly challenge progress for deal completion
await checkChallengeProgress(userId, "DEALS", 1).catch((err) => {
logger.error("Failed to track challenge progress for deal completion", { userId, dealId, error: err });
});
} catch (error: unknown) {
const errMessage = getErrorMessage(error);
if (errMessage === "LATE_POST_PAYMENT_BLOCKED") {
// Influencer posted after deadline payout intentionally blocked.
// CRITICAL: Funds are now stuck in escrow. Admin must manually review
// this deal and either issue a payout override or refund the brand.
logger.critical("LATE_POST_PAYOUT_STUCK: Deal VERIFIED but payment blocked admin action required", {
dealId,
error: errMessage,
});
} else {
logger.error("Failed to process deal payment immediately", {
dealId,
error,
});
// Don't fail the verification request; the reconcile-payouts cron will retry
}
}
}

return { success: true, status: resultStatus as "VERIFIED" | "VERIFICATION_PENDING" };
}