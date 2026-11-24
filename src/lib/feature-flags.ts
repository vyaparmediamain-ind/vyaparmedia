import { createHash } from "node:crypto";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";
import prisma from "@/lib/db";

/**
 * Standard Feature Flags Definition
 * Strongly typed registry of all platform progressive rollout flags.
 */
export const FEATURE_FLAGS = {
  CREATOR_METRICS: "creator_metrics",
  FAIR_PRICE: "fair_price",
  FAIR_PRICE_PUBLIC_BADGE: "fair_price_public_badge",
  INSTAGRAM_INSIGHTS: "instagram_insights",
  TELEMETRY_ANONYMOUS: "telemetry_anonymous",
  TELEMETRY_IDENTIFIED: "telemetry_identified",
  CAMPAIGN_HUB: "campaign_hub",
  BRANDED_REPORTS: "branded_reports",
  REPORT_VERIFICATION: "report_verification",
} as const;

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

export interface FeatureFlagMetadata {
  title: string;
  simpleDescription: string;
  intendedRoles: Array<"ADMIN" | "BRAND" | "INFLUENCER" | "SCOUT">;
  audienceLabel: string;
  category: "Reports & Valuation" | "Campaigns & Marketplace" | "Integrations & Tracking";
}

/**
 * Human-readable plain-English metadata, intended audience roles, and clear summaries
 * for all canonical platform feature flags.
 */
export const FEATURE_METADATA: Record<FeatureFlagKey, FeatureFlagMetadata> = {
  branded_reports: {
    title: "Executive Branded PDF Reports",
    simpleDescription:
      "Generates official downloadable PDF and CSV valuation & ROI reports with company letterhead, statutory disclaimers, and tax compliance details.",
    intendedRoles: ["ADMIN", "BRAND", "INFLUENCER"],
    audienceLabel: "Admins, Brands & Creators",
    category: "Reports & Valuation",
  },
  campaign_hub: {
    title: "Campaign Operations Hub",
    simpleDescription:
      "Unified workspace where brands manage live campaigns and creators accept deals, upload content drafts, and track deliverable milestones.",
    intendedRoles: ["ADMIN", "BRAND", "INFLUENCER"],
    audienceLabel: "Brands & Creators",
    category: "Campaigns & Marketplace",
  },
  creator_metrics: {
    title: "Creator Audience & Delivery Analytics",
    simpleDescription:
      "Displays in-depth audience demographics, 12-week historical delivery trends, and engagement rate benchmarks on creator profiles.",
    intendedRoles: ["ADMIN", "BRAND", "INFLUENCER"],
    audienceLabel: "Creators & Brands",
    category: "Reports & Valuation",
  },
  fair_price: {
    title: "AI Fair-Price Valuation Engine",
    simpleDescription:
      "Calculates recommended fair compensation ranges (in INR) based on creator followers, past delivery, and category benchmark CPVs.",
    intendedRoles: ["ADMIN", "BRAND", "INFLUENCER"],
    audienceLabel: "All Marketplace Users",
    category: "Reports & Valuation",
  },
  fair_price_public_badge: {
    title: "Public Fair-Pricing Trust Badge",
    simpleDescription:
      "Shows a verified 'Fair Price Assured' badge on creator discovery cards so brands and scouts can identify trusted creators.",
    intendedRoles: ["ADMIN", "BRAND", "INFLUENCER", "SCOUT"],
    audienceLabel: "Public / All Roles",
    category: "Campaigns & Marketplace",
  },
  instagram_insights: {
    title: "Instagram Graph API Insights Sync",
    simpleDescription:
      "Automatically synchronizes live Instagram reel views, story impressions, and post engagement rates via Meta's Graph API.",
    intendedRoles: ["ADMIN", "INFLUENCER"],
    audienceLabel: "Creators & Admins",
    category: "Integrations & Tracking",
  },
  report_verification: {
    title: "Digital Report Authenticity Verification",
    simpleDescription:
      "Enables tamper-proof verification via cryptographic QR codes and public audit links (/verify-report/[id]) to prove report integrity.",
    intendedRoles: ["ADMIN", "BRAND", "INFLUENCER", "SCOUT"],
    audienceLabel: "Public / All Roles",
    category: "Reports & Valuation",
  },
  telemetry_anonymous: {
    title: "Public Deal View Telemetry",
    simpleDescription:
      "Measures anonymous deal and page impression traffic across the platform without cookies or capturing personal identifiable data.",
    intendedRoles: ["ADMIN", "BRAND", "INFLUENCER", "SCOUT"],
    audienceLabel: "System / Anonymous",
    category: "Integrations & Tracking",
  },
  telemetry_identified: {
    title: "Creator Deliverable & Milestone Tracking",
    simpleDescription:
      "Records verified creator interactions when they submit deliverables, receive brand approvals, and complete contract milestones.",
    intendedRoles: ["ADMIN", "BRAND", "INFLUENCER"],
    audienceLabel: "Creators & Brands",
    category: "Integrations & Tracking",
  },
};

