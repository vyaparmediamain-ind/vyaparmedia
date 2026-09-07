import { UserStatus, Prisma, UserType } from "@prisma/client";
import { checkTrustGate } from "@/lib/trust-engine";
import { isBrand } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import prisma from "@/lib/db";
import { AppError } from "@/lib/errors";
import { createActivityLog } from "@/lib/audit";
import { NotificationService } from "@/services/notification.service";
import { generateContractTerms } from "@/lib/contract-engine";
import { resolveBrandPlatformFee, type PlatformFeeSnapshot } from "@/lib/platform-fees";
import { checkVerificationTierForAmount, tierErrorResponse } from "@/lib/verification-tiers";
import { calculateTotalAmount } from "@/lib/razorpay";
import { assertAccountCanTransact, calculateProductHandlingFee, assertSufficientBalance, normalizeStringArray } from "@/lib/utils";
import { checkAndAwardBadges } from "@/lib/gamification-engine";
import { checkChallengeProgress } from "@/lib/weekly-challenges";
import { validateCampaignInputAndBudgets } from "./list";
import { TierError, DirectInviteParams, estimateCampaignDealSlots, safeStringCast, safeStringOrNullCast } from "./types";
import { createDealAndReserveFunds } from "@/services/deal/helpers";
import { checkMessageForContacts } from "@/lib/contact-filter";
import { BlockService } from "@/services/block.service";

export function assertNoContactDetails(text: string | null | undefined, fieldName: string) {
if (!text) return;
const filterResult = checkMessageForContacts(text, { allowUrls: true });
if (filterResult.hasContactInfo) {
throw AppError.badRequest(
`Contact details (phone, email, social handles, or UPI) are not allowed in the campaign ${fieldName}.`
);
}
}


