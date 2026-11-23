import { describe, it, expect, vi, beforeEach } from "vitest";
import { AdminAnalyticsService } from "@/services/admin-analytics.service";
import prisma from "@/lib/db";
import { csvEsc, buildReportFilename } from "@/lib/csv-export";
import { requireActiveAdmin } from "@/lib/admin-auth";
import { formatIstDateKey } from "@/lib/report-meta";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/cache", () => ({
  cache: vi.fn((_key: string, fetcher: () => Promise<unknown>) => fetcher()),
}));

describe("Admin Platform Traffic Report & Report Standard Compliance", () => {
  const fixedNow = new Date("2026-11-22T10:00:00.000Z");

  const mockAdminUser = {
    id: "usr_admin_001",
    name: "Platform Chief Auditor",
    email: "auditor@vyaparmedia.in",
    role: "ADMIN",
  };

  const mockNonAdminUser = {
    id: "usr_brand_001",
    name: "Brand Marketer",
    email: "marketer@brandcorp.in",
    role: "BRAND",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. AUTHORIZATION MATRIX (ADMIN-ONLY VIA requireActiveAdmin)
  // =========================================================================
  describe("1. Authorization Matrix", () => {
    it("allows active administrator access", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: mockAdminUser.id,
        userType: "ADMIN",
        status: "ACTIVE",
        deletedAt: null,
        email: mockAdminUser.email,
      } as unknown as import("@prisma/client").User);

      const user = await requireActiveAdmin({
        id: mockAdminUser.id,
        email: mockAdminUser.email,
        userType: "ADMIN",
      });
      expect(user.id).toBe(mockAdminUser.id);
      expect(user.email).toBe(mockAdminUser.email);
    });

    it("strictly blocks non-admin callers from accessing report service", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: mockNonAdminUser.id,
        userType: "BRAND",
        status: "ACTIVE",
        deletedAt: null,
        email: mockNonAdminUser.email,
      } as unknown as import("@prisma/client").User);

      await expect(
        requireActiveAdmin({
          id: mockNonAdminUser.id,
          email: mockNonAdminUser.email,
          userType: "BRAND",
        })
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // 2. PERFORMANCE GUARANTEE: READS ROLLUP TABLES ONLY
  // =========================================================================
  describe("2. Rollup Table Only Guarantee (Never Scans PageViewEvent for Multi-Day)", () => {
    it("queries DailyRouteStat, DailyFunnelStat, and DailyTrafficBreakdown without hitting PageViewEvent", async () => {
      const routeSpy = vi.spyOn(prisma.dailyRouteStat, "findMany").mockResolvedValue([
        {
          date: new Date("2026-11-20"),
          routeKey: "/campaigns",
          uniqueVisitors: 450,
          pageViews: 1200,
          avgActiveMs: 35000,
          avgScrollPct: 75,
          bounceBps: 1500,
        },
      ] as unknown as import("@prisma/client").DailyRouteStat[]);

      const funnelSpy = vi.spyOn(prisma.dailyFunnelStat, "findMany").mockResolvedValue([
        {
          date: new Date("2026-11-20"),
          funnelKey: "signup",
          stepKey: "landing",
          sessions: 800,
        },
      ] as unknown as import("@prisma/client").DailyFunnelStat[]);

      const breakdownSpy = vi.spyOn(prisma.dailyTrafficBreakdown, "findMany").mockResolvedValue([
        {
          date: new Date("2026-11-20"),
          dimension: "device",
          key: "mobile",
          visitors: 600,
          pageViews: 1500,
        },
      ] as unknown as import("@prisma/client").DailyTrafficBreakdown[]);

      const rawPageViewSpy = vi.spyOn(prisma.pageViewEvent, "findMany");

      const result = await AdminAnalyticsService.getTrafficAndBehaviour(30, mockAdminUser);

      // Rollup tables must be queried
      expect(routeSpy).toHaveBeenCalled();
      expect(funnelSpy).toHaveBeenCalled();
      expect(breakdownSpy).toHaveBeenCalled();

      // Raw unaggregated events table must NEVER be queried for multi-day reporting
      expect(rawPageViewSpy).not.toHaveBeenCalled();

      expect(result.data.range).toBe(30);
      expect(result.data.topRoutes).toHaveLength(1);
      expect(result.data.topRoutes[0]!.routeKey).toBe("/campaigns");
    });
  });

  // =========================================================================
  // 3. REPORT STANDARD V3 COMPLIANCE
  // =========================================================================
  describe("3. Report Standard Metadata, Integrity & Privacy", () => {
    it("generates deterministic Report ID matching VM-TRAFFIC-YYYYMMDD-[A-Z2-7]{6}", async () => {
      vi.spyOn(prisma.dailyRouteStat, "findMany").mockResolvedValue([]);
      vi.spyOn(prisma.dailyFunnelStat, "findMany").mockResolvedValue([]);
      vi.spyOn(prisma.dailyTrafficBreakdown, "findMany").mockResolvedValue([]);

      const result = await AdminAnalyticsService.getTrafficAndBehaviour(7, mockAdminUser);
      const meta = result.meta;

      const dateKey = formatIstDateKey(new Date());
      const regex = new RegExp(`^VM-TRAFFIC-${dateKey}-[A-Z2-7]{6}$`);

      expect(meta.reportId).toMatch(regex);
      expect(meta.type).toBe("TRAFFIC");
      expect(meta.scope).toBe("Platform Traffic & User Behaviour");
    });

    it("masks user email address in exported metadata for privacy", async () => {
      vi.spyOn(prisma.dailyRouteStat, "findMany").mockResolvedValue([]);
      vi.spyOn(prisma.dailyFunnelStat, "findMany").mockResolvedValue([]);
      vi.spyOn(prisma.dailyTrafficBreakdown, "findMany").mockResolvedValue([]);

      const result = await AdminAnalyticsService.getTrafficAndBehaviour(90, {
        id: "usr_superadmin",
        name: "Super Administrator",
        email: "super.admin@vyaparmedia.in",
        role: "ADMIN",
      });

      expect(result.meta.user.maskedEmail).toBe("s***@vyaparmedia.in");
    });

    it("produces SHA-256 payload integrity hash of canonical JSON", async () => {
      vi.spyOn(prisma.dailyRouteStat, "findMany").mockResolvedValue([]);
      vi.spyOn(prisma.dailyFunnelStat, "findMany").mockResolvedValue([]);
      vi.spyOn(prisma.dailyTrafficBreakdown, "findMany").mockResolvedValue([]);

      const result = await AdminAnalyticsService.getTrafficAndBehaviour(30, mockAdminUser);
      expect(result.meta.integrityCode).toHaveLength(64);
      expect(result.meta.integrityCode).toMatch(/^[0-9a-f]{64}$/);
    });

    it("states data quality accurately: verified vs estimated bounce rates", async () => {
      vi.spyOn(prisma.dailyRouteStat, "findMany").mockResolvedValue([]);
      vi.spyOn(prisma.dailyFunnelStat, "findMany").mockResolvedValue([]);
      vi.spyOn(prisma.dailyTrafficBreakdown, "findMany").mockResolvedValue([]);

      const result = await AdminAnalyticsService.getTrafficAndBehaviour(30, mockAdminUser);
      expect(result.meta.dataQualitySummary?.verifiedPercent).toBe(95);
      expect(result.meta.dataQualitySummary?.estimatedPercent).toBe(5);
      expect(result.meta.dataQualitySummary?.selfReportedPercent).toBe(0);
      expect(result.meta.dataQualitySummary?.text).toContain("Bounce heuristic");
    });
  });

  // =========================================================================
  // 4. CSV EXPORT & FORMULA INJECTION SANITIZATION
  // =========================================================================
  describe("4. CSV Export Format & Formula Injection Safety", () => {
    it("generates canonical filename matching VyaparMedia-Traffic-Platform-YYYYMMDD.csv", () => {
      const filename = buildReportFilename("Traffic", "Platform", fixedNow);
      expect(filename).toBe("VyaparMedia-Traffic-Platform-20261122.csv");
    });

    it("prevents formula injection in CSV cells starting with =, +, -, @", () => {
      expect(csvEsc("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
      expect(csvEsc("+1234567890")).toBe("'+1234567890");
      expect(csvEsc("-cmd.exe")).toBe("'-cmd.exe");
      expect(csvEsc("@calc")).toBe("'@calc");
      expect(csvEsc("Normal /campaigns/create")).toBe("Normal /campaigns/create");
    });
  });
});
