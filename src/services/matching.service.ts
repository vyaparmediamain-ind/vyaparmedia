import prisma from "@/lib/db";
import { logger } from "@/lib/logger";
import { calculateLevel } from "@/lib/drs-score";

interface MatchBreakdown {
categoryScore: number;
engagementScore: number;
authenticityScore: number;
qualityScore: number;
roiScore: number;
estimatedViews: number;
estimatedCpvPaise: number;
}

interface MatchScoreResult {
matchScore: number;
matchBreakdown: MatchBreakdown;
}

export class MatchingService {
private static calculateCategoryScore(targetCategories: string[], categories: string): number {
if (!targetCategories || targetCategories.length === 0) return 100;

const infCategories = categories
? categories
.split(",")
.map((c) => c.trim().toLowerCase())
.filter(Boolean)
: [];

if (infCategories.length === 0) return 0;

const matchingCategories = targetCategories.filter((c) =>
infCategories.includes(c.toLowerCase())
);
return Math.round((matchingCategories.length / targetCategories.length) * 100);
}

private static async getHistoricalEngagementRate(
influencerId: string
): Promise<{ rate: number; hasData: boolean }> {
const deals = await prisma.deal.findMany({
where: {
influencerId,
status: { in: ["VERIFIED", "COMPLETED", "POSTED"] },
},
select: { id: true },
take: 100,
orderBy: { createdAt: "desc" },
});

const dealIds = deals.map((d) => d.id);
if (dealIds.length === 0) return { rate: 0, hasData: false };

const snapshots = await prisma.engagementSnapshot.findMany({
where: { dealId: { in: dealIds } },
orderBy: { capturedAt: "desc" },
take: 500,
});

if (snapshots.length === 0) return { rate: 0, hasData: false };

const latestSnapshotsMap = new Map<string, typeof snapshots[0]>();
for (const snap of snapshots) {
if (!latestSnapshotsMap.has(snap.dealId)) {
latestSnapshotsMap.set(snap.dealId, snap);
}
}

const uniqueSnaps = Array.from(latestSnapshotsMap.values());
const totalViews = uniqueSnaps.reduce((sum, s) => sum + s.views, 0);
const totalInteractions = uniqueSnaps.reduce(
(sum, s) => sum + s.likes + s.comments + s.shares + s.saves,
0
);

  // Safe scale calculations:
  // - Path A: Direct calculation based on aggregated views/interactions. Expressed as percentage (%).
  // - Path B (Fallback): Average of pre-computed basis points (BP) engagement rates across snapshots. 
  //   Since engagementRate is stored in basis points (e.g. 450 = 4.5%), dividing by 100 converts it back to standard percentage scale.
  if (totalViews > 0) {
    return { rate: (totalInteractions / totalViews) * 100, hasData: true };
  }

  const totalBP = uniqueSnaps.reduce((sum, s) => sum + s.engagementRate, 0);
  const rate = uniqueSnaps.length > 0 ? totalBP / uniqueSnaps.length / 100 : 0;
  return { rate, hasData: rate > 0 };
}

private static async calculateQualityScore(
influencerId: string,
averageRating: number
): Promise<number> {
const reviews = await prisma.review.findMany({
where: {
influencerRevieweeId: influencerId,
reviewerType: "BRAND",
},
take: 100,
orderBy: { createdAt: "desc" },
select: {
rating: true,
qualityRating: true,
communicationRating: true,
timelinessRating: true,
},
});

if (reviews.length > 0) {
let sumRatings = 0;
let ratingCount = 0;

for (const rev of reviews) {
const specificScores = [
rev.qualityRating,
rev.communicationRating,
rev.timelinessRating,
].filter((r): r is number => r !== null && r !== undefined && r > 0);

if (specificScores.length > 0) {
const avgSpecific =
specificScores.reduce((sum, s) => sum + s, 0) / specificScores.length;
sumRatings += avgSpecific;
} else {
sumRatings += rev.rating;
}
ratingCount++;
}

const avgRating = sumRatings / ratingCount;
return Math.max(0, Math.min(100, Math.round(((avgRating - 1) / 4) * 100)));
} else if (averageRating > 0) {
const ratingStar = averageRating / 100;
return Math.max(0, Math.min(100, Math.round(((ratingStar - 1) / 4) * 100)));
}

return 70; // Default neutral baseline
}

private static calculateRoiScore(cpvPaise: number): number {
if (cpvPaise <= 10) return 100;
if (cpvPaise <= 20) return 85;
if (cpvPaise <= 45) return 70;
if (cpvPaise <= 100) return 50;
return 30;
}

/**
* Calculates an advanced, ROI-maximizing matching score (0-100)
* for an influencer against a specific campaign and proposed rate.
*/
static async calculateMatchScore(
campaign: {
id: string;
targetCategories: string[];
perInfluencerBudget: number | null;
},
influencer: {
id: string;
categories: string;
instagramFollowers: number | null;
instagramEngagementRate: number | null;
youtubeSubscribers: number | null;
youtubeEngagementRate: number | null;
followerAuthenticityScore: number;
averageRating: number; // 0-500 scale
xp?: number;
},
proposedRatePaise?: number
): Promise<MatchScoreResult> {
try {
const categoryScore = this.calculateCategoryScore(campaign.targetCategories, influencer.categories);

const igER = (influencer.instagramEngagementRate || 0) / 100;
const ytER = (influencer.youtubeEngagementRate || 0) / 100;
const profileER = Math.max(igER, ytER);

const history = await this.getHistoricalEngagementRate(influencer.id);
const blendedER = history.hasData
? 0.6 * history.rate + 0.4 * profileER
: profileER;

let engagementScore = 20;
if (blendedER >= 5) {
engagementScore = 100;
} else if (blendedER >= 3) {
engagementScore = 85;
} else if (blendedER >= 1.5) {
engagementScore = 70;
} else if (blendedER >= 0.5) {
engagementScore = 50;
}

const authenticityScore = influencer.followerAuthenticityScore;
const qualityScore = await this.calculateQualityScore(influencer.id, influencer.averageRating);

const activeCostPaise = proposedRatePaise || campaign.perInfluencerBudget || 200000;
const igFollowers = influencer.instagramFollowers || 0;
const ytSubs = influencer.youtubeSubscribers || 0;
const totalFollowers = igFollowers + ytSubs;

const authenticReach = totalFollowers * (authenticityScore / 100);
const estimatedViews = Math.max(10, Math.round(authenticReach * (blendedER / 100)));
const cpvPaise = activeCostPaise / estimatedViews;

const roiScore = this.calculateRoiScore(cpvPaise);

const baseMatchScore = Math.max(
0,
Math.min(
100,
Math.round(
0.2 * categoryScore +
0.2 * engagementScore +
0.2 * authenticityScore +
0.2 * qualityScore +
0.2 * roiScore
)
)
);

// Level-based matching boost: level * 2, capped at 20 points
const level = calculateLevel(influencer.xp ?? 0).level;
const levelBoost = Math.min(level * 2, 20);
const matchScore = Math.min(100, baseMatchScore + levelBoost);

return {
matchScore,
matchBreakdown: {
categoryScore,
engagementScore,
authenticityScore,
qualityScore,
roiScore,
estimatedViews,
estimatedCpvPaise: Math.round(cpvPaise),
},
};
} catch (err) {
logger.error("Error in calculateMatchScore", err, {
campaignId: campaign.id,
influencerId: influencer.id,
});
return {
matchScore: 50,
matchBreakdown: {
categoryScore: 50,
engagementScore: 50,
authenticityScore: 50,
qualityScore: 50,
roiScore: 50,
estimatedViews: 0,
estimatedCpvPaise: 0,
},
};
}
}
}
