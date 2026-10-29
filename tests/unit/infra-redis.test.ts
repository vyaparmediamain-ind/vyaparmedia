import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isIpBannedEdge } from "@/lib/blacklist-edge";
import { cache } from "@/lib/cache";
import { rateLimit } from "@/lib/rate-limit";
import { acquireDistributedLock } from "@/lib/lock";
import { setKillSwitch } from "@/lib/kill-switch";
import redis from "@/lib/redis";

describe("INFRA-REDIS-01: Redis Resilience, Fail-Open vs Fail-Closed & TTL Hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Blacklist Edge (Fail-Open for Normal Users on Upstash Outage)", () => {
    it("fails open and allows legitimate user traffic when Upstash REST returns 500 error", async () => {
      const origUrl = process.env.UPSTASH_REDIS_REST_URL;
      const origToken = process.env.UPSTASH_REDIS_REST_TOKEN;
      const origEnv = process.env.NODE_ENV;

      try {
        process.env.UPSTASH_REDIS_REST_URL = "https://mock-upstash.upstash.io";
        process.env.UPSTASH_REDIS_REST_TOKEN = "mock_token";
        (process.env as Record<string, string | undefined>)["NODE_ENV"] = "production";

        // Upstash REST returns 500 Server Error
        vi.spyOn(global, "fetch").mockResolvedValue(
          new Response("Internal Server Error", { status: 500 }),
        );

        const isBanned = await isIpBannedEdge("203.0.113.195");
        // Must FAIL OPEN (return false) so legitimate users are not locked out during Upstash incident
        expect(isBanned).toBe(false);
      } finally {
        process.env.UPSTASH_REDIS_REST_URL = origUrl;
        process.env.UPSTASH_REDIS_REST_TOKEN = origToken;
        (process.env as Record<string, string | undefined>)["NODE_ENV"] = origEnv;
      }
    });

    it("fails open when Upstash REST times out or network drops", async () => {
      const origUrl = process.env.UPSTASH_REDIS_REST_URL;
      const origToken = process.env.UPSTASH_REDIS_REST_TOKEN;
      const origEnv = process.env.NODE_ENV;

      try {
        process.env.UPSTASH_REDIS_REST_URL = "https://mock-upstash.upstash.io";
        process.env.UPSTASH_REDIS_REST_TOKEN = "mock_token";
        (process.env as Record<string, string | undefined>)["NODE_ENV"] = "production";

        vi.spyOn(global, "fetch").mockRejectedValue(new Error("ETIMEDOUT: Connection timed out"));

        const isBanned = await isIpBannedEdge("198.51.100.44");
        expect(isBanned).toBe(false);
      } finally {
        process.env.UPSTASH_REDIS_REST_URL = origUrl;
        process.env.UPSTASH_REDIS_REST_TOKEN = origToken;
        (process.env as Record<string, string | undefined>)["NODE_ENV"] = origEnv;
      }
    });
  });

  describe("Cache Fail-Open Behavior", () => {
    it("fails open and executes fetcher directly when Redis get fails", async () => {
      vi.spyOn(redis, "get").mockRejectedValue(new Error("Redis connection refused"));

      let fetcherExecuted = false;
      const result = await cache("test:data:key", async () => {
        fetcherExecuted = true;
        return { value: "fresh_db_data" };
      });

      expect(fetcherExecuted).toBe(true);
      expect(result).toEqual({ value: "fresh_db_data" });
    });
  });

  describe("Rate-Limit Fail-Open for Standard Traffic (MSG-08 Stop 429 on Outage)", () => {
    it("fails open and returns success for non-security critical limits during Redis outage", async () => {
      vi.spyOn(redis, "eval").mockRejectedValue(new Error("Redis cluster failover"));

      const res = await rateLimit({
        uniqueToken: "test_normal_user",
        limit: 60,
        window: 60,
        securityCritical: false,
      });

      expect(res.success).toBe(true);
      expect(res.remaining).toBe(1);
    });
  });

  describe("Lock Fail-Closed Behavior (Financial & Mutual Exclusion Safety)", () => {
    it("returns null (fail-closed) when Redis lock acquisition fails", async () => {
      vi.spyOn(redis, "set").mockRejectedValue(new Error("Redis connection dropped"));

      const lockToken = await acquireDistributedLock("cron:reconcile:lock", 60);
      expect(lockToken).toBeNull();
    });
  });

  describe("Kill Switch TTL Safety (No Indefinite State Retention)", () => {
    it("sets a safe TTL when activating an operational kill switch", async () => {
      const redisSetSpy = vi.spyOn(redis, "set").mockResolvedValue("OK" as never);

      await setKillSwitch("killswitch:withdrawals", true);

      expect(redisSetSpy).toHaveBeenCalledWith("killswitch:withdrawals", "true", "EX", 86400 * 7);
    });
  });

  describe("TP-05: Prohibit Localhost Redis Fallback in Production Runtime", () => {
    it("validates that production runtime throws if REDIS_URL is missing", async () => {
      const origEnv = process.env.NODE_ENV;
      const origUrl = process.env.REDIS_URL;
      const origPhase = process.env.NEXT_PHASE;

      try {
        (process.env as Record<string, string | undefined>)["NODE_ENV"] = "production";
        delete process.env.REDIS_URL;
        delete process.env.NEXT_PHASE;

        // Reset modules so redis.ts evaluates top-level check
        await expect(async () => {
          vi.resetModules();
          await import("@/lib/redis");
        }).rejects.toThrow("CRITICAL: REDIS_URL environment variable is required in production runtime");
      } finally {
        (process.env as Record<string, string | undefined>)["NODE_ENV"] = origEnv;
        if (origUrl) process.env.REDIS_URL = origUrl;
        if (origPhase) process.env.NEXT_PHASE = origPhase;
        vi.resetModules();
      }
    });
  });
});
