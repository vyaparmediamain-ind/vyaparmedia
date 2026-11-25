/**
 * Fair Price Engine (Pure Function Engine)
 *
 * Computes estimated market rate ranges for creator deliverables based on:
 * - Statistical views basis (trimmed mean or median of API-verified views, or reach estimator fallback)
 * - Category baseline CPV (in paise, resolved upstream by MatchingService)
 * - Follower-tier scaling factors
 * - Quality multipliers (Engagement Rate, Authenticity, DRS Reputation)
 * - Deliverables and add-ons (stories, usage rights, exclusivity, raw footage)
 * - Confidence-based range widening (narrow for VERIFIED/HIGH, widened for ESTIMATED/LOW)
 *
 * STRICT REQUIREMENTS:
 * - Pure logic: Zero DB (Prisma), zero network (fetch), zero side-effects. Injected clock for testing.
 * - Money = integer paise; rates = basis points (bps).
 * - Single rounding at final integer calculations with Math.round.
 * - Reuses category baseline CPV passed in — does NOT define a duplicate niche table.
 * - User-facing copy MUST strictly use "estimated market range", NEVER "fair/guaranteed price".
 */

import { createHash } from "node:crypto";

export const FAIR_PRICE_ENGINE_VERSION = "1.0.0";

export type FairPricePlatform = "INSTAGRAM" | "YOUTUBE" | string;
export type FairPriceContentType = "REEL" | "POST" | "STORY" | "VIDEO" | "SHORT" | string;
export type FairPriceConfidence = "HIGH" | "MEDIUM" | "LOW";
export type FairPriceDataQuality = "VERIFIED" | "ESTIMATED" | "SELF_REPORTED";

export type ViewStatisticType =
  | "TRIMMED_MEAN_DROP_TOP2_BOTTOM2"
  | "TRIMMED_MEAN_DROP_TOP1_BOTTOM1"
  | "MEDIAN"
  | "EXPECTED_VIEWS_HEURISTIC";

export type FairPriceFlag =
  | "LOW_REACH_RATIO"
  | "LOW_ENGAGEMENT"
  | "LOW_AUTHENTICITY"
  | "INSUFFICIENT_DATA"
  | "ESTIMATED_VIEWS"
  | "PROFILE_STALE"
  | "RATE_ABOVE_RANGE"
  | "RATE_BELOW_RANGE";

export type CreatorFollowerTier = "nano" | "micro" | "mid" | "macro";

export interface FairPriceDeliverables {
  count: number;
  stories?: number | undefined;
  usageRightsDays?: number | undefined;
  exclusivityMonths?: number | undefined;
  rawFootage?: boolean | undefined;
}

export interface ExpectedViewsInput {
  low: number;
  mid: number;
  high: number;
}

export interface FairPriceInput {
  platform: FairPricePlatform;
  contentType: FairPriceContentType;
  followers: number;
  engagementRateBps?: number | undefined;
  recentViews?: number[] | undefined;
  expectedViews?: ExpectedViewsInput | undefined;
  categoryBaselineCpvPaise: number;
  authenticityScore?: number | undefined; // 0 - 100, optional when unmeasured
  drsScore?: number | undefined; // 300 - 900
  deliverables: FairPriceDeliverables;
  dataQuality: FairPriceDataQuality;
  quotedRatePaise?: number | undefined;
  profileUpdatedAt?: Date | string | null | undefined;
  now?: Date | undefined;
}

export interface FairPriceExplanationItem {
  step: string;
  description: string;
  statistic?: ViewStatisticType;
  multiplier?: number;
  contributionPaise: number;
  runningTotalPaise: number;
}

export interface FairPriceOutput {
  basePaise: number;
  minPaise: number;
  maxPaise: number;
  expectedViews: number;
  viewStatistic: ViewStatisticType;
  confidence: FairPriceConfidence;
  dataQuality: FairPriceDataQuality;
  flags: FairPriceFlag[];
  explanation: FairPriceExplanationItem[];
  engineVersion: string;
}

export interface QuotedRateComparison {
  position: "BELOW" | "WITHIN" | "ABOVE";
  quotedRatePaise: number;
  minPaise: number;
  maxPaise: number;
  deltaPaise: number;
  deltaBps: number;
  deltaPercent: number;
  statusMessage: string;
}

