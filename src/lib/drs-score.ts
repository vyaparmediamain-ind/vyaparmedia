/**
 * Digital Reputation Score (DRS) Calculator
 * Advanced rule-based system for calculating user reputation.
 * Replaces the legacy Trust Score system.
 *
 * Bonus curve design
 * ──────────────────
 * Repeatable-activity bonuses (deals, reviews, dispute wins) follow a
 * simple 3-tier diminishing-returns schedule modelled on real credit-
 * score systems (CIBIL) and reputation platforms (Uber, Airbnb):
 *
 *   tier-1  first N instances → full weight
 *   tier-2  next  N instances → ½ weight
 *   tier-3  beyond that       → ¼ weight
 *   hard cap                  → bonus is clamped to MAX regardless
 *
 * This ensures a "10 rapid deals in 1 month" burst cannot push a new
 * account to 900 when slow signals (age ≥365 d, clean dispute history)
 * are absent.  See BONUS_CAPS_* constants below for exact numbers.
 */

import {
  MIN_TRUST_SCORE,
  MAX_TRUST_SCORE,
  IST_OFFSET_MS,
  DRS_TIER_FLAGGED_MAX,
  DRS_TIER_LIMITED_MAX,
  DRS_TIER_NORMAL_MAX,
  DRS_TIER_TRUSTED_MAX,
  DRS_DEAL_CAP_FLAGGED_PAISE,
  DRS_DEAL_CAP_LIMITED_PAISE,
  DRS_DEAL_CAP_NORMAL_PAISE,
  DRS_DEAL_CAP_TRUSTED_PAISE,
  DRS_DEAL_CAP_ELITE_PAISE,
  DRS_QUALIFIED_DEAL_VALUE_PAISE,
  DEFAULT_BRAND_PLATFORM_FEE_PERCENT,
} from "@/constants";

// ─── Diminishing-returns helper & caps (exported for unit-test assertions) ───

/**
 * Calculates a bonus using a 3-tier diminishing-returns schedule.
 *
 * @param count        - Raw count of qualifying events (deals, reviews, etc.)
 * @param fullWeight   - Points awarded per instance in tier-1
 * @param tier1Limit   - How many instances receive full weight
 * @param tier2Limit   - How many additional instances receive ½ weight
 * @param maxCap       - Absolute ceiling regardless of count
 * @returns Capped bonus points (always ≥ 0)
 *
 * Example — Deal Experience (fullWeight=15, tier1=5, tier2=5, cap=120):
 *   count=5  → 5×15 = 75
 *   count=10 → 75 + 5×7.5 = 112.5 ≈ 113
 *   count=80 → capped at 120
 */
export function tieredBonus(
  count: number,
  fullWeight: number,
  tier1Limit: number,
  tier2Limit: number,
  maxCap: number,
): number {
  if (count <= 0) return 0;

  const t1Count = Math.min(count, tier1Limit);
  const t2Count = Math.min(Math.max(count - tier1Limit, 0), tier2Limit);
  const t3Count = Math.max(count - tier1Limit - tier2Limit, 0);

  const raw =
    t1Count * fullWeight +
    t2Count * (fullWeight / 2) +
    t3Count * (fullWeight / 4);

  return Math.min(maxCap, Math.round(raw));
}

// ─── Recency helper ───────────────────────────────────────────────────────────
//
// Real credit bureaus give recent activity more weight than ancient history.
// We model this via three time buckets applied *before* the tieredBonus calc:
//
//   0 – 3 months  → 1.0× (full weight)
//   3 – 6 months  → 0.5× (half weight)
//   6 +  months   → 0.25× (quarter weight)
//
// The bucket counts are populated by the trust-engine data-fetchers and passed
// in through the InfluencerDRSFactors interface as `*Recent`, `*Mid`, `*Old`
// fields.  The calculator converts them to a single "effective count" before
// calling tieredBonus.

export interface RecencyBuckets {
  /** Events in the last 0-3 months (full weight 1.0×) */
  recent: number;
  /** Events in the last 3-6 months (half weight 0.5×) */
  mid: number;
  /** Events older than 6 months (quarter weight 0.25×) */
  old: number;
}

/**
 * Converts three time-bucketed counts into a single "effective count" that
 * can be fed into `tieredBonus` as if it were a raw count.
 *
 * Weights:
 *   recent (0-3m)  → 1.00×
 *   mid    (3-6m)  → 0.50×
 *   old    (6m+)   → 0.25×
 *
 * @example
 *   // Account with 5 old deals + 1 recent deal
 *   recencyWeightedCount({ recent: 1, mid: 0, old: 5 })
 *   // → 1×1 + 0×0.5 + 5×0.25 = 2.25 → 2  (not 6)
 */
export function recencyWeightedCount(buckets: RecencyBuckets): number {
  return Math.round(
    buckets.recent * 1.0 +
    buckets.mid    * 0.5 +
    buckets.old    * 0.25,
  );
}

/**
 * Converts three time-bucketed penalty counts to an effective penalty count
 * using penalty-specific decay.
 *
 * For SOFT penalties (late delivery, poor review, content rejection):
 *   recent 1.0× | mid 0.5× | old 0.25×  — same as bonus decay
 *
 * For HARD penalties (disputes lost):
 *   recent+mid 1.0× | old (12m+) 0.5× — floored, never fully forgiven
 *
 * @param buckets  - { recent, mid, old } counts
 * @param severity - "soft" | "hard"
 */
