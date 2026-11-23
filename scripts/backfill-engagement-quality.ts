/**
 * Idempotent Backfill Script: Engagement Data Quality & Classification
 *
 * Requirements:
 * - Mark existing Instagram-linked snapshots (deal.postUrl contains instagram.com) as isEstimated=true
 *   with metricsQuality: { views: "DERIVED", likes: "API", comments: "API", shares: "DERIVED", saves: "DERIVED", clicks: "UNAVAILABLE", reach: "DERIVED" }
 * - Mark YouTube snapshots (deal.postUrl contains youtube.com or youtu.be) as isEstimated=false
 *   with metricsQuality: { views: "API", likes: "API", comments: "API", shares: "DERIVED", saves: "UNAVAILABLE", clicks: "UNAVAILABLE", reach: "DERIVED" }
 * - Mark unlinked / fallback snapshots as isEstimated=true with all metrics DERIVED
 * - Batched execution (cursor-based) to prevent memory spikes or connection starvation
 * - Idempotent: safe to run multiple times without corrupting existing records
 * - Dry-run flag support via CLI `--dry-run`
 * - Logs clear summary statistics
 *
 * Usage:
 *   Dry-run: npx tsx -r ./scripts/mock-server-only.js scripts/backfill-engagement-quality.ts --dry-run
 *   Execute: npx tsx -r ./scripts/mock-server-only.js scripts/backfill-engagement-quality.ts
 *
 * ROLLBACK INSTRUCTIONS:
 * In case of accidental migration execution:
 *
 *   -- 1. Remove metricsQuality metadata:
 *   UPDATE "EngagementSnapshot" SET "metricsQuality" = NULL;
 *
 *   -- 2. If necessary, revert isEstimated on Instagram posts back to legacy false:
 *   UPDATE "EngagementSnapshot" es
 *   SET "isEstimated" = false
 *   FROM "Deal" d
 *   WHERE es."dealId" = d."id" AND d."postUrl" LIKE '%instagram.com%';
 */

import prisma from "../src/lib/db";
import { type SnapshotMetricsQuality } from "../src/lib/engagement-tracker";
import { Prisma } from "@prisma/client";

export interface BackfillSummary {
  totalExamined: number;
  updated: number;
  skipped: number;
  byPlatform: {
    instagram: number;
    youtube: number;
    fallback: number;
  };
  dryRun: boolean;
}

