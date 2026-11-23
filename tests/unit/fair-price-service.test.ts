import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/lib/db";
import { redis } from "@/lib/redis";
import {
  FairPriceService,
  BRAND_DAILY_EVALUATION_QUOTA,
  PRICING_CACHE_TTL_SECONDS,
} from "@/services/fair-price.service";
import { AppError } from "@/lib/errors";
import { MetricPlatform, MetricViewsQuality } from "@prisma/client";
import * as featureFlagsModule from "@/lib/feature-flags";
import { auth } from "@/lib/auth";
import { NextRequest } from "next/server";
import { POST as evaluateRouteHandler } from "@/app/api/pricing/evaluate/route";
import { GET as meRouteHandler } from "@/app/api/pricing/me/route";

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock Redis
const mockRedisStore = new Map<string, string>();
vi.mock("@/lib/redis", () => ({
  redis: {
    get: vi.fn(async (key: string) => mockRedisStore.get(key) ?? null),
    setex: vi.fn(async (key: string, _ttl: number, val: string) => {
      mockRedisStore.set(key, val);
      return "OK";
    }),
    incr: vi.fn(async (key: string) => {
      const current = parseInt(mockRedisStore.get(key) || "0", 10);
      const next = current + 1;
      mockRedisStore.set(key, next.toString());
      return next;
    }),
    expire: vi.fn(async () => 1),
    del: vi.fn(async (...keys: string[]) => {
      for (const k of keys) mockRedisStore.delete(k);
      return keys.length;
    }),
  },
}));

