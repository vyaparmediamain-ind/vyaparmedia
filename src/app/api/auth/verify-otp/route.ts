import { NextRequest } from "next/server";
import { z } from "zod";
import { getSecureClientIp } from "@/lib/ip";
import { AuthService } from "@/services/auth.service";
import { logger } from "@/lib/logger";
import prisma from "@/lib/db";
import redis from "@/lib/redis";
import { sendOTP, verifyOTP } from "@/lib/sms";
import { checkRateLimit } from "@/lib/rate-limit";
import { apiWrapper, ApiResponse } from "@/lib/api-wrapper";
import { AppError } from "@/lib/errors";

const sendRegistrationOtpSchema = z.object({
phone: z
.string()
.trim()
.regex(/^[6-9]\d{9}$/, "Must be a valid 10-digit Indian phone number"),
type: z.enum(["registration", "phone_verification"]).default("registration"),
});

const verifyRegistrationOtpSchema = z.object({
phone: z
.string()
.trim()
.regex(/^[6-9]\d{9}$/, "Must be a valid 10-digit Indian phone number"),
otp: z.string().regex(/^\d{6}$/, "OTP must be exactly 6 digits"),
type: z.enum(["registration", "phone_verification"]),
});

const verifyLegacyOtpSchema = z.object({
userId: z.string().cuid(),
code: z.string().length(6, "OTP must be exactly 6 characters"),
type: z.enum(["EMAIL_VERIFICATION", "PHONE_VERIFICATION", "LOGIN_OTP"]),
});

function validatePutPayload(body: unknown) {
const parsed = sendRegistrationOtpSchema.safeParse(body);
if (!parsed.success) {
const firstIssue = parsed.error.issues[0];
const fieldName = firstIssue?.path.join(".") || "";
const issueMsg = firstIssue?.message || "Invalid value";
const prefix = fieldName ? `${fieldName} - ` : "";
return {
success: false,
message: `Invalid request payload: ${prefix}${issueMsg}`
};
}
return { success: true, data: parsed.data };
}

function handlePutError(error: unknown) {
logger.error("Phone OTP send failed", { error: (error instanceof Error ? error.message : String(error)) });
if (error instanceof AppError) {
return ApiResponse.error(error.message, error.statusCode);
}
return ApiResponse.error("Failed to send OTP", 500);
}

async function checkExistingPhoneForOtp(phone: string, type: "registration" | "phone_verification") {
  const existing = await prisma.user.findUnique({
    where: { phone },
    select: { id: true },
  });

  if (type === "registration") {
    if (existing) {
      return {
        handled: true,
        response: ApiResponse.success(
          null,
          "If this phone number can be registered, an OTP has been sent.",
        ),
      };
    }
  } else if (type === "phone_verification") {
    if (existing) {
      return {
        handled: true,
        response: ApiResponse.error("Phone number is already in use.", 400),
      };
    }
  }

  return { handled: false };
}

export const PUT = apiWrapper(async function PUT(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return ApiResponse.error("Invalid request body");
    }

    const validation = validatePutPayload(body);
    if (!validation.success) {
      return ApiResponse.error(validation.message!);
    }

    const { phone, type } = validation.data!;

    const ip = getSecureClientIp(request);
    const ipRateLimit = await checkRateLimit(ip, "AUTH");
    if (!ipRateLimit.success) {
      return ApiResponse.tooManyRequests("Too many OTP requests. Please try again later.");
    }

    const checkResult = await checkExistingPhoneForOtp(phone, type);
    if (checkResult.handled) {
      return checkResult.response!;
    }

const sendResult = await sendOTP(phone, { purpose: type });
if (!sendResult.success) {
if (sendResult.retryAfterSeconds) {
return ApiResponse.tooManyRequests(sendResult.error || "Failed to send OTP", sendResult.retryAfterSeconds);
}
return ApiResponse.error(sendResult.error || "Failed to send OTP", 500);
}

const responseData = {
channel: sendResult.channel,
fallbackUsed: sendResult.fallbackUsed,
...(process.env.NODE_ENV !== "production" && sendResult.otp ? { otp: sendResult.otp } : {}),
};
const message = sendResult.channel === "whatsapp" ? "OTP sent on WhatsApp" : "OTP sent by SMS";
return ApiResponse.success(responseData, message);
} catch (error: unknown) {
return handlePutError(error);
}
});

function validateLegacyPayload(body: unknown) {
const parsedLegacy = verifyLegacyOtpSchema.safeParse(body);
if (!parsedLegacy.success) {
const firstIssue = parsedLegacy.error.issues[0];
const fieldName = firstIssue?.path.join(".") || "";
const issueMsg = firstIssue?.message || "Invalid value";
const prefix = fieldName ? `${fieldName} - ` : "";
return {
success: false,
message: `Invalid request payload: ${prefix}${issueMsg}`
};
}
return { success: true, data: parsedLegacy.data };
}

function validateRegistrationPayload(body: unknown) {
const parsedRegistration = verifyRegistrationOtpSchema.safeParse(body);
if (!parsedRegistration.success) {
const firstIssue = parsedRegistration.error.issues[0];
const fieldName = firstIssue?.path.join(".") || "";
const issueMsg = firstIssue?.message || "Invalid value";
const prefix = fieldName ? `${fieldName} - ` : "";
return {
success: false,
message: `Invalid request payload: ${prefix}${issueMsg}`
};
}
return { success: true, data: parsedRegistration.data };
}

function handlePostError(error: unknown) {
logger.warn("OTP verification failed", { error: (error instanceof Error ? error.message : String(error)) });

if (error instanceof AppError) {
return ApiResponse.error(error.message, error.statusCode);
}

const errMsg = error instanceof Error ? error.message : String(error);
const safeErrorMessages = [
"Invalid or expired OTP",
"OTP has expired",
"Maximum attempts exceeded",
"Invalid OTP",
];

if (safeErrorMessages.includes(errMsg)) {
return ApiResponse.error(errMsg);
}

return ApiResponse.error("Verification failed. Please try again.", 500);
}

export const POST = apiWrapper(async function POST(request: NextRequest) {
try {
let body: unknown;
try {
body = await request.json();
} catch {
return ApiResponse.error("Invalid request body");
}

if (body && typeof body === "object" && Object.hasOwn(body, "userId")) {
const validation = validateLegacyPayload(body);
if (!validation.success) {
return ApiResponse.error(validation.message!);
}

const { userId, code, type } = validation.data!;
await AuthService.verifyOtp(userId, code, type);

return ApiResponse.success(null, "OTP verified successfully.");
}

const validation = validateRegistrationPayload(body);
if (!validation.success) {
return ApiResponse.error(validation.message!);
}

const { phone, otp, type } = validation.data!;
const key = `phone-otp:${type}:${phone}`;
const exists = await redis.get(key);

if (!exists) {
return ApiResponse.error("OTP not found or expired. Please request a new OTP.");
}

const verifyResult = await verifyOTP(phone, otp, { purpose: type });
if (!verifyResult.success) {
return ApiResponse.error(verifyResult.error || "Invalid OTP. Please try again.");
}

await redis.del(key);
await redis.setex(`phone-otp-verified:${phone}`, 15 * 60, "1");

return ApiResponse.success({ verified: true }, "Phone verified successfully!");
} catch (error: unknown) {
return handlePostError(error);
}
});
