import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { redis } from "@/lib/redis";
import {
  rateLimit,
  checkTieredRateLimit,
  getTrustTier,
  TIERED_LIMIT_CONFIGS,
  RATE_LIMIT_CONFIGS,
} from "@/lib/rate-limit";
import {
  banIp,
  unbanIp,
  isIpBanned,
  getBanDetails,
} from "@/lib/blacklist";
import { NextRequest } from "next/server";
import { validateCsrfProtection } from "@/lib/csrf";
import { checkWafPatterns } from "@/lib/waf";

describe("Rate Limiting & Abuse Prevention Layer Hardening", () => {
  beforeAll(async () => {
    if (redis.status !== "ready") {
      await new Promise<void>((resolve) => {
        redis.once("ready", () => resolve());
      });
    }
  });

  describe("Requirement 1 & DoD: 200 Concurrent Burst Requests (Atomic Lua Sliding-Window)", () => {
    it("should handle 200 simultaneous concurrent burst requests with exact limit and zero off-by-one errors", async () => {
      const burstKey = `vitest-burst-${Date.now()}`;
      const BURST_LIMIT = 50;
      const BURST_WINDOW = 60;
      const TOTAL_REQUESTS = 200;

      await redis.del(`ratelimit:${burstKey}`);

      const promises = Array.from({ length: TOTAL_REQUESTS }, () =>
        rateLimit({
          uniqueToken: burstKey,
          limit: BURST_LIMIT,
          window: BURST_WINDOW,
          securityCritical: true,
        }),
      );

      const results = await Promise.all(promises);
      const allowed = results.filter((r) => r.success).length;
      const blocked = results.filter((r) => !r.success).length;

      expect(allowed).toBe(BURST_LIMIT);
      expect(blocked).toBe(TOTAL_REQUESTS - BURST_LIMIT);
      expect(allowed + blocked).toBe(TOTAL_REQUESTS);

      // Clean up
      await redis.del(`ratelimit:${burstKey}`);
    });
  });

  describe("Requirement 2: Tiered Limits (Trust Score Tiers & Dual User+IP Tracking)", () => {
    it("should accurately calculate trust score tiers", () => {
      expect(getTrustTier(100, false)).toBe("LOW");
      expect(getTrustTier(299, false)).toBe("LOW");
      expect(getTrustTier(300, false)).toBe("STANDARD");
      expect(getTrustTier(699, false)).toBe("STANDARD");
      expect(getTrustTier(750, false)).toBe("STANDARD");
      expect(getTrustTier(750, true)).toBe("HIGH");
    });

    it("should enforce tight limit (1/day) on low-trust unverified withdrawals", async () => {
      const userId = `low-user-${Date.now()}`;
      const ip = `192.0.2.${Math.floor(Math.random() * 200) + 1}`;

      const res1 = await checkTieredRateLimit({
        userId,
        ip,
        action: "WITHDRAWAL",
        trustScore: 120,
        isKycVerified: false,
      });
      expect(res1.success).toBe(true);
      expect(res1.tier).toBe("LOW");
      expect(res1.userLimit).toBe(1);

      const res2 = await checkTieredRateLimit({
        userId,
        ip,
        action: "WITHDRAWAL",
        trustScore: 120,
        isKycVerified: false,
      });
      expect(res2.success).toBe(false);
      expect(res2.blockedBy).toBe("USER");

      await redis.del(`ratelimit:user:WITHDRAWAL:${userId}`);
      await redis.del(`ratelimit:ip:WITHDRAWAL:${ip}`);
    });

    it("should allow relaxed limit (10/day) on high-trust verified withdrawals", async () => {
      const userId = `high-user-${Date.now()}`;
      const ip = `192.0.2.${Math.floor(Math.random() * 200) + 1}`;

      for (let i = 0; i < 10; i++) {
        const res = await checkTieredRateLimit({
          userId,
          ip,
          action: "WITHDRAWAL",
          trustScore: 850,
          isKycVerified: true,
        });
        expect(res.success).toBe(true);
        expect(res.tier).toBe("HIGH");
      }

      const res11 = await checkTieredRateLimit({
        userId,
        ip,
        action: "WITHDRAWAL",
        trustScore: 850,
        isKycVerified: true,
      });
      expect(res11.success).toBe(false);

      await redis.del(`ratelimit:user:WITHDRAWAL:${userId}`);
      await redis.del(`ratelimit:ip:WITHDRAWAL:${ip}`);
    });

    it("should block multi-account sybil attacks from the same IP", async () => {
      const sharedIp = `198.51.100.${Math.floor(Math.random() * 240) + 1}`;
      const ipLimit = TIERED_LIMIT_CONFIGS.WITHDRAWAL.ipLimit; // 10

      for (let i = 0; i < ipLimit; i++) {
        const uniqueUser = `sybil-${i}-${Date.now()}`;
        const res = await checkTieredRateLimit({
          userId: uniqueUser,
          ip: sharedIp,
          action: "WITHDRAWAL",
          trustScore: 850,
          isKycVerified: true,
        });
        expect(res.success).toBe(true);
        await redis.del(`ratelimit:user:WITHDRAWAL:${uniqueUser}`);
      }

      // 11th user with high trust from same IP must be blocked by IP
      const eleventhUser = `sybil-11-${Date.now()}`;
      const blocked = await checkTieredRateLimit({
        userId: eleventhUser,
        ip: sharedIp,
        action: "WITHDRAWAL",
        trustScore: 850,
        isKycVerified: true,
      });
      expect(blocked.success).toBe(false);
      expect(blocked.blockedBy).toBe("IP");

      await redis.del(`ratelimit:ip:WITHDRAWAL:${sharedIp}`);
      await redis.del(`ratelimit:user:WITHDRAWAL:${eleventhUser}`);
    });
  });

  describe("Requirement 3: Edge WAF Pattern Matching", () => {
    it("should detect SQL injection patterns", () => {
      expect(checkWafPatterns("/api/users?id=1 UNION SELECT 1,password FROM users--")).toBe(true);
      expect(checkWafPatterns("/api/users?name=admin' OR 1=1--")).toBe(true);
      expect(checkWafPatterns("/api/search?q=test'; WAITFOR DELAY '0:0:5'--")).toBe(true);
      expect(checkWafPatterns("/api/search?q=1 AND SLEEP(5)")).toBe(true);
      expect(checkWafPatterns("/api/data?table=information_schema.tables")).toBe(true);
    });

    it("should detect Path Traversal & Scanner probes", () => {
      expect(checkWafPatterns("/api/files/../../etc/passwd")).toBe(true);
      expect(checkWafPatterns("/api/download?file=%2e%2e%2fwin.ini")).toBe(true);
      expect(checkWafPatterns("/proc/self/environ")).toBe(true);
      expect(checkWafPatterns("/wp-login.php")).toBe(true);
      expect(checkWafPatterns("/.env")).toBe(true);
      expect(checkWafPatterns("/.git/config")).toBe(true);
    });

    it("should allow clean normal requests", () => {
      expect(checkWafPatterns("/api/creators?niche=technology&page=1&limit=20")).toBe(false);
    });
  });

  describe("Requirement 4: Instant Redis IP Blacklist", () => {
    const testIp = "203.0.113.199";

    afterAll(async () => {
      await unbanIp(testIp);
    });

    it("should instantly ban and unban an IP with zero cache invalidation delay", async () => {
      await unbanIp(testIp);
      expect(await isIpBanned(testIp)).toBe(false);

      await banIp(testIp, "Automated threat test", 3600);
      expect(await isIpBanned(testIp)).toBe(true);

      const details = await getBanDetails(testIp);
      expect(details.isBanned).toBe(true);
      expect(details.reason).toBe("Automated threat test");
      expect((details.ttlSeconds ?? 0)).toBeGreaterThan(3500);

      const unbanned = await unbanIp(testIp);
      expect(unbanned).toBe(true);
      expect(await isIpBanned(testIp)).toBe(false);
    });
  });

  describe("Requirement 5 & DoD: CSRF Defense on State-Changing Routes", () => {
    it("should reject cross-origin POST request with 403 Forbidden", () => {
      const crossOriginReq = new NextRequest("http://localhost:3000/api/deals", {
        method: "POST",
        headers: {
          host: "localhost:3000",
          origin: "https://malicious-cross-origin.com",
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "CANCEL_DEAL" }),
      });

      const check = validateCsrfProtection(crossOriginReq);
      expect(check.valid).toBe(false);
      expect(check.reason).toContain("Invalid origin");
    });

    it("should reject cross-site Sec-Fetch-Site header with 403 Forbidden", () => {
      const crossSiteReq = new NextRequest("http://localhost:3000/api/deals", {
        method: "POST",
        headers: {
          host: "localhost:3000",
          origin: "http://localhost:3000",
          "sec-fetch-site": "cross-site",
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "CANCEL_DEAL" }),
      });

      const check = validateCsrfProtection(crossSiteReq);
      expect(check.valid).toBe(false);
      expect(check.reason).toContain("sec-fetch-site: cross-site");
    });

    it("should reject cross-origin Referer fallback with 403 Forbidden", () => {
      const crossRefererReq = new NextRequest("http://localhost:3000/api/deals", {
        method: "POST",
        headers: {
          host: "localhost:3000",
          referer: "https://attacker-site.com/fake-page",
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "CANCEL_DEAL" }),
      });

      const check = validateCsrfProtection(crossRefererReq);
      expect(check.valid).toBe(false);
      expect(check.reason).toContain("Invalid referer");
    });

    it("should allow legitimate same-origin POST request", () => {
      const legitimateReq = new NextRequest("http://localhost:3000/api/deals", {
        method: "POST",
        headers: {
          host: "localhost:3000",
          origin: "http://localhost:3000",
          "sec-fetch-site": "same-origin",
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "ACCEPT_DEAL" }),
      });

      const check = validateCsrfProtection(legitimateReq);
      expect(check.valid).toBe(true);
    });
  });

  describe("Requirement 6: Sensitive vs General Route Limits", () => {
    it("should configure sensitive routes with tighter limits than general browsing", () => {
      // Sensitive auth & financial limits
      expect(RATE_LIMIT_CONFIGS.AUTH.limit).toBe(5);
      expect(RATE_LIMIT_CONFIGS.AUTH.window).toBe(60);

      expect(RATE_LIMIT_CONFIGS.LOGIN_IP.limit).toBe(5);
      expect(RATE_LIMIT_CONFIGS.LOGIN_IP.window).toBe(900);

      expect(RATE_LIMIT_CONFIGS.WITHDRAWAL.limit).toBe(3);
      expect(RATE_LIMIT_CONFIGS.WITHDRAWAL.window).toBe(86400);

      expect(RATE_LIMIT_CONFIGS.PASSWORD_RESET.limit).toBe(3);
      expect(RATE_LIMIT_CONFIGS.PASSWORD_RESET.window).toBe(3600);

      // General browsing & API routes
      expect(RATE_LIMIT_CONFIGS.API_DEFAULT.limit).toBe(120);
      expect(RATE_LIMIT_CONFIGS.API_DEFAULT.window).toBe(60);

      expect(RATE_LIMIT_CONFIGS.CAMPAIGNS.limit).toBe(10);
      expect(RATE_LIMIT_CONFIGS.CAMPAIGNS.window).toBe(3600);
    });
  });
});
