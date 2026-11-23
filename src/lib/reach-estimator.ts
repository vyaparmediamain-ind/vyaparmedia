/**
 * Reach and Expected Views Estimator (Pure Function Engine)
 *
 * Provides realistic, statistical expected view projections for influencer marketing deliverables.
 * Replaces the flawed legacy formula that conflated engagement rate with view rate.
 *
 * STRICT REQUIREMENTS:
 * - Pure logic: no DB (Prisma), no network (fetch), no non-deterministic side-effects.
 * - Platform & content-type specific reach-rate bands (documented as ASSUMPTIONS).
 * - Multi-tier scaling (micro vs mid vs macro creator audience distribution dynamics).
 * - Real historical delivery blending only from API-verified snapshots (>= 3 deals).
 * - Sane bounds clamping: minimum 10 views, low <= mid <= high.
 */

export type ReachPlatform = "INSTAGRAM" | "YOUTUBE";
export type ReachContentType = "REEL" | "POST" | "STORY" | "VIDEO" | "SHORT";

/**
 * Reach-rate bands in Basis Points (100 bps = 1.00%).
 *
 * ASSUMPTIONS & INDUSTRY BENCHMARKS:
 * 1. Instagram Reels: Algorithmic distribution delivers 12% - 35% views relative to authentic followers.
 * 2. Instagram Feed Posts / Carousels: Home-feed distribution delivers 6% - 20% views.
 * 3. Instagram Stories: Ephemeral 24h decay delivers 3% - 10% views.
 * 4. YouTube Long-form Videos: Steady search/browse discovery delivers 8% - 30% views.
 * 5. YouTube Shorts: Feed discovery delivers 15% - 55% views.
 *
 * Tunable by administrators in future releases via configuration tables.
 */
export const PLATFORM_REACH_RATE_BANDS: Record<
  ReachPlatform,
  Partial<Record<ReachContentType, { lowBps: number; midBps: number; highBps: number }>>
> = {
  INSTAGRAM: {
    REEL: { lowBps: 1200, midBps: 2000, highBps: 3500 }, // 12% - 20% - 35%
    POST: { lowBps: 600, midBps: 1200, highBps: 2000 },  // 6% - 12% - 20%
    STORY: { lowBps: 300, midBps: 600, highBps: 1000 },  // 3% - 6% - 10%
  },
  YOUTUBE: {
    VIDEO: { lowBps: 800, midBps: 1600, highBps: 3000 }, // 8% - 16% - 30%
    SHORT: { lowBps: 1500, midBps: 2800, highBps: 5500 }, // 15% - 28% - 55%
  },
};

/** Default fallback band when platform/contentType are not specified (e.g. general matching) */
export const DEFAULT_REACH_RATE_BAND = {
  lowBps: 1000, // 10.0%
  midBps: 1800, // 18.0%
  highBps: 3200, // 32.0%
};

export interface ReachHistoryItem {
  views: number;
  isEstimated: boolean;
  metricsQuality?: { views?: string } | null;
}

export interface EstimateExpectedViewsInput {
  platform?: ReachPlatform | string | null;
  contentType?: ReachContentType | string | null;
  followers: number;
  authenticityScore: number; // 0 - 100
  engagementRateBps: number; // basis points (e.g. 250 = 2.50%)
  history?: ReachHistoryItem[] | null;
  customBands?: Partial<
    Record<
      ReachPlatform,
      Partial<Record<ReachContentType, { lowBps: number; midBps: number; highBps: number }>>
    >
  > | null;
}

export interface ExpectedViewsResult {
  low: number;
  mid: number;
  high: number;
  dataQuality: "VERIFIED" | "ESTIMATED";
}

/**
 * Normalizes input platform and content type to typed definitions
 */
function resolveBand(
  platform?: string | null,
  contentType?: string | null,
  customBands?: Partial<
    Record<
      ReachPlatform,
      Partial<Record<ReachContentType, { lowBps: number; midBps: number; highBps: number }>>
    >
  > | null
): { lowBps: number; midBps: number; highBps: number } {
  const normPlatform = (platform || "").trim().toUpperCase() as ReachPlatform;
  const normContent = (contentType || "").trim().toUpperCase() as ReachContentType;

  const bands = customBands || PLATFORM_REACH_RATE_BANDS;

  if (normPlatform === "YOUTUBE") {
    if (normContent.includes("SHORT")) {
      return (
        bands.YOUTUBE?.SHORT ||
        PLATFORM_REACH_RATE_BANDS.YOUTUBE.SHORT ||
        DEFAULT_REACH_RATE_BAND
      );
    }
    return (
      bands.YOUTUBE?.VIDEO ||
      PLATFORM_REACH_RATE_BANDS.YOUTUBE.VIDEO ||
      DEFAULT_REACH_RATE_BAND
    );
  }

  if (normPlatform === "INSTAGRAM") {
    if (normContent.includes("STORY")) {
      return (
        bands.INSTAGRAM?.STORY ||
        PLATFORM_REACH_RATE_BANDS.INSTAGRAM.STORY ||
        DEFAULT_REACH_RATE_BAND
      );
    }
    if (normContent.includes("POST") || normContent.includes("CAROUSEL")) {
      return (
        bands.INSTAGRAM?.POST ||
        PLATFORM_REACH_RATE_BANDS.INSTAGRAM.POST ||
        DEFAULT_REACH_RATE_BAND
      );
    }
    return (
      bands.INSTAGRAM?.REEL ||
      PLATFORM_REACH_RATE_BANDS.INSTAGRAM.REEL ||
      DEFAULT_REACH_RATE_BAND
    );
  }

  // Generic fallback if unknown
  return DEFAULT_REACH_RATE_BAND;
}