export function recencyWeightedPenaltyCount(
  buckets: RecencyBuckets,
  severity: "soft" | "hard",
): number {
  if (severity === "soft") {
    return Math.round(
      buckets.recent * 1.0 +
      buckets.mid    * 0.5 +
      buckets.old    * 0.25,
    );
  }
  // hard: recent+mid at full, old capped at 50% (disputes don't fully disappear)
  return Math.round(
    (buckets.recent + buckets.mid) * 1.0 +
    buckets.old * 0.5,
  );
}


/** Deal Experience: first 5 deals full weight, next 5 half, beyond quarter. Hard cap +120. */
export const BONUS_CAP_DEAL_EXPERIENCE = 120 as const;
/** 5-Star Reviews: first 3 full weight, next 3 half, beyond quarter. Hard cap +120. */
export const BONUS_CAP_FIVE_STAR_REVIEWS = 120 as const;
/** Disputes Won: first 2 full weight, next 1 half, beyond quarter. Hard cap +45. */
export const BONUS_CAP_DISPUTES_WON = 45 as const;

/**
 * Calculates counterparty review diversity ratio.
 * Rewards accounts with reviews from multiple unique counterparties.
 * Counteracts collusion / wash-trading between repeated same-pair accounts.
 *
 * @param uniqueCounterparties - Distinct counterparties who gave qualifying reviews
 * @param totalReviews         - Total qualifying reviews received
 * @returns Multiplier in range [0.0, 1.0].
 */
export function calculateReviewDiversityRatio(
  uniqueCounterparties: number,
  totalReviews: number,
): number {
  if (totalReviews <= 2) return 1.0;
  if (uniqueCounterparties <= 0) return 0.0;
  return Math.min(1.0, Math.max(0.0, uniqueCounterparties / totalReviews));
}

// ─── Velocity Cap (CIBIL / Experian style) ────────────────────────────────────
//
// Real credit bureaus deliberately slow down score movements to prevent:
//   (a) Sudden farming attacks (10 rapid deals in a week → instant max score)
//   (b) Flash-crash from a single negative event
//
// The cap is applied *after* the raw DRS is computed but *before* the score is
// written to the DB.  The trust-engine layer (trust-engine.ts) is responsible
// for reading the previous snapshot and passing `previousScore` here.
//
// Configurable via TrustRuleConfig.  Default: ±50 pts per recalculation cycle.
// A new account (previousScore = 600) doing 10 deals in week-1 will land at 650
// (not 713).  By week-3 of consistent behaviour it reaches the full 713.

/**
 * Maximum score change (up OR down) allowed per recalculation cycle.
 * Default: 50 points.  Can be overridden via `TrustRuleConfig`.
 */
export const DRS_MAX_WEEKLY_CHANGE = 50 as const;

/**
 * Clamps `calculatedScore` to within ±`maxChange` of `previousScore`.
 *
 * Used to enforce CIBIL-style gradual movement: genuine long-term
 * improvement is rewarded, but burst activity cannot instantly push
 * a new account to an elite score.
 *
 * @param previousScore   - Score from the most-recent saved snapshot
 * @param calculatedScore - Raw score produced by this cycle's calculation
 * @param maxChange       - Maximum allowed |delta| per cycle (default 50)
 * @returns               - Velocity-capped score (still an integer)
 *
 * @example
 *   applyVelocityCap(600, 713, 50) → 650   // new account, 10-deal burst
 *   applyVelocityCap(650, 713, 50) → 700   // week-2, still improving
 *   applyVelocityCap(700, 713, 50) → 713   // week-3, cap not binding
 *   applyVelocityCap(750, 400, 50) → 700   // penalty capped on way down too
 */
export function applyVelocityCap(
  previousScore: number,
  calculatedScore: number,
  maxChange: number = DRS_MAX_WEEKLY_CHANGE,
): number {
  const lo = previousScore - maxChange;
  const hi = previousScore + maxChange;
  return Math.round(Math.max(lo, Math.min(hi, calculatedScore)));
}


export interface InfluencerDRSFactors {
  // ── Flat counts (still used for tier thresholds like "50 deals + 0 disputes") ──
  completedDeals: number;
  totalEarningsPaise: number;
  disputesLost: number; // total (used for the 50-deal/dispute-free milestone)

  // ── Recency-bucketed counts for bonuses (0-3m | 3-6m | 6m+) ──────────────
  dealBuckets: RecencyBuckets;           // qualified completed deals
  reviewBuckets: RecencyBuckets;         // 5-star reviews from brands
  uniqueReviewersCount?: number;         // Distinct brands who gave 5-star reviews (for counterparty diversity weighting)
  onTimeBuckets: RecencyBuckets;         // on-time deliveries
  disputeWonBuckets: RecencyBuckets;     // disputes won

  // ── Recency-bucketed counts for soft penalties ────────────────────────────
  lateDeliveryBuckets: RecencyBuckets;   // soft — full decay
  poorReviewBuckets: RecencyBuckets;     // soft — full decay
  contentRejectionBuckets: RecencyBuckets; // soft — full decay

  // ── Recency-bucketed counts for hard penalties ────────────────────────────
  disputeLostBuckets: RecencyBuckets;    // hard — 50% floor after 12m

  // ── Permanent-memory signals (no recency decay) ───────────────────────────
  identityVerified: boolean;
  accountAgeDays: number;
  engagementRate: number;
  fakeFollowersDetected: boolean;
  termsViolations: number;
  paymentFraudAttempts: number;          // permanent ban offense
  avgReferralDRS: number;
  successfulReferrals: number;
  profileCompleteness: number;           // Percentage 0-100
}

