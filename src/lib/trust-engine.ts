/**
* Trust Engine - Central orchestrator for Digital Reputation Score (DRS) & Trust Gates.
* Fetches real data from DB, runs the calculators from drs-score.ts, saves results.
*/

import prisma from "./db";
import { Prisma, ViolationType, VerificationLevel } from "@prisma/client";
import { createActivityLog } from "./audit";
import { logger } from "./logger";
import {
calculateInfluencerDRS,
calculateBrandDRS,
calculateLevel,
InfluencerDRSFactors,
BrandDRSFactors,
DRSResult,
getDRSTierAndLimit,
} from "./drs-score";

// ==================== TRUST GATE (Deal Limit Enforcement) ====================

interface TrustGateResult {
allowed: boolean;
maxDealAmount: number; // paise (-1 = unlimited)
currentTier: string;
currentScore: number;
reason?: string;
}

/**
* Check if a user can participate in a deal of the given amount.
* Validates against their DRS Tier.
*/
export async function checkTrustGate(
userId: string,
dealAmountPaise: number,
): Promise<TrustGateResult> {
const user = await prisma.user.findUnique({
where: { id: userId },
select: { trustScore: true, userType: true, status: true },
});

if (!user) {
return {
allowed: false,
maxDealAmount: 0,
currentTier: "UNKNOWN",
currentScore: 0,
reason: "User not found",
};
}

if (user.status === "BANNED" || user.status === "SUSPENDED") {
return {
allowed: false,
maxDealAmount: 0,
currentTier: "BANNED",
currentScore: user.trustScore,
reason: "Account is banned or suspended",
};
}

const score = user.trustScore;
// Use the shared getDRSTierAndLimit helper to get consistent logic
const { tier, maxDealAmount } = getDRSTierAndLimit(score);

if (tier === "FLAGGED") {
return {
allowed: false,
maxDealAmount: 0,
currentTier: tier,
currentScore: score,
reason: `DRS too low (${score}/900). Account flagged for manual review.`,
};
}

if (maxDealAmount !== -1 && dealAmountPaise > maxDealAmount) {
return {
allowed: false,
maxDealAmount,
currentTier: tier,
currentScore: score,
reason: `Deal amount ${(dealAmountPaise / 100).toLocaleString("en-IN")} exceeds your '${tier}' tier limit. Improve your DRS to unlock higher limits.`,
};
}

return {
allowed: true,
maxDealAmount,
currentTier: tier,
currentScore: score,
};
}

// ==================== RECALCULATE & SAVE DRS ====================

type TrustTrigger =
| "DEAL_COMPLETED"
| "DEAL_VERIFIED"
| "CONTENT_APPROVED"
| "REVIEW_RECEIVED"
| "DISPUTE_RESOLVED"
| "CONTENT_REJECTED"
| "LATE_DELIVERY"
| "VERIFICATION_APPROVED"
| "TERMS_VIOLATION"
| "POST_DELETED"
| "ADMIN_ADJUSTMENT";

function extractTrustReduction(metadata: unknown): number {
  if (!metadata) return 0;
  try {
    const parsed = typeof metadata === "string" ? JSON.parse(metadata) : metadata;
    if (parsed && typeof parsed === "object" && typeof (parsed as Record<string, unknown>).trustReduction === "number") {
      return (parsed as Record<string, unknown>).trustReduction as number;
    }
  } catch {
    // Ignore parse error
  }
  return 0;
}

async function applyProgressivePenalties(userId: string, baseScore: number): Promise<number> {
  try {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400 * 1000);
    const recentViolations = await prisma.userViolation.findMany({
      where: { userId, createdAt: { gte: ninetyDaysAgo } },
      select: { metadata: true },
    });
    const progressiveReduction = recentViolations.reduce(
      (sum, v) => sum + extractTrustReduction(v.metadata),
      0
    );
    return baseScore - progressiveReduction;
  } catch (err) {
    logger.error("Failed to apply progressive penalty reduction during DRS calculation", err);
    return baseScore;
  }
}

