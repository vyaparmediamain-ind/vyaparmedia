/**
 * Engagement Tracker
 * Captures and tracks post engagement metrics at 24h, 48h, and 7d intervals.
 *
 * Spec Part 4 Step 3: Track views, likes, comments, shares, saves
 * and calculate ROI for brands.
 *
 * STRICT RULE-BASED LOGIC ONLY — NO ML.
 */

import prisma from "./db";
import { logger } from "./logger";
import {
  findPostByUrl,
  getFreshInstagramAccessToken,
  getMediaInsights,
  type InstagramMediaInsightsResult,
  type InstagramMediaInsightsValues,
} from "./instagram";
import { verifyYouTubeVideoIsLive } from "./youtube";
import { Prisma } from "@prisma/client";

export type MetricQuality = "API" | "DERIVED" | "UNAVAILABLE";

export interface MetricWithQuality {
  value: number;
  quality: MetricQuality;
}

export interface RatesQuality {
  engagementRate: MetricQuality;
  clickThroughRate: MetricQuality;
}

export interface SnapshotMetricsQuality {
  views: MetricQuality;
  likes: MetricQuality;
  comments: MetricQuality;
  shares: MetricQuality;
  saves: MetricQuality;
  clicks: MetricQuality;
  reach: MetricQuality;
  ratesQuality?: RatesQuality;
}

export interface EngagementMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  engagementRate: number;
  clickThroughRate: number;
  estimatedReach: number;
  metricsQuality?: SnapshotMetricsQuality;
}

export interface EngagementReport {
  dealId: string;
  postUrl: string | null;
  snapshots: {
    interval: string;
    metrics: EngagementMetrics;
    capturedAt: Date;
    /** true when values are rule-based estimates, false when sourced from real API data */
    isEstimated: boolean;
    metricsQuality?: SnapshotMetricsQuality | null;
  }[];
  roi: ROICalculation | null;
  trend: "GROWING" | "STABLE" | "DECLINING" | "INSUFFICIENT_DATA";
  /** true if ANY snapshot in this report is estimated — used to show a UI disclaimer */
  hasEstimatedData: boolean;
}

interface ROICalculation {
  dealAmount: number; // in paise
  costPerView: number; // in paise
  costPerEngagement: number; // in paise
  costPerClick: number; // in paise
  estimatedValue: number; // in paise
  roiPercentage: number; // positive = profit
}

// ==================== PURE METRIC BUILDERS ====================

export function buildInstagramViews(likes: number, comments: number): MetricWithQuality {
  // Instagram Graph API Basic Display / Login does not return media view counts.
  // Until v18+ Insights API is integrated, views are modelled heuristically.
  return {
    value: Math.max(likes * 6, likes + comments),
    quality: "DERIVED",
  };
}

export function buildInstagramShares(likes: number): MetricWithQuality {
  return {
    value: Math.round(likes * 0.05),
    quality: "DERIVED",
  };
}

export function buildInstagramSaves(likes: number): MetricWithQuality {
  return {
    value: Math.round(likes * 0.08),
    quality: "DERIVED",
  };
}

export function buildInstagramClicks(): MetricWithQuality {
  // Instagram does not provide click telemetry without dedicated UTM links.
  // Never fabricate synthetic clicks; store 0 with quality "UNAVAILABLE".
  return {
    value: 0,
    quality: "UNAVAILABLE",
  };
}

export function buildInstagramReach(likes: number): MetricWithQuality {
  return {
    value: Math.round(likes * 4),
    quality: "DERIVED",
  };
}

export function buildYouTubeViews(viewCount: number): MetricWithQuality {
  return {
    value: Math.max(0, viewCount),
    quality: "API",
  };
}

export function buildYouTubeLikes(likeCount: number): MetricWithQuality {
  return {
    value: Math.max(0, likeCount),
    quality: "API",
  };
}

