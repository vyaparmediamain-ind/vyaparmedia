import { AppError } from "@/lib/errors";
import Redis, { type RedisOptions } from "ioredis";
import { logger } from "./logger";

const isBuildTime =
process.env.NEXT_PHASE === "phase-production-build" ||
process.env.npm_lifecycle_event === "build" ||
process.argv.join(" ").includes("next build");

if (!process.env.REDIS_URL && process.env.NODE_ENV === "production" && !isBuildTime) {
logger.error(
"CRITICAL ERROR: REDIS_URL is not defined. Redis is required for enterprise rate limiting, caching, and sessions.",
);
throw AppError.badRequest("REDIS_URL is strictly required for this application.");
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
const isProductionRuntime = process.env.NODE_ENV === "production" && !isBuildTime;

if (!process.env.REDIS_URL) {
logger.warn("REDIS_URL missing. Falling back to local Redis URL.", {
redisUrl,
});
}

const globalForRedis = global as unknown as { redis: Redis };
const redisOptions: RedisOptions = {
lazyConnect: isBuildTime,
connectTimeout: 10000,
enableOfflineQueue: true,
maxRetriesPerRequest: null,
enableReadyCheck: !shouldDisableReadyCheck,
retryStrategy(times) {
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

export const redis =
globalForRedis.redis ||
new Redis(redisUrl, redisOptions);

// Log Redis Connection Issues to prevent silent failure
if (!isBuildTime) {
redis.on("error", (err) => {
logger.error("Redis Connection Error:", err);
});

redis.on("ready", () => {
logger.info("Enterprise Redis connected successfully");
});
}

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

export default redis;
