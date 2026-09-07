import { AppError } from "@/lib/errors";
import prisma from "../db";
import { logger } from "../logger";
import { getSecureClientIp } from "../ip";
import { redis } from "../redis";
import { verify } from "otplib";
import { isVPNOrProxy, getIpDetails } from "../ipinfo";
import { checkRateLimit } from "../rate-limit";
import { createActivityLog, ActivityAction } from "../audit";
import { generateRefreshToken } from "../tokens";
import { compare } from "bcryptjs";
import { encrypt, decrypt } from "../encryption";


export async function storeActiveSessionToken(userId: string, refreshToken: string) {
  try {
    await redis.setex(`active_session:${userId}`, 7 * 24 * 60 * 60, refreshToken);
  } catch (error) {
logger.error("Failed to persist active session token", error, { userId });
if (process.env.NODE_ENV === "production") {
throw error;
}
}
}

export function resolveClientIpAndAgent(request: unknown) {
  let ip = "unknown";
  if (request instanceof Request) {
    ip = getSecureClientIp(request);
  }

const userAgent =
request instanceof Request
? request.headers.get("user-agent") || "unknown"
: "unknown";

return { ip, userAgent };
}

export async function checkLoginLimitsAndBlacklist(ip: string, email: string) {
const { isIpBanned } = await import("../blacklist");
if (await isIpBanned(ip)) {
logger.warn(`Login blocked blacklisted IP`, { ip });
throw AppError.badRequest("SUSPICIOUS_IP_BLOCK: Login blocked due to suspicious IP detection.");
}

const ipLimit = await checkRateLimit(ip, "LOGIN_IP");
if (!ipLimit.success) {
logger.warn(`Login blocked by IP rate limit`, { ip });
return false;
}

const emailLimit = await checkRateLimit(email, "LOGIN_EMAIL");
if (!emailLimit.success) {
logger.warn(`Login blocked by Email rate limit`, { email });
return false;
}

return true;
}

export async function handleFailedLoginAttempt(user: { id: string; failedLoginAttempts?: number | null }, email: string, ip: string, userAgent: string) {
const newFailCount = (user.failedLoginAttempts || 0) + 1;
const lockThreshold = 10;
const lockDurationMs = 30 * 60 * 1000; // 30 minutes

await prisma.user.update({
where: { id: user.id },
data: {
failedLoginAttempts: newFailCount,
...(newFailCount >= lockThreshold
? { lockedUntil: new Date(Date.now() + lockDurationMs) }
: {}),
},
});

try {
await prisma.loginAttempt.create({
data: {
userId: user.id,
email,
ipAddress: ip,
userAgent,
success: false,
failureReason: "INVALID_PASSWORD",
},
});
} catch (logErr) {
logger.warn("Failed to log failed login attempt", {
error: logErr instanceof Error ? logErr.message : String(logErr),
email,
});
}

logger.warn("Failed login invalid password", { email, ip });
throw AppError.badRequest("INVALID_PASSWORD");
}

