/**
 * Idempotent Backfill Script: Campaign Daily Performance & Funnel Metrics
 *
 * Requirements:
 * - Aggregates historical campaign funnels, applications, delivered views, and escrow metrics.
 * - Respects Asia/Kolkata (+05:30) calendar day boundaries.
 * - Batched execution (day-by-day and campaign-by-campaign) to prevent connection pool exhaustion.
 * - Strictly idempotent: safe to run repeatedly without duplicate records or ledger distortion.
 * - Dry-run flag support via CLI `--dry-run`.
 * - Specific campaign target via `--campaign-id=<id>` or default to all active campaigns.
 * - Configurable history window via `--days=<number>` (default: 30 days).
 *
 * Usage:
 *   Dry-run: npx tsx -r ./scripts/mock-server-only.js scripts/backfill-campaign-metrics.ts --dry-run
 *   Execute: npx tsx -r ./scripts/mock-server-only.js scripts/backfill-campaign-metrics.ts --days=30
 */

import prisma from "../src/lib/db";
import { CampaignMetricsService } from "../src/services/campaign-metrics.service";
import { getKolkataDayBounds } from "../src/lib/campaign-aggregator";

export interface BackfillCampaignSummary {
  totalCampaigns: number;
  totalDays: number;
  totalAggregations: number;
  successful: number;
  failed: number;
  dryRun: boolean;
}

export async function runCampaignMetricsBackfill(options?: {
  dryRun?: boolean;
  days?: number;
  campaignId?: string;
}): Promise<BackfillCampaignSummary> {
  const args = process.argv.slice(2);
  const dryRun = options?.dryRun ?? args.includes("--dry-run");

  const daysArg = args.find((a) => a.startsWith("--days="));
  const days = options?.days ?? (daysArg ? Number.parseInt(daysArg.split("=")[1]!, 10) : 30);

  const campaignIdArg = args.find((a) => a.startsWith("--campaign-id="));
  const specificCampaignId = options?.campaignId ?? (campaignIdArg ? campaignIdArg.split("=")[1] : undefined);

  console.log(`\n===============================================================`);
  console.log(`📊 CAMPAIGN DAILY METRICS HISTORICAL BACKFILL & ROLLUP`);
  console.log(`===============================================================`);
  console.log(`Mode:        ${dryRun ? "🔍 DRY RUN (Preview only, no DB writes)" : "⚡ LIVE EXECUTION"}`);
  console.log(`Day Window:  Last ${days} days (Asia/Kolkata Calendar Days)`);
  if (specificCampaignId) {
    console.log(`Target:      Campaign ${specificCampaignId}`);
  } else {
    console.log(`Target:      All Active / Non-Draft Campaigns`);
  }
  console.log(`---------------------------------------------------------------\n`);

  // 1. Fetch campaigns
  const campaigns = await prisma.campaign.findMany({
    where: {
      ...(specificCampaignId ? { id: specificCampaignId } : { status: { notIn: ["DRAFT"] } }),
      deletedAt: null,
    },
    select: { id: true, title: true, status: true },
  });

  if (campaigns.length === 0) {
    console.log("No matching campaigns found to backfill.");
    return {
      totalCampaigns: 0,
      totalDays: days,
      totalAggregations: 0,
      successful: 0,
      failed: 0,
      dryRun,
    };
  }

  console.log(`Discovered ${campaigns.length} campaign(s) to process.\n`);

  let successful = 0;
  let failed = 0;

  // 2. Iterate day by day from (now - days) to (now - 1 day)
  const now = new Date();
  const dayIntervals: Date[] = [];
  for (let i = days; i >= 1; i--) {
    const target = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    dayIntervals.push(target);
  }

  for (const campaign of campaigns) {
    console.log(`▶ Processing Campaign [${campaign.id}]: "${campaign.title}" (${campaign.status})`);

    for (const date of dayIntervals) {
      const { dateStr } = getKolkataDayBounds(date);
      try {
        if (dryRun) {
          // Preview aggregation
          console.log(`   [DRY RUN] ${dateStr} - Simulated daily aggregation`);
          successful += 1;
        } else {
          await CampaignMetricsService.aggregateCampaignForDay(campaign.id, date);
          console.log(`   ✓ ${dateStr} - Successfully aggregated and upserted`);
          successful += 1;
        }
      } catch (err) {
        failed += 1;
        console.error(`   ✗ ${dateStr} - Failed:`, err instanceof Error ? err.message : String(err));
      }
    }
  }

  console.log(`\n===============================================================`);
  console.log(`🏁 BACKFILL COMPLETE`);
  console.log(`===============================================================`);
  console.log(`Total Campaigns:    ${campaigns.length}`);
  console.log(`Total Days:         ${days}`);
  console.log(`Total Processed:    ${successful + failed}`);
  console.log(`Successful:         ${successful}`);
  console.log(`Failed:             ${failed}`);
  console.log(`===============================================================\n`);

  return {
    totalCampaigns: campaigns.length,
    totalDays: days,
    totalAggregations: successful + failed,
    successful,
    failed,
    dryRun,
  };
}

if (require.main === module) {
  runCampaignMetricsBackfill()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Backfill failed with unhandled error:", err);
      process.exit(1);
    });
}
