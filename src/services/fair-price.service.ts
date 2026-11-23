/**
 * Fair Price Service (DB Access & Evaluation Management)
 *
 * Coordinates influencer fair price valuations:
 * - Fetches creator profile, categories, and latest CreatorMetricSnapshot rows.
 * - Resolves category baseline CPV via MatchingService (weighted across creator categories).
 * - Projects expected views via reach-estimator when historical views are absent.
 * - Executes the pure Fair Price Engine (calculateFairPrice).
 * - Writes immutable PricingEvaluation audit records.
 * - Updates InfluencerProfile cache columns.
 * - Implements strict Redis caching (10 min TTL by inputsHash) and idempotency guards.
 * - Enforces object-level relationship checks and brand scraping quotas.
 *
 * STRICT PERFORMANCE & ARCHITECTURE INVARIANTS:
 * - Recomputes ONLY on explicit triggers: post-metric capture, creator settings update, or admin request.
 * - NEVER recomputes on page views or read routes.
 * - IDOR defense: returns 404 (not 403) for objects outside the caller's relationship boundary.
 */

import prisma from "@/lib/db";
import { redis } from "@/lib/redis";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { Actor, normalizeActor } from "@/lib/authz";
import {
  calculateFairPrice,
  computeInputsHash,
  compareQuotedRate,
  FairPriceDeliverables,
  FairPriceInput,
  FairPriceOutput,
  FairPriceDataQuality,
  QuotedRateComparison,
} from "@/lib/fair-price-engine";
import { MatchingService } from "@/services/matching.service";
import { PricingConfigService } from "@/services/pricing-config.service";
import { fairPriceEvaluationsTotal, fairPriceComputeDurationMs } from "@/lib/metrics";
import {
  estimateExpectedViews,
  ReachPlatform,
  ReachContentType,
} from "@/lib/reach-estimator";
import { MetricPlatform, MetricViewsQuality, Prisma } from "@prisma/client";

export const PRICING_CACHE_TTL_SECONDS = 600; // 10 minutes
export const BRAND_DAILY_EVALUATION_QUOTA = 50; // Max creator evaluations per brand per day

export interface EvaluateInfluencerOptions {
  platform?: string | undefined;
  contentType?: string | undefined;
  deliverables?: FairPriceDeliverables | undefined;
  quotedRatePaise?: number | undefined;
  forceRecompute?: boolean | undefined;
  requestedByUserId?: string | null | undefined;
  clock?: Date | undefined;
}

export interface EvaluateInfluencerResult {
  evaluation: FairPriceOutput;
  inputsHash: string;
  cached: boolean;
  comparison?: QuotedRateComparison | undefined;
}

export class FairPriceService {
  /**
   * Enforces object-level relationship boundaries.
   * - Admin: full access to evaluate any creator.
   * - Creator: can only evaluate their own profile.
   * - Brand: can only evaluate creators with whom they have an active relationship
   *   (deal, campaign application, or direct message thread).
   *
   * IDOR Defense: Throws 404 (not 403) so existence is not leaked to unauthorized callers.
   */
  public static async verifyRelationshipOrOwnership(
    sessionUser: Actor | { id: string; userType?: string; role?: string; isActiveAdmin?: boolean },
    influencerId: string
  ): Promise<void> {
    const actor = normalizeActor(sessionUser);
    if (actor.isActiveAdmin) {
      return;
    }

    if (actor.role === "INFLUENCER") {
      const ownProfile = await prisma.influencerProfile.findUnique({
        where: { userId: actor.id },
        select: { id: true },
      });
      if (!ownProfile || ownProfile.id !== influencerId) {
        throw AppError.notFound("Influencer profile not found");
      }
      return;
    }

    if (actor.role === "BRAND") {
      const brandProfile = await prisma.brandProfile.findUnique({
        where: { userId: actor.id },
        select: { id: true },
      });
      if (!brandProfile) {
        throw AppError.notFound("Influencer profile not found");
      }

      // Check Application relationship
      const application = await prisma.application.findFirst({
        where: {
          influencerId,
          campaign: { brandId: brandProfile.id },
        },
        select: { id: true },
      });
      if (application) return;

      // Check Deal relationship
      const deal = await prisma.deal.findFirst({
        where: {
          influencerId,
          OR: [
            { brandId: brandProfile.id },
            { campaign: { brandId: brandProfile.id } },
          ],
        },
        select: { id: true },
      });
      if (deal) return;

      // Check Direct Message relationship
      const influencer = await prisma.influencerProfile.findUnique({
        where: { id: influencerId },
        select: { userId: true },
      });
      if (influencer) {
        const message = await prisma.message.findFirst({
          where: {
            OR: [
              { senderId: sessionUser.id, receiverId: influencer.userId },
              { senderId: influencer.userId, receiverId: sessionUser.id },
            ],
          },
          select: { id: true },
        });
        if (message) return;
      }

      // No legitimate relationship found: return 404 to avoid leaking profile existence
      throw AppError.notFound("Influencer profile not found");
    }

    throw AppError.notFound("Influencer profile not found");
  }

