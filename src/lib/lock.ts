import { redis } from "./redis";
import { logger } from "./logger";
import { randomUUID } from "node:crypto";

const RELEASE_LOCK_LUA = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
else
  return 0
end
`;

const EXTEND_LOCK_LUA = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('expire', KEYS[1], ARGV[2])
else
  return 0
end
`;

/**
 * Acquires a distributed lock using a unique token and CAS semantics.
 * Returns the lock token string if acquired, or null if lock is already held.
 */
export async function acquireDistributedLock(
  key: string,
  ttlSeconds: number = 300,
): Promise<string | null> {
  const token = randomUUID();
  try {
    const acquired = await redis.set(key, token, "EX", ttlSeconds, "NX");
    return acquired ? token : null;
  } catch (error) {
    logger.error("Failed to acquire distributed lock", error, { key });
    return null;
  }
}

/**
 * Releases a distributed lock using CAS Lua script.
 * Only deletes the key if the value still matches the caller's token.
 */
export async function releaseDistributedLock(
  key: string,
  token: string,
): Promise<boolean> {
  if (!token) return false;
  try {
    const result = await redis.eval(RELEASE_LOCK_LUA, 1, key, token);
    return result === 1;
  } catch (error) {
    logger.error("Failed to release distributed lock", error, { key });
    return false;
  }
}

/**
 * Extends a distributed lock TTL only if held by the caller's token.
 */
export async function extendDistributedLock(
  key: string,
  token: string,
  ttlSeconds: number = 300,
): Promise<boolean> {
  if (!token) return false;
  try {
    const result = await redis.eval(EXTEND_LOCK_LUA, 1, key, token, ttlSeconds);
    return result === 1;
  } catch (error) {
    logger.error("Failed to extend distributed lock", error, { key });
    return false;
  }
}
