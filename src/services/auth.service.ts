import { AppError } from "@/lib/errors";
import prisma from "@/lib/db";
import { hash, compare } from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";

import { checkRateLimit } from "@/lib/rate-limit";
import { OtpTokenType, Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";
import { sendPasswordResetEmail, sendWelcomeEmail } from "@/lib/email";
import { isIpBanned } from "@/lib/blacklist";
import { checkRegistrationFraud } from "@/lib/fraud-detection";
import { createActivityLog } from "@/lib/audit";

import { generateReferralCode } from "@/lib/utils";
import type { RegisterInput } from "@/lib/validations";

function hashResetToken(token: string): string {
return createHash("sha256").update(token).digest("hex");
}

interface FraudCheckResult {
action: "ALLOW" | "REVIEW" | "BLOCK";
riskScore: number;
flags: Array<{
rule: string;
severity: string;
description: string;
}>;
}

/**
* Centralized Authentication Service
* Wraps NextAuth, DB, and RBAC logic into a cohesive service.
*/
export class AuthService {
private static async checkRegistrationFraudAndRateLimit(
email: string,
phone: string,
ip: string,
deviceFingerprint: string,
userAgent: string,
userType: string,
): Promise<FraudCheckResult> {
const fraudCheck = await checkRegistrationFraud({
email,
phone,
ipAddress: ip,
deviceFingerprint,
userAgent,
}) as FraudCheckResult;

if (fraudCheck.action === "BLOCK" || fraudCheck.action === "REVIEW") {
const logMsg = fraudCheck.action === "BLOCK"
? "Registration blocked by fraud detection"
: "Registration flagged for review by fraud detection";
logger.warn(logMsg, {
email,
phone,
ip,
userType,
action: fraudCheck.action,
riskScore: fraudCheck.riskScore,
flags: fraudCheck.flags.map((flag) => ({
rule: flag.rule,
severity: flag.severity,
description: flag.description,
})),
});
if (fraudCheck.action === "BLOCK") {
throw AppError.badRequest("Registration blocked. Please contact support.");
}
}
return fraudCheck;
}

private static async resolveReferrer(referralCodeInput?: string): Promise<string | undefined> {
if (!referralCodeInput) return undefined;
const referrer = await prisma.user.findUnique({
where: { referralCode: referralCodeInput },
select: { id: true },
});
if (!referrer) {
throw AppError.badRequest("Invalid referral code");
}
return referrer.id;
}

private static async createUserTransaction(
tx: Prisma.TransactionClient,
params: {
email: string;
phone: string;
passwordHash: string;
userType: string;
name: string;
referralSeed: string;
referrerId?: string | undefined;
ip: string;
userAgent: string;
deviceFingerprint: string;
options?: {
emailVerified?: boolean;
phoneVerified?: boolean;
} | undefined;
fraudCheck: FraudCheckResult;
}
): Promise<{ id: string }> {
const { email, phone, passwordHash, userType, name, referralSeed, referrerId, ip, userAgent, deviceFingerprint, options, fraudCheck } = params;
const newUser = await tx.user.create({
data: {
email,
phone,
passwordHash,
userType: userType as import("@prisma/client").UserType,
verificationLevel: options?.emailVerified && options?.phoneVerified ? "BASIC" : "NONE",
trustScore: 600,
status: options?.emailVerified && options?.phoneVerified ? "ACTIVE" : "PENDING_VERIFICATION",
emailVerified: options?.emailVerified ?? false,
phoneVerified: options?.phoneVerified ?? false,
referralCode: generateReferralCode(referralSeed.slice(0, 6)),
referredBy: referrerId ?? null,
},
select: { id: true },
});

if (userType === "INFLUENCER") {
await tx.influencerProfile.create({
data: {
userId: newUser.id,
displayName: name,
categories: "General",
languages: "English",
},
});
} else if (userType === "BRAND") {
await tx.brandProfile.create({
data: {
userId: newUser.id,
companyName: name,
},
});
}

await tx.indiaTaxCompliance.create({
data: {
userId: newUser.id,
gstRegistrationType: "UNREGISTERED",
status: "ACTION_REQUIRED",
},
});

await tx.wallet.create({
data: { userId: newUser.id, balance: 0, pendingBalance: 0 },
});

await tx.deviceFingerprint.create({
data: {
userId: newUser.id,
fingerprint: deviceFingerprint,
lastIp: ip,
userAgent,
isTrusted: fraudCheck.action === "ALLOW",
},
});

await createActivityLog({
userId: newUser.id,
action: "REGISTER",
entityType: "User",
entityId: newUser.id,
ipAddress: ip,
metadata: {
userType,
fraudAction: fraudCheck.action,
fraudRiskScore: fraudCheck.riskScore,
fraudFlags: fraudCheck.flags.map((flag) => ({
rule: flag.rule,
severity: flag.severity,
description: flag.description,
})),
},
}, tx);

return newUser;
}

private static handleUniqueConstraintError(error: unknown, attempt: number): void {
const prismaErr = error as { code?: string; meta?: { target?: string[] | string } };
const target = Array.isArray(prismaErr?.meta?.target)
? prismaErr.meta.target.join(",")
: String(prismaErr?.meta?.target || "");
const lowerTarget = target.toLowerCase();
if (prismaErr?.code === "P2002" && lowerTarget.includes("email")) {
throw AppError.badRequest("Email already registered");
}
if (prismaErr?.code === "P2002" && lowerTarget.includes("phone")) {
throw AppError.badRequest("Phone number already registered");
}
const isReferralCodeConflict =
prismaErr?.code === "P2002" && lowerTarget.includes("referralcode");
if (!isReferralCodeConflict || attempt === 4) {
throw error;
}
}

/**
* Register a new user with advanced validation and initial setup
*/
static async registerUser(
data: RegisterInput,
ip: string,
options?: {
emailVerified?: boolean;
phoneVerified?: boolean;
deviceFingerprint?: string;
userAgent?: string;
},
) {
if (await isIpBanned(ip)) {
throw AppError.forbidden("Access denied");
}

const limit = await checkRateLimit(ip, "REGISTER");
if (!limit.success) {
throw AppError.badRequest(`Rate limit exceeded. Try again in ${Math.ceil((limit.reset - Date.now() / 1000) / 60)} minutes.`,
);
}

const email = data.email.toLowerCase().trim();
const phone = data.phone.trim();
const password = data.password;
const name = data.name.trim();
const userType = data.userType;
const referralCodeInput = data.referralCode?.trim();
const userAgent = options?.userAgent?.trim() || "unknown";
const deviceFingerprint =
options?.deviceFingerprint?.trim() ||
createHash("sha256")
.update(`${ip}|${userAgent}`)
.digest("hex");

const fraudCheck = await AuthService.checkRegistrationFraudAndRateLimit(
email,
phone,
ip,
deviceFingerprint,
userAgent,
userType,
);

const [existingByEmail, existingByPhone] = await Promise.all([
prisma.user.findUnique({
where: { email },
select: { id: true },
}),
prisma.user.findUnique({
where: { phone },
select: { id: true },
}),
]);

if (existingByEmail) {
throw AppError.badRequest("Email already registered");
}

if (existingByPhone) {
throw AppError.badRequest("Phone number already registered");
}

const referrerId = await AuthService.resolveReferrer(referralCodeInput);
const passwordHash = await hash(password, 12);
const referralSeed = name || email.split("@")[0] || "user";
let user: { id: string };

for (let attempt = 0; attempt < 5; attempt++) {
try {
user = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
return AuthService.createUserTransaction(tx, {
email,
phone,
passwordHash,
userType,
name,
referralSeed,
referrerId,
ip,
userAgent,
deviceFingerprint,
options,
fraudCheck,
});
});

logger.info("User registered", {
userId: user.id,
type: userType,
ip,
fraudAction: fraudCheck.action,
fraudRiskScore: fraudCheck.riskScore,
});
sendWelcomeEmail(email, name).catch((err) => {
logger.error("Failed to send welcome email upon registration", {
userId: user.id,
error: err instanceof Error ? err.message : String(err),
});
});

return user;
} catch (error: unknown) {
AuthService.handleUniqueConstraintError(error, attempt);
}
}

throw AppError.badRequest("Unable to generate a unique referral code");
}

