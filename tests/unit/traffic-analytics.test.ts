import { describe, it, expect } from "vitest";
import {
  parseTrafficRange,
  getTrafficDateRange,
  aggregateMultiDayRoutes,
  aggregateMultiDayFunnels,
  aggregateMultiDayBreakdowns,
  calculateTrafficSummaryKpis,
  type RouteStatInput,
  type FunnelStatInput,
  type BreakdownStatInput,
} from "@/lib/traffic-analytics";

describe("Platform Traffic & Behaviour Analytics (Pure Logic Suite)", () => {
  const fixedNow = new Date("2026-11-22T10:00:00.000Z"); // 15:30 IST

  // =========================================================================
  // 1. RANGE PARSER (TABLE-DRIVEN)
  // =========================================================================
  describe("1. parseTrafficRange", () => {
    const cases: Array<{ input: string | null | undefined; expected: 7 | 30 | 90 }> = [
      { input: "7", expected: 7 },
      { input: "7d", expected: 7 },
      { input: "7D", expected: 7 },
      { input: "30", expected: 30 },
      { input: "30d", expected: 30 },
      { input: "90", expected: 90 },
      { input: "90d", expected: 90 },
      { input: null, expected: 30 },
      { input: undefined, expected: 30 },
      { input: "", expected: 30 },
      { input: "invalid_input", expected: 30 },
      { input: "14", expected: 30 }, // Unrecognized range falls back to default 30
    ];

    cases.forEach(({ input, expected }) => {
      it(`parses "${input}" to ${expected} days`, () => {
        expect(parseTrafficRange(input)).toBe(expected);
      });
    });
  });

  // =========================================================================
  // 2. ASIA/KOLKATA DATE RANGE BOUNDS
  // =========================================================================
  describe("2. getTrafficDateRange (Asia/Kolkata Explicit)", () => {
    it("computes exact 7-day bounds in Asia/Kolkata", () => {
      const range = getTrafficDateRange(7, fixedNow);
      expect(range.days).toBe(7);
      expect(range.label).toContain("7 Days");
      expect(range.label).toContain("IST");

      // Difference in days between start and end
      const diffMs = range.endDate.getTime() - range.startDate.getTime();
      const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
      expect(diffDays).toBe(7);
    });

    it("computes exact 30-day bounds in Asia/Kolkata", () => {
      const range = getTrafficDateRange(30, fixedNow);
      expect(range.days).toBe(30);

      const diffMs = range.endDate.getTime() - range.startDate.getTime();
      const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
      expect(diffDays).toBe(30);
    });

    it("computes exact 90-day bounds in Asia/Kolkata", () => {
      const range = getTrafficDateRange(90, fixedNow);
      expect(range.days).toBe(90);

      const diffMs = range.endDate.getTime() - range.startDate.getTime();
      const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
      expect(diffDays).toBe(90);
    });

    it("produces deterministic output across repeated runs with identical clock", () => {
      const r1 = getTrafficDateRange(30, fixedNow);
      const r2 = getTrafficDateRange(30, fixedNow);

      expect(r1.startDate.toISOString()).toBe(r2.startDate.toISOString());
      expect(r1.endDate.toISOString()).toBe(r2.endDate.toISOString());
      expect(r1.label).toBe(r2.label);
    });
  });

  // =========================================================================
  // 3. MULTI-DAY ROUTE AGGREGATION & WEIGHTED METRICS
  // =========================================================================
  describe("3. aggregateMultiDayRoutes", () => {
    it("returns empty array when given empty input", () => {
      expect(aggregateMultiDayRoutes([])).toEqual([]);
    });

    it("computes weighted averages of activeMs, scrollPct, and bounceBps across multi-day rollups", () => {
      const rows: RouteStatInput[] = [
        // Day 1 for /dashboard: 100 views, avgActive: 20s (20000ms), scroll: 50%, bounce: 2000 bps (20%), unique: 80
        {
          date: new Date("2026-11-20T00:00:00.000Z"),
          routeKey: "/dashboard",
          uniqueVisitors: 80,
          pageViews: 100,
          avgActiveMs: 20000,
          avgScrollPct: 50,
          bounceBps: 2000,
        },
        // Day 2 for /dashboard: 300 views, avgActive: 40s (40000ms), scroll: 70%, bounce: 1000 bps (10%), unique: 200
        {
          date: new Date("2026-11-21T00:00:00.000Z"),
          routeKey: "/dashboard",
          uniqueVisitors: 200,
          pageViews: 300,
          avgActiveMs: 40000,
          avgScrollPct: 70,
          bounceBps: 1000,
        },
        // Day 1 for /campaigns: 50 views
        {
          date: new Date("2026-11-20T00:00:00.000Z"),
          routeKey: "/campaigns",
          uniqueVisitors: 40,
          pageViews: 50,
          avgActiveMs: 15000,
          avgScrollPct: 40,
          bounceBps: 4000,
        },
      ];

      const result = aggregateMultiDayRoutes(rows);

      // Must be sorted by total page views descending (/dashboard has 400, /campaigns has 50)
      expect(result).toHaveLength(2);
      expect(result[0]!.routeKey).toBe("/dashboard");
      expect(result[1]!.routeKey).toBe("/campaigns");

      const dash = result[0]!;
      expect(dash.pageViews).toBe(400);
      expect(dash.uniqueVisitors).toBe(280);

      // Weighted avgActiveMs: (20000*100 + 40000*300) / 400 = (2000000 + 12000000) / 400 = 35000 ms
      expect(dash.avgActiveMs).toBe(35000);

      // Weighted avgScrollPct: (50*100 + 70*300) / 400 = (5000 + 21000) / 400 = 65%
      expect(dash.avgScrollPct).toBe(65);

      // Weighted bounceBps: (2000*80 + 1000*200) / 280 = (160000 + 200000) / 280 = 360000 / 280 = 1286 bps
      expect(dash.bounceBps).toBe(1286);
      expect(dash.bouncePercent).toBe(12.9);
      expect(dash.dataQuality).toBe("VERIFIED");
    });
  });

  // =========================================================================
  // 4. CONVERSION FUNNEL MULTI-DAY AGGREGATION & DROP-OFF %
  // =========================================================================
  describe("4. aggregateMultiDayFunnels", () => {
    it("correctly aggregates signup, brand, and creator funnels with step drop-offs", () => {
      const rows: FunnelStatInput[] = [
        // Signup Funnel - Day 1
        { date: new Date("2026-11-20"), funnelKey: "signup", stepKey: "landing", sessions: 1000 },
        { date: new Date("2026-11-20"), funnelKey: "signup", stepKey: "register", sessions: 400 },
        { date: new Date("2026-11-20"), funnelKey: "signup", stepKey: "onboarding", sessions: 250 },
        { date: new Date("2026-11-20"), funnelKey: "signup", stepKey: "first_login", sessions: 200 },
        // Signup Funnel - Day 2
        { date: new Date("2026-11-21"), funnelKey: "signup", stepKey: "landing", sessions: 1000 },
        { date: new Date("2026-11-21"), funnelKey: "signup", stepKey: "register", sessions: 600 },
        { date: new Date("2026-11-21"), funnelKey: "signup", stepKey: "onboarding", sessions: 450 },
        { date: new Date("2026-11-21"), funnelKey: "signup", stepKey: "first_login", sessions: 400 },

        // Brand Funnel - Day 1
        { date: new Date("2026-11-20"), funnelKey: "brand", stepKey: "login", sessions: 500 },
        { date: new Date("2026-11-20"), funnelKey: "brand", stepKey: "campaign_create", sessions: 200 },
        { date: new Date("2026-11-20"), funnelKey: "brand", stepKey: "publish", sessions: 100 },
      ];

      const funnels = aggregateMultiDayFunnels(rows);

      expect(funnels).toHaveLength(3); // signup, brand, creator

      // 1. Signup Funnel
      const signup = funnels.find((f) => f.funnelKey === "signup")!;
      expect(signup).toBeDefined();
      expect(signup.totalSessions).toBe(2000); // 1000 + 1000 landing
      expect(signup.completedSessions).toBe(600); // 200 + 400 first_login
      expect(signup.completionRatePercent).toBe(30); // 600 / 2000 = 30%

      const [step1, step2, step3, step4] = signup.steps;
      // Landing: step 0 has 0 drop-off, 100% conversion
      expect(step1!.sessions).toBe(2000);
      expect(step1!.dropOffPercent).toBe(0);
      expect(step1!.conversionPercent).toBe(100);

      // Register: 1000 sessions. Drop-off from 2000 = 50%
      expect(step2!.sessions).toBe(1000);
      expect(step2!.dropOffPercent).toBe(50);
      expect(step2!.conversionPercent).toBe(50);

      // Onboarding: 700 sessions. Drop-off from 1000 = 30%
      expect(step3!.sessions).toBe(700);
      expect(step3!.dropOffPercent).toBe(30);
      expect(step3!.conversionPercent).toBe(35); // 700 / 2000 = 35%

      // First login: 600 sessions. Drop-off from 700 = (100 / 700) = 14.3%
      expect(step4!.sessions).toBe(600);
      expect(step4!.dropOffPercent).toBe(14.3);
      expect(step4!.conversionPercent).toBe(30); // 600 / 2000 = 30%

      // 2. Brand Funnel
      const brand = funnels.find((f) => f.funnelKey === "brand")!;
      expect(brand.totalSessions).toBe(500);
      expect(brand.completedSessions).toBe(100);
      expect(brand.completionRatePercent).toBe(20);

      // 3. Creator Funnel (No data provided: safe zeroes)
      const creator = funnels.find((f) => f.funnelKey === "creator")!;
      expect(creator.totalSessions).toBe(0);
      expect(creator.completedSessions).toBe(0);
      expect(creator.completionRatePercent).toBe(0);
    });
  });

  // =========================================================================
  // 5. DEMOGRAPHIC & TRAFFIC BREAKDOWNS (DEVICE, ROLE, REFERRER)
  // =========================================================================
  describe("5. aggregateMultiDayBreakdowns", () => {
    it("computes accurate percentage shares across device types, roles, and referrers", () => {
      const rows: BreakdownStatInput[] = [
        // Devices
        { date: new Date("2026-11-20"), dimension: "device", key: "mobile", visitors: 700, pageViews: 1400 },
        { date: new Date("2026-11-21"), dimension: "device", key: "mobile", visitors: 800, pageViews: 1600 },
        { date: new Date("2026-11-20"), dimension: "device", key: "desktop", visitors: 400, pageViews: 800 },
        { date: new Date("2026-11-21"), dimension: "device", key: "desktop", visitors: 100, pageViews: 200 },

        // Roles
        { date: new Date("2026-11-20"), dimension: "role", key: "BRAND", visitors: 300, pageViews: 1000 },
        { date: new Date("2026-11-20"), dimension: "role", key: "CREATOR", visitors: 500, pageViews: 1500 },
        { date: new Date("2026-11-20"), dimension: "role", key: "ANONYMOUS", visitors: 1000, pageViews: 1500 },

        // Referrers
        { date: new Date("2026-11-20"), dimension: "referrer", key: "direct", visitors: 800, pageViews: 2000 },
        { date: new Date("2026-11-20"), dimension: "referrer", key: "instagram.com", visitors: 400, pageViews: 1000 },
        { date: new Date("2026-11-20"), dimension: "referrer", key: "google.com", visitors: 400, pageViews: 1000 },
      ];

      const { devices, roles, referrers } = aggregateMultiDayBreakdowns(rows);

      // Devices: mobile = 3000 views, desktop = 1000 views. Total = 4000 views.
      expect(devices).toHaveLength(2);
      expect(devices[0]!.key).toBe("mobile");
      expect(devices[0]!.pageViews).toBe(3000);
      expect(devices[0]!.visitors).toBe(1500);
      expect(devices[0]!.percentShare).toBe(75); // 3000 / 4000 = 75%
      expect(devices[1]!.key).toBe("desktop");
      expect(devices[1]!.percentShare).toBe(25); // 1000 / 4000 = 25%

      // Roles: Total = 4000 views.
      expect(roles).toHaveLength(3);
      const brand = roles.find((r) => r.key === "BRAND")!;
      expect(brand.percentShare).toBe(25); // 1000 / 4000 = 25%

      // Referrers: Total = 4000 views.
      expect(referrers).toHaveLength(3);
      expect(referrers[0]!.key).toBe("direct");
      expect(referrers[0]!.percentShare).toBe(50); // 2000 / 4000 = 50%
    });
  });

  // =========================================================================
  // 6. EXECUTIVE TRAFFIC SUMMARY KPIS
  // =========================================================================
  describe("6. calculateTrafficSummaryKpis", () => {
    it("computes consolidated platform metrics and attaches data quality flag", () => {
      const routes = aggregateMultiDayRoutes([
        {
          date: new Date("2026-11-20"),
          routeKey: "/",
          uniqueVisitors: 500,
          pageViews: 1000,
          avgActiveMs: 30000,
          avgScrollPct: 60,
          bounceBps: 2000,
        },
        {
          date: new Date("2026-11-20"),
          routeKey: "/campaigns",
          uniqueVisitors: 500,
          pageViews: 1000,
          avgActiveMs: 50000,
          avgScrollPct: 80,
          bounceBps: 1000,
        },
      ]);

      const summary = calculateTrafficSummaryKpis(routes, []);

      expect(summary.totalPageViews).toBe(2000);
      expect(summary.totalUniqueVisitors).toBe(1000);
      // Avg active: (30000*1000 + 50000*1000) / 2000 = 40000ms = 40s
      expect(summary.avgActiveMs).toBe(40000);
      expect(summary.avgActiveSec).toBe(40);
      // Avg scroll: (60*1000 + 80*1000) / 2000 = 70%
      expect(summary.avgScrollPct).toBe(70);
      // Bounce: (2000*500 + 1000*500) / 1000 = 1500 bps = 15%
      expect(summary.bounceBps).toBe(1500);
      expect(summary.bouncePercent).toBe(15);

      // Data quality summary compliance
      expect(summary.dataQualitySummary.verifiedPercent).toBe(95);
      expect(summary.dataQualitySummary.estimatedPercent).toBe(5);
      expect(summary.dataQualitySummary.text).toContain("Estimated (Bounce heuristic");
    });
  });
});
