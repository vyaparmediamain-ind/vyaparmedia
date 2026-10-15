import { redis } from "../redis";
import { logger } from "../logger";
import { revalidatePath } from "next/cache";

/**
 * Invalidate all relevant caches when a user's KYC or verification status changes.
 * Immediately purges trust badge, verification level, profile, and platform fee caches.
 */
export async function invalidateUserKYCCache(userId: string): Promise<void> {
  if (!userId) return;

  const cacheKeys = [
    `trust_badge:${userId}`,
    `user:trust:${userId}`,
    `user:profile:${userId}`,
    `user:verification:${userId}`,
    `platform_fee:effective:${userId}`,
    `auth:user:${userId}`,
  ];

  try {
    // Pipeline Redis key deletions
    const pipeline = redis.pipeline();
    for (const key of cacheKeys) {
      pipeline.del(key);
    }
    await pipeline.exec();

    logger.info("KYC cache invalidated successfully", { userId, keysCount: cacheKeys.length });
  } catch (err) {
    logger.warn("Failed to invalidate KYC Redis cache - non-fatal", { userId, error: err });
  }

  // Revalidate Next.js server component paths if in request context
  try {
    revalidatePath("/admin/verifications");
    revalidatePath(`/admin/verifications/${userId}`);
    revalidatePath("/dashboard/settings");
    revalidatePath(`/dashboard/influencers/${userId}`);
  } catch {
    // Can safely ignore outside Next.js request context (e.g. background crons or standalone tests)
  }
}

export const SUREPASS_DAILY_SPEND_CAP_RUPEES = 5000;

/**
 * Retrieve cached successful KYC verification result from Redis to save vendor API costs.
 */
export async function getCachedKYCResult<T>(type: string, docHash: string): Promise<T | null> {
  if (!docHash) return null;
  const key = `kyc:cache:${type.toLowerCase()}:${docHash}`;
  try {
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (err) {
    logger.warn("Failed to get cached KYC result from Redis - fail-open", { type, error: err });
    return null;
  }
}

/**
 * Cache successful KYC verification result in Redis with a TTL (default 30 days).
 */
export async function setCachedKYCResult(
  type: string,
  docHash: string,
  data: unknown,
  ttlSeconds = 2592000, // 30 days
): Promise<void> {
  if (!docHash || !data) return;
  const key = `kyc:cache:${type.toLowerCase()}:${docHash}`;
  try {
    await redis.set(key, JSON.stringify(data), "EX", ttlSeconds);
  } catch (err) {
    logger.warn("Failed to cache KYC result in Redis - non-fatal", { type, error: err });
  }
}

/**
 * Enforce maximum 3 Aadhaar OTP generations per user in a 24-hour window to protect from billing abuse.
 */
export async function checkAadhaarOtpRateLimit(userId: string): Promise<{ allowed: boolean; remaining: number }> {
  if (!userId) return { allowed: true, remaining: 3 };
  const key = `kyc:ratelimit:aadhaar_gen:${userId}`;
  const maxAttempts = 3;
  const windowSeconds = 86400; // 24 hours

  try {
    const attempts = await redis.incr(key);
    if (attempts === 1) {
      await redis.expire(key, windowSeconds);
    }
    const remaining = Math.max(0, maxAttempts - attempts);
    return {
      allowed: attempts <= maxAttempts,
      remaining,
    };
  } catch (err) {
    logger.warn("Failed to check Aadhaar OTP rate limit - fail-open", { userId, error: err });
    return { allowed: true, remaining: 1 };
  }
}

/**
 * Enforce maximum 3 OTP submit attempts per clientId to prevent brute force.
 */
export async function checkAadhaarOtpVerifyLimit(clientId: string): Promise<{ allowed: boolean; remaining: number }> {
  if (!clientId) return { allowed: true, remaining: 3 };
  const key = `kyc:ratelimit:aadhaar_verify:${clientId}`;
  const maxAttempts = 3;
  const windowSeconds = 3600; // 1 hour per client_id

  try {
    const attempts = await redis.incr(key);
    if (attempts === 1) {
      await redis.expire(key, windowSeconds);
    }
    const remaining = Math.max(0, maxAttempts - attempts);
    return {
      allowed: attempts <= maxAttempts,
      remaining,
    };
  } catch (err) {
    logger.warn("Failed to check Aadhaar OTP verify limit - fail-open", { clientId, error: err });
    return { allowed: true, remaining: 1 };
  }
}

/**
 * Enforce maximum 5 KYC verification requests per user per 24 hours.
 */
export async function checkUserKYCRateLimit(userId: string): Promise<{ allowed: boolean; remaining: number }> {
  if (!userId) return { allowed: true, remaining: 5 };
  const key = `kyc:ratelimit:user:${userId}`;
  const maxAttempts = 5;
  const windowSeconds = 86400; // 24 hours

  try {
    const attempts = await redis.incr(key);
    if (attempts === 1) {
      await redis.expire(key, windowSeconds);
    }
    const remaining = Math.max(0, maxAttempts - attempts);
    return {
      allowed: attempts <= maxAttempts,
      remaining,
    };
  } catch (err) {
    logger.warn("Failed to check user KYC rate limit - fail-open", { userId, error: err });
    return { allowed: true, remaining: 1 };
  }
}

/**
 * Track cumulative Surepass API spend for the day and trigger alert if cap exceeded.
 */
export async function trackSurepassDailySpend(costRupees: number): Promise<{ dailySpend: number; capExceeded: boolean }> {
  const dateKey = new Date().toISOString().slice(0, 10);
  const key = `kyc:surepass:daily_spend:${dateKey}`;
  const windowSeconds = 172800; // 48 hours

  try {
    const currentSpendStr = await redis.get(key);
    const prevSpend = currentSpendStr ? parseFloat(currentSpendStr) : 0;
    const newSpend = prevSpend + costRupees;
    await redis.set(key, newSpend.toString(), "EX", windowSeconds);

    const capExceeded = newSpend >= SUREPASS_DAILY_SPEND_CAP_RUPEES;
    if (capExceeded) {
      logger.error("[COST ALERT] Surepass daily spend cap of ₹5,000 exceeded!", {
        dailySpendRupees: newSpend,
        capRupees: SUREPASS_DAILY_SPEND_CAP_RUPEES,
        date: dateKey,
      });
    }

    return { dailySpend: newSpend, capExceeded };
  } catch (err) {
    logger.warn("Failed to track Surepass daily spend - non-fatal", { error: err });
    return { dailySpend: 0, capExceeded: false };
  }
}