  /**
   * Enforces brand anti-scraping daily quota.
   * Tracks evaluation count in Redis with a 24-hour UTC day window.
   */
  public static async checkBrandDailyEvaluationQuota(
    userId: string,
    clock: Date = new Date()
  ): Promise<void> {
    const dayKey = clock.toISOString().slice(0, 10); // YYYY-MM-DD
    const redisKey = `pricing:quota:brand:${userId}:${dayKey}`;

    try {
      const count = await redis.incr(redisKey);
      if (count === 1) {
        await redis.expire(redisKey, 86400); // 24 hours
      }

      if (count > BRAND_DAILY_EVALUATION_QUOTA) {
        throw AppError.tooManyRequests(
          `Daily pricing evaluation quota of ${BRAND_DAILY_EVALUATION_QUOTA} creators exceeded. Resets at midnight UTC.`
        );
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.warn("[FairPriceService] Quota check Redis error, failing open", { userId, error: err });
    }
  }

  /**
   * Evaluates fair market rate range for an influencer.
   *
   * Flow:
   * 1. Reads InfluencerProfile & recent CreatorMetricSnapshot data.
   * 2. Resolves category baseline CPV via MatchingService (weighted across creator categories).
   * 3. Projects expected views via reach-estimator when recent API views are absent.
   * 4. Computes deterministic inputsHash.
   * 5. Checks Redis cache and DB idempotency (skips recompute if inputsHash unchanged).
   * 6. Calculates output via pure Fair Price Engine.
   * 7. Atomically records PricingEvaluation and updates InfluencerProfile cache columns.
   */
  public static async evaluateInfluencer(
    influencerId: string,
    opts?: EvaluateInfluencerOptions
  ): Promise<EvaluateInfluencerResult> {
    const clock = opts?.clock || new Date();

    const influencer = await prisma.influencerProfile.findUnique({
      where: { id: influencerId },
      select: {
        id: true,
        userId: true,
        categories: true,
        instagramFollowers: true,
        instagramEngagementRate: true,
        youtubeSubscribers: true,
        youtubeEngagementRate: true,
        followerAuthenticityScore: true,
        updatedAt: true,
        fairRateMinPaise: true,
        fairRateMaxPaise: true,
        fairRateConfidence: true,
        fairRateDataQuality: true,
        fairRateComputedAt: true,
        fairRateEngineVersion: true,
      },
    });

    if (!influencer) {
      throw AppError.notFound("Influencer profile not found");
    }

    // 1. Resolve Target Platform & Content Type
    const targetPlatform = (
      opts?.platform ||
      (influencer.youtubeSubscribers && influencer.youtubeSubscribers > (influencer.instagramFollowers || 0)
        ? "YOUTUBE"
        : "INSTAGRAM")
    ).toUpperCase();

    const targetContentType = (
      opts?.contentType || (targetPlatform === "YOUTUBE" ? "VIDEO" : "REEL")
    ).toUpperCase();

    // 2. Query Recent Metric Snapshots for Views Basis
    const metricPlatform =
      targetPlatform === "YOUTUBE" ? MetricPlatform.YOUTUBE : MetricPlatform.INSTAGRAM;

    const recentSnapshots = await prisma.creatorMetricSnapshot.findMany({
      where: {
        influencerId: influencer.id,
        platform: metricPlatform,
      },
      orderBy: { capturedAt: "desc" },
      take: 12,
    });

    const recentViews = recentSnapshots
      .map((s) => s.avgViews)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0);

    const latestSnapshot = recentSnapshots[0];
    const dataQuality: FairPriceDataQuality =
      latestSnapshot?.viewsQuality === MetricViewsQuality.API ? "VERIFIED" : "ESTIMATED";

    const followers =
      targetPlatform === "YOUTUBE"
        ? influencer.youtubeSubscribers || latestSnapshot?.followers || 0
        : influencer.instagramFollowers || latestSnapshot?.followers || 0;

    const engagementRateBps =
      latestSnapshot?.engagementRateBps ??
      (targetPlatform === "YOUTUBE"
        ? Math.round((influencer.youtubeEngagementRate || 0) * 100)
        : Math.round((influencer.instagramEngagementRate || 0) * 100));

    const authenticityScore = influencer.followerAuthenticityScore ?? 75;

    // 3. Query DRS Score
    const drsSnapshot = await prisma.drsScoreSnapshot.findFirst({
      where: { userId: influencer.userId },
      orderBy: { createdAt: "desc" },
      select: { finalScore: true },
    });
    const drsScore = drsSnapshot?.finalScore ?? 600;

    // 4. Resolve Active Pricing Config & Category Baseline CPV
    const { version: configVersion, config: activePricingConfig } =
      await PricingConfigService.getActivePricingConfig();

    const rawCategories = (influencer.categories || "general")
      .split(/[,;|]/)
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean);

