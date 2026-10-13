import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CATEGORY_BASELINE_CPV_PAISE,
  DEFAULT_BASELINE_CPV_PAISE,
  getCategoryBaselineCpvSync,
  getCategoryBaselineDetails,
  updateCategoryBaselineCpv,
  calculateRoiScore,
  calculateRoiScoreAsync,
  getAllCategoryBenchmarks,
  resetCategoryBaselineCpv,
  MatchingService,
  encodeMatchingPriority,
  decodeMatchingPriority,
  stripMatchingPriority,
} from "@/services/matching.service";
import * as Sentry from "@sentry/nextjs";
import { logger } from "@/lib/logger";
import prisma from "@/lib/db";
import { redis } from "@/lib/redis";

// Mock Sentry, logger, prisma, redis
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/lib/redis", () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
  },
}));

vi.mock("@/lib/db", () => ({
  default: {
    deal: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    trustRuleConfig: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({ id: "rule-1" }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    review: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    engagementSnapshot: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

describe("Unit Tests: Category-Specific ROI & Relative CPV Scoring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Category Baseline CPV Thresholds", () => {
    it("should provide high-ticket baseline for Finance, Real Estate, and Tech", () => {
      expect(CATEGORY_BASELINE_CPV_PAISE.finance).toBe(120); // ₹1.20
      expect(CATEGORY_BASELINE_CPV_PAISE["real estate"]).toBe(150); // ₹1.50
      expect(CATEGORY_BASELINE_CPV_PAISE.tech).toBe(65); // ₹0.65
      expect(CATEGORY_BASELINE_CPV_PAISE.business).toBe(100); // ₹1.00
    });

    it("should provide mass-market baseline for Fashion, Beauty, and Gaming", () => {
      expect(CATEGORY_BASELINE_CPV_PAISE.fashion).toBe(25); // ₹0.25
      expect(CATEGORY_BASELINE_CPV_PAISE.beauty).toBe(30); // ₹0.30
      expect(CATEGORY_BASELINE_CPV_PAISE.gaming).toBe(18); // ₹0.18
      expect(CATEGORY_BASELINE_CPV_PAISE.entertainment).toBe(15); // ₹0.15
    });

    it("should have a sensible platform default baseline", () => {
      expect(DEFAULT_BASELINE_CPV_PAISE).toBe(35); // ₹0.35
    });
  });

  describe("Synchronous getCategoryBaselineCpvSync Resolution", () => {
    it("should resolve single exact category case-insensitively", () => {
      expect(getCategoryBaselineCpvSync(["Finance"])).toBe(120);
      expect(getCategoryBaselineCpvSync(["TECH"])).toBe(65);
      expect(getCategoryBaselineCpvSync(["fashion"])).toBe(25);
    });

    it("should resolve category from multi-word or compound strings", () => {
      expect(getCategoryBaselineCpvSync(["Tech & Gadgets Reviews"])).toBe(65);
      expect(getCategoryBaselineCpvSync(["Women Fashion Trends"])).toBe(25);
    });

    it("should average baselines for multi-category campaigns", () => {
      // Tech (65) + Fashion (25) = (65 + 25) / 2 = 45
      const blended = getCategoryBaselineCpvSync(["Tech", "Fashion"]);
      expect(blended).toBe(45);
    });

    it("should return default platform baseline if categories array is empty or unrecognized", () => {
      expect(getCategoryBaselineCpvSync([])).toBe(DEFAULT_BASELINE_CPV_PAISE);
      expect(getCategoryBaselineCpvSync(["xyz unknown sector 123"])).toBe(DEFAULT_BASELINE_CPV_PAISE);
    });
  });

  describe("Tier 1: Dynamic 30-Day Platform Historical Data Calculation", () => {
    it("should calculate median CPV dynamically when >= 5 completed deals exist in past 30 days", async () => {
      // Mock 5 completed deals for Tech with varying CPVs: 40p, 50p, 60p, 70p, 80p -> Median = 60p
      (prisma.deal.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { amount: 40000, engagementSnapshots: [{ views: 1000 }] }, // 40p
        { amount: 50000, engagementSnapshots: [{ views: 1000 }] }, // 50p
        { amount: 60000, engagementSnapshots: [{ views: 1000 }] }, // 60p (median)
        { amount: 70000, engagementSnapshots: [{ views: 1000 }] }, // 70p
        { amount: 80000, engagementSnapshots: [{ views: 1000 }] }, // 80p
      ]);

      const details = await getCategoryBaselineDetails(["tech"]);
      expect(details.baselinePaise).toBe(60);
      expect(details.source).toBe("DYNAMIC_30D");
    });
  });

  describe("Tier 2: Admin-Configurable Database Benchmarks (TrustRuleConfig)", () => {
    it("should use admin-configured database benchmark when dynamic data has < 5 deals", async () => {
      // Dynamic deals returns empty
      (prisma.deal.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

      // TrustRuleConfig returns admin override for Finance: 140p (₹1.40) instead of 120p default
      (prisma.trustRuleConfig.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ruleKey: "CPV_BENCHMARK_FINANCE",
        weight: 140,
        isActive: true,
      });

      const details = await getCategoryBaselineDetails(["finance"]);
      expect(details.baselinePaise).toBe(140);
      expect(details.source).toBe("CONFIG_DB");
    });

    it("should allow admin to update category baseline and invalidate cache", async () => {
      const redisDelSpy = vi.spyOn(redis, "del");
      const upsertSpy = vi.spyOn(prisma.trustRuleConfig, "upsert");

      await updateCategoryBaselineCpv("fashion", 35, "admin_user_99");

      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { ruleKey: "CPV_BENCHMARK_FASHION" },
          create: expect.objectContaining({
            ruleKey: "CPV_BENCHMARK_FASHION",
            weight: 35,
            category: "BENCHMARK_CPV",
          }),
        })
      );
      expect(redisDelSpy).toHaveBeenCalledWith("category_cpv:resolved:fashion");
    });
  });

  describe("Tier 3 & 4: Sensible Fallback for New or Low-Data Categories", () => {
    it("should fall back to overall platform 30-day average for unrecognized categories with deals", async () => {
      // 1. Dynamic category query: empty
      (prisma.deal.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
      // 2. DB config: null
      (prisma.trustRuleConfig.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
      // 3. Overall platform deals query: 5 deals with median 45p
      (prisma.deal.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { amount: 30000, engagementSnapshots: [{ views: 1000 }] },
        { amount: 40000, engagementSnapshots: [{ views: 1000 }] },
        { amount: 45000, engagementSnapshots: [{ views: 1000 }] },
        { amount: 50000, engagementSnapshots: [{ views: 1000 }] },
        { amount: 60000, engagementSnapshots: [{ views: 1000 }] },
      ]);

      const details = await getCategoryBaselineDetails(["brand_new_experimental_niche"]);
      expect(details.baselinePaise).toBe(45);
      expect(details.source).toBe("PLATFORM_DEFAULT");
    });

    it("should fall back to DEFAULT_BASELINE_CPV_PAISE if entire platform has zero deals", async () => {
      (prisma.deal.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.trustRuleConfig.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const details = await getCategoryBaselineDetails(["unknown_niche_xyz"]);
      expect(details.baselinePaise).toBe(DEFAULT_BASELINE_CPV_PAISE);
      expect(details.source).toBe("PLATFORM_DEFAULT");
    });
  });

  describe("User Definition of Done: Relative ROI Scoring across Different Categories", () => {
    it("DOD: 2 influencers with EXACT SAME CPV (50 paise / ₹0.50) must produce genuinely different roiScores for Finance vs Fashion", () => {
      const SAME_CPV_PAISE = 50; // ₹0.50 per view
      const financeBaseline = CATEGORY_BASELINE_CPV_PAISE.finance ?? 120; // 120p (₹1.20)
      const fashionBaseline = CATEGORY_BASELINE_CPV_PAISE.fashion ?? 25; // 25p (₹0.25)

      const financeRoiScore = calculateRoiScore(SAME_CPV_PAISE, financeBaseline);
      const fashionRoiScore = calculateRoiScore(SAME_CPV_PAISE, fashionBaseline);

      // In Finance: 50p is 41.7% of category baseline -> high ROI efficiency (~95 score)
      expect(financeRoiScore).toBeGreaterThanOrEqual(90);

      // In Fashion: 50p is 200% of category baseline -> very expensive (score 50)
      expect(fashionRoiScore).toBeLessThanOrEqual(50);

      // Genuinely different scores!
      expect(financeRoiScore).toBeGreaterThan(fashionRoiScore);
      expect(financeRoiScore - fashionRoiScore).toBeGreaterThanOrEqual(40);
    });

    it("DOD: should accept category name directly as string and compute genuinely different roiScores", () => {
      const SAME_CPV_PAISE = 50; // ₹0.50 per view

      // Pass category name directly as second argument!
      const financeScore = calculateRoiScore(SAME_CPV_PAISE, "finance");
      const fashionScore = calculateRoiScore(SAME_CPV_PAISE, "fashion");

      expect(financeScore).toBe(95);
      expect(fashionScore).toBe(50);
      expect(financeScore).toBeGreaterThan(fashionScore);
    });

    it("DOD: should accept category array directly and compute genuinely different roiScores", () => {
      const SAME_CPV_PAISE = 50;

      const financeScore = calculateRoiScore(SAME_CPV_PAISE, ["Finance"]);
      const fashionScore = calculateRoiScore(SAME_CPV_PAISE, ["Fashion"]);

      expect(financeScore).toBe(95);
      expect(fashionScore).toBe(50);
    });

    it("DOD: should asynchronously resolve dynamic/DB baselines via calculateRoiScoreAsync", async () => {
      const SAME_CPV_PAISE = 50;

      const financeScore = await calculateRoiScoreAsync(SAME_CPV_PAISE, "finance");
      const fashionScore = await calculateRoiScoreAsync(SAME_CPV_PAISE, "fashion");

      expect(financeScore).toBe(95);
      expect(fashionScore).toBe(50);
    });

    it("should list all category benchmarks and allow resetting overrides", async () => {
      const all = await getAllCategoryBenchmarks();
      expect(all.length).toBeGreaterThanOrEqual(15);
      expect(all.find((b) => b.rawKey === "finance")?.baselinePaise).toBe(120);
      expect(all.find((b) => b.rawKey === "fashion")?.baselinePaise).toBe(25);

      (prisma.trustRuleConfig.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
      await resetCategoryBaselineCpv("finance");
      expect(prisma.trustRuleConfig.deleteMany).toHaveBeenCalled();
    });
  });

  describe("Error Fallback Observability & Non-Silent Alerts", () => {
    it("should alert Sentry and logger when calculateMatchScore encounters an error", async () => {
      const sentrySpy = vi.spyOn(Sentry, "captureException");
      const loggerSpy = vi.spyOn(logger, "error");

      const invalidCampaign = {
        id: "camp-err-test",
        title: "Test Campaign",
        targetCategories: ["Tech"],
        targetLocations: null as unknown as string[],
        minFollowers: 1000,
        perInfluencerBudget: 50000,
        proposedRatePaise: 50000,
      };

      const corruptInfluencer = {
        id: "inf-err-test",
        get categories(): string {
          throw new Error("Simulated critical database serialization defect");
        },
      } as unknown as Parameters<typeof MatchingService.calculateMatchScore>[1];

      const result = await MatchingService.calculateMatchScore(
        invalidCampaign as Parameters<typeof MatchingService.calculateMatchScore>[0],
        corruptInfluencer
      );

      // Fallback score is returned
      expect(result.matchScore).toBe(50);
      expect(result.matchBreakdown.roiScore).toBe(50);
      expect(result.matchBreakdown.categoryBenchmarkSource).toBe("PLATFORM_DEFAULT");

      // Sentry and logger alert must have been triggered
      expect(sentrySpy).toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error in calculateMatchScore"),
        expect.any(Error),
        expect.objectContaining({
          alert: "MATCHING_FALLBACK_TRIGGERED",
          campaignId: "camp-err-test",
        })
      );
    });
  });

  describe("Brand-Customizable Matching Priorities & Presets", () => {
    it("should encode and decode matching priority in campaign guidelines cleanly", () => {
      const originalGuidelines = "Must showcase product packaging and avoid competitor mentions.";
      const encoded = encodeMatchingPriority(originalGuidelines, "REACH_FOCUSED");

      expect(encoded).toBe("[MATCHING_PRIORITY:REACH_FOCUSED]\nMust showcase product packaging and avoid competitor mentions.");

      const decoded = decodeMatchingPriority(encoded);
      expect(decoded.priority).toBe("REACH_FOCUSED");
      expect(decoded.cleanGuidelines).toBe(originalGuidelines);

      expect(stripMatchingPriority(encoded)).toBe(originalGuidelines);
    });

    it("should default to BALANCED when no priority tag is present (backward compatibility)", () => {
      const decoded = decodeMatchingPriority("Simple guidelines without any tag");
      expect(decoded.priority).toBe("BALANCED");
      expect(decoded.cleanGuidelines).toBe("Simple guidelines without any tag");

      const nullDecoded = decodeMatchingPriority(null);
      expect(nullDecoded.priority).toBe("BALANCED");
      expect(nullDecoded.cleanGuidelines).toBeNull();
    });

    it("should encode and decode custom fine-tuned weights cleanly", () => {
      const custom = {
        category: 0.1,
        engagement: 0.1,
        authenticity: 0.1,
        quality: 0.1,
        roi: 0.6,
      };
      const encoded = encodeMatchingPriority("Clean guidelines here", "CUSTOM", custom);
      expect(encoded).toContain("[MATCHING_PRIORITY:CUSTOM]");
      expect(encoded).toContain("[MATCHING_WEIGHTS:");

      const decoded = decodeMatchingPriority(encoded);
      expect(decoded.priority).toBe("CUSTOM");
      expect(decoded.customWeights?.roi).toBe(0.6);
      expect(decoded.cleanGuidelines).toBe("Clean guidelines here");
    });

    it("DOD: Different matching priorities must re-rank creators genuinely according to campaign goals", async () => {
      // Common campaign targeting Fashion
      const baseCampaign = {
        id: "camp-priority-test",
        title: "Summer Fashion Launch",
        targetCategories: ["Fashion"],
        perInfluencerBudget: 1000000, // ₹10,000
      };

      // Creator A: Viral Reach powerhouse (High engagement, high followers, but lower authenticity & rating)
      const creatorViral = {
        id: "creator-viral",
        categories: "Fashion, Lifestyle",
        instagramFollowers: 500000,
        instagramEngagementRate: 850, // 8.5% engagement (stored * 100)
        youtubeSubscribers: null,
        youtubeEngagementRate: null,
        followerAuthenticityScore: 50, // mediocre authenticity
        averageRating: 300, // 3.0 rating (stored * 100)
        xp: 100,
      };

      // Creator B: Trust & Quality icon (Moderate engagement, but stellar authenticity & 5.0 rating)
      const creatorTrustworthy = {
        id: "creator-trust",
        categories: "Fashion, Lifestyle",
        instagramFollowers: 150000,
        instagramEngagementRate: 180, // 1.8% engagement (stored * 100)
        youtubeSubscribers: null,
        youtubeEngagementRate: null,
        followerAuthenticityScore: 98, // outstanding authenticity
        averageRating: 500, // 5.0 rating (stored * 100)
        xp: 100,
      };

      // 1. Calculate under REACH_FOCUSED priority
      const reachViral = await MatchingService.calculateMatchScore(
        { ...baseCampaign, guidelines: encodeMatchingPriority(null, "REACH_FOCUSED") },
        creatorViral,
        1000000
      );

      const reachTrust = await MatchingService.calculateMatchScore(
        { ...baseCampaign, guidelines: encodeMatchingPriority(null, "REACH_FOCUSED") },
        creatorTrustworthy,
        1000000
      );

      // Under Reach-Focused: Viral creator must rank HIGHER than trustworthy creator
      expect(reachViral.matchScore).toBeGreaterThan(reachTrust.matchScore);
      expect(reachViral.matchBreakdown.matchingPriority).toBe("REACH_FOCUSED");

      // 2. Calculate under TRUST_FOCUSED priority
      const trustViral = await MatchingService.calculateMatchScore(
        { ...baseCampaign, guidelines: encodeMatchingPriority(null, "TRUST_FOCUSED") },
        creatorViral,
        1000000
      );

      const trustTrust = await MatchingService.calculateMatchScore(
        { ...baseCampaign, guidelines: encodeMatchingPriority(null, "TRUST_FOCUSED") },
        creatorTrustworthy,
        1000000
      );

      // Under Trust-Focused: Trustworthy creator must rank HIGHER than viral creator
      expect(trustTrust.matchScore).toBeGreaterThan(trustViral.matchScore);
      expect(trustTrust.matchBreakdown.matchingPriority).toBe("TRUST_FOCUSED");

      // 3. User DOD Verification: Rank order genuinely flips!
      // Reach-Focused: Viral > Trust
      // Trust-Focused: Trust > Viral
      expect(reachViral.matchScore - reachTrust.matchScore).toBeGreaterThan(0);
      expect(trustTrust.matchScore - trustViral.matchScore).toBeGreaterThan(0);
    });

    it("DOD: should rank creators using fine-tuned slider weights and expose complete matchBreakdown", async () => {
      const baseCampaign = {
        id: "camp-slider-test",
        title: "Fintech App Campaign",
        targetCategories: ["Finance"],
        perInfluencerBudget: 1000000,
      };

      const highRoiCreator = {
        id: "creator-high-roi",
        categories: "Finance",
        instagramFollowers: 100000,
        instagramEngagementRate: 200, // 2%
        youtubeSubscribers: null,
        youtubeEngagementRate: null,
        followerAuthenticityScore: 60,
        averageRating: 350,
        xp: 100,
      };

      // Custom weights emphasizing ROI (60%) via sliders
      const customSliderWeights = {
        category: 0.1,
        engagement: 0.1,
        authenticity: 0.1,
        quality: 0.1,
        roi: 0.6,
      };

      const result = await MatchingService.calculateMatchScore(
        {
          ...baseCampaign,
          guidelines: encodeMatchingPriority(null, "CUSTOM", customSliderWeights),
        },
        highRoiCreator,
        100000 // Proposed rate: ₹1,000 (very low CPV -> hyper ROI)
      );

      // Verify breakdown transparency ("Why this score")
      expect(result.matchBreakdown).toBeDefined();
      expect(result.matchBreakdown.matchingPriority).toBe("CUSTOM");
      expect(result.matchBreakdown.categoryScore).toBeGreaterThan(0);
      expect(result.matchBreakdown.engagementScore).toBeGreaterThan(0);
      expect(result.matchBreakdown.authenticityScore).toBeGreaterThan(0);
      expect(result.matchBreakdown.qualityScore).toBeGreaterThan(0);
      expect(result.matchBreakdown.roiScore).toBeGreaterThan(0);
      expect(result.matchBreakdown.weights?.roi).toBe(0.6);
      expect(result.matchScore).toBeGreaterThanOrEqual(80);
    });
  });
});
