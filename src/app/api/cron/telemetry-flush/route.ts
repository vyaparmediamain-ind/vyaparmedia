import { NextRequest, NextResponse } from "next/server";
import { apiWrapper } from "@/lib/api-wrapper";
import { validateCronSecret } from "../guard";
import { acquireDistributedLock, releaseDistributedLock } from "@/lib/lock";
import { TelemetryRollupService } from "@/services/telemetry-rollup.service";
import { logger } from "@/lib/logger";

const LOCK_KEY = "cron:telemetry-flush:lock";
const LOCK_TTL_SECS = 50;

/**
 * Telemetry Flush Cron Handler
 *
 * Runs every minute to batch-pop beacon telemetry events from the Redis queue
 * into the PostgreSQL PageViewEvent table.
 */
async function _handler(req: NextRequest) {
  await validateCronSecret(req);

  const lockToken = await acquireDistributedLock(LOCK_KEY, LOCK_TTL_SECS);
  if (!lockToken) {
    return NextResponse.json({
      success: true,
      message: "Telemetry flush cron already running, skipping",
      data: { locked: true },
    });
  }

  try {
    const summary = await TelemetryRollupService.flushRedisEventsToDatabase(500);
    return NextResponse.json({
      success: true,
      message: "Telemetry flush executed successfully",
      data: summary,
    });
  } catch (err) {
    logger.error("Telemetry flush cron failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  } finally {
    await releaseDistributedLock(LOCK_KEY, lockToken);
  }
}

export const GET = apiWrapper(_handler);
export const POST = apiWrapper(_handler);