export interface DRSResult {
score: number;
tier: "FLAGGED" | "LIMITED" | "NORMAL" | "TRUSTED" | "ELITE";
maxDealAmount: number; // in paise
breakdown: {
factor: string;
impact: number;
reason: string;
}[];
}

/**
 * Clamp DRS score between 300 and 900 (CIBIL credit scale standard).
 */
export function clampDRSScore(score: number): number {
  return Math.max(MIN_TRUST_SCORE, Math.min(MAX_TRUST_SCORE, Math.round(score)));
}

/**
 * Returns UTC timestamp for start of day (00:00:00.000) in Indian Standard Time (IST).
 */
export function getISTStartOfDay(date: Date = new Date()): Date {
  const istOffset = IST_OFFSET_MS;
  const todayIST = new Date(date.getTime() + istOffset);
  todayIST.setUTCHours(0, 0, 0, 0);
  return new Date(todayIST.getTime() - istOffset);
}

export function getDRSTierAndLimit(score: number): {
tier: DRSResult["tier"];
maxDealAmount: number;
} {
if (score <= DRS_TIER_FLAGGED_MAX) {
return { tier: "FLAGGED", maxDealAmount: DRS_DEAL_CAP_FLAGGED_PAISE };
} else if (score < DRS_TIER_LIMITED_MAX) {
return { tier: "LIMITED", maxDealAmount: DRS_DEAL_CAP_LIMITED_PAISE };
} else if (score <= DRS_TIER_NORMAL_MAX) {
return { tier: "NORMAL", maxDealAmount: DRS_DEAL_CAP_NORMAL_PAISE };
} else if (score <= DRS_TIER_TRUSTED_MAX) {
return { tier: "TRUSTED", maxDealAmount: DRS_DEAL_CAP_TRUSTED_PAISE };
} else {
return { tier: "ELITE", maxDealAmount: DRS_DEAL_CAP_ELITE_PAISE };
}
}

