/**
 * Social Proof & Fraud Detection Core
 *
 * Pure, rule-based algorithmic scoring engine for follower authenticity,
 * cross-platform consistency verification, engagement spike outlier winsorization,
 * and transparent fraud signal analysis.
 *
 * STRICT RULE-BASED LOGIC ONLY — NO UNTRANSPARENT BLACK BOXES.
 * Safe for use in both server-side services and client-side admin inspection tools.
 */

export interface FraudSignal {
  code:
    | "CROSS_PLATFORM_MISMATCH"
    | "SUDDEN_ENGAGEMENT_SPIKE"
    | "FOLLOWER_GROWTH_SPIKE"
    | "COMMENT_POD_SUSPECTED"
    | "FOLLOWING_RATIO_ANOMALY";
  label: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  detail: string;
  impactScore: number;
}

export interface CrossPlatformMetrics {
  instagramFollowers?: number | null | undefined;
  instagramEngagementRate?: number | null | undefined; // e.g. 5.2 for 5.2%
  youtubeSubscribers?: number | null | undefined;
  youtubeEngagementRate?: number | null | undefined; // e.g. 0.3 for 0.3%
}

export interface FollowerAuthenticityParams {
  followers: number;
  following: number;
  engagementRate: number; // Average engagement rate %
  accountAgeDays: number;
  avgCommentsPerPost?: number | undefined;
  avgLikesPerPost?: number | undefined;
  uniqueCommentersRatio?: number | undefined; // 0-1 (unique commenters / total comments sampled)
  followerGrowthMonthly: number; // % monthly growth
  // Hardened factor 1: Cross-platform consistency
  crossPlatform?: CrossPlatformMetrics | undefined;
  // Hardened factor 2: Sudden engagement spike check
  recentPostEngagementRates?: number[] | undefined;
}

export interface FollowerAuthenticityResult {
  score: number; // 0-100
  fraudSignals: FraudSignal[];
  isFlagged: boolean;
  fraudRiskLevel: "LOW" | "MEDIUM" | "HIGH";
  winsorizedEngagementRate?: number | undefined;
  breakdown: {
    engagementRateScore: number;
    followingRatioScore: number;
    accountAgeScore: number;
    commentDiversityScore: number;
    growthConsistencyScore: number;
    crossPlatformScore: number;
    engagementSpikeScore: number;
  };
}

export interface SocialProofResult {
  followerAuthenticityScore: number; // 0-100
  contentQualityScore: number; // 0-100
  fraudRiskLevel: "LOW" | "MEDIUM" | "HIGH";
  isFlagged: boolean;
  fraudSignals: FraudSignal[];
  breakdown: SocialProofBreakdown;
}

export interface SocialProofBreakdown {
  // Authenticity factors
  engagementRateScore: number;
  followingRatioScore: number;
  accountAgeScore: number;
  commentDiversityScore: number;
  growthConsistencyScore: number;
  crossPlatformScore: number;
  engagementSpikeScore: number;
  // Quality factors
  avgEngagementScore: number;
  postingConsistencyScore: number;
  contentVarietyScore: number;
  completionRateScore: number;
}

/**
 * Calculates winsorized engagement rate: caps outlier post spikes to 2.5x median
 * so that a single bought post does not overweight historical average.
 */
export function calculateWinsorizedEngagementRate(rates: number[]): number {
  if (rates.length === 0) return 0;
  if (rates.length <= 2) return rates.reduce((a, b) => a + b, 0) / rates.length;

  const sorted = [...rates].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[mid - 1]! + sorted[mid]!) / 2
      : sorted[mid]!;

  const maxThreshold = Math.max(1.5, median * 2.5);
  const winsorized = rates.map((r) => Math.min(r, maxThreshold));
  return Number((winsorized.reduce((sum, r) => sum + r, 0) / winsorized.length).toFixed(2));
}

