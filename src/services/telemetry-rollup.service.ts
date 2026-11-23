/**
 * Telemetry Rollup & Lifecycle Service
 *
 * Manages background flushing, aggregation, and retention of telemetry data:
 * 1. Flushes in-flight beacon events from Redis buffer into PostgreSQL `PageViewEvent`.
 * 2. Idempotently computes and upserts `DailyRouteStat` and `DailyFunnelStat`.
 * 3. Purges raw events exceeding the 30-day retention boundary.
 */

import prisma from "@/lib/db";
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";
import { TelemetryService } from "@/services/telemetry.service";
import { telemetryFlushDurationMs } from "@/lib/metrics";
import {
  getKolkataDayBounds,
  aggregateRouteStats,
  aggregateFunnelStats,
  aggregateTrafficBreakdowns,
  type RouteAggregationResult,
  type FunnelAggregationResult,
  type TrafficBreakdownResult,
} from "@/lib/telemetry-aggregator";

export interface FlushResult {
  flushedCount: number;
  remainingInQueue: number;
  batchLimit: number;
}

export interface RollupResult {
  date: string;
  dayStart: Date;
  processedEvents: number;
  routeStats: RouteAggregationResult[];
  funnelStats: FunnelAggregationResult[];
  breakdownStats: TrafficBreakdownResult[];
}

export interface PurgeResult {
  deletedCount: number;
  cutoffDate: Date;
  retentionDays: number;
}

export class TelemetryRollupService {
  /**
   * Flushes queued beacon events from the Redis list to PostgreSQL via createMany.
   * Runs frequently (e.g. every minute) to keep Redis list memory minimal.
   */
  public static async flushRedisEventsToDatabase(batchSize = 500): Promise<FlushResult> {
    const startTime = Date.now();
    const poppedRaw: string[] = [];

    try {
      for (let i = 0; i < batchSize; i++) {
        const item = await redis.lpop(TelemetryService.TELEMETRY_QUEUE_KEY);
        if (!item) break;
        poppedRaw.push(item);
      }
    } catch (redisErr) {
      logger.error("Redis error while popping events from telemetry queue", {
        error: String(redisErr),
      });
      return { flushedCount: 0, remainingInQueue: 0, batchLimit: batchSize };
    }

    if (poppedRaw.length === 0) {
      let remaining = 0;
      try {
        remaining = await redis.llen(TelemetryService.TELEMETRY_QUEUE_KEY);
      } catch {
        remaining = 0;
      }
      return { flushedCount: 0, remainingInQueue: remaining, batchLimit: batchSize };
    }

    // Parse and validate items
    const recordsToInsert: Array<{
      sessionHash: string;
      userId: string | null;
      role: string | null;
      routeKey: string;
      targetInfluencerId: string | null;
      targetCampaignId: string | null;
      deviceType: string;
      referrerHost: string | null;
      activeMs: number;
      maxScrollPct: number;
      createdAt: Date;
    }> = [];

    for (const rawStr of poppedRaw) {
      try {
        const obj = JSON.parse(rawStr);
        if (obj && typeof obj.sessionHash === "string" && typeof obj.routeKey === "string") {
          recordsToInsert.push({
            sessionHash: obj.sessionHash,
            userId: obj.userId ?? null,
            role: obj.role ?? null,
            routeKey: obj.routeKey,
            targetInfluencerId: obj.targetInfluencerId ?? null,
            targetCampaignId: obj.targetCampaignId ?? null,
            deviceType: obj.deviceType || "desktop",
            referrerHost: obj.referrerHost ?? null,
            activeMs: typeof obj.activeMs === "number" ? obj.activeMs : 0,
            maxScrollPct: typeof obj.maxScrollPct === "number" ? obj.maxScrollPct : 0,
            createdAt: obj.createdAt ? new Date(obj.createdAt) : new Date(),
          });
        }
      } catch {
        // Drop unparseable garbage entries
      }
    }

    if (recordsToInsert.length > 0) {
      try {
        await prisma.pageViewEvent.createMany({
          data: recordsToInsert,
        });
      } catch (dbErr) {
        logger.error("Database error while persisting telemetry batch", {
          count: recordsToInsert.length,
          error: String(dbErr),
        });
        // In emergency, we do not throw to prevent cascading cron retries; telemetry fails gracefully
      }
    }

    let remainingInQueue = 0;
    try {
      remainingInQueue = await redis.llen(TelemetryService.TELEMETRY_QUEUE_KEY);
    } catch {
      remainingInQueue = 0;
    }

    telemetryFlushDurationMs.observe(Date.now() - startTime);

    return {
      flushedCount: recordsToInsert.length,
      remainingInQueue,
      batchLimit: batchSize,
    };
  }