function applyInfluencerBonuses(
  factors: InfluencerDRSFactors,
  state: { score: number; breakdown: DRSResult["breakdown"] },
  weights?: Record<string, number>,
) {
  // ── Deal Experience (recency-weighted, diminishing returns) ───────────────
  // Recent deals (0-3m) count at 1×, mid (3-6m) at 0.5×, old (6m+) at 0.25×.
  // Effective count is passed to tieredBonus so an old-but-inactive account
  // scores lower than a recently-active one with fewer lifetime deals.
  const dealWeight = weights?.DEAL_EXPERIENCE_WEIGHT ?? 15;
  const totalQualifiedDeals = Math.min(
    factors.completedDeals,
    Math.floor(factors.totalEarningsPaise / DRS_QUALIFIED_DEAL_VALUE_PAISE),
  );
  // Scale bucket counts proportionally to qualified ratio
  const qualifyRatio = factors.completedDeals > 0
    ? totalQualifiedDeals / factors.completedDeals
    : 0;
  const qualifiedDealBuckets: RecencyBuckets = {
    recent: Math.round(factors.dealBuckets.recent * qualifyRatio),
    mid:    Math.round(factors.dealBuckets.mid    * qualifyRatio),
    old:    Math.round(factors.dealBuckets.old    * qualifyRatio),
  };
  const effectiveDealCount = recencyWeightedCount(qualifiedDealBuckets);
  const dealBonus = tieredBonus(
    effectiveDealCount,
    dealWeight,
    5,
    5,
    BONUS_CAP_DEAL_EXPERIENCE,
  );
  if (dealBonus > 0) {
    state.score += dealBonus;
    const rawTotal = factors.dealBuckets.recent + factors.dealBuckets.mid + factors.dealBuckets.old;
    state.breakdown.push({
      factor: "Deal Experience",
      impact: dealBonus,
      reason: `${rawTotal} deals (${effectiveDealCount} recency-weighted effective); ` +
        `recent=${factors.dealBuckets.recent} mid=${factors.dealBuckets.mid} old=${factors.dealBuckets.old}; ` +
        `cap=${BONUS_CAP_DEAL_EXPERIENCE}`,
    });
  }

  // ── 5-Star Reviews (recency-weighted, diminishing returns, counterparty-diversity checked) ─
  const reviewWeight = weights?.FIVE_STAR_REVIEW_WEIGHT ?? 30;
  const effectiveReviewCount = recencyWeightedCount(factors.reviewBuckets);
  const rawReviews = factors.reviewBuckets.recent + factors.reviewBuckets.mid + factors.reviewBuckets.old;
  const rawReviewBonus = tieredBonus(
    effectiveReviewCount,
    reviewWeight,
    3,
    3,
    BONUS_CAP_FIVE_STAR_REVIEWS,
  );

  // Counterparty Diversity Metric:
  // DRS review bonus achieves full weight ONLY when reviews come from unique counterparties.
  // When multiple reviews originate from the same repeat partner (collusion / wash-trading risk),
  // the bonus is scaled down proportionally by the diversity ratio (uniqueCounterparties / totalReviews).
  const uniqueReviewers = factors.uniqueReviewersCount !== undefined
    ? Math.max(0, factors.uniqueReviewersCount)
    : rawReviews; // Backwards compatible fallback
  const diversityRatio = calculateReviewDiversityRatio(uniqueReviewers, rawReviews);
  const reviewBonus = Math.round(rawReviewBonus * diversityRatio);

  if (reviewBonus > 0) {
    state.score += reviewBonus;
    const diversityPercent = Math.round(diversityRatio * 100);
    const reasonText = diversityRatio < 1.0
      ? `${rawReviews} perfect reviews (${effectiveReviewCount} recency-weighted); diversity penalty: ${uniqueReviewers}/${rawReviews} unique counterparties (${diversityPercent}%); scaled ${rawReviewBonus} → ${reviewBonus} pts; cap=${BONUS_CAP_FIVE_STAR_REVIEWS}`
      : `${rawReviews} perfect reviews (${effectiveReviewCount} recency-weighted, 100% counterparty diversity); cap=${BONUS_CAP_FIVE_STAR_REVIEWS}`;

    state.breakdown.push({
      factor: "5-Star Quality",
      impact: reviewBonus,
      reason: reasonText,
    });
  }

  // ── On-time Deliveries (recency-weighted, linear) ─────────────────────────
  const onTimeWeight = weights?.ON_TIME_DELIVERY_WEIGHT ?? 18;
  const effectiveOnTime = recencyWeightedCount(factors.onTimeBuckets);
  const onTimeBonus = effectiveOnTime * onTimeWeight;
  if (onTimeBonus > 0) {
    state.score += onTimeBonus;
    const rawOnTime = factors.onTimeBuckets.recent + factors.onTimeBuckets.mid + factors.onTimeBuckets.old;
    state.breakdown.push({
      factor: "Reliability",
      impact: onTimeBonus,
      reason: `${rawOnTime} on-time deliveries (${effectiveOnTime} recency-weighted)`,
    });
  }

  if (factors.identityVerified) {
    const idBonus = weights?.IDENTITY_VERIFIED_WEIGHT ?? 60;
    state.score += idBonus;
    state.breakdown.push({
      factor: "Identity Verified",
      impact: idBonus,
      reason: "Identity verification complete",
    });
  }

  if (factors.accountAgeDays >= 365) {
    const ageBonus = weights?.ACCOUNT_AGE_BONUS ?? 30;
    state.score += ageBonus;
    state.breakdown.push({
      factor: "Account Age",
      impact: ageBonus,
      reason: "Account > 1 year old",
    });
  }

  if (factors.engagementRate >= 3.0) {
    state.score += 60;
    state.breakdown.push({
      factor: "High Engagement",
      impact: 60,
      reason: `Healthy engagement rate detected`,
    });
  }

  // Dispute-free milestone uses TOTAL disputesLost (not recency-bucketed) so
  // an account cannot game the milestone by waiting for old disputes to decay.
  if (factors.completedDeals >= 50 && factors.disputesLost === 0) {
    state.score += 90;
    state.breakdown.push({
      factor: "Dispute-Free Record",
      impact: 90,
      reason: `50+ deals with zero lost disputes`,
    });
  }

  // ── Disputes Won (recency-weighted, diminishing returns) ──────────────────
  const disputeWonWeight = weights?.DISPUTE_WON_BONUS ?? 15;
  const effectiveDisputeWon = recencyWeightedCount(factors.disputeWonBuckets);
  const disputeWonBonus = tieredBonus(
    effectiveDisputeWon,
    disputeWonWeight,
    2,
    1,
    BONUS_CAP_DISPUTES_WON,
  );
  if (disputeWonBonus > 0) {
    state.score += disputeWonBonus;
    const rawWon = factors.disputeWonBuckets.recent + factors.disputeWonBuckets.mid + factors.disputeWonBuckets.old;
    state.breakdown.push({
      factor: "Disputes Resolved in Favor",
      impact: disputeWonBonus,
      reason: `${rawWon} disputes won (${effectiveDisputeWon} recency-weighted); cap=${BONUS_CAP_DISPUTES_WON}`,
    });
  }
}

