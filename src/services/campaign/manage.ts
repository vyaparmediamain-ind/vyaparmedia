import { logger } from "@/lib/logger";
import { isInfluencer, isAdmin } from "@/lib/rbac";
import { checkVerificationTierForAmount, tierErrorResponse } from "@/lib/verification-tiers";
import { calculateTotalAmount } from "@/lib/razorpay";
import { TierError, safeStringCast, safeStringOrNullCast, estimateCampaignDealSlots, CAMPAIGN_INCLUDE } from "./types";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { createActivityLog } from "@/lib/audit";
import { calculateProductHandlingFee, assertSufficientBalance } from "@/lib/utils";
import { resolveBrandPlatformFee } from "@/lib/platform-fees";
import { assertNoContactDetails } from "./create";

export async function getCampaignById(
campaignId: string,
viewerUserId?: string,
viewerUserType?: string,
) {
const campaign = await prisma.campaign.findFirst({
where: {
id: campaignId,
deletedAt: null,
},
include: CAMPAIGN_INCLUDE,
});

if (!campaign) {
return null;
}

const isOwner = Boolean(viewerUserId && campaign.brand?.userId === viewerUserId);
const isAdminCheck = isAdmin(viewerUserType);

if (campaign.status === "DRAFT" && !isOwner && !isAdminCheck) {
  return null;
}

if (campaign.isDirectInvite && !isOwner && !isAdminCheck) {
if (!viewerUserId || !isInfluencer(viewerUserType)) {
return null;
}

const influencerProfile = await prisma.influencerProfile.findUnique({
where: { userId: viewerUserId },
select: { id: true },
});

if (!influencerProfile) {
return null;
}

const invitedDeal = await prisma.deal.findFirst({
where: {
campaignId: campaign.id,
influencerId: influencerProfile.id,
deletedAt: null,
},
select: { id: true },
});

if (!invitedDeal) {
return null;
}
}

return campaign;
}
function buildBasicInfoUpdate(data: Record<string, unknown>, updateData: Prisma.CampaignUpdateInput) {
  if (data.title !== undefined) updateData.title = safeStringCast(data.title);
  if (data.description !== undefined) updateData.description = safeStringCast(data.description);
  if (data.requirements !== undefined) updateData.requirements = safeStringCast(data.requirements);
  if (data.guidelines !== undefined) {
    updateData.guidelines = safeStringOrNullCast(data.guidelines);
  }
}
function parseOptionalPositiveNumber(val: unknown): number | null {
  if (val === undefined || val === null || val === "") return null;
  const num = Number(val);
  return !Number.isNaN(num) && num > 0 ? num : null;
}

function parseOptionalNonNegativeNumber(val: unknown): number | null {
  if (val === undefined || val === null || val === "") return null;
  const num = Number(val);
  return !Number.isNaN(num) && num >= 0 ? num : null;
}