async function checkImpossibleTravelInternal(user: { id: string; isTwoFactorEnabled?: boolean }, ip: string, lastDevice: { lastIp?: string; lastLocation?: string | null; lastSeenAt: Date } | null, credentials: Record<string, unknown>) {
if (!lastDevice || lastDevice.lastIp === ip || !lastDevice.lastLocation) return;

const currentGeo = await getIpDetails(ip);
if (!currentGeo) return;

const [lastLatStr, lastLonStr] = lastDevice.lastLocation.split(",");
const lastLat = Number(lastLatStr);
const lastLon = Number(lastLonStr);

if (Number.isNaN(lastLat) || Number.isNaN(lastLon)) return;

const R = 6371; // Radius of the earth in km
const dLat = (currentGeo.latitude - lastLat) * Math.PI / 180;
const dLon = (currentGeo.longitude - lastLon) * Math.PI / 180;
const a =
Math.sin(dLat / 2) * Math.sin(dLat / 2) +
Math.cos(lastLat * Math.PI / 180) * Math.cos(currentGeo.latitude * Math.PI / 180) *
Math.sin(dLon / 2) * Math.sin(dLon / 2);
const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
const distance = R * c;

const timeDiffHours = (Date.now() - new Date(lastDevice.lastSeenAt).getTime()) / (3600 * 1000);

if (distance > 1000 && timeDiffHours < 4) {
logger.warn("Geo-suspicious login detected (Impossible Travel)", {
userId: user.id,
ip,
lastIp: lastDevice.lastIp,
distance,
timeDiffHours,
});

await createActivityLog({
userId: user.id,
action: ActivityAction.SECURITY_ALERT,
entityType: "USER",
entityId: user.id,
metadata: {
type: "IMPOSSIBLE_TRAVEL",
ip,
lastIp: lastDevice.lastIp,
distance,
timeDiffHours,
},
ipAddress: ip,
}).catch(() => {});

if (user.isTwoFactorEnabled) {
const code = (credentials as Record<string, string>).twoFactorCode;
if (!code) {
throw AppError.badRequest("2FA_REQUIRED");
}
} else {
throw AppError.badRequest("SUSPICIOUS_LOGIN_BLOCK: Geo-suspicious login detected (Impossible Travel). Account security review required.");
}
}
}

export async function verifyImpossibleTravelAndVpn(user: { id: string; isTwoFactorEnabled?: boolean }, ip: string, email: string, credentials: Record<string, unknown>) {
try {
const isSuspiciousIP = await isVPNOrProxy(ip);
if (isSuspiciousIP && process.env.NODE_ENV === "production") {
logger.warn("Login attempt blocked Suspicious IP detected (VPN/Proxy/Tor)", { email, ip });
await createActivityLog({
userId: user.id,
action: ActivityAction.SECURITY_ALERT,
entityType: "USER",
entityId: user.id,
metadata: { type: "SUSPICIOUS_IP", ip },
ipAddress: ip,
});
throw AppError.badRequest("SUSPICIOUS_IP_BLOCK: Login blocked due to suspicious IP detection (VPN/Proxy/Tor). Please disable your VPN.");
}
} catch (ipErr: unknown) {
const ipErrMsg = ipErr instanceof Error ? ipErr.message : String(ipErr);
if (ipErrMsg.startsWith("SUSPICIOUS_IP_BLOCK")) throw ipErr;
logger.warn("IP info lookup failed non-fatal", { error: ipErr, ip });
}

try {
const lastDevice = await prisma.deviceFingerprint.findFirst({
where: { userId: user.id },
orderBy: { lastSeenAt: "desc" },
});

await checkImpossibleTravelInternal(user, ip, lastDevice, credentials);
} catch (err) {
if ((err instanceof Error ? err.message : String(err))?.startsWith("SUSPICIOUS_LOGIN_BLOCK")) throw err;
logger.warn("Impossible travel detection failed non-fatal", { error: err, email });
}
}

async function checkRecoveryCodeFallback(user: { id: string; twoFactorRecoveryCodes?: string | null }, code: string): Promise<boolean> {
if (!user.twoFactorRecoveryCodes) return false;
try {
const recoveryHashes = JSON.parse(user.twoFactorRecoveryCodes) as string[];
const matchingIndex = await (async () => {
for (let i = 0; i < recoveryHashes.length; i++) {
const hash = recoveryHashes[i];
if (hash) {
const match = await compare(code.toUpperCase(), hash);
if (match) return i;
}
}
return -1;
})();

if (matchingIndex !== -1) {
const updatedHashes = recoveryHashes.filter((_, idx) => idx !== matchingIndex);
await prisma.user.update({
where: { id: user.id },
data: {
twoFactorRecoveryCodes: JSON.stringify(updatedHashes),
},
});
return true;
}
} catch (recErr) {
logger.error("Failed to verify/consume 2FA recovery code", recErr);
}
return false;
}