function applyInfluencerPenalties(
  factors: InfluencerDRSFactors,
  state: { score: number; breakdown: DRSResult["breakdown"] },
  weights?: Record<string, number>,
) {
  // ── Late Deliveries — SOFT penalty, full recency decay ───────────────────
  const rawLate = factors.lateDeliveryBuckets.recent + factors.lateDeliveryBuckets.mid + factors.lateDeliveryBuckets.old;
  if (rawLate > 0) {
    const effectiveLate = recencyWeightedPenaltyCount(factors.lateDeliveryBuckets, "soft");
    const penaltyWeight = Math.abs(weights?.LATE_DELIVERY_PENALTY ?? 50);
    const penalty = effectiveLate * penaltyWeight;
    state.score -= penalty;
    state.breakdown.push({
      factor: "Late Deliveries",
      impact: -penalty,
      reason: `${rawLate} late deliveries (${effectiveLate} recency-weighted); ` +
        `recent=${factors.lateDeliveryBuckets.recent} mid=${factors.lateDeliveryBuckets.mid} old=${factors.lateDeliveryBuckets.old}`,
    });
  }

  // ── Poor Reviews — SOFT penalty, full recency decay ─────────────────────
  const rawPoor = factors.poorReviewBuckets.recent + factors.poorReviewBuckets.mid + factors.poorReviewBuckets.old;
  if (rawPoor > 0) {
    const effectivePoor = recencyWeightedPenaltyCount(factors.poorReviewBuckets, "soft");
    const penaltyWeight = Math.abs(weights?.POOR_REVIEW_PENALTY ?? 90);
    const penalty = effectivePoor * penaltyWeight;
    state.score -= penalty;
    state.breakdown.push({
      factor: "Negative Reviews",
      impact: -penalty,
      reason: `${rawPoor} poor ratings (${effectivePoor} recency-weighted); ` +
        `recent=${factors.poorReviewBuckets.recent} mid=${factors.poorReviewBuckets.mid} old=${factors.poorReviewBuckets.old}`,
    });
  }

  // ── Content Rejections — SOFT penalty, full recency decay ────────────────
  const rawRej = factors.contentRejectionBuckets.recent + factors.contentRejectionBuckets.mid + factors.contentRejectionBuckets.old;
  if (rawRej > 0) {
    const effectiveRej = recencyWeightedPenaltyCount(factors.contentRejectionBuckets, "soft");
    const penaltyWeight = Math.abs(weights?.CONTENT_REJECTION_PENALTY ?? 30);
    const penalty = effectiveRej * penaltyWeight;
    state.score -= penalty;
    state.breakdown.push({
      factor: "Content Rejections",
      impact: -penalty,
      reason: `${rawRej} content rejections (${effectiveRej} recency-weighted); ` +
        `recent=${factors.contentRejectionBuckets.recent} mid=${factors.contentRejectionBuckets.mid} old=${factors.contentRejectionBuckets.old}`,
    });
  }

  // ── Disputes Lost — HARD penalty, 50% floor after 12 months ─────────────
  // Uses disputeLostBuckets where "old" = events > 12 months ago (0.5× weight).
  // factors.disputesLost (total) is retained separately for the milestone check.
  const rawLostTotal = factors.disputeLostBuckets.recent + factors.disputeLostBuckets.mid + factors.disputeLostBuckets.old;
  if (rawLostTotal > 0) {
    const effectiveLost = recencyWeightedPenaltyCount(factors.disputeLostBuckets, "hard");
    const penaltyWeight = Math.abs(weights?.DISPUTE_LOST_PENALTY ?? 180);
    const penalty = effectiveLost * penaltyWeight;
    state.score -= penalty;
    state.breakdown.push({
      factor: "Disputes Raised/Lost",
      impact: -penalty,
      reason: `${rawLostTotal} lost disputes (${effectiveLost} recency-weighted, old disputes at 50% floor); ` +
        `recent+mid=${factors.disputeLostBuckets.recent + factors.disputeLostBuckets.mid} old(12m+)=${factors.disputeLostBuckets.old}`,
    });
  }

  // ── PERMANENT-MEMORY penalties — no recency decay ────────────────────────
  if (factors.fakeFollowersDetected) {
    const penalty = Math.abs(weights?.FAKE_FOLLOWERS_PENALTY ?? 250);
    state.score -= penalty;
    state.breakdown.push({
      factor: "AI Fraud Detection",
      impact: -penalty,
      reason: "Fake followers anomaly detected (permanent signal)",
    });
  }

  if (factors.termsViolations > 0) {
    const penaltyWeight = Math.abs(weights?.TERMS_VIOLATION_PENALTY ?? 450);
    const penalty = factors.termsViolations * penaltyWeight;
    state.score -= penalty;
    state.breakdown.push({
      factor: "Terms Violation",
      impact: -penalty,
      reason: `${factors.termsViolations} TOS violations (permanent signal)`,
    });
  }

  if (factors.paymentFraudAttempts > 0) {
    const penalty = Math.abs(weights?.PAYMENT_FRAUD_PENALTY ?? 600);
    state.score -= penalty;
    state.breakdown.push({
      factor: "Fraud Attempt",
      impact: -penalty,
      reason: "Payment fraud triggers permanent ban logic (no recency decay)",
    });
  }
}

export function calculateInfluencerDRS(
  factors: InfluencerDRSFactors,
  weights?: Record<string, number>,
): DRSResult {
  const state = {
    score: 600, // Starting score (CIBIL neutral)
    breakdown: [] as DRSResult["breakdown"],
  };

  applyInfluencerBonuses(factors, state, weights);
  applyInfluencerPenalties(factors, state, weights);

  // Cap score 300-900 (CIBIL range)
  const score = Math.max(300, Math.min(900, state.score));

  // Determine Tier
  const { tier, maxDealAmount } = getDRSTierAndLimit(score);

  return { score, tier, maxDealAmount, breakdown: state.breakdown };
}

export interface BrandDRSFactors {
  completedCampaigns: number;
  fastApprovals: number;
  lateApprovals: number;
  fairReviews: number;
  uniqueInfluencersCount?: number; // Distinct influencers reviewed (for counterparty diversity weighting)
  disputesLost: number;
  companyVerified: boolean;
  paymentReliability: number;
  termsViolations: number;
  // Spec additions
  longTermPartnerships: number; // Spec: Long-term partnership +5
  unfairRejections: number; // Spec: Unfair rejections -10
  influencerComplaints: number; // Spec: Influencer complaints -15
}