export async function runEngagementQualityBackfill(options?: {
  dryRun?: boolean;
  batchSize?: number;
}): Promise<BackfillSummary> {
  const dryRun = options?.dryRun ?? process.argv.includes("--dry-run");
  const batchSize = options?.batchSize ?? 100;

  console.log(`\n===============================================================`);
  console.log(`📊 ENGAGEMENT METRICS DATA QUALITY BACKFILL MIGRATION`);
  console.log(`===============================================================`);
  console.log(`Mode:       ${dryRun ? "🔍 DRY RUN (No writes to DB)" : "⚡ LIVE EXECUTION (Writing to DB)"}`);
  console.log(`Batch Size: ${batchSize}\n`);

  const summary: BackfillSummary = {
    totalExamined: 0,
    updated: 0,
    skipped: 0,
    byPlatform: {
      instagram: 0,
      youtube: 0,
      fallback: 0,
    },
    dryRun,
  };

  let cursor: string | undefined = undefined;
  let hasMore = true;

  while (hasMore) {
    const queryArgs: Parameters<typeof prisma.engagementSnapshot.findMany>[0] = {
      take: batchSize,
      skip: cursor ? 1 : 0,
      orderBy: { id: "asc" },
      select: {
        id: true,
        views: true,
        likes: true,
        comments: true,
        shares: true,
        saves: true,
        clicks: true,
        isEstimated: true,
        metricsQuality: true,
        deal: {
          select: {
            postUrl: true,
          },
        },
      },
    };
    if (cursor) {
      queryArgs.cursor = { id: cursor };
    }

    const snapshots = (await prisma.engagementSnapshot.findMany(queryArgs)) as unknown as Array<{
      id: string;
      views: number;
      likes: number;
      comments: number;
      shares: number;
      saves: number;
      clicks: number;
      isEstimated: boolean;
      metricsQuality: unknown;
      deal: { postUrl: string | null } | null;
    }>;

    if (snapshots.length === 0) {
      break;
    }

    for (const snap of snapshots) {
      summary.totalExamined++;
      const postUrl = snap.deal?.postUrl || "";
      const isInstagram = postUrl.includes("instagram.com");
      const isYouTube = postUrl.includes("youtube.com") || postUrl.includes("youtu.be");

      let targetQuality: SnapshotMetricsQuality;
      let targetIsEstimated: boolean;

      if (isInstagram) {
        summary.byPlatform.instagram++;
        targetIsEstimated = true; // Instagram views are derived in Basic Display
        targetQuality = {
          views: "DERIVED",
          likes: "API",
          comments: "API",
          shares: "DERIVED",
          saves: "DERIVED",
          clicks: "UNAVAILABLE",
          reach: "DERIVED",
        };
      } else if (isYouTube) {
        summary.byPlatform.youtube++;
        targetIsEstimated = false; // YouTube views are API-sourced
        targetQuality = {
          views: "API",
          likes: "API",
          comments: "API",
          shares: "DERIVED",
          saves: "UNAVAILABLE",
          clicks: "UNAVAILABLE",
          reach: "DERIVED",
        };
      } else {
        summary.byPlatform.fallback++;
        targetIsEstimated = true;
        targetQuality = {
          views: "DERIVED",
          likes: "DERIVED",
          comments: "DERIVED",
          shares: "DERIVED",
          saves: "DERIVED",
          clicks: "UNAVAILABLE",
          reach: "DERIVED",
        };
      }

      // Check if already up-to-date (Idempotency check)
      const currentQuality = snap.metricsQuality as SnapshotMetricsQuality | null;
      const isAlreadyUpToDate =
        snap.isEstimated === targetIsEstimated &&
        currentQuality &&
        currentQuality.views === targetQuality.views &&
        currentQuality.likes === targetQuality.likes &&
        currentQuality.comments === targetQuality.comments &&
        currentQuality.shares === targetQuality.shares &&
        currentQuality.clicks === targetQuality.clicks;

      if (isAlreadyUpToDate) {
        summary.skipped++;
        continue;
      }

      if (!dryRun) {
        await prisma.engagementSnapshot.update({
          where: { id: snap.id },
          data: {
            isEstimated: targetIsEstimated,
            metricsQuality: targetQuality as unknown as Prisma.InputJsonValue,
            clicks: targetQuality.clicks === "UNAVAILABLE" ? 0 : snap.clicks,
          },
        });
      }

      summary.updated++;
    }

    if (snapshots.length < batchSize) {
      hasMore = false;
    } else {
      cursor = snapshots[snapshots.length - 1]?.id;
    }
  }

  console.log(`===============================================================`);
  console.log(`📋 BACKFILL EXECUTION SUMMARY`);
  console.log(`===============================================================`);
  console.log(`Total Snapshots Examined: ${summary.totalExamined}`);
  console.log(`Records Updated:          ${summary.updated}`);
  console.log(`Records Skipped (Clean):  ${summary.skipped}`);
  console.log(`Platform Breakdown:`);
  console.log(`  - Instagram (Estimated views): ${summary.byPlatform.instagram}`);
  console.log(`  - YouTube (API views):         ${summary.byPlatform.youtube}`);
  console.log(`  - Fallback / Unlinked:         ${summary.byPlatform.fallback}`);
  console.log(`===============================================================\n`);

  return summary;
}

// Direct CLI invocation
if (process.argv[1]?.includes("backfill-engagement-quality")) {
  runEngagementQualityBackfill()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Backfill failed:", err);
      process.exit(1);
    });
}
