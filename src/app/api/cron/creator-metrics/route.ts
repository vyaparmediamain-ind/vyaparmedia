import { NextRequest, NextResponse } from "next/server";
import { apiWrapper } from "@/lib/api-wrapper";
import { validateCronSecret } from "../guard";
import { acquireDistributedLock, releaseDistributedLock } from "@/lib/lock";
import { CreatorMetricsService } from "@/services/creator-metrics.service";
import { logger } from "@/lib/logger";

const LOCK_KEY = "cron:creator-metrics:lock";
const LOCK_TTL_SECS = 300;

/**
 * Creator Metrics Weekly Cadence Cron Handler
 *
 * Runs daily to process cursor-batched creator slices based on weekly cadence and hash jitter.
 * Skips creators without healthy connected accounts and ensures strict ISO week idempotency.
 * Prunes historical records older than 12 calendar months.
 */
async function _handler(req: NextRequest) {
  await validateCronSecret(req);

  const lockToken = await acquireDistributedLock(LOCK_KEY, LOCK_TTL_SECS);
  if (!lockToken) {
    return NextResponse.json({
      success: true,
      message: "Creator metrics cron already in progress, skipping",
      data: { locked: true },
    });
  }

  try {
    const summary = await CreatorMetricsService.runWeeklyCadenceBatch();
    return NextResponse.json({
      success: true,
      message: "Creator metrics weekly cadence batch executed successfully",
      data: summary,
    });
  } catch (err) {
    logger.error("Creator metrics cron execution failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  } finally {
    await releaseDistributedLock(LOCK_KEY, lockToken);
  }
}

export const GET = apiWrapper(_handler);
export const POST = apiWrapper(_handler);