/**
 * Requirement 1: Cross-platform consistency check.
 * If creator connects both Instagram and YouTube and exhibits extreme divergence
 * in engagement patterns (e.g. 5% IG vs 0.1% YT), flag as suspicious.
 * Designed to minimize false positives by only checking when both channels have >= 1,000 followers.
 */
export function checkCrossPlatformConsistency(metrics: CrossPlatformMetrics): {
  isMismatched: boolean;
  divergenceRatio: number;
  scoreAdjustment: number;
  signal?: FraudSignal | undefined;
} {
  const igFollowers = metrics.instagramFollowers ?? 0;
  const ytSubs = metrics.youtubeSubscribers ?? 0;
  const igER = metrics.instagramEngagementRate ?? 0;
  const ytER = metrics.youtubeEngagementRate ?? 0;

  // Only run check if creator has active audience on BOTH platforms (>= 1,000 each)
  // This ensures single-platform or developing creators are NOT falsely flagged.
  if (igFollowers < 1000 || ytSubs < 1000) {
    return { isMismatched: false, divergenceRatio: 1, scoreAdjustment: 0 };
  }

  const higherER = Math.max(igER, ytER);
  const lowerER = Math.min(igER, ytER);

  if (higherER <= 0) {
    return { isMismatched: false, divergenceRatio: 1, scoreAdjustment: 0 };
  }

  // Safe lower bound prevents zero-division while capturing near-zero dormant channels
  const safeLower = Math.max(0.1, lowerER);
  const divergenceRatio = Number((higherER / safeLower).toFixed(2));

  // 1. Extreme mismatch (>= 10x ratio): likely bought engagement or inactive ghost channel
  if (divergenceRatio >= 10 && higherER >= 3.0) {
    const dominantPlatform = igER > ytER ? "Instagram" : "YouTube";
    const dormantPlatform = igER > ytER ? "YouTube" : "Instagram";
    return {
      isMismatched: true,
      divergenceRatio,
      scoreAdjustment: -20,
      signal: {
        code: "CROSS_PLATFORM_MISMATCH",
        label: "Cross-Platform Engagement Mismatch",
        severity: "HIGH",
        detail: `Extreme divergence (${divergenceRatio}x): ${dominantPlatform} engagement is ${higherER.toFixed(2)}% while ${dormantPlatform} is only ${lowerER.toFixed(2)}%.`,
        impactScore: -20,
      },
    };
  }

  // 2. Moderate mismatch (>= 6x ratio)
  if (divergenceRatio >= 6 && higherER >= 4.0) {
    const dominantPlatform = igER > ytER ? "Instagram" : "YouTube";
    const dormantPlatform = igER > ytER ? "YouTube" : "Instagram";
    return {
      isMismatched: true,
      divergenceRatio,
      scoreAdjustment: -10,
      signal: {
        code: "CROSS_PLATFORM_MISMATCH",
        label: "Cross-Platform Discrepancy",
        severity: "MEDIUM",
        detail: `Notable divergence (${divergenceRatio}x): ${dominantPlatform} engagement (${higherER.toFixed(2)}%) differs significantly from ${dormantPlatform} (${lowerER.toFixed(2)}%).`,
        impactScore: -10,
      },
    };
  }

  // Benign normal variance (e.g. YT 1.8% vs IG 3.5% = 1.9x ratio)
  return { isMismatched: false, divergenceRatio, scoreAdjustment: 0 };
}

/**
 * Requirement 2: Sudden engagement spike check.
 * Identifies if a single post suddenly gets 10x+ higher engagement than normal median (bought engagement / pod).
 */
