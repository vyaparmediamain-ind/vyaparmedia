import { NextRequest, NextResponse } from "next/server";
import { apiWrapper } from "@/lib/api-wrapper";
import { validateCronSecret } from "../guard";
import { acquireDistributedLock, releaseDistributedLock } from "@/lib/lock";
import { CampaignMetricsService } from "@/services/campaign-metrics.service";
import { logger } from "@/lib/logger";

const LOCK_KEY = "cron:campaign-metrics:lock";
const LOCK_TTL_SECS = 300;

/**
 * Daily Campaign Funnel, Performance & Deliverables Rollup Cron Handler
 *
 * Runs daily at 08:00 UTC (13:30 IST) to compute yesterday's complete Asia/Kolkata
 * metrics across all active campaigns and upsert into CampaignDailyMetric.
 */
async function _handler(req: NextRequest) {
  await validateCronSecret(req);

  const lockToken = await acquireDistributedLock(LOCK_KEY, LOCK_TTL_SECS);
  if (!lockToken) {
    return NextResponse.json({
      success: true,
      message: "Campaign metrics rollup cron already in progress, skipping",
      data: { locked: true },
    });
  }

  try {
    // Yesterday in Asia/Kolkata
    const targetDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const summary = await CampaignMetricsService.aggregateAllCampaignsForDay(targetDate);

    return NextResponse.json({
      success: true,
      message: "Campaign metrics daily aggregation batch executed successfully",
      data: summary,
    });
  } catch (err) {
    logger.error("Campaign metrics cron execution failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  } finally {
    await releaseDistributedLock(LOCK_KEY, lockToken);
  }
}

export const GET = apiWrapper(_handler);
export const POST = apiWrapper(_handler);
