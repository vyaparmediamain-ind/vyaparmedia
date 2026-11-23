/**
 * Fair Price Backtest Script (Read-Only)
 *
 * For completed deals with API-quality views, compares deal amounts to the Fair Price Engine range
 * using creator metric data as-of the deal date.
 *
 * Outputs:
 * - % within range
 * - Median error (MAPE)
 * - Bias by category and follower tier
 * - Worst-case outliers
 * - Writes comprehensive report to docs/reports/fair-price-backtest-<YYYY-MM-DD>.md
 * - Enforces minimum sample size threshold (10 deals) with an explicit INSUFFICIENT_DATA status.
 *
 * Usage: npx tsx scripts/backtest-fair-price.ts
 */

import { PrismaClient, DealStatus } from "@prisma/client";
import {
  calculateFairPrice,
  resolveFollowerTier,
  FairPriceInput,
  DEFAULT_FAIR_PRICE_CONFIG,
} from "../src/lib/fair-price-engine";
import {
  calculateBacktestMetrics,
  generateBacktestMarkdownReport,
  BacktestDealItem,
} from "../src/lib/backtest-math";
import { getCategoryBaselineCpvSync } from "../src/lib/roi-calculator";
import * as fs from "node:fs";
import * as path from "node:path";

const prisma = new PrismaClient();

async function main() {
  console.log("=================================================");
  console.log(" Fair Price Engine Historical Backtest (Read-Only)");
  console.log("=================================================\n");

  const today = new Date();
  const dateStr = today.toISOString().split("T")[0]!;

  // 1. Query all completed deals
  const completedDeals = await prisma.deal.findMany({
    where: {
      status: DealStatus.COMPLETED,
    },
    include: {
      influencer: true,
      campaign: true,
      engagementSnapshots: {
        orderBy: { views: "desc" },
      },
    },
    orderBy: { completedAt: "desc" },
  });

  console.log(`Total completed deals found: ${completedDeals.length}`);

  const dealItems: BacktestDealItem[] = [];

  for (const deal of completedDeals) {
    // Find best engagement snapshot for views
    const validSnapshots = deal.engagementSnapshots.filter(
      (s) =>
        !s.isEstimated ||
        (s.metricsQuality as Record<string, unknown> | null)?.views === "API"
    );

    // If no API-verified snapshot, skip from verified backtest cohort
    if (validSnapshots.length === 0 || !validSnapshots[0] || validSnapshots[0].views <= 0) {
      continue;
    }

    const snapshot = validSnapshots[0];
    const views = snapshot.views;
    const viewsQuality = (snapshot.isEstimated ? "ESTIMATED" : "API") as "API" | "ESTIMATED";

    const influencer = deal.influencer;
    const dealDate = deal.completedAt || deal.createdAt;

    // Follower count as-of deal date (look for CreatorMetricSnapshot before or on dealDate)
    const metricSnapshot = await prisma.creatorMetricSnapshot.findFirst({
      where: {
        influencerId: influencer.id,
        capturedAt: { lte: dealDate },
      },
      orderBy: { capturedAt: "desc" },
    });

    const followers =
      metricSnapshot?.followers ??
      influencer.instagramFollowers ??
      influencer.youtubeSubscribers ??
      10000;

    const followerTier = resolveFollowerTier(followers, DEFAULT_FAIR_PRICE_CONFIG);

    const campaignCategories = deal.campaign?.targetCategories?.join(",") || "general";
    const categories = (influencer.categories || campaignCategories)
      .split(/[,;|]/)
      .map((c: string) => c.trim().toLowerCase())
      .filter(Boolean);

    const category = categories[0] || "general";
    const categoryBaselineCpvPaise = getCategoryBaselineCpvSync(categories);

    // Run Engine evaluation
    const engineInput: FairPriceInput = {
      platform: "INSTAGRAM",
      contentType: "REEL",
      followers,
      recentViews: [views],
      categoryBaselineCpvPaise,
      authenticityScore: influencer.followerAuthenticityScore ?? 75,
      deliverables: { count: 1 },
      dataQuality: viewsQuality === "API" ? "VERIFIED" : "ESTIMATED",
      now: dealDate,
    };

    const evaluation = calculateFairPrice(engineInput);

    dealItems.push({
      dealId: deal.id,
      campaignTitle: deal.campaign?.title,
      influencerName: influencer.displayName,
      category,
      followerTier,
      dealAmountPaise: deal.amount,
      engineMinPaise: evaluation.minPaise,
      engineMaxPaise: evaluation.maxPaise,
      engineMidPaise: evaluation.basePaise,
      views,
      viewsQuality,
      dealDate,
    });
  }

  console.log(`Deals with API-verified views: ${dealItems.length}`);

  // 2. Compute Backtest Metrics
  const result = calculateBacktestMetrics(dealItems, completedDeals.length);

  // 3. Generate Markdown Report
  const reportContent = generateBacktestMarkdownReport(result, dateStr);

  const reportsDir = path.resolve(process.cwd(), "docs", "reports");
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportPath = path.join(reportsDir, `fair-price-backtest-${dateStr}.md`);
  fs.writeFileSync(reportPath, reportContent, "utf-8");

  console.log(`\nReport written to: ${reportPath}`);

  // 4. Print Summary to Console
  console.log("\n=================================================");
  console.log(` Backtest Summary: Status = ${result.status}`);
  console.log("=================================================");
  if (result.status === "INSUFFICIENT_DATA") {
    console.log(`\n⚠️  ${result.warningBanner}`);
    console.log(`\nVerified Deals Count: ${result.verifiedDealsCount} / 10 required`);
  } else {
    console.log(`\nWithin Range: ${result.withinRangePercent}% (${result.withinRangeCount}/${result.verifiedDealsCount})`);
    console.log(`Median Error (MAPE): ${result.medianAbsolutePercentageError}%`);
    console.log("\nCategory Bias:");
    for (const [cat, stat] of Object.entries(result.categoryBias)) {
      console.log(`  - ${cat}: ${stat.count} deals | Mean Delta: ₹${stat.meanDeltaRupees} | Within Range: ${stat.withinRangePercent}%`);
    }
  }
  console.log("=================================================\n");
}

main()
  .catch((err) => {
    console.error("Backtest failed with error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
