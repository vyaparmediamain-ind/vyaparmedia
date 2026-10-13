import { redis } from "../redis";
import { logger } from "../logger";
import crypto from "node:crypto";

/**
 * High-Performance Search Cache Layer with Atomic Version Invalidation
 * 
 * Instead of costly KEYS pattern scans across Redis, we store a global version integer.
 * Invalidation increments the version in O(1) time, rendering all older cache keys
 * instantly obsolete and automatically purged by Redis TTL expiration.
 */

const DEFAULT_SEARCH_TTL_SECONDS = 45;

function hashSearchParams(params: unknown): string {
  const json = JSON.stringify(params || {});
  return crypto.createHash("sha256").update(json).digest("hex").slice(0, 16);
}

export async function getCreatorSearchVersion(): Promise<number> {
  if (!redis) return 1;
  try {
    const version = await redis.get("search:creators:version");
    return version ? Number(version) : 1;
  } catch {
    return 1;
  }
}

export async function getCampaignSearchVersion(): Promise<number> {
  if (!redis) return 1;
  try {
    const version = await redis.get("search:campaigns:version");
    return version ? Number(version) : 1;
  } catch {
    return 1;
  }
}

export async function getCachedSearchResults<T>(
  domain: "creators" | "campaigns",
  params: unknown,
): Promise<T | null> {
  if (!redis) return null;

  try {
    const version = domain === "creators" ? await getCreatorSearchVersion() : await getCampaignSearchVersion();
    const hash = hashSearchParams(params);
    const key = `search:${domain}:v${version}:${hash}`;

    const cached = await redis.get(key);
    if (!cached) return null;

    return JSON.parse(cached) as T;
  } catch (err) {
    logger.debug("Redis search cache lookup failed", { error: err, domain });
    return null;
  }
}

export async function setCachedSearchResults<T>(
  domain: "creators" | "campaigns",
  params: unknown,
  data: T,
  ttlSeconds: number = DEFAULT_SEARCH_TTL_SECONDS,
): Promise<void> {
  if (!redis) return;

  try {
    const version = domain === "creators" ? await getCreatorSearchVersion() : await getCampaignSearchVersion();
    const hash = hashSearchParams(params);
    const key = `search:${domain}:v${version}:${hash}`;

    await redis.set(key, JSON.stringify(data), "EX", ttlSeconds);
  } catch (err) {
    logger.debug("Redis search cache set failed", { error: err, domain });
  }
}

export async function invalidateCreatorSearchCache(): Promise<void> {
  if (!redis) return;

  try {
    await redis.incr("search:creators:version");
    logger.info("Creator search cache version incremented (invalidated)");
  } catch (err) {
    logger.warn("Failed to invalidate creator search cache", { error: err });
  }
}

export async function invalidateCampaignSearchCache(): Promise<void> {
  if (!redis) return;

  try {
    await redis.incr("search:campaigns:version");
    logger.info("Campaign search cache version incremented (invalidated)");
  } catch (err) {
    logger.warn("Failed to invalidate campaign search cache", { error: err });
  }
}