export function buildYouTubeComments(commentCount: number): MetricWithQuality {
  return {
    value: Math.max(0, commentCount),
    quality: "API",
  };
}

export function buildYouTubeShares(likes: number): MetricWithQuality {
  // Public YouTube Data API v3 does not expose share counts without channel analytics scope.
  return {
    value: Math.round(likes * 0.1),
    quality: "DERIVED",
  };
}

export function buildYouTubeSaves(): MetricWithQuality {
  // YouTube public video endpoint does not provide saves.
  return {
    value: 0,
    quality: "UNAVAILABLE",
  };
}

export function buildYouTubeClicks(): MetricWithQuality {
  // YouTube Data API does not provide clicks. Never fabricate; store 0 as UNAVAILABLE.
  return {
    value: 0,
    quality: "UNAVAILABLE",
  };
}

export function buildYouTubeReach(views: number): MetricWithQuality {
  return {
    value: Math.round(views * 0.8),
    quality: "DERIVED",
  };
}

/**
 * Capture engagement metrics for a deal's post at a specific interval.
 */
async function fetchRealYouTubeMetrics(postUrl: string): Promise<EngagementMetrics | null> {
  if (!postUrl.includes("youtube.com") && !postUrl.includes("youtu.be")) {
    return null;
  }
  try {
    const ytResult = await verifyYouTubeVideoIsLive(postUrl);
    if (ytResult.isLive && ytResult.video) {
      const video = ytResult.video;
      const viewsMetric = buildYouTubeViews(video.viewCount);
      const likesMetric = buildYouTubeLikes(video.likeCount);
      const commentsMetric = buildYouTubeComments(video.commentCount);
      const sharesMetric = buildYouTubeShares(likesMetric.value);
      const savesMetric = buildYouTubeSaves();
      const clicksMetric = buildYouTubeClicks();
      const reachMetric = buildYouTubeReach(viewsMetric.value);

      const totalEngagements = likesMetric.value + commentsMetric.value + sharesMetric.value + savesMetric.value;
      const er = viewsMetric.value > 0 ? (totalEngagements / viewsMetric.value) * 100 : 0;
      const ctr = viewsMetric.value > 0 ? (clicksMetric.value / viewsMetric.value) * 100 : 0;

      const erQuality: MetricQuality =
        viewsMetric.quality === "API" &&
        likesMetric.quality === "API" &&
        commentsMetric.quality === "API" &&
        sharesMetric.quality === "API" &&
        savesMetric.quality === "API"
          ? "API"
          : "DERIVED";
      const ctrQuality: MetricQuality =
        clicksMetric.quality === "UNAVAILABLE" ? "UNAVAILABLE" : viewsMetric.quality === "API" ? "API" : "DERIVED";

      return {
        views: viewsMetric.value,
        likes: likesMetric.value,
        comments: commentsMetric.value,
        shares: sharesMetric.value,
        saves: savesMetric.value,
        clicks: clicksMetric.value,
        engagementRate: Math.round(er * 100) / 100,
        clickThroughRate: Math.round(ctr * 100) / 100,
        estimatedReach: reachMetric.value,
        metricsQuality: {
          views: viewsMetric.quality,
          likes: likesMetric.quality,
          comments: commentsMetric.quality,
          shares: sharesMetric.quality,
          saves: savesMetric.quality,
          clicks: clicksMetric.quality,
          reach: reachMetric.quality,
          ratesQuality: {
            engagementRate: erQuality,
            clickThroughRate: ctrQuality,
          },
        },
      };
    }
  } catch (err) {
    logger.error("Error fetching real YouTube stats for engagement capture", err);
  }
  return null;
}