/**
* Verify an OTP Token robustly.
*/
static async verifyOtp(userId: string, code: string, type: OtpTokenType) {
const tokenRecord = await prisma.otpToken.findFirst({
where: { userId, type, consumedAt: null },
orderBy: { createdAt: "desc" },
});

if (!tokenRecord) throw AppError.badRequest("Invalid or expired OTP");
if (tokenRecord.expiresAt < new Date()) throw AppError.badRequest("OTP has expired");

if (tokenRecord.attempts >= tokenRecord.maxAttempts) {
await prisma.otpToken.update({
where: { id: tokenRecord.id },
data: { consumedAt: new Date() }, // Burn token
});
throw AppError.badRequest("Maximum attempts exceeded");
}

const isValid = await compare(code, tokenRecord.hashedToken);

if (!isValid) {
const updatedAttempts = tokenRecord.attempts + 1;
await prisma.otpToken.update({
where: { id: tokenRecord.id },
data: {
attempts: updatedAttempts,
consumedAt: updatedAttempts >= tokenRecord.maxAttempts ? new Date() : null,
},
});
throw AppError.badRequest("Invalid OTP");
}

// OTP is valid! Mark as consumed atomically to prevent concurrent double-consumption.
const consumeResult = await prisma.otpToken.updateMany({
where: { id: tokenRecord.id, consumedAt: null },
data: { consumedAt: new Date() },
});

if (consumeResult.count === 0) {
throw AppError.badRequest("Invalid or expired OTP");
}

return true;
}


