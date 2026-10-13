import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/services/auth.service";

export async function GET(request: NextRequest) {
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
