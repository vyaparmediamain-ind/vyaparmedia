/**
 * Creator Metrics Service (P11 REL-07 / Architectural Standard)
 *
 * Captures historical weekly metric snapshots for platform creators across YouTube and Instagram.
 *
 * Strict Compliance:
 * 1. Correctness: Rates in basis points; round once with Math.round; pure math extracted to metric-stats.ts.
 * 2. Ground Truth Views: Never invent views. If insights unavailable, avgViews = null with viewsQuality = UNAVAILABLE.
 * 3. Security & Resilience: Gated by kill switches, circuit breakers, and YouTube quota checkAndConsumeYouTubeQuota.
 * 4. Idempotency: ISO week bounded deduplication per platform.
 * 5. Retention: 12-month rolling retention; batched pruning of stale historical records.
 */

import prisma from "@/lib/db";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { isKillSwitchActive, KILL_SWITCH_FEATURES } from "@/lib/kill-switch";
import { isFeatureEnabled, FEATURE_FLAGS } from "@/lib/feature-flags";
import {
  getFreshInstagramAccessToken,
  getInstagramProfile,
  getRecentPosts,
  getRecentPostsWithInsights,
  instagramCapabilities,
} from "@/lib/instagram";
import {
  getFreshYouTubeAccessToken,
  getYouTubeChannelByToken,
  getRecentVideos,
  checkAndConsumeYouTubeQuota,
} from "@/lib/youtube";
import {
  trimmedMean,
  engagementRateBps,
  detectMetricAnomalies,
  getIsoWeekBounds,
  type AnomalyFlag,
  type MetricSnapshotHistoricalReference,
} from "@/lib/metric-stats";
import {
  MetricPlatform,
  MetricViewsQuality,
  Prisma,
  type CreatorMetricSnapshot,
} from "@prisma/client";

// ─── Constants & Configuration ───────────────────────────────────────────────

export const CREATOR_METRICS_CONFIG = {
  /** Maximum number of public videos or posts to sample per capture */
  SAMPLE_LIMIT: 12,
  /** YouTube quota units required for channel + playlistItems + video stats */
  YOUTUBE_QUOTA_UNITS: 2,
  /** Batch size for cursor pagination in cron cadence */
  CURSOR_BATCH_SIZE: 50,
  /** Retention window: 365 days (12 calendar months) */
  RETENTION_DAYS: 365,
  /** Maximum deletion batch size during retention cleanup */
  PRUNE_BATCH_SIZE: 500,
} as const;

export interface CreatorCaptureOptions {
  /** If true, bypasses ISO week deduplication (e.g. for manual admin refresh) */
  force?: boolean;
  /** Injected clock for deterministic unit testing */
  clock?: Date;
}

export interface PlatformCaptureResult {
  platform: MetricPlatform;
  captured: boolean;
  skippedReason?: string;
  snapshot?: CreatorMetricSnapshot;
  anomalies?: AnomalyFlag[];
}

export interface CreatorMetricsCaptureResult {
  influencerId: string;
  youtube?: PlatformCaptureResult;
  instagram?: PlatformCaptureResult;
}

export interface CadenceBatchSummary {
  totalEvaluated: number;
  processed: number;
  skippedNoHealthyAccount: number;
  skippedCadenceJitter: number;
  skippedAlreadyCapturedThisWeek: number;
  capturedSnapshots: number;
  prunedSnapshots: number;
}

// ─── Service Implementation ──────────────────────────────────────────────────