async function fetchRealInstagramMetrics(postUrl: string, userId: string): Promise<EngagementMetrics | null> {
  if (!postUrl.includes("instagram.com")) {
    return null;
  }
  try {
    const decryptedAccessToken = await getFreshInstagramAccessToken(userId);
    if (decryptedAccessToken) {
      const post = await findPostByUrl(decryptedAccessToken, postUrl);
      if (post) {
        // Attempt to fetch media insights
        let insights: InstagramMediaInsightsResult | null = null;
        try {
          insights = await getMediaInsights(decryptedAccessToken, post.id, post.mediaProductType);
        } catch (insightsErr) {
          logger.warn("Failed to fetch Instagram media insights, falling back to derived", {
            postId: post.id,
            error: insightsErr,
          });
        }

        const values = insights?.status === "OK"
          ? insights.values
          : (insights && typeof (insights as unknown as { views?: number }).views === "number" ? (insights as unknown as InstagramMediaInsightsValues) : undefined);

        const likes = typeof values?.likes === "number" ? values.likes : post.likeCount;
        const comments = typeof values?.comments === "number" ? values.comments : post.commentsCount;

        const hasApiViews = typeof values?.views === "number";
        const viewsMetric: MetricWithQuality = hasApiViews && values
          ? { value: Math.max(0, values.views ?? 0), quality: "API" }
          : buildInstagramViews(likes, comments);

        const hasApiShares = typeof values?.shares === "number";
        const sharesMetric: MetricWithQuality = hasApiShares && values
          ? { value: Math.max(0, values.shares ?? 0), quality: "API" }
          : buildInstagramShares(likes);

        const hasApiSaves = typeof values?.saved === "number";
        const savesMetric: MetricWithQuality = hasApiSaves && values
          ? { value: Math.max(0, values.saved ?? 0), quality: "API" }
          : buildInstagramSaves(likes);

        const clicksMetric = buildInstagramClicks();

        const hasApiReach = typeof values?.reach === "number";
        const reachMetric: MetricWithQuality = hasApiReach && values
          ? { value: Math.max(0, values.reach ?? 0), quality: "API" }
          : buildInstagramReach(likes);

        const totalEngagements = likes + comments + sharesMetric.value + savesMetric.value;
        const er = viewsMetric.value > 0 ? (totalEngagements / viewsMetric.value) * 100 : 0;
        const ctr = viewsMetric.value > 0 ? (clicksMetric.value / viewsMetric.value) * 100 : 0;

        const erQuality: MetricQuality =
          viewsMetric.quality === "API" &&
          sharesMetric.quality === "API" &&
          savesMetric.quality === "API"
            ? "API"
            : "DERIVED";
        const ctrQuality: MetricQuality =
          clicksMetric.quality === "UNAVAILABLE" ? "UNAVAILABLE" : viewsMetric.quality === "API" ? "API" : "DERIVED";

        return {
          views: viewsMetric.value,
          likes,
          comments,
          shares: sharesMetric.value,
          saves: savesMetric.value,
          clicks: clicksMetric.value,
          engagementRate: Math.round(er * 100) / 100,
          clickThroughRate: Math.round(ctr * 100) / 100,
          estimatedReach: reachMetric.value,
          metricsQuality: {
            views: viewsMetric.quality,
            likes: "API",
            comments: "API",
            shares: sharesMetric.quality,
            saves: savesMetric.quality,
            clicks: clicksMetric.quality,
            reach: reachMetric.quality,
            ratesQuality: {
              engagementRate: erQuality,
              clickThroughRate: ctrQuality,
            },
          },
        };
      }
    }
  } catch (err) {
    logger.error("Error fetching real Instagram stats for engagement capture", err);
  }
  return null;
}

