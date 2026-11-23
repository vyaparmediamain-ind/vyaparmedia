import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import prisma from "@/lib/db";
import {
  PageViewEventInputSchema,
  TelemetryConsentInputSchema,
  sanitizeReferrerHost,
  resolveDeviceType,
  normalizeRouteKey,
  computeDailySessionHash,
  canRecordIdentifiedTelemetry,
  createConsentUpdate,
  TELEMETRY_POLICY_VERSION,
} from "@/lib/telemetry";
import { TelemetryService } from "@/services/telemetry.service";
import { TelemetryConsentPanel } from "@/components/dashboard/settings/TelemetryConsentPanel";
import * as featureFlagsModule from "@/lib/feature-flags";
import * as auditModule from "@/lib/audit";
import { AppError } from "@/lib/errors";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe("Telemetry & Privacy Consent Subsystem (DPDP Act 2023)", () => {
  const fixedClock = new Date("2026-11-22T10:00:00.000Z");

  const validEventPayload = {
    sessionHash: "a1b2c3d4e5f60718293a4b5c6d7e8f90",
    routeKey: "CREATOR_PROFILE",
    targetInfluencerId: "clh123456000001a1b2c3d4e5",
    targetCampaignId: null,
    deviceType: "mobile" as const,
    referrerHost: "https://www.instagram.com/explore?tag=fashion",
    activeMs: 45000,
    maxScrollPct: 85,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: both flags enabled for testing happy paths unless overridden
    vi.spyOn(featureFlagsModule, "isFeatureEnabled").mockImplementation(async (key) => {
      if (key === featureFlagsModule.FEATURE_FLAGS.TELEMETRY_ANONYMOUS) return true;
      if (key === featureFlagsModule.FEATURE_FLAGS.TELEMETRY_IDENTIFIED) return true;
      return false;
    });

    vi.spyOn(auditModule, "createActivityLog").mockResolvedValue(
      {} as unknown as import("@prisma/client").ActivityLog
    );
  });

  describe("1. Pure Functions & Input Validation", () => {
    it("sanitizes referrer URLs to domain only, stripping query strings and tokens", () => {
      expect(
        sanitizeReferrerHost("https://www.google.co.in/search?q=influencer+deals&token=secret123")
      ).toBe("www.google.co.in");
      expect(sanitizeReferrerHost("https://instagram.com/reel/12345#ref")).toBe("instagram.com");
      expect(sanitizeReferrerHost("app.vyaparmedia.in")).toBe("app.vyaparmedia.in");

      // Drops internal/localhost hosts
      expect(sanitizeReferrerHost("http://localhost:3000/dashboard")).toBeNull();
      expect(sanitizeReferrerHost("http://127.0.0.1:8080")).toBeNull();
      expect(sanitizeReferrerHost(null)).toBeNull();
      expect(sanitizeReferrerHost("")).toBeNull();
    });

    it("resolves coarse deviceType without persisting raw User-Agent", () => {
      expect(
        resolveDeviceType(
          "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148"
        )
      ).toBe("mobile");

      expect(
        resolveDeviceType(
          "Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X) AppleWebKit/605.1.15"
        )
      ).toBe("tablet");

      expect(
        resolveDeviceType(
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
      ).toBe("desktop");

      expect(resolveDeviceType(null)).toBe("desktop");
    });

    it("normalizes URL paths to canonical route keys", () => {
      expect(normalizeRouteKey("/")).toBe("HOME");
      expect(normalizeRouteKey("/privacy")).toBe("LEGAL_PRIVACY");
      expect(normalizeRouteKey("/cookie-policy")).toBe("LEGAL_COOKIES");
      expect(normalizeRouteKey("/dashboard/settings?tab=security")).toBe("DASHBOARD_SETTINGS");
      expect(normalizeRouteKey("/dashboard/campaigns/cmw123456")).toBe("CAMPAIGN_DETAIL");
      expect(normalizeRouteKey("/creator/rohit_sharma")).toBe("CREATOR_PROFILE");
    });

    it("computes deterministic daily session hash with rotating salt", () => {
      const hash1 = computeDailySessionHash("tab_uuid_abc123", "secret_salt_xyz", "2026-11-22");
      const hash2 = computeDailySessionHash("tab_uuid_abc123", "secret_salt_xyz", "2026-11-22");
      const hashOtherDay = computeDailySessionHash("tab_uuid_abc123", "secret_salt_xyz", "2026-11-23");

      expect(hash1).toHaveLength(32);
      expect(hash1).toBe(hash2);
      // Mathematical guarantee: cross-day correlation impossible
      expect(hash1).not.toBe(hashOtherDay);
    });

    it("validates input schema strictly and rejects illegal or injected fields", () => {
      const parsed = PageViewEventInputSchema.safeParse(validEventPayload);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.referrerHost).toBe("www.instagram.com");
      }

      // Rejects unapproved fields (e.g. IP address or raw user agent injection)
      const withIp = { ...validEventPayload, ipAddress: "192.168.1.1" };
      expect(PageViewEventInputSchema.safeParse(withIp).success).toBe(false);

      const withRawUa = { ...validEventPayload, userAgent: "Mozilla/5.0 ..." };
      expect(PageViewEventInputSchema.safeParse(withRawUa).success).toBe(false);

      // Rejects negative activeMs or out-of-range scroll percentage
      expect(PageViewEventInputSchema.safeParse({ ...validEventPayload, activeMs: -10 }).success).toBe(false);
      expect(PageViewEventInputSchema.safeParse({ ...validEventPayload, maxScrollPct: 150 }).success).toBe(false);
    });

    it("validates TelemetryConsentInputSchema and defaults to current policy version", () => {
      const parsed = TelemetryConsentInputSchema.safeParse({ consent: true });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.version).toBe(TELEMETRY_POLICY_VERSION);
      }
    });
  });

  describe("2. Consent State Machine Transitions", () => {
    it("evaluates canRecordIdentifiedTelemetry strictly", () => {
      // Flag OFF: always false
      expect(canRecordIdentifiedTelemetry(true, false)).toBe(false);
      expect(canRecordIdentifiedTelemetry(false, false)).toBe(false);

      // Flag ON: requires user affirmative consent
      expect(canRecordIdentifiedTelemetry(false, true)).toBe(false);
      expect(canRecordIdentifiedTelemetry(null, true)).toBe(false);
      expect(canRecordIdentifiedTelemetry(undefined, true)).toBe(false);
      expect(canRecordIdentifiedTelemetry(true, true)).toBe(true);
    });

    it("constructs atomic consent update object", () => {
      const update = createConsentUpdate(true, "2026.1", fixedClock);
      expect(update).toEqual({
        telemetryConsent: true,
        telemetryConsentAt: fixedClock,
        telemetryConsentVersion: "2026.1",
      });

      const revoke = createConsentUpdate(false, "2026.1", fixedClock);
      expect(revoke.telemetryConsent).toBe(false);
      expect(revoke.telemetryConsentAt).toBe(fixedClock);
    });

    it("updates consent in database and writes audit activity log", async () => {
      const mockUpdated = {
        id: "usr_alice",
        telemetryConsent: true,
        telemetryConsentAt: fixedClock,
        telemetryConsentVersion: "2026.1",
      };

      vi.spyOn(prisma.user, "update").mockResolvedValue(
        mockUpdated as unknown as import("@prisma/client").User
      );

      const res = await TelemetryService.updateUserConsent(
        "usr_alice",
        true,
        "2026.1",
        { clock: fixedClock }
      );

      expect(res.consent).toBe(true);
      expect(res.version).toBe("2026.1");

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "usr_alice" },
        data: {
          telemetryConsent: true,
          telemetryConsentAt: fixedClock,
          telemetryConsentVersion: "2026.1",
        },
        select: {
          telemetryConsent: true,
          telemetryConsentAt: true,
          telemetryConsentVersion: true,
        },
      });

      expect(auditModule.createActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "usr_alice",
          action: "TELEMETRY_CONSENT_GRANTED",
          entityType: "User",
          entityId: "usr_alice",
        })
      );
    });

    it("retrieves current consent status or throws 404 if user not found", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: "usr_alice",
        telemetryConsent: true,
        telemetryConsentAt: fixedClock,
        telemetryConsentVersion: "2026.1",
      } as unknown as import("@prisma/client").User);

      const status = await TelemetryService.getUserConsent("usr_alice");
      expect(status.consent).toBe(true);
      expect(status.version).toBe("2026.1");

      // User not found throws 404
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(null);
      await expect(TelemetryService.getUserConsent("usr_missing")).rejects.toThrow(AppError);
    });
  });

  describe("3. Server-Side Ingest Enforcement & Privacy Gates", () => {
    it("drops events when telemetry_anonymous master flag is OFF", async () => {
      vi.spyOn(featureFlagsModule, "isFeatureEnabled").mockResolvedValue(false);
      const createSpy = vi.spyOn(prisma.pageViewEvent, "create");

      const result = await TelemetryService.recordPageView(validEventPayload, null);

      expect(result.recorded).toBe(false);
      expect(result.identified).toBe(false);
      expect(result.reason).toBe("TELEMETRY_ANONYMOUS_DISABLED");
      expect(createSpy).not.toHaveBeenCalled();
    });

    it("persists anonymous events with userId=null when caller is unauthenticated", async () => {
      vi.spyOn(prisma.pageViewEvent, "create").mockResolvedValue({
        id: "pve_mock_001",
      } as unknown as import("@prisma/client").PageViewEvent);

      const result = await TelemetryService.recordPageView(validEventPayload, null, { clock: fixedClock });

      expect(result.recorded).toBe(true);
      expect(result.identified).toBe(false);
      expect(result.eventId).toBe("pve_mock_001");

      expect(prisma.pageViewEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sessionHash: validEventPayload.sessionHash,
          userId: null,
          role: null,
          routeKey: "CREATOR_PROFILE",
          deviceType: "mobile",
          referrerHost: "www.instagram.com",
          activeMs: 45000,
          maxScrollPct: 85,
          createdAt: fixedClock,
        }),
        select: { id: true },
      });
    });

    it("strips userId and stores as anonymous when user has NOT granted telemetry consent", async () => {
      // User has telemetryConsent: false
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: "usr_bob",
        telemetryConsent: false,
      } as unknown as import("@prisma/client").User);

      vi.spyOn(prisma.pageViewEvent, "create").mockResolvedValue({
        id: "pve_mock_002",
      } as unknown as import("@prisma/client").PageViewEvent);

      const result = await TelemetryService.recordPageView(
        validEventPayload,
        { id: "usr_bob", role: "BRAND" },
        { clock: fixedClock }
      );

      expect(result.recorded).toBe(true);
      expect(result.identified).toBe(false);

      // Verifies server-side stripping: userId MUST be null
      expect(prisma.pageViewEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: null,
          role: null,
        }),
        select: { id: true },
      });
    });

    it("strips userId when telemetry_identified flag is disabled even if user consented", async () => {
      vi.spyOn(featureFlagsModule, "isFeatureEnabled").mockImplementation(async (key) => {
        if (key === featureFlagsModule.FEATURE_FLAGS.TELEMETRY_ANONYMOUS) return true;
        if (key === featureFlagsModule.FEATURE_FLAGS.TELEMETRY_IDENTIFIED) return false; // Flag OFF
        return false;
      });

      vi.spyOn(prisma.pageViewEvent, "create").mockResolvedValue({
        id: "pve_mock_003",
      } as unknown as import("@prisma/client").PageViewEvent);

      const result = await TelemetryService.recordPageView(
        validEventPayload,
        { id: "usr_alice", role: "INFLUENCER" },
        { clock: fixedClock }
      );

      expect(result.recorded).toBe(true);
      expect(result.identified).toBe(false);

      expect(prisma.pageViewEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: null,
          role: null,
        }),
        select: { id: true },
      });
    });

    it("persists identified event with userId and role ONLY when both flag is ON and user consented", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: "usr_alice",
        telemetryConsent: true,
      } as unknown as import("@prisma/client").User);

      vi.spyOn(prisma.pageViewEvent, "create").mockResolvedValue({
        id: "pve_mock_004",
      } as unknown as import("@prisma/client").PageViewEvent);

      const result = await TelemetryService.recordPageView(
        validEventPayload,
        { id: "usr_alice", role: "INFLUENCER" },
        { clock: fixedClock }
      );

      expect(result.recorded).toBe(true);
      expect(result.identified).toBe(true);
      expect(result.eventId).toBe("pve_mock_004");

      expect(prisma.pageViewEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "usr_alice",
          role: "INFLUENCER",
        }),
        select: { id: true },
      });
    });
  });

  describe("4. Daily Statistical Rollup Aggregation", () => {
    it("aggregates raw page views into DailyRouteStat rollups with bounce calculation", async () => {
      const mockRawEvents = [
        {
          routeKey: "CREATOR_PROFILE",
          sessionHash: "session_1",
          activeMs: 40000,
          maxScrollPct: 80,
        },
        {
          routeKey: "CREATOR_PROFILE",
          sessionHash: "session_2",
          activeMs: 3000, // Bounce: <5000ms & <25% scroll
          maxScrollPct: 15,
        },
        {
          routeKey: "CREATOR_PROFILE",
          sessionHash: "session_1", // Same session, second view
          activeMs: 25000,
          maxScrollPct: 60,
        },
      ];

      vi.spyOn(prisma.pageViewEvent, "findMany").mockResolvedValue(
        mockRawEvents as unknown as import("@prisma/client").PageViewEvent[]
      );

      const upsertSpy = vi.spyOn(prisma.dailyRouteStat, "upsert").mockResolvedValue(
        {} as unknown as import("@prisma/client").DailyRouteStat
      );

      const res = await TelemetryService.aggregateDailyRouteStats(fixedClock);

      expect(res.processedRoutes).toBe(1);

      // Expected math:
      // total views: 3
      // unique visitors (distinct sessions): 2 ('session_1', 'session_2')
      // avg active ms: Math.round((40000 + 3000 + 25000) / 3) = Math.round(68000 / 3) = 22667
      // avg scroll pct: Math.round((80 + 15 + 60) / 3) = Math.round(155 / 3) = 52
      // bounces: 1 (session_2) -> bounceBps: Math.round(1 / 3 * 10000) = 3333 bps (33.33%)
      expect(upsertSpy).toHaveBeenCalledWith({
        where: {
          date_routeKey: {
            date: expect.any(Date),
            routeKey: "CREATOR_PROFILE",
          },
        },
        create: {
          date: expect.any(Date),
          routeKey: "CREATOR_PROFILE",
          uniqueVisitors: 2,
          pageViews: 3,
          avgActiveMs: 22667,
          avgScrollPct: 52,
          bounceBps: 3333,
        },
        update: {
          uniqueVisitors: 2,
          pageViews: 3,
          avgActiveMs: 22667,
          avgScrollPct: 52,
          bounceBps: 3333,
        },
      });
    });
  });

  describe("5. UI Consent Components Rendering", () => {
    it("renders TelemetryConsentPanel with loading skeleton when mounted initially", () => {
      const html = renderToStaticMarkup(
        React.createElement(TelemetryConsentPanel)
      );

      expect(html).toContain("animate-pulse");
      expect(html).toContain("bg-card");
      expect(html).toContain("border-border");
    });
  });
});
