import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";
import { createHash } from "node:crypto";
import { sendVerificationEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";
import { generateOTP } from "@/lib/utils";
import {
normalizeIndianPhone,
sendOTP,
verifyOTP as verifyPhoneOTP,
} from "@/lib/sms";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { apiWrapper, ApiResponse } from "@/lib/api-wrapper";
import { createActivityLog } from "@/lib/audit";
import { AppError } from "@/lib/errors";

const changeContactSchema = z.object({
action: z.enum(['init', 'verify-current', 'send-new', 'confirm-new']),
currentEmailOtp: z.string().optional(),
currentPhoneOtp: z.string().optional(),
type: z.enum(['email', 'phone']).optional(),
newContact: z.string().optional(),
newOtp: z.string().optional(),
});

async function handleInitAction(user: { email: string | null; phone: string | null; id: string }) {
if (!user.email && !user.phone) {
return ApiResponse.error("No contact methods available to initiate change.");
}

if (user.email) {
const emailOtp = generateOTP();
const emailOtpHash = createHash("sha256").update(emailOtp).digest("hex");
const currentEmailOtpKey = `contact_change_current_email_otp_${user.id}`;
await redis.setex(currentEmailOtpKey, 600, emailOtpHash);
await sendVerificationEmail(user.email, emailOtp);
}

if (user.phone) {
const result = await sendOTP(user.phone, {
purpose: `contact_change:${user.id}:current_phone`,
});
if (!result.success) {
logger.warn("Current phone OTP send failed", {
userId: user.id,
error: result.error,
});
return result.retryAfterSeconds
? ApiResponse.tooManyRequests("Failed to send phone OTP. Please try again.", result.retryAfterSeconds)
: ApiResponse.error("Failed to send phone OTP. Please try again.", 500);
}
}

return ApiResponse.success(null, "OTPs sent to your current contact method(s).");
}

async function handleVerifyCurrentAction(
user: { email: string | null; phone: string | null; id: string },
currentEmailOtp?: string,
currentPhoneOtp?: string
) {
if (user.email && !currentEmailOtp) {
return ApiResponse.error("Email OTP is required.");
}
if (user.phone && !currentPhoneOtp) {
return ApiResponse.error("Phone OTP is required.");
}

let isValidEmail = true;
if (user.email) {
isValidEmail = false;
const currentEmailOtpKey = `contact_change_current_email_otp_${user.id}`;
const submittedHash = createHash("sha256").update(currentEmailOtp || "").digest("hex");
const storedHash = await redis.get(currentEmailOtpKey);

if (storedHash) {
try {
const { timingSafeEqual } = await import("node:crypto");
const storedBuffer = Buffer.from(storedHash, "utf8");
const submittedBuffer = Buffer.from(submittedHash, "utf8");
if (storedBuffer.length === submittedBuffer.length) {
isValidEmail = timingSafeEqual(storedBuffer, submittedBuffer);
}
} catch {
isValidEmail = false;
}
}
}

let isValidPhone = true;
if (user.phone) {
const phoneVerifyResult = await verifyPhoneOTP(
user.phone,
currentPhoneOtp || "",
{ purpose: `contact_change:${user.id}:current_phone` },
);
isValidPhone = phoneVerifyResult.success;
}

if (!isValidEmail || !isValidPhone) {
return ApiResponse.error("Invalid OTP(s)");
}

const authKey = `contact_change_auth_session_${user.id}`;
const currentEmailOtpKey = `contact_change_current_email_otp_${user.id}`;

await redis.setex(authKey, 600, "authorized");
await redis.del(currentEmailOtpKey);

return ApiResponse.success(null, "Current contacts verified");
}

async function handleSendNewAction(userId: string, type?: "email" | "phone", newContact?: string) {
const authKey = `contact_change_auth_session_${userId}`;
const isAuthorized = await redis.get(authKey);
if (!isAuthorized) return ApiResponse.forbidden("Session expired or unauthorized");
if (!type || !newContact) return ApiResponse.error("Type and new contact are required");

if (type === 'email') {
const otp = generateOTP();
const otpHash = createHash("sha256").update(otp).digest("hex");
const newEmailOtpKey = `contact_change_new_email_otp_${userId}`;
await redis.setex(newEmailOtpKey, 600, otpHash);
await sendVerificationEmail(newContact, otp);
} else {
const normalizedPhone = normalizeIndianPhone(newContact);
if (!normalizedPhone) {
return ApiResponse.error("Invalid Indian phone number format");
}
const result = await sendOTP(normalizedPhone, {
purpose: `contact_change:${userId}:new_phone`,
});
if (!result.success) {
logger.warn("New phone OTP send failed", {
userId,
error: result.error,
});
return result.retryAfterSeconds
? ApiResponse.tooManyRequests("Failed to send OTP to new phone.", result.retryAfterSeconds)
: ApiResponse.error("Failed to send OTP to new phone.", 500);
}
}

return ApiResponse.success(null, `OTP sent to new ${type}`);
}

async function validateNewOtp(
userId: string,
type: "email" | "phone",
newContact: string,
newOtp: string
): Promise<{ success: boolean; errorResponse?: NextResponse }> {
if (type === 'email') {
const newEmailOtpKey = `contact_change_new_email_otp_${userId}`;
const storedHash = await redis.get(newEmailOtpKey);
if (!storedHash) {
return { success: false };
}
const submittedHash = createHash("sha256").update(newOtp).digest("hex");
try {
const { timingSafeEqual } = await import("node:crypto");
const storedBuffer = Buffer.from(storedHash, "utf8");
const submittedBuffer = Buffer.from(submittedHash, "utf8");
if (storedBuffer.length === submittedBuffer.length) {
const isValid = timingSafeEqual(storedBuffer, submittedBuffer);
return { success: isValid };
}
} catch {
return { success: false };
}
return { success: false };
} else {
const normalizedPhone = normalizeIndianPhone(newContact);
if (!normalizedPhone) {
return { success: false, errorResponse: ApiResponse.error("Invalid Indian phone number format") };
}
const phoneVerifyResult = await verifyPhoneOTP(
normalizedPhone,
newOtp,
{ purpose: `contact_change:${userId}:new_phone` },
);
return { success: phoneVerifyResult.success };
}
}

async function getContactUpdateData(
userId: string,
type: "email" | "phone",
newContact: string
): Promise<{
success: boolean;
updateData?: { email?: string; emailVerified?: boolean; phone?: string; phoneVerified?: boolean };
errorResponse?: NextResponse;
}> {
const updateData: { email?: string; emailVerified?: boolean; phone?: string; phoneVerified?: boolean } = {};
if (type === 'email') {
const existing = await prisma.user.findUnique({
where: { email: newContact.toLowerCase().trim() },
select: { id: true },
});
if (existing && existing.id !== userId) {
return { success: false, errorResponse: ApiResponse.conflict("Contact is already in use") };
}
updateData.email = newContact.toLowerCase().trim();
updateData.emailVerified = true;
} else {
const normalizedPhone = normalizeIndianPhone(newContact);
if (!normalizedPhone) {
return { success: false, errorResponse: ApiResponse.error("Invalid Indian phone number format") };
}
const existing = await prisma.user.findUnique({
where: { phone: normalizedPhone },
select: { id: true },
});
if (existing && existing.id !== userId) {
return { success: false, errorResponse: ApiResponse.conflict("Contact is already in use") };
}
updateData.phone = normalizedPhone;
updateData.phoneVerified = true;
}
return { success: true, updateData };
}

async function handleConfirmNewAction(
userId: string,
type?: "email" | "phone",
newContact?: string,
newOtp?: string
) {
const authKey = `contact_change_auth_session_${userId}`;
const isAuthorized = await redis.get(authKey);
if (!isAuthorized) return ApiResponse.forbidden("Session expired or unauthorized");
if (!type || !newContact || !newOtp) return ApiResponse.error("Missing required fields");

const otpValidation = await validateNewOtp(userId, type, newContact, newOtp);
if (otpValidation.errorResponse) return otpValidation.errorResponse;
if (!otpValidation.success) {
return ApiResponse.error("Invalid OTP for new contact");
}

const updateCheck = await getContactUpdateData(userId, type, newContact);
if (updateCheck.errorResponse) return updateCheck.errorResponse;
if (!updateCheck.success || !updateCheck.updateData) {
return ApiResponse.error("Failed to process contact change update data");
}

const updateData = updateCheck.updateData;

await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
await tx.user.update({
where: { id: userId },
data: updateData,
});
await tx.refreshToken.updateMany({
where: { userId, revoked: false },
data: { revoked: true },
});
await createActivityLog({
userId,
action: "PROFILE_UPDATE",
entityType: "User",
entityId: userId,
}, tx);
});