async function checkBrandVerificationTiers(
userId: string,
totalBudgetPaise: number,
productValuePaise: number | null,
campaignBrandFee: PlatformFeeSnapshot,
fundedDealSlots: number,
productHandlingFee: number
) {
const campaignValue = totalBudgetPaise > 0
? totalBudgetPaise
: (productValuePaise || 0) * fundedDealSlots;

const tierCheck = await checkVerificationTierForAmount(userId, "BRAND", campaignValue);
if (!tierCheck.allowed) {
throw new TierError(tierCheck.reason || "Verification required", tierErrorResponse(tierCheck));
}

const campaignFundingAmounts = calculateTotalAmount(
totalBudgetPaise,
campaignBrandFee.effectivePlatformFee,
productHandlingFee * fundedDealSlots
);
const fundingTierCheck = await checkVerificationTierForAmount(
userId,
"BRAND",
campaignFundingAmounts.totalAmount
);
if (!fundingTierCheck.allowed) {
throw new TierError(fundingTierCheck.reason || "Verification required", tierErrorResponse(fundingTierCheck));
}

return campaignFundingAmounts;
}
async function handleDirectInviteInCampaign(params: DirectInviteParams) {
const {
tx,
newCampaign,
data,
profile,
totalBudgetPaise,
perInfluencerBudgetPaise,
normalizedDeliverables,
requirements,
contentDeadline,
postingDeadline,
requiresProduct,
productName,
productValuePaise,
productHandlingFee,
} = params;
if (!data.invitedInfluencerId) return;

const invitedInfluencer = (await tx.influencerProfile.findUnique({
where: { id: data.invitedInfluencerId as string },
select: {
id: true,
userId: true,
followerAuthenticityScore: true,
user: { select: { status: true } },
},
})) as { id: string; userId: string; followerAuthenticityScore: number; user: { status: UserStatus } } | null;

if (!invitedInfluencer) return;

// Enforce authenticity score check on direct invites
if (invitedInfluencer.followerAuthenticityScore < 40) {
throw AppError.badRequest(
`This influencer cannot be invited because their follower authenticity score (${invitedInfluencer.followerAuthenticityScore}/100) is below the minimum required threshold of 40.`
);
}

const isBlocked = await BlockService.isBlocked(profile.userId, invitedInfluencer.userId);
if (isBlocked) {
  throw AppError.badRequest("Cannot invite a blocked influencer");
}

assertAccountCanTransact(invitedInfluencer.user.status);
const existingInviteDeal = await tx.deal.findFirst({
where: {
campaignId: newCampaign.id,
influencerId: invitedInfluencer.id,
deletedAt: null,
status: { not: "CANCELLED" },
},
select: { id: true },
});
if (existingInviteDeal) {
throw AppError.badRequest("A deal already exists for this influencer");
}

const dealAmount = perInfluencerBudgetPaise ?? totalBudgetPaise;
const inviteTrustGate = await checkTrustGate(invitedInfluencer.userId, dealAmount);
if (!inviteTrustGate.allowed) {
throw AppError.badRequest(inviteTrustGate.reason || "Influencer trust score too low for this invite");
}

const brandFee = await resolveBrandPlatformFee(profile.userId);
const paymentAmounts = calculateTotalAmount(dealAmount, brandFee.effectivePlatformFee, productHandlingFee);

const draftContractTerms = generateContractTerms(
"pending",
{
totalBudget: totalBudgetPaise,
perInfluencerBudget: dealAmount,
deliverables: normalizedDeliverables,
requirements,
contentDeadline,
postingDeadline,
requiresProduct,
productName,
productValue: productValuePaise,
productDescription: typeof data.productDescription === "string" || typeof data.productDescription === "number" ? String(data.productDescription).trim() : null,
},
{
rate: dealAmount,
platformFee: paymentAmounts.platformFee,
gatewayFee: paymentAmounts.gatewayFee,
totalAmount: paymentAmounts.totalAmount,
platformFeePercent: paymentAmounts.platformFeePercent,
influencerPayout: paymentAmounts.influencerReceives,
productHandlingFee,
}
);

const createdDeal = await createDealAndReserveFunds(tx, {
brandUserId: profile.userId,
campaignId: newCampaign.id,
influencerId: invitedInfluencer.id,
brandProfileId: profile.id,
dealAmount,
paymentAmounts: {
totalAmount: paymentAmounts.totalAmount,
platformFee: paymentAmounts.platformFee,
gatewayFee: paymentAmounts.gatewayFee,
influencerReceives: paymentAmounts.influencerReceives,
},
requiresProduct,
productName,
productValue: productValuePaise,
productHandlingFee,
submissionDeadline: contentDeadline,
postingDeadline,
draftContractTerms,
});

await tx.campaign.update({
where: { id: newCampaign.id },
data: {
selectedInfluencers: { increment: 1 },
reservedAmount: { increment: dealAmount },
reservedTotalAmount: { increment: paymentAmounts.totalAmount },
},
});

const brandWallet = await tx.wallet.findUnique({
where: { userId: profile.userId },
select: { id: true },
});
if (!brandWallet) {
throw AppError.notFound("Brand wallet not found.");
}

await tx.transaction.create({
data: {
walletId: brandWallet.id,
dealId: createdDeal.id,
type: "DEBIT",
amount: paymentAmounts.totalAmount,
status: "COMPLETED",
description: `Funds reserved for direct invite deal: ${createdDeal.id}`,
metadata: {
balanceImpact: false,
source: "wallet_campaign_reservation_allocation",
dealAmount,
platformFee: paymentAmounts.platformFee,
gatewayFee: paymentAmounts.gatewayFee,
},
},
});

await NotificationService.createNotification(
{
userId: invitedInfluencer.userId,
type: "deal_update",
title: `You have an invite from ${profile.companyName}`,
message: `You have been invited for campaign: ${newCampaign.title}. Please review the contract.`,
data: { campaignId: newCampaign.id, dealId: createdDeal.id },
},
tx
);
}
export function validateDeadlines(
contentDeadline: Date,
postingDeadline: Date,
applicationDeadline: Date | null,
now: Date
) {
if (Number.isNaN(contentDeadline.getTime()) || Number.isNaN(postingDeadline.getTime())) {
throw AppError.badRequest("Invalid campaign deadlines");
}
if (postingDeadline < contentDeadline) {
throw AppError.badRequest("Posting deadline must be after content deadline");
}
if (applicationDeadline && Number.isNaN(applicationDeadline.getTime())) {
throw AppError.badRequest("Invalid application deadline");
}
if (applicationDeadline) {
const startOfToday = new Date(now);
startOfToday.setUTCHours(0, 0, 0, 0);

const appDeadlineUTC = new Date(applicationDeadline);
appDeadlineUTC.setUTCHours(0, 0, 0, 0);

if (appDeadlineUTC < startOfToday) {
throw AppError.badRequest("Application deadline cannot be in the past");
}
}
if (applicationDeadline && applicationDeadline > contentDeadline) {
throw AppError.badRequest("Application deadline must be before content deadline");
}
}
function parseDeliverables(deliverables: unknown) {
if (!Array.isArray(deliverables) || deliverables.length === 0) {
throw AppError.badRequest("At least one deliverable is required");
}
const normalized = deliverables
.map((item: { type?: unknown; count?: unknown; rate?: unknown; specs?: unknown }) => {
const rawType = item?.type;
const typeStr = typeof rawType === "string" ? rawType.trim() : "";
const specsStr = typeof item?.specs === "string" ? item.specs.trim() : undefined;
return {
type: typeStr,
count: Math.max(1, Number(item?.count || 1)),
rate: item?.rate !== undefined && item?.rate !== null ? Math.max(0, Number(item.rate)) : undefined,
...(specsStr ? { specs: specsStr } : {}),
};
})
.filter((item: { type: string }) => Boolean(item.type));

if (normalized.length === 0) {
throw AppError.badRequest("Deliverables are invalid");
}
return normalized;
}
function parseAndValidateCampaignDetails(data: Record<string, unknown>) {
const requiresProduct = Boolean(data.requiresProduct);
const productValuePaise =
data.productValue === null || data.productValue === undefined
? null
: Math.max(0, Number(data.productValue));

const totalBudgetPaise = Number(data.totalBudget);
const perInfluencerBudgetPaise =
data.perInfluencerBudget === null || data.perInfluencerBudget === undefined
? null
: Number(data.perInfluencerBudget);
const minFollowers = Math.max(0, Number(data.minFollowers || 0));

validateCampaignInputAndBudgets(
data,
requiresProduct,
totalBudgetPaise,
perInfluencerBudgetPaise,
productValuePaise,
minFollowers
);

const title = safeStringCast(data.title).trim();
const description = safeStringCast(data.description).trim();
const requirements = safeStringCast(data.requirements).trim();
const guidelines = safeStringOrNullCast(data.guidelines)?.trim() ?? null;

if (!title || !description || !requirements) {
throw AppError.badRequest("Missing required fields: title, description, requirements");
}

assertNoContactDetails(title, "title");
assertNoContactDetails(description, "description");
assertNoContactDetails(requirements, "requirements");
assertNoContactDetails(guidelines, "guidelines");

const contentDeadline = new Date(data.contentDeadline as string);
const postingDeadline = new Date(data.postingDeadline as string);
const applicationDeadline = data.applicationDeadline
? new Date(data.applicationDeadline as string)
: null;

validateDeadlines(contentDeadline, postingDeadline, applicationDeadline, new Date());

const targetCategories = normalizeStringArray(data.targetCategories);
const targetCities = normalizeStringArray(data.targetCities);
const targetLanguages = normalizeStringArray(data.targetLanguages);

if (targetCategories.length === 0) {
throw AppError.badRequest("At least one target category is required");
}

const normalizedDeliverables = parseDeliverables(data.deliverables);

const maxFollowers = Number(data.maxFollowers || 0);

if (maxFollowers > 0 && maxFollowers < minFollowers) {
throw AppError.badRequest("maxFollowers must be greater than or equal to minFollowers");
}

const minEngagementRate =
data.minEngagementRate === null || data.minEngagementRate === undefined
? null
: Math.max(0, Number(data.minEngagementRate));

if (requiresProduct) {
const pName = data.productName;
if (typeof pName !== "string" || !pName.trim()) {
throw AppError.badRequest("Product name is required when product shipping is enabled");
}
if (!productValuePaise || productValuePaise <= 0) {
throw AppError.badRequest("Product value is required when product shipping is enabled");
}
}

const productName = data.productName ? safeStringCast(data.productName).trim() : null;
const productDescription = data.productDescription
? safeStringCast(data.productDescription).trim()
: null;

assertNoContactDetails(productName, "product name");
assertNoContactDetails(productDescription, "product description");

return {
requiresProduct,
productValuePaise,
totalBudgetPaise,
perInfluencerBudgetPaise,
minFollowers,
title,
description,
requirements,
guidelines,
contentDeadline,
postingDeadline,
applicationDeadline,
targetCategories,
targetCities,
targetLanguages,
normalizedDeliverables,
maxFollowers,
minEngagementRate,
productName,
productDescription,
};
}
async function lockAndDeductWalletForCampaign(
  tx: Prisma.TransactionClient,
  userId: string,
  totalAmount: number
) {
  const wallet = await tx.wallet.findUnique({ where: { userId } });
  if (!wallet) {
    throw AppError.badRequest("Brand wallet not found");
  }
  assertSufficientBalance(wallet, totalAmount);

  const updateResult = await tx.wallet.updateMany({
    where: { id: wallet.id, balance: { gte: totalAmount } },
    data: {
      balance: { decrement: totalAmount },
      pendingBalance: { increment: totalAmount },
    },
  });

  if (updateResult.count === 0) {
    throw AppError.badRequest("Insufficient wallet balance or concurrent transaction detected");
  }
  return wallet;
}

