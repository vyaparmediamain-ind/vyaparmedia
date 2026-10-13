import { redis } from "./redis";
import { logger } from "./logger";
import prisma from "./db";

const IP_BAN_PREFIX = "ban:ip:";
const TOKEN_REVOKE_PREFIX = "revoke:token:";

// In-process memory safety net for active bans during Redis outages
const memoryBannedIps = new Map<string, number>();

/**
 * Dynamic Threat Blacklisting and JWT revocation.
 * Backed by Redis with instant propagation (zero cache delay).
 */

export async function banIp(
  ip: string,
  reason: string,
  durationSeconds: number = 86400,
): Promise<void> {
  memoryBannedIps.set(ip, Date.now() + durationSeconds * 1000);
  try {
    await redis.setex(`${IP_BAN_PREFIX}${ip}`, durationSeconds, reason);
    logger.warn(`[SECURITY] IP Banned: ${ip}`, { reason, durationSeconds });
  } catch (error) {
    logger.error("Failed to ban IP in Redis (retained in memory guard)", error);
  }
}

export async function unbanIp(ip: string): Promise<boolean> {
  memoryBannedIps.delete(ip);
  try {
    const deleted = await redis.del(`${IP_BAN_PREFIX}${ip}`);
    logger.info(`[SECURITY] IP Unbanned: ${ip}`, { success: deleted > 0 });
    return deleted > 0;
  } catch (error) {
    logger.error("Failed to unban IP in Redis", error);
    return false;
  }
}

export async function isIpBanned(ip: string): Promise<boolean> {
  try {
    const result = await redis.get(`${IP_BAN_PREFIX}${ip}`);
    if (result) return true;
  } catch (_error) {
    logger.warn(
      "IP ban check failed due to Redis error, checking in-process security memory",
      { ip, error: _error },
    );
  }

  // Safety net: check in-process ban records with expiry
  const memoryExpiresAt = memoryBannedIps.get(ip);
  if (memoryExpiresAt) {
    if (Date.now() < memoryExpiresAt) {
      return true;
    }
    memoryBannedIps.delete(ip);
  }

  return false;
}

export async function getBanDetails(
  ip: string,
): Promise<{ isBanned: boolean; reason?: string | undefined; ttlSeconds?: number | undefined }> {
  try {
    const key = `${IP_BAN_PREFIX}${ip}`;
    const [reason, ttlSeconds] = await Promise.all([
      redis.get(key),
      redis.ttl(key),
    ]);

    if (!reason) {
      return { isBanned: false };
    }

    return {
      isBanned: true,
      reason,
      ttlSeconds: ttlSeconds > 0 ? ttlSeconds : 0,
    };
  } catch (error) {
    logger.error("Failed to get ban details", error);
    return { isBanned: false };
  }
}

export async function listBannedIps(
  limit: number = 100,
): Promise<Array<{ ip: string; reason: string; ttlSeconds: number }>> {
  try {
    const keys = await redis.keys(`${IP_BAN_PREFIX}*`);
    if (!keys || keys.length === 0) return [];

    const selectedKeys = keys.slice(0, limit);
    const results: Array<{ ip: string; reason: string; ttlSeconds: number }> = [];

    for (const key of selectedKeys) {
      const ip = key.replace(IP_BAN_PREFIX, "");
      const [reason, ttl] = await Promise.all([
        redis.get(key),
        redis.ttl(key),
      ]);
      if (reason) {
        results.push({
          ip,
          reason,
          ttlSeconds: ttl > 0 ? ttl : 0,
        });
      }
    }

    return results;
  } catch (error) {
    logger.error("Failed to list banned IPs", error);
    return [];
  }
}

export async function revokeToken(
  jti: string,
  durationSeconds: number = 86400,
): Promise<void> {
  // 1. PostgreSQL persistence: mark token as revoked in database first
  try {
    await prisma.refreshToken.updateMany({
      where: { token: jti },
      data: { revoked: true },
    });
  } catch (dbErr) {
    logger.warn("Failed to persist token revocation in PostgreSQL", { jti, error: dbErr });
  }

  // 2. Redis fast-path revocation
  try {
    await redis.setex(
      `${TOKEN_REVOKE_PREFIX}${jti}`,
      durationSeconds,
      "revoked",
    );
    logger.info(`[SECURITY] Token Revoked: ${jti}`);
  } catch (error) {
    logger.warn("Failed to set token revocation in Redis (persisted in DB)", { jti, error });
  }
}

export async function isTokenRevoked(jti: string): Promise<boolean> {
  if (!jti) return false;
  try {
    const result = await redis.get(`${TOKEN_REVOKE_PREFIX}${jti}`);
    return !!result;
  } catch (_error) {
    logger.warn(
      "Token revocation Redis lookup failed, checking Postgres database fallback",
      { jti, error: _error },
    );
    // Industry-standard database fallback: check PostgreSQL RefreshToken table
    try {
      const revoked = await prisma.refreshToken.findFirst({
        where: { token: jti, revoked: true },
        select: { id: true },
      });
      return !!revoked;
    } catch (dbErr) {
      logger.error("Token database check also failed", dbErr);
      return false;
    }
  }
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  // 1. Database-first revocation: mark all refresh tokens as revoked in PostgreSQL
  try {
    await prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
    // Invalidate active JWTs by updating user security timestamp
    await prisma.user.update({
      where: { id: userId },
      data: { lastPasswordChange: new Date() },
    }).catch((err) => {
      logger.warn("Failed to update user lastPasswordChange during session revocation", { userId, error: err });
    });
  } catch (dbErr) {
    logger.error("Failed to revoke refresh tokens in database for user", dbErr, { userId });
  }

  // 2. Redis fast-path revocation (non-fatal if Redis is disconnected)
  try {
    const jtiSetKey = `user:jtis:${userId}`;
    const jtis = await redis.smembers(jtiSetKey).catch((err) => {
      logger.warn("Redis smembers failed for user JTIs during session revocation", { userId, error: err });
      return [] as string[];
    });

    if (jtis && jtis.length > 0) {
      await Promise.allSettled(jtis.map((jti) => revokeToken(jti)));
    }

    await Promise.allSettled([
      redis.del(jtiSetKey),
      redis.del(`active_session:${userId}`),
      redis.del(`admin_verified:${userId}`),
      redis.del(`admin_auth_cache:${userId}`),
    ]);

    logger.info(`[SECURITY] Revoked all sessions for user: ${userId}`, {
      revokedJtiCount: jtis?.length || 0,
    });
  } catch (error) {
    logger.warn("Redis session revocation failed (handled via DB fallback)", { userId, error });
  }
}