export interface FeatureFlagRecord {
  key: string;
  enabled: boolean;
  rolloutPercent: number;
  allowRoles: string[];
  description: string;
  updatedById?: string | null;
  updatedAt?: Date | string;
}

export interface FeatureFlagContext {
  userId?: string | null | undefined;
  role?: string | null | undefined;
}

export const FEATURE_FLAG_CACHE_TTL_SECONDS = 30;

// In-process memory fallback cache (30s TTL)
interface CacheEntry {
  flag: FeatureFlagRecord | null;
  expiresAt: number;
}
const memoryFlagCache = new Map<string, CacheEntry>();

/**
 * Deterministically computes an integer bucket (0 to 99) for a given userId and feature key.
 * Pure function: deterministic across invocations, machines, and processes.
 */
export function computeRolloutBucket(userId: string, key: string): number {
  if (!userId || typeof userId !== "string") return 100;
  const hash = createHash("sha256").update(`${userId}:${key}`).digest();
  return hash.readUInt32BE(0) % 100;
}

/**
 * Verifies if a user's role is permitted by the flag's role allow-list.
 * If allowRoles is empty or contains wildcard "*", all roles are allowed.
 * Comparison is case-insensitive.
 */
export function isRoleAllowed(
  role?: string | null | undefined,
  allowRoles?: string[] | null | undefined,
): boolean {
  if (!allowRoles || allowRoles.length === 0) return true;
  if (allowRoles.includes("*")) return true;
  if (!role || typeof role !== "string") return false;

  const normalizedUserRole = role.trim().toUpperCase();
  return allowRoles.some((r) => r.trim().toUpperCase() === normalizedUserRole);
}

/**
 * Pure evaluation function for a feature flag given a context.
 * Invariant: Fail-closed.
 * 1. If flag is not enabled -> false.
 * 2. If allowRoles is specified and user role does not match -> false.
 * 3. If rolloutPercent <= 0 -> false.
 * 4. If rolloutPercent >= 100 -> true.
 * 5. If fractional rollout (0 < rolloutPercent < 100):
 *    - If no userId in context -> false (fail-closed for anonymous/unidentified requests during gradual rollouts).
 *    - Returns true if computeRolloutBucket(userId, key) < rolloutPercent.
 */
export function evaluateFeatureFlag(
  flag: FeatureFlagRecord | null | undefined,
  ctx?: FeatureFlagContext,
): boolean {
  if (!flag || !flag.enabled) {
    return false;
  }

  // Check role restriction
  if (flag.allowRoles && flag.allowRoles.length > 0) {
    if (!isRoleAllowed(ctx?.role, flag.allowRoles)) {
      return false;
    }
  }

  // Check percentage rollout
  const percent = flag.rolloutPercent;
  if (percent <= 0) return false;
  if (percent >= 100) return true;

  // Fractional percentage rollout requires identifiable userId
  if (!ctx?.userId) {
    return false;
  }

  const bucket = computeRolloutBucket(ctx.userId, flag.key);
  return bucket < percent;
}

/**
 * Retrieves a feature flag record using a two-tier cache (in-process memory -> Redis -> DB).
 * Returns null if flag is not found or if database query fails (fail-closed).
 */
