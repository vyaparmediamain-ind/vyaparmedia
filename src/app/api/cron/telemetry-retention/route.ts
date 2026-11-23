import { NextRequest, NextResponse } from "next/server";
import { apiWrapper } from "@/lib/api-wrapper";
import { validateCronSecret } from "../guard";
import { acquireDistributedLock, releaseDistributedLock } from "@/lib/lock";
import { TelemetryRollupService } from "@/services/telemetry-rollup.service";
import { logger } from "@/lib/logger";

const LOCK_KEY = "cron:telemetry-retention:lock";
const LOCK_TTL_SECS = 300;

/**
 * Telemetry Retention Purge Cron Handler
 *
 * Runs daily to purge raw PageViewEvent records older than the 30-day retention window.
 * Aggregate metrics in DailyRouteStat and DailyFunnelStat remain permanently preserved.
 */
async function _handler(req: NextRequest) {
  await validateCronSecret(req);

  const lockToken = await acquireDistributedLock(LOCK_KEY, LOCK_TTL_SECS);
  if (!lockToken) {
    return NextResponse.json({
      success: true,
      message: "Telemetry retention purge cron already in progress, skipping",
      data: { locked: true },
    });
  }

  try {
    const summary = await TelemetryRollupService.purgeOldTelemetryEvents(30);
    return NextResponse.json({
      success: true,
      message: "Telemetry retention purge executed successfully",
      data: summary,
    });
  } catch (err) {
    logger.error("Telemetry retention purge cron failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  } finally {
    await releaseDistributedLock(LOCK_KEY, lockToken);
  }
}

export const GET = apiWrapper(_handler);
export const POST = apiWrapper(_handler);
