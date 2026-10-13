import { NextRequest, NextResponse } from "next/server";
import { apiWrapper, ApiResponse } from "@/lib/api-wrapper";
import { auth } from "@/lib/auth";
import { getUserWeeklyChallenges } from "@/lib/weekly-challenges";

async function _handler_GET(_request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return ApiResponse.unauthorized();
  }

  const challenges = await getUserWeeklyChallenges(session.user.id);

  return NextResponse.json({
    success: true,
    data: challenges,
  });
}

export const GET = apiWrapper(_handler_GET);
