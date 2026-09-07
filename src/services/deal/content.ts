import { addUserXp } from "@/lib/gamification-engine";
import { checkChallengeProgress } from "@/lib/weekly-challenges";
import { ContractTerms, checkRevisionLimit } from "@/lib/contract-engine";
import { assertSufficientBalance } from "@/lib/utils";
import { checkMessageForContacts } from "@/lib/contact-filter";
import { updateTrustAndLevel } from "@/lib/trust-engine";
import prisma, { ensurePlatformTreasury } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { NotificationService } from "@/services/notification.service";
import { logger } from "@/lib/logger";
import { DealWithRelations, invalidateDealCache, lockAndFetchDealForAction } from "./helpers";

function validateSubmissionEligibility(
  deal: Awaited<ReturnType<typeof lockAndFetchDealForAction>>,
  userId: string,
  dealId: string,
) {
  if (deal.influencer.userId !== userId) {
    logger.warn("Unauthorized content submission attempt", {
      userId,
      dealId,
    });
    throw AppError.forbidden("Unauthorized");
  }

  // PAYMENT GUARD: Only allow submission when brand's payment is secured
  // in escrow (PAYMENT_HELD) or when a revision was requested.
  // ACTIVE alone is NOT sufficient it means contract signed but no payment yet.
  if (!["PAYMENT_HELD", "REVISION_REQUESTED"].includes(deal.status)) {
    throw AppError.badRequest("Payment must be secured before content submission");
  }

  if (
    deal.requiresProduct &&
    deal.productFulfillmentStatus !== "RECEIVED" &&
    deal.status !== "REVISION_REQUESTED"
  ) {
    throw AppError.badRequest("Product must be received before content submission");
  }
}

function formatAndValidateSubmissionUrls(
  contentUrl: string,
  contentUrls?: Array<{ type: string; url: string; status?: string; feedback?: string }>,
) {
  // Initialize statuses on new submission: all pending unless pre-approved
  const formattedUrls = contentUrls?.map((item) => ({
    type: item.type,
    url: item.url,
    status: item.status || "PENDING",
    feedback: item.feedback || "",
  })) || null;

  // Determine fallback contentUrl for backward-compatibility
  const finalContentUrl = contentUrl || (contentUrls?.[0]?.url) || "";

  // Validate that at least one content URL is provided
  if (!finalContentUrl && (!formattedUrls || formattedUrls.length === 0)) {
    throw AppError.badRequest("At least one content URL is required");
  }

  return { formattedUrls, finalContentUrl };
}

async function trackSubmissionChallenges(
  tx: Prisma.TransactionClient,
  deal: Awaited<ReturnType<typeof lockAndFetchDealForAction>>,
  userId: string,
) {
  // Track influencer weekly challenge (submit_early_2)
  if (deal.submissionDeadline && new Date() < new Date(deal.submissionDeadline)) {
    await checkChallengeProgress(userId, "SPEED", 1, tx).catch((err) => {
      logger.error("Failed to track influencer challenge progress for submit_early_2", { userId, error: err });
    });
  }

  // Track influencer weekly challenge (submit_24h)
  if (deal.startedAt && Date.now() - new Date(deal.startedAt).getTime() <= 24 * 60 * 60 * 1000) {
    await checkChallengeProgress(userId, "SPEED", 1, tx).catch((err) => {
      logger.error("Failed to track influencer challenge progress for submit_24h", { userId, error: err });
    });
  }
}

export async function submitContent(
  userId: string,
  dealId: string,
  contentUrl: string,
  notes?: string,
  contentUrls?: Array<{ type: string; url: string; status?: string; feedback?: string }>,
) {
  if (notes && checkMessageForContacts(notes).hasContactInfo) {
    throw AppError.badRequest("Contact details (phone, email, links, social handles, or UPI) are not allowed in submission notes.");
  }

  try {
    const updatedDeal = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // LOCK: Lock and fetch deal using helper
      const deal = await lockAndFetchDealForAction(tx, dealId);

      validateSubmissionEligibility(deal, userId, dealId);

      const nextVersion = (deal.contentSubmissions[0]?.version || 0) + 1;

      const { formattedUrls, finalContentUrl } = formatAndValidateSubmissionUrls(contentUrl, contentUrls);

      await tx.contentSubmission.create({
        data: {
          dealId,
          version: nextVersion,
          contentUrl: finalContentUrl,
          contentUrls: formattedUrls ? (formattedUrls as Prisma.InputJsonValue) : Prisma.DbNull,
          notes: notes ?? null,
          status: "PENDING",
        },
      });

      const updatedDeal = await tx.deal.update({
        where: { id: dealId },
        data: {
          status: "CONTENT_SUBMITTED",
          submittedContentUrl: finalContentUrl,
          submittedAt: new Date(),
        },
      });

      await addUserXp(userId, 15, "CONTENT_SUBMITTED", tx);

      await trackSubmissionChallenges(tx, deal, userId);

      if (deal.brand?.userId) {
        await NotificationService.createNotification({
          userId: deal.brand.userId,
          type: "deal_update",
          title: nextVersion === 1 ? "Content submitted" : `Revision ${nextVersion} submitted`,
          message: `${deal.influencer.displayName || "Influencer"} has submitted ${nextVersion > 1 ? "revised " : ""}content for "${deal.campaign.title}". Please review within 48 hours.`,
          data: { link: `/dashboard/deals/${dealId}` },
        }, tx);
      }

      logger.info("Content submitted successfully", {
        userId,
        dealId,
        version: nextVersion,
      });
      return updatedDeal;
    });

    await invalidateDealCache(dealId);
    return updatedDeal;
  } catch (error) {
    logger.error("Error submitting content", error, { userId, dealId });
    throw error;
  }
}