async function calculateNewTrustScore(
userId: string,
user: { trustScore: number; userType: string; createdAt: Date; verificationLevel: VerificationLevel },
): Promise<{ newScore: number; result: DRSResult | null } | null> {
let result: DRSResult | null = null;
let newScore: number;

if (user.userType === "INFLUENCER") {
result = await recalculateInfluencerDRSInternal(userId, user);
newScore = result.score;
} else if (user.userType === "BRAND") {
result = await recalculateBrandDRSInternal(userId);
newScore = result.score;
} else {
return null;
}

newScore = await applyProgressivePenalties(userId, newScore);
return { newScore: Math.max(300, Math.min(900, Math.round(newScore))), result };
}

/**
* Recalculate DRS and Level for a user.
* Fetches all relevant data, runs the calculator, saves the result.
*/
export async function updateTrustAndLevel(
userId: string,
trigger: TrustTrigger,
): Promise<void> {
try {
const user = await prisma.user.findUnique({
where: { id: userId },
select: {
id: true,
userType: true,
xp: true,
level: true,
trustScore: true,
createdAt: true,
verificationLevel: true,
},
});

if (!user) {
logger.warn("updateTrustAndLevel: User not found", { userId, trigger });
return;
}

const res = await calculateNewTrustScore(userId, user);
if (res === null) return;
const { newScore, result } = res;


// Recalculate level from XP (retaining XP logic)
const levelInfo = calculateLevel(user.xp)!;
// Prevent concurrent level downgrades
const newLevel = Math.max(user.level, levelInfo.level);

// Only update if something changed
if (newScore !== user.trustScore || newLevel !== user.level) {
await prisma.user.update({
where: { id: userId },
data: {
trustScore: newScore,
level: newLevel,
},
});

// Award new trust score badges dynamically if applicable
try {
const { checkAndAwardBadges } = await import("./gamification-engine");
await checkAndAwardBadges(userId, "TRUST_UPDATED");
} catch (badgeError) {
logger.error("Failed to check badges after trust update", badgeError, { userId });
}

// Log the change
if (result) {
await createActivityLog({
userId,
action: "DRS_UPDATE",
metadata: {
trigger,
oldScore: user.trustScore,
newScore,
oldLevel: user.level,
newLevel,
tier: result.tier,
breakdown: result.breakdown,
},
});
}

logger.info("DRS updated", {
userId,
trigger,
oldScore: user.trustScore,
newScore,
oldLevel: user.level,
newLevel,
});
}
} catch (error) {
// Trust score failures should NOT crash the caller (e.g., deal completion)
logger.error("updateTrustAndLevel failed non-fatal", error, {
userId,
action: trigger,
});
}
}

// ==================== INFLUENCER DATA FETCHER ====================

async function fetchInfluencerBasicStats(userId: string) {
const profile = await prisma.influencerProfile.findUnique({
where: { userId },
select: {
completedDeals: true,
totalEarnings: true,
instagramEngagementRate: true,
bio: true,
city: true,
avatar: true,
},
});

const reviews = await prisma.review.findMany({
where: {
deal: { influencer: { userId } },
reviewerType: "BRAND",
},
select: { rating: true },
});

const fiveStarReviews = reviews.filter((r) => r.rating === 5).length;
const poorReviews = reviews.filter((r) => r.rating <= 2).length;

return { profile, fiveStarReviews, poorReviews };
}

async function fetchInfluencerDealStats(userId: string) {
const deals = await prisma.deal.findMany({
where: {
influencer: { userId },
status: { in: ["VERIFIED", "COMPLETED"] },
},
select: {
submittedAt: true,
postingDeadline: true,
revisionsUsed: true,
maxRevisions: true,
},
});

const onTimeDeliveries = deals.filter(
(d) =>
d.postingDeadline &&
d.submittedAt &&
new Date(d.submittedAt) <= new Date(d.postingDeadline),
).length;

const lateDeliveries = deals.filter(
(d) =>
d.postingDeadline &&
d.submittedAt &&
new Date(d.submittedAt) > new Date(d.postingDeadline),
).length;

const contentRejections = deals.reduce(
(acc: number, d) => acc + (d.revisionsUsed || 0),
0,
);

return { onTimeDeliveries, lateDeliveries, contentRejections };
}

