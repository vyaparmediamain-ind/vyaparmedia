import { redis } from "./redis";
import { logger } from "./logger";

/**
* Generic Cache Wrapper
* @param key Redis key
* @param fetcher Function to fetch data if cache miss
* @param ttl Time to live in seconds (default 300 = 5 mins)
*/
export async function cache<T>(
key: string,
fetcher: () => Promise<T>,
ttl: number = 300,
): Promise<T> {
try {
// 1. Check Cache
const cached = await redis.get(key);
if (cached) {
// logger.debug(`[CACHE] HIT ${key}`); // Verbose
return JSON.parse(cached) as T;
}

// 2. Fetch Data
// logger.debug(`[CACHE] MISS ${key}`);
const data = await fetcher();

// 3. Set Cache (non-blocking)
if (data) {
redis.setex(key, ttl, JSON.stringify(data)).catch((err) => {
logger.error(`[CACHE] Set Error ${key}`, err);
});
}

return data;
} catch (error) {
logger.error(`[CACHE] Error ${key}`, error);
// Fail safe: fetch data directly if cache fails
return await fetcher();
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

const ALLOWED_NAMESPACES = ["deal", "platform_fee"];
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
