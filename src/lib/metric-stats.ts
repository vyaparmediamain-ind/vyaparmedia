/**
 * Pure Mathematical & Anomaly Detection Helpers for Creator Metrics
 *
 * Strict Architectural Standards:
 * - Pure logic: No database, fetch, or implicit Date.now(). Inject clock for testability.
 * - Rates in basis points (1% = 100 bps). Round once with Math.round.
 * - Anomaly detection flags only: passive audit markers, no automatic punitive action.
 */

// ─── Configuration & Thresholds ──────────────────────────────────────────────

export const METRIC_ANOMALY_THRESHOLDS = {
  /** Follower spike threshold: > 20% growth within 7-day rolling window */
  FOLLOWER_SPIKE_PERCENT_7D: 20,
  /** Engagement rate collapse: >= 50% decline relative to prior benchmark snapshot */
  ER_COLLAPSE_DROP_PERCENT: 50,
  /** Abnormal likes / followers: ratio > 40% suggests inorganic engagement */
  ABNORMAL_LIKE_FOLLOWER_RATIO_MAX_PERCENT: 40,
  /** Abnormal likes / followers: ratio < 0.05% suggests inactive/ghost followers */
  ABNORMAL_LIKE_FOLLOWER_RATIO_MIN_PERCENT: 0.05,
  /** Minimum audience threshold to evaluate like-to-follower ratio anomalies */
  MIN_AUDIENCE_FOR_RATIO_CHECK: 1000,
  /** Default percentage trimmed on both tails (10% = 0.10) */
  DEFAULT_TRIM_RATIO: 0.1,
} as const;

export type AnomalyRuleName =
  | "FOLLOWER_SPIKE_7D"
  | "ER_COLLAPSE"
  | "ABNORMAL_LIKES_RATIO";

export type AnomalySeverity = "LOW" | "MEDIUM" | "HIGH";

export interface AnomalyFlag {
  rule: AnomalyRuleName;
  severity: AnomalySeverity;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface MetricSnapshotHistoricalReference {
  followers: number;
  engagementRateBps?: number | null;
  capturedAt: Date;
}

export interface AnomalyDetectionInput {
  followers: number;
  avgLikes?: number | null;
  avgViews?: number | null;
  engagementRateBps?: number | null;
  capturedAt?: Date;
  previousSnapshot?: MetricSnapshotHistoricalReference | null;
}

// ─── Pure Math & Statistical Helpers ─────────────────────────────────────────

/**
 * Calculates the trimmed mean of an array of numeric values.
 * Drops the highest and lowest `trimRatio` proportion of values to eliminate outliers.
 * Returns null if the array contains no finite non-negative numbers.
 *
 * @param values Array of numbers (e.g. view counts, likes, comments)
 * @param trimRatio Proportion of values to trim from EACH end (default 0.1 = 10% each side)
 * @returns Rounded integer mean, or null if input is empty
 */
export function trimmedMean(
  values: readonly number[],
  trimRatio: number = METRIC_ANOMALY_THRESHOLDS.DEFAULT_TRIM_RATIO,
): number | null {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }

  // Filter valid finite non-negative numbers
  const valid = values.filter((n) => typeof n === "number" && Number.isFinite(n) && n >= 0);
  if (valid.length === 0) {
    return null;
  }

  if (valid.length <= 2) {
    const sum = valid.reduce((acc, curr) => acc + curr, 0);
    return Math.round(sum / valid.length);
  }

  // Sort ascending
  const sorted = [...valid].sort((a, b) => a - b);
  const clampedRatio = Math.max(0, Math.min(0.49, trimRatio));
  const trimCount = Math.floor(sorted.length * clampedRatio);

  // If trimCount would empty or leave <= 0 items, adjust
  const sliceStart = trimCount;
  const sliceEnd = sorted.length - trimCount;
  const sliced = sorted.slice(sliceStart, sliceEnd > sliceStart ? sliceEnd : sliceStart + 1);

  if (sliced.length === 0) {
    return Math.round(sorted[Math.floor(sorted.length / 2)] ?? 0);
  }

  const sum = sliced.reduce((acc, curr) => acc + curr, 0);
  return Math.round(sum / sliced.length);
}

/**
 * Calculates the median of an array of numeric values.
 * Returns null if the array contains no finite non-negative numbers.
 */
export function median(values: readonly number[]): number | null {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }

  const valid = values.filter((n) => typeof n === "number" && Number.isFinite(n) && n >= 0);
  if (valid.length === 0) {
    return null;
  }

  const sorted = [...valid].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 !== 0) {
    return sorted[mid] ?? null;
  }

  const low = sorted[mid - 1] ?? 0;
  const high = sorted[mid] ?? 0;
  return Math.round((low + high) / 2);
}

/**
 * Computes engagement rate in basis points (1% = 100 bps).
 * Formula: Math.round((totalInteractions / audienceCount) * 10,000)
 *
 * @param params Object containing total interactions (likes + comments) and audience count (followers/subscribers)
 * @returns Basis points integer, or 0 if audience/interactions are non-positive
 */
export function engagementRateBps(params: {
  interactions: number;
  audience: number;
}): number {
  const { interactions, audience } = params;

  if (
    typeof interactions !== "number" ||
    !Number.isFinite(interactions) ||
    interactions <= 0 ||
    typeof audience !== "number" ||
    !Number.isFinite(audience) ||
    audience <= 0
  ) {
    return 0;
  }

  const bps = Math.round((interactions / audience) * 10000);
  return Math.max(0, bps);
}

// ─── Pure Anomaly Detection ──────────────────────────────────────────────────