export function detectSuddenEngagementSpike(params: {
  recentPostEngagementRates?: number[] | undefined;
  medianEngagementRate?: number | undefined;
}): {
  hasSpike: boolean;
  spikeRatio: number;
  scoreAdjustment: number;
  winsorizedEngagementRate?: number | undefined;
  signal?: FraudSignal | undefined;
} {
  const rates = params.recentPostEngagementRates ?? [];
  if (rates.length < 3) {
    return { hasSpike: false, spikeRatio: 1, scoreAdjustment: 0 };
  }

  const sorted = [...rates].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[mid - 1]! + sorted[mid]!) / 2
      : sorted[mid]!;

  const highestER = sorted[sorted.length - 1]!;
  const baselineMedian = params.medianEngagementRate ?? median;
  const safeMedian = Math.max(0.2, baselineMedian);
  const spikeRatio = Number((highestER / safeMedian).toFixed(2));

  // If a single post is >= 10x normal median (indicates bought engagement boost)
  if (spikeRatio >= 10 && highestER >= 8.0) {
    return {
      hasSpike: true,
      spikeRatio,
      scoreAdjustment: -15,
      winsorizedEngagementRate: calculateWinsorizedEngagementRate(rates),
      signal: {
        code: "SUDDEN_ENGAGEMENT_SPIKE",
        label: "Sudden Engagement Spike Anomaly",
        severity: "HIGH",
        detail: `Outlier post recorded ${highestER.toFixed(1)}% engagement (${spikeRatio}x above creator baseline median of ${safeMedian.toFixed(1)}%), signaling artificial engagement burst.`,
        impactScore: -15,
      },
    };
  }

  if (spikeRatio >= 6 && highestER >= 6.0) {
    return {
      hasSpike: true,
      spikeRatio,
      scoreAdjustment: -8,
      winsorizedEngagementRate: calculateWinsorizedEngagementRate(rates),
      signal: {
        code: "SUDDEN_ENGAGEMENT_SPIKE",
        label: "Unusual Engagement Influx",
        severity: "MEDIUM",
        detail: `Post engagement of ${highestER.toFixed(1)}% is ${spikeRatio}x higher than typical baseline (${safeMedian.toFixed(1)}%).`,
        impactScore: -8,
      },
    };
  }

  return {
    hasSpike: false,
    spikeRatio,
    scoreAdjustment: 0,
    winsorizedEngagementRate: calculateWinsorizedEngagementRate(rates),
  };
}

/**
 * Calculate follower authenticity score based on engagement patterns.
 * Higher score = more likely real followers.
 */
function scoreFollowingRatio(followers: number, following: number): number {
  if (followers <= 0) return 0;
  const ratio = following / followers;
  if (ratio < 0.3) return 15;
  if (ratio < 0.5) return 10;
  if (ratio < 1.0) return 5;
  return -10;
}

function scoreAccountGrowthRate(followers: number, accountAgeDays: number): number {
  if (accountAgeDays <= 0) return 0;
  const followersPerDay = followers / accountAgeDays;
  if (followersPerDay < 50) return 10;
  if (followersPerDay < 200) return 5;
  return -10;
}

/**
 * Hardened Follower Authenticity Scoring Engine.
 * Evaluates engagement, following ratio, account growth, comment diversity,
 * cross-platform consistency, and sudden post spikes.
 */