function buildCampaignCreationData(
  profileId: string,
  parsed: ReturnType<typeof parseAndValidateCampaignDetails>,
  data: Record<string, unknown>,
  isDraft: boolean,
  fundingTotalAmount: number
): Prisma.CampaignCreateInput {
  return {
    brand: { connect: { id: profileId } },
    title: parsed.title,
    description: parsed.description,
    requirements: parsed.requirements,
    guidelines: parsed.guidelines,
    totalBudget: parsed.totalBudgetPaise,
    perInfluencerBudget: parsed.perInfluencerBudgetPaise,
    fundedAmount: isDraft ? 0 : fundingTotalAmount,
    maxInfluencers: data.maxInfluencers ? Number(data.maxInfluencers) : null,
    targetCategories: parsed.targetCategories,
    targetCities: parsed.targetCities,
    targetLanguages: parsed.targetLanguages,
    targetGender: typeof data.targetGender === "string" ? data.targetGender : null,
    targetAgeMin: data.targetAgeMin != null ? Number(data.targetAgeMin) : null,
    targetAgeMax: data.targetAgeMax != null ? Number(data.targetAgeMax) : null,
    minFollowers: parsed.minFollowers,
    maxFollowers: parsed.maxFollowers > 0 ? parsed.maxFollowers : null,
    minEngagementRate: parsed.minEngagementRate,
    deliverables: parsed.normalizedDeliverables,
    applicationDeadline: parsed.applicationDeadline,
    contentDeadline: parsed.contentDeadline,
    postingDeadline: parsed.postingDeadline,
    status: isDraft ? "DRAFT" : "ACTIVE",
    requiresProduct: parsed.requiresProduct,
    productName: parsed.productName,
    productValue: parsed.productValuePaise,
    productDescription: parsed.productDescription,
    isDirectInvite: Boolean(data.invitedInfluencerId),
  };
}

