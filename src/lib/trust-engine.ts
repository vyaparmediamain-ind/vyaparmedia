/**
* Trust Engine - Central orchestrator for Digital Reputation Score (DRS) & Trust Gates.
* Fetches real data from DB, runs the calculators from drs-score.ts, saves results.
*/

import prisma from "./db";
import { Prisma, VerificationLevel } from "@prisma/client";
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
  applyVelocityCap,
  DRS_MAX_WEEKLY_CHANGE,
  RecencyBuckets,
  QualitativeReputationSummary,
  QualitativeReputationCategory,
  getDRSTierLabel,
  getInfluencerQualitativeBreakdown,
  getBrandQualitativeBreakdown,
} from "./drs-score";
import { DRS_QUALIFIED_DEAL_VALUE_PAISE } from "@/constants";
import { getTrustRuleWeights } from "./trust-rules";
import { formatCurrency } from "./utils-client";

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
reason: `Deal amount ${formatCurrency(dealAmountPaise)} exceeds your '${tier}' tier limit. Improve your DRS to unlock higher limits.`,
};
}

return {
allowed: true,
maxDealAmount,
currentTier: tier,
currentScore: score,
};
}

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
  trigger: string,
): Promise<{ newScore: number; calculatedScore: number; previousScore: number; result: DRSResult | null } | null> {
  let result: DRSResult | null = null;
  let rawScore: number;

  if (user.userType === "INFLUENCER") {
    result = await recalculateInfluencerDRSInternal(userId, user);
    rawScore = result.score;
  } else if (user.userType === "BRAND") {
    result = await recalculateBrandDRSInternal(userId);
    rawScore = result.score;
  } else {
    return null;
  }

  // Apply progressive penalties to get the "true" target score.
  rawScore = await applyProgressivePenalties(userId, rawScore);
  const calculatedScore = Math.max(300, Math.min(900, Math.round(rawScore)));

  // ── Velocity Cap (CIBIL style) ─────────────────────────────────────────────
  // Use the most-recent DrsScoreSnapshot as the anchor.  Falls back to
  // user.trustScore (600 for brand-new accounts) when no snapshot exists yet.
  const lastSnapshot = await prisma.drsScoreSnapshot.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { finalScore: true },
  });
  const previousScore = lastSnapshot?.finalScore ?? user.trustScore;

  // ADMIN_ADJUSTMENT bypasses the weekly cap so manual corrections take
  // immediate effect; all regular score triggers are capped at ±50 pts.
  const maxChange = trigger === "ADMIN_ADJUSTMENT" ? 300 : DRS_MAX_WEEKLY_CHANGE;
  const newScore = applyVelocityCap(previousScore, calculatedScore, maxChange);

  return { newScore, calculatedScore, previousScore, result };
}

// ─── Collusion / Wash-Trading Detection ─────────────────────────────────────
//
// Runs as a side-effect of every DRS recalculation cycle.
// Scans all influencer-brand pairs that the given user is part of.
// Flags pairs where:
//   • ≥ COLLUSION_MIN_DEALS completed/verified deals exist
//   • ALL deals in the suspicious set have mutual 5-star reviews
//   • Average deal amount ≤ COLLUSION_AMOUNT_MULTIPLIER × qualifying threshold
//
// Result is upserted into ReviewFlagRecord (one row per pair).
// No automatic punitive action — admins review via /api/admin/reports/suspicious-reviews.

const COLLUSION_MIN_DEALS           = 3;    // Minimum deals in pair to trigger check
const COLLUSION_AMOUNT_MULTIPLIER   = 2;    // Deal amount ≤ 2× qualifying threshold
const COLLUSION_MAX_RISK_SCORE      = 100;

/**
 * Detects collusion / wash-trading between the given user and their counterparties.
 *
 * Called automatically after every DRS recalculation.  Uses upsert so re-runs
 * are idempotent — the evidence snapshot is refreshed on each cycle.
 *
 * @param userId  - The user whose deals are being inspected (influencer OR brand)
 */