/**
 * Pure anomaly detection function.
 * Evaluates follower velocity, engagement rate shifts, and like-to-follower ratios.
 *
 * Returns passive anomaly flags only — never applies punitive score penalties automatically.
 */
export function detectMetricAnomalies(input: AnomalyDetectionInput): AnomalyFlag[] {
  const flags: AnomalyFlag[] = [];
  const {
    followers,
    avgLikes,
    engagementRateBps: currentErBps,
    capturedAt = new Date(),
    previousSnapshot,
  } = input;

  // 1. Follower Spike Anomaly (> 20% in rolling 7-day window)
  if (previousSnapshot && previousSnapshot.followers > 0) {
    const timeDeltaMs = Math.abs(capturedAt.getTime() - previousSnapshot.capturedAt.getTime());
    const daysDelta = timeDeltaMs / (1000 * 60 * 60 * 24);

    // Evaluate if snapshots are within an 8-day rolling comparison window
    if (daysDelta <= 8 && daysDelta >= 0.1) {
      const growthPercent =
        ((followers - previousSnapshot.followers) / previousSnapshot.followers) * 100;

      if (growthPercent > METRIC_ANOMALY_THRESHOLDS.FOLLOWER_SPIKE_PERCENT_7D) {
        flags.push({
          rule: "FOLLOWER_SPIKE_7D",
          severity: "MEDIUM",
          description: `Follower count increased by ${growthPercent.toFixed(1)}% within ${daysDelta.toFixed(1)} days (threshold: >${METRIC_ANOMALY_THRESHOLDS.FOLLOWER_SPIKE_PERCENT_7D}%)`,
          metadata: {
            growthPercent: Number(growthPercent.toFixed(2)),
            daysDelta: Number(daysDelta.toFixed(2)),
            currentFollowers: followers,
            previousFollowers: previousSnapshot.followers,
          },
        });
      }
    }
  }

  // 2. Engagement Rate Collapse (>= 50% drop compared to previous weekly capture)
  if (
    previousSnapshot &&
    typeof previousSnapshot.engagementRateBps === "number" &&
    previousSnapshot.engagementRateBps > 0 &&
    typeof currentErBps === "number" &&
    currentErBps >= 0
  ) {
    const erDropPercent =
      ((previousSnapshot.engagementRateBps - currentErBps) /
        previousSnapshot.engagementRateBps) *
      100;

    if (erDropPercent >= METRIC_ANOMALY_THRESHOLDS.ER_COLLAPSE_DROP_PERCENT) {
      flags.push({
        rule: "ER_COLLAPSE",
        severity: "MEDIUM",
        description: `Engagement rate collapsed by ${erDropPercent.toFixed(1)}% from ${(previousSnapshot.engagementRateBps / 100).toFixed(2)}% to ${(currentErBps / 100).toFixed(2)}%`,
        metadata: {
          erDropPercent: Number(erDropPercent.toFixed(2)),
          currentErBps,
          previousErBps: previousSnapshot.engagementRateBps,
        },
      });
    }
  }

  // 3. Abnormal Likes / Followers Ratio (For established accounts with >= 1,000 followers)
  if (
    followers >= METRIC_ANOMALY_THRESHOLDS.MIN_AUDIENCE_FOR_RATIO_CHECK &&
    typeof avgLikes === "number" &&
    avgLikes >= 0
  ) {
    const likeFollowerRatioPercent = (avgLikes / followers) * 100;

    if (likeFollowerRatioPercent > METRIC_ANOMALY_THRESHOLDS.ABNORMAL_LIKE_FOLLOWER_RATIO_MAX_PERCENT) {
      flags.push({
        rule: "ABNORMAL_LIKES_RATIO",
        severity: "HIGH",
        description: `Average likes (${avgLikes.toLocaleString("en-IN")}) represent ${likeFollowerRatioPercent.toFixed(1)}% of total followers, exceeding the natural threshold of ${METRIC_ANOMALY_THRESHOLDS.ABNORMAL_LIKE_FOLLOWER_RATIO_MAX_PERCENT}%`,
        metadata: {
          likeFollowerRatioPercent: Number(likeFollowerRatioPercent.toFixed(2)),
          avgLikes,
          followers,
        },
      });
    } else if (
      likeFollowerRatioPercent < METRIC_ANOMALY_THRESHOLDS.ABNORMAL_LIKE_FOLLOWER_RATIO_MIN_PERCENT
    ) {
      flags.push({
        rule: "ABNORMAL_LIKES_RATIO",
        severity: "LOW",
        description: `Average likes (${avgLikes.toLocaleString("en-IN")}) represent only ${likeFollowerRatioPercent.toFixed(3)}% of total followers, indicating potential ghost followers`,
        metadata: {
          likeFollowerRatioPercent: Number(likeFollowerRatioPercent.toFixed(4)),
          avgLikes,
          followers,
        },
      });
    }
  }

  return flags;
}

// ─── ISO Week Date Utilities ─────────────────────────────────────────────────

/**
 * Returns the exact UTC start (Monday 00:00:00.000) and end (Sunday 23:59:59.999) of the ISO week
 * for a given clock timestamp. Pure function.
 */
export function getIsoWeekBounds(clock: Date = new Date()): { start: Date; end: Date } {
  const d = new Date(Date.UTC(clock.getUTCFullYear(), clock.getUTCMonth(), clock.getUTCDate()));
  const day = d.getUTCDay(); // 0 = Sun, 1 = Mon ...
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);

  const start = new Date(d);
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);

  return { start, end };
}

/**
 * Formats a Date as an ISO week string (e.g. "2026-W47"). Pure function.
 */
export function getIsoWeekString(clock: Date = new Date()): string {
  const d = new Date(Date.UTC(clock.getUTCFullYear(), clock.getUTCMonth(), clock.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
