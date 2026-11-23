/**
 * Backtest Math & Statistical Analysis (Pure Logic)
 *
 * Compares completed deals with API-verified views against Fair Price Engine ranges:
 * - Computes percentage of deals falling strictly within predicted estimated market range.
 * - Calculates Median Absolute Percentage Error (MAPE).
 * - Computes valuation bias across categories (over/under valuation tendency).
 * - Computes valuation bias across follower tiers (nano, micro, mid, macro).
 * - Identifies top outliers (worst cases: most overpriced and most underpriced deals).
 * - Strictly enforces sample size threshold: minimum 10 deals. Returns "INSUFFICIENT_DATA"
 *   when sample size < 10 so accuracy claims are never published on small samples.
 */

import { CreatorFollowerTier } from "./fair-price-engine";

export const MIN_BACKTEST_SAMPLE_SIZE = 10;

export interface BacktestDealItem {
  dealId: string;
  campaignTitle?: string;
  influencerName?: string;
  category: string;
  followerTier: CreatorFollowerTier;
  dealAmountPaise: number;
  engineMinPaise: number;
  engineMaxPaise: number;
  engineMidPaise: number;
  views: number;
  viewsQuality: "API" | "ESTIMATED" | "DERIVED";
  dealDate: Date;
}

export interface CategoryBiasStat {
  category: string;
  count: number;
  meanDeltaPaise: number;
  meanDeltaRupees: string;
  meanPercentageBias: number; // positive = engine higher than deal (underpriced deals), negative = engine lower than deal
  withinRangePercent: number;
}

export interface TierBiasStat {
  tier: CreatorFollowerTier;
  count: number;
  meanDeltaPaise: number;
  meanDeltaRupees: string;
  meanPercentageBias: number;
  withinRangePercent: number;
}

export interface DealOutlier {
  dealId: string;
  category: string;
  followerTier: CreatorFollowerTier;
  dealAmountPaise: number;
  dealAmountRupees: string;
  engineMinRupees: string;
  engineMaxRupees: string;
  engineMidRupees: string;
  errorPaise: number;
  errorRupees: string;
  errorPercent: number;
  direction: "OVERPRICED_DEAL" | "UNDERPRICED_DEAL";
}

export interface BacktestResult {
  status: "SUFFICIENT_DATA" | "INSUFFICIENT_DATA";
  totalCompletedDeals: number;
  verifiedDealsCount: number;
  withinRangeCount: number;
  withinRangePercent: number;
  medianAbsolutePercentageError: number; // MAPE (e.g. 14.5%)
  categoryBias: Record<string, CategoryBiasStat>;
  tierBias: Record<CreatorFollowerTier, TierBiasStat>;
  worstCases: {
    topOverpriced: DealOutlier[];
    topUnderpriced: DealOutlier[];
  };
  warningBanner?: string;
}

/**
 * Computes median of a numerical array.
 */