export async function getFeatureFlagRecord(
  key: string,
  clockNow: number = Date.now(),
): Promise<FeatureFlagRecord | null> {
  const cacheKey = `feature_flag:${key}`;

  // 1. In-process memory cache check
  const memCached = memoryFlagCache.get(key);
  if (memCached && memCached.expiresAt > clockNow) {
    return memCached.flag;
  }

  // 2. Redis cache check
  try {
    const redisVal = await redis.get(cacheKey);
    if (redisVal) {
      const parsed = JSON.parse(redisVal) as FeatureFlagRecord;
      memoryFlagCache.set(key, {
        flag: parsed,
        expiresAt: clockNow + FEATURE_FLAG_CACHE_TTL_SECONDS * 1000,
      });
      return parsed;
    }
  } catch (redisErr) {
    logger.debug("[FeatureFlags] Redis cache read failed, falling back to DB", {
      key,
      error: redisErr instanceof Error ? redisErr.message : String(redisErr),
    });
  }

  // 3. Database query
  try {
    const dbRecord = await prisma.featureFlag.findUnique({
      where: { key },
    });

    if (!dbRecord) {
      // Negative cache for 10 seconds to protect against non-existent flag DOS
      memoryFlagCache.set(key, { flag: null, expiresAt: clockNow + 10 * 1000 });
      return null;
    }

    const flagRecord: FeatureFlagRecord = {
      key: dbRecord.key,
      enabled: dbRecord.enabled,
      rolloutPercent: dbRecord.rolloutPercent,
      allowRoles: dbRecord.allowRoles,
      description: dbRecord.description,
      updatedById: dbRecord.updatedById,
      updatedAt: dbRecord.updatedAt,
    };

    // Populate both caches
    memoryFlagCache.set(key, {
      flag: flagRecord,
      expiresAt: clockNow + FEATURE_FLAG_CACHE_TTL_SECONDS * 1000,
    });

    try {
      await redis.setex(
        cacheKey,
        FEATURE_FLAG_CACHE_TTL_SECONDS,
        JSON.stringify(flagRecord),
      );
    } catch (_err: unknown) {
    // Handled fallback: Redis populate failure non-critical
    void _err;
  }

    return flagRecord;
  } catch (dbErr) {
    logger.error("[FeatureFlags] Failed to query feature flag from database. Failing closed.", {
      key,
      error: dbErr instanceof Error ? dbErr.message : String(dbErr),
    });
    return null;
  }
}

/**
 * Checks whether a feature is enabled for a given caller context.
 * Fails closed (returns false) on any exception or missing configuration.
 */
export async function isFeatureEnabled(
  key: FeatureFlagKey,
  ctx?: FeatureFlagContext,
): Promise<boolean> {
  try {
    const flag = await getFeatureFlagRecord(key);
    return evaluateFeatureFlag(flag, ctx);
  } catch (err) {
    logger.error("[FeatureFlags] Unexpected error in isFeatureEnabled. Failing closed.", {
      key,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/**
 * Asserts that a feature flag is enabled.
 * Throws AppError.forbidden (403) with user-friendly message if disabled.
 */
export async function assertFeatureEnabled(
  key: FeatureFlagKey,
  ctx?: FeatureFlagContext,
  customMessage?: string,
): Promise<void> {
  const enabled = await isFeatureEnabled(key, ctx);
  if (!enabled) {
    const msg = customMessage || `This feature is currently not available for your account.`;
    throw AppError.forbidden(msg);
  }
}

/**
 * Invalidates both Redis and in-memory caches for a feature flag.
 * If key is omitted, all cached flags are invalidated.
 */
export async function invalidateFeatureFlagCache(key?: FeatureFlagKey | string): Promise<void> {
  if (key) {
    memoryFlagCache.delete(key);
    try {
      await redis.del(`feature_flag:${key}`);
    } catch (err) {
      logger.warn("[FeatureFlags] Failed to delete Redis key during cache invalidation", { key, error: err });
    }
  } else {
    memoryFlagCache.clear();
    try {
      const keys = await redis.keys("feature_flag:*");
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (err) {
      logger.warn("[FeatureFlags] Failed to flush Redis feature_flag keys", { error: err });
    }
  }
}

/**
 * Resets local in-memory cache. Used exclusively by unit tests.
 */
export function _resetMemoryCache(): void {
  memoryFlagCache.clear();
}