export async function captureEngagement(
  dealId: string,
  interval: "24h" | "48h" | "7d",
): Promise<EngagementMetrics | null> {
  try {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        influencer: {
          select: {
            userId: true,
            instagramFollowers: true,
            instagramEngagementRate: true,
            instagramHandle: true,
            youtubeHandle: true,
            youtubeSubscribers: true,
            youtubeEngagementRate: true,
          },
        },
        campaign: {
          select: { deliverables: true },
        },
      },
    });

    if (!deal?.postUrl) {
      logger.warn("Cannot capture engagement: no post URL", { dealId });
      return null;
    }

    // Check if already captured for this interval
    const existing = await prisma.engagementSnapshot.findUnique({
      where: { dealId_interval: { dealId, interval } },
    });

    if (existing) {
      logger.info("Engagement already captured for interval", {
        dealId,
        interval,
      });
      return {
        views: existing.views,
        likes: existing.likes,
        comments: existing.comments,
        shares: existing.shares,
        saves: existing.saves,
        clicks: existing.clicks,
        engagementRate: existing.engagementRate,
        clickThroughRate: existing.clickThroughRate,
        estimatedReach: existing.estimatedReach,
        metricsQuality: (existing.metricsQuality as unknown as SnapshotMetricsQuality) ?? undefined,
      };
    }

    let capturedMetrics: EngagementMetrics | null = null;

    // Check if YouTube
    capturedMetrics = await fetchRealYouTubeMetrics(deal.postUrl);
    if (capturedMetrics) {
      logger.info("Captured real YouTube engagement metrics", { dealId, metrics: capturedMetrics });
    } else {
      // Check if Instagram
      capturedMetrics = await fetchRealInstagramMetrics(deal.postUrl, deal.influencer.userId);
      if (capturedMetrics) {
        logger.info("Captured real Instagram engagement metrics", { dealId, metrics: capturedMetrics });
      }
    }

    const isYouTubePost =
      deal.postUrl.includes("youtube.com") || deal.postUrl.includes("youtu.be");
    const fallbackFollowers = isYouTubePost
      ? deal.influencer.youtubeSubscribers || 0
      : deal.influencer.instagramFollowers || 0;
    const fallbackEngagementRate = isYouTubePost
      ? deal.influencer.youtubeEngagementRate || 0
      : deal.influencer.instagramEngagementRate || 0;

    const metrics = capturedMetrics ?? estimateMetrics(fallbackFollowers, fallbackEngagementRate, interval);
    const metricsQuality = metrics.metricsQuality ?? {
      views: "DERIVED",
      likes: "DERIVED",
      comments: "DERIVED",
      shares: "DERIVED",
      saves: "UNAVAILABLE",
      clicks: "UNAVAILABLE",
      reach: "DERIVED",
      ratesQuality: {
        engagementRate: "DERIVED",
        clickThroughRate: "UNAVAILABLE",
      },
    };

    // Headline metric rule: isEstimated is true if headline views are not API-sourced
    const isEstimated = metricsQuality.views !== "API";

    // Save snapshot
    await prisma.engagementSnapshot.create({
      data: {
        dealId,
        interval,
        views: metrics.views,
        likes: metrics.likes,
        comments: metrics.comments,
        shares: metrics.shares,
        saves: metrics.saves,
        clicks: metrics.clicks,
        engagementRate: Math.round(metrics.engagementRate * 100),
        clickThroughRate: Math.round(metrics.clickThroughRate * 100),
        estimatedReach: metrics.estimatedReach,
        isEstimated,
        metricsQuality: metricsQuality as unknown as Prisma.InputJsonValue,
        capturedAt: new Date(),
      },
    });

    logger.info("Engagement captured", { dealId, interval, isEstimated, metrics });
    return metrics;
  } catch (error) {
    logger.error("Engagement capture failed", { dealId, interval, error });
    return null;
  }
}

/**
 * Estimate engagement metrics based on follower count and engagement rate.
 * Rule-based estimation when no API metrics are available.
 */
