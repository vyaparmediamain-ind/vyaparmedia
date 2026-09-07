import { apiWrapper } from "@/lib/api-wrapper";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import QRCode from "qrcode";
import { generateSecret, generateURI } from "otplib";
import { logger } from "@/lib/logger";
import { encrypt } from "@/lib/encryption";
import { checkRateLimit } from "@/lib/rate-limit";

async function _handler_POST(_req: NextRequest) {
try {
const session = await auth();
if (!session?.user?.email) {
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const limit = await checkRateLimit(session.user.id, "AUTH");
if (!limit.success) {
return NextResponse.json({ error: "Too many 2FA requests" }, { status: 429 });
}

const user = await prisma.user.findUnique({
where: { email: session.user.email },
select: { id: true, isTwoFactorEnabled: true },
});

if (!user) {
return NextResponse.json({ error: "User not found" }, { status: 404 });
}

if (user.isTwoFactorEnabled) {
return NextResponse.json(
{ error: "2FA is already enabled" },
{ status: 400 },
);
}

// Generate a new 2FA secret
const secret = generateSecret();

await prisma.user.update({
where: { id: user.id },
data: { twoFactorSecret: encrypt(secret) },
});

// Generate QR Code URI
const uri = generateURI({
issuer: "VyaparMedia",
label: session.user.email,
secret,
});

// Convert URI to Data URL for frontend scanning
const qrCodeUrl = await QRCode.toDataURL(uri);

return NextResponse.json({
secret, // The base32 secret for manual entry
qrCodeUrl,
});
} catch (error) {
logger.error("2FA setup error", error);
return NextResponse.json(
{ error: "Failed to initiate 2FA setup" },
{ status: 500 },
);
}
}


// Wrapped handlers via apiWrapper
export const POST = apiWrapper(_handler_POST);