export function calculateBrandDRS(
  factors: BrandDRSFactors,
  weights?: Record<string, number>,
): DRSResult {
  const breakdown: DRSResult["breakdown"] = [];
  let score = 600; // Brands start at 600 (CIBIL neutral baseline)

  // Activity factor
  const campaignWeight = weights?.BRAND_CAMPAIGN_WEIGHT ?? 18;
  const campaignBonus = factors.completedCampaigns * campaignWeight;
  if (campaignBonus > 0) {
    score += campaignBonus;
    breakdown.push({
      factor: "Campaign History",
      impact: campaignBonus,
      reason: `${factors.completedCampaigns} campaigns completed`,
    });
  }

  // Agility factor
  const approvalWeight = weights?.BRAND_FAST_APPROVAL_WEIGHT ?? 12;
  const approvalBonus = factors.fastApprovals * approvalWeight;
  if (approvalBonus > 0) {
    score += approvalBonus;
    breakdown.push({
      factor: "Fast Approvals",
      impact: approvalBonus,
      reason: `${factors.fastApprovals} quick approvals`,
    });
  }

  // Reliability factor
  if (factors.paymentReliability >= 0.98 && factors.completedCampaigns > 0) {
    const paymentReliabilityBonus = weights?.BRAND_PAYMENT_RELIABILITY_WEIGHT ?? 60;
    score += paymentReliabilityBonus;
    breakdown.push({
      factor: "Payment Reliability",
      impact: paymentReliabilityBonus,
      reason: "High payment success rate",
    });
  }

  if (factors.companyVerified) {
    const verifiedBonus = weights?.BRAND_VERIFIED_WEIGHT ?? 90;
    score += verifiedBonus;
    breakdown.push({
      factor: "Business Verified",
      impact: verifiedBonus,
      reason: "Company registration verified",
    });
  }

  // Long-term partnerships factor
  if (factors.longTermPartnerships > 0) {
    const partnershipWeight = weights?.BRAND_PARTNERSHIP_WEIGHT ?? 30;
    const partnerBonus = factors.longTermPartnerships * partnershipWeight;
    score += partnerBonus;
    breakdown.push({
      factor: "Long-term Partnerships",
      impact: partnerBonus,
      reason: `${factors.longTermPartnerships} repeat influencer relationships`,
    });
  }

  // Fair reviews factor (with counterparty diversity check)
  if (factors.fairReviews > 0) {
    const reviewWeight = weights?.BRAND_FAIR_REVIEW_WEIGHT ?? 30;
    const rawFairBonus = factors.fairReviews * reviewWeight;
    const uniqueInfluencers = factors.uniqueInfluencersCount !== undefined
      ? Math.max(0, factors.uniqueInfluencersCount)
      : factors.fairReviews;
    const diversityRatio = calculateReviewDiversityRatio(uniqueInfluencers, factors.fairReviews);
    const fairBonus = Math.round(rawFairBonus * diversityRatio);

    if (fairBonus > 0) {
      score += fairBonus;
      const diversityPercent = Math.round(diversityRatio * 100);
      breakdown.push({
        factor: "Fair Reviews",
        impact: fairBonus,
        reason: diversityRatio < 1.0
          ? `${factors.fairReviews} fair reviews given; diversity penalty: ${uniqueInfluencers}/${factors.fairReviews} unique influencers (${diversityPercent}%); scaled ${rawFairBonus} → ${fairBonus} pts`
          : `${factors.fairReviews} fair reviews given to influencers`,
      });
    }
  }

  // Penalties factor
  if (factors.lateApprovals > 0) {
    const latePenaltyWeight = Math.abs(weights?.BRAND_LATE_APPROVAL_PENALTY ?? -30);
    const penalty = factors.lateApprovals * latePenaltyWeight;
    score -= penalty;
    breakdown.push({
      factor: "Slow Responses",
      impact: -penalty,
      reason: `${factors.lateApprovals} delays in approval`,
    });
  }

  if (factors.unfairRejections > 0) {
    const unfairPenaltyWeight = Math.abs(weights?.BRAND_UNFAIR_REJECTION_PENALTY ?? -120);
    const penalty = factors.unfairRejections * unfairPenaltyWeight;
    score -= penalty;
    breakdown.push({
      factor: "Unfair Rejections",
      impact: -penalty,
      reason: `${factors.unfairRejections} unfair content rejections`,
    });
  }

  if (factors.disputesLost > 0) {
    const disputeLostPenaltyWeight = Math.abs(weights?.BRAND_DISPUTE_LOST_PENALTY ?? -240);
    const penalty = factors.disputesLost * disputeLostPenaltyWeight;
    score -= penalty;
    breakdown.push({
      factor: "Payment Disputes",
      impact: -penalty,
      reason: `${factors.disputesLost} payment disputes`,
    });
  }

  if (factors.influencerComplaints > 0) {
    const complaintPenaltyWeight = Math.abs(weights?.BRAND_COMPLAINT_PENALTY ?? -150);
    const penalty = factors.influencerComplaints * complaintPenaltyWeight;
    score -= penalty;
    breakdown.push({
      factor: "Influencer Complaints",
      impact: -penalty,
      reason: `${factors.influencerComplaints} complaints received`,
    });
  }

  if (factors.termsViolations > 0) {
    const termsPenaltyWeight = Math.abs(weights?.BRAND_TERMS_VIOLATION_PENALTY ?? -600);
    const penalty = factors.termsViolations * termsPenaltyWeight;
    score -= penalty;
    breakdown.push({
      factor: "Terms Violation",
      impact: -penalty,
      reason: `${factors.termsViolations} TOS violations`,
    });
  }

  score = Math.max(300, Math.min(900, score));

  // Determine Tier
  const { tier, maxDealAmount } = getDRSTierAndLimit(score);

  return { score, tier, maxDealAmount, breakdown };
}

