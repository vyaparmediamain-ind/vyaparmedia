import prisma from "@/lib/db";
import redis from "@/lib/redis";
import { calculateLevel, getPlatformFeePercentage } from "@/lib/drs-score";
import { getEffectivePlatformFee } from "@/lib/referral-engine";
import { logger } from "@/lib/logger";

export const ABSOLUTE_MIN_PLATFORM_FEE = 7;
const FEE_SNAPSHOT_CACHE_TTL_SECONDS = 300; // 5 minutes

export interface PlatformFeeSnapshot {
  userLevel: number;
  levelBasedFee: number;
  referralTier: string;
  referralFee: number;
  effectivePlatformFee: number;
  customPlatformFee?: number | null;
  isCustomFeeOverride: boolean;
}

export async function resolveBrandPlatformFee(
  brandUserId: string,
): Promise<PlatformFeeSnapshot> {
  const cacheKey = `platform_fee:brand_snapshot:${brandUserId}`;

  // 1. Fast Redis cache lookup
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as PlatformFeeSnapshot;
    }
  } catch (cacheErr) {
    logger.warn("Redis read failed for resolveBrandPlatformFee", {
      userId: brandUserId,
      error: cacheErr instanceof Error ? cacheErr.message : String(cacheErr),
    });
  }

  // 2. Parallel fetch: User profile (projection-only) + Referral Tier
  const [brandUser, referralFeeInfo] = await Promise.all([
    prisma.user.findUnique({
      where: { id: brandUserId },
      select: {
        xp: true,
        brandProfile: {
          select: {
            customPlatformFee: true,
          },
        },
      },
    }),
    getEffectivePlatformFee(brandUserId),
  ]);

  const customFee = brandUser?.brandProfile?.customPlatformFee;
  const userLevel = brandUser ? calculateLevel(brandUser.xp).level : 1;
  const levelBasedFee = getPlatformFeePercentage(userLevel);

  let result: PlatformFeeSnapshot;

  // If brand has an admin-configured custom fee override (e.g. Agency Plan 7.5%)
  if (typeof customFee === "number" && !isNaN(customFee) && customFee > 0) {
    // Platform fee can NEVER go below the absolute floor of 7%
    const effectivePlatformFee = Math.max(ABSOLUTE_MIN_PLATFORM_FEE, customFee);
    result = {
      userLevel,
      levelBasedFee: customFee,
      referralTier: referralFeeInfo.tier,
      referralFee: referralFeeInfo.effectiveFee,
      effectivePlatformFee,
      customPlatformFee: effectivePlatformFee,
      isCustomFeeOverride: true,
    };
  } else {
    // Standard calculation: minimum between XP tier level and referral discount, bounded by absolute 7% floor
    const effectivePlatformFee = Math.max(
      ABSOLUTE_MIN_PLATFORM_FEE,
      Math.min(levelBasedFee, referralFeeInfo.effectiveFee),
    );

    result = {
      userLevel,
      levelBasedFee,
      referralTier: referralFeeInfo.tier,
      referralFee: referralFeeInfo.effectiveFee,
      effectivePlatformFee,
      customPlatformFee: null,
      isCustomFeeOverride: false,
    };
  }

  // 3. Cache the resolved fee snapshot
  try {
    await redis.setex(cacheKey, FEE_SNAPSHOT_CACHE_TTL_SECONDS, JSON.stringify(result));
  } catch (setErr) {
    logger.warn("Redis write failed for resolveBrandPlatformFee", {
      userId: brandUserId,
      error: setErr instanceof Error ? setErr.message : String(setErr),
    });
  }

  return result;
}

export async function invalidateBrandPlatformFeeCache(brandUserId: string): Promise<void> {
  try {
    await Promise.all([
      redis.del(`platform_fee:effective:${brandUserId}`),
      redis.del(`platform_fee:brand_snapshot:${brandUserId}`),
    ]);
  } catch (err) {
    logger.warn(`Failed to clear platform fee cache for ${brandUserId}`, {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