async function fetchInfluencerDisputes(userId: string) {
const resolvedDisputes = await prisma.dispute.findMany({
where: {
deal: { influencer: { userId } },
status: "RESOLVED",
},
select: { resolution: true, influencerOutcome: true },
});

const disputesLost = resolvedDisputes.filter((d) => {
try {
if (!d.influencerOutcome) return false;
const outcome = typeof d.influencerOutcome === "string"
? JSON.parse(d.influencerOutcome)
: d.influencerOutcome;
return typeof outcome === "object" && outcome !== null && typeof outcome.trust_score_change === "number" && outcome.trust_score_change < 0;
} catch {
return false;
}
}).length;

const disputesWon = resolvedDisputes.length - disputesLost;

return { disputesLost, disputesWon };
}

function calcProfileCompleteness(
profile: { bio?: string | null; avatar?: string | null; city?: string | null } | null,
verificationLevel: string,
): number {
let completeness = 0;
if (profile?.bio) completeness += 20;
if (profile?.avatar) completeness += 20;
if (profile?.city) completeness += 20;
if (verificationLevel !== "NONE") completeness += 40;
return completeness;
}

async function recalculateInfluencerDRSInternal(
userId: string,
user: { createdAt: Date; verificationLevel: string },
): Promise<DRSResult> {
const { profile, fiveStarReviews, poorReviews } = await fetchInfluencerBasicStats(userId);
const { onTimeDeliveries, lateDeliveries, contentRejections } = await fetchInfluencerDealStats(userId);
const { disputesLost, disputesWon } = await fetchInfluencerDisputes(userId);

const [referralStats, termsViolationsCount, fraudViolations, paymentFraudAttempts] = await Promise.all([
prisma.user.aggregate({
where: { referredBy: userId, trustScore: { gte: 700 } }, // Quality referrals
_count: true,
_avg: { trustScore: true },
}),
prisma.userViolation.count({ where: { userId, type: "TERMS_VIOLATION" } }),
prisma.userViolation.count({ where: { userId, type: "FRAUD" } }),
prisma.userViolation.count({ where: { userId, type: "PAYMENT_FRAUD" as ViolationType } }),
]);

const completeness = calcProfileCompleteness(profile, user.verificationLevel);

const factors: InfluencerDRSFactors = {
completedDeals: profile?.completedDeals || 0,
totalEarningsPaise: profile?.totalEarnings || 0,
fiveStarReviews,
onTimeDeliveries,
lateDeliveries,
poorReviews,
contentRejections,
disputesLost,
disputesWon,
identityVerified:
user.verificationLevel === "IDENTITY" ||
user.verificationLevel === "FULL",
accountAgeDays: Math.floor(
(Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24),
),
engagementRate: profile?.instagramEngagementRate || 0,
fakeFollowersDetected: fraudViolations > 0,
termsViolations: termsViolationsCount,
paymentFraudAttempts: paymentFraudAttempts,
successfulReferrals: referralStats._count,
avgReferralDRS: referralStats._avg.trustScore || 0,
profileCompleteness: completeness,
};

return calculateInfluencerDRS(factors);
}

// ==================== BRAND DATA FETCHER ====================