const LEVELS = [
{ level: 1, name: "Rookie", minXP: 0 },
{ level: 2, name: "Rising Star", minXP: 101 },
{ level: 3, name: "Creator", minXP: 501 },
{ level: 4, name: "Pro", minXP: 1501 },
{ level: 5, name: "Expert", minXP: 3001 },
{ level: 6, name: "Elite", minXP: 6001 },
{ level: 7, name: "Master", minXP: 10001 },
{ level: 8, name: "Champion", minXP: 20001 },
{ level: 9, name: "Icon", minXP: 40001 },
{ level: 10, name: "Legend", minXP: 75000 },
] as const;

export function calculateLevel(xp: number) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    const lvl = LEVELS[i];
    if (lvl && xp >= lvl.minXP) return lvl;
  }
  return LEVELS[0];
}

// Spec: Higher search ranking + lower platform fees per level
// 10% (base) 9% (level 4+) 8% (level 6+) 7% (level 8+)
export function getPlatformFeePercentage(level: number): number {
if (level >= 8) return 7; // Champion, Icon, Legend
if (level >= 6) return 8; // Elite, Master
if (level >= 4) return 9; // Pro, Expert
return DEFAULT_BRAND_PLATFORM_FEE_PERCENT; // Rookie, Rising Star, Creator
}

// ==================== QUALITATIVE REPUTATION BREAKDOWN ====================
// Pure read-model definitions for user-facing transparency without gaming exposure.
// Zero raw weights, point calculations, or internal constants are exposed here.

export interface QualitativeReputationCategory {
  category: string;
  status: "Exceptional" | "Good" | "Building" | "Starting Out" | "Needs Attention";
  description: string;
}

export interface QualitativeReputationSummary {
  score: number;
  tier: DRSResult["tier"];
  tierLabel: string;
  maxDealAmount: number;
  level: {
    current: number;
    name: string;
    xp: number;
  };
  categories: QualitativeReputationCategory[];
  guidance: string[];
}

export function getDRSTierLabel(tier: DRSResult["tier"]): string {
  switch (tier) {
    case "ELITE": return "Elite Partner (Tier 5)";
    case "TRUSTED": return "Trusted Partner (Tier 4)";
    case "NORMAL": return "Verified Partner (Tier 3)";
    case "LIMITED": return "Provisional Partner (Tier 2)";
    case "FLAGGED": return "Restricted Partner (Tier 1)";
    default: return "Partner";
  }
}

export function getInfluencerQualitativeBreakdown(
  factors: InfluencerDRSFactors,
  _score: number,
): { categories: QualitativeReputationCategory[]; guidance: string[] } {
  const categories: QualitativeReputationCategory[] = [];
  const guidance: string[] = [];

  // 1. Deal Experience
  if (factors.completedDeals >= 20) {
    categories.push({
      category: "Deal Experience",
      status: "Exceptional",
      description: "Extensive collaboration history with verified milestone completion.",
    });
  } else if (factors.completedDeals >= 8) {
    categories.push({
      category: "Deal Experience",
      status: "Good",
      description: "Established collaboration history across multiple campaigns.",
    });
  } else if (factors.completedDeals >= 2) {
    categories.push({
      category: "Deal Experience",
      status: "Building",
      description: "Active collaboration history is forming across initial deals.",
    });
  } else {
    categories.push({
      category: "Deal Experience",
      status: "Starting Out",
      description: "Complete verified brand collaborations to establish your experience profile.",
    });
    guidance.push("Participate in and complete verified campaign deals to build a strong experience foundation.");
  }

  // 2. Client Reviews & Feedback
  const rawReviews = (factors.reviewBuckets?.recent ?? 0) + (factors.reviewBuckets?.mid ?? 0) + (factors.reviewBuckets?.old ?? 0);
  const rawPoor = (factors.poorReviewBuckets?.recent ?? 0) + (factors.poorReviewBuckets?.mid ?? 0) + (factors.poorReviewBuckets?.old ?? 0);

  if (rawPoor > 0) {
    categories.push({
      category: "Client Reviews",
      status: "Needs Attention",
      description: "Recent low ratings or feedback indicate areas for improved collaboration.",
    });
    guidance.push("Focus on deliverable quality and clear client alignment to maintain positive ratings.");
  } else if (rawReviews >= 10) {
    categories.push({
      category: "Client Reviews",
      status: "Exceptional",
      description: "Consistently top-rated by client partners for outstanding collaboration.",
    });
  } else if (rawReviews >= 3) {
    categories.push({
      category: "Client Reviews",
      status: "Good",
      description: "Favorable feedback and ratings received from brand counterparties.",
    });
  } else {
    categories.push({
      category: "Client Reviews",
      status: "Building",
      description: "Initial client feedback history is being collected.",
    });
    guidance.push("Deliver outstanding work to encourage brand partners to leave positive reviews.");
  }

  // 3. Fulfillment & Timeliness
  const rawLate = factors.lateDeliveryBuckets.recent + factors.lateDeliveryBuckets.mid + factors.lateDeliveryBuckets.old;
  const rawRej = factors.contentRejectionBuckets.recent + factors.contentRejectionBuckets.mid + factors.contentRejectionBuckets.old;

  if (rawLate > 0 || rawRej > 2) {
    categories.push({
      category: "Fulfillment & Timeliness",
      status: "Needs Attention",
      description: "Past submission delays or revision rounds require closer attention.",
    });
    guidance.push("Submit content drafts comfortably before deadlines to maintain high reliability standing.");
  } else if (rawLate === 0 && rawRej === 0) {
    categories.push({
      category: "Fulfillment & Timeliness",
      status: "Exceptional",
      description: "Punctual submissions with excellent first-pass draft approval rates.",
    });
  } else {
    categories.push({
      category: "Fulfillment & Timeliness",
      status: "Good",
      description: "Consistent delivery schedules and responsive submission cadence.",
    });
  }

  // 4. Account Longevity & Profile
  if (factors.identityVerified && factors.accountAgeDays >= 365) {
    categories.push({
      category: "Account Longevity",
      status: "Exceptional",
      description: "Long-standing verified account with sustained platform tenure.",
    });
  } else if (factors.identityVerified && factors.accountAgeDays >= 90) {
    categories.push({
      category: "Account Longevity",
      status: "Good",
      description: "Verified account with consistent platform engagement.",
    });
  } else if (factors.identityVerified) {
    categories.push({
      category: "Account Longevity",
      status: "Building",
      description: "Identity verified; account maturity strengthens with continued activity.",
    });
  } else {
    categories.push({
      category: "Account Longevity",
      status: "Needs Attention",
      description: "Identity verification is pending to unlock full trust standing.",
    });
    guidance.push("Complete official identity verification to elevate account security and credibility.");
  }

  // 5. Compliance & Conduct
  const rawDisputesLost = factors.disputeLostBuckets.recent + factors.disputeLostBuckets.mid + factors.disputeLostBuckets.old;
  if (rawDisputesLost > 0 || factors.termsViolations > 0 || factors.fakeFollowersDetected) {
    categories.push({
      category: "Platform Conduct",
      status: "Needs Attention",
      description: "Dispute history or policy compliance flags require remediation.",
    });
    guidance.push("Work collaboratively with brand partners to resolve queries amicably and prevent dispute escalation.");
  } else {
    categories.push({
      category: "Platform Conduct",
      status: "Exceptional",
      description: "Clean standing with zero lost disputes and full adherence to terms.",
    });
  }

  // Generic guidance fallback
  if (guidance.length === 0) {
    guidance.push("Maintain regular collaboration activity and timely communications to sustain your elite standing.");
    guidance.push("Consistently high-quality deliveries over time continue to reinforce overall platform reputation.");
  }

  return { categories, guidance };
}

