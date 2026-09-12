import { logger } from "@/lib/logger";
import { MatchingService } from "@/services/matching.service";
import { ApplicationInput } from "@/lib/validations";
import { checkMessageForContacts } from "@/lib/contact-filter";
import prisma from "@/lib/db";
import { Prisma, ApplicationStatus } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { isBrand, isInfluencer, isAdmin } from "@/lib/rbac";

async function checkCampaignOwnership(campaignId: string, userId: string, userType: string) {
if (isAdmin(userType) || isInfluencer(userType)) return;
const campaign = await prisma.campaign.findUnique({
where: { id: campaignId },
include: { brand: { select: { userId: true } } },
});

if (!campaign) throw AppError.notFound("Campaign not found");
const ownerId = campaign.brand?.userId;

if (ownerId !== userId) {
logger.warn("Unauthorized application list attempt", {
userId,
campaignId,
});
throw AppError.badRequest("Not authorized to view these applications");
}
}
async function resolveListWhere(
userId: string,
userType: string,
params: {
campaignId?: string;
status?: string;
},
): Promise<Prisma.ApplicationWhereInput | null> {
const where: Prisma.ApplicationWhereInput = {};

if (isInfluencer(userType)) {
const profile = await prisma.influencerProfile.findUnique({
where: { userId },
select: { id: true },
});
if (!profile) return null;
where.influencerId = profile.id;
}

if (params.campaignId) {
where.campaignId = params.campaignId;
await checkCampaignOwnership(params.campaignId, userId, userType);
  } else if (!isInfluencer(userType) && isBrand(userType)) {
    const profile = await prisma.brandProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    // SECURITY: if brand has no profile, return null immediately.
    // Without this guard, where stays as {} and exposes ALL applications to this user.
    if (!profile) return null;
    where.campaign = { brandId: profile.id };
  }

if (params.status) where.status = params.status as ApplicationStatus;

return where;
}
export async function listApplications(
userId: string,
userType: string,
params: {
campaignId?: string;
status?: string;
page: number;
limit: number;
},
) {
try {
const page = Math.max(1, params.page || 1);
const limit = Math.min(50, Math.max(1, params.limit || 10));

const where = await resolveListWhere(userId, userType, params);
if (!where) return { applications: [], total: 0 };

logger.info("Listing applications", {
userId,
userType,
filters: where,
page,
});

const [applications, total] = await Promise.all([
prisma.application.findMany({
where,
include: {
campaign: {
select: {
id: true,
title: true,
perInfluencerBudget: true,
targetCategories: true,
brand: { select: { companyName: true, logo: true } },
},
},
influencer: {
select: {
id: true,
displayName: true,
avatar: true,
instagramFollowers: true,
instagramEngagementRate: true,
youtubeSubscribers: true,
youtubeEngagementRate: true,
categories: true,
averageRating: true,
completedDeals: true,
followerAuthenticityScore: true,
user: { select: { trustScore: true, xp: true } },
},
},
},
orderBy: { createdAt: "desc" },
skip: (page - 1) * limit,
take: limit,
}),
prisma.application.count({ where }),
]);

  const selectedApps = applications.filter((app) => app.status === "SELECTED");
  const deals = selectedApps.length > 0
    ? await prisma.deal.findMany({
        where: {
          OR: selectedApps.map((a) => ({
            campaignId: a.campaignId,
            influencerId: a.influencerId,
          })),
        },
        select: {
          id: true,
          status: true,
          campaignId: true,
          influencerId: true,
          amount: true,
        },
      })
    : [];

  const dealMap = new Map<string, { id: string; amount: number; status: string }>(
    deals.map((d) => [`${d.campaignId}_${d.influencerId}`, { id: d.id, amount: d.amount, status: d.status }])
  );

  const applicationsWithScores = await Promise.all(
    applications.map(async (app) => {
      const matchResult = await MatchingService.calculateMatchScore(
        {
          id: app.campaign.id,
          targetCategories: app.campaign.targetCategories,
          perInfluencerBudget: app.campaign.perInfluencerBudget,
        },
        {
          id: app.influencer.id,
          categories: app.influencer.categories,
          instagramFollowers: app.influencer.instagramFollowers,
          instagramEngagementRate: app.influencer.instagramEngagementRate,
          youtubeSubscribers: app.influencer.youtubeSubscribers,
          youtubeEngagementRate: app.influencer.youtubeEngagementRate,
          followerAuthenticityScore: app.influencer.followerAuthenticityScore,
          averageRating: app.influencer.averageRating,
          xp: app.influencer.user.xp,
        },
        app.proposedRate
      );

      const dealInfo = app.status === "SELECTED"
        ? (dealMap.get(`${app.campaignId}_${app.influencerId}`) ?? null)
        : null;

      return {
        ...app,
        matchScore: matchResult.matchScore,
        matchBreakdown: matchResult.matchBreakdown,
        finalRate: dealInfo?.amount ?? null,
        dealId: dealInfo?.id ?? null,
        dealStatus: dealInfo?.status ?? null,
      };
    })
  );

// Sort by match score descending to bubble up highest matching/ROI candidates first
const sortedApplications = [...applicationsWithScores].sort((a, b) => b.matchScore - a.matchScore);

return { applications: sortedApplications, total, totalPages: Math.ceil(total / limit) };
} catch (error) {
logger.error("Error listing applications", error, { userId });
throw AppError.badRequest("Failed to list applications");
}
}
export function validateApplicationRatesAndProposal(data: ApplicationInput) {
if (!data.proposal || data.proposal.trim().length < 10) {
throw AppError.badRequest("Proposal is required and must be at least 10 characters");
}
if (data.proposal && checkMessageForContacts(data.proposal).hasContactInfo) {
throw AppError.badRequest("Contact details (phone, email, links, social handles, or UPI) are not allowed in your proposal pitch.");
}
if (data.proposedRate && data.proposedRate < 0) {
throw AppError.badRequest("Proposed rate cannot be negative");
}
}