  /**
   * Idempotently computes and upserts DailyRouteStat and DailyFunnelStat for a target date.
   * Buckets strictly in Asia/Kolkata (+05:30).
   */
  public static async rollupDailyStats(targetDate?: Date): Promise<RollupResult> {
    const referenceDate = targetDate ?? new Date();
    const { dayStart, dayEnd, dateStr } = getKolkataDayBounds(referenceDate);

    // Fetch raw page views for the target Kolkata day
    const rawEvents = await prisma.pageViewEvent.findMany({
      where: {
        createdAt: {
          gte: dayStart,
          lt: dayEnd,
        },
      },
      select: {
        id: true,
        sessionHash: true,
        userId: true,
        role: true,
        routeKey: true,
        targetInfluencerId: true,
        targetCampaignId: true,
        deviceType: true,
        referrerHost: true,
        activeMs: true,
        maxScrollPct: true,
        createdAt: true,
      },
    });

    const routeStats = aggregateRouteStats(rawEvents, dayStart);
    const funnelStats = aggregateFunnelStats(rawEvents, dayStart);
    const breakdownStats = aggregateTrafficBreakdowns(rawEvents, dayStart);

    // Idempotent upserts for Route Stats
    for (const stat of routeStats) {
      await prisma.dailyRouteStat.upsert({
        where: {
          date_routeKey: {
            date: dayStart,
            routeKey: stat.routeKey,
          },
        },
        create: {
          date: dayStart,
          routeKey: stat.routeKey,
          uniqueVisitors: stat.uniqueVisitors,
          pageViews: stat.pageViews,
          avgActiveMs: stat.avgActiveMs,
          avgScrollPct: stat.avgScrollPct,
          bounceBps: stat.bounceBps,
        },
        update: {
          uniqueVisitors: stat.uniqueVisitors,
          pageViews: stat.pageViews,
          avgActiveMs: stat.avgActiveMs,
          avgScrollPct: stat.avgScrollPct,
          bounceBps: stat.bounceBps,
        },
      });
    }

    // Idempotent upserts for Funnel Stats
    for (const fStat of funnelStats) {
      await prisma.dailyFunnelStat.upsert({
        where: {
          date_funnelKey_stepKey: {
            date: dayStart,
            funnelKey: fStat.funnelKey,
            stepKey: fStat.stepKey,
          },
        },
        create: {
          date: dayStart,
          funnelKey: fStat.funnelKey,
          stepKey: fStat.stepKey,
          sessions: fStat.sessions,
        },
        update: {
          sessions: fStat.sessions,
        },
      });
    }

    // Idempotent upserts for Demographic & Traffic Breakdowns
    for (const bStat of breakdownStats) {
      await prisma.dailyTrafficBreakdown.upsert({
        where: {
          date_dimension_key: {
            date: dayStart,
            dimension: bStat.dimension,
            key: bStat.key,
          },
        },
        create: {
          date: dayStart,
          dimension: bStat.dimension,
          key: bStat.key,
          visitors: bStat.visitors,
          pageViews: bStat.pageViews,
        },
        update: {
          visitors: bStat.visitors,
          pageViews: bStat.pageViews,
        },
      });
    }

    return {
      date: dateStr,
      dayStart,
      processedEvents: rawEvents.length,
      routeStats,
      funnelStats,
      breakdownStats,
    };
  }

  /**
   * Purges raw page views older than the retention threshold (default: 30 days).
   * Aggregate statistics remain permanent in DailyRouteStat and DailyFunnelStat.
   */
  public static async purgeOldTelemetryEvents(
    retentionDays = 30,
    clock: Date = new Date()
  ): Promise<PurgeResult> {
    const cutoffDate = new Date(clock.getTime() - retentionDays * 24 * 60 * 60 * 1000);

    const result = await prisma.pageViewEvent.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    logger.info("Purged expired telemetry page views beyond retention window", {
      deletedCount: result.count,
      cutoffDate: cutoffDate.toISOString(),
      retentionDays,
    });

    return {
      deletedCount: result.count,
      cutoffDate,
      retentionDays,
    };
  }
}
