import { apiWrapper } from "@/lib/api-wrapper";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import bcrypt from "bcryptjs";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { createActivityLog, ActivityAction } from "@/lib/audit";
import { getSecureClientIp } from "@/lib/ip";
import { checkDisable2FAEligibility } from "@/lib/action-eligibility";

async function _handler_POST(req: NextRequest) {
try {
const session = await auth();
if (!session?.user?.email) {
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const limit = await checkRateLimit(session.user.id, "AUTH");
if (!limit.success) {
return NextResponse.json({ error: "Too many 2FA requests" }, { status: 429 });
}

const body = await req.json().catch(() => ({}));
const { password, code, otp, token } = body as {
  password?: string;
  code?: string;
  otp?: string;
  token?: string;
};
const effectivePassword = password || token;

const user = await prisma.user.findUnique({
  where: { email: session.user.email },
  select: { id: true, phone: true, passwordHash: true, twoFactorSecret: true, isTwoFactorEnabled: true },
});

if (!user) {
  return NextResponse.json({ error: "User not found" }, { status: 404 });
}

const eligibility = checkDisable2FAEligibility(user.isTwoFactorEnabled, {
  password: effectivePassword,
  code,
  otp,
});
if (!eligibility.allowed) {
  return NextResponse.json({ error: eligibility.reason }, { status: 400 });
}

let isAuthorized = false;

// Re-auth Option 1: Account Password
if (effectivePassword && user.passwordHash) {
  isAuthorized = await bcrypt.compare(effectivePassword, user.passwordHash);
}

// Re-auth Option 2: Current 6-digit TOTP Authenticator Code
if (!isAuthorized && code && user.twoFactorSecret) {
  try {
    const { verify } = await import("otplib");
    const { decrypt } = await import("@/lib/encryption");
    let secret = user.twoFactorSecret;
    try {
      secret = decrypt(user.twoFactorSecret);
    } catch (decryptErr) {
      logger.warn("Failed to decrypt twoFactorSecret during 2FA disable; attempting raw secret fallback", { error: String(decryptErr) });
    }
    const verifyResult = await verify({ token: String(code).trim(), secret });
    isAuthorized = typeof verifyResult === "object" && verifyResult !== null
      ? (verifyResult as { valid: boolean }).valid
      : Boolean(verifyResult);
  } catch (totpErr) {
    logger.warn("Failed to verify TOTP code during 2FA disable", { error: totpErr });
  }
}

// Re-auth Option 3: Phone SMS OTP
if (!isAuthorized && otp && user.phone) {
  try {
    const { verifyOTP } = await import("@/lib/sms");
    const otpResult = await verifyOTP(user.phone, String(otp).trim(), {
      purpose: "2fa_disable",
    });
    isAuthorized = otpResult.success;
  } catch (otpErr) {
    logger.warn("Failed to verify phone OTP during 2FA disable", { error: otpErr });
  }
}

if (!isAuthorized) {
  return NextResponse.json(
    { error: "Re-authentication failed: Incorrect password, 2FA code, or OTP" },
    { status: 403 },
  );
}

// Disable 2FA
await prisma.user.update({
where: { id: user.id },
data: {
isTwoFactorEnabled: false,
twoFactorSecret: null,
twoFactorRecoveryCodes: null,
},
});

// Audit security log
await createActivityLog({
  userId: user.id,
  action: ActivityAction.TWO_FACTOR_DISABLED,
  entityType: "User",
  entityId: user.id,
  ipAddress: getSecureClientIp(req),
  metadata: {
    reAuthMethod: password ? "password" : code ? "totp" : "otp",
    disabledAt: new Date().toISOString(),
  },
}).catch((err) => {
  logger.warn("Failed to log TWO_FACTOR_DISABLED activity", { error: err });
});

return NextResponse.json({
success: true,
message: "2FA disabled successfully",
});
} catch (error) {
logger.error("2FA disable error", error);
return NextResponse.json(
{ error: "Failed to disable 2FA" },
{ status: 500 },
);
}
}


// Wrapped handlers via apiWrapper
export const POST = apiWrapper(_handler_POST);