const newEmailOtpKey = `contact_change_new_email_otp_${userId}`;
await redis.del(authKey);
await redis.del(`active_session:${userId}`);
if (type === 'email') await redis.del(newEmailOtpKey);

return ApiResponse.success(null, `${type} updated successfully!`);
}

export const POST = apiWrapper(async function POST(req: NextRequest) {
try {
const session = await auth();
if (!session?.user?.id) {
return ApiResponse.unauthorized();
}

const body = await req.json();
const parsed = changeContactSchema.safeParse(body);

if (!parsed.success) {
const firstIssue = parsed.error.issues[0];
const fieldName = firstIssue?.path.join(".") || "";
const issueMsg = firstIssue?.message || "Invalid value";
const prefix = fieldName ? `${fieldName} - ` : "";
return ApiResponse.error(`Validation failed: ${prefix}${issueMsg}`);
}

const { action, currentEmailOtp, currentPhoneOtp, type, newContact, newOtp } = parsed.data;
const userId = session.user.id;
const rateLimit = await checkRateLimit(userId, "AUTH");
if (!rateLimit.success) {
return ApiResponse.tooManyRequests("Too many attempts. Please try again later.");
}

const user = await prisma.user.findUnique({
where: { id: userId },
});

if (!user) return ApiResponse.notFound("User not found");

if (action === 'init') {
return handleInitAction(user);
}
if (action === 'verify-current') {
return handleVerifyCurrentAction(user, currentEmailOtp, currentPhoneOtp);
}
if (action === 'send-new') {
return handleSendNewAction(userId, type, newContact);
}
if (action === 'confirm-new') {
return handleConfirmNewAction(userId, type, newContact, newOtp);
}

return ApiResponse.error("Invalid action");
} catch (error) {
logger.error("Change contact error:", error);
if (error instanceof AppError) {
return ApiResponse.error(error.message, error.statusCode);
}
return ApiResponse.error("An unexpected error occurred.", 500);
}
});
