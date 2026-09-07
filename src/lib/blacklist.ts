import { redis } from "./redis";
import { logger } from "./logger";
import prisma from "./db";

const IP_BAN_PREFIX = "ban:ip:";
const TOKEN_REVOKE_PREFIX = "revoke:token:";

/**
* Dynamic Threat Blacklisting and JWT revocation.
*/

export async function banIp(
ip: string,
reason: string,
durationSeconds: number = 86400,
): Promise<void> {
try {
await redis.setex(`${IP_BAN_PREFIX}${ip}`, durationSeconds, reason);
logger.warn(`[SECURITY] IP Banned: ${ip}`, { reason, durationSeconds });
} catch (error) {
logger.error("Failed to ban IP", error);
}
}

export async function isIpBanned(ip: string): Promise<boolean> {
try {
const result = await redis.get(`${IP_BAN_PREFIX}${ip}`);
return !!result;
} catch (_error) {
logger.error("IP ban check failed; failing closed", _error, { ip });
if (process.env.NODE_ENV !== "production") {
logger.warn(`[DEVELOPMENT] Failing open on IP ban check for ${ip} because Redis is offline`);
return false;
}
return true;
}
}

async function revokeToken(
jti: string,
durationSeconds: number = 86400,
): Promise<void> {
try {
// We set the token JTI to be revoked until it naturally expires
await redis.setex(
`${TOKEN_REVOKE_PREFIX}${jti}`,
durationSeconds,
"revoked",
);
logger.info(`[SECURITY] Token Revoked: ${jti}`);
} catch (error) {
logger.error("Failed to revoke token", error);
}
}

export async function isTokenRevoked(jti: string): Promise<boolean> {
if (!jti) return false;
try {
const result = await redis.get(`${TOKEN_REVOKE_PREFIX}${jti}`);
return !!result;
} catch (_error) {
logger.error("Token revocation check failed; failing closed", _error);
if (process.env.NODE_ENV !== "production") {
logger.warn(`[DEVELOPMENT] Failing open on Token revocation check for ${jti} because Redis is offline`);
return false;
}
return true;
}
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
try {
// 1. Fetch all tracked JTIs for this user from Redis set
const jtiSetKey = `user:jtis:${userId}`;
const jtis = await redis.smembers(jtiSetKey);

// 2. Revoke each JTI
if (jtis && jtis.length > 0) {
await Promise.all(jtis.map((jti) => revokeToken(jti)));
}

// 3. Clear the set, active session token, and cached admin status (if any)
await Promise.allSettled([
redis.del(jtiSetKey),
redis.del(`active_session:${userId}`),
redis.del(`admin_auth_cache:${userId}`),
]);

// 4. Revoke refresh tokens in the database
await prisma.refreshToken.updateMany({
where: { userId, revoked: false },
data: { revoked: true },
});

logger.info(`[SECURITY] Revoked all sessions for user: ${userId}`, { revokedJtiCount: jtis?.length || 0 });
} catch (error) {
logger.error("Failed to revoke all user sessions", error, { userId });
}
}
