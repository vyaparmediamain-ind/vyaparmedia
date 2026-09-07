import { assertAccountCanTransact } from "@/lib/utils";
import { TierError } from "@/services/campaign.service";
import { addUserXp } from "@/lib/gamification-engine";
import { checkChallengeProgress } from "@/lib/weekly-challenges";
import { createActivityLog } from "@/lib/audit";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { checkApplicationFraud } from "@/lib/fraud-detection";
import { checkTrustGate } from "@/lib/trust-engine";
import { checkVerificationTierForAmount, tierErrorResponse } from "@/lib/verification-tiers";
import { checkEnterpriseApplicationGate } from "@/lib/enterprise-trust-guard";
import { logger } from "@/lib/logger";
import { validateApplicationRatesAndProposal } from "./list";
import { BlockService } from "@/services/block.service";
import { ApplicationInput } from "@/lib/validations";
import { CampaignValidateResult, resolveApplicationDealAmount } from "./types";

async function getAndValidateInfluencer(userId: string) {
const user = await prisma.user.findUnique({
where: { id: userId },
include: {
influencerProfile: {
select: {
id: true,
instagramFollowers: true,
youtubeSubscribers: true,
instagramHandle: true,
youtubeHandle: true,
followerAuthenticityScore: true,
},
},
},
});

if (!user) throw AppError.notFound("User not found");
assertAccountCanTransact(user.status);

const profile = user.influencerProfile;
if (!profile) {
throw AppError.badRequest("Please complete your profile before applying");
}

if (!profile.instagramHandle && !profile.youtubeHandle) {
throw AppError.badRequest(
"You must connect at least one social media handle (Instagram or YouTube) to your profile before applying to campaigns."
);
}

// Direct authenticity score hard block
if (profile.followerAuthenticityScore < 40) {
throw AppError.badRequest(
`Your follower authenticity score (${profile.followerAuthenticityScore}/100) is below the minimum required threshold of 40. High authenticity is required to participate in campaigns.`
);
}

const instaFollowers = profile.instagramFollowers === null ? 0 : (profile.instagramFollowers ?? 0);
const ytSubs = profile.youtubeSubscribers === null ? 0 : (profile.youtubeSubscribers ?? 0);
const hasHiddenSubscribers = instaFollowers === -1 || ytSubs === -1;
const maxRelevantFollowers = hasHiddenSubscribers ? -1 : Math.max(instaFollowers, ytSubs);

if (!hasHiddenSubscribers && maxRelevantFollowers < 1000) {
throw AppError.badRequest(
"You must have at least 1,000 Instagram followers or YouTube subscribers to apply for campaigns on VyaparMedia."
);
}

return { profile, maxRelevantFollowers, hasHiddenSubscribers };
}
function validateFollowerThresholds(
  campaign: { minFollowers: number; maxFollowers: number | null; requiresProduct: boolean; totalBudget: number },
  maxRelevantFollowers: number,
  hasHiddenSubscribers: boolean
) {
  const isProductOnly = campaign.requiresProduct && campaign.totalBudget === 0;
  if (isProductOnly) {
    if (!hasHiddenSubscribers && maxRelevantFollowers > 10000) {
      throw AppError.badRequest(
        "Product-only campaigns are only available for influencers with 10,000 or fewer followers/subscribers."
      );
    }
  }

  if (!hasHiddenSubscribers && maxRelevantFollowers < campaign.minFollowers) {
    throw AppError.badRequest(`Minimum ${campaign.minFollowers.toLocaleString()} followers required`);
  }
  if (!hasHiddenSubscribers && campaign.maxFollowers && maxRelevantFollowers > campaign.maxFollowers) {
    throw AppError.badRequest(`Maximum ${campaign.maxFollowers.toLocaleString()} followers allowed`);
  }
}

