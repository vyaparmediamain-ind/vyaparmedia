/**
* Email OTP API Route Send & Verify OTP for email verification during registration
*/

import { NextRequest, NextResponse } from "next/server";
import { getSecureClientIp } from "@/lib/ip";
import { randomInt, createHash, timingSafeEqual } from "node:crypto";
import redis from "@/lib/redis";
import { logger } from "@/lib/logger";
import { sendVerificationEmail } from "@/lib/email";
import prisma from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { env } from "@/env";
import { apiWrapper } from "@/lib/api-wrapper";

const OTP_TTL = 600; // 10 minutes

// PUT: Send Email OTP
export const PUT = apiWrapper(async function PUT(request: NextRequest) {
try {
let body;
try {
body = await request.json();
} catch {
return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
}

const { email, type } = body;

if (!email || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
return NextResponse.json(
{ error: "Valid email address is required" },
{ status: 400 },
);
}

const allowedTypes = ["registration", "email_verification"];
if (!type || !allowedTypes.includes(type)) {
return NextResponse.json(
{ error: "Valid type is required" },
{ status: 400 },
);
}

const ip = getSecureClientIp(request);
const ipRateLimit = await checkRateLimit(ip, "AUTH");
if (!ipRateLimit.success) {
return NextResponse.json(
{ error: "Too many OTP requests. Please try again later." },
{ status: 429 },
);
}

// Avoid account enumeration: registration requests for existing emails
// receive the same outward response, but no OTP is sent.
if (type === "registration") {
const existing = await prisma.user.findUnique({
where: { email: email.toLowerCase().trim() },
select: { id: true },
});
if (existing) {
return NextResponse.json(
{ success: true, message: "If this email can be registered, an OTP has been sent." },
{ status: 200 },
);
}
}

const key = `email-otp:${type}:${email.toLowerCase().trim()}`;

// Rate limit: Only allow new OTP after 60 seconds
const ttl = await redis.ttl(key);
if (ttl > OTP_TTL - 60) {
const waitTime = ttl - (OTP_TTL - 60);
return NextResponse.json(
{ error: `Please wait ${waitTime} seconds before requesting a new OTP` },
{ status: 429 },
);
}

// Generate 6-digit OTP
const otp = randomInt(100000, 999999).toString();
const otpHash = createHash("sha256").update(otp).digest("hex");

// Store hashed OTP in Redis
await redis.setex(
key,
OTP_TTL,
JSON.stringify({
otp: otpHash,
attempts: 0,
createdAt: new Date().toISOString(),
}),
);

// Send OTP via email
await sendVerificationEmail(email, otp);

if (process.env.NODE_ENV === "development") {
logger.debug(`[DEV] Email OTP for ${email}: ${otp}`);
}

return NextResponse.json({
success: true,
message: "OTP sent to your email",
...(process.env.NODE_ENV === "development" && { otp }),
});
} catch (error) {
logger.error("Send email OTP error", error);
return NextResponse.json(
{ error: "Failed to send OTP. Please try again." },
{ status: 500 },
);
}
});

// POST: Verify Email OTP
export const POST = apiWrapper(async function POST(request: NextRequest) {
try {
let body;
try {
body = await request.json();
} catch {
return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
}

const { email, otp, type } = body;

if (!email || !otp || !type) {
return NextResponse.json(
{ error: "Email, OTP, and type are required" },
{ status: 400 },
);
}

const allowedTypes = ["registration", "email_verification"];
if (!allowedTypes.includes(type)) {
return NextResponse.json(
{ error: "Invalid OTP verification type" },
{ status: 400 },
);
}

const key = `email-otp:${type}:${email.toLowerCase().trim()}`;
const storedJson = await redis.get(key);

if (!storedJson) {
return NextResponse.json(
{ error: "OTP not found or expired. Please request a new OTP." },
{ status: 400 },
);
}

let storedData;
try {
storedData = JSON.parse(storedJson);
} catch {
await redis.del(key);
return NextResponse.json(
{ error: "OTP data corrupted. Please request a new OTP." },
{ status: 400 },
);
}

// Check attempts (max 3)
if (storedData.attempts >= 3) {
await redis.del(key);
return NextResponse.json(
{ error: "Too many failed attempts. Please request a new OTP." },
{ status: 429 },
);
}

// Constant-time comparison
const submittedHash = createHash("sha256").update(otp).digest("hex");
const storedHash = storedData.otp;
const storedBuffer = Buffer.from(storedHash, "utf8");
const submittedBuffer = Buffer.from(submittedHash, "utf8");

// Magic bypass for E2E tests defense-in-depth: both the raw NODE_ENV and
// the Zod-validated env flag must be non-production/true. This ensures the
// backdoor is blocked in production even if env.ts validation is misconfigured.
const isMagicCode =
otp === "123456" &&
process.env.NODE_ENV !== "production" &&
env.E2E_MAGIC_OTP === "true";

let isMatch = false;
if (storedBuffer.length === submittedBuffer.length) {
isMatch = timingSafeEqual(storedBuffer, submittedBuffer) || isMagicCode;
} else if (isMagicCode) {
isMatch = true;
}

if (!isMatch) {
storedData.attempts++;
const ttl = await redis.ttl(key);
if (ttl > 0) {
await redis.setex(key, ttl, JSON.stringify(storedData));
}
return NextResponse.json(
{ error: "Invalid OTP. Please try again." },
{ status: 400 },
);
}

    // OTP verified clean up
    await redis.del(key);
    const normalizedEmail = email.toLowerCase().trim();
    await redis.setex(
      `email-otp-verified:${normalizedEmail}`,
      15 * 60,
      "1",
    );

    if (type === "email_verification") {
      await prisma.user.updateMany({
        where: { email: normalizedEmail },
        data: { emailVerified: true },
      });
    }

    return NextResponse.json({
      success: true,
      verified: true,
      message: "Email verified successfully!",
    });
} catch (error) {
logger.error("Email OTP verification error", error);
return NextResponse.json(
{ error: "Verification failed. Please try again." },
{ status: 500 },
);
}
});