export function calculateFollowerAuthenticity(
  params: FollowerAuthenticityParams
): FollowerAuthenticityResult {
  let score = 50; // Base score
  const fraudSignals: FraudSignal[] = [];

  const engagementScore = calculateEngagementScore(params.followers, params.engagementRate);
  const followingRatioScore = scoreFollowingRatio(params.followers, params.following);
  const accountAgeScore = scoreAccountGrowthRate(params.followers, params.accountAgeDays);

  score += engagementScore;
  score += followingRatioScore;
  score += accountAgeScore;

  if (followingRatioScore < 0 && params.followers > 1000) {
    fraudSignals.push({
      code: "FOLLOWING_RATIO_ANOMALY",
      label: "Suspicious Follower-to-Following Ratio",
      severity: "LOW",
      detail: `Following count is disproportionately high relative to followers (${params.following}/${params.followers}).`,
      impactScore: followingRatioScore,
    });
  }

  // Factor 4: Comment Diversity (10 points)
  let commentDiversityScore = 0;
  const uniqueRatio = params.uniqueCommentersRatio ?? 0.7;
  if (uniqueRatio > 0.8) {
    commentDiversityScore = 10;
    score += 10;
  } else if (uniqueRatio > 0.5) {
    commentDiversityScore = 5;
    score += 5;
  } else if (uniqueRatio < 0.3) {
    commentDiversityScore = -5;
    score -= 5;
    fraudSignals.push({
      code: "COMMENT_POD_SUSPECTED",
      label: "Comment Pod / Bot Activity Suspected",
      severity: "MEDIUM",
      detail: `Unique commenters ratio is exceptionally low (${(uniqueRatio * 100).toFixed(0)}%), indicating comment pod rings or automated bots.`,
      impactScore: -5,
    });
  }

  // Factor 5: Growth Consistency (10 points)
  let growthConsistencyScore = 0;
  if (params.followerGrowthMonthly >= 0 && params.followerGrowthMonthly < 10) {
    growthConsistencyScore = 10;
    score += 10;
  } else if (params.followerGrowthMonthly < 20) {
    growthConsistencyScore = 5;
    score += 5;
  } else if (params.followerGrowthMonthly > 50) {
    growthConsistencyScore = -10;
    score -= 10; // Unnatural spike
    fraudSignals.push({
      code: "FOLLOWER_GROWTH_SPIKE",
      label: "Unnatural Follower Growth Surge",
      severity: "HIGH",
      detail: `Follower count increased by ${params.followerGrowthMonthly}% within a single 30-day window without verified viral post attribution.`,
      impactScore: -10,
    });
  }

  // Hardened Factor 6: Cross-Platform Consistency Check
  let crossPlatformScore = 0;
  if (params.crossPlatform) {
    const cpCheck = checkCrossPlatformConsistency(params.crossPlatform);
    if (cpCheck.isMismatched && cpCheck.signal) {
      crossPlatformScore = cpCheck.scoreAdjustment;
      score += cpCheck.scoreAdjustment;
      fraudSignals.push(cpCheck.signal);
    }
  }

  // Hardened Factor 7: Sudden Engagement Spike Check & Winsorization
  let engagementSpikeScore = 0;
  let winsorizedEngagementRate: number | undefined;
  if (params.recentPostEngagementRates && params.recentPostEngagementRates.length >= 3) {
    const spikeCheck = detectSuddenEngagementSpike({
      recentPostEngagementRates: params.recentPostEngagementRates,
      medianEngagementRate: params.engagementRate,
    });
    winsorizedEngagementRate = spikeCheck.winsorizedEngagementRate;
    if (spikeCheck.hasSpike && spikeCheck.signal) {
      engagementSpikeScore = spikeCheck.scoreAdjustment;
      score += spikeCheck.scoreAdjustment;
      fraudSignals.push(spikeCheck.signal);
    }
  }

  const finalScore = Math.max(0, Math.min(100, score));

  // Determine Fraud Risk Level & Flagging
  const hasHighSeveritySignal = fraudSignals.some((s) => s.severity === "HIGH");
  const hasMediumSeveritySignal = fraudSignals.some((s) => s.severity === "MEDIUM");

  let fraudRiskLevel: "LOW" | "MEDIUM" | "HIGH" = "LOW";
  let isFlagged = false;

  if (finalScore < 40 || hasHighSeveritySignal) {
    fraudRiskLevel = "HIGH";
    isFlagged = true;
  } else if (finalScore < 60 || hasMediumSeveritySignal) {
    fraudRiskLevel = "MEDIUM";
    isFlagged = false;
  }

  return {
    score: finalScore,
    fraudSignals,
    isFlagged,
    fraudRiskLevel,
    winsorizedEngagementRate,
    breakdown: {
      engagementRateScore: engagementScore,
      followingRatioScore,
      accountAgeScore,
      commentDiversityScore,
      growthConsistencyScore,
      crossPlatformScore,
      engagementSpikeScore,
    },
  };
}