    const categoryBaselineCpvPaise = await MatchingService.getCategoryBaselineCpv(
      rawCategories.length > 0 ? rawCategories : ["general"]
    );

    // 5. Reach Estimator Fallback (if recentViews is empty)
    let expectedViews: { low: number; mid: number; high: number } | undefined;
    if (recentViews.length === 0) {
      const estimate = estimateExpectedViews({
        platform: targetPlatform as ReachPlatform,
        contentType: targetContentType as ReachContentType,
        followers,
        authenticityScore,
        engagementRateBps,
        customBands: activePricingConfig.reachRateBands,
      });
      expectedViews = { low: estimate.low, mid: estimate.mid, high: estimate.high };
    }

    // 6. Build Engine Input & Compute Deterministic Hash
    const engineInput: FairPriceInput = {
      platform: targetPlatform,
      contentType: targetContentType,
      followers,
      engagementRateBps,
      ...(recentViews.length > 0 ? { recentViews } : {}),
      ...(expectedViews ? { expectedViews } : {}),
      categoryBaselineCpvPaise,
      authenticityScore,
      drsScore,
      deliverables: opts?.deliverables || { count: 1 },
      dataQuality,
      ...(opts?.quotedRatePaise !== undefined ? { quotedRatePaise: opts.quotedRatePaise } : {}),
      ...(influencer.updatedAt ? { profileUpdatedAt: influencer.updatedAt } : {}),
      now: clock,
    };

    const inputsHash = computeInputsHash(engineInput);
    const cacheKey = `pricing:evaluation:${influencer.id}:${inputsHash}`;

    // 7. Check In-Memory/Redis Cache (10-minute TTL)
    if (!opts?.forceRecompute) {
      try {
        const cachedJson = await redis.get(cacheKey);
        if (cachedJson) {
          const parsed = JSON.parse(cachedJson) as FairPriceOutput;
          let comparison: QuotedRateComparison | undefined;
          if (opts?.quotedRatePaise !== undefined) {
            comparison = compareQuotedRate(opts.quotedRatePaise, parsed);
          }
          return {
            evaluation: parsed,
            inputsHash,
            cached: true,
            ...(comparison !== undefined ? { comparison } : {}),
          };
        }
      } catch (err) {
        logger.warn("[FairPriceService] Redis cache lookup failed", { error: err });
      }
    }

    // 8. DB Idempotency: Skip recompute if inputsHash unchanged
    const latestEvaluation = await prisma.pricingEvaluation.findFirst({
      where: { influencerId: influencer.id },
      orderBy: { createdAt: "desc" },
    });