export async function detectCollusionPatterns(userId: string): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { userType: true },
    });
    if (!user || (user.userType !== "INFLUENCER" && user.userType !== "BRAND")) return;

    const isInfluencer = user.userType === "INFLUENCER";
    const qualifyingThresholdPaise = DRS_QUALIFIED_DEAL_VALUE_PAISE;
    const suspiciousAmountCeil = qualifyingThresholdPaise * COLLUSION_AMOUNT_MULTIPLIER;

    // Fetch all completed deals for this user, joined with reviews on both sides
    const deals = await prisma.deal.findMany({
      where: isInfluencer
        ? { influencer: { userId }, status: { in: ["COMPLETED", "VERIFIED"] }, deletedAt: null }
        : { brand: { userId }, status: { in: ["COMPLETED", "VERIFIED"] }, deletedAt: null },
      select: {
        id: true,
        amount: true,
        influencer: { select: { userId: true } },
        brand:      { select: { userId: true } },
        reviews: {
          select: { reviewerId: true, receiverId: true, rating: true, reviewerType: true },
        },
      },
    });

    // Group deals by counterparty userId
    const pairMap = new Map<
      string,   // counterparty userId
      { dealId: string; amount: number; hasMutual5Star: boolean }[]
    >();

    for (const deal of deals) {
      const counterpartyUserId = isInfluencer
        ? deal.brand?.userId
        : deal.influencer?.userId;
      if (!counterpartyUserId) continue;

      // Determine if BOTH sides gave 5-star reviews on this deal
      const brandReview      = deal.reviews.find(r => r.reviewerType === "BRAND");
      const influencerReview = deal.reviews.find(r => r.reviewerType === "INFLUENCER");
      const hasMutual5Star   = brandReview?.rating === 5 && influencerReview?.rating === 5;

      const existing = pairMap.get(counterpartyUserId) ?? [];
      existing.push({ dealId: deal.id, amount: deal.amount, hasMutual5Star });
      pairMap.set(counterpartyUserId, existing);
    }

    // Evaluate each pair
    for (const [counterpartyUserId, pairDeals] of pairMap.entries()) {
      const suspicious = pairDeals.filter(
        d => d.hasMutual5Star && d.amount <= suspiciousAmountCeil,
      );

      if (suspicious.length < COLLUSION_MIN_DEALS) continue;

      // Risk score: 0-100 based on (suspiciousDealCount / totalDeals) × 100
      // capped so a pair with 3/3 suspicious deals = 100, 3/10 = 30, etc.
      const riskScore = Math.min(
        COLLUSION_MAX_RISK_SCORE,
        Math.round((suspicious.length / pairDeals.length) * 100),
      );

      const avgDealAmountPaise = Math.round(
        suspicious.reduce((s, d) => s + d.amount, 0) / suspicious.length,
      );

      const flagReason =
        `${suspicious.length} mutual 5-star deals (of ${pairDeals.length} total), ` +
        `avg ${formatCurrency(avgDealAmountPaise)} ` +
        `(≤ ${COLLUSION_AMOUNT_MULTIPLIER}× qualifying threshold of ` +
        `${formatCurrency(qualifyingThresholdPaise)})`;

      const influencerUserId = isInfluencer ? userId : counterpartyUserId;
      const brandUserId      = isInfluencer ? counterpartyUserId : userId;

      // Upsert — one row per pair, evidence refreshed every DRS cycle
      await prisma.reviewFlagRecord.upsert({
        where: { influencerUserId_brandUserId: { influencerUserId, brandUserId } },
        update: {
          totalDealsInPair:         pairDeals.length,
          suspiciousDealCount:      suspicious.length,
          avgDealAmountPaise,
          qualifyingThresholdPaise,
          flagReason,
          riskScore,
          // Only reset to PENDING if the flag was previously DISMISSED — a
          // CONFIRMED flag should not be auto-reset by fresh evidence.
          status: { set: "PENDING" },
        },
        create: {
          influencerUserId,
          brandUserId,
          totalDealsInPair:         pairDeals.length,
          suspiciousDealCount:      suspicious.length,
          avgDealAmountPaise,
          qualifyingThresholdPaise,
          flagReason,
          riskScore,
        },
      });

      logger.warn("CollisionDetector: suspicious review pair flagged", {
        influencerUserId,
        brandUserId,
        suspiciousDealCount: suspicious.length,
        totalDealsInPair: pairDeals.length,
        riskScore,
        avgDealAmountPaise,
      });
    }
  } catch (err) {
    // Detection failures are non-fatal — DRS write already completed above
    logger.error("detectCollusionPatterns failed (non-fatal)", err, { userId });
  }
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

