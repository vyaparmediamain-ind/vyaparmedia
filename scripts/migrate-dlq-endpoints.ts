/**
 * scripts/migrate-dlq-endpoints.ts
 *
 * Data migration script to map existing DeadLetterJob records with legacy/nonexistent
 * endpoints to the universal `/api/jobs/consumer` endpoint.
 *
 * Defaults to dry-run unless `--apply` is passed.
 *
 * Usage:
 *   npx tsx scripts/migrate-dlq-endpoints.ts [--apply] [--batch-size=100]
 */

import prisma from "../src/lib/db";
import { JOB_TOPICS_REGISTRY } from "../src/lib/job-topics";

export interface MigrationSummary {
  scanned: number;
  mappable: number;
  unmappable: number;
  alreadyMigrated: number;
  updated: number;
  details: Array<{
    id: string;
    topic: string;
    oldEndpoint: string;
    newEndpoint: string;
    status: "MAPPABLE" | "UNMAPPABLE" | "ALREADY_MIGRATED";
    reason?: string;
  }>;
}

export async function migrateDlqEndpoints(options: {
  apply?: boolean;
  batchSize?: number;
  prismaClient?: unknown;
}): Promise<MigrationSummary> {
  const db = (options.prismaClient as typeof prisma) || prisma;
  const isApply = options.apply ?? false;
  const batchSize = options.batchSize || 100;

  console.log(`[DLQ Migration] Starting scan (mode: ${isApply ? "APPLY" : "DRY-RUN"}, batchSize: ${batchSize})...`);

  const summary: MigrationSummary = {
    scanned: 0,
    mappable: 0,
    unmappable: 0,
    alreadyMigrated: 0,
    updated: 0,
    details: [],
  };

  let cursor: string | undefined = undefined;

  while (true) {
    const queryArgs: Parameters<typeof db.deadLetterJob.findMany>[0] = {
      take: batchSize,
      orderBy: { id: "asc" },
      select: {
        id: true,
        topic: true,
        endpoint: true,
        status: true,
      },
    };

    if (cursor) {
      queryArgs.skip = 1;
      queryArgs.cursor = { id: cursor };
    }

    const jobs = await db.deadLetterJob.findMany(queryArgs);

    if (jobs.length === 0) {
      break;
    }

    summary.scanned += jobs.length;
    const lastJob = jobs[jobs.length - 1];
    if (!lastJob) break;
    cursor = lastJob.id;

    const toUpdateBatch: string[] = [];

    for (const job of jobs) {
      if (job.endpoint === "/api/jobs/consumer") {
        summary.alreadyMigrated++;
        summary.details.push({
          id: job.id,
          topic: job.topic,
          oldEndpoint: job.endpoint,
          newEndpoint: "/api/jobs/consumer",
          status: "ALREADY_MIGRATED",
        });
        continue;
      }

      // Check if topic is registered
      const isRegistered = Boolean(JOB_TOPICS_REGISTRY[job.topic]);

      if (isRegistered) {
        summary.mappable++;
        summary.details.push({
          id: job.id,
          topic: job.topic,
          oldEndpoint: job.endpoint,
          newEndpoint: "/api/jobs/consumer",
          status: "MAPPABLE",
        });
        toUpdateBatch.push(job.id);
      } else {
        summary.unmappable++;
        summary.details.push({
          id: job.id,
          topic: job.topic,
          oldEndpoint: job.endpoint,
          newEndpoint: job.endpoint,
          status: "UNMAPPABLE",
          reason: `Topic "${job.topic}" is not registered in JOB_TOPICS_REGISTRY`,
        });
      }
    }

    if (isApply && toUpdateBatch.length > 0) {
      const updateRes = await db.deadLetterJob.updateMany({
        where: {
          id: { in: toUpdateBatch },
        },
        data: {
          endpoint: "/api/jobs/consumer",
        },
      });
      summary.updated += updateRes.count;
    }
  }

  console.log(`[DLQ Migration] Finished.`);
  console.log(`  Scanned: ${summary.scanned}`);
  console.log(`  Already Migrated: ${summary.alreadyMigrated}`);
  console.log(`  Mappable: ${summary.mappable}`);
  console.log(`  Unmappable: ${summary.unmappable}`);
  console.log(`  Updated: ${summary.updated} (Apply: ${isApply})`);

  return summary;
}

// CLI execution check
if (process.argv[1]?.includes("migrate-dlq-endpoints")) {
  const isApply = process.argv.includes("--apply");
  migrateDlqEndpoints({ apply: isApply })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[DLQ Migration] Fatal error:", err);
      process.exit(1);
    });
}
