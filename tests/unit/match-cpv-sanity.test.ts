import { describe, it, expect, vi, beforeEach } from "vitest";
import { MatchingService } from "@/services/matching.service";
import { estimateExpectedViews } from "@/lib/reach-estimator";

// Mock redis & Sentry & db
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/redis", () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    mget: vi.fn().mockResolvedValue([]),
    setex: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
  },
}));
vi.mock("@/lib/db", () => ({
  default: {
    deal: { findMany: vi.fn().mockResolvedValue([]) },
    engagementSnapshot: { findMany: vi.fn().mockResolvedValue([]) },
    trustRuleConfig: { findUnique: vi.fn().mockResolvedValue(null) },
  },
}));

describe("CPV & Expected Views Sanity Test (P02 Verification)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Step 1 & 2: Pure Reach Estimator Verification", () => {
    it("clamps minimum expected views to >= 10 for nano accounts", () => {
      const res = estimateExpectedViews({
        platform: "INSTAGRAM",
        contentType: "REEL",
        followers: 10,
        authenticityScore: 50,
        engagementRateBps: 100,
      });
      expect(res.low).toBeGreaterThanOrEqual(10);
      expect(res.mid).toBeGreaterThanOrEqual(10);
      expect(res.high).toBeGreaterThanOrEqual(10);
      expect(res.dataQuality).toBe("ESTIMATED");
    });

    it("correctly estimates views for the 3 target personas within realistic benchmark ranges", () => {
      // Micro: 8K followers, 75% auth, 4.5% ER -> ~1,200 - 2,000 views
      const micro = estimateExpectedViews({
        platform: "INSTAGRAM",
        contentType: "REEL",
        followers: 8000,
        authenticityScore: 75,
        engagementRateBps: 450,
      });
      expect(micro.mid).toBeGreaterThanOrEqual(1200);
      expect(micro.mid).toBeLessThanOrEqual(2000);
      expect(micro.low).toBeLessThan(micro.mid);
      expect(micro.high).toBeGreaterThan(micro.mid);
      expect(micro.dataQuality).toBe("ESTIMATED");

      // Mid: 60K followers, 70% auth, 3.0% ER -> ~7,000 - 12,000 views
      const mid = estimateExpectedViews({
        platform: "INSTAGRAM",
        contentType: "REEL",
        followers: 60000,
        authenticityScore: 70,
        engagementRateBps: 300,
      });
      expect(mid.mid).toBeGreaterThanOrEqual(7000);
      expect(mid.mid).toBeLessThanOrEqual(12000);
      expect(mid.low).toBeLessThan(mid.mid);
      expect(mid.high).toBeGreaterThan(mid.mid);

      // Macro: 300K followers, 80% auth, 2.0% ER -> ~30,000 - 60,000 views
      const macro = estimateExpectedViews({
        platform: "INSTAGRAM",
        contentType: "REEL",
        followers: 300000,
        authenticityScore: 80,
        engagementRateBps: 200,
      });
      expect(macro.mid).toBeGreaterThanOrEqual(30000);
      expect(macro.mid).toBeLessThanOrEqual(60000);
      expect(macro.low).toBeLessThan(macro.mid);
      expect(macro.high).toBeGreaterThan(macro.mid);
    });

    it("blends with API-verified history only when deal count >= 3", () => {
      // With only 2 deals: unblended, ESTIMATED
      const unblended = estimateExpectedViews({
        platform: "INSTAGRAM",
        contentType: "REEL",
        followers: 50000,
        authenticityScore: 80,
        engagementRateBps: 300,
        history: [
          { views: 20000, isEstimated: false, metricsQuality: { views: "API" } },
          { views: 22000, isEstimated: false, metricsQuality: { views: "API" } },
        ],
      });
      expect(unblended.dataQuality).toBe("ESTIMATED");

      // With 3+ deals and VERIFIED quality: blended, VERIFIED
      const blended = estimateExpectedViews({
        platform: "INSTAGRAM",
        contentType: "REEL",
        followers: 50000,
        authenticityScore: 80,
        engagementRateBps: 300,
        history: [
          { views: 20000, isEstimated: false, metricsQuality: { views: "API" } },
          { views: 22000, isEstimated: false, metricsQuality: { views: "API" } },
          { views: 21000, isEstimated: false, metricsQuality: { views: "API" } },
        ],
      });
      expect(blended.dataQuality).toBe("VERIFIED");
      expect(blended.mid).toBeGreaterThan(unblended.mid);
    });
  });

  describe("Step 3: MatchingService Integration & CPV Correction", () => {
    const testCases = [
      {
        name: "Micro Persona (8K followers)",
        followers: 8000,
        authenticityScore: 75,
        engagementRateBps: 450, // 4.5%
        budgetPaise: 300000, // ₹3,000 market rate
        categories: ["fashion"],
        expectedViewsMin: 1200,
        expectedViewsMax: 2000,
        legacyViews: 270, // 8000 * 0.75 * 0.045 = 270
        legacyCpvPaise: 1111, // ₹11.11 / view
        legacyRoiScore: 10,
      },
      {
        name: "Mid Persona (60K followers)",
        followers: 60000,
        authenticityScore: 70,
        engagementRateBps: 300, // 3.0%
        budgetPaise: 1500000, // ₹15,000 market rate
        categories: ["tech"],
        expectedViewsMin: 7000,
        expectedViewsMax: 12000,
        legacyViews: 1260, // 60000 * 0.70 * 0.03 = 1260
        legacyCpvPaise: 1190, // ₹11.90 / view
        legacyRoiScore: 10,
      },
      {
        name: "Macro Persona (300K followers)",
        followers: 300000,
        authenticityScore: 80,
        engagementRateBps: 200, // 2.0%
        budgetPaise: 6000000, // ₹60,000 market rate
        categories: ["lifestyle"],
        expectedViewsMin: 30000,
        expectedViewsMax: 60000,
        legacyViews: 4800, // 300000 * 0.80 * 0.02 = 4800
        legacyCpvPaise: 1250, // ₹12.50 / view
        legacyRoiScore: 10,
      },
    ];

    for (const tc of testCases) {
      it(`evaluates ${tc.name} with realistic views, CPV and non-collapsed ROI`, async () => {
        const matchResult = await MatchingService.calculateMatchScore(
          {
            id: `camp-${tc.name}`,
            targetCategories: tc.categories,
            perInfluencerBudget: tc.budgetPaise,
          },
          {
            id: `inf-${tc.name}`,
            categories: tc.categories.join(", "),
            instagramFollowers: tc.followers,
            instagramEngagementRate: tc.engagementRateBps,
            youtubeSubscribers: 0,
            youtubeEngagementRate: 0,
            followerAuthenticityScore: tc.authenticityScore,
            averageRating: 450,
          },
          tc.budgetPaise,
          {
            preloadedQualityScore: 80,
            preloadedHistoricalEngagementRate: { rate: tc.engagementRateBps / 100, hasData: false },
          }
        );

        const { estimatedViews, estimatedCpvPaise, roiScore, viewsRange, dataQuality } =
          matchResult.matchBreakdown;

        // 1. Estimated views is within realistic reach bounds (not conflated with interactions)
        expect(estimatedViews).toBeGreaterThanOrEqual(tc.expectedViewsMin);
        expect(estimatedViews).toBeLessThanOrEqual(tc.expectedViewsMax);

        // 2. Realistic CPV: ₹1.50 - ₹2.50 (150 - 250 paise) vs legacy ~₹11 - ₹12 (1100 - 1250 paise)
        expect(estimatedCpvPaise).toBeGreaterThanOrEqual(140);
        expect(estimatedCpvPaise).toBeLessThanOrEqual(250);

        // 3. Views range and data quality are populated
        expect(viewsRange).toBeDefined();
        expect(viewsRange!.low).toBeLessThan(viewsRange!.mid);
        expect(viewsRange!.mid).toBeLessThan(viewsRange!.high);
        expect(dataQuality).toBe("ESTIMATED");

        // 4. In Mid Persona (tech @ ₹15,000), efficiency ratio is ~2.5x baseline, giving a healthy ROI score of 43 (vs 10)
        if (tc.name.includes("Mid")) {
          expect(roiScore).toBe(43);
        }
      });
    }

    it("awards high ROI score (70-85) when creator prices at or near category baseline CPV", async () => {
      // 60K tech creator offering rate of ₹6,000 (600,000 paise)
      // Estimated views ~9,173 -> CPV = 65 paise (matches tech category baseline of 65 paise!)
      const matchResult = await MatchingService.calculateMatchScore(
        {
          id: "camp-fair-pricing",
          targetCategories: ["tech"],
          perInfluencerBudget: 600000,
        },
        {
          id: "inf-fair-pricing",
          categories: "tech",
          instagramFollowers: 60000,
          instagramEngagementRate: 300,
          youtubeSubscribers: 0,
          youtubeEngagementRate: 0,
          followerAuthenticityScore: 70,
          averageRating: 450,
        },
        600000,
        {
          preloadedQualityScore: 80,
          preloadedHistoricalEngagementRate: { rate: 3.0, hasData: false },
        }
      );

      const { roiScore, estimatedCpvPaise, categoryBaselineCpvPaise } =
        matchResult.matchBreakdown;

      expect(categoryBaselineCpvPaise).toBe(65);
      expect(estimatedCpvPaise).toBe(65);
      // Perfect match with category baseline produces an ROI score in tier 3 (70 - 85)
      expect(roiScore).toBeGreaterThanOrEqual(75);
    });
  });
});