export function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return ((sorted[mid - 1] ?? sorted[mid]!) + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

/**
 * Pure function to calculate comprehensive backtest statistics on deal records.
 */
export function calculateBacktestMetrics(
  deals: BacktestDealItem[],
  totalCompletedDealsCount = deals.length
): BacktestResult {
  const verifiedDeals = deals.filter((d) => d.viewsQuality === "API" && d.views > 0);
  const count = verifiedDeals.length;

  if (count < MIN_BACKTEST_SAMPLE_SIZE) {
    return {
      status: "INSUFFICIENT_DATA",
      totalCompletedDeals: totalCompletedDealsCount,
      verifiedDealsCount: count,
      withinRangeCount: 0,
      withinRangePercent: 0,
      medianAbsolutePercentageError: 0,
      categoryBias: {},
      tierBias: {
        nano: { tier: "nano", count: 0, meanDeltaPaise: 0, meanDeltaRupees: "0.00", meanPercentageBias: 0, withinRangePercent: 0 },
        micro: { tier: "micro", count: 0, meanDeltaPaise: 0, meanDeltaRupees: "0.00", meanPercentageBias: 0, withinRangePercent: 0 },
        mid: { tier: "mid", count: 0, meanDeltaPaise: 0, meanDeltaRupees: "0.00", meanPercentageBias: 0, withinRangePercent: 0 },
        macro: { tier: "macro", count: 0, meanDeltaPaise: 0, meanDeltaRupees: "0.00", meanPercentageBias: 0, withinRangePercent: 0 },
      },
      worstCases: { topOverpriced: [], topUnderpriced: [] },
      warningBanner: `INSUFFICIENT_DATA: Sample size (${count} API-verified deals) is below the minimum statistical threshold of ${MIN_BACKTEST_SAMPLE_SIZE}. Accuracy claims cannot be published until sample size requirements are met.`,
    };
  }

  // 1. Within Range & Errors
  let withinRangeCount = 0;
  const percentageErrors: number[] = [];

  const categoryBuckets: Record<string, BacktestDealItem[]> = {};
  const tierBuckets: Record<CreatorFollowerTier, BacktestDealItem[]> = {
    nano: [],
    micro: [],
    mid: [],
    macro: [],
  };

  const overpricedOutliers: DealOutlier[] = [];
  const underpricedOutliers: DealOutlier[] = [];

  for (const deal of verifiedDeals) {
    const isWithin =
      deal.dealAmountPaise >= deal.engineMinPaise &&
      deal.dealAmountPaise <= deal.engineMaxPaise;

    if (isWithin) {
      withinRangeCount++;
    }

    // Absolute Percentage Error relative to engine midpoint
    const ape =
      deal.engineMidPaise > 0
        ? Math.abs(deal.dealAmountPaise - deal.engineMidPaise) / deal.engineMidPaise
        : 0;
    percentageErrors.push(ape);

    // Grouping by Category
    const cat = deal.category.toLowerCase().trim() || "general";
    if (!categoryBuckets[cat]) categoryBuckets[cat] = [];
    categoryBuckets[cat].push(deal);

    // Grouping by Follower Tier
    tierBuckets[deal.followerTier]?.push(deal);

    // Check outliers
    if (deal.dealAmountPaise > deal.engineMaxPaise) {
      const errorPaise = deal.dealAmountPaise - deal.engineMaxPaise;
      const errorPercent =
        deal.engineMaxPaise > 0
          ? Math.round((errorPaise / deal.engineMaxPaise) * 10000) / 100
          : 0;
      overpricedOutliers.push({
        dealId: deal.dealId,
        category: deal.category,
        followerTier: deal.followerTier,
        dealAmountPaise: deal.dealAmountPaise,
        dealAmountRupees: (deal.dealAmountPaise / 100).toFixed(2),
        engineMinRupees: (deal.engineMinPaise / 100).toFixed(2),
        engineMaxRupees: (deal.engineMaxPaise / 100).toFixed(2),
        engineMidRupees: (deal.engineMidPaise / 100).toFixed(2),
        errorPaise,
        errorRupees: (errorPaise / 100).toFixed(2),
        errorPercent,
        direction: "OVERPRICED_DEAL",
      });
    } else if (deal.dealAmountPaise < deal.engineMinPaise) {
      const errorPaise = deal.engineMinPaise - deal.dealAmountPaise;
      const errorPercent =
        deal.engineMinPaise > 0
          ? Math.round((errorPaise / deal.engineMinPaise) * 10000) / 100
          : 0;
      underpricedOutliers.push({
        dealId: deal.dealId,
        category: deal.category,
        followerTier: deal.followerTier,
        dealAmountPaise: deal.dealAmountPaise,
        dealAmountRupees: (deal.dealAmountPaise / 100).toFixed(2),
        engineMinRupees: (deal.engineMinPaise / 100).toFixed(2),
        engineMaxRupees: (deal.engineMaxPaise / 100).toFixed(2),
        engineMidRupees: (deal.engineMidPaise / 100).toFixed(2),
        errorPaise,
        errorRupees: (errorPaise / 100).toFixed(2),
        errorPercent,
        direction: "UNDERPRICED_DEAL",
      });
    }
  }

  // 2. Aggregate Percentages
  const withinRangePercent = Math.round((withinRangeCount / count) * 10000) / 100;
  const mape = Math.round(computeMedian(percentageErrors) * 10000) / 100;

  // 3. Category Bias Calculation
  const categoryBias: Record<string, CategoryBiasStat> = {};
  for (const [cat, items] of Object.entries(categoryBuckets)) {
    const catCount = items.length;
    const deltas = items.map((i) => i.dealAmountPaise - i.engineMidPaise);
    const meanDelta = Math.round(deltas.reduce((a, b) => a + b, 0) / catCount);
    const pctDeltas = items.map((i) =>
      i.engineMidPaise > 0
        ? ((i.dealAmountPaise - i.engineMidPaise) / i.engineMidPaise) * 100
        : 0
    );
    const meanPct = Math.round((pctDeltas.reduce((a, b) => a + b, 0) / catCount) * 100) / 100;
    const inRange = items.filter(
      (i) => i.dealAmountPaise >= i.engineMinPaise && i.dealAmountPaise <= i.engineMaxPaise
    ).length;

    categoryBias[cat] = {
      category: cat,
      count: catCount,
      meanDeltaPaise: meanDelta,
      meanDeltaRupees: (meanDelta / 100).toFixed(2),
      meanPercentageBias: meanPct,
      withinRangePercent: Math.round((inRange / catCount) * 10000) / 100,
    };
  }

  // 4. Tier Bias Calculation
  const tierBias: Record<CreatorFollowerTier, TierBiasStat> = {
    nano: { tier: "nano", count: 0, meanDeltaPaise: 0, meanDeltaRupees: "0.00", meanPercentageBias: 0, withinRangePercent: 0 },
    micro: { tier: "micro", count: 0, meanDeltaPaise: 0, meanDeltaRupees: "0.00", meanPercentageBias: 0, withinRangePercent: 0 },
    mid: { tier: "mid", count: 0, meanDeltaPaise: 0, meanDeltaRupees: "0.00", meanPercentageBias: 0, withinRangePercent: 0 },
    macro: { tier: "macro", count: 0, meanDeltaPaise: 0, meanDeltaRupees: "0.00", meanPercentageBias: 0, withinRangePercent: 0 },
  };

  for (const tier of ["nano", "micro", "mid", "macro"] as CreatorFollowerTier[]) {
    const items = tierBuckets[tier];
    if (items.length > 0) {
      const tierCount = items.length;
      const deltas = items.map((i) => i.dealAmountPaise - i.engineMidPaise);
      const meanDelta = Math.round(deltas.reduce((a, b) => a + b, 0) / tierCount);
      const pctDeltas = items.map((i) =>
        i.engineMidPaise > 0
          ? ((i.dealAmountPaise - i.engineMidPaise) / i.engineMidPaise) * 100
          : 0
      );
      const meanPct = Math.round((pctDeltas.reduce((a, b) => a + b, 0) / tierCount) * 100) / 100;
      const inRange = items.filter(
        (i) => i.dealAmountPaise >= i.engineMinPaise && i.dealAmountPaise <= i.engineMaxPaise
      ).length;

      tierBias[tier] = {
        tier,
        count: tierCount,
        meanDeltaPaise: meanDelta,
        meanDeltaRupees: (meanDelta / 100).toFixed(2),
        meanPercentageBias: meanPct,
        withinRangePercent: Math.round((inRange / tierCount) * 10000) / 100,
      };
    }
  }

  // 5. Sort worst cases by absolute magnitude of error
  overpricedOutliers.sort((a, b) => b.errorPaise - a.errorPaise);
  underpricedOutliers.sort((a, b) => b.errorPaise - a.errorPaise);

  return {
    status: "SUFFICIENT_DATA",
    totalCompletedDeals: totalCompletedDealsCount,
    verifiedDealsCount: count,
    withinRangeCount,
    withinRangePercent,
    medianAbsolutePercentageError: mape,
    categoryBias,
    tierBias,
    worstCases: {
      topOverpriced: overpricedOutliers.slice(0, 5),
      topUnderpriced: underpricedOutliers.slice(0, 5),
    },
  };
}

/**
 * Generates an executive Markdown report from backtest results.
 */
export function generateBacktestMarkdownReport(
  result: BacktestResult,
  dateStr: string
): string {
  if (result.status === "INSUFFICIENT_DATA") {
    return `# Fair Price Engine Backtest Report (${dateStr})

> [!WARNING]
> **STATUS: INSUFFICIENT DATA**
>
> Evaluated ${result.verifiedDealsCount} completed deal(s) with API-verified view delivery out of ${result.totalCompletedDeals} total completed deal(s).
> Minimum required sample size is **${MIN_BACKTEST_SAMPLE_SIZE} deals**.
>
> In accordance with platform governance rules, accuracy claims, MAPE figures, and calibration bias percentages are **withheld** until the sample size meets statistical validity requirements.

---

## Executive Summary
- **Evaluation Status**: INSUFFICIENT_DATA
- **Total Completed Deals Evaluated**: ${result.totalCompletedDeals}
- **Deals with API-Verified View Delivery**: ${result.verifiedDealsCount}
- **Threshold Required for Publication**: ${MIN_BACKTEST_SAMPLE_SIZE} deals

## Recommendations
1. Encourage platform brands and creators to complete Instagram Graph API OAuth verification.
2. Allow additional production deals to run their 7-day post-delivery monitoring lifecycle.
3. Re-run \`scripts/backtest-fair-price.ts\` once at least ${MIN_BACKTEST_SAMPLE_SIZE} API-verified completed deals are archived.
`;
  }

  const categoryRows = Object.values(result.categoryBias)
    .sort((a, b) => b.count - a.count)
    .map(
      (c) =>
        `| ${c.category.toUpperCase()} | ${c.count} | ₹${c.meanDeltaRupees} | ${c.meanPercentageBias > 0 ? "+" : ""}${c.meanPercentageBias}% | ${c.withinRangePercent}% |`
    )
    .join("\n");

  const tierRows = Object.values(result.tierBias)
    .map(
      (t) =>
        `| ${t.tier.toUpperCase()} | ${t.count} | ₹${t.meanDeltaRupees} | ${t.meanPercentageBias > 0 ? "+" : ""}${t.meanPercentageBias}% | ${t.withinRangePercent}% |`
    )
    .join("\n");

  const overpricedRows =
    result.worstCases.topOverpriced.length > 0
      ? result.worstCases.topOverpriced
          .map(
            (o) =>
              `| \`${o.dealId}\` | ${o.category} | ${o.followerTier} | ₹${o.dealAmountRupees} | ₹${o.engineMinRupees} – ₹${o.engineMaxRupees} | +₹${o.errorRupees} (+${o.errorPercent}%) |`
          )
          .join("\n")
      : "| _None_ | - | - | - | - | - |";

  const underpricedRows =
    result.worstCases.topUnderpriced.length > 0
      ? result.worstCases.topUnderpriced
          .map(
            (u) =>
              `| \`${u.dealId}\` | ${u.category} | ${u.followerTier} | ₹${u.dealAmountRupees} | ₹${u.engineMinRupees} – ₹${u.engineMaxRupees} | -₹${u.errorRupees} (-${u.errorPercent}%) |`
          )
          .join("\n")
      : "| _None_ | - | - | - | - | - |";

  return `# Fair Price Engine Backtest Report (${dateStr})

> [!NOTE]
> Backtest executed across historical completed platform deals. Deal amounts are evaluated against the pure Fair Price Engine range using historical parameters as-of each deal's completion date.

---

## 1. Key Performance Metrics
- **Total Completed Deals in Database**: ${result.totalCompletedDeals}
- **Deals with API-Quality Verified Views**: ${result.verifiedDealsCount}
- **Deals Within Estimated Market Range**: **${result.withinRangePercent}%** (${result.withinRangeCount}/${result.verifiedDealsCount})
- **Median Absolute Percentage Error (MAPE)**: **${result.medianAbsolutePercentageError}%**
- **Evaluation Status**: **SUFFICIENT_DATA**

---

## 2. Category Bias Analysis
Positive bias indicates the actual deal was priced higher than engine midpoint (premium category); negative indicates deal priced below engine midpoint.

| Category | Deal Count | Mean Delta (INR) | Bias (%) | Within Range (%) |
| :--- | :--- | :--- | :--- | :--- |
${categoryRows}

---

## 3. Follower Tier Bias Analysis
Examines calibration balance across creator audience tiers.

| Follower Tier | Deal Count | Mean Delta (INR) | Bias (%) | Within Range (%) |
| :--- | :--- | :--- | :--- | :--- |
${tierRows}

---

## 4. Worst-Case Outlier Analysis

### Top Overpriced Deals (Deal Amount > Range Upper Bound)
| Deal ID | Category | Tier | Deal Amount | Engine Range | Deviation |
| :--- | :--- | :--- | :--- | :--- | :--- |
${overpricedRows}

### Top Underpriced Deals (Deal Amount < Range Lower Bound)
| Deal ID | Category | Tier | Deal Amount | Engine Range | Deviation |
| :--- | :--- | :--- | :--- | :--- | :--- |
${underpricedRows}

---

## 5. Methodological Notes
1. **As-of Deal Valuation**: Valuation engine calculates expected views and fair rates strictly utilizing creator snapshots and category baselines as recorded on or prior to the deal date.
2. **Quality Gating**: Deals relying solely on self-reported views or rule-based estimations without API verification are excluded from accuracy claims.
3. **Paise Accuracy**: All internal monetary comparisons are computed in integer paise and converted to INR for reporting.
`;
}
