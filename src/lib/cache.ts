import { redis } from "./redis";
import { logger } from "./logger";

interface MemoryCacheEntry {
  value: unknown;
  expiresAt: number;
}

const memoryCache = new Map<string, MemoryCacheEntry>();
const MAX_MEMORY_CACHE_ITEMS = 2000;

function cleanupMemoryCacheIfNeeded() {
  if (memoryCache.size <= MAX_MEMORY_CACHE_ITEMS) return;
  const now = Date.now();
  for (const [k, v] of memoryCache.entries()) {
    if (v.expiresAt <= now) {
      memoryCache.delete(k);
    }
  }
  if (memoryCache.size > MAX_MEMORY_CACHE_ITEMS) {
    const keysToDelete = Array.from(memoryCache.keys()).slice(0, Math.floor(MAX_MEMORY_CACHE_ITEMS * 0.2));
    for (const k of keysToDelete) {
      memoryCache.delete(k);
    }
  }
}

/**
* Generic Two-Tier Cache Wrapper (L1 In-Memory + L2 Redis)
* @param key Redis/Memory key
* @param fetcher Function to fetch data if cache miss
* @param ttl Time to live in seconds (default 300 = 5 mins)
*/
export async function cache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 300,
): Promise<T> {
  const now = Date.now();

  // Tier 1: Check In-Memory L1 Cache (0ms latency, zero network)
  const memItem = memoryCache.get(key);
  if (memItem && memItem.expiresAt > now) {
    return memItem.value as T;
  }

  try {
    // Tier 2: Check L2 Redis Cache
    const cached = await redis.get(key);
    if (cached) {
      const val = JSON.parse(cached) as T;
      memoryCache.set(key, { value: val, expiresAt: now + Math.min(ttl, 60) * 1000 });
      return val;
    }

    // Cache Miss: Fetch Data
    const data = await fetcher();

    // Populate L1 & L2 Cache
    if (data !== undefined && data !== null) {
      memoryCache.set(key, { value: data, expiresAt: now + ttl * 1000 });
      cleanupMemoryCacheIfNeeded();
      redis.setex(key, ttl, JSON.stringify(data)).catch((err) => {
        logger.debug(`[CACHE] Set Error ${key}`, err);
      });
    }

    return data;
  } catch (error) {
    logger.debug(`[CACHE] Redis Error ${key}, falling back to fetcher`, { error: String(error) });
    // Fail safe: fetch data directly if Redis fails, but still protect with L1 memory cache
    const data = await fetcher();
    if (data !== undefined && data !== null) {
      memoryCache.set(key, { value: data, expiresAt: now + Math.min(ttl, 60) * 1000 });
      cleanupMemoryCacheIfNeeded();
    }
    return data;
  }
}

/**
* Invalidate cache key pattern using non-blocking SCAN instead of KEYS.
* KEYS is O(N) and blocks the Redis event loop dangerous in production.
* SCAN iterates incrementally using a cursor, which is safe at any scale.
*
* @param pattern e.g. "user:*"
*/
export async function invalidate(pattern: string): Promise<void> {
try {
const normalizedPattern = pattern.trim();
const namespace = normalizedPattern.split(":")[0] || "";

const ALLOWED_NAMESPACES = ["deal", "platform_fee", "admin", "campaign", "user", "wallet"];
if (!ALLOWED_NAMESPACES.includes(namespace)) {
logger.warn(`[CACHE] Refused invalidation for forbidden namespace: ${namespace}`);
return;
}

const isSingleKey = !normalizedPattern.includes("*");
const isScopedWildcard =
normalizedPattern.endsWith("*") &&
normalizedPattern.includes(":") &&
namespace.length >= 3 &&
normalizedPattern.indexOf("*") === normalizedPattern.length - 1;

if (!isSingleKey && !isScopedWildcard) {
logger.warn(`[CACHE] Refused broad invalidation pattern ${pattern}`);
return;
}

// Invalidate L1 memory cache immediately
if (isSingleKey) {
  memoryCache.delete(normalizedPattern);
} else {
  const prefix = normalizedPattern.slice(0, -1);
  for (const k of memoryCache.keys()) {
    if (k.startsWith(prefix)) {
      memoryCache.delete(k);
    }
  }
}

let cursor = "0";
let totalDeleted = 0;

// Iteratively scan through keyspace without blocking
do {
const [nextCursor, keys] = await redis.scan(
cursor,
"MATCH",
normalizedPattern,
"COUNT",
100, // Scan 100 keys per iteration tunable
);

cursor = nextCursor;

if (keys.length > 0) {
await redis.del(...keys);
totalDeleted += keys.length;
}
} while (cursor !== "0");

if (totalDeleted > 0) {
logger.info(
`[CACHE] Invalidated ${totalDeleted} keys for pattern ${pattern}`,
);
}
} catch (error) {
logger.error(`[CACHE] Invalidation Error ${pattern}`, error);
}
}

const userTypeMemoryCache = new Map<string, { userType: string; expiresAt: number }>();

export async function getCachedUserType(userId: string): Promise<string | null> {
  const now = Date.now();
  const cached = userTypeMemoryCache.get(userId);
  if (cached && cached.expiresAt > now) {
    return cached.userType;
  }
  const { default: prisma } = await import("./db");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { userType: true },
  });
  if (user?.userType) {
    userTypeMemoryCache.set(userId, { userType: user.userType, expiresAt: now + 60_000 });
    return user.userType;
  }
  return null;
}

export function invalidateCachedUserType(userId: string): void {
  userTypeMemoryCache.delete(userId);
}

