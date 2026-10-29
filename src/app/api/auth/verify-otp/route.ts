import { NextRequest } from "next/server";
import { z } from "zod";
import { getSecureClientIp } from "@/lib/ip";
import { logger } from "@/lib/logger";
import prisma from "@/lib/db";
import redis from "@/lib/redis";
import { sendOTP, verifyOTP } from "@/lib/sms";
import { checkRateLimit, rateLimit } from "@/lib/rate-limit";
import { apiWrapper, ApiResponse } from "@/lib/api-wrapper";
import { AppError } from "@/lib/errors";
import { AUTH_OTP_EXPIRY_SECONDS } from "@/constants";
import { assertKillSwitchInactive } from "@/lib/kill-switch";

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

    if (type === "registration") {
      await assertKillSwitchInactive("killswitch:signups");
    }

    const ip = getSecureClientIp(request);
    const [ipRateLimit, phoneRateLimit] = await Promise.all([
      checkRateLimit(ip, "AUTH"),
      rateLimit({
        uniqueToken: `otp:send:phone:${phone}`,
        limit: 5,
        window: 3600, // max 5 OTP requests per hour per phone
        securityCritical: true,
      }),
    ]);

    if (!ipRateLimit.success || !phoneRateLimit.success) {
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
...(process.env.NODE_ENV === "development" && process.env.ENABLE_DEV_OTP_ECHO === "true" && sendResult.otp ? { otp: sendResult.otp } : {}),
};
const message = sendResult.channel === "whatsapp" ? "OTP sent on WhatsApp" : "OTP sent by SMS";
return ApiResponse.success(responseData, message);
} catch (error: unknown) {
return handlePutError(error);
}
});

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
    const ip = getSecureClientIp(request);
    const ipRateLimit = await checkRateLimit(ip, "AUTH");
    if (!ipRateLimit.success) {
      return ApiResponse.tooManyRequests("Too many verification attempts. Please try again later.");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return ApiResponse.error("Invalid request body");
    }

const validation = validateRegistrationPayload(body);
if (!validation.success) {
return ApiResponse.error(validation.message!);
}

const { phone, otp, type } = validation.data!;

    const phoneVerifyLimit = await rateLimit({
      uniqueToken: `otp:verify:phone:${phone}`,
      limit: 5,
      window: 900, // max 5 verification attempts per 15 minutes per phone (anti-brute force)
      securityCritical: true,
    });
    if (!phoneVerifyLimit.success) {
      return ApiResponse.tooManyRequests(
        "Too many failed verification attempts for this phone number. Please wait 15 minutes or request a new OTP.",
      );
    }

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
await redis.setex(`phone-otp-verified:${phone}`, AUTH_OTP_EXPIRY_SECONDS, "1");

return ApiResponse.success({ verified: true }, "Phone verified successfully!");
} catch (error: unknown) {
return handlePostError(error);
}
});