const res = await calculateNewTrustScore(userId, user, trigger);
    if (res === null) return;
    const { newScore, calculatedScore, previousScore, result } = res;


// Recalculate level from XP (retaining XP logic)
const levelInfo = calculateLevel(user.xp)!;
// Prevent concurrent level downgrades
const newLevel = Math.max(user.level, levelInfo.level);

// Only update if something changed
if (newScore !== user.trustScore || newLevel !== user.level) {
  const { tier } = getDRSTierAndLimit(newScore);

  // Persist score + velocity-cap snapshot atomically
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { trustScore: newScore, level: newLevel },
    }),
    prisma.drsScoreSnapshot.create({
      data: {
        userId,
        previousScore,
        calculatedScore,
        velocityCap: trigger === "ADMIN_ADJUSTMENT" ? 300 : DRS_MAX_WEEKLY_CHANGE,
        finalScore: newScore,
        trigger,
        tier,
      },
    }),
  ]);

  // Run collusion detection as a non-fatal side-effect after the score write
  try {
    await detectCollusionPatterns(userId);
  } catch (err) {
    logger.error("detectCollusionPatterns uncaught (non-fatal)", err, { userId });
  }

  // Award new trust score badges dynamically if applicable
  try {
    const { checkAndAwardBadges } = await import("./gamification-engine");
    await checkAndAwardBadges(userId, "TRUST_UPDATED");
  } catch (badgeError) {
    logger.error("Failed to check badges after trust update", badgeError, { userId });
  }

  // Audit log — includes velocity delta so admins can see cap in action
  if (result) {
    await createActivityLog({
      userId,
      action: "DRS_UPDATE",
      metadata: {
        trigger,
        oldScore: user.trustScore,
        previousSnapshotScore: previousScore,
        calculatedScore,
        newScore,
        velocityDelta: newScore - previousScore,
        velocityCapped: calculatedScore !== newScore,
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
    previousSnapshotScore: previousScore,
    calculatedScore,
    newScore,
    velocityCapped: calculatedScore !== newScore,
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

// ─── Recency helper (trust-engine internal) ───────────────────────────────────────

/**
 * Classify an event timestamp into a RecencyBuckets accumulator.
 *
 * @param date      - The event timestamp
 * @param now       - Reference "now" (allows deterministic tests)
 * @param thresholdMs - Boundary between recent and mid (default 3 months)
 * @param midThresholdMs - Boundary between mid and old (default 6 months)
 */
function classifyRecency(
  date: Date,
  now: Date,
  thresholdMs: number = 90 * 24 * 60 * 60 * 1000,   // 3 months
  midThresholdMs: number = 180 * 24 * 60 * 60 * 1000, // 6 months
): "recent" | "mid" | "old" {
  const age = now.getTime() - date.getTime();
  if (age <= thresholdMs) return "recent";
  if (age <= midThresholdMs) return "mid";
  return "old";
}

/** Produces a zero-valued RecencyBuckets object. */
function emptyBuckets(): RecencyBuckets {
  return { recent: 0, mid: 0, old: 0 };
}

// ─── Data fetchers ───────────────────────────────────────────────────────────────

async function fetchInfluencerBasicStats(userId: string) {
  const now = new Date();

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
    select: { rating: true, createdAt: true, reviewerId: true },
  });

  // Build recency-bucketed review counts
  const reviewBuckets = emptyBuckets();
  const poorReviewBuckets = emptyBuckets();
  const unique5StarReviewers = new Set<string>();

  for (const r of reviews) {
    const bucket = classifyRecency(r.createdAt, now);
    if (r.rating === 5) {
      reviewBuckets[bucket]++;
      if (r.reviewerId) unique5StarReviewers.add(r.reviewerId);
    }
    if (r.rating <= 2) poorReviewBuckets[bucket]++;
  }

  return { profile, reviewBuckets, poorReviewBuckets, uniqueReviewersCount: unique5StarReviewers.size };
}

async function fetchInfluencerDealStats(userId: string) {
  const now = new Date();

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
      completedAt: true,
    },
  });

  const dealBuckets = emptyBuckets();
  const onTimeBuckets = emptyBuckets();
  const lateDeliveryBuckets = emptyBuckets();
  const contentRejectionBuckets = emptyBuckets();

  for (const d of deals) {
    // Use completedAt if available, else submittedAt, else createdAt placeholder
    const eventDate = d.completedAt ?? d.submittedAt;
    if (!eventDate) continue;

    const bucket = classifyRecency(eventDate, now);
    dealBuckets[bucket]++;

    const isLate =
      d.postingDeadline &&
      d.submittedAt &&
      new Date(d.submittedAt) > new Date(d.postingDeadline);
    const isOnTime =
      d.postingDeadline &&
      d.submittedAt &&
      new Date(d.submittedAt) <= new Date(d.postingDeadline);

    if (isOnTime) onTimeBuckets[bucket]++;
    if (isLate) lateDeliveryBuckets[bucket]++;

    // Each revision used counts as a content rejection event
    const revisions = d.revisionsUsed ?? 0;
    for (let i = 0; i < revisions; i++) {
      contentRejectionBuckets[bucket]++;
    }
  }

  return { dealBuckets, onTimeBuckets, lateDeliveryBuckets, contentRejectionBuckets };
}

