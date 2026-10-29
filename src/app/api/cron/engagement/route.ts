import { NextRequest, NextResponse } from "next/server";
import { apiWrapper } from "@/lib/api-wrapper";
import { validateCronSecret } from "../guard";
import { batchCaptureEngagement } from "@/lib/engagement-tracker";
import { acquireDistributedLock, releaseDistributedLock } from "@/lib/lock";

const LOCK_KEY = "cron:engagement:lock";
const LOCK_TTL_SECS = 300;

async function _handler(_req: NextRequest) {
  await validateCronSecret(_req);

  const lockToken = await acquireDistributedLock(LOCK_KEY, LOCK_TTL_SECS);
  if (!lockToken) {
    return NextResponse.json({
      success: true,
      message: "Engagement sync already in progress, skipping",
      data: { locked: true },
    });
  }

  try {
    const results = await batchCaptureEngagement();
    return NextResponse.json({ success: true, message: "Engagement synced", data: results });
  } finally {
    await releaseDistributedLock(LOCK_KEY, lockToken);
  }
}

export const GET = apiWrapper(_handler);
export const POST = apiWrapper(_handler);
