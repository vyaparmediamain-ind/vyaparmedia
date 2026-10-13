import { NextRequest, NextResponse } from "next/server";
import { apiWrapper } from "@/lib/api-wrapper";
import { validateCronSecret } from "../guard";
import { logger } from "@/lib/logger";
import { acquireDistributedLock, releaseDistributedLock } from "@/lib/lock";

async function _handler_POST(_req: NextRequest) {
  await validateCronSecret(_req);

  const lockKey = "cron:lift-suspensions:lock";
  const lock = await acquireDistributedLock(lockKey, 120);
  if (!lock) {
    return NextResponse.json({ success: true, skipped: true, message: "Lift suspensions job already running." });
  }

  try {
    const { liftExpiredSuspensions } = await import("@/lib/penalty-system");
    const result = await liftExpiredSuspensions();

    logger.info("Suspensions lifted", { count: result.lifted });

    return NextResponse.json({ success: true, message: `Suspensions lifted: ${result.lifted}` });
  } finally {
    await releaseDistributedLock(lockKey, lock);
  }
}

export const GET = apiWrapper(_handler_POST);
export const POST = apiWrapper(_handler_POST);

