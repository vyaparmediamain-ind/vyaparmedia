import { describe, it, expect } from "vitest";
import {
  calculateBacktestMetrics,
  generateBacktestMarkdownReport,
  computeMedian,
  BacktestDealItem,
  MIN_BACKTEST_SAMPLE_SIZE,
} from "@/lib/backtest-math";

describe("Backtest Math & Accuracy Reporting", () => {
  describe("1. computeMedian helper", () => {
    it("handles empty arrays", () => {
      expect(computeMedian([])).toBe(0);
    });

    it("computes median for odd length array", () => {
      expect(computeMedian([10, 5, 20])).toBe(10);
    });

    it("computes median for even length array", () => {
      expect(computeMedian([10, 20, 30, 40])).toBe(25);
    });
  });

  describe("2. Minimum Sample Size Guard (< 10 deals)", () => {
    it("returns INSUFFICIENT_DATA when sample size is below threshold", () => {
      expect(MIN_BACKTEST_SAMPLE_SIZE).toBe(10);
      const fewDeals: BacktestDealItem[] = [
        {
          dealId: "d-1",
          category: "fashion",
          followerTier: "micro",
          dealAmountPaise: 500000,
          engineMinPaise: 400000,
          engineMaxPaise: 600000,
          engineMidPaise: 500000,
          views: 15000,
          viewsQuality: "API",
          dealDate: new Date(),
        },
      ];

      const result = calculateBacktestMetrics(fewDeals, 5);
      expect(result.status).toBe("INSUFFICIENT_DATA");
      expect(result.verifiedDealsCount).toBe(1);
      expect(result.totalCompletedDeals).toBe(5);
      expect(result.withinRangePercent).toBe(0);
      expect(result.warningBanner).toContain("INSUFFICIENT_DATA");

      const report = generateBacktestMarkdownReport(result, "2026-11-22");
      expect(report).toContain("STATUS: INSUFFICIENT DATA");
      expect(report).toContain("Minimum required sample size is **10 deals**");
    });
  });

  describe("3. Sufficient Data Calculations (>= 10 deals)", () => {
    const syntheticDeals: BacktestDealItem[] = [
      // 7 Deals within range
      {
        dealId: "d-1",
        category: "fashion",
        followerTier: "nano",
        dealAmountPaise: 200000, // ₹2,000
        engineMinPaise: 180000,
        engineMaxPaise: 240000,
        engineMidPaise: 210000,
        views: 3000,
        viewsQuality: "API",
        dealDate: new Date(),
      },
      {
        dealId: "d-2",
        category: "fashion",
        followerTier: "micro",
        dealAmountPaise: 500000,
        engineMinPaise: 450000,
        engineMaxPaise: 550000,
        engineMidPaise: 500000, // exact match
        views: 12000,
        viewsQuality: "API",
        dealDate: new Date(),
      },
      {
        dealId: "d-3",
        category: "tech",
        followerTier: "mid",
        dealAmountPaise: 1500000,
        engineMinPaise: 1300000,
        engineMaxPaise: 1700000,
        engineMidPaise: 1500000,
        views: 28000,
        viewsQuality: "API",
        dealDate: new Date(),
      },
      {
        dealId: "d-4",
        category: "tech",
        followerTier: "micro",
        dealAmountPaise: 600000,
        engineMinPaise: 500000,
        engineMaxPaise: 700000,
        engineMidPaise: 600000,
        views: 10000,
        viewsQuality: "API",
        dealDate: new Date(),
      },
      {
        dealId: "d-5",
        category: "finance",
        followerTier: "mid",
        dealAmountPaise: 2200000,
        engineMinPaise: 2000000,
        engineMaxPaise: 2600000,
        engineMidPaise: 2300000,
        views: 35000,
        viewsQuality: "API",
        dealDate: new Date(),
      },
      {
        dealId: "d-6",
        category: "finance",
        followerTier: "macro",
        dealAmountPaise: 5000000,
        engineMinPaise: 4500000,
        engineMaxPaise: 5800000,
        engineMidPaise: 5100000,
        views: 90000,
        viewsQuality: "API",
        dealDate: new Date(),
      },
      {
        dealId: "d-7",
        category: "fitness",
        followerTier: "nano",
        dealAmountPaise: 150000,
        engineMinPaise: 140000,
        engineMaxPaise: 190000,
        engineMidPaise: 160000,
        views: 2500,
        viewsQuality: "API",
        dealDate: new Date(),
      },
      // 2 Overpriced deals
      {
        dealId: "d-8",
        category: "tech",
        followerTier: "micro",
        dealAmountPaise: 1200000, // ₹12,000 (Range max is ₹7,000)
        engineMinPaise: 500000,
        engineMaxPaise: 700000,
        engineMidPaise: 600000,
        views: 11000,
        viewsQuality: "API",
        dealDate: new Date(),
      },
      {
        dealId: "d-9",
        category: "fashion",
        followerTier: "nano",
        dealAmountPaise: 400000, // ₹4,000 (Range max is ₹2,500)
        engineMinPaise: 180000,
        engineMaxPaise: 250000,
        engineMidPaise: 215000,
        views: 3200,
        viewsQuality: "API",
        dealDate: new Date(),
      },
      // 1 Underpriced deal
      {
        dealId: "d-10",
        category: "fitness",
        followerTier: "mid",
        dealAmountPaise: 600000, // ₹6,000 (Range min is ₹8,000)
        engineMinPaise: 800000,
        engineMaxPaise: 1200000,
        engineMidPaise: 1000000,
        views: 20000,
        viewsQuality: "API",
        dealDate: new Date(),
      },
    ];

    it("calculates accurate summary metrics for 10 deals", () => {
      const result = calculateBacktestMetrics(syntheticDeals);

      expect(result.status).toBe("SUFFICIENT_DATA");
      expect(result.verifiedDealsCount).toBe(10);
      expect(result.withinRangeCount).toBe(7);
      expect(result.withinRangePercent).toBe(70); // 70.0% within range
      expect(result.medianAbsolutePercentageError).toBeGreaterThan(0);

      // Verify category bias
      expect(result.categoryBias.fashion).toBeDefined();
      expect(result.categoryBias.fashion?.count).toBe(3);
      expect(result.categoryBias.tech?.count).toBe(3);

      // Verify tier bias
      expect(result.tierBias.nano.count).toBe(3);
      expect(result.tierBias.micro.count).toBe(3);
      expect(result.tierBias.mid.count).toBe(3);
      expect(result.tierBias.macro.count).toBe(1);

      // Verify worst cases
      expect(result.worstCases.topOverpriced).toHaveLength(2);
      expect(result.worstCases.topOverpriced[0]?.dealId).toBe("d-8"); // Highest deviation
      expect(result.worstCases.topUnderpriced).toHaveLength(1);
      expect(result.worstCases.topUnderpriced[0]?.dealId).toBe("d-10");
    });

    it("generates markdown report with tables and headers", () => {
      const result = calculateBacktestMetrics(syntheticDeals);
      const report = generateBacktestMarkdownReport(result, "2026-11-22");

      expect(report).toContain("# Fair Price Engine Backtest Report (2026-11-22)");
      expect(report).toContain("SUFFICIENT_DATA");
      expect(report).toContain("70%");
      expect(report).toContain("## 2. Category Bias Analysis");
      expect(report).toContain("## 3. Follower Tier Bias Analysis");
      expect(report).toContain("## 4. Worst-Case Outlier Analysis");
      expect(report).toContain("`d-8`");
      expect(report).toContain("`d-10`");
    });
  });
});