    if (!opts?.forceRecompute && latestEvaluation && latestEvaluation.inputsHash === inputsHash) {
      const existingOutput = latestEvaluation.outputJson as unknown as FairPriceOutput;
      try {
        await redis.setex(cacheKey, PRICING_CACHE_TTL_SECONDS, JSON.stringify(existingOutput));
      } catch (err) {
        logger.warn("[FairPriceService] Redis setex failed", { error: err });
      }

      let comparison: QuotedRateComparison | undefined;
      if (opts?.quotedRatePaise !== undefined) {
        comparison = compareQuotedRate(opts.quotedRatePaise, existingOutput);
      }
      return {
        evaluation: existingOutput,
        inputsHash,
        cached: true,
        ...(comparison !== undefined ? { comparison } : {}),
      };
    }

    // 9. Execute Pure Engine Valuation
    const evalStart = Date.now();
    const output = calculateFairPrice(engineInput, activePricingConfig);
    const evalDuration = Date.now() - evalStart;

    fairPriceComputeDurationMs.observe(evalDuration);
    fairPriceEvaluationsTotal.inc({
      confidence: output.confidence,
      dataQuality: output.dataQuality,
    });

    // 10. Atomically Write PricingEvaluation & Update InfluencerProfile Cache Columns
    await prisma.$transaction(async (tx) => {
      await tx.pricingEvaluation.create({
        data: {
          influencerId: influencer.id,
          requestedByUserId: opts?.requestedByUserId ?? null,
          platform: targetPlatform,
          contentType: targetContentType,
          inputsHash,
          inputsJson: engineInput as unknown as Prisma.InputJsonValue,
          outputJson: output as unknown as Prisma.InputJsonValue,
          engineVersion: output.engineVersion,
          configVersion,
          createdAt: clock,
        },
      });

      await tx.influencerProfile.update({
        where: { id: influencer.id },
        data: {
          fairRateMinPaise: output.minPaise,
          fairRateMaxPaise: output.maxPaise,
          fairRateConfidence: output.confidence,
          fairRateDataQuality: output.dataQuality,
          fairRateComputedAt: clock,
          fairRateEngineVersion: output.engineVersion,
        },
      });
    });

    // 11. Populate Redis Cache
    try {
      await redis.setex(cacheKey, PRICING_CACHE_TTL_SECONDS, JSON.stringify(output));
    } catch (err) {
      logger.warn("[FairPriceService] Redis setex failed", { error: err });
    }

    let comparison: QuotedRateComparison | undefined;
    if (opts?.quotedRatePaise !== undefined) {
      comparison = compareQuotedRate(opts.quotedRatePaise, output);
    }

    return {
      evaluation: output,
      inputsHash,
      cached: false,
      ...(comparison !== undefined ? { comparison } : {}),
    };
  }

  /**
   * Reads creator's cached fair rate information and latest evaluation.
   * Strictly read-only: NEVER triggers a recompute.
   */
  public static async getMyPricing(userId: string) {
    const profile = await prisma.influencerProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        displayName: true,
        fairRateMinPaise: true,
        fairRateMaxPaise: true,
        fairRateConfidence: true,
        fairRateDataQuality: true,
        fairRateComputedAt: true,
        fairRateEngineVersion: true,
      },
    });

    if (!profile) {
      throw AppError.notFound("Influencer profile not found");
    }

    const latestEvaluation = await prisma.pricingEvaluation.findFirst({
      where: { influencerId: profile.id },
      orderBy: { createdAt: "desc" },
    });

    return {
      profile: {
        id: profile.id,
        displayName: profile.displayName,
        fairRateMinPaise: profile.fairRateMinPaise,
        fairRateMaxPaise: profile.fairRateMaxPaise,
        confidence: profile.fairRateConfidence,
        dataQuality: profile.fairRateDataQuality,
        computedAt: profile.fairRateComputedAt,
        engineVersion: profile.fairRateEngineVersion,
      },
      latestEvaluation: latestEvaluation
        ? {
            id: latestEvaluation.id,
            platform: latestEvaluation.platform,
            contentType: latestEvaluation.contentType,
            inputsHash: latestEvaluation.inputsHash,
            createdAt: latestEvaluation.createdAt,
            output: latestEvaluation.outputJson as unknown as FairPriceOutput,
          }
        : null,
    };
  }
}
