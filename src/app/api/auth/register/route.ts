import { NextRequest } from "next/server";
import { AuthService } from "@/services/auth.service";
import { logger } from "@/lib/logger";
import { getSecureClientIp } from "@/lib/ip";
import { registerSchema } from "@/lib/validations";
import redis from "@/lib/redis";
import { apiWrapper, ApiResponse } from "@/lib/api-wrapper";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError } from "@/lib/errors";

function getRequestIp(request: NextRequest): string {
  return getSecureClientIp(request);
}

function validateRegisterInput(body: unknown) {
const parsed = registerSchema.safeParse(body);
if (!parsed.success) {
const firstIssue = parsed.error.issues[0];
const fieldName = firstIssue?.path.join(".") || "";
const issueMsg = firstIssue?.message || "Invalid value";
const prefix = fieldName ? `${fieldName} - ` : "";
return {
success: false,
message: `Invalid request data: ${prefix}${issueMsg}`
};
}
return { success: true, data: parsed.data };
}

function handleRegisterError(error: unknown) {
logger.error("Registration route error", { error: (error instanceof Error ? error.message : String(error)) });

if (error instanceof AppError) {
return ApiResponse.error(error.message, error.statusCode);
}

const errMsg = error instanceof Error ? error.message : String(error);

const safeErrors = [
"Email already registered",
"Phone number already registered",
"Invalid referral code",
"Registration blocked. Please contact support.",
];

if (safeErrors.includes(errMsg) || errMsg.includes("Rate limit")) {
return ApiResponse.error(errMsg);
}

return ApiResponse.error("Registration failed. Please try again.", 500);
}

export const POST = apiWrapper(async function POST(request: NextRequest) {
const ip = getRequestIp(request);

const ipLimit = await checkRateLimit(ip, "REGISTER");
if (!ipLimit.success) {
return ApiResponse.tooManyRequests("Too many registration attempts. Please try again later.");
}

try {
let body: unknown;
try {
body = await request.json();
} catch {
return ApiResponse.error("Invalid request body");
}

const validation = validateRegisterInput(body);
if (!validation.success) {
return ApiResponse.error(validation.message!);
}

const parsedData = validation.data!;
const emailKey = `email-otp-verified:${parsedData.email}`;
const phoneKey = `phone-otp-verified:${parsedData.phone}`;
const [isEmailOtpVerified, isPhoneOtpVerified] = await Promise.all([
redis.get(emailKey),
redis.get(phoneKey),
]);

if (!isEmailOtpVerified || !isPhoneOtpVerified) {
return ApiResponse.error("OTP verification expired. Please verify email and phone again.");
}

const userAgent = request.headers.get("user-agent") || "unknown";
const bodyRecord =
body && typeof body === "object" && !Array.isArray(body)
? (body as Record<string, unknown>)
: {};
const rawDeviceFingerprint =
request.headers.get("x-device-fingerprint") ||
(typeof bodyRecord.deviceFingerprint === "string"
? bodyRecord.deviceFingerprint
: "");

const user = await AuthService.registerUser(parsedData, ip, {
emailVerified: true,
phoneVerified: true,
userAgent,
...(rawDeviceFingerprint ? { deviceFingerprint: rawDeviceFingerprint } : {}),
});
await Promise.all([redis.del(emailKey), redis.del(phoneKey)]);

return ApiResponse.success(
{ userId: user.id },
"Registration successful. You can now sign in.",
201,
);
} catch (error: unknown) {
return handleRegisterError(error);
}
});