async function getAndValidateCampaign(
  campaignId: string,
  maxRelevantFollowers: number,
  hasHiddenSubscribers: boolean,
  userId: string,
) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      status: true,
      minFollowers: true,
      maxFollowers: true,
      applicationDeadline: true,
      perInfluencerBudget: true,
      maxInfluencers: true,
      selectedInfluencers: true,
      requiresProduct: true,
      totalBudget: true,
      productValue: true,
      brand: { select: { userId: true } },
    },
  });

  if (!campaign) throw AppError.notFound("Campaign not found");
  if (campaign.status !== "ACTIVE") {
    throw AppError.badRequest("Campaign is not accepting applications");
  }

  if (campaign.brand?.userId) {
    const isBlocked = await BlockService.isBlocked(userId, campaign.brand.userId);
    if (isBlocked) {
      throw AppError.forbidden("You cannot apply to this campaign");
    }
  }

  if (
    campaign.maxInfluencers !== null &&
    campaign.maxInfluencers !== undefined &&
    campaign.selectedInfluencers >= campaign.maxInfluencers
  ) {
    throw AppError.badRequest("This campaign has reached its maximum number of influencer slots.");
  }
  if (campaign.applicationDeadline) {
    if (new Date() > campaign.applicationDeadline) {
      throw AppError.badRequest("Application deadline has passed");
    }
  }

  validateFollowerThresholds(campaign, maxRelevantFollowers, hasHiddenSubscribers);

  return campaign;
}
async function checkVerificationAndGates(
  userId: string,
  data: ApplicationInput,
  campaign: CampaignValidateResult
) {
const isProductOnly = campaign.requiresProduct && campaign.totalBudget === 0;
const applicationValue = isProductOnly ? campaign.productValue || 0 : campaign.perInfluencerBudget || 0;

const tierCheck = await checkVerificationTierForAmount(userId, "INFLUENCER", applicationValue);
if (!tierCheck.allowed) {
throw new TierError(tierCheck.reason || "Verification required", tierErrorResponse(tierCheck));
}

const fraudCheck = await checkApplicationFraud({
userId,
campaignId: data.campaignId,
proposalContent: data.proposal,
});

if (fraudCheck.action === "BLOCK") {
logger.warn("Application blocked by fraud check", {
userId,
campaignId: data.campaignId,
reason: fraudCheck.flags.map((f: { description: string }) => f.description).join(", "),
});
throw AppError.badRequest("Application blocked. Please contact support.");
}

if (fraudCheck.action === "REVIEW") {
logger.warn("Application flagged for admin review", {
userId,
campaignId: data.campaignId,
riskScore: fraudCheck.riskScore,
flags: fraudCheck.flags.map((f: { description: string }) => f.description),
});
}

const dealAmount = resolveApplicationDealAmount(data.proposedRate, campaign.perInfluencerBudget);
if (dealAmount > 0) {
const trustGate = await checkTrustGate(userId, dealAmount);
if (!trustGate.allowed) {
logger.warn("Trust gate block application", { userId, dealAmount });
throw AppError.badRequest(trustGate.reason || "Trust score too low for this campaign");
}

const enterpriseGate = await checkEnterpriseApplicationGate(userId, dealAmount);
if (!enterpriseGate.allowed) {
logger.warn("Enterprise gate block application", {
userId,
dealAmount,
reason: enterpriseGate.reason,
});
throw AppError.badRequest(enterpriseGate.reason || "Limited by enterprise risk guard.");
}
}

return { fraudCheck };
}
export async function createApplication(userId: string, data: ApplicationInput) {
try {
validateApplicationRatesAndProposal(data);

const { profile, maxRelevantFollowers, hasHiddenSubscribers } =
await getAndValidateInfluencer(userId);

const campaign = await getAndValidateCampaign(
data.campaignId,
maxRelevantFollowers,
hasHiddenSubscribers,
userId
);

const { fraudCheck } = await checkVerificationAndGates(userId, data, campaign);

const existing = await prisma.application.findUnique({
where: {
campaignId_influencerId: {
campaignId: data.campaignId,
influencerId: profile.id,
},
},
});
if (existing) {
throw AppError.badRequest("You have already applied to this campaign");
}

const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
const newApplication = await tx.application.create({
data: {
campaignId: data.campaignId,
influencerId: profile.id,
proposal: data.proposal,
proposedRate: data.proposedRate || 0,
estimatedDelivery: data.estimatedDelivery
? new Date(data.estimatedDelivery)
: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default 1 week
status: fraudCheck.action === "REVIEW" ? "FLAGGED" : "PENDING",
},
});

await tx.campaign.update({
where: { id: data.campaignId },
data: { totalApplications: { increment: 1 } },
});

await addUserXp(userId, 10, "SUBMIT_APPLICATION", tx);

await checkChallengeProgress(userId, "DEALS", 1, tx).catch((err) => {
  logger.error("Failed to track influencer challenge progress for apply_5_campaigns", { userId, error: err });
});

await createActivityLog({
userId,
action: "SUBMIT_APPLICATION",
entityType: "Application",
entityId: newApplication.id,
metadata: {
campaignId: data.campaignId,
fraudCheckResult: fraudCheck.action,
riskScore: fraudCheck.riskScore,
flags: fraudCheck.flags.map((f: { rule: string }) => f.rule),
},
}, tx);

return newApplication;
});

logger.info("Application submitted successfully", {
userId,
applicationId: result.id,
});
return result;
} catch (error) {
  logger.error("Error creating application", error, {
    userId,
    campaignId: data.campaignId,
  });
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw AppError.badRequest("You have already applied to this campaign");
  }
  throw error;
}
}
export function validateApplicationCanBeAccepted(
application: {
status: string;
campaign: {
status: string;
maxInfluencers: number | null;
selectedInfluencers: number;
brandId: string | null;
};
},
brandProfileId: string,
): void {
if (application.campaign.brandId !== brandProfileId) {
throw AppError.badRequest("Not authorized to accept this application");
}

if (
application.campaign.maxInfluencers !== null &&
application.campaign.maxInfluencers !== undefined &&
application.campaign.selectedInfluencers >= application.campaign.maxInfluencers
) {
throw AppError.badRequest("This campaign has reached its maximum number of influencer slots.");
}

if (!["PENDING", "SHORTLISTED"].includes(application.status)) {
throw AppError.badRequest("Only pending applications can be accepted");
}

if (application.campaign.status !== "ACTIVE") {
throw AppError.badRequest("Campaign is not active");
}
}