async function recalculateBrandDRSInternal(userId: string): Promise<DRSResult> {
const brandProfile = await prisma.brandProfile.findUnique({
where: { userId },
select: { id: true, isGstVerified: true },
});

const profileId = brandProfile?.id;
const isVerified = brandProfile?.isGstVerified || false;

// Count completed campaigns
let completedCampaigns = 0;
if (brandProfile) {
completedCampaigns = await prisma.campaign.count({
where: { brandId: brandProfile.id, status: "COMPLETED" },
});
}

// Disputes brand relations
const disputeWhere = { deal: { brand: { userId } } };

const resolvedDisputes = await prisma.dispute.findMany({
where: {
...disputeWhere,
status: "RESOLVED",
},
select: { resolution: true, brandOutcome: true },
});

const disputesLost = resolvedDisputes.filter((d) => {
try {
if (!d.brandOutcome) return false;
const outcome = typeof d.brandOutcome === "string"
? JSON.parse(d.brandOutcome)
: d.brandOutcome;
return typeof outcome === "object" && outcome !== null && typeof outcome.trust_score_change === "number" && outcome.trust_score_change < 0;
} catch {
return false;
}
}).length;

// Spec: Fair reviews from influencers (count reviews where influencer reviewed the brand)
const dealWhereForBrand = brandProfile
? { brandId: brandProfile.id }
: { brandId: "none" };

const influencerReviews = await prisma.review.findMany({
where: {
deal: dealWhereForBrand,
reviewerType: "INFLUENCER",
},
select: { rating: true },
});
const fairReviews = influencerReviews.filter(
(r) => r.rating >= 4,
).length;

// Spec: Long-term partnerships count influencers worked with 3+ times
const repeatInfluencers = profileId
? await prisma.deal.groupBy({
by: ["influencerId"],
where: {
...dealWhereForBrand,
status: { in: ["COMPLETED", "VERIFIED"] },
},
_count: true,
having: {
influencerId: { _count: { gte: 3 } },
},
})
: [];
const longTermPartnerships = repeatInfluencers.length;

// Spec: Unfair rejections deals rejected by brand then overturned
const unfairRejections = resolvedDisputes.filter((d) => {
try {
if (!d.brandOutcome) return false;
const outcome = typeof d.brandOutcome === "string"
? JSON.parse(d.brandOutcome)
: d.brandOutcome;
return (
typeof outcome === "object" &&
outcome !== null &&
typeof outcome.trust_score_change === "number" &&
outcome.trust_score_change < 0 &&
typeof outcome.refund_percentage === "number" &&
outcome.refund_percentage < 100
);
} catch {
return false;
}
}).length;

// Spec: Influencer complaints open/resolved disputes raised by influencers against this brand
const influencerComplaints = await prisma.dispute.count({
  where: {
    ...disputeWhere,
    raisedBy: { userType: "INFLUENCER" },
  },
});

const [termsViolations, totalPayments, failedPayments, fastApprovals] = await Promise.all([
  prisma.userViolation.count({ where: { userId, type: "TERMS_VIOLATION" } }),
  prisma.transaction.count({ where: { wallet: { userId }, type: "CREDIT" } }),
  prisma.transaction.count({ where: { wallet: { userId }, type: "CREDIT", status: "FAILED" } }),
  calculateFastApprovals(dealWhereForBrand),
]);

const paymentReliability = totalPayments > 0 ? (totalPayments - failedPayments) / totalPayments : 1.0;

const factors: BrandDRSFactors = {
  completedCampaigns: completedCampaigns,
  fastApprovals: fastApprovals,
  lateApprovals: await calculateLateApprovals(userId, dealWhereForBrand),
  fairReviews,
  disputesLost,
  companyVerified: isVerified,
  paymentReliability,
  termsViolations,
  longTermPartnerships,
  unfairRejections,
  influencerComplaints,
};

return calculateBrandDRS(factors);
}

async function calculateFastApprovals(
  dealWhere: Prisma.DealWhereInput,
): Promise<number> {
  const deals = await prisma.deal.findMany({
    where: {
      ...dealWhere,
      status: { in: ["COMPLETED", "VERIFIED", "CONTENT_APPROVED"] },
      submittedAt: { not: null },
      approvedAt: { not: null },
    },
    select: {
      submittedAt: true,
      approvedAt: true,
      reviewPeriodHours: true,
    },
  });

  return deals.filter((d) => {
    if (!d.submittedAt || !d.approvedAt) return false;
    const submitted = new Date(d.submittedAt).getTime();
    const approved = new Date(d.approvedAt).getTime();
    const allowedDuration = (d.reviewPeriodHours ?? 48) * 3600 * 1000;
    return approved - submitted <= allowedDuration;
  }).length;
}

async function calculateLateApprovals(
userId: string,
dealWhere: Prisma.DealWhereInput,
): Promise<number> {
const deals = await prisma.deal.findMany({
where: {
...dealWhere,
status: { in: ["COMPLETED", "VERIFIED", "CONTENT_APPROVED"] },
submittedAt: { not: null },
approvedAt: { not: null },
},
select: {
submittedAt: true,
approvedAt: true,
reviewPeriodHours: true,
},
});

return deals.filter((d) => {
if (!d.submittedAt || !d.approvedAt) return false;
const submitted = new Date(d.submittedAt).getTime();
const approved = new Date(d.approvedAt).getTime();
const allowedDuration = (d.reviewPeriodHours ?? 48) * 3600 * 1000;
return approved - submitted > allowedDuration;
}).length;
}
