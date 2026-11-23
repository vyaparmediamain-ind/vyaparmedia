import { describe, it, expect } from "vitest";
import {
  FAIR_PRICE_ENGINE_VERSION,
  DEFAULT_FAIR_PRICE_CONFIG,
  calculateFairPrice,
  compareQuotedRate,
  computeInputsHash,
  resolveFollowerTier,
  FairPriceInput,
} from "@/lib/fair-price-engine";

describe("Fair Price Engine (src/lib/fair-price-engine.ts)", () => {
  const baseInput: FairPriceInput = {
    platform: "INSTAGRAM",
    contentType: "REEL",
    followers: 25000, // micro
    engagementRateBps: 250, // 2.50% (micro benchmark)
    recentViews: [4000, 4200, 4500, 4800, 5000, 5200, 5500, 6000], // 8 views -> TRIMMED_MEAN_DROP_TOP2_BOTTOM2
    categoryBaselineCpvPaise: 65, // ₹0.65 (tech)
    authenticityScore: 75,
    drsScore: 600,
    deliverables: { count: 1 },
    dataQuality: "VERIFIED",
    quotedRatePaise: 350000, // ₹3,500
  };

  describe("1. Engine Version & Constants", () => {
    it("exports canonical FAIR_PRICE_ENGINE_VERSION = '1.0.0'", () => {
      expect(FAIR_PRICE_ENGINE_VERSION).toBe("1.0.0");
    });

    it("defines valid default configurations for all creator tiers", () => {
      expect(DEFAULT_FAIR_PRICE_CONFIG.tierFactors.nano).toBe(1.15);
      expect(DEFAULT_FAIR_PRICE_CONFIG.tierFactors.micro).toBe(1.05);
      expect(DEFAULT_FAIR_PRICE_CONFIG.tierFactors.mid).toBe(1.00);
      expect(DEFAULT_FAIR_PRICE_CONFIG.tierFactors.macro).toBe(0.90);

      expect(DEFAULT_FAIR_PRICE_CONFIG.rangeRatios.minRatio).toBe(0.85);
      expect(DEFAULT_FAIR_PRICE_CONFIG.rangeRatios.maxRatio).toBe(1.20);
      expect(DEFAULT_FAIR_PRICE_CONFIG.rangeRatios.widenedMinRatio).toBe(0.75);
      expect(DEFAULT_FAIR_PRICE_CONFIG.rangeRatios.widenedMaxRatio).toBe(1.35);
    });

    it("resolves follower tiers accurately", () => {
      expect(resolveFollowerTier(5000)).toBe("nano");
      expect(resolveFollowerTier(10000)).toBe("nano");
      expect(resolveFollowerTier(25000)).toBe("micro");
      expect(resolveFollowerTier(50000)).toBe("micro");
      expect(resolveFollowerTier(100000)).toBe("mid");
      expect(resolveFollowerTier(250000)).toBe("mid");
      expect(resolveFollowerTier(500000)).toBe("macro");
    });
  });

  describe("2. View Basis & Trimming Edge Cases (n = 0, 1, 4, 5, 7, 8, 12)", () => {
    it("handles n = 0 views: falls back to EXPECTED_VIEWS_HEURISTIC with LOW confidence and ESTIMATED data quality", () => {
      const input: FairPriceInput = {
        ...baseInput,
        recentViews: [],
        expectedViews: { low: 3000, mid: 4500, high: 6000 },
        dataQuality: "VERIFIED", // Even if input says VERIFIED, heuristic fallback sets it to ESTIMATED
      };

      const result = calculateFairPrice(input);
      expect(result.viewStatistic).toBe("EXPECTED_VIEWS_HEURISTIC");
      expect(result.expectedViews).toBe(4500);
      expect(result.confidence).toBe("LOW");
      expect(result.dataQuality).toBe("ESTIMATED");
      expect(result.flags).toContain("INSUFFICIENT_DATA");
      expect(result.flags).toContain("ESTIMATED_VIEWS");
    });

    it("handles n = 1 view: uses MEDIAN with LOW confidence", () => {
      const input: FairPriceInput = {
        ...baseInput,
        recentViews: [5000],
      };

      const result = calculateFairPrice(input);
      expect(result.viewStatistic).toBe("MEDIAN");
      expect(result.expectedViews).toBe(5000);
      expect(result.confidence).toBe("LOW");
      expect(result.flags).toContain("INSUFFICIENT_DATA");
    });

    it("handles n = 4 views: computes even MEDIAN with LOW confidence", () => {
      const input: FairPriceInput = {
        ...baseInput,
        recentViews: [1000, 3000, 5000, 9000],
      };

      const result = calculateFairPrice(input);
      expect(result.viewStatistic).toBe("MEDIAN");
      // Average of middle 2: (3000 + 5000) / 2 = 4000
      expect(result.expectedViews).toBe(4000);
      expect(result.confidence).toBe("LOW");
      expect(result.flags).toContain("INSUFFICIENT_DATA");
    });

    it("handles n = 5 views: drops top 1 and bottom 1 (TRIMMED_MEAN_DROP_TOP1_BOTTOM1) with MEDIUM confidence", () => {
      const input: FairPriceInput = {
        ...baseInput,
        // Sorted: [1000, 3000, 4000, 5000, 90000]
        // Drop 1000 and 90000 -> [3000, 4000, 5000] -> mean = 4000
        recentViews: [90000, 3000, 1000, 5000, 4000],
      };

      const result = calculateFairPrice(input);
      expect(result.viewStatistic).toBe("TRIMMED_MEAN_DROP_TOP1_BOTTOM1");
      expect(result.expectedViews).toBe(4000);
      expect(result.confidence).toBe("MEDIUM");
      expect(result.flags).not.toContain("INSUFFICIENT_DATA");
    });

    it("handles n = 7 views: drops top 1 and bottom 1 (TRIMMED_MEAN_DROP_TOP1_BOTTOM1) with MEDIUM confidence", () => {
      const input: FairPriceInput = {
        ...baseInput,
        // Sorted: [100, 2000, 3000, 4000, 5000, 6000, 100000]
        // Drop 100 and 100000 -> [2000, 3000, 4000, 5000, 6000] -> mean = 4000
        recentViews: [6000, 100, 4000, 100000, 2000, 5000, 3000],
      };

      const result = calculateFairPrice(input);
      expect(result.viewStatistic).toBe("TRIMMED_MEAN_DROP_TOP1_BOTTOM1");
      expect(result.expectedViews).toBe(4000);
      expect(result.confidence).toBe("MEDIUM");
    });

    it("handles n = 8 views: drops top 2 and bottom 2 (TRIMMED_MEAN_DROP_TOP2_BOTTOM2) with HIGH confidence", () => {
      const input: FairPriceInput = {
        ...baseInput,
        // Sorted: [50, 100, 3000, 4000, 5000, 6000, 80000, 90000]
        // Drop [50, 100] and [80000, 90000] -> [3000, 4000, 5000, 6000] -> mean = 4500
        recentViews: [50, 80000, 4000, 90000, 3000, 100, 6000, 5000],
      };

      const result = calculateFairPrice(input);
      expect(result.viewStatistic).toBe("TRIMMED_MEAN_DROP_TOP2_BOTTOM2");
      expect(result.expectedViews).toBe(4500);
      expect(result.confidence).toBe("HIGH");
      expect(result.flags).not.toContain("INSUFFICIENT_DATA");
    });

    it("handles n = 12 views: drops top 2 and bottom 2 (TRIMMED_MEAN_DROP_TOP2_BOTTOM2)", () => {
      const input: FairPriceInput = {
        ...baseInput,
        recentViews: [100, 200, 3000, 3500, 4000, 4500, 5000, 5500, 6000, 6500, 80000, 90000],
      };

      const result = calculateFairPrice(input);
      expect(result.viewStatistic).toBe("TRIMMED_MEAN_DROP_TOP2_BOTTOM2");
      // Remaining 8 items: 3000, 3500, 4000, 4500, 5000, 5500, 6000, 6500
      // Sum = 38000 / 8 = 4750
      expect(result.expectedViews).toBe(4750);
      expect(result.confidence).toBe("HIGH");
    });
  });

  describe("3. Input Hygiene & Robustness", () => {
    it("handles negative followers, NaN, or non-finite inputs cleanly", () => {
      const dirtyInput: FairPriceInput = {
        platform: "INSTAGRAM",
        contentType: "REEL",
        followers: -5000,
        engagementRateBps: Number.NaN,
        recentViews: [-100, Number.NaN, 0, 4000, 5000],
        categoryBaselineCpvPaise: -20,
        authenticityScore: Number.NaN,
        drsScore: Number.NaN,
        deliverables: { count: -2 },
        dataQuality: "VERIFIED",
      };

      const result = calculateFairPrice(dirtyInput);
      expect(result.expectedViews).toBeGreaterThan(0);
      expect(result.basePaise).toBeGreaterThan(0);
      expect(result.minPaise).toBeGreaterThan(0);
      expect(result.maxPaise).toBeGreaterThan(result.minPaise);
      expect(Number.isInteger(result.basePaise)).toBe(true);
      expect(Number.isInteger(result.minPaise)).toBe(true);
      expect(Number.isInteger(result.maxPaise)).toBe(true);
    });

    it("handles completely empty views array with missing expectedViews gracefully", () => {
      const emptyInput: FairPriceInput = {
        platform: "YOUTUBE",
        contentType: "VIDEO",
        followers: 10000,
        categoryBaselineCpvPaise: 100,
        authenticityScore: 80,
        deliverables: { count: 1 },
        dataQuality: "ESTIMATED",
      };

      const result = calculateFairPrice(emptyInput);
      expect(result.viewStatistic).toBe("EXPECTED_VIEWS_HEURISTIC");
      expect(result.confidence).toBe("LOW");
      expect(result.expectedViews).toBeGreaterThanOrEqual(10);
    });
  });

  describe("4. Quality Multipliers & Clamping Verification", () => {
    it("clamps quality multiplier to [0.60, 1.40] under extreme low values", () => {
      const lowQualityInput: FairPriceInput = {
        ...baseInput,
        engagementRateBps: 10, // Extreme low ER (0.1%)
        authenticityScore: 10, // Terrible authenticity
        drsScore: 300,         // Worst DRS score
      };

      const result = calculateFairPrice(lowQualityInput);
      const qualityExplanation = result.explanation.find((e) => e.step === "QUALITY_MULTIPLIER");
      expect(qualityExplanation).toBeDefined();
      expect(qualityExplanation?.multiplier).toBe(0.60);
    });

    it("clamps quality multiplier to [0.60, 1.40] under extreme high values", () => {
      const highQualityInput: FairPriceInput = {
        ...baseInput,
        engagementRateBps: 2000, // 20% ER
        authenticityScore: 100,  // Perfect authenticity
        drsScore: 900,           // Maximum DRS
      };

      const result = calculateFairPrice(highQualityInput);
      const qualityExplanation = result.explanation.find((e) => e.step === "QUALITY_MULTIPLIER");
      expect(qualityExplanation).toBeDefined();
      expect(qualityExplanation?.multiplier).toBe(1.40);
    });

    it("ensures DRS contribution alone is strictly bounded within [-10%, +10%]", () => {
      // DRS = 600 is neutral
      const neutralDrs = calculateFairPrice({ ...baseInput, drsScore: 600 });
      // DRS = 900 is max (+10%)
      const maxDrs = calculateFairPrice({ ...baseInput, drsScore: 900 });
      // DRS = 300 is min (-10%)
      const minDrs = calculateFairPrice({ ...baseInput, drsScore: 300 });

      // Comparing quality step multiplier or adjusted paise
      const neutralExpl = neutralDrs.explanation.find((e) => e.step === "QUALITY_MULTIPLIER")!;
      const maxExpl = maxDrs.explanation.find((e) => e.step === "QUALITY_MULTIPLIER")!;
      const minExpl = minDrs.explanation.find((e) => e.step === "QUALITY_MULTIPLIER")!;

      // Neutral has DRS multiplier 1.000
      expect(neutralExpl.description).toContain("DRS: 1.000x");
      expect(maxExpl.description).toContain("DRS: 1.100x");
      expect(minExpl.description).toContain("DRS: 0.900x");
    });
  });

  describe("5. Add-ons & Deliverables Pricing", () => {
    it("correctly prices multiple deliverables and optional add-ons", () => {
      const singleDeliverable = calculateFairPrice(baseInput);

      const multiWithAddOns = calculateFairPrice({
        ...baseInput,
        deliverables: {
          count: 2,               // 2 deliverables
          stories: 2,             // 2 stories (15% each = 30%)
          usageRightsDays: 60,    // 2 x 30-day blocks (20% each = 40%)
          exclusivityMonths: 1,   // 1 month (25%)
          rawFootage: true,       // raw footage (30%)
        },
      });

      // Total add-ons: 30% + 40% + 25% + 30% = 125% of single deliverable
      // Total deliverables: 2x = 200% of single deliverable
      // Overall = 325% of single deliverable
      expect(multiWithAddOns.basePaise).toBeGreaterThan(singleDeliverable.basePaise * 3);
    });
  });

  describe("6. Widening Rules & Band Ratios", () => {
    it("applies standard band [0.85x, 1.20x] when data is VERIFIED and confidence is HIGH", () => {
      const result = calculateFairPrice(baseInput); // 8 views, VERIFIED -> HIGH confidence
      expect(result.confidence).toBe("HIGH");
      expect(result.dataQuality).toBe("VERIFIED");

      const expectedMin = Math.round(result.basePaise * 0.85);
      const expectedMax = Math.round(result.basePaise * 1.20);
      expect(result.minPaise).toBe(expectedMin);
      expect(result.maxPaise).toBe(expectedMax);
    });

    it("applies widened band [0.75x, 1.35x] when confidence is LOW or data is ESTIMATED", () => {
      const result = calculateFairPrice({
        ...baseInput,
        recentViews: [4000], // 1 view -> LOW confidence
        dataQuality: "ESTIMATED",
      });

      expect(result.confidence).toBe("LOW");
      const expectedMin = Math.round(result.basePaise * 0.75);
      const expectedMax = Math.round(result.basePaise * 1.35);
      expect(result.minPaise).toBe(expectedMin);
      expect(result.maxPaise).toBe(expectedMax);
    });
  });

  describe("7. Monotonicity & Determinism", () => {
    it("satisfies monotonicity: increasing recentViews never reduces market range", () => {
      const lowViews = calculateFairPrice({
        ...baseInput,
        recentViews: [2000, 2200, 2400, 2600, 2800, 3000, 3200, 3400],
      });

      const highViews = calculateFairPrice({
        ...baseInput,
        recentViews: [5000, 5200, 5400, 5600, 5800, 6000, 6200, 6400],
      });

      expect(highViews.basePaise).toBeGreaterThan(lowViews.basePaise);
      expect(highViews.minPaise).toBeGreaterThan(lowViews.minPaise);
      expect(highViews.maxPaise).toBeGreaterThan(lowViews.maxPaise);
    });

    it("satisfies strict determinism: identical inputs generate identical output and identical hash", () => {
      const run1 = calculateFairPrice(baseInput);
      const run2 = calculateFairPrice(baseInput);
      const hash1 = computeInputsHash(baseInput);
      const hash2 = computeInputsHash(baseInput);

      expect(run1).toEqual(run2);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });
  });

  describe("8. Flags Detection", () => {
    it("flags LOW_REACH_RATIO when expected views are under 5% of followers", () => {
      const result = calculateFairPrice({
        ...baseInput,
        followers: 200000, // 200k followers
        recentViews: [1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700], // ~1400 views (< 1%)
      });

      expect(result.flags).toContain("LOW_REACH_RATIO");
    });

    it("flags LOW_ENGAGEMENT and LOW_AUTHENTICITY when metrics breach thresholds", () => {
      const result = calculateFairPrice({
        ...baseInput,
        engagementRateBps: 80, // Well below micro benchmark (250 bps * 0.6 = 150 bps)
        authenticityScore: 50, // Below 60
      });

      expect(result.flags).toContain("LOW_ENGAGEMENT");
      expect(result.flags).toContain("LOW_AUTHENTICITY");
    });

    it("flags PROFILE_STALE when profile update timestamp is past threshold", () => {
      const clock = new Date("2026-11-22T12:00:00Z");
      const staleDate = new Date("2026-08-01T12:00:00Z"); // > 100 days old

      const result = calculateFairPrice({
        ...baseInput,
        profileUpdatedAt: staleDate,
        now: clock,
      });

      expect(result.flags).toContain("PROFILE_STALE");
    });

    it("flags RATE_ABOVE_RANGE and RATE_BELOW_RANGE for quotes outside band", () => {
      const aboveResult = calculateFairPrice({
        ...baseInput,
        quotedRatePaise: 5000000, // ₹50,000 (vastly above range)
      });
      expect(aboveResult.flags).toContain("RATE_ABOVE_RANGE");

      const belowResult = calculateFairPrice({
        ...baseInput,
        quotedRatePaise: 5000, // ₹50 (vastly below range)
      });
      expect(belowResult.flags).toContain("RATE_BELOW_RANGE");
    });
  });

  describe("9. compareQuotedRate & Copy Mandate", () => {
    it("evaluates WITHIN range correctly with approved copy", () => {
      const output = calculateFairPrice(baseInput);
      const midPaise = Math.round((output.minPaise + output.maxPaise) / 2);

      const comparison = compareQuotedRate(midPaise, output);
      expect(comparison.position).toBe("WITHIN");
      expect(comparison.statusMessage).toContain("within the estimated market range");
      // STRICT COPY MANDATE: never contains "fair price" or "guaranteed price"
      expect(comparison.statusMessage.toLowerCase()).not.toContain("fair price");
      expect(comparison.statusMessage.toLowerCase()).not.toContain("guaranteed price");
    });

    it("evaluates BELOW range correctly with approved copy", () => {
      const output = calculateFairPrice(baseInput);
      const lowPaise = output.minPaise - 50000;

      const comparison = compareQuotedRate(lowPaise, output);
      expect(comparison.position).toBe("BELOW");
      expect(comparison.statusMessage).toContain("is below the estimated market range");
      expect(comparison.statusMessage.toLowerCase()).not.toContain("fair price");
      expect(comparison.statusMessage.toLowerCase()).not.toContain("guaranteed price");
    });

    it("evaluates ABOVE range correctly with approved copy", () => {
      const output = calculateFairPrice(baseInput);
      const highPaise = output.maxPaise + 100000;

      const comparison = compareQuotedRate(highPaise, output);
      expect(comparison.position).toBe("ABOVE");
      expect(comparison.statusMessage).toContain("is above the estimated market range");
      expect(comparison.statusMessage.toLowerCase()).not.toContain("fair price");
      expect(comparison.statusMessage.toLowerCase()).not.toContain("guaranteed price");
    });
  });

  describe("10. Explanation Structure & Contribution Accounting", () => {
    it("contains exhaustive step breakdown where contributions sum to finalBasePaise", () => {
      const result = calculateFairPrice(baseInput);
      const steps = result.explanation.map((e) => e.step);

      expect(steps).toContain("VIEWS_BASIS");
      expect(steps).toContain("BASE_CPV_VALUE");
      expect(steps).toContain("FOLLOWER_TIER_FACTOR");
      expect(steps).toContain("QUALITY_MULTIPLIER");
      expect(steps).toContain("DELIVERABLES_AND_ADDONS");
      expect(steps).toContain("MARKET_RANGE");

      // Verify the running total matches basePaise
      const lastCalculationStep = result.explanation.find((e) => e.step === "DELIVERABLES_AND_ADDONS");
      expect(lastCalculationStep?.runningTotalPaise).toBe(result.basePaise);
    });
  });
});