export class CreatorMetricsService {
  /**
   * Deterministically calculates a creator's assigned cadence day of the week (0 = Sun, 1 = Mon ... 6 = Sat).
   * Spreads execution evenly across the 7 days of the week to avoid bursting social API rate limits.
   */
  public static getCreatorCadenceDay(influencerId: string): number {
    let hash = 0;
    for (let i = 0; i < influencerId.length; i++) {
      hash = (hash << 5) - hash + influencerId.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % 7;
  }

  /**
   * Captures metric snapshots for an influencer across all connected and healthy platforms.
   * Idempotent per ISO week unless options.force is true.
   */
  public static async captureForInfluencer(
    influencerId: string,
    options?: CreatorCaptureOptions,
  ): Promise<CreatorMetricsCaptureResult> {
    const clock = options?.clock ?? new Date();

    const influencer = await prisma.influencerProfile.findUnique({
      where: { id: influencerId },
      select: {
        id: true,
        userId: true,
        instagramHandle: true,
        youtubeHandle: true,
        instagramFollowers: true,
        youtubeSubscribers: true,
      },
    });

    if (!influencer) {
      throw AppError.notFound("Influencer profile not found");
    }

    // Check existing snapshots in this ISO week for deduplication
    const { start: weekStart, end: weekEnd } = getIsoWeekBounds(clock);
    const weeklySnapshots = await prisma.creatorMetricSnapshot.findMany({
      where: {
        influencerId: influencer.id,
        capturedAt: { gte: weekStart, lte: weekEnd },
      },
      select: { platform: true },
    });
    const capturedPlatformsThisWeek = new Set(weeklySnapshots.map((s) => s.platform));

    const result: CreatorMetricsCaptureResult = { influencerId };

    // Execute platform captures independently with fault isolation
    const [ytResult, igResult] = await Promise.all([
      this.captureYouTube(influencer, capturedPlatformsThisWeek, options?.force, clock),
      this.captureInstagram(influencer, capturedPlatformsThisWeek, options?.force, clock),
    ]);

    result.youtube = ytResult;
    result.instagram = igResult;

    // Trigger Fair Price recompute asynchronously if new metrics were captured
    if (ytResult.captured || igResult.captured) {
      try {
        const { FairPriceService } = await import("@/services/fair-price.service");
        await FairPriceService.evaluateInfluencer(influencerId, { forceRecompute: false, clock });
      } catch (pricingErr) {
        logger.warn("[CreatorMetrics] Post-capture fair price evaluation deferred or failed", {
          influencerId,
          error: pricingErr instanceof Error ? pricingErr.message : String(pricingErr),
        });
      }
    }

    return result;
  }

  // ─── YouTube Capture Subroutine ────────────────────────────────────────────

  private static async captureYouTube(
    influencer: {
      id: string;
      userId: string;
      youtubeHandle?: string | null;
      youtubeSubscribers?: number | null;
    },
    capturedPlatformsThisWeek: Set<MetricPlatform>,
    force?: boolean,
    clock: Date = new Date(),
  ): Promise<PlatformCaptureResult> {
    if (!force && capturedPlatformsThisWeek.has(MetricPlatform.YOUTUBE)) {
      return { platform: MetricPlatform.YOUTUBE, captured: false, skippedReason: "ALREADY_CAPTURED_THIS_WEEK" };
    }

    if (await isKillSwitchActive(KILL_SWITCH_FEATURES.SOCIAL_YOUTUBE)) {
      logger.warn("YouTube metrics capture skipped: kill switch active", { influencerId: influencer.id });
      return { platform: MetricPlatform.YOUTUBE, captured: false, skippedReason: "KILL_SWITCH_ACTIVE" };
    }

    const token = await getFreshYouTubeAccessToken(influencer.userId);
    if (!token) {
      return { platform: MetricPlatform.YOUTUBE, captured: false, skippedReason: "NO_HEALTHY_OAUTH_TOKEN" };
    }

    const quota = await checkAndConsumeYouTubeQuota(CREATOR_METRICS_CONFIG.YOUTUBE_QUOTA_UNITS, "standard");
    if (!quota.allowed) {
      logger.warn("YouTube metrics capture skipped: daily API quota exhausted", { influencerId: influencer.id });
      return { platform: MetricPlatform.YOUTUBE, captured: false, skippedReason: "QUOTA_EXHAUSTED" };
    }

    try {
      const channel = await getYouTubeChannelByToken(token);
      const subscribers =
        channel?.subscriberCount && channel.subscriberCount > 0
          ? channel.subscriberCount
          : (influencer.youtubeSubscribers ?? 0);

      const channelId = channel?.id;
      if (!channelId) {
        return { platform: MetricPlatform.YOUTUBE, captured: false, skippedReason: "CHANNEL_NOT_FOUND" };
      }

      const rawVideos = await getRecentVideos(channelId, CREATOR_METRICS_CONFIG.SAMPLE_LIMIT, token);
      const publicVideos = rawVideos.filter((v) => !v.privacyStatus || v.privacyStatus === "public");

      if (publicVideos.length === 0) {
        return { platform: MetricPlatform.YOUTUBE, captured: false, skippedReason: "NO_PUBLIC_VIDEOS" };
      }

      const viewsList = publicVideos.map((v) => v.viewCount);
      const likesList = publicVideos.map((v) => v.likeCount);
      const commentsList = publicVideos.map((v) => v.commentCount);

      const avgViews = trimmedMean(viewsList);
      const avgLikes = trimmedMean(likesList);
      const avgComments = trimmedMean(commentsList);
      const totalInteractions = (avgLikes ?? 0) + (avgComments ?? 0);
      const erBps = engagementRateBps({ interactions: totalInteractions, audience: subscribers });

      const prevSnapshot = await prisma.creatorMetricSnapshot.findFirst({
        where: { influencerId: influencer.id, platform: MetricPlatform.YOUTUBE },
        orderBy: { capturedAt: "desc" },
      });

      const historicalRef: MetricSnapshotHistoricalReference | null = prevSnapshot
        ? {
            followers: prevSnapshot.followers,
            engagementRateBps: prevSnapshot.engagementRateBps,
            capturedAt: prevSnapshot.capturedAt,
          }
        : null;

      const anomalies = detectMetricAnomalies({
        followers: subscribers,
        avgLikes,
        avgViews,
        engagementRateBps: erBps,
        capturedAt: clock,
        previousSnapshot: historicalRef,
      });

      const snapshot = await prisma.creatorMetricSnapshot.create({
        data: {
          influencerId: influencer.id,
          platform: MetricPlatform.YOUTUBE,
          capturedAt: clock,
          followers: subscribers,
          avgLikes,
          avgComments,
          avgViews,
          avgReach: null,
          engagementRateBps: erBps,
          postsSampled: publicVideos.length,
          viewsQuality: MetricViewsQuality.API,
          ...(anomalies.length > 0 ? { flagsJson: anomalies as unknown as Prisma.InputJsonValue } : {}),
        },
      });

      return { platform: MetricPlatform.YOUTUBE, captured: true, snapshot, anomalies };
    } catch (err) {
      logger.error("YouTube metric snapshot failed", {
        influencerId: influencer.id,
        error: err instanceof Error ? err.message : String(err),
      });
      return { platform: MetricPlatform.YOUTUBE, captured: false, skippedReason: "API_ERROR" };
    }
  }

  // ─── Instagram Capture Subroutine ──────────────────────────────────────────

  private static async captureInstagram(
    influencer: {
      id: string;
      userId: string;
      instagramHandle?: string | null;
      instagramFollowers?: number | null;
    },
    capturedPlatformsThisWeek: Set<MetricPlatform>,
    force?: boolean,
    clock: Date = new Date(),
  ): Promise<PlatformCaptureResult> {
    if (!force && capturedPlatformsThisWeek.has(MetricPlatform.INSTAGRAM)) {
      return { platform: MetricPlatform.INSTAGRAM, captured: false, skippedReason: "ALREADY_CAPTURED_THIS_WEEK" };
    }

    if (await isKillSwitchActive(KILL_SWITCH_FEATURES.SOCIAL_INSTAGRAM)) {
      logger.warn("Instagram metrics capture skipped: kill switch active", { influencerId: influencer.id });
      return { platform: MetricPlatform.INSTAGRAM, captured: false, skippedReason: "KILL_SWITCH_ACTIVE" };
    }

    const token = await getFreshInstagramAccessToken(influencer.userId);
    if (!token) {
      return { platform: MetricPlatform.INSTAGRAM, captured: false, skippedReason: "NO_HEALTHY_OAUTH_TOKEN" };
    }

    const oauth = await prisma.oAuthAccount.findFirst({
      where: { userId: influencer.userId, provider: "instagram" },
      select: { scope: true, grantedScopes: true, accessToken: true },
    });
    const caps = instagramCapabilities(oauth);
    if (caps.needsReconnect) {
      return { platform: MetricPlatform.INSTAGRAM, captured: false, skippedReason: "NEEDS_RECONNECT" };
    }

    try {
      const igProfile = await getInstagramProfile(token);
      const followers = igProfile?.followersCount ?? influencer.instagramFollowers ?? 0;

      const isInsightsFlagOn = await isFeatureEnabled(FEATURE_FLAGS.INSTAGRAM_INSIGHTS, {
        userId: influencer.userId,
        role: "INFLUENCER",
      });

      const canUseInsightsApi = isInsightsFlagOn && caps.insights;

      let avgLikes: number | null = null;
      let avgComments: number | null = null;
      let avgViews: number | null = null;
      let avgReach: number | null = null;
      let postsSampled = 0;
      let viewsQuality: MetricViewsQuality = MetricViewsQuality.UNAVAILABLE;

      if (canUseInsightsApi) {
        const postsWithInsights = await getRecentPostsWithInsights(token, CREATOR_METRICS_CONFIG.SAMPLE_LIMIT);
        postsSampled = postsWithInsights.length;

        if (postsSampled > 0) {
          const likes = postsWithInsights.map((p) => p.insights?.likes ?? p.post.likeCount);
          const comments = postsWithInsights.map((p) => p.insights?.comments ?? p.post.commentsCount);
          const views = postsWithInsights
            .map((p) => p.insights?.views)
            .filter((v): v is number => typeof v === "number" && v >= 0);
          const reach = postsWithInsights
            .map((p) => p.insights?.reach)
            .filter((r): r is number => typeof r === "number" && r >= 0);

          avgLikes = trimmedMean(likes);
          avgComments = trimmedMean(comments);
          avgViews = views.length > 0 ? trimmedMean(views) : null;
          avgReach = reach.length > 0 ? trimmedMean(reach) : null;
          viewsQuality = avgViews !== null ? MetricViewsQuality.API : MetricViewsQuality.UNAVAILABLE;
        }
      } else {
        const rawPosts = await getRecentPosts(token, CREATOR_METRICS_CONFIG.SAMPLE_LIMIT);
        postsSampled = rawPosts.length;

        if (postsSampled > 0) {
          avgLikes = trimmedMean(rawPosts.map((p) => p.likeCount));
          avgComments = trimmedMean(rawPosts.map((p) => p.commentsCount));
          avgViews = null;
          avgReach = null;
          viewsQuality = MetricViewsQuality.UNAVAILABLE;
        }
      }

      if (postsSampled === 0) {
        return { platform: MetricPlatform.INSTAGRAM, captured: false, skippedReason: "NO_POSTS_FOUND" };
      }

      const totalInteractions = (avgLikes ?? 0) + (avgComments ?? 0);
      const erBps = engagementRateBps({ interactions: totalInteractions, audience: followers });

      const prevSnapshot = await prisma.creatorMetricSnapshot.findFirst({
        where: { influencerId: influencer.id, platform: MetricPlatform.INSTAGRAM },
        orderBy: { capturedAt: "desc" },
      });

      const historicalRef: MetricSnapshotHistoricalReference | null = prevSnapshot
        ? {
            followers: prevSnapshot.followers,
            engagementRateBps: prevSnapshot.engagementRateBps,
            capturedAt: prevSnapshot.capturedAt,
          }
        : null;

      const anomalies = detectMetricAnomalies({
        followers,
        avgLikes,
        avgViews,
        engagementRateBps: erBps,
        capturedAt: clock,
        previousSnapshot: historicalRef,
      });

      const snapshot = await prisma.creatorMetricSnapshot.create({
        data: {
          influencerId: influencer.id,
          platform: MetricPlatform.INSTAGRAM,
          capturedAt: clock,
          followers,
          avgLikes,
          avgComments,
          avgViews,
          avgReach,
          engagementRateBps: erBps,
          postsSampled,
          viewsQuality,
          ...(anomalies.length > 0 ? { flagsJson: anomalies as unknown as Prisma.InputJsonValue } : {}),
        },
      });

      return { platform: MetricPlatform.INSTAGRAM, captured: true, snapshot, anomalies };
    } catch (err) {
      logger.error("Instagram metric snapshot failed", {
        influencerId: influencer.id,
        error: err instanceof Error ? err.message : String(err),
      });
      return { platform: MetricPlatform.INSTAGRAM, captured: false, skippedReason: "API_ERROR" };
    }
  }

  // ─── Cron Batch Runner with Jitter & Deduplication ─────────────────────────

  /**
   * Executes a cursor-batched cadence run.
   * - Evaluates creators due on their weekly cadence day (hash-jittered).
   * - Skips creators without healthy connected accounts.
   * - Ensures ISO week idempotency.
   * - Prunes historical records older than 12 months in batches.
   */
  public static async runWeeklyCadenceBatch(options?: {
    clock?: Date;
    batchSize?: number;
    maxInfluencers?: number;
  }): Promise<CadenceBatchSummary> {
    const clock = options?.clock ?? new Date();
    const batchSize = options?.batchSize ?? CREATOR_METRICS_CONFIG.CURSOR_BATCH_SIZE;
    const maxToProcess = options?.maxInfluencers ?? 1000;
    const currentDayOfWeek = clock.getUTCDay();

    const summary: CadenceBatchSummary = {
      totalEvaluated: 0,
      processed: 0,
      skippedNoHealthyAccount: 0,
      skippedCadenceJitter: 0,
      skippedAlreadyCapturedThisWeek: 0,
      capturedSnapshots: 0,
      prunedSnapshots: 0,
    };

    let cursorId: string | undefined = undefined;
    let hasMore = true;

    while (hasMore && summary.processed < maxToProcess) {
      type InfluencerBatchItem = {
        id: string;
        userId: string;
        user: {
          oauthAccounts: Array<{
            provider: string;
            accessToken: string | null;
            refreshToken: string | null;
            scope: string | null;
          }>;
        };
      };

      const influencers: InfluencerBatchItem[] = await prisma.influencerProfile.findMany({
        take: batchSize,
        skip: cursorId ? 1 : 0,
        orderBy: { id: "asc" },
        select: {
          id: true,
          userId: true,
          user: {
            select: {
              oauthAccounts: {
                select: {
                  provider: true,
                  accessToken: true,
                  refreshToken: true,
                  scope: true,
                },
              },
            },
          },
        },
        ...(cursorId ? { cursor: { id: cursorId } } : {}),
      });

      if (influencers.length === 0) {
        break;
      }

      for (const inf of influencers) {
        summary.totalEvaluated++;
        cursorId = inf.id;

        // 1. Health check: Does creator possess at least one healthy connected OAuth account?
        const oauths = inf.user.oauthAccounts;
        const hasHealthyIg = oauths.some(
          (o) => o.provider === "instagram" && Boolean(o.accessToken) && o.scope !== "NEEDS_RECONNECT",
        );
        const hasHealthyYt = oauths.some(
          (o) =>
            (o.provider === "youtube" || o.provider === "google") &&
            Boolean(o.refreshToken) &&
            o.scope !== "NEEDS_RECONNECT",
        );

        if (!hasHealthyIg && !hasHealthyYt) {
          summary.skippedNoHealthyAccount++;
          continue;
        }

        // 2. Weekly Cadence with Hash Jitter: Evaluate if today is the creator's assigned sampling day
        const assignedDay = this.getCreatorCadenceDay(inf.id);
        const isAssignedDay = assignedDay === currentDayOfWeek;

        if (!isAssignedDay) {
          // If not assigned day, check if creator has been captured in the last 7 days; if so, skip today
          const sevenDaysAgo = new Date(clock.getTime() - 7 * 24 * 60 * 60 * 1000);
          const recentSnapshot = await prisma.creatorMetricSnapshot.findFirst({
            where: { influencerId: inf.id, capturedAt: { gte: sevenDaysAgo } },
            select: { id: true },
          });

          if (recentSnapshot) {
            summary.skippedCadenceJitter++;
            continue;
          }
        }

        // 3. ISO Week Idempotency: Has this creator already been captured across all healthy accounts this week?
        const { start: weekStart, end: weekEnd } = getIsoWeekBounds(clock);
        const existingThisWeek = await prisma.creatorMetricSnapshot.findMany({
          where: { influencerId: inf.id, capturedAt: { gte: weekStart, lte: weekEnd } },
          select: { platform: true },
        });

        const capturedThisWeek = new Set(existingThisWeek.map((s) => s.platform));
        const neededIg = hasHealthyIg && !capturedThisWeek.has(MetricPlatform.INSTAGRAM);
        const neededYt = hasHealthyYt && !capturedThisWeek.has(MetricPlatform.YOUTUBE);

        if (!neededIg && !neededYt) {
          summary.skippedAlreadyCapturedThisWeek++;
          continue;
        }

        // 4. Capture metrics for the creator
        const captureResult = await this.captureForInfluencer(inf.id, { clock });
        summary.processed++;

        if (captureResult.youtube?.captured) summary.capturedSnapshots++;
        if (captureResult.instagram?.captured) summary.capturedSnapshots++;

        if (summary.processed >= maxToProcess) break;
      }

      if (influencers.length < batchSize) {
        hasMore = false;
      }
    }

    // 5. 12-Month Retention Pruning in Batches
    const cutoffDate = new Date(
      clock.getTime() - CREATOR_METRICS_CONFIG.RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );
    summary.prunedSnapshots = await this.pruneOldSnapshots(cutoffDate);

    logger.info(
      "Creator metrics weekly cadence batch completed",
      summary as unknown as Record<string, unknown>,
    );
    return summary;
  }

  // ─── Retention Pruning Subroutine ──────────────────────────────────────────

  /**
   * Deletes historical snapshots older than cutoffDate in batches of PRUNE_BATCH_SIZE.
   * Returns the total count of pruned records.
   */
  public static async pruneOldSnapshots(
    cutoffDate: Date,
    batchSize: number = CREATOR_METRICS_CONFIG.PRUNE_BATCH_SIZE,
  ): Promise<number> {
    let totalPruned = 0;

    while (true) {
      const stale = await prisma.creatorMetricSnapshot.findMany({
        where: { capturedAt: { lt: cutoffDate } },
        select: { id: true },
        take: batchSize,
      });

      if (stale.length === 0) {
        break;
      }

      const ids = stale.map((s) => s.id);
      const deleteResult = await prisma.creatorMetricSnapshot.deleteMany({
        where: { id: { in: ids } },
      });

      totalPruned += deleteResult.count;

      if (stale.length < batchSize) {
        break;
      }
    }

    return totalPruned;
  }
}
