import * as Sentry from "@sentry/nextjs";
import prisma from "@/lib/db";
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";
import { calculateLevel } from "@/lib/drs-score";

export type CategoryBenchmarkSource = "DYNAMIC_30D" | "CONFIG_DB" | "INDUSTRY_SEEDED" | "PLATFORM_DEFAULT";

export * from "@/lib/matching-priority";
import {
  type MatchingPriorityPreset,
  type MatchingWeights,
  MATCHING_PRIORITY_PRESETS,
  decodeMatchingPriority,
} from "@/lib/matching-priority";

export interface MatchBreakdown {
  categoryScore: number;
  engagementScore: number;
  authenticityScore: number;
  qualityScore: number;
  roiScore: number;
  estimatedViews: number;
  estimatedCpvPaise: number;
  categoryBaselineCpvPaise: number;
  categoryBenchmarkSource?: CategoryBenchmarkSource;
  matchingPriority?: MatchingPriorityPreset;
  weights?: MatchingWeights;
}

export interface MatchScoreResult {
  matchScore: number;
  matchBreakdown: MatchBreakdown;
}

import {
  CATEGORY_BASELINE_CPV_PAISE,
  DEFAULT_BASELINE_CPV_PAISE,
  getCategoryBaselineCpvSync as getCategoryBaselineCpvSyncPure,
  calculateRoiScore as calculateRoiScorePure,
} from "@/lib/roi-calculator";

export {
  CATEGORY_BASELINE_CPV_PAISE,
  DEFAULT_BASELINE_CPV_PAISE,
};

export class MatchingService {
  /**
   * Resolves dynamic CPV from completed deals in past 30 days.
   * If sample size >= minSampleDeals, computes median CPV in paise.
   */
  private static async getDynamicCategoryBaselineCpv(
    category: string,
    minSampleDeals: number = 5
  ): Promise<{ baselinePaise: number; dealCount: number } | null> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const normalized = category.trim().toLowerCase();

      const deals = await prisma.deal.findMany({
        where: {
          status: { in: ["VERIFIED", "COMPLETED", "POSTED"] },
          createdAt: { gte: thirtyDaysAgo },
          amount: { gt: 0 },
          campaign: {
            targetCategories: {
              hasSome: [
                normalized,
                category,
                category.toLowerCase(),
                category.charAt(0).toUpperCase() + category.slice(1).toLowerCase(),
              ],
            },
          },
        },
        select: {
          amount: true,
          engagementSnapshots: {
            orderBy: { capturedAt: "desc" },
            take: 1,
            select: { views: true },
          },
        },
        take: 100,
      });

      const validCpvs: number[] = [];
      for (const deal of deals) {
        const views = deal.engagementSnapshots[0]?.views ?? 0;
        if (views >= 100) {
          const dealCpv = deal.amount / views;
          if (Number.isFinite(dealCpv) && dealCpv > 0) {
            validCpvs.push(dealCpv);
          }
        }
      }

      if (validCpvs.length < minSampleDeals) {
        return null;
      }

      validCpvs.sort((a, b) => a - b);
      const mid = Math.floor(validCpvs.length / 2);
      const midVal = validCpvs[mid] ?? DEFAULT_BASELINE_CPV_PAISE;
      const prevVal = validCpvs[mid - 1] ?? midVal;
      const medianCpv = validCpvs.length % 2 === 0 ? (prevVal + midVal) / 2 : midVal;