export function estimateMetrics(
  followers: number,
  engagementRate: number,
  interval: "24h" | "48h" | "7d",
): EngagementMetrics {
  // Reach multiplier by interval (content gets discovered over time)
  const reachMultipliers: Record<string, number> = {
    "24h": 0.15, // 15% of followers see in 24h
    "48h": 0.25, // 25% in 48h
    "7d": 0.4, // 40% in 7 days
  };

  const reachMult = reachMultipliers[interval] || 0.15;
  const estimatedReach = Math.round(followers * reachMult);

  // Views are typically higher than reach (due to explore/hashtag discovery)
  const views = Math.round(estimatedReach * 1.3);

  // Engagement breakdown (distribution of total engagement)
  const totalEngagements = Math.round(views * (engagementRate / 100));
  const likes = Math.round(totalEngagements * 0.7); // 70% likes
  const comments = Math.round(totalEngagements * 0.1); // 10% comments
  const shares = Math.round(totalEngagements * 0.08); // 8% shares
  const saves = Math.round(totalEngagements * 0.12); // 12% saves

  // Clicks: no source available for unlinked estimation -> 0 with UNAVAILABLE quality
  const clicks = 0;

  const actualEngagementRate =
    views > 0 ? ((likes + comments + shares + saves) / views) * 100 : 0;

  const clickThroughRate = 0;

  return {
    views,
    likes,
    comments,
    shares,
    saves,
    clicks,
    engagementRate: Math.round(actualEngagementRate * 100) / 100,
    clickThroughRate: Math.round(clickThroughRate * 100) / 100,
    estimatedReach,
    metricsQuality: {
      views: "DERIVED",
      likes: "DERIVED",
      comments: "DERIVED",
      shares: "DERIVED",
      saves: "DERIVED",
      clicks: "UNAVAILABLE",
      reach: "DERIVED",
      ratesQuality: {
        engagementRate: "DERIVED",
        clickThroughRate: "UNAVAILABLE",
      },
    },
  };
}

/**
 * Get engagement report for a deal, including all snapshots and ROI calculation.
 */
export async function getEngagementReport(
  dealId: string,
): Promise<EngagementReport | null> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      engagementSnapshots: {
        orderBy: { capturedAt: "asc" },
      },
    },
  });

  if (!deal) return null;

  const snapshots = deal.engagementSnapshots.map((s) => ({
    interval: s.interval,
    metrics: {
      views: s.views,
      likes: s.likes,
      comments: s.comments,
      shares: s.shares,
      saves: s.saves,
      clicks: s.clicks,
      engagementRate: s.engagementRate,
      clickThroughRate: s.clickThroughRate,
      estimatedReach: s.estimatedReach,
      metricsQuality: (s.metricsQuality as unknown as SnapshotMetricsQuality) ?? undefined,
    },
    capturedAt: s.capturedAt,
    isEstimated: s.isEstimated,
    metricsQuality: (s.metricsQuality as unknown as SnapshotMetricsQuality) ?? null,
  }));

  const latestSnapshot =
    deal.engagementSnapshots.find((s) => s.interval === "7d") ||
    deal.engagementSnapshots.at(-1);

  const roi = latestSnapshot ? calculateROI(deal.amount, latestSnapshot) : null;
  const trend = calculateTrend(deal.engagementSnapshots);

  return {
    dealId,
    postUrl: deal.postUrl,
    snapshots,
    roi,
    trend,
    hasEstimatedData: snapshots.some((s) => s.isEstimated),
  };
}

/**
* Calculate ROI for a deal based on engagement metrics.
*/
function calculateROI(
  dealAmountPaise: number,
  snapshot: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    clicks: number;
  },
): ROICalculation {
  const totalEngagements =
    snapshot.likes + snapshot.comments + snapshot.shares + snapshot.saves;

  // Cost per metrics (in paise)
  const costPerView =
    snapshot.views > 0 ? Math.round(dealAmountPaise / snapshot.views) : dealAmountPaise;

  const costPerEngagement =
    totalEngagements > 0 ? Math.round(dealAmountPaise / totalEngagements) : dealAmountPaise;

  const costPerClick =
    snapshot.clicks > 0 ? Math.round(dealAmountPaise / snapshot.clicks) : dealAmountPaise;

  // Estimated value (EMV) using weighted coefficients: views = 0.20 (20 paise), engagement = 1.00 (100 paise), clicks = 5.00 (500 paise)
  const estimatedValue = Math.round(
    snapshot.views * 20 +
    totalEngagements * 100 +
    snapshot.clicks * 500
  );

  // ROI percentage: ((value - cost) / cost) * 100
  const roiPercentage =
    dealAmountPaise > 0
      ? Math.round(
        ((estimatedValue - dealAmountPaise) / dealAmountPaise) * 10000,
      ) / 100
      : 0;

  return {
    dealAmount: dealAmountPaise,
    costPerView,
    costPerEngagement,
    costPerClick,
    estimatedValue,
    roiPercentage,
  };
}

