import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import redis from "@/lib/redis";
import { rateLimit } from "@/lib/rate-limit";
import { cache } from "@/lib/cache";
import { isFeatureEnabled, FEATURE_FLAGS } from "@/lib/feature-flags";
import { acquireDistributedLock } from "@/lib/lock";
import { TelemetryService } from "@/services/telemetry.service";
import { telemetryEventsDroppedTotal } from "@/lib/metrics";
import { logger } from "@/lib/logger";
import prisma from "@/lib/db";

describe("Part 2 Resilience: Redis Outage / Downtime Behaviors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Rate Limiter: fails closed for security-critical endpoints when Redis is down", async () => {
    vi.spyOn(redis, "eval").mockRejectedValue(new Error("Redis connection refused"));
    const errorSpy = vi.spyOn(logger, "error");

    // Security-critical must fail closed (throws AppError.serviceUnavailable)
    await expect(
      rateLimit({
        uniqueToken: "sec_critical_login_token",
        limit: 5,
        window: 60,
        securityCritical: true,
      })
    ).rejects.toThrow("Security verification service temporarily unavailable");

    // Observability: Logged without PII (no password, token value, or user credentials)
    const logs = errorSpy.mock.calls.map(c => JSON.stringify(c)).join(" ");
    expect(logs).toContain("failing closed");
    expect(logs).not.toContain("password");
    expect(logs).not.toContain("secret");
  });

  it("Rate Limiter: fails open for non-critical traffic during Redis outage", async () => {
    vi.spyOn(redis, "eval").mockRejectedValue(new Error("Redis cluster failover"));
    const warnSpy = vi.spyOn(logger, "warn");

    const result = await rateLimit({
      uniqueToken: "browse_page_user_anon",
      limit: 60,
      window: 60,
      securityCritical: false,
    });

    // Non-critical browsing fails open so legitimate users are not blocked
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(1);

    // Observability: Warn logged without PII
    expect(warnSpy).toHaveBeenCalled();
  });

  it("Admin Cache: fails open directly to PostgreSQL when Redis get fails", async () => {
    vi.spyOn(redis, "get").mockRejectedValue(new Error("Redis read timeout ETIMEDOUT"));
    const warnSpy = vi.spyOn(logger, "warn");

    let dbQueryExecuted = false;
    const data = await cache("admin:platform:summary", async () => {
      dbQueryExecuted = true;
      return { totalEscrowPaise: 5000000, activeCampaigns: 12 };
    });

    expect(dbQueryExecuted).toBe(true);
    expect(data.totalEscrowPaise).toBe(5000000);
    expect(warnSpy).toHaveBeenCalled();

    // Verify no PII logged
    const loggedCalls = warnSpy.mock.calls.map(c => JSON.stringify(c)).join(" ");
    expect(loggedCalls).not.toContain("Bearer");
  });

  it("Feature Flags: fails closed (feature is OFF) when Redis and DB error", async () => {
    vi.spyOn(redis, "get").mockRejectedValue(new Error("Redis connection dropped"));
    vi.spyOn(prisma.featureFlag, "findUnique").mockRejectedValue(new Error("DB query timeout"));
    const errorSpy = vi.spyOn(logger, "error");

    const isEnabled = await isFeatureEnabled(FEATURE_FLAGS.FAIR_PRICE);

    // Must fail closed (false)
    expect(isEnabled).toBe(false);

    // Observability: Error logged without PII
    expect(errorSpy).toHaveBeenCalled();
    const errorLog = errorSpy.mock.calls.map(c => JSON.stringify(c)).join(" ");
    expect(errorLog).toContain("Failing closed");
    expect(errorLog).not.toContain("token");
  });

  it("Distributed Locks: fails closed (returns null) preventing concurrent money race conditions", async () => {
    vi.spyOn(redis, "set").mockRejectedValue(new Error("Redis socket error"));
    const errorSpy = vi.spyOn(logger, "error");

    const lockToken = await acquireDistributedLock("wallet:disburse:lock:usr_123", 60);

    // Must fail closed (null) so concurrent financial mutations cannot execute without lock
    expect(lockToken).toBeNull();

    // Observability: Error logged with sanitized key, no PII
    expect(errorSpy).toHaveBeenCalled();
    const logged = errorSpy.mock.calls.map(c => JSON.stringify(c)).join(" ");
    expect(logged).toContain("wallet:disburse:lock");
    expect(logged).not.toContain("accountNumber");
  });

  it("Telemetry Buffer: drops events gracefully with counter increment when Redis is down", async () => {
    vi.spyOn(prisma.featureFlag, "findUnique").mockResolvedValue({
      key: FEATURE_FLAGS.TELEMETRY_ANONYMOUS,
      enabled: true,
      rolloutPercent: 100,
      allowRoles: [],
      description: "Anonymous telemetry",
      updatedById: null,
      updatedAt: new Date(),
    } as never);
    vi.spyOn(redis, "rpush").mockRejectedValue(new Error("Redis OOM or unreachable"));
    const metricSpy = vi.spyOn(telemetryEventsDroppedTotal, "inc");
    const warnSpy = vi.spyOn(logger, "warn");

    const result = await TelemetryService.enqueueTrackEvent({
      tabId: "anon_tab_12345678",
      pathname: "/pricing",
      routeKey: "/pricing",
      deviceType: "desktop",
      activeMs: 120,
      maxScrollPct: 45,
    });

    // Event is dropped gracefully without throwing or crashing
    expect(result.enqueued).toBe(false);
    expect(result.droppedReason).toBe("REDIS_DOWN");

    // Metric incremented for dropped telemetry
    expect(metricSpy).toHaveBeenCalledWith({ reason: "REDIS_DOWN" });

    // Observability: Warn logged without PII
    expect(warnSpy).toHaveBeenCalled();
  });
});