export async function verifyTwoFactorCode(user: { isTwoFactorEnabled?: boolean; twoFactorSecret?: string | null; twoFactorRecoveryCodes?: string | null; id: string }, credentials: Record<string, unknown>) {
if (user.isTwoFactorEnabled && user.twoFactorSecret) {
const code = (credentials as Record<string, string>).twoFactorCode;
if (!code) {
throw AppError.badRequest("2FA_REQUIRED");
}

const verifyResult = await verify({
token: code,
secret: (() => {
try {
return decrypt(user.twoFactorSecret!);
} catch {
return user.twoFactorSecret!;
}
})(),
});

const isValidToken =
typeof verifyResult === "object" && verifyResult !== null
? (verifyResult as { valid: boolean }).valid
: verifyResult;

if (!isValidToken) {
const isRecoveryCodeValid = await checkRecoveryCodeFallback(user, code);
if (!isRecoveryCodeValid) {
throw AppError.badRequest("INVALID_2FA");
}
}
}
}

export function trackUserDeviceFingerprint(userId: string, ip: string, userAgent: string) {
const fingerprint = `${ip}|${userAgent}`;
(async () => {
try {
const geoDetails = await getIpDetails(ip);
const lastLocation = geoDetails ? `${geoDetails.latitude},${geoDetails.longitude}` : null;

const existingDevice = await prisma.deviceFingerprint.findFirst({
where: {
userId,
fingerprint,
},
});

if (existingDevice) {
await prisma.deviceFingerprint.update({
where: { id: existingDevice.id },
data: {
lastSeenAt: new Date(),
lastIp: ip,
userAgent,
...(lastLocation ? { lastLocation } : {}),
},
});
} else {
await prisma.deviceFingerprint.create({
data: {
userId,
fingerprint,
lastIp: ip,
userAgent,
lastLocation,
},
});
}
} catch (e: unknown) {
logger.warn("Failed to track device fingerprint", {
error: e instanceof Error ? e.message : String(e),
});
}
})().catch((err) => {
logger.warn("Device fingerprint tracking failed", { error: err, userId });
});
}

export async function handleGoogleOAuthSignIn(user: { email?: string | null; id?: string; userType?: string; status?: string; verificationLevel?: string; trustScore?: number; xp?: number; level?: number }, account: { provider?: string; providerAccountId: string; access_token?: string | null }): Promise<boolean | string> {
  const email = user.email?.trim().toLowerCase();
  if (!email) {
    logger.warn("Google OAuth login rejected: no email provided");
    return false;
  }

const dbUser = await prisma.user.findUnique({ where: { email } });

if (dbUser) {
if (dbUser.status === "BANNED") {
logger.warn("Google OAuth login rejected for banned account", { email });
return false;
}
if (dbUser.status === "SUSPENDED") {
logger.warn("Google OAuth login rejected for suspended account", { email });
return false;
}
if (dbUser.status === "DELETED") {
logger.warn("Google OAuth login rejected for deleted account", { email });
return false;
}
}

if (!dbUser) {
logger.warn("Google OAuth login rejected: user not registered", { email });
return "/register?error=OAuthAccountNotRegistered";
}

try {
await prisma.oAuthAccount.upsert({
where: {
provider_providerAccountId: {
provider: "google",
providerAccountId: account.providerAccountId,
},
},
update: { accessToken: account.access_token ? encrypt(account.access_token) : null },
create: {
userId: dbUser.id,
provider: "google",
providerAccountId: account.providerAccountId,
accessToken: account.access_token ? encrypt(account.access_token) : null,
},
});
} catch (oauthLinkError) {
logger.warn("Failed to upsert OAuthAccount during Google sign-in", {
error: oauthLinkError,
email,
});
}

user.id = dbUser.id;
user.userType = dbUser.userType;
user.status = dbUser.status;
user.verificationLevel = dbUser.verificationLevel;
user.trustScore = dbUser.trustScore;
user.xp = dbUser.xp;
user.level = dbUser.level;

await generateRefreshToken(user.id);
return true;
}

