/**
* Weekly Challenges Cron Generate new challenges every Monday
*/

import { NextRequest, NextResponse } from "next/server";
import { apiWrapper } from "@/lib/api-wrapper";
import { generateWeeklyChallenges } from "@/lib/weekly-challenges";
import { logger } from "@/lib/logger";
import { validateCronSecret } from "../guard";

async function _handler_POST(_req: NextRequest) {
  await validateCronSecret(_req);

  const result = await generateWeeklyChallenges();

  logger.info("Weekly challenges generated", result);

  return NextResponse.json({
    success: true,
    weekId: result.weekId,
    influencerChallenges: result.influencerChallenges.length,
    brandChallenges: result.brandChallenges.length,
  });
}

export const GET = apiWrapper(_handler_POST);
export const POST = apiWrapper(_handler_POST);
