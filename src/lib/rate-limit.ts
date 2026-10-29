import { redis } from "./redis";
import { logger } from "./logger";
import { AppError } from "./errors";

export interface RateLimitConfig {
  uniqueToken: string;
  limit: number;
  window: number; // in seconds
  securityCritical?: boolean | undefined;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

export type TrustTier = "LOW" | "STANDARD" | "HIGH";

export interface TieredRateLimitParams {
  userId?: string | null | undefined;
  ip?: string | null | undefined;
  action: keyof typeof TIERED_LIMIT_CONFIGS;
  trustScore?: number | null | undefined;
  isKycVerified?: boolean | null | undefined;
}

export interface TieredRateLimitResult {
  success: boolean;
  userLimit: number;
  userRemaining: number;
  ipLimit: number;
  ipRemaining: number;
  reset: number;
  tier: TrustTier;
  blockedBy?: "USER" | "IP" | undefined;
}

/**
 * Trust Tier Calculator:
 * - LOW: Trust score < 300 or unverified/new account -> Tightest limits
 * - STANDARD: Trust score 300 - 699 -> Normal limits
 * - HIGH: Trust score >= 700 and KYC verified -> Relaxed limits
 */
export function getTrustTier(
  trustScore?: number | null,
  isKycVerified?: boolean | null,
): TrustTier {
  if (isKycVerified && (trustScore ?? 0) >= 700) {
    return "HIGH";
  }
  if ((trustScore ?? 0) >= 300) {
    return "STANDARD";
  }
  return "LOW";
}

/**
 * Trust-Tier Rate Limit Configurations
 */
export const TIERED_LIMIT_CONFIGS = {
  WITHDRAWAL: {
    window: 86400, // 24 hours
    securityCritical: true,
    userTiers: {
      LOW: 1, // 1 withdrawal/day for unverified / low trust
      STANDARD: 3, // 3 withdrawals/day
      HIGH: 10, // 10 withdrawals/day for high-trust verified
    },
    ipLimit: 10, // Max 10 withdrawals/day per IP (anti-sybil/money laundering)
  },
  MESSAGES: {
    window: 3600, // 1 hour
    securityCritical: false,
    userTiers: {
      LOW: 20, // 20 messages/hour
      STANDARD: 100, // 100 messages/hour
      HIGH: 300, // 300 messages/hour
    },
    ipLimit: 200, // Max 200 messages/hour per IP
  },
  AUTH_LOGIN: {
    window: 900, // 15 minutes
    securityCritical: true,
    userTiers: {
      LOW: 5,
      STANDARD: 5,
      HIGH: 5,
    },
    ipLimit: 10,
  },
  AUTH_OTP: {
    window: 900, // 15 minutes
    securityCritical: true,
    userTiers: {
      LOW: 5,
      STANDARD: 5,
      HIGH: 5,
    },
    ipLimit: 10,
  },
  API_DEFAULT: {
    window: 60, // 1 minute
    securityCritical: false,
    userTiers: {
      LOW: 60, // 60 req/min
      STANDARD: 120, // 120 req/min
      HIGH: 240, // 240 req/min
    },
    ipLimit: 300, // Max 300 req/min per IP
  },
} as const;

/**
 * Single-Key Atomic Sliding-Window Rate Limiting using Redis Sorted Set Lua script.
 * Guarantees zero race conditions even under 200+ concurrent requests.
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
  -- Allowed: Add a unique request member so same-millisecond bursts are counted accurately.
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
      logger.error(
        "Rate limit Redis error failing closed on security critical limit",
        error,
      );
      throw AppError.serviceUnavailable(
        "Security verification service temporarily unavailable. Please try again shortly.",
      );
    }

    logger.error("Rate limit Redis error failing open", error);
    return {
      success: true,
      limit,
      remaining: 1,
      reset: Math.floor((now + window * 1000) / 1000),
    };
  }
}

/**
 * Dual-Key Atomic Sliding-Window Rate Limiting using Redis Lua script.
 * Evaluates both User window AND IP window simultaneously.
 * Neither bucket is incremented if either limit has been reached, preventing race conditions.
 */
export async function atomicDualRateLimit(params: {
  userKey: string;
  ipKey: string;
  userLimit: number;
  ipLimit: number;
  windowSeconds: number;
  securityCritical?: boolean;
}): Promise<{
  success: boolean;
  userCount: number;
  ipCount: number;
  blockedBy?: "USER" | "IP" | undefined;
}> {
  const { userKey, ipKey, userLimit, ipLimit, windowSeconds, securityCritical } = params;
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;
  const member = `${now}:${crypto.randomUUID()}`;

  const dualScript = `
local userKey = KEYS[1]
local ipKey = KEYS[2]
local windowStart = tonumber(ARGV[1])
local now = tonumber(ARGV[2])
local userLimit = tonumber(ARGV[3])
local ipLimit = tonumber(ARGV[4])
local windowSeconds = tonumber(ARGV[5])
local member = ARGV[6]

-- Check user bucket if provided
local userCount = 0
if userKey ~= "" and userLimit > 0 then
    redis.call('ZREMRANGEBYSCORE', userKey, '-inf', windowStart)
    userCount = redis.call('ZCARD', userKey)
    if userCount >= userLimit then
        redis.call('EXPIRE', userKey, windowSeconds)
        return {0, userCount, 0, "USER_LIMIT_EXCEEDED"}
    end
end

-- Check IP bucket if provided
local ipCount = 0
if ipKey ~= "" and ipLimit > 0 then
    redis.call('ZREMRANGEBYSCORE', ipKey, '-inf', windowStart)
    ipCount = redis.call('ZCARD', ipKey)
    if ipCount >= ipLimit then
        redis.call('EXPIRE', ipKey, windowSeconds)
        return {0, userCount, ipCount, "IP_LIMIT_EXCEEDED"}
    end
end

-- Both checks passed! Add member to both keys atomically
if userKey ~= "" and userLimit > 0 then
    redis.call('ZADD', userKey, now, member)
    redis.call('EXPIRE', userKey, windowSeconds)
    userCount = userCount + 1
end

if ipKey ~= "" and ipLimit > 0 then
    redis.call('ZADD', ipKey, now, member)
    redis.call('EXPIRE', ipKey, windowSeconds)
    ipCount = ipCount + 1
end

return {1, userCount, ipCount, "OK"}
`;

  try {
    const result = (await redis.eval(
      dualScript,
      2,
      userKey || "",
      ipKey || "",
      windowStart,
      now,
      userLimit,
      ipLimit,
      windowSeconds,
      member,
    )) as [number, number, number, string];

    const [allowed, userCount, ipCount, reason] = result;
    const success = allowed === 1;

    let blockedBy: "USER" | "IP" | undefined;
    if (reason === "USER_LIMIT_EXCEEDED") blockedBy = "USER";
    if (reason === "IP_LIMIT_EXCEEDED") blockedBy = "IP";

    return {
      success,
      userCount,
      ipCount,
      blockedBy,
    };
  } catch (error) {
    const isLocalDev =
      process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
    if (securityCritical && !isLocalDev) {
      logger.error("Dual rate limit Redis error failing closed", error);
      throw AppError.serviceUnavailable(
        "Security verification service temporarily unavailable. Please try again shortly.",
      );
    }

    logger.error("Dual rate limit Redis error failing open", error);
    return {
      success: true,
      userCount: 0,
      ipCount: 0,
    };
  }
}

/**
 * Trust-Score-Based Tiered Rate Limiting with Dual Tracking (User + IP).
 * - Tracks per-user limits tailored by account trust tier.
 * - Simultaneously tracks per-IP limits to prevent automated sybil floods.
 */
export async function checkTieredRateLimit(
  params: TieredRateLimitParams,
): Promise<TieredRateLimitResult> {
  const { userId, ip, action, trustScore, isKycVerified } = params;
  const config = TIERED_LIMIT_CONFIGS[action];
  const tier = getTrustTier(trustScore, isKycVerified);
  const userLimit = config.userTiers[tier];
  const ipLimit = config.ipLimit;
  const windowSeconds = config.window;
  const now = Date.now();
  const reset = Math.floor((now + windowSeconds * 1000) / 1000);

  const userKey = userId ? `ratelimit:user:${action}:${userId}` : "";
  const ipKey = ip && ip !== "unknown" ? `ratelimit:ip:${action}:${ip}` : "";

  const result = await atomicDualRateLimit({
    userKey,
    ipKey,
    userLimit: userKey ? userLimit : 0,
    ipLimit: ipKey ? ipLimit : 0,
    windowSeconds,
    securityCritical: config.securityCritical,
  });

  return {
    success: result.success,
    userLimit,
    userRemaining: Math.max(0, userLimit - result.userCount),
    ipLimit,
    ipRemaining: Math.max(0, ipLimit - result.ipCount),
    reset,
    tier,
    blockedBy: result.blockedBy,
  };
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
  DISPUTES: { limit: 5, window: 3600, securityCritical: true }, // 5 dispute submissions per hour
  PROFILE_UPDATE: { limit: 10, window: 3600, securityCritical: true }, // 10 profile updates per hour
  BANK_ACCOUNT: { limit: 10, window: 3600, securityCritical: true }, // 10 bank account updates per hour
  PASSWORD_RESET: { limit: 3, window: 3600, securityCritical: true }, // 3 requests per hour
  REPORTS: { limit: 10, window: 60 }, // 10 report downloads per minute (prevent heavy DB query abuse)
  USER_REPORTS: { limit: 5, window: 3600 }, // 5 user report submissions per hour
};

export async function checkRateLimit(
  key: string,
  type: keyof typeof RATE_LIMIT_CONFIGS,
): Promise<RateLimitResult> {
  const config = RATE_LIMIT_CONFIGS[type];
  return rateLimit({
    uniqueToken: `${type}:${key}`,
    limit: config.limit,
    window: config.window,
    securityCritical: (config as { securityCritical?: boolean }).securityCritical,
  });
}