interface PostCampaignTasksParams {
  tx: Prisma.TransactionClient;
  userId: string;
  wallet: { id: string } | null;
  newCampaignId: string;
  campaignTitle: string;
  parsedTotalBudgetPaise: number;
  campaignFundingAmounts: { totalAmount: number; platformFee: number; gatewayFee: number };
  fundedDealSlots: number;
  isDraft: boolean;
}

async function handlePostCampaignCreationTasks(params: PostCampaignTasksParams) {
  const {
    tx,
    userId,
    wallet,
    newCampaignId,
    campaignTitle,
    parsedTotalBudgetPaise,
    campaignFundingAmounts,
    fundedDealSlots,
    isDraft,
  } = params;
  await checkAndAwardBadges(userId, "CAMPAIGN_CREATED", tx);

  if (!isDraft) {
    await checkChallengeProgress(userId, "DEALS", 1, tx).catch((err) => {
      logger.error("Failed to track brand challenge progress for launch_campaign", { userId, error: err });
    });

    if (wallet) {
      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: "DEBIT",
          amount: campaignFundingAmounts.totalAmount,
          status: "COMPLETED",
          description: `Funds held for campaign creation: ${campaignTitle}`,
          metadata: {
            balanceImpact: true,
            campaignId: newCampaignId,
            totalBudget: parsedTotalBudgetPaise,
            platformFee: campaignFundingAmounts.platformFee,
            gatewayFee: campaignFundingAmounts.gatewayFee,
            fundedDealSlots,
          },
        },
      });
    }
  }

  await createActivityLog({
    userId,
    action: "CREATE_CAMPAIGN",
    entityType: "Campaign",
    entityId: newCampaignId,
  }, tx);
}

