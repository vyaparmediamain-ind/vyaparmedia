/**
 * Cron Run Service (Heartbeat Recording & Status Retrieval)
 *
 * Tracks executions of background QStash & Vercel cron jobs in the CronRun table.
 * Used for admin telemetry, platform health monitoring, and reliability auditing.
 */

import prisma from "@/lib/db";
import { logger } from "@/lib/logger";
import { CRON_JOBS } from "../../scripts/setup-qstash-crons";
import { evaluateCronHealth, type AdminCronHealthItem } from "@/lib/admin-analytics-calc";
import { cronJobRunsTotal } from "@/lib/metrics";

export interface RecordCronRunInput {
  jobName: string;
  path: string;
  status: "SUCCESS" | "FAILED" | "RUNNING";
  durationMs?: number | undefined;
  recordsProcessed?: number | undefined;
  error?: string | null | undefined;
  startedAt?: Date | undefined;
  completedAt?: Date | null | undefined;
}

export class CronRunService {
  /**
   * Records a cron run execution into the database.
   */
  static async recordRun(input: RecordCronRunInput): Promise<void> {
    try {
      await prisma.cronRun.create({
        data: {
          jobName: input.jobName,
          path: input.path,
          status: input.status,
          durationMs: input.durationMs ?? 0,
          recordsProcessed: input.recordsProcessed ?? 0,
          error: input.error ? String(input.error).slice(0, 500) : null,
          startedAt: input.startedAt ?? new Date(),
          completedAt: input.completedAt ?? new Date(),
        },
      });

      // Prometheus metrics tracking
      cronJobRunsTotal.inc({ job: input.jobName, status: input.status });
    } catch (err) {
      // Background heartbeat logging must never crash the cron itself
      logger.error("Failed to record CronRun heartbeat", err, { jobName: input.jobName });
    }
  }

  /**
   * Retrieves the latest heartbeat for each known cron job.
   */
  static async getCronHeartbeats(): Promise<{
    overallStatus: "HEALTHY" | "DEGRADED" | "CRITICAL";
    jobs: AdminCronHealthItem[];
    failingJobsCount: number;
  }> {
    try {
      const runs = await prisma.cronRun.findMany({
        orderBy: { startedAt: "desc" },
        take: 100,
        select: {
          jobName: true,
          path: true,
          status: true,
          durationMs: true,
          error: true,
          startedAt: true,
          completedAt: true,
        },
      });

      const latestRunsMap = new Map<
        string,
        {
          status: string;
          completedAt?: Date | null;
          durationMs?: number | null;
          error?: string | null;
        }
      >();

      for (const r of runs) {
        if (!latestRunsMap.has(r.jobName)) {
          latestRunsMap.set(r.jobName, r);
        }
        if (!latestRunsMap.has(r.path)) {
          latestRunsMap.set(r.path, r);
        }
      }

      const definitions = CRON_JOBS.map((c) => ({
        id: c.id,
        name: c.name,
        path: c.path,
        cron: c.cron,
      }));

      return evaluateCronHealth(definitions, latestRunsMap, new Date());
    } catch (err) {
      logger.error("Failed to query CronRun heartbeats", err);
      // Fallback to definitions with pending status
      const definitions = CRON_JOBS.map((c) => ({
        id: c.id,
        name: c.name,
        path: c.path,
        cron: c.cron,
      }));
      return evaluateCronHealth(definitions, new Map(), new Date());
    }
  }
}