export function getBrandQualitativeBreakdown(
  factors: BrandDRSFactors,
  _score: number,
): { categories: QualitativeReputationCategory[]; guidance: string[] } {
  const categories: QualitativeReputationCategory[] = [];
  const guidance: string[] = [];

  // 1. Payment & Escrow Reliability
  if (factors.paymentReliability >= 0.98 && factors.lateApprovals === 0) {
    categories.push({
      category: "Payment & Escrow",
      status: "Exceptional",
      description: "Prompt milestone funding and escrow approval turnaround.",
    });
  } else if (factors.paymentReliability >= 0.90 && factors.lateApprovals <= 1) {
    categories.push({
      category: "Payment & Escrow",
      status: "Good",
      description: "Reliable payment releases upon deliverable verification.",
    });
  } else {
    categories.push({
      category: "Payment & Escrow",
      status: "Needs Attention",
      description: "Speeding up milestone approvals and payment success will improve creator satisfaction.",
    });
    guidance.push("Review and approve completed creator submissions promptly to maintain high payment turnaround ratings.");
  }

  // 2. Creator Feedback
  if (factors.fairReviews >= 5 && factors.influencerComplaints === 0) {
    categories.push({
      category: "Creator Feedback",
      status: "Exceptional",
      description: "Highly rated by creator partners as a fair and collaborative brand.",
    });
  } else if (factors.influencerComplaints === 0) {
    categories.push({
      category: "Creator Feedback",
      status: "Good",
      description: "Favorable creator feedback across active campaigns.",
    });
  } else {
    categories.push({
      category: "Creator Feedback",
      status: "Needs Attention",
      description: "Creator feedback highlights opportunities to streamline partnerships.",
    });
    guidance.push("Provide clear creative briefs and prompt feedback to minimize revision friction with creators.");
  }

  // 3. Collaboration History
  if (factors.completedCampaigns >= 15) {
    categories.push({
      category: "Campaign Track Record",
      status: "Exceptional",
      description: "Extensive campaign history with multiple successful creator collaborations.",
    });
  } else if (factors.completedCampaigns >= 5) {
    categories.push({
      category: "Campaign Track Record",
      status: "Good",
      description: "Established campaign history with ongoing creator partnerships.",
    });
  } else {
    categories.push({
      category: "Campaign Track Record",
      status: "Building",
      description: "Launch and complete more campaigns to establish a deeper track record.",
    });
    guidance.push("Continue launching campaigns with verified escrow to build long-term reputation.");
  }

  // 4. Compliance & Dispute Standing
  if (factors.disputesLost === 0 && factors.termsViolations === 0 && factors.influencerComplaints === 0 && factors.unfairRejections === 0) {
    categories.push({
      category: "Platform Conduct",
      status: "Exceptional",
      description: "Dispute-free collaboration history adhering to platform guidelines.",
    });
  } else {
    categories.push({
      category: "Platform Conduct",
      status: "Needs Attention",
      description: "Past disputes, complaints, or rejections are affecting standing.",
    });
    guidance.push("Address creator concerns proactively and adhere to agreed contract scopes.");
  }

  if (guidance.length === 0) {
    guidance.push("Maintain clear campaign expectations and prompt escrow approvals to sustain top brand reputation.");
  }

  return { categories, guidance };
}

