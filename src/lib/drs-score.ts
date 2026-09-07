/**
* Digital Reputation Score (DRS) Calculator
* Advanced rule-based system for calculating user reputation.
* Replaces the legacy Trust Score system.
*/

// ==================== INFLUENCER DRS ====================

export interface InfluencerDRSFactors {
completedDeals: number;
totalEarningsPaise: number;
fiveStarReviews: number;
onTimeDeliveries: number;
lateDeliveries: number;
poorReviews: number;
contentRejections: number;
disputesLost: number;
disputesWon: number;
identityVerified: boolean;
accountAgeDays: number;
engagementRate: number;
fakeFollowersDetected: boolean;
termsViolations: number;
paymentFraudAttempts: number; // Specifies a permanent ban offense
avgReferralDRS: number; // Average DRS of users referred by this influencer
successfulReferrals: number; // Count of ACTIVE referred users
profileCompleteness: number; // Percentage 0-100
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
 * Clamp DRS score between 0 and 900.
 */
export function clampDRSScore(score: number): number {
  return Math.max(0, Math.min(900, Math.round(score)));
}

/**
 * Returns UTC timestamp for start of day (00:00:00.000) in Indian Standard Time (IST).
 */
export function getISTStartOfDay(date: Date = new Date()): Date {
  const istOffset = 5.5 * 60 * 60 * 1000;
  const todayIST = new Date(date.getTime() + istOffset);
  todayIST.setUTCHours(0, 0, 0, 0);
  return new Date(todayIST.getTime() - istOffset);
}

export function getDRSTierAndLimit(score: number): {
tier: DRSResult["tier"];
maxDealAmount: number;
} {
if (score <= 450) {
return { tier: "FLAGGED", maxDealAmount: 0 };
} else if (score < 550) {
return { tier: "LIMITED", maxDealAmount: 500000 }; // 5K
} else if (score <= 750) {
return { tier: "NORMAL", maxDealAmount: 2500000 }; // 25K
} else if (score <= 850) {
return { tier: "TRUSTED", maxDealAmount: 10000000 }; // 1L
} else {
return { tier: "ELITE", maxDealAmount: -1 }; // Unlimited
}
}

function applyInfluencerBonuses(
  factors: InfluencerDRSFactors,
  state: { score: number; breakdown: DRSResult["breakdown"] },
) {
  const qualifiedDeals = Math.min(factors.completedDeals, Math.floor(factors.totalEarningsPaise / 500000));
  const dealBonus = qualifiedDeals * 15;
  if (dealBonus > 0) {
    state.score += dealBonus;
    state.breakdown.push({
      factor: "Deal Experience",
      impact: dealBonus,
      reason: `${factors.completedDeals} deals completed (${qualifiedDeals} qualified by value)`,
    });
  }

  const reviewBonus = factors.fiveStarReviews * 30;
  if (reviewBonus > 0) {
    state.score += reviewBonus;
    state.breakdown.push({
      factor: "5-Star Quality",
      impact: reviewBonus,
      reason: `${factors.fiveStarReviews} perfect reviews`,
    });
  }

  const onTimeBonus = factors.onTimeDeliveries * 18;
  if (onTimeBonus > 0) {
    state.score += onTimeBonus;
    state.breakdown.push({
      factor: "Reliability",
      impact: onTimeBonus,
      reason: `${factors.onTimeDeliveries} on-time deliveries`,
    });
  }

  if (factors.identityVerified) {
    state.score += 60;
    state.breakdown.push({
      factor: "Identity Verified",
      impact: 60,
      reason: "Identity verification complete",
    });
  }

  if (factors.accountAgeDays >= 365) {
    state.score += 30;
    state.breakdown.push({
      factor: "Account Age",
      impact: 30,
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

  if (factors.completedDeals >= 50 && factors.disputesLost === 0) {
    state.score += 90;
    state.breakdown.push({
      factor: "Dispute-Free Record",
      impact: 90,
      reason: `50+ deals with zero lost disputes`,
    });
  }

  const disputeWonBonus = factors.disputesWon * 15;
  if (disputeWonBonus > 0) {
    state.score += disputeWonBonus;
    state.breakdown.push({
      factor: "Disputes Resolved in Favor",
      impact: disputeWonBonus,
      reason: `${factors.disputesWon} disputes resolved in favor`,
    });
  }
}

function applyInfluencerPenalties(
  factors: InfluencerDRSFactors,
  state: { score: number; breakdown: DRSResult["breakdown"] },
) {
  if (factors.lateDeliveries > 0) {
    const penalty = factors.lateDeliveries * 50;
    state.score -= penalty;
    state.breakdown.push({
      factor: "Late Deliveries",
      impact: -penalty,
      reason: `${factors.lateDeliveries} late deliveries`,
    });
  }

  if (factors.poorReviews > 0) {
    const penalty = factors.poorReviews * 90;
    state.score -= penalty;
    state.breakdown.push({
      factor: "Negative Reviews",
      impact: -penalty,
      reason: `${factors.poorReviews} poor ratings`,
    });
  }

  if (factors.contentRejections > 0) {
    const penalty = factors.contentRejections * 30;
    state.score -= penalty;
    state.breakdown.push({
      factor: "Content Rejections",
      impact: -penalty,
      reason: `${factors.contentRejections} content rejections`,
    });
  }

  if (factors.disputesLost > 0) {
    const penalty = factors.disputesLost * 180;
    state.score -= penalty;
    state.breakdown.push({
      factor: "Disputes Raised/Lost",
      impact: -penalty,
      reason: `${factors.disputesLost} disputes recorded`,
    });
  }

  if (factors.fakeFollowersDetected) {
    state.score -= 250;
    state.breakdown.push({
      factor: "AI Fraud Detection",
      impact: -250,
      reason: "Fake followers anomaly detected",
    });
  }

  if (factors.termsViolations > 0) {
    const penalty = factors.termsViolations * 450;
    state.score -= penalty;
    state.breakdown.push({
      factor: "Terms Violation",
      impact: -penalty,
      reason: `${factors.termsViolations} TOS violations`,
    });
  }

  if (factors.paymentFraudAttempts > 0) {
    state.score -= 600;
    state.breakdown.push({
      factor: "Fraud Attempt",
      impact: -600,
      reason: "Payment fraud triggers permanent ban logic",
    });
  }
}

export function calculateInfluencerDRS(
  factors: InfluencerDRSFactors,
): DRSResult {
  const state = {
    score: 600, // Starting score (CIBIL neutral)
    breakdown: [] as DRSResult["breakdown"],
  };

  applyInfluencerBonuses(factors, state);
  applyInfluencerPenalties(factors, state);

  // Cap score 300-900 (CIBIL range)
  const score = Math.max(300, Math.min(900, state.score));

  // Determine Tier
  const { tier, maxDealAmount } = getDRSTierAndLimit(score);

  return { score, tier, maxDealAmount, breakdown: state.breakdown };
}

// ==================== BRAND DRS ====================

export interface BrandDRSFactors {
completedCampaigns: number;
fastApprovals: number;
lateApprovals: number;
fairReviews: number;
disputesLost: number;
companyVerified: boolean;
paymentReliability: number;
termsViolations: number;
// Spec additions
longTermPartnerships: number; // Spec: Long-term partnership +5
unfairRejections: number; // Spec: Unfair rejections -10
influencerComplaints: number; // Spec: Influencer complaints -15
}

export function calculateBrandDRS(factors: BrandDRSFactors): DRSResult {
const breakdown: DRSResult["breakdown"] = [];
let score = 550; // Brands start at 550 (CIBIL neutral)

// === ACTIVITY ===
const campaignBonus = factors.completedCampaigns * 18;
if (campaignBonus > 0) {
score += campaignBonus;
breakdown.push({
factor: "Campaign History",
impact: campaignBonus,
reason: `${factors.completedCampaigns} campaigns completed`,
});
}

// === AGILITY ===
const approvalBonus = factors.fastApprovals * 12;
if (approvalBonus > 0) {
score += approvalBonus;
breakdown.push({
factor: "Fast Approvals",
impact: approvalBonus,
reason: `${factors.fastApprovals} quick approvals`,
});
}

// === RELIABILITY ===
if (factors.paymentReliability >= 0.98 && factors.completedCampaigns > 0) {
score += 60;
breakdown.push({
factor: "Payment Reliability",
impact: 60,
reason: "High payment success rate",
});
}

if (factors.companyVerified) {
score += 90;
breakdown.push({
factor: "Business Verified",
impact: 90,
reason: "Company registration verified",
});
}

// === LONG TERM PARTNERSHIPS ===
if (factors.longTermPartnerships > 0) {
const partnerBonus = factors.longTermPartnerships * 30;
score += partnerBonus;
breakdown.push({
factor: "Long-term Partnerships",
impact: partnerBonus,
reason: `${factors.longTermPartnerships} repeat influencer relationships`,
});
}

// === FAIR REVIEWS ===
if (factors.fairReviews > 0) {
const fairBonus = factors.fairReviews * 30;
score += fairBonus;
breakdown.push({
factor: "Fair Reviews",
impact: fairBonus,
reason: `${factors.fairReviews} fair reviews given to influencers`,
});
}

// === PENALTIES (STRICT) ===
if (factors.lateApprovals > 0) {
const penalty = factors.lateApprovals * 30;
score -= penalty;
breakdown.push({
factor: "Slow Responses",
impact: -penalty,
reason: `${factors.lateApprovals} delays in approval`,
});
}

if (factors.unfairRejections > 0) {
const penalty = factors.unfairRejections * 120;
score -= penalty;
breakdown.push({
factor: "Unfair Rejections",
impact: -penalty,
reason: `${factors.unfairRejections} unfair content rejections`,
});
}

if (factors.disputesLost > 0) {
const penalty = factors.disputesLost * 240;
score -= penalty;
breakdown.push({
factor: "Payment Disputes",
impact: -penalty,
reason: `${factors.disputesLost} payment disputes`,
});
}

if (factors.influencerComplaints > 0) {
const penalty = factors.influencerComplaints * 150;
score -= penalty;
breakdown.push({
factor: "Influencer Complaints",
impact: -penalty,
reason: `${factors.influencerComplaints} complaints received`,
});
}

if (factors.termsViolations > 0) {
const penalty = factors.termsViolations * 600;
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

// ==================== LEVELS ====================

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
return 10; // Rookie, Rising Star, Creator
}
