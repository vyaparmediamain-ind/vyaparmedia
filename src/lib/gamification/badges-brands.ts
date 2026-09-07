import { Prisma } from "@prisma/client";
import { BrandComplianceConfig, DbClient, GamificationUser } from "./types";
import prisma from "../db";

async function checkBrandFastApprover(userId: string, db: DbClient): Promise<boolean> {
const submissions = await db.contentSubmission.findMany({
where: {
deal: { brand: { userId } },
status: "APPROVED",
},
select: { submittedAt: true, reviewedAt: true },
});
const fastCount = submissions.filter((s: { reviewedAt: Date | null; submittedAt: Date | null }) => {
if (!s.reviewedAt || !s.submittedAt) return false;
const diff = new Date(s.reviewedAt).getTime() - new Date(s.submittedAt).getTime();
return diff <= 6 * 60 * 60 * 1000;
}).length;
return fastCount >= 10;
}

async function checkBrandRoiMaster(userId: string, db: DbClient): Promise<boolean> {
const campaigns = await db.campaign.findMany({
where: { brand: { userId } },
select: { id: true },
});
if (campaigns.length === 0) return false;

for (const campaign of campaigns) {
const deals = await db.deal.findMany({
where: { campaignId: campaign.id, status: "COMPLETED" },
include: { engagementSnapshots: true },
});

if (deals.length === 0) continue;

let totalSpend = 0;
let totalEstimatedValue = 0;

for (const deal of deals) {
totalSpend += deal.amount;
const snapshot =
deal.engagementSnapshots.find((s: { interval: string }) => s.interval === "7d") ||
deal.engagementSnapshots.find((s: { interval: string }) => s.interval === "48h") ||
deal.engagementSnapshots.find((s: { interval: string }) => s.interval === "24h") ||
deal.engagementSnapshots[0];

if (snapshot) {
const totalEngagements =
snapshot.likes +
snapshot.comments +
snapshot.shares +
snapshot.saves;
const views = snapshot.views ?? 0;
const clicks = snapshot.clicks ?? 0;
const estimatedValue =
views * 20 + totalEngagements * 100 + clicks * 500;
totalEstimatedValue += estimatedValue;
}
}

if (totalSpend > 0 && totalEstimatedValue >= 5 * totalSpend) {
return true;
}
}
return false;
}

async function checkBrandPartnershipPro(brandProfile: GamificationUser["brandProfile"], db: DbClient): Promise<boolean> {
const brandProfileId = brandProfile?.id;
if (!brandProfileId) return false;
const repeatDeals = await db.deal.groupBy({
by: ["influencerId"],
where: { brandId: brandProfileId, status: "COMPLETED" },
_count: { id: true },
});
const repeatPartners = repeatDeals.filter((group: { _count: { id: number | null } }) => (group._count.id ?? 0) >= 2).length;
return repeatPartners >= 5;
}

export async function checkBrandCompliance(
config: BrandComplianceConfig
): Promise<boolean> {
const {
badgeId,
userId,
user,
db,
brandProfile,
completedDealsCount,
fraudViolationsCount,
zeroRevisionDealsCount,
} = config;
switch (badgeId) {
case "first_campaign":
case "campaign_master":
case "big_spender":
case "mega_campaign":
return await checkBrandCampaignBadge(user, badgeId, db, brandProfile);
case "trust_novice":
case "trust_prime":
case "trust_super_prime":
case "trust_sovereign":
case "cibil_elite":
return await checkTrustBadge(user, badgeId, db, user.influencerProfile);
case "fraud_shield":
return completedDealsCount >= 10 && fraudViolationsCount === 0;
case "strict_compliance":
return zeroRevisionDealsCount >= 5;
case "no_revisions":
return zeroRevisionDealsCount >= 1;
case "fast_approver":
return checkBrandFastApprover(userId, db);
case "roi_master":
return checkBrandRoiMaster(userId, db);
case "partnership_pro":
return checkBrandPartnershipPro(brandProfile, db);
case "fair_payer": {
const campaigns = await db.campaign.findMany({
where: { brand: { userId } },
select: { perInfluencerBudget: true },
});
const averageBudget = campaigns.reduce((acc: number, c: { perInfluencerBudget: number | null }) => acc + (c.perInfluencerBudget || 0), 0) / (campaigns.length || 1);
return averageBudget >= 5000000;
}
default:
return false;
}
}


async function checkBrandCampaignBadge(
user: {
id: string;
userType: string;
brandProfile?: { id: string; totalCampaigns: number } | null;
},
badgeId: string,
db: Prisma.TransactionClient | typeof prisma,
brandProfile?: { id: string; totalCampaigns: number } | null,
): Promise<boolean> {
const profile = brandProfile || user.brandProfile;
if (user.userType !== "BRAND" || !profile) return false;

switch (badgeId) {
case "first_campaign":
return profile.totalCampaigns >= 1;
case "campaign_master":
return profile.totalCampaigns >= 25;
case "big_spender": {
const largeCampaign = await db.campaign.findFirst({
where: {
brandId: profile.id,
totalBudget: { gte: 10000000 },
deletedAt: null,
},
select: { id: true },
});
return Boolean(largeCampaign);
}
case "mega_campaign": {
const megaCampaign = await db.campaign.findFirst({
where: {
brandId: profile.id,
selectedInfluencers: { gte: 50 },
deletedAt: null,
},
select: { id: true },
});
return Boolean(megaCampaign);
}
default:
return false;
}
}

async function checkTrustBadge(
user: { id: string; trustScore: number },
badgeId: string,
db: Prisma.TransactionClient | typeof prisma,
influencerProfile?: { completedDeals: number } | null,
): Promise<boolean> {
const score = user.trustScore;
switch (badgeId) {
case "trust_novice":
return score >= 650;
case "trust_prime":
return score >= 750;
case "trust_super_prime":
return score >= 850;
case "trust_sovereign":
return score >= 900;
case "cibil_elite": {
const profile = influencerProfile || await db.influencerProfile.findUnique({
where: { userId: user.id },
select: { completedDeals: true },
});
return score >= 800 && (profile?.completedDeals || 0) >= 5;
}
default:
return false;
}
}