function parseOptionalDate(val: unknown): Date | null {
  if (!val) return null;
  const d = new Date(val as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildDemographicsUpdate(data: Record<string, unknown>, updateData: Prisma.CampaignUpdateInput) {
  if (data.targetCategories !== undefined) updateData.targetCategories = data.targetCategories as string[];
  if (data.targetCities !== undefined) updateData.targetCities = data.targetCities as string[];
  if (data.targetLanguages !== undefined) updateData.targetLanguages = data.targetLanguages as string[];
  if (data.targetGender !== undefined) {
    updateData.targetGender = safeStringOrNullCast(data.targetGender);
  }
  if (data.targetAgeMin !== undefined) {
    updateData.targetAgeMin = parseOptionalNonNegativeNumber(data.targetAgeMin);
  }
  if (data.targetAgeMax !== undefined) {
    updateData.targetAgeMax = parseOptionalNonNegativeNumber(data.targetAgeMax);
  }
}

function buildFollowersAndEngagementUpdate(data: Record<string, unknown>, updateData: Prisma.CampaignUpdateInput) {
  if (data.minFollowers !== undefined) updateData.minFollowers = Number(data.minFollowers);
  if (data.maxFollowers !== undefined) {
    updateData.maxFollowers = parseOptionalPositiveNumber(data.maxFollowers);
  }
  if (data.minEngagementRate !== undefined) {
    updateData.minEngagementRate = parseOptionalNonNegativeNumber(data.minEngagementRate);
  }
}

function buildBudgetAndTimelineUpdate(data: Record<string, unknown>, updateData: Prisma.CampaignUpdateInput) {
  if (data.totalBudget !== undefined) {
    const val = parseOptionalNonNegativeNumber(data.totalBudget);
    if (val !== null) updateData.totalBudget = val;
  }
  if (data.perInfluencerBudget !== undefined) {
    updateData.perInfluencerBudget = parseOptionalNonNegativeNumber(data.perInfluencerBudget);
  }
  if (data.maxInfluencers !== undefined) {
    updateData.maxInfluencers = parseOptionalPositiveNumber(data.maxInfluencers);
  }
  if (data.deliverables !== undefined) {
    updateData.deliverables = data.deliverables as Prisma.InputJsonValue;
  }
  if (data.applicationDeadline !== undefined) {
    updateData.applicationDeadline = parseOptionalDate(data.applicationDeadline);
  }
  if (data.contentDeadline !== undefined) {
    updateData.contentDeadline = new Date(data.contentDeadline as string);
  }
  if (data.postingDeadline !== undefined) {
    updateData.postingDeadline = new Date(data.postingDeadline as string);
  }
}
function buildProductSeedingUpdate(data: Record<string, unknown>, updateData: Prisma.CampaignUpdateInput) {
  if (data.requiresProduct !== undefined) updateData.requiresProduct = Boolean(data.requiresProduct);
  if (data.productName !== undefined) {
    updateData.productName = safeStringCast(data.productName);
  }
  if (data.productValue !== undefined) updateData.productValue = Number(data.productValue);
  if (data.productDescription !== undefined) {
    updateData.productDescription = safeStringCast(data.productDescription);
  }
}
function buildCampaignUpdatePayload(data: Record<string, unknown>): Prisma.CampaignUpdateInput {
  const updateData: Prisma.CampaignUpdateInput = {};
  buildBasicInfoUpdate(data, updateData);
  buildDemographicsUpdate(data, updateData);
  buildFollowersAndEngagementUpdate(data, updateData);
  buildBudgetAndTimelineUpdate(data, updateData);
  buildProductSeedingUpdate(data, updateData);
  return updateData;
}
export async function updateDraftCampaign(
campaignId: string,
userId: string,
data: Record<string, unknown>,
) {
try {
const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
const campaign = await tx.campaign.findUnique({
where: { id: campaignId },
include: { brand: true },
});

if (!campaign || campaign.deletedAt || campaign.brand?.userId !== userId) {
throw AppError.notFound("Campaign not found or unauthorized");
}

if (campaign.status !== "DRAFT") {
throw AppError.badRequest("Campaign details can only be updated in DRAFT status");
}

if (data.title !== undefined) assertNoContactDetails(safeStringCast(data.title), "title");
if (data.description !== undefined) assertNoContactDetails(safeStringCast(data.description), "description");
if (data.requirements !== undefined) assertNoContactDetails(safeStringCast(data.requirements), "requirements");
if (data.guidelines !== undefined) assertNoContactDetails(safeStringOrNullCast(data.guidelines), "guidelines");
if (data.productName !== undefined) assertNoContactDetails(safeStringCast(data.productName), "product name");
if (data.productDescription !== undefined) assertNoContactDetails(safeStringCast(data.productDescription), "product description");

const updateData = buildCampaignUpdatePayload(data);

const updatedCampaign = await tx.campaign.update({
where: { id: campaignId },
data: updateData,
});

await createActivityLog({
userId,
action: "CAMPAIGN_UPDATE",
entityType: "Campaign",
entityId: campaignId,
}, tx);

return updatedCampaign;
});

logger.info("Campaign updated successfully", {
userId,
campaignId,
});
return result;
} catch (error) {
logger.error("Error updating campaign", error, { userId, campaignId });
throw error;
}
}
export async function activateDraftCampaign(userId: string, campaignId: string) {
try {
const campaignData = await prisma.campaign.findUnique({
where: { id: campaignId },
include: { brand: { select: { userId: true } } },
});
if (!campaignData || campaignData.deletedAt || campaignData.brand?.userId !== userId) {
throw AppError.notFound("Campaign not found or unauthorized");
}

const tierCheck = await checkVerificationTierForAmount(
userId,
"BRAND",
campaignData.totalBudget,
);
if (!tierCheck.allowed) {
throw new TierError(tierCheck.reason || "Verification required", tierErrorResponse(tierCheck));
}

const result = await prisma.$transaction(
async (tx: Prisma.TransactionClient) => {
const campaign = await tx.campaign.findUnique({
where: { id: campaignId },
include: { brand: true },
});

if (!campaign || campaign.deletedAt || campaign.brand?.userId !== userId) {
throw AppError.notFound("Campaign not found or unauthorized");
}
if (campaign.status !== "DRAFT") {
throw AppError.badRequest("Campaign is not in DRAFT status");
}

const brandFee = await resolveBrandPlatformFee(userId);
const isProductOnly = campaign.requiresProduct && campaign.totalBudget === 0;
const productHandlingFee = calculateProductHandlingFee(
campaign.productValue,
campaign.requiresProduct,
isProductOnly,
brandFee.effectivePlatformFee,
);
const fundedDealSlots = estimateCampaignDealSlots(
campaign.totalBudget,
campaign.perInfluencerBudget,
campaign.maxInfluencers,
);
const fundingAmounts = calculateTotalAmount(
campaign.totalBudget,
brandFee.effectivePlatformFee,
productHandlingFee * fundedDealSlots,
);
const fundingTierCheck = await checkVerificationTierForAmount(
userId,
"BRAND",
fundingAmounts.totalAmount,
);
if (!fundingTierCheck.allowed) {
throw new TierError(fundingTierCheck.reason || "Verification required", tierErrorResponse(fundingTierCheck));
}
const amountPaise = fundingAmounts.totalAmount;
const wallet = await tx.wallet.findUnique({ where: { userId } });
if (!wallet) {
  throw AppError.badRequest("Brand wallet not found");
}

assertSufficientBalance(wallet, amountPaise);

const updateResult = await tx.wallet.updateMany({
where: { id: wallet.id, balance: { gte: amountPaise } },
data: {
balance: { decrement: amountPaise },
pendingBalance: { increment: amountPaise },
},
});

if (updateResult.count === 0) {
throw AppError.badRequest("Insufficient wallet balance or concurrent transaction detected",);
}

await tx.transaction.create({
data: {
walletId: wallet.id,
type: "DEBIT",
amount: amountPaise,
status: "COMPLETED",
description: `Funds held for campaign activation: ${campaign.title}`,
metadata: {
balanceImpact: true,
campaignId,
totalBudget: campaign.totalBudget,
platformFee: fundingAmounts.platformFee,
gatewayFee: fundingAmounts.gatewayFee,
fundedDealSlots,
},
},
});

if (campaign.brandId) {
await tx.brandProfile.updateMany({
where: { id: campaign.brandId },
data: { activeCampaigns: { increment: 1 } },
});
}

const updatedCampaign = await tx.campaign.update({
where: { id: campaignId },
data: { status: "ACTIVE", fundedAmount: amountPaise },
});

await createActivityLog({
userId,
action: "ACTIVATE_CAMPAIGN",
entityType: "Campaign",
entityId: campaignId,
}, tx);

return updatedCampaign;
},
{
// Serializable prevents a concurrent cancelCampaign from racing on
// wallet state while budget funds are being moved from balance
// pendingBalance. The updateMany atomic guard is the primary safety
// net; Serializable is a belt-and-suspenders defence.
isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
},
);

logger.info("Campaign activated successfully", { userId, campaignId });
return result;
} catch (error) {
logger.error("Error activating campaign", error, { userId, campaignId });
throw error;
}
}
export async function cancelCampaign(userId: string, campaignId: string) {
// Retry loop for Postgres P2034 serialization conflicts.
// cancelCampaign reads deal.aggregate (committed budget sum) then computes
// a refundableAmount from wallet.pendingBalance identical phantom-read
// exposure to acceptApplication. A concurrent acceptApplication that
// inserts a deal between our aggregate-read and wallet-update would cause
// us to refund budget that is actually committed to a deal.
// Serializable isolation detects the dependency cycle and aborts one side;
// the retry ensures the losing side re-runs with the correct data.
const MAX_RETRIES = 3;
for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
try {
const result = await prisma.$transaction(
async (tx: Prisma.TransactionClient) => {
const campaign = await tx.campaign.findUnique({
where: { id: campaignId },
include: { brand: true },
});

if (!campaign || campaign.deletedAt || campaign.brand?.userId !== userId) {
throw AppError.notFound("Campaign not found or unauthorized");
}

if (campaign.status === "CANCELLED") {
throw AppError.badRequest("Campaign is already cancelled");
}

if (campaign.status === "COMPLETED") {
throw AppError.badRequest("Completed campaigns cannot be cancelled");
}

const openDealCount = await tx.deal.count({
where: {
campaignId,
deletedAt: null,
status: {
notIn: ["CANCELLED", "COMPLETED"],
},
},
});

if (openDealCount > 0) {
throw AppError.badRequest("Cannot cancel campaign while active deals exist for this campaign");
}

const wallet = await tx.wallet.findUnique({ where: { userId } });
const shouldRefundHeldBudget = campaign.status !== "DRAFT";

if (shouldRefundHeldBudget && wallet) {
// Under Serializable isolation this aggregate is protected from
// phantom inserts a concurrent acceptApplication that commits
// a new deal after this read causes Postgres to abort one of the
// two transactions with P2034, preventing a stale-read over-refund.
const alreadyCommitted = campaign.reservedTotalAmount ?? campaign.reservedAmount ?? 0;
const campaignReservedBudget = Math.max(
0,
(campaign.fundedAmount ?? campaign.totalBudget) - alreadyCommitted,
);
const refundableAmount = Math.min(wallet.pendingBalance, campaignReservedBudget);

if (refundableAmount > 0) {
// Atomic conditional decrement if pendingBalance was already
// reduced by a concurrent transaction the updateMany returns
// count=0, we recalculate on retry.
const walletUpdate = await tx.wallet.updateMany({
where: { id: wallet.id, pendingBalance: { gte: refundableAmount } },
data: {
pendingBalance: { decrement: refundableAmount },
balance: { increment: refundableAmount },
},
});

if (walletUpdate.count === 0) {
throw AppError.badRequest("Concurrent wallet modification detected, retrying");
}

await tx.transaction.create({
data: {
walletId: wallet.id,
type: "CREDIT",
amount: refundableAmount,
status: "COMPLETED",
description: `Refund for cancelled campaign: ${campaign.title}`,
},
});
}
}

await tx.application.updateMany({
where: {
campaignId,
status: { in: ["PENDING", "SHORTLISTED"] },
},
data: {
status: "REJECTED",
rejectionReason: "Campaign cancelled by brand",
},
});

if (campaign.brandId && campaign.status === "ACTIVE") {
await tx.brandProfile.updateMany({
where: {
id: campaign.brandId,
activeCampaigns: { gt: 0 },
},
data: {
activeCampaigns: { decrement: 1 },
},
});
}

const updatedCampaign = await tx.campaign.update({
where: { id: campaignId },
data: {
status: "CANCELLED",
},
});

await createActivityLog({
userId,
action: "CANCEL_CAMPAIGN",
entityType: "Campaign",
entityId: campaignId,
}, tx);

return updatedCampaign;
},
{
isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
},
);

logger.info("Campaign cancelled successfully", { userId, campaignId });
return result;
} catch (error) {
const isSerializationConflict =
error instanceof Prisma.PrismaClientKnownRequestError &&
error.code === "P2034";

if (isSerializationConflict && attempt < MAX_RETRIES) {
logger.warn(
`[cancelCampaign] Serialization conflict on attempt ${attempt}/${MAX_RETRIES}, retrying`,
{ userId, campaignId },
);
await new Promise((r) => setTimeout(r, 50 * attempt));
continue;
}

logger.error("Error cancelling campaign", error, { userId, campaignId });
throw error;
}
}
// Unreachable loop always returns or throws
throw AppError.badRequest("cancelCampaign: exceeded max retries");
}