      return {
        baselinePaise: Math.max(1, Math.round(medianCpv)),
        dealCount: validCpvs.length,
      };
    } catch (err) {
      logger.debug("Failed to calculate dynamic 30-day CPV benchmark", { category, error: err });
      return null;
    }
  }

  /**
   * Reads admin-configured category benchmark from TrustRuleConfig table in DB.
   * This is DB-driven: admins can tune it without code deployment.
   */
  private static async getDbConfiguredCategoryBaselineCpv(category: string): Promise<number | null> {
    try {
      const key = `CPV_BENCHMARK_${category.trim().toUpperCase().replace(/[\s-]+/g, "_")}`;
      const rule = await prisma.trustRuleConfig.findUnique({
        where: { ruleKey: key },
      });
      if (rule && rule.isActive && rule.weight > 0) {
        return Math.round(rule.weight);
      }
      return null;
    } catch (err) {
      logger.debug("Failed to fetch DB-configured CPV benchmark", { category, error: err });
      return null;
    }
  }

  /**
   * Overall platform average CPV across all completed deals in past 30 days.
   * Used as sensible fallback for new/low-data categories.
   */
  public static async getOverallPlatformAverageCpv(): Promise<number> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const deals = await prisma.deal.findMany({
        where: {
          status: { in: ["VERIFIED", "COMPLETED", "POSTED"] },
          createdAt: { gte: thirtyDaysAgo },
          amount: { gt: 0 },
        },
        select: {
          amount: true,
          engagementSnapshots: {
            orderBy: { capturedAt: "desc" },
            take: 1,
            select: { views: true },
          },
        },
        take: 100,
      });

      const validCpvs: number[] = [];
      for (const deal of deals) {
        const views = deal.engagementSnapshots[0]?.views ?? 0;
        if (views >= 100) {
          const dealCpv = deal.amount / views;
          if (Number.isFinite(dealCpv) && dealCpv > 0) {
            validCpvs.push(dealCpv);
          }
        }
      }

      if (validCpvs.length >= 5) {
        validCpvs.sort((a, b) => a - b);
        const mid = Math.floor(validCpvs.length / 2);
        return Math.round(validCpvs[mid] ?? DEFAULT_BASELINE_CPV_PAISE);
      }
    } catch (err) {
      logger.debug("Failed to calculate overall platform average CPV", { error: err });
    }

    return DEFAULT_BASELINE_CPV_PAISE;
  }

  /**
   * Resolves baseline CPV for a single category via a 3-tier hierarchy:
   * Tier 1: Dynamic 30-Day Platform Historical Data (median CPV of >= 5 deals)
   * Tier 2: Admin-Configurable Database Benchmark (TrustRuleConfig table in DB)
   * Tier 3: Pre-seeded Industry Benchmark (CATEGORY_BASELINE_CPV_PAISE)
   * Tier 4: Overall platform average / Platform Default (DEFAULT_BASELINE_CPV_PAISE)
   */
  private static async safeCacheResult(key: string, ttlSeconds: number, data: unknown): Promise<void> {
    try {
      await redis.setex(key, ttlSeconds, JSON.stringify(data));
    } catch (err) {
      logger.debug("Redis setex failed in MatchingService", { key, error: err });
    }
  }

  public static async resolveSingleCategoryBaseline(
    category: string
  ): Promise<{ baselinePaise: number; source: CategoryBenchmarkSource }> {
    const normalized = category.trim().toLowerCase();
    const cacheKey = `category_cpv:resolved:${normalized}`;

    // 0. Redis Cache Check (5-min TTL)
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      logger.debug("Redis category benchmark read failed", { error: err });
    }

    // Tier 1: Dynamic 30-Day Platform Data
    const dynamicResult = await MatchingService.getDynamicCategoryBaselineCpv(normalized);
    if (dynamicResult && dynamicResult.dealCount >= 5) {
      const result = { baselinePaise: dynamicResult.baselinePaise, source: "DYNAMIC_30D" as const };
      await MatchingService.safeCacheResult(cacheKey, 300, result);
      return result;
    }

    // Tier 2: Admin-Configurable Database Benchmark (TrustRuleConfig)
    const dbConfigured = await MatchingService.getDbConfiguredCategoryBaselineCpv(normalized);
    if (dbConfigured !== null && dbConfigured > 0) {
      const result = { baselinePaise: dbConfigured, source: "CONFIG_DB" as const };
      await MatchingService.safeCacheResult(cacheKey, 300, result);
      return result;
    }

    // Tier 3: Pre-seeded Industry Reference
    if (CATEGORY_BASELINE_CPV_PAISE[normalized] !== undefined) {
      const result = { baselinePaise: CATEGORY_BASELINE_CPV_PAISE[normalized], source: "INDUSTRY_SEEDED" as const };
      await MatchingService.safeCacheResult(cacheKey, 300, result);
      return result;
    }

    // Check partial string matching in pre-seeded (e.g. "fintech" -> finance)
    const foundKey = Object.keys(CATEGORY_BASELINE_CPV_PAISE).find(
      (k) => normalized.includes(k) || k.includes(normalized)
    );
    if (foundKey && CATEGORY_BASELINE_CPV_PAISE[foundKey] !== undefined) {
      const result = { baselinePaise: CATEGORY_BASELINE_CPV_PAISE[foundKey], source: "INDUSTRY_SEEDED" as const };
      await MatchingService.safeCacheResult(cacheKey, 300, result);
      return result;
    }

    // Tier 4: Low-data / New-category Fallback: Overall platform 30-day average
    const platformAvg = await MatchingService.getOverallPlatformAverageCpv();
    const result = { baselinePaise: platformAvg, source: "PLATFORM_DEFAULT" as const };
    await MatchingService.safeCacheResult(cacheKey, 300, result);
    return result;
  }

  /**
   * Detailed category baseline resolution with benchmark origin metadata.
   */
  public static async getCategoryBaselineDetails(
    targetCategories: string[]
  ): Promise<{ baselinePaise: number; source: CategoryBenchmarkSource }> {
    if (!targetCategories || targetCategories.length === 0) {
      return {
        baselinePaise: DEFAULT_BASELINE_CPV_PAISE,
        source: "PLATFORM_DEFAULT",
      };
    }

    const resolvedList: { baselinePaise: number; source: CategoryBenchmarkSource }[] = [];
    for (const cat of targetCategories) {
      const resolved = await MatchingService.resolveSingleCategoryBaseline(cat);
      resolvedList.push(resolved);
    }

    if (resolvedList.length === 0) {
      return {
        baselinePaise: DEFAULT_BASELINE_CPV_PAISE,
        source: "PLATFORM_DEFAULT",
      };
    }

    const sum = resolvedList.reduce((acc, item) => acc + item.baselinePaise, 0);
    const averageBaseline = Math.round(sum / resolvedList.length);

    const priority: Record<CategoryBenchmarkSource, number> = {
      DYNAMIC_30D: 4,
      CONFIG_DB: 3,
      INDUSTRY_SEEDED: 2,
      PLATFORM_DEFAULT: 1,
    };
    const dominantSource =
      resolvedList.sort((a, b) => priority[b.source] - priority[a.source])[0]?.source ?? "PLATFORM_DEFAULT";

    return {
      baselinePaise: averageBaseline,
      source: dominantSource,
    };
  }

  /**
   * Resolves the target category baseline CPV by averaging the baselines
   * of all target categories specified for the campaign.
   */
  public static async getCategoryBaselineCpv(targetCategories: string[]): Promise<number> {
    const details = await MatchingService.getCategoryBaselineDetails(targetCategories);
    return details.baselinePaise;
  }

  /**
   * Synchronous fallback for contexts that cannot await, using pre-seeded baselines.
   */
  public static getCategoryBaselineCpvSync(targetCategories: string[]): number {
    return getCategoryBaselineCpvSyncPure(targetCategories);
  }

  /**
   * Admin-configurable tuning: Updates or creates a category baseline CPV in the database
   * (TrustRuleConfig table) and invalidates Redis cache so changes take effect immediately
   * without code deployment.
   */
  public static async updateCategoryBaselineCpv(
    category: string,
    baselineCpvPaise: number,
    adminId?: string
  ): Promise<void> {
    const normalized = category.trim().toLowerCase();
    const ruleKey = `CPV_BENCHMARK_${normalized.toUpperCase().replace(/[\s-]+/g, "_")}`;

    await prisma.trustRuleConfig.upsert({
      where: { ruleKey },
      create: {
        ruleKey,
        category: "BENCHMARK_CPV",
        weight: Math.round(baselineCpvPaise),
        description: `Admin configured baseline CPV for ${category} in paise (${(baselineCpvPaise / 100).toFixed(2)} INR)`,
        isActive: true,
      },
      update: {
        weight: Math.round(baselineCpvPaise),
        description: `Admin configured baseline CPV for ${category} in paise (${(baselineCpvPaise / 100).toFixed(2)} INR) updated at ${new Date().toISOString()}`,
        isActive: true,
      },
    });

    try {
      await redis.del(`category_cpv:resolved:${normalized}`);
    } catch (err) {
      logger.debug("Failed to invalidate Redis category CPV cache", { category, error: err });
    }

    logger.info("Updated category baseline CPV in database", {
      category: normalized,
      baselineCpvPaise,
      adminId,
    });
  }

  /**
   * Relative ROI-Scoring Algorithm benchmarked against top enterprise influencer platforms.
   * Compares the influencer's estimated CPV against the category's market baseline.
   * Produces a relative score (10-100) with smooth linear interpolation.
   * Supports passing an explicit baseline in paise (number), a single category (string),
   * an array of categories (string[]), or defaults to platform baseline.
   */
  public static calculateRoiScore(
    cpvPaise: number,
    categoryOrBaseline?: number | string | string[]
  ): number {
    return calculateRoiScorePure(cpvPaise, categoryOrBaseline);
  }

  /**
   * Asynchronous version of calculateRoiScore that fully resolves dynamic 30-day platform
   * data and DB-configured benchmarks for the category.
   */
  public static async calculateRoiScoreAsync(
    cpvPaise: number,
    categoryOrBaseline?: number | string | string[]
  ): Promise<number> {
    if (cpvPaise <= 0) return 100;

    let baseline = DEFAULT_BASELINE_CPV_PAISE;

    if (typeof categoryOrBaseline === "number") {
      baseline = Math.max(1, categoryOrBaseline);
    } else if (typeof categoryOrBaseline === "string") {
      baseline = await MatchingService.getCategoryBaselineCpv([categoryOrBaseline]);
    } else if (Array.isArray(categoryOrBaseline) && categoryOrBaseline.length > 0) {
      baseline = await MatchingService.getCategoryBaselineCpv(categoryOrBaseline);
    }

    return MatchingService.calculateRoiScore(cpvPaise, baseline);
  }

  /**
   * Resets an admin-configured category benchmark from TrustRuleConfig table
   * and invalidates Redis cache so dynamic/seeded baselines resume.
   */
  public static async resetCategoryBaselineCpv(category: string, adminId?: string): Promise<void> {
    const normalized = category.trim().toLowerCase();
    const ruleKey = `CPV_BENCHMARK_${normalized.toUpperCase().replace(/[\s-]+/g, "_")}`;

    await prisma.trustRuleConfig.deleteMany({
      where: { ruleKey },
    });

    try {
      await redis.del(`category_cpv:resolved:${normalized}`);
    } catch (err) {
      logger.debug("Failed to invalidate Redis category CPV cache", { category, error: err });
    }

    logger.info("Reset category baseline CPV in database", {
      category: normalized,
      adminId,
    });
  }

  /**
   * Fetches all known category benchmarks with their resolution tier,
   * current effective baseline in paise and rupees, and whether admin configured in DB.
   */
  public static async getAllCategoryBenchmarks(): Promise<
    Array<{
      category: string;
      rawKey: string;
      baselinePaise: number;
      baselineRupees: string;
      source: CategoryBenchmarkSource;
      isDbConfigured: boolean;
      dealCount?: number;
    }>
  > {
    const categories = Object.keys(CATEGORY_BASELINE_CPV_PAISE);
    const results = await Promise.all(
      categories.map(async (cat) => {
        const details = await MatchingService.resolveSingleCategoryBaseline(cat);
        const dbConfigured = await MatchingService.getDbConfiguredCategoryBaselineCpv(cat);
        const dynamicData = await MatchingService.getDynamicCategoryBaselineCpv(cat, 1);
        return {
          category: cat.charAt(0).toUpperCase() + cat.slice(1),
          rawKey: cat,
          baselinePaise: details.baselinePaise,
          baselineRupees: (details.baselinePaise / 100).toFixed(2),
          source: details.source,
          isDbConfigured: dbConfigured !== null,
          dealCount: dynamicData?.dealCount ?? 0,
        };
      })
    );

    return results.sort((a, b) => b.baselinePaise - a.baselinePaise);
  }

  private static calculateCategoryScore(targetCategories: string[], categories: string): number {
    if (!targetCategories || targetCategories.length === 0) return 100;

    const infCategories = categories
      ? categories
          .split(",")
          .map((c) => c.trim().toLowerCase())
          .filter(Boolean)
      : [];

    if (infCategories.length === 0) return 0;

    const matchingCategories = targetCategories.filter((c) =>
      infCategories.includes(c.toLowerCase())
    );
    return Math.round((matchingCategories.length / targetCategories.length) * 100);
  }

  public static async batchGetHistoricalEngagementRates(
    influencerIds: string[]
  ): Promise<Map<string, { rate: number; hasData: boolean }>> {
    const resultMap = new Map<string, { rate: number; hasData: boolean }>();
    if (!influencerIds || influencerIds.length === 0) return resultMap;

    const uniqueIds = Array.from(new Set(influencerIds)).filter(Boolean);
    for (const id of uniqueIds) {
      resultMap.set(id, { rate: 0, hasData: false });
    }

    if (uniqueIds.length === 0) return resultMap;

    try {
      const deals = await prisma.deal.findMany({
        where: {
          influencerId: { in: uniqueIds },
          status: { in: ["VERIFIED", "COMPLETED", "POSTED"] },
        },
        select: { id: true, influencerId: true },
        take: Math.min(5000, 100 * uniqueIds.length),
        orderBy: { createdAt: "desc" },
      });

      if (deals.length === 0) return resultMap;

      const dealToInfluencerMap = new Map<string, string>();
      const dealIds: string[] = [];
      for (const d of deals) {
        dealToInfluencerMap.set(d.id, d.influencerId);
        dealIds.push(d.id);
      }

      const snapshots = await prisma.engagementSnapshot.findMany({
        where: { dealId: { in: dealIds } },
        orderBy: { capturedAt: "desc" },
        take: Math.min(10000, 500 * uniqueIds.length),
      });

      if (snapshots.length === 0) return resultMap;

      const latestSnapshotsPerDeal = new Map<string, (typeof snapshots)[0]>();
      for (const snap of snapshots) {
        if (!latestSnapshotsPerDeal.has(snap.dealId)) {
          latestSnapshotsPerDeal.set(snap.dealId, snap);
        }
      }

      const influencerSnapsMap = new Map<string, Array<(typeof snapshots)[0]>>();
      for (const [dealId, snap] of latestSnapshotsPerDeal.entries()) {
        const infId = dealToInfluencerMap.get(dealId);
        if (infId) {
          const list = influencerSnapsMap.get(infId) || [];
          list.push(snap);
          influencerSnapsMap.set(infId, list);
        }
      }

      for (const infId of uniqueIds) {
        const uniqueSnaps = influencerSnapsMap.get(infId) || [];
        if (uniqueSnaps.length === 0) continue;

        const totalViews = uniqueSnaps.reduce((sum, s) => sum + s.views, 0);
        const totalInteractions = uniqueSnaps.reduce(
          (sum, s) => sum + s.likes + s.comments + s.shares + s.saves,
          0
        );

        if (totalViews > 0) {
          resultMap.set(infId, { rate: (totalInteractions / totalViews) * 100, hasData: true });
        } else {
          const totalBP = uniqueSnaps.reduce((sum, s) => sum + s.engagementRate, 0);
          const rate = uniqueSnaps.length > 0 ? totalBP / uniqueSnaps.length / 100 : 0;
          resultMap.set(infId, { rate, hasData: rate > 0 });
        }
      }
    } catch (err) {
      logger.error("Error in batchGetHistoricalEngagementRates", err);
    }

    return resultMap;
  }

  public static async getHistoricalEngagementRate(
    influencerId: string
  ): Promise<{ rate: number; hasData: boolean }> {
    const map = await this.batchGetHistoricalEngagementRates([influencerId]);
    return map.get(influencerId) ?? { rate: 0, hasData: false };
  }

  public static async batchCalculateQualityScores(
    influencers: Array<{ id: string; averageRating: number }>
  ): Promise<Map<string, number>> {
    const resultMap = new Map<string, number>();
    if (!influencers || influencers.length === 0) return resultMap;

    const uniqueIds = Array.from(new Set(influencers.map((i) => i.id))).filter(Boolean);

    for (const inf of influencers) {
      if (inf.averageRating > 0) {
        const ratingStar = inf.averageRating / 100;
        resultMap.set(inf.id, Math.max(0, Math.min(100, Math.round(((ratingStar - 1) / 4) * 100))));
      } else {
        resultMap.set(inf.id, 70);
      }
    }

    if (uniqueIds.length === 0) return resultMap;

    try {
      const reviews = await prisma.review.findMany({
        where: {
          influencerRevieweeId: { in: uniqueIds },
          reviewerType: "BRAND",
        },
        take: Math.min(5000, 100 * uniqueIds.length),
        orderBy: { createdAt: "desc" },
        select: {
          influencerRevieweeId: true,
          rating: true,
          qualityRating: true,
          communicationRating: true,
          timelinessRating: true,
        },
      });

      if (reviews.length === 0) return resultMap;

      const reviewsByInfluencer = new Map<string, typeof reviews>();
      for (const rev of reviews) {
        if (!rev.influencerRevieweeId) continue;
        const list = reviewsByInfluencer.get(rev.influencerRevieweeId) || [];
        list.push(rev);
        reviewsByInfluencer.set(rev.influencerRevieweeId, list);
      }

      for (const [infId, infReviews] of reviewsByInfluencer.entries()) {
        if (infReviews.length === 0) continue;

        let sumRatings = 0;
        let ratingCount = 0;

        for (const rev of infReviews) {
          const specificScores = [
            rev.qualityRating,
            rev.communicationRating,
            rev.timelinessRating,
          ].filter((r): r is number => r !== null && r !== undefined && r > 0);

          if (specificScores.length > 0) {
            const avgSpecific =
              specificScores.reduce((sum, s) => sum + s, 0) / specificScores.length;
            sumRatings += avgSpecific;
          } else {
            sumRatings += rev.rating;
          }
          ratingCount++;
        }

        if (ratingCount > 0) {
          const avgRating = sumRatings / ratingCount;
          resultMap.set(infId, Math.max(0, Math.min(100, Math.round(((avgRating - 1) / 4) * 100))));
        }
      }
    } catch (err) {
      logger.error("Error in batchCalculateQualityScores", err);
    }

    return resultMap;
  }

  public static async calculateQualityScore(
    influencerId: string,
    averageRating: number
  ): Promise<number> {
    const map = await this.batchCalculateQualityScores([{ id: influencerId, averageRating }]);
    return map.get(influencerId) ?? 70;
  }

  /**
   * Calculates an advanced, ROI-maximizing matching score (0-100)
   * for an influencer against a specific campaign and proposed rate.
   * Utilizes brand-configured priority weights (Balanced, Reach, Trust, ROI),
   * category-specific CPV baselines, and relative efficiency scoring.
   * Supports preloaded historical data, quality scores, and category baselines for pure in-memory execution.
   */
  static async calculateMatchScore(
    campaign: {
      id: string;
      targetCategories: string[];
      perInfluencerBudget: number | null;
      guidelines?: string | null;
      matchingPriority?: MatchingPriorityPreset;
      customWeights?: MatchingWeights;
    },
    influencer: {
      id: string;
      categories: string;
      instagramFollowers: number | null;
      instagramEngagementRate: number | null;
      youtubeSubscribers: number | null;
      youtubeEngagementRate: number | null;
      followerAuthenticityScore: number;
      averageRating: number; // 0-500 scale
      xp?: number;
    },
    proposedRatePaise?: number,
    options?: {
      matchingPriority?: MatchingPriorityPreset;
      customWeights?: MatchingWeights;
      preloadedHistoricalEngagementRate?: { rate: number; hasData: boolean };
      preloadedQualityScore?: number;
      preloadedCategoryBaselineDetails?: { baselinePaise: number; source: CategoryBenchmarkSource };
    }
  ): Promise<MatchScoreResult> {
    try {
      const categoryScore = this.calculateCategoryScore(campaign.targetCategories, influencer.categories);

      const igER = (influencer.instagramEngagementRate || 0) / 100;
      const ytER = (influencer.youtubeEngagementRate || 0) / 100;
      const profileER = Math.max(igER, ytER);

      const history =
        options?.preloadedHistoricalEngagementRate !== undefined
          ? options.preloadedHistoricalEngagementRate
          : await this.getHistoricalEngagementRate(influencer.id);

      const blendedER = history.hasData
        ? 0.6 * history.rate + 0.4 * profileER
        : profileER;

      let engagementScore = 20;
      if (blendedER >= 5) {
        engagementScore = 100;
      } else if (blendedER >= 3) {
        engagementScore = 85;
      } else if (blendedER >= 1.5) {
        engagementScore = 70;
      } else if (blendedER >= 0.5) {
        engagementScore = 50;
      }

      const authenticityScore = Number.isFinite(influencer.followerAuthenticityScore)
        ? influencer.followerAuthenticityScore
        : 70;

      const qualityScore =
        options?.preloadedQualityScore !== undefined
          ? options.preloadedQualityScore
          : await this.calculateQualityScore(influencer.id, influencer.averageRating);

      const activeCostPaise = proposedRatePaise ?? campaign.perInfluencerBudget ?? 200000;
      const igFollowers = influencer.instagramFollowers || 0;
      const ytSubs = influencer.youtubeSubscribers || 0;
      const totalFollowers = igFollowers + ytSubs;

      const authenticReach = totalFollowers * (authenticityScore / 100);
      const estimatedViews = Math.max(10, Math.round(authenticReach * (blendedER / 100)));
      const cpvPaise = activeCostPaise / estimatedViews;

      // Category-specific relative ROI scoring
      const categoryBaselineDetails =
        options?.preloadedCategoryBaselineDetails !== undefined
          ? options.preloadedCategoryBaselineDetails
          : await MatchingService.getCategoryBaselineDetails(campaign.targetCategories);
      const categoryBaselineCpv = categoryBaselineDetails.baselinePaise;
      const roiScore = this.calculateRoiScore(cpvPaise, categoryBaselineCpv);

      // Determine matching priority weights (Preset or fine-tuned custom weights)
      const decodedGuidelines = campaign.guidelines ? decodeMatchingPriority(campaign.guidelines) : undefined;
      const priority: MatchingPriorityPreset =
        options?.matchingPriority ??
        campaign.matchingPriority ??
        decodedGuidelines?.priority ??
        "BALANCED";

      const rawWeights: MatchingWeights =
        options?.customWeights ??
        campaign.customWeights ??
        decodedGuidelines?.customWeights ??
        MATCHING_PRIORITY_PRESETS[priority] ??
        MATCHING_PRIORITY_PRESETS.BALANCED;

      const sumWeights =
        rawWeights.category +
        rawWeights.engagement +
        rawWeights.authenticity +
        rawWeights.quality +
        rawWeights.roi;
      const safeSum = sumWeights > 0 ? sumWeights : 1.0;

      const weights: MatchingWeights = {
        category: Number((rawWeights.category / safeSum).toFixed(4)),
        engagement: Number((rawWeights.engagement / safeSum).toFixed(4)),
        authenticity: Number((rawWeights.authenticity / safeSum).toFixed(4)),
        quality: Number((rawWeights.quality / safeSum).toFixed(4)),
        roi: Number((rawWeights.roi / safeSum).toFixed(4)),
      };

      const baseMatchScore = Math.max(
        0,
        Math.min(
          100,
          Math.round(
            weights.category * categoryScore +
            weights.engagement * engagementScore +
            weights.authenticity * authenticityScore +
            weights.quality * qualityScore +
            weights.roi * roiScore
          )
        )
      );

      // Level-based matching boost: level * 2, capped at 20 points
      const level = calculateLevel(influencer.xp ?? 0).level;
      const levelBoost = Math.min(level * 2, 20);
      const matchScore = Math.min(100, baseMatchScore + levelBoost);

      if (Number.isNaN(matchScore)) {
        throw new Error("Match score calculation produced NaN due to invalid metrics");
      }

      return {
        matchScore,
        matchBreakdown: {
          categoryScore,
          engagementScore,
          authenticityScore,
          qualityScore,
          roiScore,
          estimatedViews,
          estimatedCpvPaise: Math.round(cpvPaise),
          categoryBaselineCpvPaise: categoryBaselineCpv,
          categoryBenchmarkSource: categoryBaselineDetails.source,
          matchingPriority: priority,
          weights,
        },
      };
    } catch (err) {
      // Alert Sentry and observability logging so fallback is never silent
      Sentry.captureException(err, {
        tags: {
          service: "matching.service",
          operation: "calculateMatchScore",
          alert: "MATCHING_FALLBACK_TRIGGERED",
          campaignId: campaign.id,
        },
        extra: {
          influencerId: influencer.id,
          targetCategories: campaign.targetCategories,
          proposedRatePaise,
        },
      });

      logger.error(
        "CRITICAL: Error in calculateMatchScore, triggered fallback neutral score (50). Logged to Sentry and observability alerts.",
        err,
        {
          campaignId: campaign.id,
          influencerId: influencer.id,
          alert: "MATCHING_FALLBACK_TRIGGERED",
        }
      );

      return {
        matchScore: 50,
        matchBreakdown: {
          categoryScore: 50,
          engagementScore: 50,
          authenticityScore: 50,
          qualityScore: 50,
          roiScore: 50,
          estimatedViews: 0,
          estimatedCpvPaise: 0,
          categoryBaselineCpvPaise: DEFAULT_BASELINE_CPV_PAISE,
          categoryBenchmarkSource: "PLATFORM_DEFAULT",
          matchingPriority: "BALANCED",
          weights: MATCHING_PRIORITY_PRESETS.BALANCED,
        },
      };
    }
  }

  /**
   * Batch calculates match scores for multiple candidates against a campaign.
   * Performs batched DB queries for the entire set of candidates (O(1) queries),
   * utilizes a 5-minute Redis cache to avoid recomputing on repeated page loads,
   * then computes all scores pure in-memory.
   */
  public static async calculateMatchScoresBatch(
    campaign: {
      id: string;
      targetCategories: string[];
      perInfluencerBudget: number | null;
      guidelines?: string | null;
      matchingPriority?: MatchingPriorityPreset;
      customWeights?: MatchingWeights;
    },
    candidates: Array<{
      influencer: {
        id: string;
        categories: string;
        instagramFollowers: number | null;
        instagramEngagementRate: number | null;
        youtubeSubscribers: number | null;
        youtubeEngagementRate: number | null;
        followerAuthenticityScore: number;
        averageRating: number;
        xp?: number;
      };
      proposedRatePaise?: number;
    }>,
    options?: {
      matchingPriority?: MatchingPriorityPreset;
      customWeights?: MatchingWeights;
    }
  ): Promise<MatchScoreResult[]> {
    if (!candidates || candidates.length === 0) return [];

    const results: Array<MatchScoreResult | null> = new Array(candidates.length).fill(null);
    const missingIndices: number[] = [];

    // 1. Check Redis Cache for any pre-calculated match scores (5-minute TTL)
    const cacheKeys = candidates.map(
      (c) => `match_score:${campaign.id}:${c.influencer.id}:${c.proposedRatePaise ?? 0}`
    );

    try {
      if (cacheKeys.length > 0) {
        const cachedRaw = await redis.mget(...cacheKeys);
        for (let i = 0; i < cachedRaw.length; i++) {
          const item = cachedRaw[i];
          if (item) {
            try {
              results[i] = JSON.parse(item) as MatchScoreResult;
            } catch (parseErr) {
              logger.debug("Corrupted match score JSON in cache, recomputing", { key: cacheKeys[i], error: parseErr });
              missingIndices.push(i);
            }
          } else {
            missingIndices.push(i);
          }
        }
      }
    } catch (err) {
      logger.debug("Redis mget failed in calculateMatchScoresBatch - falling back to batch computation", {
        error: err,
      });
      for (let i = 0; i < candidates.length; i++) {
        if (!results[i]) missingIndices.push(i);
      }
    }

    if (missingIndices.length === 0) {
      return results as MatchScoreResult[];
    }

    // 2. Fetch category baseline once for the campaign
    const categoryBaselineDetails = await MatchingService.getCategoryBaselineDetails(
      campaign.targetCategories
    );

    // 3. Batch query historical engagement rates & quality scores for MISSING candidates only
    const missingInfluencerIds = Array.from(
      new Set(missingIndices.map((idx) => candidates[idx]!.influencer.id))
    );
    const missingInfluencersForQuality = missingIndices.map((idx) => ({
      id: candidates[idx]!.influencer.id,
      averageRating: candidates[idx]!.influencer.averageRating,
    }));

    const [historyMap, qualityMap] = await Promise.all([
      MatchingService.batchGetHistoricalEngagementRates(missingInfluencerIds),
      MatchingService.batchCalculateQualityScores(missingInfluencersForQuality),
    ]);

    // 4. Compute match scores pure in-memory (0 DB queries per candidate)
    const computedToCache: Array<{ key: string; result: MatchScoreResult }> = [];

    for (const idx of missingIndices) {
      const candidate = candidates[idx]!;
      const preloadedHistory = historyMap.get(candidate.influencer.id) ?? { rate: 0, hasData: false };
      const preloadedQuality = qualityMap.get(candidate.influencer.id) ?? 70;

      const scoreResult = await MatchingService.calculateMatchScore(
        campaign,
        candidate.influencer,
        candidate.proposedRatePaise,
        {
          ...options,
          preloadedHistoricalEngagementRate: preloadedHistory,
          preloadedQualityScore: preloadedQuality,
          preloadedCategoryBaselineDetails: categoryBaselineDetails,
        }
      );

      results[idx] = scoreResult;
      computedToCache.push({
        key: cacheKeys[idx]!,
        result: scoreResult,
      });
    }

    // 5. Store newly computed match scores in Redis with 5-min TTL (pipeline)
    if (computedToCache.length > 0) {
      try {
        const pipeline = redis.pipeline();
        for (const { key, result } of computedToCache) {
          pipeline.setex(key, 300, JSON.stringify(result));
        }
        await pipeline.exec();
      } catch (err) {
        logger.debug("Failed to cache match scores in Redis pipeline", { error: err });
      }
    }

    return results as MatchScoreResult[];
  }
}

export const getCategoryBaselineCpv = MatchingService.getCategoryBaselineCpv;
export const getCategoryBaselineDetails = MatchingService.getCategoryBaselineDetails;
export const getCategoryBaselineCpvSync = MatchingService.getCategoryBaselineCpvSync;
export const calculateRoiScore = MatchingService.calculateRoiScore;
export const calculateRoiScoreAsync = MatchingService.calculateRoiScoreAsync;
export const updateCategoryBaselineCpv = MatchingService.updateCategoryBaselineCpv;
export const resetCategoryBaselineCpv = MatchingService.resetCategoryBaselineCpv;
export const getAllCategoryBenchmarks = MatchingService.getAllCategoryBenchmarks;

