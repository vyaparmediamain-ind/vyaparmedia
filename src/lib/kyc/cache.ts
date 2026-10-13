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