/**
 * Calculates creator follower tier adjustment multiplier.
 * Smaller creators typically achieve higher organic reach percentages due to tight-knit communities.
 */
function calculateTierMultiplier(followers: number): number {
  if (followers <= 15000) return 1.25; // Micro tier boost
  if (followers <= 75000) return 1.05; // Mid tier standard
  if (followers <= 250000) return 0.90; // Macro tier dilution
  return 0.80; // Mega tier high-dilution
}

/**
 * Calculates engagement rate adjustment multiplier.
 * Content with higher engagement rates signals platform algorithms to expand reach.
 * Benchmark = 250 bps (2.50%).
 */
function calculateErMultiplier(engagementRateBps: number): number {
  const safeErBps = Math.max(0, engagementRateBps);
  // Clamped between 0.70x and 1.50x
  return Math.max(0.70, Math.min(1.50, 0.80 + (safeErBps / 250) * 0.20));
}

/**
 * Estimates expected deliverable views.
 * Blends heuristic reach-rate bands with verified historical deliveries if >= 3 valid deals exist.
 */
export function estimateExpectedViews(input: EstimateExpectedViewsInput): ExpectedViewsResult {
  const safeFollowers = Math.max(0, input.followers || 0);
  const safeAuthenticity = Math.max(10, Math.min(100, Number.isFinite(input.authenticityScore) ? input.authenticityScore : 75));
  const safeErBps = Math.max(0, input.engagementRateBps || 0);

  // 1. Calculate authentic audience base
  const authenticFollowers = safeFollowers * (safeAuthenticity / 100);

  // 2. Select appropriate platform / content-type reach band
  const band = resolveBand(input.platform, input.contentType, input.customBands);

  // 3. Apply audience tier and engagement rate multipliers
  const tierMultiplier = calculateTierMultiplier(safeFollowers);
  const erMultiplier = calculateErMultiplier(safeErBps);
  const combinedMultiplier = tierMultiplier * erMultiplier;

  // 4. Compute baseline heuristic range
  const rawLow = authenticFollowers * (band.lowBps / 10000) * combinedMultiplier;
  const rawMid = authenticFollowers * (band.midBps / 10000) * combinedMultiplier;
  const rawHigh = authenticFollowers * (band.highBps / 10000) * combinedMultiplier;

  // 5. Check historical deliveries (STRICT QUALITY: must be verified API snapshots)
  const validHistory = (input.history || []).filter(
    (h) => h.views > 0 && !h.isEstimated && (!h.metricsQuality || h.metricsQuality.views === "API")
  );

  let low: number;
  let mid: number;
  let high: number;
  let dataQuality: "VERIFIED" | "ESTIMATED" = "ESTIMATED";

  if (validHistory.length >= 3) {
    // Sort views ascending to compute median
    const sortedViews = validHistory.map((h) => h.views).sort((a, b) => a - b);
    const midIdx = Math.floor(sortedViews.length / 2);
    const historicalMedian =
      sortedViews.length % 2 === 0
        ? ((sortedViews[midIdx - 1] ?? (sortedViews[midIdx] ?? 0)) + (sortedViews[midIdx] ?? 0)) / 2
        : (sortedViews[midIdx] ?? 0);

    // 60% historical delivery weight + 40% heuristic estimate weight
    mid = Math.round(0.60 * historicalMedian + 0.40 * rawMid);
    low = Math.round(0.60 * (historicalMedian * 0.75) + 0.40 * rawLow);
    high = Math.round(0.60 * (historicalMedian * 1.35) + 0.40 * rawHigh);
    dataQuality = "VERIFIED";
  } else {
    low = Math.round(rawLow);
    mid = Math.round(rawMid);
    high = Math.round(rawHigh);
    dataQuality = "ESTIMATED";
  }

  // 6. Enforce sane floor and ordering bounds: low <= mid <= high, never below 10
  const clampedLow = Math.max(10, low);
  const clampedMid = Math.max(clampedLow, mid);
  const clampedHigh = Math.max(clampedMid, high);

  return {
    low: clampedLow,
    mid: clampedMid,
    high: clampedHigh,
    dataQuality,
  };
}