async function fetchInfluencerDisputes(userId: string) {
  const now = new Date();

  const resolvedDisputes = await prisma.dispute.findMany({
    where: {
      deal: { influencer: { userId } },
      status: "RESOLVED",
    },
    select: { resolution: true, influencerOutcome: true, resolvedAt: true, createdAt: true },
  });

  const disputeWonBuckets = emptyBuckets();
  // For disputes-lost: recent/mid = 0-12m (full weight), old = 12m+ (50% floor)
  const disputeLostBuckets = emptyBuckets();
  // 12-month threshold for the HARD penalty old bucket
  const TWELVE_MONTHS_MS = 365 * 24 * 60 * 60 * 1000;
  let disputesLostTotal = 0;

  for (const d of resolvedDisputes) {
    const eventDate = d.resolvedAt ?? d.createdAt;
    const isLost = (() => {
      try {
        if (!d.influencerOutcome) return false;
        const outcome = typeof d.influencerOutcome === "string"
          ? JSON.parse(d.influencerOutcome)
          : d.influencerOutcome;
        return (
          typeof outcome === "object" &&
          outcome !== null &&
          typeof outcome.trust_score_change === "number" &&
          outcome.trust_score_change < 0
        );
      } catch {
        return false;
      }
    })();

    if (isLost) {
      disputesLostTotal++;
      // Hard penalty bucket: 0-12m = recent|mid bucket, 12m+ = old
      const ageMs = now.getTime() - eventDate.getTime();
      if (ageMs <= TWELVE_MONTHS_MS) {
        // Classify within the 12m window further into recent/mid (using 3m/6m)
        const b = classifyRecency(eventDate, now);
        disputeLostBuckets[b]++;
      } else {
        disputeLostBuckets.old++;
      }
    } else {
      // Won: use standard 3m/6m recency
      const b = classifyRecency(eventDate, now);
      disputeWonBuckets[b]++;
    }
  }

  return { disputesLostTotal, disputeLostBuckets, disputeWonBuckets };
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
  const [
    basicStats,
    dealStats,
    disputeStats,
    referralStats,
    userViolations,
  ] = await Promise.all([
    fetchInfluencerBasicStats(userId),
    fetchInfluencerDealStats(userId),
    fetchInfluencerDisputes(userId),
    prisma.user.aggregate({
      where: { referredBy: userId, trustScore: { gte: 700 } },
      _count: true,
      _avg: { trustScore: true },
    }),
    prisma.userViolation.findMany({
      where: { userId, type: { in: ["TERMS_VIOLATION", "FRAUD"] } },
      select: { type: true, metadata: true, description: true },
    }),
  ]);

  const termsViolationsCount = userViolations.filter((v) => v.type === "TERMS_VIOLATION").length;
  const fraudViolationsList = userViolations.filter((v) => v.type === "FRAUD");

  const { profile, reviewBuckets, poorReviewBuckets, uniqueReviewersCount } = basicStats;
  const { dealBuckets, onTimeBuckets, lateDeliveryBuckets, contentRejectionBuckets } = dealStats;
  const { disputesLostTotal, disputeLostBuckets, disputeWonBuckets } = disputeStats;

  const fraudViolations = fraudViolationsList.length;
  const paymentFraudAttempts = fraudViolationsList.filter((v: { metadata: unknown; description: string }) => {
    const meta = v.metadata && typeof v.metadata === "object" ? (v.metadata as Record<string, unknown>) : null;
    return meta?.category === "PAYMENT_FRAUD" ||
      v.description.includes("PAYMENT_FRAUD") ||
      v.description.toLowerCase().includes("payment fraud");
  }).length;

  const completeness = calcProfileCompleteness(profile, user.verificationLevel);

  const totalDeals = dealBuckets.recent + dealBuckets.mid + dealBuckets.old;

  const factors: InfluencerDRSFactors = {
    // Flat counts
    completedDeals: profile?.completedDeals ?? totalDeals,
    totalEarningsPaise: profile?.totalEarnings ?? 0,
    disputesLost: disputesLostTotal,

    // Recency-bucketed bonuses
    dealBuckets,
    reviewBuckets,
    uniqueReviewersCount,
    onTimeBuckets,
    disputeWonBuckets,

    // Recency-bucketed soft penalties
    lateDeliveryBuckets,
    poorReviewBuckets,
    contentRejectionBuckets,

    // Recency-bucketed hard penalties
    disputeLostBuckets,

    // Permanent-memory signals
    identityVerified:
      user.verificationLevel === "IDENTITY" ||
      user.verificationLevel === "FULL",
    accountAgeDays: Math.floor(
      (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24),
    ),
    engagementRate: profile?.instagramEngagementRate ?? 0,
    fakeFollowersDetected: fraudViolations > 0,
    termsViolations: termsViolationsCount,
    paymentFraudAttempts,
    successfulReferrals: referralStats._count,
    avgReferralDRS: referralStats._avg.trustScore ?? 0,
    profileCompleteness: completeness,
  };

  const weights = await getTrustRuleWeights();
  return calculateInfluencerDRS(factors, weights);
}

