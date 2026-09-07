import prisma from "../db";
import { logger } from "../logger";
import { getSecureClientIp } from "../ip";
import { redis } from "../redis";
import { rotateRefreshToken } from "../tokens";
import { randomUUID } from "node:crypto";
import { AppError } from "@/lib/errors";


const ACCESS_TOKEN_EXPIRY = 15 * 60 * 1000; // 15 minutes

export async function handleExistingJwtSession(token: Record<string, unknown>): Promise<Record<string, unknown>> {
const securityCheck = await checkSessionSecurityAndStatus(token);
if (!securityCheck.valid) {
return {
...token,
...(securityCheck.status ? { status: securityCheck.status } : {}),
error: securityCheck.status ? "AccountBlocked" : "SessionRevoked",
};
}

if (Date.now() < ((token.accessTokenExpires as number) || 0)) {
return token;
}
return rotateSessionToken(token);
}

export async function trackActiveJtiInRedis(userId: string, jti: string): Promise<void> {
try {
await redis.sadd(`user:jtis:${userId}`, jti);
await redis.expire(`user:jtis:${userId}`, 7 * 24 * 60 * 60); // 7 days TTL matching NextAuth session maxAge
} catch (err) {
logger.warn("Failed to track JTI in Redis", { error: String(err), userId });
}
}

export async function handleInitialJwtSession(
token: Record<string, unknown>,
user: { id: string; refreshToken?: string; name?: string | null; userType?: string; status?: string; verificationLevel?: string; trustScore?: number; xp?: number; level?: number } | null | undefined,
trigger: string | undefined
): Promise<Record<string, unknown>> {
if (trigger === "update" && token.id) {
try {
const dbData = await prisma.user.findUnique({
where: { id: token.id as string },
select: {
userType: true,
status: true,
verificationLevel: true,
trustScore: true,
xp: true,
level: true,
email: true,
influencerProfile: { select: { displayName: true, avatar: true } },
brandProfile: { select: { companyName: true, logo: true } },
}
});
if (dbData) {
token.userType = dbData.userType;
token.status = dbData.status;
token.verificationLevel = dbData.verificationLevel;
token.trustScore = dbData.trustScore;
token.xp = dbData.xp;
token.level = dbData.level;
token.name = dbData.influencerProfile?.displayName || dbData.brandProfile?.companyName || dbData.email.split('@')[0] || null;
token.image = dbData.influencerProfile?.avatar || dbData.brandProfile?.logo || null;
}
} catch (_e) {
logger.warn("Failed to fetch fresh user data for token update", {
error: _e instanceof Error ? _e.message : String(_e),
userId: token.id,
});
}
} else if (user) {
token.id = user.id;
token.userType = user.userType ?? "INFLUENCER";
token.status = user.status ?? "PENDING_VERIFICATION";
token.verificationLevel = user.verificationLevel ?? "NONE";
token.trustScore = user.trustScore ?? 600;
token.xp = user.xp ?? 0;
token.level = user.level ?? 1;
token.name = user.name ?? token.name ?? null;
token.image = ("image" in user && typeof user.image === "string" ? user.image : null) ?? token.image ?? null;

(async () => {
try {
const { checkAndAwardBadges } = await import("../gamification-engine");
await checkAndAwardBadges(user.id, "LOGIN");
} catch (err) {
logger.error("Failed to check login badges", err);
}
})().catch(() => {});
}
token.lastRefreshed = Date.now();
token.jti = token.jti || randomUUID();

try {
const { headers } = await import("next/headers");
const headerList = await headers();
token.ip = getSecureClientIp({ headers: headerList });
token.ua = headerList.get("user-agent") || "unknown";
} catch (_e) {
logger.debug("Failed to get request headers for JWT enrichment", { error: _e });
}

if (user?.refreshToken) {
token.refreshToken = user.refreshToken;
}
token.accessTokenExpires = Date.now() + ACCESS_TOKEN_EXPIRY;

return token;
}

async function verifyUserAccountStatus(userId: string, token: Record<string, unknown>, now: number): Promise<{ valid: boolean; status?: string }> {
const dbUser = await prisma.user.findUnique({
where: { id: userId },
select: { status: true },
});
if (dbUser) {
if (dbUser.status === "BANNED" || dbUser.status === "SUSPENDED" || dbUser.status === "DELETED") {
return { valid: false, status: dbUser.status };
}
token.status = dbUser.status;
} else {
return { valid: false };
}
token.lastCheckedStatus = now;
return { valid: true };
}

async function isSessionRevokedByJti(jti: unknown): Promise<boolean> {
if (typeof jti === "string") {
const { isTokenRevoked } = await import("../blacklist");
return await isTokenRevoked(jti);
}
return false;
}

async function verifyActiveSessionToken(userId: string, currentRefreshToken: unknown): Promise<boolean> {
const activeToken = await redis.get(`active_session:${userId}`);
return !activeToken || activeToken === currentRefreshToken;
}

async function checkSessionSecurityAndStatus(token: Record<string, unknown>): Promise<{ valid: boolean; status?: string }> {
try {
if (typeof token.id === "string") {
const isSessionValid = await verifyActiveSessionToken(token.id, token.refreshToken);
if (!isSessionValid) return { valid: false };

const now = Date.now();
const lastChecked = (token.lastCheckedStatus as number) || 0;
if (now - lastChecked > 60 * 1000) {
const check = await verifyUserAccountStatus(token.id, token, now);
if (!check.valid) return check;
}
}

if (await isSessionRevokedByJti(token.jti)) {
return { valid: false };
}
} catch (error) {
logger.error(
"Session security check failed; revoking request",
error,
typeof token.id === "string" ? { userId: token.id } : {},
);
if (process.env.NODE_ENV !== "production") {
return { valid: true };
}
return { valid: false };
}
return { valid: true };
}

async function rotateSessionToken(token: Record<string, unknown>): Promise<Record<string, unknown>> {
try {
if (!token.refreshToken) throw AppError.badRequest("No refresh token");

const newRefreshToken = await rotateRefreshToken(
token.refreshToken as string,
);

if (!newRefreshToken) {
return { ...token, error: "RefreshAccessTokenError" };
}

try {
if (typeof token.id === "string") {
await redis.set(
`active_session:${token.id}`,
newRefreshToken.token,
);
}
} catch (redisErr) {
logger.warn("Failed to set active session in Redis during token rotation", {
error: redisErr instanceof Error ? redisErr.message : String(redisErr),
userId: token.id,
});
}

return {
...token,
refreshToken: newRefreshToken.token,
accessTokenExpires: Date.now() + ACCESS_TOKEN_EXPIRY,
lastRefreshed: Date.now(),
error: undefined,
};
} catch (error) {
logger.error("Token rotation failed", error);
return { ...token, error: "RefreshAccessTokenError" };
}
}

