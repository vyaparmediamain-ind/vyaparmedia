import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { normalizeIndianPhone, sendOTP } from "@/lib/sms";
import { sendVerificationEmail } from "@/lib/email";
import { generateOTP } from "@/lib/utils";
import prisma from "@/lib/db";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import { apiWrapper } from "@/lib/api-wrapper";
import { redis } from "@/lib/redis";

// Strict input validation schema
const sendOtpSchema = z.discriminatedUnion("type", [
z.object({
type: z.literal("phone"),
contact: z
.string()
.regex(/^(?:\+?91)?\s?[6-9]\d{9}$/, "Invalid Indian phone number format (must be 10 digits or start with 91)"),
}),
z.object({
type: z.literal("email"),
contact: z.string().email("Invalid email address"),
}),
]);

async function handleSendPhoneOtp(userId: string, contact: string) {
const normalizedPhone = normalizeIndianPhone(contact);
if (!normalizedPhone) {
return NextResponse.json(
{ error: "Invalid Indian phone number format" },
{ status: 400 },
);
}

const result = await sendOTP(normalizedPhone, {
purpose: "phone_verification",
});
if (!result.success) {
logger.warn("OTP send failed for phone", {
userId,
error: result.error,
});
return NextResponse.json(
{
error: result.retryAfterSeconds
? result.error
: "Failed to send OTP. Please try again.",
...(result.retryAfterSeconds
? { retryAfterSeconds: result.retryAfterSeconds }
: {}),
},
{ status: result.retryAfterSeconds ? 429 : 500 },
);
}

await prisma.user.update({
where: { id: userId },
data: { phone: normalizedPhone },
});

return NextResponse.json({
success: true,
message:
result.channel === "whatsapp"
? "OTP sent on WhatsApp"
: "OTP sent by SMS",
channel: result.channel,
fallbackUsed: result.fallbackUsed,
...(process.env.NODE_ENV !== "production" && result.otp
? { otp: result.otp }
: {}),
});
}

async function handleSendEmailOtp(userId: string, contact: string) {
const otp = generateOTP();
const { createHash } = await import("node:crypto");
const otpHash = createHash("sha256").update(otp).digest("hex");

await redis.setex(`email-contact-otp:${userId}`, 600, otpHash);
await sendVerificationEmail(contact, otp);

return NextResponse.json({
success: true,
message: "OTP sent to email",
});
}

export const POST = apiWrapper(async function POST(req: NextRequest) {
try {
const session = await auth();
if (!session?.user?.id) {
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const otpRateLimit = await checkRateLimit(session.user.id, "AUTH");
if (!otpRateLimit.success) {
return NextResponse.json(
{ error: "Too many OTP requests. Please wait before requesting again." },
{
status: 429,
headers: { "Retry-After": "60" },
},
);
}

let body: unknown;
try {
body = await req.json();
} catch {
return NextResponse.json(
{ error: "Invalid request body" },
{ status: 400 },
);
}

const parsed = sendOtpSchema.safeParse(body);
if (!parsed.success) {
return NextResponse.json(
{
error: "Validation failed",
details: parsed.error.flatten().fieldErrors,
},
{ status: 400 },
);
}

const { type, contact } = parsed.data;

if (type === "phone") {
return handleSendPhoneOtp(session.user.id, contact);
} else if (type === "email") {
return handleSendEmailOtp(session.user.id, contact);
}

// TypeScript exhaustive check this should never execute
return NextResponse.json({ error: "Invalid type" }, { status: 400 });
} catch (error: unknown) {
logger.error("Error sending OTP", error);
// Never expose internal error details to client
return NextResponse.json(
{ error: "Failed to send OTP. Please try again." },
{ status: 500 },
);
}
});