/**
* Change Password
*/
static async changePassword(userId: string, oldPass: string, newPass: string) {
const user = await prisma.user.findUnique({ where: { id: userId } });
if (!user) throw AppError.notFound("User not found");

const isValid = await compare(oldPass, user.passwordHash);
if (!isValid) throw AppError.badRequest("Incorrect old password");

const newHash = await hash(newPass, 12);
await prisma.user.update({
where: { id: userId },
data: { passwordHash: newHash, lastPasswordChange: new Date() },
});
const { revokeAllUserSessions } = await import("@/lib/blacklist");
await revokeAllUserSessions(userId);

logger.info("User changed password", { userId });
return true;
}

/**
* Reset Password Completion
*/
static async requestPasswordReset(email: string) {
const normalizedEmail = email.toLowerCase().trim();
const user = await prisma.user.findUnique({
where: { email: normalizedEmail },
select: { id: true, email: true, status: true },
});

if (!user || user.status === "BANNED") {
return { sent: false };
}

const token = randomBytes(32).toString("hex");
const resetToken = hashResetToken(token);

await prisma.user.update({
where: { id: user.id },
data: {
resetToken,
resetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000),
},
});

const sent = await sendPasswordResetEmail(user.email, token);
if (!sent) {
logger.error("Password reset email failed to send", { userId: user.id });
}

// SECURITY: Never return the raw token to the client.
// It is delivered exclusively via the email channel.
return { sent };
}

static async resetPassword(token: string, newPass: string) {
const hashedToken = hashResetToken(token);
const newHash = await hash(newPass, 12);
const resetUser = await prisma.user.findFirst({
where: {
resetToken: hashedToken,
resetTokenExpiry: { gt: new Date() },
},
select: { id: true },
});
if (!resetUser) throw AppError.badRequest("Invalid or expired token");

// ATOMIC: Check token validity and clear it in a single query.
// This prevents TOCTOU race conditions where two concurrent requests
// with the same token could both succeed (double reset attack).
const result = await prisma.user.updateMany({
where: {
id: resetUser.id,
resetToken: hashedToken,
resetTokenExpiry: { gt: new Date() },
},
data: {
passwordHash: newHash,
resetToken: null,
resetTokenExpiry: null,
lastPasswordChange: new Date(),
},
});

if (result.count === 0) throw AppError.badRequest("Invalid or expired token");

const { revokeAllUserSessions } = await import("@/lib/blacklist");
await revokeAllUserSessions(resetUser.id);

logger.info("User reset password (atomic)", { matchedCount: result.count });
return true;
}
}
