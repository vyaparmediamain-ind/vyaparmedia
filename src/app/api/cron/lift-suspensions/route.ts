import { NextRequest, NextResponse } from "next/server";
import { apiWrapper } from "@/lib/api-wrapper";
import { validateCronSecret } from "../guard";
import { logger } from "@/lib/logger";

async function _handler_POST(_req: NextRequest) {
  await validateCronSecret(_req);

  const { liftExpiredSuspensions } = await import("@/lib/penalty-system");
  const result = await liftExpiredSuspensions();

  logger.info("Suspensions lifted", { count: result.lifted });

  return NextResponse.json({ success: true, message: `Suspensions lifted: ${result.lifted}` });
}

export const GET = apiWrapper(_handler_POST);
export const POST = apiWrapper(_handler_POST);
