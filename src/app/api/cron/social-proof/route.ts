/**
* Weekly Social Proof Recalculation Cron
*
* Recalculates followerAuthenticityScore and contentQualityScore
* for all active influencers. Should be triggered weekly via an
* external scheduler.
*/

import { NextRequest, NextResponse } from "next/server";
import { apiWrapper } from "@/lib/api-wrapper";
import { recalculateAllSocialProof } from "@/lib/social-proof-calculator";
import { logger } from "@/lib/logger";
import { validateCronSecret } from "../guard";
import { acquireDistributedLock, releaseDistributedLock } from "@/lib/lock";

async function _handler_POST(_req: NextRequest) {
  await validateCronSecret(_req);

  const lockKey = "cron:social-proof:lock";
  const lock = await acquireDistributedLock(lockKey, 600); // 10 minute lock
  if (!lock) {
    return NextResponse.json({
      success: true,
      skipped: true,
      message: "Weekly social proof recalculation is already running.",
    });
  }

  try {
    const startTime = Date.now();
    const result = await recalculateAllSocialProof();
    const durationMs = Date.now() - startTime;

    logger.info("Weekly social proof recalculation complete", {
      processed: result.processed,
      failed: result.failed,
      durationMs,
    });

    return NextResponse.json({
      success: true,
      ...result,
      durationMs,
    });
  } finally {
    await releaseDistributedLock(lockKey, lock);
  }
}

export const GET = apiWrapper(_handler_POST);
export const POST = apiWrapper(_handler_POST);
