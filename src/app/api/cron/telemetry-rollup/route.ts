import { NextRequest, NextResponse } from "next/server";
import { apiWrapper } from "@/lib/api-wrapper";
import { validateCronSecret } from "../guard";
import { acquireDistributedLock, releaseDistributedLock } from "@/lib/lock";
import { TelemetryRollupService } from "@/services/telemetry-rollup.service";
import { logger } from "@/lib/logger";

const LOCK_KEY = "cron:telemetry-rollup:lock";
const LOCK_TTL_SECS = 300;

/**
 * Telemetry Daily Rollup Cron Handler
 *
 * Runs hourly to compute idempotent statistical rollups across routes (DailyRouteStat)
 * and conversion funnels (DailyFunnelStat) bucketed in Asia/Kolkata (+05:30).
 */
async function _handler(req: NextRequest) {
  await validateCronSecret(req);

  const lockToken = await acquireDistributedLock(LOCK_KEY, LOCK_TTL_SECS);
  if (!lockToken) {
    return NextResponse.json({
      success: true,
      message: "Telemetry rollup cron already in progress, skipping",
      data: { locked: true },
    });
  }

  try {
    const summary = await TelemetryRollupService.rollupDailyStats();
    return NextResponse.json({
      success: true,
      message: "Telemetry daily rollup executed successfully",
      data: summary,
    });
  } catch (err) {
    logger.error("Telemetry rollup cron failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  } finally {
    await releaseDistributedLock(LOCK_KEY, lockToken);
  }
}

export const GET = apiWrapper(_handler);
export const POST = apiWrapper(_handler);
