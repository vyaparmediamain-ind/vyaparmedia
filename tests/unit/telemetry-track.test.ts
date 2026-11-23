import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  normalizeRouteKey,
  extractRouteIdentifiers,
  CANONICAL_ROUTE_KEYS,
} from "@/lib/route-key";
import { TrackEventPayloadSchema } from "@/lib/telemetry";
import {
  TelemetryService,
  getRedisDroppedCount,
  resetRedisDroppedCount,
} from "@/services/telemetry.service";
import { POST } from "@/app/api/telemetry/track/route";
import { isCsrfExempt, CSRF_EXEMPT_EXACT } from "@/lib/csrf-exempt";
import fs from "node:fs";
import path from "node:path";
import { redis } from "@/lib/redis";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import * as featureFlagsModule from "@/lib/feature-flags";
import * as rateLimitModule from "@/lib/rate-limit";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe("Telemetry Beacon Ingest & Tracking Subsystem", () => {
  const fixedClock = new Date("2026-11-22T12:00:00.000Z");

  const validPayload = {
    sessionHash: "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d",
    pathname: "/creator/priyacreates",
    routeKey: "/creator/[username]",
    deviceType: "mobile" as const,
    referrerHost: "instagram.com",
    activeMs: 45000,
    maxScrollPct: 75,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetRedisDroppedCount();

    // Default feature flags
    vi.spyOn(featureFlagsModule, "isFeatureEnabled").mockImplementation(async (key) => {
      if (key === featureFlagsModule.FEATURE_FLAGS.TELEMETRY_ANONYMOUS) return true;
      if (key === featureFlagsModule.FEATURE_FLAGS.TELEMETRY_IDENTIFIED) return true;
      return false;
    });

    // Default Redis spies
    vi.spyOn(redis, "get").mockResolvedValue(null);
    vi.spyOn(redis, "set").mockResolvedValue("OK");
    vi.spyOn(redis, "rpush").mockResolvedValue(1);

    // Default rate limit passed
    vi.spyOn(rateLimitModule, "atomicDualRateLimit").mockResolvedValue({
      success: true,
      userCount: 1,
      ipCount: 1,
    });

    // Default unauthenticated session
    (vi.mocked(auth) as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  });

  // =========================================================================
  // 1. ROUTEKEY TABLE & CARDINALITY BOUNDING
  // =========================================================================
  describe("1. routeKey table & cardinality bounding (pure logic)", () => {
    const routeKeyTable: Array<{ input: string | null | undefined; expected: string }> = [
      { input: "/", expected: "/" },
      { input: "", expected: "/other" },
      { input: null, expected: "/other" },
      { input: undefined, expected: "/other" },
      { input: "/privacy", expected: "/privacy" },
      { input: "/cookie-policy", expected: "/cookie-policy" },
      { input: "/pricing", expected: "/pricing" },
      { input: "/dashboard", expected: "/dashboard" },
      { input: "/dashboard/campaigns", expected: "/dashboard/campaigns" },
      { input: "/dashboard/campaigns/create", expected: "/dashboard/campaigns/create" },
      { input: "/dashboard/campaigns/cmw12345", expected: "/dashboard/campaigns/[id]" },
      { input: "/dashboard/campaigns/cmw12345/analytics", expected: "/dashboard/campaigns/[id]/analytics" },
      { input: "/dashboard/deals", expected: "/dashboard/deals" },
      { input: "/dashboard/deals/dlw67890", expected: "/dashboard/deals/[id]" },
      { input: "/dashboard/wallet", expected: "/dashboard/wallet" },
      { input: "/dashboard/settings", expected: "/dashboard/settings" },
      { input: "/dashboard/settings/security", expected: "/dashboard/settings" },
      { input: "/dashboard/influencers", expected: "/dashboard/influencers" },
      { input: "/creator/priyacreates", expected: "/creator/[username]" },
      { input: "/creator/@rohit_sharma", expected: "/creator/[username]" },
      { input: "/creator/user_123-abc", expected: "/creator/[username]" },
      { input: "/brand/brand_clh999", expected: "/brand/[id]" },
      { input: "/admin", expected: "/admin" },
      { input: "/admin/scouts", expected: "/admin" },
      { input: "/admin/system/feature-flags", expected: "/admin" },
      { input: "/login", expected: "/auth" },
      { input: "/register", expected: "/auth" },
      { input: "/auth/signin", expected: "/auth" },
      // Unknown paths bounded to "/other"
      { input: "/unsupported/page/test", expected: "/other" },
      { input: "/random-404-url", expected: "/other" },
      { input: "/api/unknown", expected: "/other" },
      // Strips query strings, trailing slashes, and hash fragments
      { input: "/creator/priyacreates?utm_source=ig&ref=bio", expected: "/creator/[username]" },
      { input: "/brand/brand_123/#reviews", expected: "/brand/[id]" },
      { input: "/dashboard/campaigns/cmw123///", expected: "/dashboard/campaigns/[id]" },
    ];

    routeKeyTable.forEach(({ input, expected }) => {
      it(`normalizes "${input}" -> "${expected}"`, () => {
        expect(normalizeRouteKey(input)).toBe(expected);
      });
    });

    it("ensures all normalized routeKeys belong to the canonical route keys set", () => {
      routeKeyTable.forEach(({ input }) => {
        const key = normalizeRouteKey(input);
        expect(CANONICAL_ROUTE_KEYS).toContain(key);
      });
    });

    it("extracts route identifiers from dynamic paths correctly", () => {
      expect(extractRouteIdentifiers("/creator/priyacreates")).toEqual({ username: "priyacreates" });
      expect(extractRouteIdentifiers("/creator/@rohit_sharma?tab=rates")).toEqual({ username: "rohit_sharma" });
      expect(extractRouteIdentifiers("/brand/brand_cuid123")).toEqual({ brandId: "brand_cuid123" });
      expect(extractRouteIdentifiers("/dashboard/campaigns/cmw999/analytics")).toEqual({ campaignId: "cmw999" });
      expect(extractRouteIdentifiers("/dashboard/campaigns/cmw888")).toEqual({ campaignId: "cmw888" });
      expect(extractRouteIdentifiers("/dashboard/deals/dlw777")).toEqual({ dealId: "dlw777" });
      expect(extractRouteIdentifiers("/dashboard")).toEqual({});
      expect(extractRouteIdentifiers(null)).toEqual({});
    });
  });

  // =========================================================================
  // 2. PAYLOAD REJECTION
  // =========================================================================
  describe("2. payload rejection (schema validation & limits)", () => {
    it("validates and parses a valid payload successfully", () => {
      const parsed = TrackEventPayloadSchema.safeParse(validPayload);
      expect(parsed.success).toBe(true);
    });

    it("rejects non-hex sessionHash", () => {
      const parsed = TrackEventPayloadSchema.safeParse({
        ...validPayload,
        sessionHash: "not-a-valid-hex-hash!#$",
      });
      expect(parsed.success).toBe(false);
    });

    it("rejects negative activeMs or activeMs exceeding 30 minutes (1,800,000 ms)", () => {
      expect(TrackEventPayloadSchema.safeParse({ ...validPayload, activeMs: -10 }).success).toBe(false);
      expect(TrackEventPayloadSchema.safeParse({ ...validPayload, activeMs: 1_800_001 }).success).toBe(false);
      expect(TrackEventPayloadSchema.safeParse({ ...validPayload, activeMs: 1_800_000 }).success).toBe(true);
    });

    it("rejects maxScrollPct outside 0-100 range", () => {
      expect(TrackEventPayloadSchema.safeParse({ ...validPayload, maxScrollPct: -1 }).success).toBe(false);
      expect(TrackEventPayloadSchema.safeParse({ ...validPayload, maxScrollPct: 101 }).success).toBe(false);
      expect(TrackEventPayloadSchema.safeParse({ ...validPayload, maxScrollPct: 100 }).success).toBe(true);
    });

    it("rejects unrecognized extra fields (strict schema validation)", () => {
      const parsed = TrackEventPayloadSchema.safeParse({
        ...validPayload,
        unapprovedField: "attacker_token",
        ipAddress: "192.168.1.1",
      });
      expect(parsed.success).toBe(false);
    });

    it("endpoint rejects oversized payload (> 2KB) and does not enqueue to Redis", async () => {
      const largePayload = {
        ...validPayload,
        pathname: "/creator/" + "x".repeat(2500),
      };
      const rawText = JSON.stringify(largePayload);
      const req = new NextRequest("http://localhost:3000/api/telemetry/track", {
        method: "POST",
        headers: {
          "content-type": "text/plain",
          "content-length": String(rawText.length),
          host: "localhost:3000",
        },
        body: rawText,
      });

      const res = await POST(req);
      expect(res.status).toBe(204);
      expect(redis.rpush).not.toHaveBeenCalled();
    });

    it("endpoint rejects malformed JSON and does not enqueue to Redis", async () => {
      const req = new NextRequest("http://localhost:3000/api/telemetry/track", {
        method: "POST",
        headers: { "content-type": "text/plain", host: "localhost:3000" },
        body: "{ malformed json text ...",
      });

      const res = await POST(req);
      expect(res.status).toBe(204);
      expect(redis.rpush).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 3. RATE LIMITS
  // =========================================================================
  describe("3. rate limits (per-IP and per-session)", () => {
    it("drops event when dual-key rate limit rejects request", async () => {
      vi.spyOn(rateLimitModule, "atomicDualRateLimit").mockResolvedValueOnce({
        success: false,
        userCount: 65,
        ipCount: 130,
        blockedBy: "IP",
      });

      const req = new NextRequest("http://localhost:3000/api/telemetry/track", {
        method: "POST",
        headers: { "content-type": "text/plain", host: "localhost:3000" },
        body: JSON.stringify(validPayload),
      });

      const res = await POST(req);
      expect(res.status).toBe(204);
      expect(redis.rpush).not.toHaveBeenCalled();
    });

    it("allows event when dual-key rate limit check succeeds", async () => {
      vi.spyOn(rateLimitModule, "atomicDualRateLimit").mockResolvedValueOnce({
        success: true,
        userCount: 10,
        ipCount: 20,
      });

      const req = new NextRequest("http://localhost:3000/api/telemetry/track", {
        method: "POST",
        headers: { "content-type": "text/plain", host: "localhost:3000" },
        body: JSON.stringify(validPayload),
      });

      const res = await POST(req);
      expect(res.status).toBe(204);
      expect(redis.rpush).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 4. CSRF EXEMPTION EXACTNESS
  // =========================================================================
  describe("4. CSRF exemption exactness in middleware", () => {
    it("exempts /api/telemetry/track exactly", () => {
      expect(CSRF_EXEMPT_EXACT).toContain("/api/telemetry/track");
      expect(isCsrfExempt("/api/telemetry/track")).toBe(true);
      expect(isCsrfExempt("/api/telemetry/track?utm=1")).toBe(true);
    });

    it("does NOT exempt arbitrary subpaths or prefixes of /api/telemetry/track", () => {
      expect(isCsrfExempt("/api/telemetry/track/nested")).toBe(false);
      expect(isCsrfExempt("/api/telemetry/tracking")).toBe(false);
      expect(isCsrfExempt("/api/telemetry/tracker")).toBe(false);
      expect(isCsrfExempt("/api/telemetry/track-other")).toBe(false);
    });

    it("ensures src/middleware.ts wires exact CSRF exemption for /api/telemetry/track", () => {
      const middlewarePath = path.join(process.cwd(), "src/middleware.ts");
      const content = fs.readFileSync(middlewarePath, "utf-8");
      expect(content).toContain("CSRF_EXEMPT_EXACT");
      expect(content).toContain("isCsrfExempt");
    });
  });

  // =========================================================================
  // 5. CONSENT-OFF STORES NO USERID
  // =========================================================================
  describe("5. consent-off stores no userId", () => {
    it("stores userId: null when user has not given affirmative consent", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValueOnce({
        telemetryConsent: false,
      } as unknown as import("@prisma/client").User);

      const result = await TelemetryService.enqueueTrackEvent(
        validPayload,
        { id: "usr_creator_01", role: "INFLUENCER" },
        { clock: fixedClock }
      );

      expect(result.enqueued).toBe(true);
      expect(redis.rpush).toHaveBeenCalled();

      const enqueuedString = vi.mocked(redis.rpush).mock.calls[0]?.[1] as string;
      const parsedEnqueued = JSON.parse(enqueuedString);

      expect(parsedEnqueued.userId).toBeNull();
      expect(parsedEnqueued.role).toBeNull();
      expect(parsedEnqueued.routeKey).toBe("/creator/[username]");
    });

    it("stores userId: null when caller is unauthenticated", async () => {
      const result = await TelemetryService.enqueueTrackEvent(
        validPayload,
        null,
        { clock: fixedClock }
      );

      expect(result.enqueued).toBe(true);
      const enqueuedString = vi.mocked(redis.rpush).mock.calls[0]?.[1] as string;
      const parsedEnqueued = JSON.parse(enqueuedString);

      expect(parsedEnqueued.userId).toBeNull();
      expect(parsedEnqueued.role).toBeNull();
    });

    it("stores userId and role ONLY when affirmative consent is true AND flag is enabled", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValueOnce({
        telemetryConsent: true,
      } as unknown as import("@prisma/client").User);

      const result = await TelemetryService.enqueueTrackEvent(
        validPayload,
        { id: "usr_creator_01", role: "INFLUENCER" },
        { clock: fixedClock }
      );

      expect(result.enqueued).toBe(true);
      const enqueuedString = vi.mocked(redis.rpush).mock.calls[0]?.[1] as string;
      const parsedEnqueued = JSON.parse(enqueuedString);

      expect(parsedEnqueued.userId).toBe("usr_creator_01");
      expect(parsedEnqueued.role).toBe("INFLUENCER");
    });
  });

  // =========================================================================
  // 6. REDIS-DOWN PATH
  // =========================================================================
  describe("6. Redis-down path (analytics must never break the app)", () => {
    it("drops event and increments error counter when redis.rpush fails", async () => {
      expect(getRedisDroppedCount()).toBe(0);

      vi.spyOn(redis, "rpush").mockRejectedValueOnce(new Error("ECONNREFUSED 127.0.0.1:6379"));

      const result = await TelemetryService.enqueueTrackEvent(
        validPayload,
        null,
        { clock: fixedClock }
      );

      expect(result.enqueued).toBe(false);
      expect(result.droppedReason).toBe("REDIS_DOWN");
      expect(getRedisDroppedCount()).toBe(1);
    });

    it("route returns 204 without throwing even when Redis throws inside service", async () => {
      vi.spyOn(redis, "rpush").mockRejectedValueOnce(new Error("Redis cluster disconnected"));

      const req = new NextRequest("http://localhost:3000/api/telemetry/track", {
        method: "POST",
        headers: { "content-type": "text/plain", host: "localhost:3000" },
        body: JSON.stringify(validPayload),
      });

      const res = await POST(req);
      expect(res.status).toBe(204);
      expect(getRedisDroppedCount()).toBe(1);
    });

    it("falls back gracefully when Redis cache lookup throws during target resolution", async () => {
      vi.spyOn(redis, "get").mockRejectedValueOnce(new Error("Redis read timeout"));
      vi.spyOn(prisma.influencerProfile, "findFirst").mockResolvedValueOnce({
        id: "clh_target_influencer_01",
      } as unknown as import("@prisma/client").InfluencerProfile);

      const targetId = await TelemetryService.resolveTargetInfluencerId("priyacreates");
      expect(targetId).toBe("clh_target_influencer_01");
    });
  });

  // =========================================================================
  // 7. ADMIN EVENTS DROPPED
  // =========================================================================
  describe("7. admin events dropped", () => {
    it("drops events when caller role is ADMIN", async () => {
      const result = await TelemetryService.enqueueTrackEvent(
        validPayload,
        { id: "usr_admin_01", role: "ADMIN" },
        { clock: fixedClock }
      );

      expect(result.enqueued).toBe(false);
      expect(result.droppedReason).toBe("ADMIN_DROPPED");
      expect(redis.rpush).not.toHaveBeenCalled();
    });

    it("drops events when routeKey is /admin or pathname starts with /admin", async () => {
      const adminRoutePayload = {
        ...validPayload,
        pathname: "/admin/system/feature-flags",
        routeKey: "/admin",
      };

      const result = await TelemetryService.enqueueTrackEvent(
        adminRoutePayload,
        { id: "usr_user_01", role: "USER" },
        { clock: fixedClock }
      );

      expect(result.enqueued).toBe(false);
      expect(result.droppedReason).toBe("ADMIN_DROPPED");
      expect(redis.rpush).not.toHaveBeenCalled();
    });

    it("POST /api/telemetry/track drops admin events and returns 204", async () => {
      (vi.mocked(auth) as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        user: { id: "usr_admin_01", userType: "ADMIN" },
        expires: "2099-01-01",
      });

      const req = new NextRequest("http://localhost:3000/api/telemetry/track", {
        method: "POST",
        headers: { "content-type": "text/plain", host: "localhost:3000" },
        body: JSON.stringify(validPayload),
      });

      const res = await POST(req);
      expect(res.status).toBe(204);
      expect(redis.rpush).not.toHaveBeenCalled();
    });
  });
});