export async function approveContent(userId: string, dealId: string) {
// Legacy support: approve all deliverables
const deal = await prisma.deal.findUnique({
where: { id: dealId },
include: {
contentSubmissions: { orderBy: { version: "desc" }, take: 1 },
},
});
if (!deal) throw AppError.notFound("Deal not found");
const latestSubmission = deal.contentSubmissions[0];
if (!latestSubmission) throw AppError.badRequest("No submission found");

let reviews: Array<{ type: string; status: "APPROVED"; feedback?: string }> = [];
if (latestSubmission.contentUrls) {
const urls = latestSubmission.contentUrls as Array<{ type: string }>;
reviews = urls.map(item => ({ type: item.type, status: "APPROVED" }));
} else {
reviews = [{ type: "GENERIC", status: "APPROVED" }];
}

return reviewContent(userId, dealId, reviews);
}
function validateAndGetSubmissionUrls(deal: DealWithRelations) {
  if (deal.status !== "CONTENT_SUBMITTED") {
    throw AppError.badRequest("No content to review");
  }

  const latestSubmission = deal.contentSubmissions[0];
  if (!latestSubmission) throw AppError.badRequest("No content submission found");

  let currentUrls: Array<{ type: string; url: string; status: string; feedback: string }> = [];
  if (latestSubmission.contentUrls) {
    currentUrls = structuredClone(latestSubmission.contentUrls) as Array<{
      type: string;
      url: string;
      status: string;
      feedback: string;
    }>;
  } else {
    currentUrls = [
      {
        type: "GENERIC",
        url: latestSubmission.contentUrl,
        status: "PENDING",
        feedback: "",
      },
    ];
  }
  return { latestSubmission, currentUrls };
}

function processContentUrlsReview(
  currentUrls: Array<{ type: string; url: string; status: string; feedback: string }>,
  reviews: Array<{ type: string; status: "APPROVED" | "REVISION_REQUESTED"; feedback?: string | undefined }>
) {
  let overallApproved = true;
  let hasRevision = false;

  const updatedUrls = currentUrls.map((item) => {
    const review = reviews.find((r) => r.type === item.type);
    if (review) {
      if (review.status === "REVISION_REQUESTED") {
        overallApproved = false;
        hasRevision = true;
      }
      return {
        ...item,
        status: review.status,
        feedback: review.feedback || "",
      };
    }
    if (item.status !== "APPROVED") {
      overallApproved = false;
      if (item.status === "REVISION_REQUESTED") {
        hasRevision = true;
      }
    }
    return item;
  });

  return { updatedUrls, overallApproved, hasRevision };
}

async function handleRevisionCharge(
tx: Prisma.TransactionClient,
deal: DealWithRelations,
userId: string,
dealId: string
) {
const contract = deal.contractTerms as unknown as ContractTerms;
const limitCheck = checkRevisionLimit(
{ revisionsUsed: deal.revisionsUsed, maxRevisions: deal.maxRevisions },
contract
);

if (!limitCheck.allowed) {
throw AppError.badRequest(limitCheck.message || "Maximum revisions reached");
}

if (limitCheck.cost > 0) {
const brandWallet = await tx.wallet.findUnique({
where: { userId },
select: { id: true, balance: true },
});
assertSufficientBalance(brandWallet, limitCheck.cost);
if (!brandWallet) {
throw AppError.notFound("Brand wallet not found");
}
await tx.wallet.update({
where: { id: brandWallet.id },
data: { balance: { decrement: limitCheck.cost } },
});
await tx.transaction.create({
data: {
walletId: brandWallet.id,
dealId,
type: "DEBIT",
amount: limitCheck.cost,
status: "COMPLETED",
description: `Extra revision fee for deal: ${dealId} (revision #${deal.revisionsUsed + 1})`,
metadata: {
source: "extra_revision_charge",
revisionNumber: deal.revisionsUsed + 1,
costPerExtraRevision: contract.costPerExtraRevision,
},
},
});

const treasuryWallet = await ensurePlatformTreasury(tx);
await tx.wallet.update({
where: { id: treasuryWallet.id },
data: { balance: { increment: limitCheck.cost } },
});
await tx.transaction.create({
data: {
walletId: treasuryWallet.id,
dealId,
type: "CREDIT",
amount: limitCheck.cost,
status: "COMPLETED",
description: `Extra revision fee platform revenue for deal: ${dealId}`,
metadata: {
source: "extra_revision_charge_revenue",
brandUserId: userId,
revisionNumber: deal.revisionsUsed + 1,
},
},
});
}
}