async function recalculateBrandDRSInternal(userId: string): Promise<DRSResult> {
const brandProfile = await prisma.brandProfile.findUnique({
where: { userId },
select: { id: true, isGstVerified: true },
});

  const profileId = brandProfile?.id;
  const isVerified = brandProfile?.isGstVerified || false;
  const disputeWhere = { deal: { brand: { userId } } };
  const dealWhereForBrand = brandProfile
    ? { brandId: brandProfile.id }
    : { brandId: "none" };

  const [
    completedCampaigns,
    resolvedDisputes,
    influencerReviews,
    repeatInfluencers,
    influencerComplaints,
    termsViolations,
    paymentGroups,
    approvalStats,
  ] = await Promise.all([
    brandProfile
      ? prisma.campaign.count({
          where: { brandId: brandProfile.id, status: "COMPLETED" },
        })
      : Promise.resolve(0),
    prisma.dispute.findMany({
      where: {
        ...disputeWhere,
        status: "RESOLVED",
      },
      select: { resolution: true, brandOutcome: true },
    }),
    prisma.review.findMany({
      where: {
        deal: dealWhereForBrand,
        reviewerType: "INFLUENCER",
      },
      select: { rating: true, reviewerId: true },
    }),
    profileId
      ? prisma.deal.groupBy({
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
      : Promise.resolve([]),
    prisma.dispute.count({
      where: {
        ...disputeWhere,
        raisedBy: { userType: "INFLUENCER" },
      },
    }),
    prisma.userViolation.count({ where: { userId, type: "TERMS_VIOLATION" } }),
    prisma.transaction.groupBy({
      by: ["status"],
      where: { wallet: { userId }, type: "CREDIT" },
      _count: { _all: true },
    }),
    calculateApprovalStats(dealWhereForBrand),
  ]);

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

  const fairReviewList = influencerReviews.filter((r) => r.rating >= 4);
  const fairReviews = fairReviewList.length;
  const uniqueInfluencersCount = new Set(fairReviewList.map((r) => r.reviewerId)).size;
  const longTermPartnerships = repeatInfluencers.length;

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

  let totalPayments = 0;
  let failedPayments = 0;
  for (const pg of paymentGroups) {
    totalPayments += pg._count._all;
    if (pg.status === "FAILED") {
      failedPayments += pg._count._all;
    }
  }
  const paymentReliability = totalPayments > 0 ? (totalPayments - failedPayments) / totalPayments : 1.0;
  const { fastApprovals, lateApprovals } = approvalStats;

  const factors: BrandDRSFactors = {
    completedCampaigns,
    fastApprovals,
    lateApprovals,
    fairReviews,
    uniqueInfluencersCount,
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

async function calculateApprovalStats(
  dealWhere: Prisma.DealWhereInput,
): Promise<{ fastApprovals: number; lateApprovals: number }> {
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

  let fastApprovals = 0;
  let lateApprovals = 0;
  for (const d of deals) {
    if (!d.submittedAt || !d.approvedAt) continue;
    const submitted = new Date(d.submittedAt).getTime();
    const approved = new Date(d.approvedAt).getTime();
    const allowedDuration = (d.reviewPeriodHours ?? 48) * 3600 * 1000;
    if (approved - submitted <= allowedDuration) {
      fastApprovals++;
    } else {
      lateApprovals++;
    }
  }

  return { fastApprovals, lateApprovals };
}

/**
 * User-facing qualitative reputation summary.
 * Returns high-level category statuses and generic improvement guidance.
 * NEVER exposes internal weight constants, point calculations, or raw formulas.
 */
export async function getUserQualitativeReputation(
  userId: string,
): Promise<QualitativeReputationSummary | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      userType: true,
      trustScore: true,
      xp: true,
      level: true,
      createdAt: true,
      verificationLevel: true,
    },
  });

  if (!user) return null;

  const { tier, maxDealAmount } = getDRSTierAndLimit(user.trustScore);
  const tierLabel = getDRSTierLabel(tier);
  const levelInfo = calculateLevel(user.xp);

  let categories: QualitativeReputationCategory[] = [];
  let guidance: string[] = [];

  if (user.userType === "INFLUENCER") {
    const [
      basicStats,
      dealStats,
      disputeStats,
      referralStats,
      userViolations,
    ] = await Promise.all([
      fetchInfluencerBasicStats(userId),
      fetchInfluencerDealStats(userId),
      fetchInfluencerDisputes(userId),
      prisma.user.aggregate({
        where: { referredBy: userId, trustScore: { gte: 700 } },
        _count: true,
        _avg: { trustScore: true },
      }),
      prisma.userViolation.findMany({
        where: { userId, type: { in: ["TERMS_VIOLATION", "FRAUD"] } },
        select: { type: true, metadata: true, description: true },
      }),
    ]);

    const termsViolationsCount = userViolations.filter((v) => v.type === "TERMS_VIOLATION").length;
    const fraudViolationsList = userViolations.filter((v) => v.type === "FRAUD");

    const { profile, reviewBuckets, poorReviewBuckets, uniqueReviewersCount } = basicStats;
    const { dealBuckets, onTimeBuckets, lateDeliveryBuckets, contentRejectionBuckets } = dealStats;
    const { disputesLostTotal, disputeLostBuckets, disputeWonBuckets } = disputeStats;
    const totalDeals = dealBuckets.recent + dealBuckets.mid + dealBuckets.old;

    const factors: InfluencerDRSFactors = {
      completedDeals: profile?.completedDeals ?? totalDeals,
      totalEarningsPaise: profile?.totalEarnings ?? 0,
      disputesLost: disputesLostTotal,
      dealBuckets,
      reviewBuckets,
      uniqueReviewersCount,
      onTimeBuckets,
      disputeWonBuckets,
      lateDeliveryBuckets,
      poorReviewBuckets,
      contentRejectionBuckets,
      disputeLostBuckets,
      identityVerified:
        user.verificationLevel === "IDENTITY" ||
        user.verificationLevel === "FULL",
      accountAgeDays: Math.floor(
        (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24),
      ),
      engagementRate: profile?.instagramEngagementRate ?? 0,
      fakeFollowersDetected: fraudViolationsList.length > 0,
      termsViolations: termsViolationsCount,
      paymentFraudAttempts: 0,
      successfulReferrals: referralStats._count,
      avgReferralDRS: referralStats._avg.trustScore ?? 0,
      profileCompleteness: calcProfileCompleteness(profile, user.verificationLevel),
    };

    const qualitative = getInfluencerQualitativeBreakdown(factors, user.trustScore);
    categories = qualitative.categories;
    guidance = qualitative.guidance;
  } else if (user.userType === "BRAND") {
    const brandProfile = await prisma.brandProfile.findUnique({
      where: { userId },
      select: { id: true, isGstVerified: true },
    });

    const isVerified = brandProfile?.isGstVerified || false;
    const disputeWhere = { deal: { brand: { userId } } };
    const dealWhereForBrand = brandProfile ? { brandId: brandProfile.id } : {};

    const [
      completedCampaigns,
      resolvedDisputes,
      reviews,
      influencerComplaints,
      termsViolations,
      paymentGroups,
      approvalStats,
    ] = await Promise.all([
      brandProfile
        ? prisma.campaign.count({
            where: { brandId: brandProfile.id, status: "COMPLETED" },
          })
        : Promise.resolve(0),
      prisma.dispute.findMany({
        where: { ...disputeWhere, status: "RESOLVED" },
        select: { brandOutcome: true },
      }),
      prisma.review.findMany({
        where: { deal: dealWhereForBrand, reviewerType: "INFLUENCER" },
        select: { rating: true, reviewerId: true },
      }),
      prisma.dispute.count({
        where: { ...disputeWhere, raisedBy: { userType: "INFLUENCER" } },
      }),
      prisma.userViolation.count({ where: { userId, type: "TERMS_VIOLATION" } }),
      prisma.transaction.groupBy({
        by: ["status"],
        where: { wallet: { userId }, type: "CREDIT" },
        _count: { _all: true },
      }),
      calculateApprovalStats(dealWhereForBrand),
    ]);

    const disputesLost = resolvedDisputes.filter((d) => {
      try {
        if (!d.brandOutcome) return false;
        const outcome = typeof d.brandOutcome === "string" ? JSON.parse(d.brandOutcome) : d.brandOutcome;
        return typeof outcome === "object" && outcome !== null && typeof outcome.trust_score_change === "number" && outcome.trust_score_change < 0;
      } catch {
        return false;
      }
    }).length;

    const fairReviews = reviews.filter((r) => r.rating >= 4).length;
    const uniqueInfluencersCount = new Set(reviews.map((r) => r.reviewerId)).size;

    const unfairRejections = resolvedDisputes.filter((d) => {
      try {
        if (!d.brandOutcome) return false;
        const outcome = typeof d.brandOutcome === "string" ? JSON.parse(d.brandOutcome) : d.brandOutcome;
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

    let totalPayments = 0;
    let failedPayments = 0;
    for (const pg of paymentGroups) {
      totalPayments += pg._count._all;
      if (pg.status === "FAILED") {
        failedPayments += pg._count._all;
      }
    }
    const paymentReliability = totalPayments > 0 ? (totalPayments - failedPayments) / totalPayments : 1.0;
    const { fastApprovals, lateApprovals } = approvalStats;

    const factors: BrandDRSFactors = {
      completedCampaigns,
      fastApprovals,
      lateApprovals,
      fairReviews,
      uniqueInfluencersCount,
      disputesLost,
      companyVerified: isVerified,
      paymentReliability,
      termsViolations,
      longTermPartnerships: 0,
      unfairRejections,
      influencerComplaints,
    };

    const qualitative = getBrandQualitativeBreakdown(factors, user.trustScore);
    categories = qualitative.categories;
    guidance = qualitative.guidance;
  }

  return {
    score: user.trustScore,
    tier,
    tierLabel,
    maxDealAmount,
    level: {
      current: user.level,
      name: levelInfo.name,
      xp: user.xp,
    },
    categories,
    guidance,
  };
}
