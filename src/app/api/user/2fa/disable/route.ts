import { apiWrapper } from "@/lib/api-wrapper";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import bcrypt from "bcryptjs";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

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

const { password } = await req.json();
if (!password) {
return NextResponse.json(
{ error: "Password is required to disable 2FA" },
{ status: 400 },
);
}

const user = await prisma.user.findUnique({
where: { email: session.user.email },
select: { id: true, passwordHash: true },
});

if (!user) {
return NextResponse.json({ error: "User not found" }, { status: 404 });
}

if (!user.passwordHash) {
  return NextResponse.json({ error: "OAuth account. Please set a password first to disable 2FA." }, { status: 400 });
}

// Verify that the user knows their password before disabling security settings
const isValidPassword = await bcrypt.compare(password, user.passwordHash);
if (!isValidPassword) {
return NextResponse.json(
{ error: "Incorrect password" },
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
