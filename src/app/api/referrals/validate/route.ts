import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/services/auth.service";
import { apiWrapper } from "@/lib/api-wrapper";

async function _handler_GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code")?.trim().toUpperCase();

  if (!code) {
    return NextResponse.json({ valid: false, message: "Referral code is required" }, { status: 400 });
  }

  try {
    const referrerId = await AuthService.resolveReferrer(code);
    return NextResponse.json({
      valid: Boolean(referrerId),
      message: referrerId ? "Valid referral code" : "Invalid referral code",
    });
  } catch {
    return NextResponse.json({
      valid: false,
      message: "Invalid referral code",
    });
  }
}

export const GET = apiWrapper(_handler_GET, {
  rateLimit: {
    limit: 30, // 30 requests per minute per IP to prevent enumeration
    window: 60,
  },
});
