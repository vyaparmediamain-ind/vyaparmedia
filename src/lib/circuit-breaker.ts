import { AppError } from "@/lib/errors";
import { redis } from "./redis";
import { logger } from "./logger";

interface CircuitBreakerOptions {
  failureThreshold?: number; // Number of failed attempts before opening the circuit
  resetTimeout?: number; // Seconds to keep the circuit OPEN before allowing retry
}

interface GatewayError {
  code?: string;
  statusCode?: number;
}

function shouldTripCircuitBreaker(error: unknown): boolean {
  if (error instanceof AppError && error.statusCode < 500) {
    return false;
  }

  const typedErr = error as GatewayError;
  if (typedErr.statusCode !== undefined && typedErr.statusCode >= 400 && typedErr.statusCode < 500) {
    return false;
  }

  const isNetworkErrorCode =
    typedErr.code === "ETIMEDOUT" ||
    typedErr.code === "ECONNREFUSED" ||
    typedErr.code === "ENOTFOUND";

  const isServerErrorStatus = typedErr.statusCode !== undefined && typedErr.statusCode >= 500;

  const isNetworkErrorMessage =
    error instanceof Error &&
    (error.message.includes("fetch") ||
      error.message.includes("timeout") ||
      error.message.includes("network"));

  const isNetworkOrServerError =
    isNetworkErrorCode || isServerErrorStatus || isNetworkErrorMessage;

  if (!isNetworkOrServerError && error instanceof AppError) {
    return false;
  }

  return true;
}

async function recordCircuitFailure(
  failureKey: string,
  openKey: string,
  actionName: string,
  threshold: number,
  timeoutSeconds: number,
): Promise<void> {
  try {
    const failures = await redis.incr(failureKey);

    if (failures === 1) {
      await redis.expire(failureKey, timeoutSeconds);
    }

    if (failures >= threshold) {
      logger.error(
        `[CircuitBreaker] TRIPPED! Action '${actionName}' crossed failure threshold (${threshold}). Circuit is now OPEN for ${timeoutSeconds}s.`,
      );
      await redis.set(openKey, "OPEN", "EX", timeoutSeconds);
      await redis.del(failureKey);
    }
  } catch (redisError) {
    // If redis fails, fail-open
    logger.error(`[CircuitBreaker] Redis tracking failed: ${redisError}`);
  }
}

/**
 * Enterprise Circuit Breaker Pattern using Redis.
 * Protects downstream services (like Razorpay, AWS, etc) from being overwhelmed during an outage,
 * and maintains the health of this application by failing fast when external services are down.
 */
export async function withCircuitBreaker<T>(
  actionName: string,
  actionFn: () => Promise<T>,
  options?: CircuitBreakerOptions,
): Promise<T> {
  const threshold = options?.failureThreshold || 5;
  const timeoutSeconds = options?.resetTimeout || 60; // Default 1 minute

  const failureKey = `cb:fail:${actionName}`;
  const openKey = `cb:open:${actionName}`;

  // 1. Check if the circuit is OPEN (fail fast)
  const isCircuitOpen = await redis.get(openKey);
  if (isCircuitOpen) {
    logger.warn(`[CircuitBreaker] FAST FAIL: Action '${actionName}' is blocked. Circuit is currently OPEN.`);
    throw AppError.badRequest(`Service unavailable for '${actionName}'. Circuit is OPEN.`);
  }

  try {
    // 2. Execute downstream action
    const result = await actionFn();

    // 3. Clear failure count asynchronously
    redis.del(failureKey).catch((e) =>
      logger.error(`[CircuitBreaker] Failed to delete failure key: ${e.message}`),
    );

    return result;
  } catch (error: unknown) {
    if (shouldTripCircuitBreaker(error)) {
      await recordCircuitFailure(failureKey, openKey, actionName, threshold, timeoutSeconds);
    }
    throw error;
  }
}