export async function createCampaign(userId: string, userType: UserType, data: Record<string, unknown>) {
  try {
    if (!isBrand(userType)) {
      throw AppError.badRequest("Only brands can create campaigns");
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw AppError.notFound("User not found");
    }
    assertAccountCanTransact(user.status);

    const parsed = parseAndValidateCampaignDetails(data);

    const campaignBrandFee = await resolveBrandPlatformFee(userId);
    const isProductOnly = parsed.requiresProduct && parsed.totalBudgetPaise === 0;
    const productHandlingFee = calculateProductHandlingFee(
      parsed.productValuePaise,
      parsed.requiresProduct,
      isProductOnly,
      campaignBrandFee.effectivePlatformFee,
    );

    const fundedDealSlots = estimateCampaignDealSlots(
      parsed.totalBudgetPaise,
      parsed.perInfluencerBudgetPaise,
      data.maxInfluencers ? Number(data.maxInfluencers) : null,
    );

    const campaignFundingAmounts = await checkBrandVerificationTiers(
      userId,
      parsed.totalBudgetPaise,
      parsed.productValuePaise,
      campaignBrandFee,
      fundedDealSlots,
      productHandlingFee
    );

    const isDraft = data.status === "DRAFT";

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const profile = await tx.brandProfile.findUnique({ where: { userId } });
      if (!profile) {
        throw AppError.notFound("Profile not found. Please complete your profile first.");
      }

      const wallet = !isDraft
        ? await lockAndDeductWalletForCampaign(tx, userId, campaignFundingAmounts.totalAmount)
        : null;

      const campaignCreateData = buildCampaignCreationData(
        profile.id,
        parsed,
        data,
        isDraft,
        campaignFundingAmounts.totalAmount
      );
      const newCampaign = await tx.campaign.create({ data: campaignCreateData });

      await handleDirectInviteInCampaign({
        tx,
        newCampaign,
        data,
        profile,
        totalBudgetPaise: parsed.totalBudgetPaise,
        perInfluencerBudgetPaise: parsed.perInfluencerBudgetPaise,
        normalizedDeliverables: parsed.normalizedDeliverables,
        requirements: parsed.requirements,
        contentDeadline: parsed.contentDeadline,
        postingDeadline: parsed.postingDeadline,
        requiresProduct: parsed.requiresProduct,
        productName: parsed.productName,
        productValuePaise: parsed.productValuePaise,
        productHandlingFee,
      });

      const profileUpdateData: Prisma.BrandProfileUpdateInput = {
        totalCampaigns: { increment: 1 },
        ...(isDraft ? {} : { activeCampaigns: { increment: 1 } }),
      };

      await tx.brandProfile.update({
        where: { id: profile.id },
        data: profileUpdateData,
      });

      await handlePostCampaignCreationTasks({
        tx,
        userId,
        wallet,
        newCampaignId: newCampaign.id,
        campaignTitle: parsed.title,
        parsedTotalBudgetPaise: parsed.totalBudgetPaise,
        campaignFundingAmounts,
        fundedDealSlots,
        isDraft,
      });

      return newCampaign;
    }, {
      // Serializable isolation prevents TOCTOU races on the budget/deal checks
      // when two parallel invites are sent at campaign creation time.
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });

    logger.info("Campaign created successfully", {
      userId,
      campaignId: result.id,
    });
    return result;
  } catch (error) {
    logger.error("Error creating campaign", error, { userId });
    throw error;
  }
}


