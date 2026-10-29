import { NextRequest, NextResponse } from "next/server";
import { apiWrapper } from "@/lib/api-wrapper";
import { validateCronSecret } from "../guard";
import { logger } from "@/lib/logger";
import prisma from "@/lib/db";
import { acquireDistributedLock, releaseDistributedLock } from "@/lib/lock";

async function _handler(_req: NextRequest) {
  await validateCronSecret(_req);

  const lockKey = "cron:cleanup-oauth:lock";
  const lock = await acquireDistributedLock(lockKey, 120);
  if (!lock) {
    return NextResponse.json({ success: true, skipped: true, message: "OAuth cleanup already running." });
  }

  try {
    const result = await prisma.oAuthState.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    logger.info("Expired OAuthState records cleaned up", { count: result.count });

    return NextResponse.json({ success: true, message: `OAuthStates cleaned up: ${result.count}` });
  } finally {
    await releaseDistributedLock(lockKey, lock);
  }
}

export const GET = apiWrapper(_handler);
export const POST = apiWrapper(_handler);