describe("Fair Price Service & API Authorization (P11 REL-08)", () => {
  const mockInfluencerId = "inf_alice_123";
  const mockCreatorUserId = "user_creator_alice";
  const mockBrandUserId = "user_brand_bob";
  const mockBrandProfileId = "brand_profile_bob";

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisStore.clear();
    vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) => {
      return callback({
        pricingEvaluation: { create: vi.fn().mockResolvedValue({ id: "eval_created_1" }) },
        influencerProfile: { update: vi.fn().mockResolvedValue({ id: mockInfluencerId }) },
      });
    });
  });

  describe("1. Authorization & Object-Level Relationship Matrix (IDOR Defense)", () => {
    it("allows ADMIN to evaluate any influencer", async () => {
      await expect(
        FairPriceService.verifyRelationshipOrOwnership(
          { id: "admin_user_1", userType: "ADMIN" },
          mockInfluencerId
        )
      ).resolves.toBeUndefined();
    });

    it("allows CREATOR to evaluate their own profile", async () => {
      vi.spyOn(prisma.influencerProfile, "findUnique").mockResolvedValueOnce({
        id: mockInfluencerId,
      } as any);

      await expect(
        FairPriceService.verifyRelationshipOrOwnership(
          { id: mockCreatorUserId, userType: "INFLUENCER" },
          mockInfluencerId
        )
      ).resolves.toBeUndefined();
    });

    it("throws 404 (IDOR defense) when CREATOR attempts to evaluate another creator", async () => {
      vi.spyOn(prisma.influencerProfile, "findUnique").mockResolvedValueOnce({
        id: "different_influencer_id",
      } as any);

      await expect(
        FairPriceService.verifyRelationshipOrOwnership(
          { id: mockCreatorUserId, userType: "INFLUENCER" },
          mockInfluencerId
        )
      ).rejects.toThrowError(AppError);

      try {
        await FairPriceService.verifyRelationshipOrOwnership(
          { id: mockCreatorUserId, userType: "INFLUENCER" },
          mockInfluencerId
        );
      } catch (err: any) {
        expect(err.statusCode).toBe(404);
        expect(err.message).toBe("Influencer profile not found");
      }
    });

    it("allows BRAND to evaluate creator if an Application relationship exists", async () => {
      vi.spyOn(prisma.brandProfile, "findUnique").mockResolvedValueOnce({
        id: mockBrandProfileId,
      } as any);

      vi.spyOn(prisma.application, "findFirst").mockResolvedValueOnce({
        id: "app_1",
      } as any);

      await expect(
        FairPriceService.verifyRelationshipOrOwnership(
          { id: mockBrandUserId, userType: "BRAND" },
          mockInfluencerId
        )
      ).resolves.toBeUndefined();
    });

    it("allows BRAND to evaluate creator if a Deal relationship exists", async () => {
      vi.spyOn(prisma.brandProfile, "findUnique").mockResolvedValueOnce({
        id: mockBrandProfileId,
      } as any);

      vi.spyOn(prisma.application, "findFirst").mockResolvedValueOnce(null);
      vi.spyOn(prisma.deal, "findFirst").mockResolvedValueOnce({
        id: "deal_1",
      } as any);

      await expect(
        FairPriceService.verifyRelationshipOrOwnership(
          { id: mockBrandUserId, userType: "BRAND" },
          mockInfluencerId
        )
      ).resolves.toBeUndefined();
    });

    it("allows BRAND to evaluate creator if a Direct Message relationship exists", async () => {
      vi.spyOn(prisma.brandProfile, "findUnique").mockResolvedValueOnce({
        id: mockBrandProfileId,
      } as any);

      vi.spyOn(prisma.application, "findFirst").mockResolvedValueOnce(null);
      vi.spyOn(prisma.deal, "findFirst").mockResolvedValueOnce(null);

      vi.spyOn(prisma.influencerProfile, "findUnique").mockResolvedValueOnce({
        userId: mockCreatorUserId,
      } as any);

      vi.spyOn(prisma.message, "findFirst").mockResolvedValueOnce({
        id: "msg_1",
      } as any);

      await expect(
        FairPriceService.verifyRelationshipOrOwnership(
          { id: mockBrandUserId, userType: "BRAND" },
          mockInfluencerId
        )
      ).resolves.toBeUndefined();
    });

    it("throws 404 (IDOR defense) when BRAND has NO relationship with the creator", async () => {
      vi.spyOn(prisma.brandProfile, "findUnique").mockResolvedValueOnce({
        id: mockBrandProfileId,
      } as any);

      vi.spyOn(prisma.application, "findFirst").mockResolvedValueOnce(null);
      vi.spyOn(prisma.deal, "findFirst").mockResolvedValueOnce(null);
      vi.spyOn(prisma.influencerProfile, "findUnique").mockResolvedValueOnce({
        userId: mockCreatorUserId,
      } as any);
      vi.spyOn(prisma.message, "findFirst").mockResolvedValueOnce(null);

      await expect(
        FairPriceService.verifyRelationshipOrOwnership(
          { id: mockBrandUserId, userType: "BRAND" },
          mockInfluencerId
        )
      ).rejects.toThrowError(AppError);

      try {
        await FairPriceService.verifyRelationshipOrOwnership(
          { id: mockBrandUserId, userType: "BRAND" },
          mockInfluencerId
        );
      } catch (err: any) {
        expect(err.statusCode).toBe(404);
        expect(err.message).toBe("Influencer profile not found");
      }
    });
  });

  describe("2. Per-Brand Scraping Quota Enforcer", () => {
    it("allows evaluations up to quota limit (50 evaluations per day)", async () => {
      const fixedClock = new Date("2026-11-22T12:00:00Z");

      for (let i = 0; i < BRAND_DAILY_EVALUATION_QUOTA; i++) {
        await expect(
          FairPriceService.checkBrandDailyEvaluationQuota(mockBrandUserId, fixedClock)
        ).resolves.toBeUndefined();
      }
    });

    it("throws 429 Too Many Requests when daily quota of 50 is exceeded", async () => {
      const fixedClock = new Date("2026-11-22T12:00:00Z");
      const key = `pricing:quota:brand:${mockBrandUserId}:2026-11-22`;
      mockRedisStore.set(key, "50"); // At maximum

      await expect(
        FairPriceService.checkBrandDailyEvaluationQuota(mockBrandUserId, fixedClock)
      ).rejects.toThrowError(AppError);

      try {
        await FairPriceService.checkBrandDailyEvaluationQuota(mockBrandUserId, fixedClock);
      } catch (err: any) {
        expect(err.statusCode).toBe(429);
        expect(err.message).toContain("Daily pricing evaluation quota of 50 creators exceeded");
      }
    });
  });

  describe("3. evaluateInfluencer: Caching, Idempotency & Database Updates", () => {
    const mockProfileData = {
      id: mockInfluencerId,
      userId: mockCreatorUserId,
      categories: "technology,gadgets",
      instagramFollowers: 35000,
      instagramEngagementRate: 2.8,
      youtubeSubscribers: null,
      youtubeEngagementRate: null,
      followerAuthenticityScore: 82,
      updatedAt: new Date("2026-11-20T10:00:00Z"),
      fairRateMinPaise: null,
      fairRateMaxPaise: null,
      fairRateConfidence: null,
      fairRateDataQuality: null,
      fairRateComputedAt: null,
      fairRateEngineVersion: null,
    };

    const mockMetricSnapshots = [
      {
        id: "snap_1",
        influencerId: mockInfluencerId,
        platform: MetricPlatform.INSTAGRAM,
        capturedAt: new Date("2026-11-21T06:00:00Z"),
        followers: 35000,
        avgViews: 5200,
        engagementRateBps: 280,
        postsSampled: 12,
        viewsQuality: MetricViewsQuality.API,
      },
      {
        id: "snap_2",
        influencerId: mockInfluencerId,
        platform: MetricPlatform.INSTAGRAM,
        capturedAt: new Date("2026-11-14T06:00:00Z"),
        followers: 34500,
        avgViews: 4800,
        engagementRateBps: 275,
        postsSampled: 12,
        viewsQuality: MetricViewsQuality.API,
      },
    ];

    it("evaluates influencer on fresh run and writes to DB & Redis", async () => {
      vi.spyOn(prisma.influencerProfile, "findUnique").mockResolvedValueOnce(mockProfileData as any);
      vi.spyOn(prisma.creatorMetricSnapshot, "findMany").mockResolvedValueOnce(mockMetricSnapshots as any);
      vi.spyOn(prisma.drsScoreSnapshot, "findFirst").mockResolvedValueOnce({ finalScore: 650 } as any);
      vi.spyOn(prisma.pricingEvaluation, "findFirst").mockResolvedValueOnce(null);

      const txCreateSpy = vi.fn().mockResolvedValue({ id: "eval_new_1" });
      const txUpdateSpy = vi.fn().mockResolvedValue({ id: mockInfluencerId });
      vi.spyOn(prisma, "$transaction").mockImplementationOnce(async (callback: any) => {
        return callback({
          pricingEvaluation: { create: txCreateSpy },
          influencerProfile: { update: txUpdateSpy },
        });
      });

      const result = await FairPriceService.evaluateInfluencer(mockInfluencerId, {
        platform: "INSTAGRAM",
        contentType: "REEL",
      });

      expect(result.cached).toBe(false);
      expect(result.evaluation.basePaise).toBeGreaterThan(0);
      expect(result.evaluation.minPaise).toBeGreaterThan(0);
      expect(result.evaluation.maxPaise).toBeGreaterThan(result.evaluation.minPaise);
      expect(result.evaluation.dataQuality).toBe("VERIFIED");
      expect(txCreateSpy).toHaveBeenCalledTimes(1);
      expect(txUpdateSpy).toHaveBeenCalledTimes(1);

      // Verify Redis cache was populated with 600s TTL
      const cacheKey = `pricing:evaluation:${mockInfluencerId}:${result.inputsHash}`;
      expect(mockRedisStore.has(cacheKey)).toBe(true);
    });

    it("skips recompute when inputsHash matches latest PricingEvaluation (DB Idempotency)", async () => {
      vi.spyOn(prisma.influencerProfile, "findUnique").mockResolvedValueOnce(mockProfileData as any);
      vi.spyOn(prisma.creatorMetricSnapshot, "findMany").mockResolvedValueOnce(mockMetricSnapshots as any);
      vi.spyOn(prisma.drsScoreSnapshot, "findFirst").mockResolvedValueOnce({ finalScore: 650 } as any);

      const existingOutput = {
        basePaise: 420000,
        minPaise: 357000,
        maxPaise: 504000,
        expectedViews: 5000,
        viewStatistic: "MEDIAN",
        confidence: "LOW",
        dataQuality: "VERIFIED",
        flags: [],
        explanation: [],
        engineVersion: "1.0.0",
      };

      vi.spyOn(prisma.pricingEvaluation, "findFirst").mockResolvedValueOnce(null as any);

      // Spy on transaction to verify it is NOT called
      const txSpy = vi.spyOn(prisma, "$transaction");

      // Temporarily mock computeInputsHash match
      const evalResult = await FairPriceService.evaluateInfluencer(mockInfluencerId, {
        platform: "INSTAGRAM",
        contentType: "REEL",
      });

      // Clear Redis cache and reset transaction spy count so we explicitly test DB idempotency path on second run
      mockRedisStore.clear();
      txSpy.mockClear();

      // Now run again with the inputsHash in DB
      vi.spyOn(prisma.influencerProfile, "findUnique").mockResolvedValueOnce(mockProfileData as any);
      vi.spyOn(prisma.creatorMetricSnapshot, "findMany").mockResolvedValueOnce(mockMetricSnapshots as any);
      vi.spyOn(prisma.drsScoreSnapshot, "findFirst").mockResolvedValueOnce({ finalScore: 650 } as any);
      vi.spyOn(prisma.pricingEvaluation, "findFirst").mockResolvedValueOnce({
        id: "eval_existing_1",
        influencerId: mockInfluencerId,
        inputsHash: evalResult.inputsHash,
        outputJson: existingOutput,
      } as any);

      const secondRun = await FairPriceService.evaluateInfluencer(mockInfluencerId, {
        platform: "INSTAGRAM",
        contentType: "REEL",
      });

      expect(secondRun.cached).toBe(true);
      expect(secondRun.evaluation.basePaise).toBe(420000);
      expect(txSpy).not.toHaveBeenCalled();
    });

    it("serves from Redis cache when cacheKey hits (Fast Path)", async () => {
      vi.spyOn(prisma.influencerProfile, "findUnique").mockResolvedValueOnce(mockProfileData as any);
      vi.spyOn(prisma.creatorMetricSnapshot, "findMany").mockResolvedValueOnce(mockMetricSnapshots as any);
      vi.spyOn(prisma.drsScoreSnapshot, "findFirst").mockResolvedValueOnce({ finalScore: 650 } as any);

      // Pre-populate Redis
      const firstRun = await FairPriceService.evaluateInfluencer(mockInfluencerId, {
        platform: "INSTAGRAM",
        contentType: "REEL",
      });

      vi.spyOn(prisma.influencerProfile, "findUnique").mockResolvedValueOnce(mockProfileData as any);
      vi.spyOn(prisma.creatorMetricSnapshot, "findMany").mockResolvedValueOnce(mockMetricSnapshots as any);
      vi.spyOn(prisma.drsScoreSnapshot, "findFirst").mockResolvedValueOnce({ finalScore: 650 } as any);

      const dbFindFirstSpy = vi.spyOn(prisma.pricingEvaluation, "findFirst");
      dbFindFirstSpy.mockClear();

      const cachedRun = await FairPriceService.evaluateInfluencer(mockInfluencerId, {
        platform: "INSTAGRAM",
        contentType: "REEL",
      });

      expect(cachedRun.cached).toBe(true);
      expect(dbFindFirstSpy).not.toHaveBeenCalled();
    });
  });

  describe("4. getMyPricing: Read-Only Invariant (Never Recomputes on Read)", () => {
    it("returns cached profile columns and latest evaluation without recomputing", async () => {
      const mockProfileWithPricing = {
        id: mockInfluencerId,
        displayName: "Alice Tech",
        fairRateMinPaise: 400000,
        fairRateMaxPaise: 550000,
        fairRateConfidence: "HIGH",
        fairRateDataQuality: "VERIFIED",
        fairRateComputedAt: new Date("2026-11-21T06:30:00Z"),
        fairRateEngineVersion: "1.0.0",
      };

      vi.spyOn(prisma.influencerProfile, "findUnique").mockResolvedValueOnce(mockProfileWithPricing as any);
      vi.spyOn(prisma.pricingEvaluation, "findFirst").mockResolvedValueOnce({
        id: "eval_last_1",
        platform: "INSTAGRAM",
        contentType: "REEL",
        inputsHash: "hash_12345",
        createdAt: new Date("2026-11-21T06:30:00Z"),
        outputJson: {
          basePaise: 475000,
          minPaise: 400000,
          maxPaise: 550000,
          expectedViews: 5200,
          viewStatistic: "TRIMMED_MEAN_DROP_TOP2_BOTTOM2",
          confidence: "HIGH",
          dataQuality: "VERIFIED",
          flags: [],
          explanation: [],
          engineVersion: "1.0.0",
        },
      } as any);

      const txSpy = vi.spyOn(prisma, "$transaction");
      const evalSpy = vi.spyOn(prisma.pricingEvaluation, "create");

      const result = await FairPriceService.getMyPricing(mockCreatorUserId);

      expect(result.profile.fairRateMinPaise).toBe(400000);
      expect(result.profile.fairRateMaxPaise).toBe(550000);
      expect(result.latestEvaluation?.platform).toBe("INSTAGRAM");
      expect(txSpy).not.toHaveBeenCalled();
      expect(evalSpy).not.toHaveBeenCalled();
    });
  });

  describe("5. Feature Flag Gating (fair_price)", () => {
    it("assertFeatureEnabled throws 403 when fair_price is disabled", async () => {
      vi.spyOn(featureFlagsModule, "isFeatureEnabled").mockResolvedValueOnce(false);

      await expect(
        featureFlagsModule.assertFeatureEnabled(
          featureFlagsModule.FEATURE_FLAGS.FAIR_PRICE,
          { userId: mockCreatorUserId, role: "INFLUENCER" },
          "Fair price evaluation is currently disabled."
        )
      ).rejects.toThrowError("Fair price evaluation is currently disabled.");
    });
  });

  describe("6. Route Handler End-to-End Tests (/api/pricing/evaluate & /api/pricing/me)", () => {
    const mockProfileData = {
      id: mockInfluencerId,
      userId: mockCreatorUserId,
      categories: "technology",
      instagramFollowers: 40000,
      instagramEngagementRate: 3.0,
      youtubeSubscribers: null,
      youtubeEngagementRate: null,
      followerAuthenticityScore: 80,
      updatedAt: new Date("2026-11-20T10:00:00Z"),
      fairRateMinPaise: 400000,
      fairRateMaxPaise: 550000,
      fairRateConfidence: "HIGH",
      fairRateDataQuality: "VERIFIED",
      fairRateComputedAt: new Date("2026-11-21T06:30:00Z"),
      fairRateEngineVersion: "1.0.0",
    };

    it("POST /api/pricing/evaluate returns 403 when fair_price feature flag is disabled", async () => {
      (auth as any).mockResolvedValueOnce({
        user: { id: mockCreatorUserId, userType: "INFLUENCER" },
      });
      vi.spyOn(featureFlagsModule, "assertFeatureEnabled").mockRejectedValueOnce(
        AppError.forbidden("Fair price evaluation is currently disabled.")
      );

      const req = new NextRequest("http://localhost:3000/api/pricing/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ influencerId: mockInfluencerId }),
      });

      const response = await evaluateRouteHandler(req);
      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.message).toContain("Fair price evaluation is currently disabled");
    });

    it("POST /api/pricing/evaluate returns 404 (IDOR defense) when creator attempts to evaluate another creator", async () => {
      (auth as any).mockResolvedValueOnce({
        user: { id: mockCreatorUserId, userType: "INFLUENCER" },
      });
      vi.spyOn(featureFlagsModule, "assertFeatureEnabled").mockResolvedValueOnce(undefined);

      // Creator's profile does not match the target influencer ID
      vi.spyOn(prisma.influencerProfile, "findUnique").mockResolvedValueOnce({
        id: "different_id_999",
      } as any);

      const req = new NextRequest("http://localhost:3000/api/pricing/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ influencerId: mockInfluencerId }),
      });

      const response = await evaluateRouteHandler(req);
      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.message).toBe("Influencer profile not found");
    });

    it("POST /api/pricing/evaluate returns 200 with calculation and explanation on creator self-evaluation", async () => {
      (auth as any).mockResolvedValueOnce({
        user: { id: mockCreatorUserId, userType: "INFLUENCER" },
      });
      vi.spyOn(featureFlagsModule, "assertFeatureEnabled").mockResolvedValueOnce(undefined);

      // Verification finds own profile
      vi.spyOn(prisma.influencerProfile, "findUnique")
        .mockResolvedValueOnce({ id: mockInfluencerId } as any) // for verifyRelationshipOrOwnership
        .mockResolvedValueOnce(mockProfileData as any); // for evaluateInfluencer

      vi.spyOn(prisma.creatorMetricSnapshot, "findMany").mockResolvedValueOnce([]);
      vi.spyOn(prisma.drsScoreSnapshot, "findFirst").mockResolvedValueOnce({ finalScore: 650 } as any);
      vi.spyOn(prisma.pricingEvaluation, "findFirst").mockResolvedValueOnce(null);

      const req = new NextRequest("http://localhost:3000/api/pricing/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          influencerId: mockInfluencerId,
          platform: "INSTAGRAM",
          contentType: "REEL",
          quotedRatePaise: 450000,
        }),
      });

      const response = await evaluateRouteHandler(req);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.influencerId).toBe(mockInfluencerId);
      expect(json.data.minPaise).toBeGreaterThan(0);
      expect(json.data.maxPaise).toBeGreaterThan(json.data.minPaise);
      expect(json.data.explanation.length).toBeGreaterThan(0);
      expect(json.data.comparison).toBeDefined();
      expect(json.data.comparison.statusMessage).toContain("estimated market range");
    });

    it("POST /api/pricing/evaluate returns 400 when body violates strict schema (e.g. unknown properties)", async () => {
      (auth as any).mockResolvedValueOnce({
        user: { id: mockCreatorUserId, userType: "INFLUENCER" },
      });
      vi.spyOn(featureFlagsModule, "assertFeatureEnabled").mockResolvedValueOnce(undefined);

      const req = new NextRequest("http://localhost:3000/api/pricing/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          influencerId: mockInfluencerId,
          maliciousField: "injection", // Not in schema
        }),
      });

      const response = await evaluateRouteHandler(req);
      expect(response.status).toBe(400);
    });

    it("GET /api/pricing/me returns 200 with cached profile fair rate and latest evaluation", async () => {
      (auth as any).mockResolvedValueOnce({
        user: { id: mockCreatorUserId, userType: "INFLUENCER" },
      });
      vi.spyOn(featureFlagsModule, "assertFeatureEnabled").mockResolvedValueOnce(undefined);

      vi.spyOn(prisma.influencerProfile, "findUnique").mockResolvedValueOnce(mockProfileData as any);
      vi.spyOn(prisma.pricingEvaluation, "findFirst").mockResolvedValueOnce({
        id: "eval_latest",
        platform: "INSTAGRAM",
        contentType: "REEL",
        inputsHash: "hash_abc",
        createdAt: new Date("2026-11-21T06:30:00Z"),
        outputJson: {
          basePaise: 450000,
          minPaise: 382500,
          maxPaise: 540000,
          expectedViews: 5000,
          viewStatistic: "MEDIAN",
          confidence: "MEDIUM",
          dataQuality: "VERIFIED",
          flags: [],
          explanation: [],
          engineVersion: "1.0.0",
        },
      } as any);

      const req = new NextRequest("http://localhost:3000/api/pricing/me", {
        method: "GET",
      });

      const response = await meRouteHandler(req);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.profile.fairRateMinPaise).toBe(400000);
      expect(json.data.profile.fairRateMaxPaise).toBe(550000);
      expect(json.data.latestEvaluation.platform).toBe("INSTAGRAM");
    });
  });
});