/**
* Calculate engagement trend based on multiple snapshots.
*/
function calculateTrend(
  snapshots: Array<{ interval: string; engagementRate: number }>,
): "GROWING" | "STABLE" | "DECLINING" | "INSUFFICIENT_DATA" {
  if (snapshots.length < 2) return "INSUFFICIENT_DATA";

  const ordered = ["24h", "48h", "7d"];
  const sortedSnapshots = snapshots
    .filter((s: { interval: string }) => ordered.includes(s.interval))
    .sort((a, b) => ordered.indexOf(a.interval) - ordered.indexOf(b.interval));

  if (sortedSnapshots.length < 2) return "INSUFFICIENT_DATA";

  const first = sortedSnapshots[0]?.engagementRate ?? 0;
  const last = sortedSnapshots.at(-1)?.engagementRate ?? 0;

  if (first === 0) return "INSUFFICIENT_DATA";

  const changePercent = ((last - first) / first) * 100;

  if (changePercent > 10) return "GROWING";
  if (changePercent < -10) return "DECLINING";
  return "STABLE";
}

/**
* Batch capture engagement for all verified deals.
* Called by cron job to capture metrics at the right intervals.
*/
export async function batchCaptureEngagement(): Promise<{
  captured: number;
  skipped: number;
  errors: number;
}> {
  const now = new Date();
  let captured = 0;
  let skipped = 0;
  let errors = 0;

  // Restrict to deals verified/posted within the active window (last 8 days)
  // because snapshots are only captured up to 7 days (168 hours) post-verification.
  const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

  // Find all verified/completed deals with post URLs within the active monitoring window
  const deals = await prisma.deal.findMany({
    where: {
      status: { in: ["VERIFIED", "COMPLETED"] },
      postUrl: { not: null },
      postedAt: { gte: eightDaysAgo },
    },
    select: {
      id: true,
      postedAt: true,
      engagementSnapshots: {
        select: { interval: true },
      },
    },
    orderBy: { postedAt: "desc" },
    take: 100, // Safe batch limit per invocation
  });

  for (const deal of deals) {
    if (!deal.postedAt) continue;

    const hoursSincePost =
      (now.getTime() - deal.postedAt.getTime()) / (1000 * 60 * 60);
    const capturedIntervals = new Set(
      deal.engagementSnapshots.map((s: { interval: string }) => s.interval),
    );

    // Determine which interval to capture
    let intervalToCapture: "24h" | "48h" | "7d" | null = null;

    if (
      hoursSincePost >= 24 &&
      hoursSincePost < 48 &&
      !capturedIntervals.has("24h")
    ) {
      intervalToCapture = "24h";
    } else if (
      hoursSincePost >= 48 &&
      hoursSincePost < 168 &&
      !capturedIntervals.has("48h")
    ) {
      intervalToCapture = "48h";
    } else if (hoursSincePost >= 168 && !capturedIntervals.has("7d")) {
      intervalToCapture = "7d";
    }

    if (!intervalToCapture) {
      skipped++;
      continue;
    }

    try {
      await captureEngagement(deal.id, intervalToCapture);
      captured++;
    } catch {
      errors++;
    }
  }

  return { captured, skipped, errors };
}
