import Redis, { type RedisOptions } from "ioredis";
import { logger } from "./logger";
import { toError } from "./errors";

/**
 * ARCHITECTURE NOTE: Dual Redis Clients in VyaparMedia
 *
 * 1. ioredis (TCP over REDIS_URL):
 *    - Used in Node.js serverless API routes, background workers, and services.
 *    - Essential for atomic multi-key Lua scripts (sliding-window rate limiting, CAS distributed locks).
 *    - Serverless TCP Connection Warning (⚠️): Upstash free/pay-as-you-go tiers cap concurrent TCP connections.
 *      To prevent connection starvation across Vercel Lambdas, the client is cached on `globalThis.redis` across invocations
 *      with strict connection and command timeouts (connect: 10s, command: 5s, maxRetries: 3).
 *
 * 2. @upstash/redis REST (HTTP over UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN):
 *    - Used in Next.js Edge Middleware (e.g. `src/lib/blacklist-edge.ts`).
 *    - Edge runtime does not permit persistent TCP sockets; stateless HTTP REST requests are required.
 */

const isBuildTime =
  process.env.NEXT_PHASE === "phase-production-build" ||
  process.env.npm_lifecycle_event === "build" ||
  process.argv.join(" ").includes("next build");

const isProductionRuntime = process.env.NODE_ENV === "production" && !isBuildTime;

// TP-05: Prohibit silent fallback to 127.0.0.1 in production runtime to prevent serverless hang/timeouts
if (!process.env.REDIS_URL && isProductionRuntime) {
  throw new Error(
    "CRITICAL: REDIS_URL environment variable is required in production runtime. Falling back to localhost is prohibited (TP-05)."
  );
}

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const isTlsRedisUrl = redisUrl.startsWith("rediss://");
const isUpstashRedisUrl = (() => {
  try {
    return new URL(redisUrl).hostname.endsWith(".upstash.io");
  } catch {
    return false;
  }
})();
const shouldDisableReadyCheck = isTlsRedisUrl || isUpstashRedisUrl;

if (!process.env.REDIS_URL) {
  logger.warn("REDIS_URL missing. Falling back to local Redis URL.", {
    redisUrl,
  });
}

const globalForRedis = globalThis as unknown as { redis?: Redis };
const redisOptions: RedisOptions = {
  lazyConnect: isBuildTime,
  connectTimeout: 10000,
  enableOfflineQueue: true,
  maxRetriesPerRequest: 3,
  commandTimeout: 5000,
  enableReadyCheck: !shouldDisableReadyCheck,
  retryStrategy(times: number) {
if (isBuildTime) return null;

// In local development, stop retrying after 20 attempts (~60s) to prevent spamming logs
if (!isProductionRuntime && times > 20) {
logger.warn("Redis reconnection attempts exceeded limit. Stopping retries.");
return null;
}

const delay = Math.min(times * 100, 3000);
return delay;
},
};

export const redis: Redis =
  globalForRedis.redis ??
  new Redis(redisUrl, redisOptions);

// Log Redis Connection Issues to prevent silent failure
if (!isBuildTime) {
  redis.on("error", (err: unknown) => {
    logger.error("Redis Connection Error:", toError(err));
  });

redis.on("ready", () => {
logger.info("Enterprise Redis connected successfully");
});
}

globalForRedis.redis = redis;

export default redis;