export interface FairPriceConfig {
  tierFactors: Record<CreatorFollowerTier, number>;
  tierThresholds: {
    nanoMax: number;
    microMax: number;
    midMax: number;
  };
  tierErBenchmarksBps: Record<CreatorFollowerTier, number>;
  qualityBenchmarks: {
    authenticity: number;
    drs: number;
  };
  qualityClamps: {
    minProduct: number;
    maxProduct: number;
    minDrsDelta: number;
    maxDrsDelta: number;
  };
  addOnMultipliers: {
    story: number;
    usageRightsPer30d: number;
    exclusivityPerMonth: number;
    rawFootage: number;
  };
  rangeRatios: {
    minRatio: number;
    maxRatio: number;
    widenedMinRatio: number;
    widenedMaxRatio: number;
  };
  staleProfileDaysThreshold?: number | undefined;
}

/**
 * Authoritative default parameters for fair price estimation.
 * Tunable at runtime via configOverride.
 */
export const DEFAULT_FAIR_PRICE_CONFIG: FairPriceConfig = {
  tierFactors: {
    nano: 1.15,  // Nano creators deliver higher attention density
    micro: 1.05, // Micro creators deliver solid organic reach
    mid: 1.00,   // Mid creators establish market baseline
    macro: 0.90, // Macro creators experience higher dilution
  },
  tierThresholds: {
    nanoMax: 10_000,
    microMax: 50_000,
    midMax: 250_000,
  },
  tierErBenchmarksBps: {
    nano: 400,  // 4.00%
    micro: 250, // 2.50%
    mid: 180,   // 1.80%
    macro: 120, // 1.20%
  },
  qualityBenchmarks: {
    authenticity: 75,
    drs: 600,
  },
  qualityClamps: {
    minProduct: 0.60,
    maxProduct: 1.40,
    minDrsDelta: -0.10, // Max -10% DRS penalty
    maxDrsDelta: 0.10,  // Max +10% DRS reward
  },
  addOnMultipliers: {
    story: 0.15,               // 15% of base deliverable value per story
    usageRightsPer30d: 0.20,   // 20% of base deliverable value per 30-day block
    exclusivityPerMonth: 0.25, // 25% of base deliverable value per month
    rawFootage: 0.30,          // 30% of base deliverable value for raw assets
  },
  rangeRatios: {
    minRatio: 0.85,
    maxRatio: 1.20,
    widenedMinRatio: 0.75,
    widenedMaxRatio: 1.35,
  },
  staleProfileDaysThreshold: 60,
};

/**
 * Resolves creator tier based on follower count.
 */
export function resolveFollowerTier(
  followers: number,
  config: FairPriceConfig = DEFAULT_FAIR_PRICE_CONFIG
): CreatorFollowerTier {
  const safeFollowers = Math.max(0, followers || 0);
  if (safeFollowers <= config.tierThresholds.nanoMax) return "nano";
  if (safeFollowers <= config.tierThresholds.microMax) return "micro";
  if (safeFollowers <= config.tierThresholds.midMax) return "mid";
  return "macro";
}

/**
 * Computes deterministic inputs hash for audit and evaluation caching.
 */
