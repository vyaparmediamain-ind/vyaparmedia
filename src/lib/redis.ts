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
  keepAlive: 10000, // Sends TCP keep-alive packets every 10s to prevent Upstash TLS idle timeouts
  autoResubscribe: true,
  autoResendUnfulfilledCommands: true,
  enableReadyCheck: !shouldDisableReadyCheck,
  retryStrategy(times: number) {
    if (isBuildTime) return null;

    // Never return null during server runtime to prevent ioredis from entering terminal "end" state.
    // Exponential backoff capped at 3000ms ensures graceful reconnects when network recovers or idle timeouts occur.
    return Math.min(times * 150, 3000);
  },
};

function getOrCreateRedisClient(): Redis {
  if (globalForRedis.redis && globalForRedis.redis.status !== "end") {
    return globalForRedis.redis;
  }

  if (globalForRedis.redis && globalForRedis.redis.status === "end") {
    logger.warn("Reviving existing Redis client from terminal 'end' status...");
    globalForRedis.redis.connect().catch((err: unknown) => {
      logger.error("Failed to revive Redis client:", toError(err));
    });
    return globalForRedis.redis;
  }

  const client = new Redis(redisUrl, redisOptions);

  if (!isBuildTime) {
    client.on("error", (err: unknown) => {
      logger.error("Redis Connection Error:", toError(err));
    });

    client.on("ready", () => {
      logger.info("Enterprise Redis connected successfully");
    });

    client.on("end", () => {
      logger.warn("Enterprise Redis connection ended. Scheduling reconnection...");
      setTimeout(() => {
        if (client.status === "end") {
          client.connect().catch((err: unknown) => {
            logger.error("Redis auto-reconnect error:", toError(err));
          });
        }
      }, 1000);
    });
  }

  globalForRedis.redis = client;
  return client;
}

export const redis: Redis = getOrCreateRedisClient();

export default redis;