export function scoreAvgEngagement(rate: number): number {
  if (rate > 3) return 20;
  if (rate > 2) return 15;
  if (rate > 1) return 10;
  if (rate > 0.5) return 5;
  return -5;
}

export function scorePostingFrequency(freq: number): number {
  if (freq >= 2 && freq <= 5) return 10;
  if (freq >= 1 && freq <= 7) return 5;
  if (freq > 10) return -5;
  return 0;
}

export function scoreDealCompletion(completedDeals: number, totalDeals: number): number {
  if (totalDeals <= 0) return 0;
  const rate = completedDeals / totalDeals;
  if (rate >= 0.9) return 10;
  if (rate >= 0.7) return 5;
  if (rate < 0.5) return -5;
  return 0;
}

export function scoreRating(averageRating: number, _totalDeals: number): number {
  const rating = averageRating > 5 ? averageRating / 100 : averageRating;
  if (rating >= 4.5) return 10;
  if (rating >= 4.0) return 7;
  if (rating >= 3.5) return 4;
  if (rating < 3.0 && rating > 0) return -5;
  return 0;
}

/**
 * Calculate content quality score based on posting patterns and engagement.
 */
export function calculateContentQuality(params: {
  avgEngagementRate: number; // Average across last 10 posts
  postingFrequencyPerWeek: number; // Posts per week
  contentTypeVariety: number; // Number of different content types used (1-5)
  completedDeals: number;
  totalDeals: number;
  averageRating: number; // 0-5
  onTimeDeliveryRate: number; // 0-1
}): number {
  let score = 50; // Base score

  score += scoreAvgEngagement(params.avgEngagementRate);
  score += scorePostingFrequency(params.postingFrequencyPerWeek);

  // Factor 3: Content Variety (5 points)
  if (params.contentTypeVariety >= 3) score += 5;
  else if (params.contentTypeVariety >= 2) score += 3;

  score += scoreDealCompletion(params.completedDeals, params.totalDeals);
  score += scoreRating(params.averageRating, params.totalDeals);

  // Factor 6: On-time delivery (5 points)
  if (params.onTimeDeliveryRate >= 0.9) score += 5;
  else if (params.onTimeDeliveryRate >= 0.7) score += 3;
  else if (params.onTimeDeliveryRate < 0.5 && params.totalDeals > 0) score -= 3;

  return Math.max(0, Math.min(100, score));
}

export function calculateEngagementScore(
  followers: number,
  engagementRate: number,
): number {
  const defaultScore = 15;
  const followerBrackets = [
    {
      maxFollowers: 10_000, // Nano
      rules: [
        { minRate: 4, maxRate: 10, score: 20 },
        { minRate: 2, maxRate: 4, score: 15 },
        { minRate: 1, maxRate: 2, score: 10 },
        { minRate: 0, maxRate: 1, score: 5 },
      ],
    },
    {
      maxFollowers: 100_000, // Micro
      rules: [
        { minRate: 2, maxRate: 5, score: 20 },
        { minRate: 1.5, maxRate: 2, score: 15 },
        { minRate: 0.8, maxRate: 1.5, score: 10 },
        { minRate: 0, maxRate: 0.8, score: 5 },
      ],
    },
    {
      maxFollowers: 500_000, // Mid-tier
      rules: [
        { minRate: 1.5, maxRate: 3.5, score: 20 },
        { minRate: 1.0, maxRate: 1.5, score: 15 },
        { minRate: 0.5, maxRate: 1.0, score: 10 },
        { minRate: 0, maxRate: 0.5, score: 5 },
      ],
    },
    {
      maxFollowers: Infinity, // Macro/Mega
      rules: [
        { minRate: 1.0, maxRate: 2.5, score: 20 },
        { minRate: 0.7, maxRate: 1.0, score: 15 },
        { minRate: 0.3, maxRate: 0.7, score: 10 },
        { minRate: 0, maxRate: 0.3, score: 5 },
      ],
    },
  ];

  const bracket = followerBrackets.find((b) => followers <= b.maxFollowers);
  if (!bracket) return defaultScore;

  const rule = bracket.rules.find((r) => engagementRate >= r.minRate && engagementRate <= r.maxRate);
  return rule ? rule.score : defaultScore;
}