export function computeInputsHash(input: FairPriceInput): string {
  const canonical = {
    platform: (input.platform || "").toUpperCase().trim(),
    contentType: (input.contentType || "").toUpperCase().trim(),
    followers: Math.max(0, input.followers || 0),
    engagementRateBps: input.engagementRateBps ?? null,
    recentViews: (input.recentViews || [])
      .filter((v) => typeof v === "number" && Number.isFinite(v) && v > 0)
      .sort((a, b) => a - b),
    expectedViewsMid: input.expectedViews?.mid ?? null,
    categoryBaselineCpvPaise: Math.max(1, input.categoryBaselineCpvPaise || 1),
    authenticityScore:
      typeof input.authenticityScore === "number" && Number.isFinite(input.authenticityScore)
        ? Math.max(0, Math.min(100, input.authenticityScore))
        : null,
    drsScore: input.drsScore ?? null,
    deliverables: {
      count: Math.max(1, input.deliverables?.count || 1),
      stories: input.deliverables?.stories ?? 0,
      usageRightsDays: input.deliverables?.usageRightsDays ?? 0,
      exclusivityMonths: input.deliverables?.exclusivityMonths ?? 0,
      rawFootage: Boolean(input.deliverables?.rawFootage),
    },
    dataQuality: input.dataQuality,
    quotedRatePaise: input.quotedRatePaise ?? null,
  };

  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

/**
 * Pure function fair price estimation algorithm.
 */
export function calculateFairPrice(
  input: FairPriceInput,
  configOverride?: Partial<FairPriceConfig>
): FairPriceOutput {
  const config: FairPriceConfig = {
    ...DEFAULT_FAIR_PRICE_CONFIG,
    ...configOverride,
    tierFactors: { ...DEFAULT_FAIR_PRICE_CONFIG.tierFactors, ...configOverride?.tierFactors },
    tierThresholds: { ...DEFAULT_FAIR_PRICE_CONFIG.tierThresholds, ...configOverride?.tierThresholds },
    tierErBenchmarksBps: { ...DEFAULT_FAIR_PRICE_CONFIG.tierErBenchmarksBps, ...configOverride?.tierErBenchmarksBps },
    qualityBenchmarks: { ...DEFAULT_FAIR_PRICE_CONFIG.qualityBenchmarks, ...configOverride?.qualityBenchmarks },
    qualityClamps: { ...DEFAULT_FAIR_PRICE_CONFIG.qualityClamps, ...configOverride?.qualityClamps },
    addOnMultipliers: { ...DEFAULT_FAIR_PRICE_CONFIG.addOnMultipliers, ...configOverride?.addOnMultipliers },
    rangeRatios: { ...DEFAULT_FAIR_PRICE_CONFIG.rangeRatios, ...configOverride?.rangeRatios },
    staleProfileDaysThreshold:
      configOverride?.staleProfileDaysThreshold ??
      DEFAULT_FAIR_PRICE_CONFIG.staleProfileDaysThreshold ??
      60,
  };

  const now = input.now || new Date();
  const explanation: FairPriceExplanationItem[] = [];
  const flags: FairPriceFlag[] = [];

  // ─────────────────────────────────────────────────────────────
  // 1. Views Basis & Statistic Selection
  // ─────────────────────────────────────────────────────────────
  const rawViews = input.recentViews || [];
  const validViews = rawViews
    .filter((v) => typeof v === "number" && Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);

  const n = validViews.length;
  let viewsBasis: number;
  let viewStatistic: ViewStatisticType;
  let confidence: FairPriceConfidence;
  let effectiveDataQuality: FairPriceDataQuality = input.dataQuality;

  if (n >= 8) {
    // Drop top 2 and bottom 2
    const trimmed = validViews.slice(2, n - 2);
    const sum = trimmed.reduce((acc, v) => acc + v, 0);
    viewsBasis = Math.round(sum / trimmed.length);
    viewStatistic = "TRIMMED_MEAN_DROP_TOP2_BOTTOM2";
    confidence = "HIGH";
  } else if (n >= 5) {
    // Drop top 1 and bottom 1
    const trimmed = validViews.slice(1, n - 1);
    const sum = trimmed.reduce((acc, v) => acc + v, 0);
    viewsBasis = Math.round(sum / trimmed.length);
    viewStatistic = "TRIMMED_MEAN_DROP_TOP1_BOTTOM1";
    confidence = "MEDIUM";
  } else if (n >= 1) {
    // Median
    const midIdx = Math.floor(n / 2);
    const median =
      n % 2 === 0
        ? ((validViews[midIdx - 1] ?? (validViews[midIdx] ?? 0)) + (validViews[midIdx] ?? 0)) / 2
        : (validViews[midIdx] ?? 0);
    viewsBasis = Math.round(median);
    viewStatistic = "MEDIAN";
    confidence = "LOW";
    flags.push("INSUFFICIENT_DATA");
  } else {
    // Fallback to reach estimator expected views
    const heuristicViews = input.expectedViews?.mid;
    viewsBasis =
      heuristicViews && Number.isFinite(heuristicViews) && heuristicViews > 0
        ? Math.round(heuristicViews)
        : Math.max(10, Math.round((input.followers || 0) * 0.15));

    viewStatistic = "EXPECTED_VIEWS_HEURISTIC";
    confidence = "LOW";
    effectiveDataQuality = "ESTIMATED";
    flags.push("INSUFFICIENT_DATA");
    flags.push("ESTIMATED_VIEWS");
  }

  // Ensure minimum 1 view
  viewsBasis = Math.max(1, viewsBasis);

  explanation.push({
    step: "VIEWS_BASIS",
    description: `Estimated ${viewsBasis.toLocaleString("en-IN")} views using ${viewStatistic} from ${n} API data points.`,
    statistic: viewStatistic,
    contributionPaise: 0,
    runningTotalPaise: 0,
  });

  // ─────────────────────────────────────────────────────────────
  // 2. Base Deliverable Value
  // ─────────────────────────────────────────────────────────────
  const safeBaselineCpvPaise = Math.max(1, Number.isFinite(input.categoryBaselineCpvPaise) ? input.categoryBaselineCpvPaise : 1);
  const baseValuePaise = Math.round(viewsBasis * safeBaselineCpvPaise);

  explanation.push({
    step: "BASE_CPV_VALUE",
    description: `Base deliverable value calculated at ₹${(safeBaselineCpvPaise / 100).toFixed(2)} CPV benchmark across ${viewsBasis.toLocaleString("en-IN")} views.`,
    contributionPaise: baseValuePaise,
    runningTotalPaise: baseValuePaise,
  });

  // ─────────────────────────────────────────────────────────────
  // 3. Follower-Tier Factor
  // ─────────────────────────────────────────────────────────────
  const tier = resolveFollowerTier(input.followers, config);
  const tierFactor = config.tierFactors[tier];
  const tierAdjustedPaise = Math.round(baseValuePaise * tierFactor);
  const tierDeltaPaise = tierAdjustedPaise - baseValuePaise;

  explanation.push({
    step: "FOLLOWER_TIER_FACTOR",
    description: `Applied ${tier} tier factor (${tierFactor}x) for ${(input.followers || 0).toLocaleString("en-IN")} followers.`,
    multiplier: tierFactor,
    contributionPaise: tierDeltaPaise,
    runningTotalPaise: tierAdjustedPaise,
  });

  // ─────────────────────────────────────────────────────────────
  // 4. Quality Multiplier (ER, Authenticity, DRS)
  // ─────────────────────────────────────────────────────────────
  const tierErBenchmark = config.tierErBenchmarksBps[tier];
  const rawErBps = input.engagementRateBps;
  const hasMeasuredEr = typeof rawErBps === "number" && Number.isFinite(rawErBps);
  const safeErBps = hasMeasuredEr ? Math.max(0, rawErBps) : tierErBenchmark;

  // Check low engagement flag (only when measured)
  if (hasMeasuredEr && safeErBps < tierErBenchmark * 0.6) {
    flags.push("LOW_ENGAGEMENT");
  }

  // ER factor: centered around 1.0 at tier average, dampened by 25% sensitivity
  const erRatio = tierErBenchmark > 0 ? safeErBps / tierErBenchmark : 1.0;
  const erFactor = 1.0 + (erRatio - 1.0) * 0.25;

  // Authenticity factor: benchmark 75, scaled up to 100 or down to 0
  const rawAuth = input.authenticityScore;
  const hasMeasuredAuth = typeof rawAuth === "number" && Number.isFinite(rawAuth);
  const safeAuth = hasMeasuredAuth
    ? Math.max(0, Math.min(100, rawAuth))
    : config.qualityBenchmarks.authenticity;

  if (hasMeasuredAuth && safeAuth < 60) {
    flags.push("LOW_AUTHENTICITY");
  }
  const authFactor = 1.0 + ((safeAuth - config.qualityBenchmarks.authenticity) / 100) * 0.40;

  // DRS factor: neutral at 600, range [300, 900], strictly bounded within [-10%, +10%]
  let drsFactor = 1.0;
  if (input.drsScore !== undefined && Number.isFinite(input.drsScore)) {
    const safeDrs = Math.max(300, Math.min(900, input.drsScore));
    const rawDrsDelta = ((safeDrs - config.qualityBenchmarks.drs) / 300) * 0.10;
    const clampedDrsDelta = Math.max(config.qualityClamps.minDrsDelta, Math.min(config.qualityClamps.maxDrsDelta, rawDrsDelta));
    drsFactor = 1.0 + clampedDrsDelta;
  }

  // Combined quality product clamped to [minProduct, maxProduct]
  const rawQualityProduct = erFactor * authFactor * drsFactor;
  const clampedQualityMultiplier = Math.max(
    config.qualityClamps.minProduct,
    Math.min(config.qualityClamps.maxProduct, rawQualityProduct)
  );

  const qualityAdjustedPaise = Math.round(tierAdjustedPaise * clampedQualityMultiplier);
  const qualityDeltaPaise = qualityAdjustedPaise - tierAdjustedPaise;

  explanation.push({
    step: "QUALITY_MULTIPLIER",
    description: `Quality multiplier ${clampedQualityMultiplier.toFixed(3)}x (ER: ${erFactor.toFixed(3)}x, Authenticity: ${authFactor.toFixed(3)}x, DRS: ${drsFactor.toFixed(3)}x; clamped to [${config.qualityClamps.minProduct}, ${config.qualityClamps.maxProduct}]).`,
    multiplier: Number(clampedQualityMultiplier.toFixed(4)),
    contributionPaise: qualityDeltaPaise,
    runningTotalPaise: qualityAdjustedPaise,
  });

  // ─────────────────────────────────────────────────────────────
  // 5. Deliverables & Add-ons
  // ─────────────────────────────────────────────────────────────
  const deliverableCount = Math.max(1, input.deliverables?.count || 1);
  const deliverablesBasePaise = Math.round(qualityAdjustedPaise * deliverableCount);

  const storiesCount = Math.max(0, input.deliverables?.stories || 0);
  const storyPaise = Math.round(storiesCount * qualityAdjustedPaise * config.addOnMultipliers.story);

  const usageRightsDays = Math.max(0, input.deliverables?.usageRightsDays || 0);
  const usageBlocks = Math.ceil(usageRightsDays / 30);
  const usagePaise = Math.round(usageBlocks * qualityAdjustedPaise * config.addOnMultipliers.usageRightsPer30d);

  const exclusivityMonths = Math.max(0, input.deliverables?.exclusivityMonths || 0);
  const exclusivityPaise = Math.round(exclusivityMonths * qualityAdjustedPaise * config.addOnMultipliers.exclusivityPerMonth);

  const hasRawFootage = Boolean(input.deliverables?.rawFootage);
  const rawFootagePaise = hasRawFootage ? Math.round(qualityAdjustedPaise * config.addOnMultipliers.rawFootage) : 0;

  const totalAddOnsPaise = storyPaise + usagePaise + exclusivityPaise + rawFootagePaise;
  const finalBasePaise = deliverablesBasePaise + totalAddOnsPaise;
  const deliverablesDeltaPaise = finalBasePaise - qualityAdjustedPaise;

  explanation.push({
    step: "DELIVERABLES_AND_ADDONS",
    description: `Deliverables (${deliverableCount}x main deliverable${deliverableCount > 1 ? "s" : ""})` +
      (totalAddOnsPaise > 0
        ? ` + add-ons (stories: ₹${(storyPaise / 100).toFixed(0)}, usage rights: ₹${(usagePaise / 100).toFixed(0)}, exclusivity: ₹${(exclusivityPaise / 100).toFixed(0)}, raw footage: ₹${(rawFootagePaise / 100).toFixed(0)}).`
        : "."),
    contributionPaise: deliverablesDeltaPaise,
    runningTotalPaise: finalBasePaise,
  });

  // ─────────────────────────────────────────────────────────────
  // 6. Range Calculation (Widened for Low Confidence / Estimated)
  // ─────────────────────────────────────────────────────────────
  const isWidened = confidence === "LOW" || effectiveDataQuality === "ESTIMATED";
  const minRatio = isWidened ? config.rangeRatios.widenedMinRatio : config.rangeRatios.minRatio;
  const maxRatio = isWidened ? config.rangeRatios.widenedMaxRatio : config.rangeRatios.maxRatio;

  const minPaise = Math.round(finalBasePaise * minRatio);
  const maxPaise = Math.round(finalBasePaise * maxRatio);

  explanation.push({
    step: "MARKET_RANGE",
    description: `Estimated market range: ${minRatio}x to ${maxRatio}x (${isWidened ? "widened band for lower confidence/estimated data" : "standard market band"}).`,
    contributionPaise: 0,
    runningTotalPaise: finalBasePaise,
  });

  // ─────────────────────────────────────────────────────────────
  // 7. Flags Evaluation
  // ─────────────────────────────────────────────────────────────
  // LOW_REACH_RATIO
  if (input.followers > 0 && viewsBasis / input.followers < 0.05) {
    flags.push("LOW_REACH_RATIO");
  }

  // PROFILE_STALE
  if (input.profileUpdatedAt) {
    const updatedAt = new Date(input.profileUpdatedAt);
    if (!Number.isNaN(updatedAt.getTime())) {
      const diffMs = now.getTime() - updatedAt.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      const threshold = config.staleProfileDaysThreshold ?? 60;
      if (diffDays > threshold) {
        flags.push("PROFILE_STALE");
      }
    }
  }

  // Quoted rate comparison flags
  if (input.quotedRatePaise !== undefined && Number.isFinite(input.quotedRatePaise)) {
    if (input.quotedRatePaise > maxPaise) {
      flags.push("RATE_ABOVE_RANGE");
    } else if (input.quotedRatePaise < minPaise) {
      flags.push("RATE_BELOW_RANGE");
    }
  }

  // Deduplicate flags preserving order
  const uniqueFlags = Array.from(new Set(flags));

  return {
    basePaise: finalBasePaise,
    minPaise,
    maxPaise,
    expectedViews: viewsBasis,
    viewStatistic,
    confidence,
    dataQuality: effectiveDataQuality,
    flags: uniqueFlags,
    explanation,
    engineVersion: FAIR_PRICE_ENGINE_VERSION,
  };
}

/**
 * Compares creator quoted rate against estimated market range.
 * Strictly adheres to copy rule: uses "estimated market range", never "fair/guaranteed price".
 */
export function compareQuotedRate(
  quotedPaise: number,
  output: FairPriceOutput
): QuotedRateComparison {
  const safeQuoted = Math.max(0, Math.round(quotedPaise || 0));
  const midPointPaise = Math.round((output.minPaise + output.maxPaise) / 2);
  const deltaPaise = safeQuoted - midPointPaise;
  const deltaBps = midPointPaise > 0 ? Math.round((deltaPaise / midPointPaise) * 10000) : 0;
  const deltaPercent = Number((deltaBps / 100).toFixed(1));

  let position: "BELOW" | "WITHIN" | "ABOVE";
  let statusMessage: string;

  const quotedRupees = (safeQuoted / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  const minRupees = (output.minPaise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  const maxRupees = (output.maxPaise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });

  if (safeQuoted < output.minPaise) {
    position = "BELOW";
    const belowPercent = Math.abs(deltaPercent);
    statusMessage = `Quoted rate of ₹${quotedRupees} is below the estimated market range of ₹${minRupees} – ₹${maxRupees} (${belowPercent}% below benchmark midpoint).`;
  } else if (safeQuoted > output.maxPaise) {
    position = "ABOVE";
    statusMessage = `Quoted rate of ₹${quotedRupees} is above the estimated market range of ₹${minRupees} – ₹${maxRupees} (${deltaPercent}% above benchmark midpoint).`;
  } else {
    position = "WITHIN";
    statusMessage = `Quoted rate of ₹${quotedRupees} is within the estimated market range of ₹${minRupees} – ₹${maxRupees}.`;
  }

  return {
    position,
    quotedRatePaise: safeQuoted,
    minPaise: output.minPaise,
    maxPaise: output.maxPaise,
    deltaPaise,
    deltaBps,
    deltaPercent,
    statusMessage,
  };
}
