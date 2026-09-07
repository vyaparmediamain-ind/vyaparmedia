import { NextRequest, NextResponse } from "next/server";
import { apiWrapper } from "@/lib/api-wrapper";
import { validateCronSecret } from "../guard";
import { runDailyPostMonitoring } from "@/lib/post-monitor";

async function _handler_POST(_req: NextRequest) {
  await validateCronSecret(_req);

  const penalties = await runDailyPostMonitoring();

  return NextResponse.json({ success: true, message: "Post monitor routine complete", data: penalties });
}

export const GET = apiWrapper(_handler_POST);
export const POST = apiWrapper(_handler_POST);