export interface InfluencerFraudAnalysis {
  influencerId: string;
  followerAuthenticityScore: number;
  fraudRiskLevel: "LOW" | "MEDIUM" | "HIGH";
  isFlagged: boolean;
  fraudSignals: FraudSignal[];
  metrics: {
    instagramFollowers: number;
    instagramEngagementRate: number;
    youtubeSubscribers: number;
    youtubeEngagementRate: number;
    crossPlatformRatio?: number | undefined;
  };
  breakdown: FollowerAuthenticityResult["breakdown"];
}

/**
 * Transparent fraud & social proof explainer for admin dashboard and appeal reviews.
 * Deconstructs creator metrics into explainable signals.
 */
export function analyzeInfluencerFraudProfile(profile: {
  id: string;
  instagramFollowers?: number | null | undefined;
  instagramEngagementRate?: number | null | undefined;
  youtubeSubscribers?: number | null | undefined;
  youtubeEngagementRate?: number | null | undefined;
  followerAuthenticityScore?: number | null | undefined;
  accountAge?: Date | string | null | undefined;
  userCreatedAt?: Date | string | null | undefined;
}): InfluencerFraudAnalysis {
  const igFollowers = profile.instagramFollowers ?? 0;
  const ytSubs = profile.youtubeSubscribers ?? 0;
  const followers = igFollowers || ytSubs || 1000;
  const igER = profile.instagramEngagementRate ? profile.instagramEngagementRate / 100 : 0;
  const ytER = profile.youtubeEngagementRate ? profile.youtubeEngagementRate / 100 : 0;
  const engagementRate = Math.max(igER, ytER);

  const createdAt = profile.accountAge || profile.userCreatedAt || new Date();
  const accountAgeDays = Math.max(1, Math.floor((Date.now() - new Date(createdAt).getTime()) / (86400 * 1000)));

  const authResult = calculateFollowerAuthenticity({
    followers,
    following: Math.round(followers * 0.2), // default normal baseline
    engagementRate,
    accountAgeDays,
    followerGrowthMonthly: 8, // normal
    crossPlatform: {
      instagramFollowers: profile.instagramFollowers ?? undefined,
      instagramEngagementRate: igER,
      youtubeSubscribers: profile.youtubeSubscribers ?? undefined,
      youtubeEngagementRate: ytER,
    },
  });

  const cpCheck = checkCrossPlatformConsistency({
    instagramFollowers: profile.instagramFollowers ?? undefined,
    instagramEngagementRate: igER,
    youtubeSubscribers: profile.youtubeSubscribers ?? undefined,
    youtubeEngagementRate: ytER,
  });

  return {
    influencerId: profile.id,
    followerAuthenticityScore: profile.followerAuthenticityScore ?? authResult.score,
    fraudRiskLevel: authResult.fraudRiskLevel,
    isFlagged: authResult.isFlagged,
    fraudSignals: authResult.fraudSignals,
    metrics: {
      instagramFollowers: igFollowers,
      instagramEngagementRate: igER,
      youtubeSubscribers: ytSubs,
      youtubeEngagementRate: ytER,
      crossPlatformRatio: cpCheck.divergenceRatio,
    },
    breakdown: authResult.breakdown,
  };
}