function validateReviewEligibility(
  deal: Awaited<ReturnType<typeof lockAndFetchDealForAction>>,
  userId: string,
) {
  const ownerId = deal.brand?.userId;
  if (ownerId !== userId) throw AppError.forbidden("Unauthorized");
}

async function trackReviewChallenges(
  tx: Prisma.TransactionClient,
  deal: Awaited<ReturnType<typeof lockAndFetchDealForAction>>,
  userId: string,
  latestSubmission?: { submittedAt?: string | Date | null } | null,
) {
  // Track brand weekly challenge (approve_fast_3)
  if (latestSubmission?.submittedAt && Date.now() - new Date(latestSubmission.submittedAt).getTime() <= 12 * 60 * 60 * 1000) {
    await checkChallengeProgress(userId, "SPEED", 1, tx).catch((err) => {
      logger.error("Failed to track brand challenge progress for approve_fast_3", { userId, error: err });
    });
  }

  // Track influencer weekly challenge (zero_revision_3)
  if (deal.revisionsUsed === 0) {
    await checkChallengeProgress(deal.influencer.userId, "QUALITY", 1, tx).catch((err) => {
      logger.error("Failed to track influencer challenge progress for zero_revision_3", { userId: deal.influencer.userId, error: err });
    });
  }
}

export async function reviewContent(
  userId: string,
  dealId: string,
  reviews: Array<{ type: string; status: "APPROVED" | "REVISION_REQUESTED"; feedback?: string | undefined }>,
) {
  for (const r of reviews) {
    if (r.feedback && checkMessageForContacts(r.feedback).hasContactInfo) {
      throw AppError.badRequest("Contact details (phone, email, links, social handles, or UPI) are not allowed in review feedback.");
    }
  }

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const deal = await lockAndFetchDealForAction(tx, dealId);
    if (!deal) throw AppError.notFound("Deal not found");

    validateReviewEligibility(deal, userId);

    const { latestSubmission, currentUrls } = validateAndGetSubmissionUrls(deal);
    const { updatedUrls, overallApproved, hasRevision } = processContentUrlsReview(
      currentUrls,
      reviews
    );

    let updatedStatus: "CONTENT_APPROVED" | "REVISION_REQUESTED" = "CONTENT_APPROVED";

    if (hasRevision) {
      updatedStatus = "REVISION_REQUESTED";
      await handleRevisionCharge(tx, deal, userId, dealId);
    } else if (!overallApproved) {
      // Partial review: some items still PENDING persist partial feedback to DB
      // but keep deal status as CONTENT_SUBMITTED so brand can finish reviewing.
      await tx.contentSubmission.update({
        where: { id: latestSubmission.id },
        data: {
          contentUrls: updatedUrls as Prisma.InputJsonValue,
        },
      });

      return {
        ...deal,
        status: "CONTENT_SUBMITTED" as const,
        contentSubmissions: [
          {
            ...latestSubmission,
            contentUrls: updatedUrls,
          },
        ],
      };
    }

    await tx.contentSubmission.update({
      where: { id: latestSubmission.id },
      data: {
        status: updatedStatus === "CONTENT_APPROVED" ? "APPROVED" : "REJECTED",
        contentUrls: updatedUrls as Prisma.InputJsonValue,
      },
    });

    const updatedDeal = await tx.deal.update({
      where: { id: dealId },
      data: {
        status: updatedStatus,
        ...(updatedStatus === "REVISION_REQUESTED"
          ? { revisionsUsed: { increment: 1 } }
          : {}),
      },
    });

    if (updatedStatus === "CONTENT_APPROVED") {
      await updateTrustAndLevel(userId, "CONTENT_APPROVED");
      await updateTrustAndLevel(deal.influencer.userId, "CONTENT_APPROVED");
      await trackReviewChallenges(tx, deal, userId, latestSubmission);
    }

    if (updatedStatus === "REVISION_REQUESTED") {
      const { createActivityLog } = await import("@/lib/audit");
      await createActivityLog({
        userId,
        action: "REVISION_REQUESTED",
        entityType: "Deal",
        entityId: dealId,
        metadata: {
          revisionNumber: deal.revisionsUsed + 1,
          reviews,
        },
      }, tx);
    }

    await NotificationService.createNotification({
      userId: deal.influencer.userId,
      type: "deal_update",
      title:
        updatedStatus === "CONTENT_APPROVED"
          ? "Content approved!"
          : "Revision requested",
      message:
        updatedStatus === "CONTENT_APPROVED"
          ? `Your content for "${deal.campaign.title}" was approved! Please proceed with posting.`
          : `Changes requested on your content for "${deal.campaign.title}". Check feedback and re-submit.`,
      data: { link: `/dashboard/deals/${dealId}` },
    }, tx);

    return updatedDeal;
  });

  await invalidateDealCache(dealId);
  return result;
}
