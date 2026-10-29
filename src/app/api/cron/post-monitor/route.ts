import { NextRequest, NextResponse } from "next/server";
import { apiWrapper } from "@/lib/api-wrapper";
import { validateCronSecret } from "../guard";
import { runDailyPostMonitoring } from "@/lib/post-monitor";
import { acquireDistributedLock, releaseDistributedLock } from "@/lib/lock";

const LOCK_KEY = "cron:post-monitor:lock";
const LOCK_TTL_SECS = 300;

async function _handler_POST(_req: NextRequest) {
  await validateCronSecret(_req);

  const lockToken = await acquireDistributedLock(LOCK_KEY, LOCK_TTL_SECS);
  if (!lockToken) {
    return NextResponse.json({
      success: true,
      message: "Post monitor routine already running, skipping",
      data: { locked: true },
    });
  }

  try {
    const penalties = await runDailyPostMonitoring();
    return NextResponse.json({ success: true, message: "Post monitor routine complete", data: penalties });
  } finally {
    await releaseDistributedLock(LOCK_KEY, lockToken);
  }
}

export const GET = apiWrapper(_handler_POST);
export const POST = apiWrapper(_handler_POST);
