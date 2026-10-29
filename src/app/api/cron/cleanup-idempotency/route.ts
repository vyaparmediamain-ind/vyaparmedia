import { NextRequest, NextResponse } from "next/server";
import { apiWrapper } from "@/lib/api-wrapper";
import { logger } from "@/lib/logger";
import { validateCronSecret } from "../guard";
import { cleanupExpiredIdempotencyKeys } from "@/lib/idempotency";
import { acquireDistributedLock, releaseDistributedLock } from "@/lib/lock";

async function _handler(_req: NextRequest) {
  await validateCronSecret(_req);

  const lockKey = "cron:cleanup-idempotency:lock";
  const lock = await acquireDistributedLock(lockKey, 120);
  if (!lock) {
    return NextResponse.json({ success: true, skipped: true, message: "Idempotency cleanup already running." });
  }

  try {
    const deleted = await cleanupExpiredIdempotencyKeys();

    logger.info("[Cron] Idempotency cleanup completed", { deleted });

    return NextResponse.json({ success: true, deleted });
  } finally {
    await releaseDistributedLock(lockKey, lock);
  }
}

export const GET = apiWrapper(_handler);
export const POST = apiWrapper(_handler);
