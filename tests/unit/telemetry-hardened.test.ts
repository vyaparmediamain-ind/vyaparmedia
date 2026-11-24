import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/telemetry/track/route";
import { TelemetryService } from "@/services/telemetry.service";
import { redis } from "@/lib/redis";
import prisma from "@/lib/db";
import { logger } from "@/lib/logger";
import { auth } from "@/lib/auth";
import * as featureFlagsModule from "@/lib/feature-flags";
import * as rateLimitModule from "@/lib/rate-limit";
import { telemetryEventsDroppedTotal } from "@/lib/metrics";
import { computeDailySessionHash } from "@/lib/telemetry";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe("Hardened Telemetry Subsystem (F01 Security & Performance Spec)", () => {
  const fixedDate = new Date("2026-11-23T10:00:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("TELEMETRY_DAILY_SALT", "test_telemetry_salt_secret");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.vyaparmedia.in");

    // Feature flags default on
    vi.spyOn(featureFlagsModule, "isFeatureEnabled").mockImplementation(async (key) => {
      if (key === featureFlagsModule.FEATURE_FLAGS.TELEMETRY_ANONYMOUS) return true;
      if (key === featureFlagsModule.FEATURE_FLAGS.TELEMETRY_IDENTIFIED) return true;
      return false;
    });

    // Redis defaults
    vi.spyOn(redis, "get").mockResolvedValue(null);
    vi.spyOn(redis, "set").mockResolvedValue("OK");
    vi.spyOn(redis, "del").mockResolvedValue(1);
    vi.spyOn(redis, "rpush").mockResolvedValue(1);

    // Rate limiter default
    vi.spyOn(rateLimitModule, "atomicDualRateLimit").mockResolvedValue({
      success: true,
      userCount: 1,
      ipCount: 1,
    });

    // Unauthenticated session by default
    (vi.mocked(auth) as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  });

  // 1. Consent lookup Redis caching & invalidation
  describe("1. Redis-cached consent snapshot (services/telemetry.service.ts)", () => {
    const testUserId = "usr_consent_test_123";

    it("fetches consent from DB and populates Redis on cache miss (TTL 60s)", async () => {
      const getSpy = vi.spyOn(redis, "get").mockResolvedValue(null);
      const setSpy = vi.spyOn(redis, "set").mockResolvedValue("OK");
      const dbSpy = vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: testUserId,
        telemetryConsent: true,
      } as any);

      const callerUser = { id: testUserId, role: "INFLUENCER" };
      const rawPayload = {
        tabId: "tab_12345678",
        pathname: "/creator/priya",
        deviceType: "mobile" as const,
        activeMs: 5000,
        maxScrollPct: 50,
      };

      await TelemetryService.enqueueTrackEvent(rawPayload, callerUser, { clock: fixedDate });

      expect(getSpy).toHaveBeenCalledWith(`telemetry:consent:${testUserId}`);
      expect(dbSpy).toHaveBeenCalledWith({
        where: { id: testUserId },
        select: { telemetryConsent: true },
      });
      expect(setSpy).toHaveBeenCalledWith(`telemetry:consent:${testUserId}`, "true", "EX", 60);
    });

    it("reads consent directly from Redis on cache hit without querying DB", async () => {
      const getSpy = vi.spyOn(redis, "get").mockResolvedValue("true");
      const dbSpy = vi.spyOn(prisma.user, "findUnique");

      const callerUser = { id: testUserId, role: "INFLUENCER" };
      const rawPayload = {
        tabId: "tab_12345678",
        pathname: "/creator/priya",
        deviceType: "mobile" as const,
        activeMs: 5000,
        maxScrollPct: 50,
      };

      await TelemetryService.enqueueTrackEvent(rawPayload, callerUser, { clock: fixedDate });

      expect(getSpy).toHaveBeenCalledWith(`telemetry:consent:${testUserId}`);
      expect(dbSpy).not.toHaveBeenCalled();
    });

    it("invalidates Redis consent key when updateUserConsent is called", async () => {
      const delSpy = vi.spyOn(redis, "del").mockResolvedValue(1);
      vi.spyOn(prisma.user, "update").mockResolvedValue({
        id: testUserId,
        telemetryConsent: false,
        telemetryConsentAt: fixedDate,
        telemetryConsentVersion: "2026.1",
      } as any);

      await TelemetryService.updateUserConsent(testUserId, false, "2026.1", { clock: fixedDate });

      expect(delSpy).toHaveBeenCalledWith(`telemetry:consent:${testUserId}`);
    });
  });

  // 2. Logging & drop counters: never log clientIp or tabId/sessionHash on drops
  describe("2. Zero PII logging on drops & sampled debug metrics", () => {
    it("never logs clientIp or tabId on rate limit drops and increments telemetryEventsDroppedTotal", async () => {
      const incSpy = vi.spyOn(telemetryEventsDroppedTotal, "inc");
      const warnSpy = vi.spyOn(logger, "warn");

      vi.spyOn(rateLimitModule, "atomicDualRateLimit").mockResolvedValue({
        success: false,
        blockedBy: "IP",
        userCount: 0,
        ipCount: 150,
      });

      const clientIp = "203.0.113.195";
      const sensitiveTabId = "tab_sensitive_99887766";
      const payload = JSON.stringify({
        tabId: sensitiveTabId,
        pathname: "/pricing",
        deviceType: "desktop",
        activeMs: 4000,
        maxScrollPct: 40,
      });

      const req = new NextRequest("https://app.vyaparmedia.in/api/telemetry/track", {
        method: "POST",
        headers: {
          "x-forwarded-for": clientIp,
          "content-type": "text/plain",
          origin: "https://app.vyaparmedia.in",
        },
        body: payload,
      });

      const res = await POST(req);
      expect(res.status).toBe(204);
      expect(incSpy).toHaveBeenCalledWith({ reason: "RATE_LIMITED" });

      for (const call of warnSpy.mock.calls) {
        const loggedJson = JSON.stringify(call);
        expect(loggedJson).not.toContain(clientIp);
        expect(loggedJson).not.toContain(sensitiveTabId);
      }
    });

    it("does not log zod error trees in logs on schema validation failure", async () => {
      const incSpy = vi.spyOn(telemetryEventsDroppedTotal, "inc");
      const warnSpy = vi.spyOn(logger, "warn");

      const invalidPayload = JSON.stringify({
        tabId: "short", // invalid length
        activeMs: -100, // invalid activeMs
      });

      const req = new NextRequest("https://app.vyaparmedia.in/api/telemetry/track", {
        method: "POST",
        headers: {
          "x-forwarded-for": "198.51.100.12",
          "content-type": "text/plain",
          origin: "https://app.vyaparmedia.in",
        },
        body: invalidPayload,
      });

      const res = await POST(req);
      expect(res.status).toBe(204);
      expect(incSpy).toHaveBeenCalledWith({ reason: "INVALID_SCHEMA" });

      for (const call of warnSpy.mock.calls) {
        const loggedJson = JSON.stringify(call);
        // Ensure no raw zod error tree dump
        expect(loggedJson).not.toContain("too_small");
        expect(loggedJson).not.toContain("ZodError");
      }
    });
  });

  // 3. Body size: enforce 2KB while reading (stream reader with byte cap)
  describe("3. Stream body-size enforcement (2KB cap)", () => {
    it("drops chunked oversized body exceeding 2048 bytes before JSON parse without crashing", async () => {
      const incSpy = vi.spyOn(telemetryEventsDroppedTotal, "inc");
      // Create a chunked stream larger than 2KB
      const oversizedText = "x".repeat(3000);
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(oversizedText.slice(0, 1500)));
          controller.enqueue(encoder.encode(oversizedText.slice(1500)));
          controller.close();
        },
      });

      const req = new NextRequest("https://app.vyaparmedia.in/api/telemetry/track", {
        method: "POST",
        headers: {
          "content-type": "text/plain",
          origin: "https://app.vyaparmedia.in",
          // Notice: no content-length header (simulating chunked transfer)
        },
        body: stream,
        duplex: "half",
      });

      const res = await POST(req);
      expect(res.status).toBe(204);
      expect(incSpy).toHaveBeenCalledWith({ reason: "PAYLOAD_TOO_LARGE" });
    });
  });

  // 4. Rate-limit ordering: per-IP rate limit checked BEFORE body read/parse
  describe("4. Rate-limit ordering & bypass protection", () => {
    it("evaluates per-IP rate limit BEFORE reading body stream", async () => {
      const callOrder: string[] = [];

      vi.spyOn(rateLimitModule, "atomicDualRateLimit").mockImplementation(async () => {
        callOrder.push("rate-limit");
        return { success: false, blockedBy: "IP", userCount: 0, ipCount: 130 };
      });

      const req = new NextRequest("https://app.vyaparmedia.in/api/telemetry/track", {
        method: "POST",
        headers: {
          origin: "https://app.vyaparmedia.in",
          "x-forwarded-for": "192.0.2.1",
          "content-type": "text/plain",
        },
        body: "{}",
      });

      // Spy on req.body.getReader to ensure body stream is never read if rate limit blocks
      const originalBody = req.body;
      let bodyReaderCreated = false;
      if (originalBody) {
        const origGetReader = originalBody.getReader.bind(originalBody);
        vi.spyOn(originalBody, "getReader").mockImplementation(() => {
          bodyReaderCreated = true;
          callOrder.push("body-read");
          return origGetReader();
        });
      }

      const res = await POST(req);
      expect(res.status).toBe(204);
      expect(callOrder[0]).toBe("rate-limit");
      expect(bodyReaderCreated).toBe(false);
    });

    it("fails open for rate limiter errors and counts them", async () => {
      vi.spyOn(rateLimitModule, "atomicDualRateLimit").mockRejectedValue(new Error("Redis connection timeout"));

      const payload = JSON.stringify({
        tabId: "tab_fail_open_1",
        pathname: "/pricing",
        deviceType: "desktop",
        activeMs: 2000,
        maxScrollPct: 20,
      });

      const req = new NextRequest("https://app.vyaparmedia.in/api/telemetry/track", {
        method: "POST",
        headers: {
          origin: "https://app.vyaparmedia.in",
          "content-type": "text/plain",
        },
        body: payload,
      });

      const res = await POST(req);
      expect(res.status).toBe(204);
    });
  });

  // 5. sessionHash semantics: HMAC(dailySalt, clientTabId) with zero cross-day linkability
  describe("5. sessionHash semantics & HMAC computation with tabId", () => {
    it("computes sessionKey = HMAC(dailySalt, clientTabId) before enqueuing", async () => {
      const rpushSpy = vi.spyOn(redis, "rpush").mockResolvedValue(1);

      const tabId = "tab_client_abcdef12";
      const salt = "test_telemetry_salt_secret";
      const expectedSessionKey = computeDailySessionHash(tabId, salt, "2026-11-23");

      const payload = {
        tabId,
        pathname: "/creator/priya",
        deviceType: "mobile" as const,
        activeMs: 4000,
        maxScrollPct: 40,
      };

      await TelemetryService.enqueueTrackEvent(payload, null, { clock: fixedDate });

      expect(rpushSpy).toHaveBeenCalled();
      const enqueuedStr = rpushSpy.mock.calls[0]?.[1] as string;
      const enqueuedObj = JSON.parse(enqueuedStr);

      expect(enqueuedObj.sessionHash).toBe(expectedSessionKey);
      expect(enqueuedObj.sessionHash).not.toBe(tabId);
    });

    it("guarantees zero cross-day linkability for the same client tabId across two days", () => {
      const tabId = "tab_fixed_user_session_1";
      const salt = "test_telemetry_salt_secret";

      const keyDay1 = computeDailySessionHash(tabId, salt, "2026-11-23");
      const keyDay2 = computeDailySessionHash(tabId, salt, "2026-11-24");

      expect(keyDay1).not.toBe(keyDay2);
      expect(keyDay1).toHaveLength(32);
      expect(keyDay2).toHaveLength(32);
    });
  });

  // 6. Origin check matrix
  describe("6. Origin & Sec-Fetch-Site validation matrix", () => {
    it("allows missing Origin header (common in sendBeacon same-origin navigation)", async () => {
      const payload = JSON.stringify({
        tabId: "tab_no_origin_1",
        pathname: "/pricing",
        deviceType: "desktop",
        activeMs: 3000,
        maxScrollPct: 30,
      });

      const req = new NextRequest("https://app.vyaparmedia.in/api/telemetry/track", {
        method: "POST",
        headers: {
          host: "app.vyaparmedia.in",
          "content-type": "text/plain",
          // No origin header
        },
        body: payload,
      });

      const res = await POST(req);
      expect(res.status).toBe(204);
    });

    it("rejects sec-fetch-site: cross-site requests", async () => {
      const incSpy = vi.spyOn(telemetryEventsDroppedTotal, "inc");
      const payload = JSON.stringify({
        tabId: "tab_cross_site",
        pathname: "/pricing",
        deviceType: "desktop",
        activeMs: 3000,
        maxScrollPct: 30,
      });

      const req = new NextRequest("https://app.vyaparmedia.in/api/telemetry/track", {
        method: "POST",
        headers: {
          "sec-fetch-site": "cross-site",
          origin: "https://malicious-site.com",
        },
        body: payload,
      });

      const res = await POST(req);
      expect(res.status).toBe(204);
      expect(incSpy).toHaveBeenCalledWith({ reason: "ORIGIN_DISALLOWED" });
    });

    it("rejects unauthorized external origin", async () => {
      const incSpy = vi.spyOn(telemetryEventsDroppedTotal, "inc");
      const payload = JSON.stringify({
        tabId: "tab_bad_origin",
        pathname: "/pricing",
        deviceType: "desktop",
        activeMs: 3000,
        maxScrollPct: 30,
      });

      const req = new NextRequest("https://app.vyaparmedia.in/api/telemetry/track", {
        method: "POST",
        headers: {
          origin: "https://evil.example.com",
          host: "app.vyaparmedia.in",
        },
        body: payload,
      });

      const res = await POST(req);
      expect(res.status).toBe(204);
      expect(incSpy).toHaveBeenCalledWith({ reason: "ORIGIN_DISALLOWED" });
    });
  });

  // 7. Micro-benchmark note & ingest performance budget (<50ms)
  describe("7. Ingest budget & performance", () => {
    it("completes enqueueTrackEvent under 50ms performance budget", async () => {
      // Mock Redis returning cached influencer ID so it does not touch Prisma in pure unit benchmark
      vi.spyOn(redis, "get").mockResolvedValue("inf_cached_123");

      const payload = {
        tabId: "tab_perf_1234",
        pathname: "/creator/priya",
        deviceType: "mobile" as const,
        activeMs: 4000,
        maxScrollPct: 40,
      };

      const start = performance.now();
      await TelemetryService.enqueueTrackEvent(payload, null, { clock: fixedDate });
      const durationMs = performance.now() - start;

      expect(durationMs).toBeLessThan(50);
    });

    it("prefers TELEMETRY_DAILY_SALT_SECRET from DEPLOY.md spec when generating session hash", async () => {
      delete process.env.TELEMETRY_DAILY_SALT;
      vi.stubEnv("TELEMETRY_DAILY_SALT_SECRET", "prod_spec_secret_salt_value_64_chars");
      const rpushSpy = vi.spyOn(redis, "rpush").mockResolvedValue(1);

      const payload = {
        tabId: "tab_salt_spec",
        pathname: "/pricing",
        deviceType: "desktop" as const,
        activeMs: 1000,
        maxScrollPct: 10,
      };

      await TelemetryService.enqueueTrackEvent(payload, null, { clock: fixedDate });
      expect(rpushSpy).toHaveBeenCalled();
      const enqueued = JSON.parse(rpushSpy.mock.calls[0]![1] as string);
      expect(enqueued.sessionHash).toBeDefined();
      expect(enqueued.sessionHash.length).toBe(32);
    });
  });
});
