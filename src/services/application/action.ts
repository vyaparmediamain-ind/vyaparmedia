import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { checkMessageForContacts } from "@/lib/contact-filter";
import { createActivityLog } from "@/lib/audit";
import { generateContractTerms } from "@/lib/contract-engine";
import { resolveBrandPlatformFee } from "@/lib/platform-fees";
import { calculateTotalAmount } from "@/lib/razorpay";
import { assertSufficientBalance, assertAccountCanTransact, calculateProductHandlingFee } from "@/lib/utils";
import { NotificationService } from "@/services/notification.service";
import { logger } from "@/lib/logger";
import { resolveApplicationDealAmount } from "./types";
import { validateApplicationCanBeAccepted } from "./create";
import { createDealAndReserveFunds } from "@/services/deal/helpers";
import { checkChallengeProgress } from "@/lib/weekly-challenges";
import { BlockService } from "@/services/block.service";

async function calculateDealFinancials(
application: {
proposedRate: number | null;
campaign: {
perInfluencerBudget: number | null;
requiresProduct: boolean;
totalBudget: number;
productValue: number | null;
reservedAmount: number | null;
reservedTotalAmount: number | null;
fundedAmount: number | null;
};
},
customRate: number | undefined,
userId: string,
): Promise<{ dealAmount: number; paymentAmounts: ReturnType<typeof calculateTotalAmount>; productHandlingFee: number }> {
const dealAmount = customRate && customRate > 0
? customRate
: resolveApplicationDealAmount(
application.proposedRate,
application.campaign.perInfluencerBudget,
);
const isProductOnly = application.campaign.requiresProduct && application.campaign.totalBudget === 0;
if (dealAmount <= 0 && !isProductOnly) {
throw AppError.badRequest("Cannot accept application without a valid per-influencer budget");
}

const alreadyCommitted = application.campaign.reservedAmount || 0;
if (alreadyCommitted + dealAmount > application.campaign.totalBudget) {
throw AppError.badRequest("Campaign budget exceeded. Increase budget or reject other deals first.");
}

const brandFee = await resolveBrandPlatformFee(userId);
const productHandlingFee = calculateProductHandlingFee(
application.campaign.productValue,
application.campaign.requiresProduct,
isProductOnly,
brandFee.effectivePlatformFee,
);

const paymentAmounts = calculateTotalAmount(
dealAmount,
brandFee.effectivePlatformFee,
productHandlingFee,
);

const alreadyCommittedTotal =
  application.campaign.reservedTotalAmount ??
  application.campaign.reservedAmount ??
  0;
const fundedAmount =
  application.campaign.fundedAmount ?? application.campaign.totalBudget;
if (alreadyCommittedTotal + paymentAmounts.totalAmount > fundedAmount) {
throw AppError.badRequest("Campaign funded amount exceeded. Add funds or reduce selected deal value.");
}

return { dealAmount, paymentAmounts, productHandlingFee };
}
export async function acceptApplication(userId: string, applicationId: string, customRate?: number) {
// Retry loop to handle Postgres P2034 serialization-conflict errors that can
// occur when two parallel requests attempt to accept applications for the same
// campaign budget simultaneously. Serializable isolation guarantees the budget
// aggregate read and the deal create are atomic; on conflict one transaction
// wins cleanly and the other is retried (or surfaces a user-visible error).
const MAX_RETRIES = 3;
for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
try {
const result = await prisma.$transaction(
async (tx: Prisma.TransactionClient) => {
const actingUser = await tx.user.findUnique({
where: { id: userId },
select: { status: true },
});
assertAccountCanTransact(actingUser?.status);

const brandProfile = await tx.brandProfile.findUnique({
where: { userId },
select: { id: true, companyName: true },
});
if (!brandProfile) {
throw AppError.notFound("Brand profile not found");
}

const application = await tx.application.findUnique({
where: { id: applicationId },
include: {
campaign: {
select: {
id: true,
title: true,
status: true,
brandId: true,
totalBudget: true,
perInfluencerBudget: true,
deliverables: true,
requirements: true,
contentDeadline: true,
postingDeadline: true,
requiresProduct: true,
productName: true,
productValue: true,
productDescription: true,
maxInfluencers: true,
selectedInfluencers: true,
reservedAmount: true,
reservedTotalAmount: true,
fundedAmount: true,
},
},
influencer: {
select: {
id: true,
userId: true,
displayName: true,
followerAuthenticityScore: true,
},
},
},
});

if (!application) {
throw AppError.notFound("Application not found");
}

// Direct authenticity score check at acceptance time
if (application.influencer.followerAuthenticityScore < 40) {
throw AppError.badRequest(
`This application cannot be accepted because the influencer's follower authenticity score (${application.influencer.followerAuthenticityScore}/100) is below the minimum required threshold of 40.`
);
}

const isBlocked = await BlockService.isBlocked(userId, application.influencer.userId);
if (isBlocked) {
  throw AppError.badRequest("Cannot accept application from a blocked user");
}

validateApplicationCanBeAccepted(application, brandProfile.id);

const applicationLock = await tx.application.updateMany({
where: {
id: application.id,
status: { in: ["PENDING", "SHORTLISTED"] },
},
data: { updatedAt: new Date() },
});

if (applicationLock.count === 0) {
throw AppError.badRequest("Application has already been processed");
}

await tx.campaign.update({
where: { id: application.campaignId },
data: { updatedAt: new Date() },
});

const existingDeal = await tx.deal.findFirst({
where: {
campaignId: application.campaignId,
influencerId: application.influencerId,
deletedAt: null,
status: { not: "CANCELLED" },
},
select: { id: true },
});
if (existingDeal) {
throw AppError.badRequest("A deal already exists for this influencer");
}

const { dealAmount, paymentAmounts, productHandlingFee } =
await calculateDealFinancials(application, customRate, userId);

const wallet = await tx.wallet.findUnique({
where: { userId },
select: { id: true, pendingBalance: true },
});
assertSufficientBalance(wallet, paymentAmounts.totalAmount, "pendingBalance");

const draftContractTerms = generateContractTerms(
"pending",
{
totalBudget: application.campaign.totalBudget,
perInfluencerBudget: dealAmount,
deliverables: application.campaign.deliverables,
requirements: application.campaign.requirements,
contentDeadline: application.campaign.contentDeadline,
postingDeadline: application.campaign.postingDeadline,
requiresProduct: application.campaign.requiresProduct,
productName: application.campaign.productName,
productValue: application.campaign.productValue,
productDescription: application.campaign.productDescription,
},
{
rate: dealAmount,
message: application.proposal,
platformFee: paymentAmounts.platformFee,
gatewayFee: paymentAmounts.gatewayFee,
totalAmount: paymentAmounts.totalAmount,
platformFeePercent: paymentAmounts.platformFeePercent,
influencerPayout: paymentAmounts.influencerReceives,
productHandlingFee,
},
);

const deal = await createDealAndReserveFunds(tx, {
brandUserId: userId,
campaignId: application.campaignId,
influencerId: application.influencerId,
brandProfileId: brandProfile.id,
dealAmount,
paymentAmounts: {
totalAmount: paymentAmounts.totalAmount,
platformFee: paymentAmounts.platformFee,
gatewayFee: paymentAmounts.gatewayFee,
influencerReceives: paymentAmounts.influencerReceives,
},
requiresProduct: application.campaign.requiresProduct,
productName: application.campaign.productName,
productValue: application.campaign.productValue,
productHandlingFee,
submissionDeadline: application.campaign.contentDeadline,
postingDeadline: application.campaign.postingDeadline,
draftContractTerms,
});

await tx.application.update({
where: { id: application.id },
data: { status: "SELECTED" },
});

await tx.campaign.update({
where: { id: application.campaignId },
data: {
selectedInfluencers: { increment: 1 },
reservedAmount: { increment: dealAmount },
reservedTotalAmount: { increment: paymentAmounts.totalAmount },
},
});

await NotificationService.createNotification({
userId: application.influencer.userId,
type: "deal_update",
title: "Your application was accepted",
message: `${brandProfile.companyName} accepted your application for ${application.campaign.title}. Please sign the contract.`,
data: {
campaignId: application.campaignId,
applicationId: application.id,
dealId: deal.id,
},
}, tx);

      // Track brand weekly challenge (select_5_influencers)
      await checkChallengeProgress(userId, "DEALS", 1, tx).catch((err) => {
        logger.error("Failed to track brand challenge progress for select_5_influencers", { userId, error: err });
      });

      // Track influencer weekly challenge (accept_3_deals)
      await checkChallengeProgress(application.influencer.userId, "DEALS", 1, tx).catch((err) => {
        logger.error("Failed to track influencer challenge progress for accept_3_deals", { userId: application.influencer.userId, error: err });
      });

      await createActivityLog({
        userId,
        action: "ACCEPT_APPLICATION",
        entityType: "Application",
        entityId: application.id,
        metadata: {
          campaignId: application.campaignId,
          dealId: deal.id,
        },
      }, tx);

      return deal;
},
{
// Serializable isolation prevents the budget-aggregate TOCTOU race:
// two concurrent accept calls read the same committed-budget sum and
// both pass the budget check under Read Committed, creating two deals
// that together exceed totalBudget. Under Serializable, Postgres
// detects the dependency cycle and aborts one transaction with P2034,
// which the retry loop below handles gracefully.
isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
},
);

logger.info("Application accepted successfully", {
userId,
applicationId,
dealId: result.id,
});

return result;
} catch (error) {
const isSerializationConflict =
error instanceof Prisma.PrismaClientKnownRequestError &&
error.code === "P2034";

if (isSerializationConflict && attempt < MAX_RETRIES) {
logger.warn(
`[acceptApplication] Serialization conflict on attempt ${attempt}/${MAX_RETRIES}, retrying`,
{ userId, applicationId },
);
// Small jitter before retry to reduce thundering-herd
await new Promise((r) => setTimeout(r, 50 * attempt));
continue;
}

logger.error("Error accepting application", error, { userId, applicationId });
throw error;
}
}
// Unreachable the loop always returns or throws
throw AppError.badRequest("acceptApplication: exceeded max retries");
}
export async function rejectApplication(
userId: string,
applicationId: string,
rejectionReason?: string,
) {
if (rejectionReason && checkMessageForContacts(rejectionReason).hasContactInfo) {
throw AppError.badRequest("Contact details (phone, email, links, social handles, or UPI) are not allowed in application rejection reasons.");
}

try {
const result = await prisma.$transaction(
async (tx: Prisma.TransactionClient) => {
const brandProfile = await tx.brandProfile.findUnique({
where: { userId },
select: { id: true, companyName: true },
});
if (!brandProfile) {
throw AppError.notFound("Brand profile not found");
}

const application = await tx.application.findUnique({
where: { id: applicationId },
include: {
campaign: {
select: {
id: true,
title: true,
brandId: true,
},
},
influencer: {
select: { userId: true },
},
},
});

if (!application) {
throw AppError.notFound("Application not found");
}

if (application.campaign.brandId !== brandProfile.id) {
throw AppError.badRequest("Not authorized to reject this application");
}

if (!["PENDING", "SHORTLISTED"].includes(application.status)) {
throw AppError.badRequest("Only pending applications can be rejected");
}

const applicationLock = await tx.application.updateMany({
where: {
id: application.id,
status: { in: ["PENDING", "SHORTLISTED"] },
},
data: {
status: "REJECTED",
rejectionReason:
rejectionReason?.trim() || "Application rejected by campaign owner.",
},
});

if (applicationLock.count === 0) {
throw AppError.badRequest("Application has already been processed");
}

const updatedApplication = await tx.application.findUniqueOrThrow({
where: { id: application.id },
});

await NotificationService.createNotification({
userId: application.influencer.userId,
type: "deal_update",
title: "Application update",
message: `${brandProfile.companyName} rejected your application for ${application.campaign.title}.`,
data: {
campaignId: application.campaignId,
applicationId: application.id,
},
}, tx);

await createActivityLog({
userId,
action: "REJECT_APPLICATION",
entityType: "Application",
entityId: application.id,
metadata: {
campaignId: application.campaignId,
},
}, tx);

return updatedApplication;
},
);

logger.info("Application rejected successfully", {
userId,
applicationId,
});
return result;
} catch (error) {
logger.error("Error rejecting application", error, { userId, applicationId });
throw error;
}
}