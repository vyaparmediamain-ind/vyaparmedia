import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getKolkataDayBounds,
  aggregateRouteStats,
  aggregateFunnelStats,
  aggregateTrafficBreakdowns,
  BOUNCE_THRESHOLD_MS,
  type RawTelemetryEvent,
} from "@/lib/telemetry-aggregator";
import { TelemetryRollupService } from "@/services/telemetry-rollup.service";
import prisma from "@/lib/db";
import { redis } from "@/lib/redis";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe("Telemetry Aggregator & Rollup Engine (Asia/Kolkata Explicit)", () => {
  const fixedClock = new Date("2026-11-22T10:00:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. IST MIDNIGHT EDGE & TIMEZONE BOUNDARIES
  // =========================================================================
  describe("1. IST Midnight Edge & Date Bucketing", () => {
    it("correctly identifies midnight IST (18:30:00.000 UTC) as start of next Kolkata day", () => {
      // 2026-11-22 18:30:00.000 UTC == 2026-11-23 00:00:00.000 IST
      const exactMidnightUtc = new Date("2026-11-22T18:30:00.000Z");
      const bounds = getKolkataDayBounds(exactMidnightUtc);

      expect(bounds.dateStr).toBe("2026-11-23");
      expect(bounds.dayStart.toISOString()).toBe("2026-11-22T18:30:00.000Z");
      expect(bounds.dayEnd.toISOString()).toBe("2026-11-23T18:30:00.000Z");
    });

    it("correctly buckets 1 millisecond before midnight IST into the previous Kolkata day", () => {
      // 2026-11-22 18:29:59.999 UTC == 2026-11-22 23:59:59.999 IST
      const oneMsBeforeMidnight = new Date("2026-11-22T18:29:59.999Z");
      const bounds = getKolkataDayBounds(oneMsBeforeMidnight);

      expect(bounds.dateStr).toBe("2026-11-22");
      expect(bounds.dayStart.toISOString()).toBe("2026-11-21T18:30:00.000Z");
      expect(bounds.dayEnd.toISOString()).toBe("2026-11-22T18:30:00.000Z");
    });

    it("correctly buckets 1 millisecond after midnight IST into the new Kolkata day", () => {
      // 2026-11-22 18:30:00.001 UTC == 2026-11-23 00:00:00.001 IST
      const oneMsAfterMidnight = new Date("2026-11-22T18:30:00.001Z");
      const bounds = getKolkataDayBounds(oneMsAfterMidnight);

      expect(bounds.dateStr).toBe("2026-11-23");
      expect(bounds.dayStart.toISOString()).toBe("2026-11-22T18:30:00.000Z");
    });

    it("handles midday UTC in Asia/Kolkata correctly (+5h 30m)", () => {
      // 2026-11-22 12:00:00 UTC == 2026-11-22 17:30:00 IST
      const middayUtc = new Date("2026-11-22T12:00:00.000Z");
      const bounds = getKolkataDayBounds(middayUtc);

      expect(bounds.dateStr).toBe("2026-11-22");
      expect(bounds.dayStart.toISOString()).toBe("2026-11-21T18:30:00.000Z");
      expect(bounds.dayEnd.toISOString()).toBe("2026-11-22T18:30:00.000Z");
    });
  });

  // =========================================================================
  // 2. UNIQUE VISITOR & BOUNCE MATHEMATICS
  // =========================================================================
  describe("2. Unique Visitor & Bounce Rate Mathematics", () => {
    const dayStart = new Date("2026-11-22T18:30:00.000Z");

    it("handles empty events list without throwing or NaN", () => {
      const routeStats = aggregateRouteStats([], dayStart);
      expect(routeStats).toEqual([]);

      const funnelStats = aggregateFunnelStats([], dayStart);
      expect(funnelStats).toEqual([]);
    });

    it("computes unique visitors as distinct sessionHash and accurate view count", () => {
      const events: RawTelemetryEvent[] = [
        {
          sessionHash: "sess_user_alpha",
          routeKey: "/creator/[username]",
          deviceType: "mobile",
          activeMs: 25000,
          maxScrollPct: 80,
          createdAt: new Date("2026-11-22T19:00:00.000Z"),
        },
        {
          sessionHash: "sess_user_alpha",
          routeKey: "/creator/[username]",
          deviceType: "mobile",
          activeMs: 35000,
          maxScrollPct: 90,
          createdAt: new Date("2026-11-22T19:10:00.000Z"),
        },
        {
          sessionHash: "sess_user_beta",
          routeKey: "/creator/[username]",
          deviceType: "desktop",
          activeMs: 40000,
          maxScrollPct: 50,
          createdAt: new Date("2026-11-22T19:15:00.000Z"),
        },
      ];

      const stats = aggregateRouteStats(events, dayStart);
      expect(stats).toHaveLength(1);

      const routeStat = stats[0]!;
      expect(routeStat.routeKey).toBe("/creator/[username]");
      expect(routeStat.uniqueVisitors).toBe(2); // alpha & beta
      expect(routeStat.pageViews).toBe(3);
      expect(routeStat.avgActiveMs).toBe(Math.round((25000 + 35000 + 40000) / 3)); // 33333
      expect(routeStat.avgScrollPct).toBe(Math.round((80 + 90 + 50) / 3)); // 73
      expect(routeStat.bounceBps).toBe(0); // neither bounced (both > 10s or multi-page)
    });

    it("accurately calculates bounce rate in basis points for single-page sessions < 10s", () => {
      expect(BOUNCE_THRESHOLD_MS).toBe(10000);

      const events: RawTelemetryEvent[] = [
        // Session 1: 1 view on route, activeMs = 5000 (<10s) -> BOUNCE
        {
          sessionHash: "sess_bounce_1",
          routeKey: "/",
          deviceType: "mobile",
          activeMs: 5000,
          maxScrollPct: 20,
          createdAt: fixedClock,
        },
        // Session 2: 1 view on route, activeMs = 12000 (>=10s) -> NOT a bounce
        {
          sessionHash: "sess_engaged_2",
          routeKey: "/",
          deviceType: "desktop",
          activeMs: 12000,
          maxScrollPct: 60,
          createdAt: fixedClock,
        },
        // Session 3: 2 views on route, activeMs = 4000 each -> NOT a bounce (multi-page session)
        {
          sessionHash: "sess_multi_3",
          routeKey: "/",
          deviceType: "mobile",
          activeMs: 4000,
          maxScrollPct: 40,
          createdAt: fixedClock,
        },
        {
          sessionHash: "sess_multi_3",
          routeKey: "/",
          deviceType: "mobile",
          activeMs: 4000,
          maxScrollPct: 40,
          createdAt: fixedClock,
        },
        // Session 4: 1 view on route, activeMs = 8000 (<10s) -> BOUNCE
        {
          sessionHash: "sess_bounce_4",
          routeKey: "/",
          deviceType: "tablet",
          activeMs: 8000,
          maxScrollPct: 15,
          createdAt: fixedClock,
        },
      ];

      const stats = aggregateRouteStats(events, dayStart);
      const homeStat = stats.find((s) => s.routeKey === "/")!;

      // 4 unique visitors: sess_bounce_1, sess_engaged_2, sess_multi_3, sess_bounce_4
      expect(homeStat.uniqueVisitors).toBe(4);
      expect(homeStat.pageViews).toBe(5);

      // Bounces: sess_bounce_1 (1 view, 5s) and sess_bounce_4 (1 view, 8s) = 2 bounces
      // bounceBps = Math.round((2 / 4) * 10000) = 5000 bps (50.00%)
      expect(homeStat.bounceBps).toBe(5000);
    });
  });

  // =========================================================================
  // 3. CONVERSION FUNNEL AGGREGATIONS
  // =========================================================================
  describe("3. Funnel Aggregations (signup, brand, creator)", () => {
    const dayStart = new Date("2026-11-22T18:30:00.000Z");

    it("aggregates signup, brand, and creator funnels accurately by session progression", () => {
      const events: RawTelemetryEvent[] = [
        // User 1: Full signup journey (landing -> register -> onboarding -> first_login)
        {
          sessionHash: "user_signup_complete",
          userId: "usr_01",
          routeKey: "/",
          deviceType: "mobile",
          activeMs: 15000,
          maxScrollPct: 80,
          createdAt: fixedClock,
        },
        {
          sessionHash: "user_signup_complete",
          userId: "usr_01",
          routeKey: "/auth",
          deviceType: "mobile",
          activeMs: 30000,
          maxScrollPct: 90,
          createdAt: fixedClock,
        },
        {
          sessionHash: "user_signup_complete",
          userId: "usr_01",
          routeKey: "/dashboard",
          deviceType: "mobile",
          activeMs: 40000,
          maxScrollPct: 100,
          createdAt: fixedClock,
        },

        // User 2: Drops off after landing
        {
          sessionHash: "user_drop_landing",
          routeKey: "/",
          deviceType: "desktop",
          activeMs: 3000,
          maxScrollPct: 10,
          createdAt: fixedClock,
        },

        // Brand session: Login -> Campaign Create -> Publish
        {
          sessionHash: "brand_session_01",
          userId: "brand_usr_01",
          role: "BRAND",
          routeKey: "/auth",
          deviceType: "desktop",
          activeMs: 20000,
          maxScrollPct: 50,
          createdAt: fixedClock,
        },
        {
          sessionHash: "brand_session_01",
          userId: "brand_usr_01",
          role: "BRAND",
          routeKey: "/dashboard/campaigns/create",
          deviceType: "desktop",
          activeMs: 60000,
          maxScrollPct: 95,
          createdAt: fixedClock,
        },
        {
          sessionHash: "brand_session_01",
          userId: "brand_usr_01",
          role: "BRAND",
          routeKey: "/dashboard/campaigns/[id]",
          deviceType: "desktop",
          activeMs: 25000,
          maxScrollPct: 85,
          createdAt: fixedClock,
        },

        // Creator session: Profile complete -> First application
        {
          sessionHash: "creator_session_01",
          userId: "creator_usr_01",
          role: "INFLUENCER",
          routeKey: "/creator/[username]",
          deviceType: "mobile",
          activeMs: 35000,
          maxScrollPct: 90,
          createdAt: fixedClock,
        },
        {
          sessionHash: "creator_session_01",
          userId: "creator_usr_01",
          role: "INFLUENCER",
          routeKey: "/dashboard/campaigns/[id]",
          deviceType: "mobile",
          activeMs: 45000,
          maxScrollPct: 70,
          createdAt: fixedClock,
        },
      ];

      const funnelResults = aggregateFunnelStats(events, dayStart);

      // Helper to lookup step sessions
      const getSessions = (funnel: string, step: string) =>
        funnelResults.find((f) => f.funnelKey === funnel && f.stepKey === step)?.sessions ?? 0;

      // Signup funnel: landing = 2 (user_signup_complete, user_drop_landing)
      expect(getSessions("signup", "landing")).toBe(2);
      expect(getSessions("signup", "register")).toBe(2); // user_signup_complete & brand_session_01 both visited /auth
      expect(getSessions("signup", "onboarding")).toBe(1);
      expect(getSessions("signup", "first_login")).toBe(1);

      // Brand funnel:
      expect(getSessions("brand", "login")).toBe(2); // user_signup_complete + brand_session_01 visited /auth
      expect(getSessions("brand", "campaign_create")).toBe(1);
      expect(getSessions("brand", "publish")).toBe(1);

      // Creator funnel:
      expect(getSessions("creator", "profile_complete")).toBe(1);
      expect(getSessions("creator", "first_application")).toBe(1);
    });
  });

  // =========================================================================
  // 3b. DEMOGRAPHIC & TRAFFIC BREAKDOWNS (DEVICE, ROLE, REFERRER)
  // =========================================================================
  describe("3b. aggregateTrafficBreakdowns (Pure Logic)", () => {
    it("handles empty event stream without errors", () => {
      const results = aggregateTrafficBreakdowns([], new Date());
      expect(results).toEqual([]);
    });

    it("aggregates device, role, and referrer breakdowns across unique sessions and page views", () => {
      const dayStart = new Date("2026-11-22T18:30:00.000Z");
      const events: RawTelemetryEvent[] = [
        {
          sessionHash: "s1",
          routeKey: "/",
          deviceType: "desktop",
          role: "BRAND",
          referrerHost: "google.com",
          activeMs: 10000,
          maxScrollPct: 50,
          createdAt: dayStart,
        },
        {
          sessionHash: "s1",
          routeKey: "/campaigns",
          deviceType: "desktop",
          role: "BRAND",
          referrerHost: "google.com",
          activeMs: 20000,
          maxScrollPct: 80,
          createdAt: dayStart,
        },
        {
          sessionHash: "s2",
          routeKey: "/creator/demo",
          deviceType: "mobile",
          role: null, // Anonymous
          referrerHost: null, // Direct
          activeMs: 15000,
          maxScrollPct: 60,
          createdAt: dayStart,
        },
      ];

      const breakdowns = aggregateTrafficBreakdowns(events, dayStart);

      // Devices
      const desktop = breakdowns.find((b) => b.dimension === "device" && b.key === "desktop")!;
      expect(desktop).toBeDefined();
      expect(desktop.visitors).toBe(1); // session s1
      expect(desktop.pageViews).toBe(2);

      const mobile = breakdowns.find((b) => b.dimension === "device" && b.key === "mobile")!;
      expect(mobile).toBeDefined();
      expect(mobile.visitors).toBe(1);
      expect(mobile.pageViews).toBe(1);

      // Roles
      const brand = breakdowns.find((b) => b.dimension === "role" && b.key === "BRAND")!;
      expect(brand).toBeDefined();
      expect(brand.visitors).toBe(1);
      expect(brand.pageViews).toBe(2);

      const anon = breakdowns.find((b) => b.dimension === "role" && b.key === "ANONYMOUS")!;
      expect(anon).toBeDefined();
      expect(anon.visitors).toBe(1);
      expect(anon.pageViews).toBe(1);

      // Referrers
      const google = breakdowns.find((b) => b.dimension === "referrer" && b.key === "google.com")!;
      expect(google).toBeDefined();
      expect(google.visitors).toBe(1);
      expect(google.pageViews).toBe(2);

      const direct = breakdowns.find((b) => b.dimension === "referrer" && b.key === "direct")!;
      expect(direct).toBeDefined();
      expect(direct.visitors).toBe(1);
      expect(direct.pageViews).toBe(1);
    });
  });

  // =========================================================================
  // 4. IDEMPOTENT RE-RUN & ROLLUP SERVICE
  // =========================================================================
  describe("4. Idempotent Rollup Service", () => {
    it("performs idempotent upserts for route and funnel stats without duplication", async () => {
      const mockRawEvents = [
        {
          id: "evt_1",
          sessionHash: "sess_alpha",
          userId: "usr_1",
          role: "CREATOR",
          routeKey: "/creator/[username]",
          targetInfluencerId: "clh_inf_1",
          targetCampaignId: null,
          deviceType: "mobile",
          referrerHost: "instagram.com",
          activeMs: 45000,
          maxScrollPct: 80,
          createdAt: fixedClock,
        },
      ];

      vi.spyOn(prisma.pageViewEvent, "findMany").mockResolvedValue(
        mockRawEvents as unknown as import("@prisma/client").PageViewEvent[]
      );
      const upsertRouteSpy = vi.spyOn(prisma.dailyRouteStat, "upsert").mockResolvedValue(
        {} as unknown as import("@prisma/client").DailyRouteStat
      );
      const upsertFunnelSpy = vi.spyOn(prisma.dailyFunnelStat, "upsert").mockResolvedValue(
        {} as unknown as import("@prisma/client").DailyFunnelStat
      );
      const upsertBreakdownSpy = vi.spyOn(prisma.dailyTrafficBreakdown, "upsert").mockResolvedValue(
        {} as unknown as import("@prisma/client").DailyTrafficBreakdown
      );

      // First execution
      const run1 = await TelemetryRollupService.rollupDailyStats(fixedClock);
      expect(run1.processedEvents).toBe(1);
      expect(upsertRouteSpy).toHaveBeenCalledTimes(1);
      expect(upsertBreakdownSpy).toHaveBeenCalled();

      // Verify exact compound key in upsert
      expect(upsertRouteSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            date_routeKey: {
              date: run1.dayStart,
              routeKey: "/creator/[username]",
            },
          },
        })
      );

      // Second execution (re-run of identical time window)
      upsertRouteSpy.mockClear();
      upsertFunnelSpy.mockClear();

      const run2 = await TelemetryRollupService.rollupDailyStats(fixedClock);
      expect(run2.processedEvents).toBe(1);
      expect(run2.date).toBe(run1.date);
      expect(upsertRouteSpy).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // 5. BATCH BOUNDARIES (REDIS QUEUE FLUSH)
  // =========================================================================
  describe("5. Batch Boundaries & Queue Flushing", () => {
    it("batch-pops and inserts up to specified batch limit from Redis list", async () => {
      const queuedItems = [
        JSON.stringify({
          sessionHash: "hash_01",
          routeKey: "/",
          deviceType: "mobile",
          activeMs: 5000,
          maxScrollPct: 30,
          createdAt: fixedClock.toISOString(),
        }),
        JSON.stringify({
          sessionHash: "hash_02",
          routeKey: "/auth",
          deviceType: "desktop",
          activeMs: 15000,
          maxScrollPct: 60,
          createdAt: fixedClock.toISOString(),
        }),
      ];

      let popIdx = 0;
      vi.spyOn(redis, "lpop").mockImplementation(async () => {
        if (popIdx < queuedItems.length) {
          const item = queuedItems[popIdx]!;
          popIdx++;
          return item;
        }
        return null;
      });

      vi.spyOn(redis, "llen").mockResolvedValue(0);
      const createManySpy = vi.spyOn(prisma.pageViewEvent, "createMany").mockResolvedValue({ count: 2 });

      const result = await TelemetryRollupService.flushRedisEventsToDatabase(500);

      expect(result.flushedCount).toBe(2);
      expect(result.remainingInQueue).toBe(0);
      expect(createManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ sessionHash: "hash_01", routeKey: "/" }),
            expect.objectContaining({ sessionHash: "hash_02", routeKey: "/auth" }),
          ]),
        })
      );
    });

    it("respects batch size limit when queue has more items than batchSize", async () => {
      vi.spyOn(redis, "lpop").mockResolvedValue(
        JSON.stringify({
          sessionHash: "hash_batch_item",
          routeKey: "/creator/[username]",
          deviceType: "mobile",
          activeMs: 8000,
          maxScrollPct: 40,
        })
      );
      vi.spyOn(redis, "llen").mockResolvedValue(250);
      vi.spyOn(prisma.pageViewEvent, "createMany").mockResolvedValue({ count: 10 });

      const result = await TelemetryRollupService.flushRedisEventsToDatabase(10);

      expect(result.flushedCount).toBe(10);
      expect(result.batchLimit).toBe(10);
      expect(result.remainingInQueue).toBe(250);
      expect(redis.lpop).toHaveBeenCalledTimes(10);
    });

    it("skips unparseable JSON entries safely without dropping valid entries", async () => {
      const items = [
        "not-a-valid-json-string{",
        JSON.stringify({ sessionHash: "valid_hash", routeKey: "/dashboard", activeMs: 1000 }),
      ];

      let idx = 0;
      vi.spyOn(redis, "lpop").mockImplementation(async () => {
        if (idx < items.length) {
          const item = items[idx]!;
          idx++;
          return item;
        }
        return null;
      });
      vi.spyOn(redis, "llen").mockResolvedValue(0);
      const createManySpy = vi.spyOn(prisma.pageViewEvent, "createMany").mockResolvedValue({ count: 1 });

      const result = await TelemetryRollupService.flushRedisEventsToDatabase(50);
      expect(result.flushedCount).toBe(1);
      expect(createManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [expect.objectContaining({ sessionHash: "valid_hash", routeKey: "/dashboard" })],
        })
      );
    });
  });

  // =========================================================================
  // 6. 30-DAY RETENTION PURGE
  // =========================================================================
  describe("6. Telemetry Retention Purge (> 30 Days)", () => {
    it("deletes only records older than 30-day cutoff date", async () => {
      const deleteManySpy = vi.spyOn(prisma.pageViewEvent, "deleteMany").mockResolvedValue({ count: 1420 });

      const result = await TelemetryRollupService.purgeOldTelemetryEvents(30, fixedClock);

      expect(result.deletedCount).toBe(1420);
      expect(result.retentionDays).toBe(30);

      const expectedCutoff = new Date(fixedClock.getTime() - 30 * 24 * 60 * 60 * 1000);
      expect(result.cutoffDate.toISOString()).toBe(expectedCutoff.toISOString());

      expect(deleteManySpy).toHaveBeenCalledWith({
        where: {
          createdAt: {
            lt: expectedCutoff,
          },
        },
      });
    });
  });
});
