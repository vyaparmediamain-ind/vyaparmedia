import { NextRequest, NextResponse } from "next/server";
import { apiWrapper } from "@/lib/api-wrapper";
import { validateCronSecret } from "../guard";
import { DealService } from "@/services/deal.service";

async function _handler(_req: NextRequest) {
  await validateCronSecret(_req);

  const result = await DealService.autoApproveExpiredContent();

  return NextResponse.json({
    success: true,
    message: "Content auto-approval completed",
    data: result,
  });
}

export const GET = apiWrapper(_handler);
export const POST = apiWrapper(_handler);
