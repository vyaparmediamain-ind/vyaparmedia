import { NextRequest, NextResponse } from "next/server";
import { apiWrapper } from "@/lib/api-wrapper";
import { validateCronSecret } from "../guard";
import { batchCaptureEngagement } from "@/lib/engagement-tracker";

async function _handler(_req: NextRequest) {
  await validateCronSecret(_req);

  // Process engagement snapshots for active deals
  const results = await batchCaptureEngagement();

  return NextResponse.json({ success: true, message: "Engagement synced", data: results });
}

export const GET = apiWrapper(_handler);
export const POST = apiWrapper(_handler);
