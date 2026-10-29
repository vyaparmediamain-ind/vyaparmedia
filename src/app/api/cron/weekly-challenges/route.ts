/**
* Weekly Challenges Cron Generate new challenges every Monday
*/

import { NextRequest, NextResponse } from "next/server";
import { apiWrapper } from "@/lib/api-wrapper";
import { generateWeeklyChallenges } from "@/lib/weekly-challenges";
import { logger } from "@/lib/logger";
import { validateCronSecret } from "../guard";
import { acquireDistributedLock, releaseDistributedLock } from "@/lib/lock";

async function _handler_POST(_req: NextRequest) {
  await validateCronSecret(_req);

  const lockKey = "cron:weekly-challenges:lock";
  const lock = await acquireDistributedLock(lockKey, 120);
  if (!lock) {
    return NextResponse.json({ success: true, skipped: true, message: "Weekly challenges generation already running." });
  }

  try {
    const result = await generateWeeklyChallenges();

    logger.info("Weekly challenges generated", result);

    return NextResponse.json({
      success: true,
      weekId: result.weekId,
      influencerChallenges: result.influencerChallenges.length,
      brandChallenges: result.brandChallenges.length,
    });
  } finally {
    await releaseDistributedLock(lockKey, lock);
  }
}

export const GET = apiWrapper(_handler_POST);
export const POST = apiWrapper(_handler_POST);

