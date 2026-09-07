import { redis } from "./redis";
import { logger } from "./logger";

interface RateLimitConfig {
uniqueToken: string;
limit: number;
window: number; // in seconds
securityCritical?: boolean | undefined;
}

interface RateLimitResult {
success: boolean;
limit: number;
remaining: number;
reset: number;
}

/**
* Enterprise-grade rate limiting using Redis sliding window.
* This implementation uses Lua script for atomic execution, ensuring accuracy in high-concurrency environments.
*/

export async function rateLimit(
config: RateLimitConfig,
): Promise<RateLimitResult> {
const { uniqueToken, limit, window } = config;
const key = `ratelimit:${uniqueToken}`;
const now = Date.now();
const windowStart = now - window * 1000;
const windowSeconds = window;
const requestMember = `${now}:${crypto.randomUUID()}`;

// Lua script to efficiently manage sliding window
// Clean up old entries outside the window
// Count entries inside the window
// Add new entry if allowed
const script = `
local key = KEYS[1]
local windowStart = tonumber(ARGV[1])
local now = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local windowSeconds = tonumber(ARGV[4])
local member = ARGV[5]

-- Cleanup: Remove timestamps older than the window
redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)

-- Count: Get number of requests in current window
local count = redis.call('ZCARD', key)

if count < limit then
-- Allowed: Add a unique request member so same-millisecond bursts are counted.
redis.call('ZADD', key, now, member)
redis.call('EXPIRE', key, windowSeconds)
return {1, count + 1}
else
-- Blocked: Return current count
redis.call('EXPIRE', key, windowSeconds)
return {0, count}
end
`;

try {
const result = (await redis.eval(
script,
1,
key,
windowStart,
now,
limit,
windowSeconds,
requestMember,
)) as [number, number];

const [allowed, currentCount] = result;
const success = allowed === 1;

return {
success,
limit,
remaining: Math.max(0, limit - currentCount),
reset: Math.floor((now + window * 1000) / 1000),
};
} catch (error) {
const isLocalDev =
process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
if (config.securityCritical && !isLocalDev) {
logger.error("Rate limit Redis error failing closed on security critical limit", error);
return {
success: false,
limit,
remaining: 0,
reset: Math.floor((now + window * 1000) / 1000),
};
}

logger.error("Rate limit Redis error failing open", error);
// Fail open strategy: If Redis fails, allow the request to proceed to avoid downtime.
return {
success: true,
limit,
remaining: 1,
reset: Math.floor((now + window * 1000) / 1000),
};
}
}

export const RATE_LIMIT_CONFIGS = {
CAMPAIGNS: { limit: 10, window: 3600 },
APPLICATIONS: { limit: 20, window: 3600 },
AUTH: { limit: 5, window: 60, securityCritical: true },
LOGIN_IP: { limit: 5, window: 900, securityCritical: true }, // 5 attempts per 15 minutes per IP
LOGIN_EMAIL: { limit: 5, window: 900, securityCritical: true }, // 5 attempts per 15 minutes per email
REGISTER: { limit: 3, window: 3600, securityCritical: true }, // 3 registrations per hour per IP
MESSAGES: { limit: 100, window: 3600 },
MESSAGES_MIN: { limit: 20, window: 60 },
MESSAGES_DAY: { limit: 500, window: 86400 },
DEAL_UPDATES: { limit: 50, window: 3600, securityCritical: true },
PAYMENTS: { limit: 15, window: 3600, securityCritical: true },
API_DEFAULT: { limit: 120, window: 60 }, // 120 req/min per user
REVIEWS: { limit: 10, window: 3600 },
WITHDRAWAL: { limit: 3, window: 86400, securityCritical: true }, // 3 withdrawals per day (anti-fraud)
UPLOAD: { limit: 10, window: 3600, securityCritical: true }, // 10 uploads per hour
DISPUTES: { limit: 5, window: 3600 }, // 5 dispute submissions per hour
PROFILE_UPDATE: { limit: 10, window: 3600 }, // 10 profile updates per hour
BANK_ACCOUNT: { limit: 10, window: 3600 }, // 10 bank account updates per hour
PASSWORD_RESET: { limit: 3, window: 3600, securityCritical: true }, // 3 requests per hour
REPORTS: { limit: 10, window: 60 }, // 10 report downloads per minute (prevent heavy DB query abuse)
USER_REPORTS: { limit: 5, window: 3600 }, // 5 user report submissions per hour
};




export async function checkRateLimit(
key: string,
type: keyof typeof RATE_LIMIT_CONFIGS,
): Promise<RateLimitResult> {
// Allow local dev/test traffic to bypass strict limits never in production or staging.
const isLocalDev =
process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
if (
isLocalDev &&
(key === "127.0.0.1" ||
key === "::1" ||
key === "0.0.0.0")
) {
return { success: true, limit: 9999, remaining: 9999, reset: 0 };
}

// Note: Rate limiting is always enforced, even in test environments.
// Tests that need to bypass rate limits should use dedicated test infrastructure
// or configure a test-specific Redis instance with higher limits.
// A global bypass env var would be a security backdoor if accidentally left enabled.
const config = RATE_LIMIT_CONFIGS[type];
return rateLimit({
uniqueToken: `${type}:${key}`,
limit: config.limit,
window: config.window,
securityCritical: (config as { securityCritical?: boolean }).securityCritical,
});
}
