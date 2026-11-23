import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import prisma from "@/lib/db";
import { MarketRangeReportService, MarketRangeReportData } from "@/services/market-range-report.service";
import { FairPriceService } from "@/services/fair-price.service";
import { PricingConfigService } from "@/services/pricing-config.service";
import { ReportVerificationService } from "@/services/report-verification.service";
import { MarketRangeReportView } from "@/components/reports/MarketRangeReportView";
import { PLATFORM_CONFIG } from "@/lib/platform-config";
import * as featureFlagsModule from "@/lib/feature-flags";
import * as auditModule from "@/lib/audit";
import { MetricViewsQuality } from "@prisma/client";
import { AppError } from "@/lib/errors";

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe("Market Range Report Service & Standard Compliance (Report Standard v3)", () => {
  const fixedClock = new Date("2026-11-22T10:00:00.000Z");

  const mockCreatorUser = {
    id: "user_priya_1",
    userType: "INFLUENCER",
    name: "Priya Sharma",
    email: "priya.sharma@example.com",
  };

  const mockOtherUser = {
    id: "user_hacker_2",
    userType: "INFLUENCER",
    name: "Ravi Kumar",
    email: "ravi.kumar@example.com",
  };

  const mockAdminUser = {
    id: "user_admin_super",
    userType: "ADMIN",
    name: "Platform Auditor",
    email: "auditor@vyaparmedia.in",
  };

  const mockInfluencerId = "inf_priya_100";

  const mockInfluencerProfile = {
    id: mockInfluencerId,
    userId: mockCreatorUser.id,
    displayName: "Priya Sharma",
    instagramHandle: "priyacreates",
    youtubeHandle: "priyasharma_vlogs",
    categories: "lifestyle, fashion",
    primaryPlatform: "INSTAGRAM",
    instagramFollowers: 120000,
    youtubeSubscribers: 45000,
    followerAuthenticityScore: 88,
    user: {
      name: "Priya Sharma",
      email: "priya.sharma@example.com",
      trustScore: 780,
    },
  };

  const mockSnapshots = [
    {
      id: "snap_1",
      influencerId: mockInfluencerId,
      capturedAt: new Date("2026-11-15T00:00:00.000Z"),
      platform: "INSTAGRAM",
      followers: 120000,
      avgViews: 45000,
      engagementRateBps: 340,
      viewsQuality: MetricViewsQuality.API,
      tier: "MACRO",
    },
    {
      id: "snap_2",
      influencerId: mockInfluencerId,
      capturedAt: new Date("2026-11-08T00:00:00.000Z"),
      platform: "INSTAGRAM",
      followers: 118000,
      avgViews: 38000,
      engagementRateBps: 310,
      viewsQuality: MetricViewsQuality.UNAVAILABLE,
      tier: "MACRO",
    },
  ];

  const mockEvaluation = {
    profile: {
      id: mockInfluencerId,
      fairRateMinPaise: 1500000,
      fairRateMaxPaise: 2500000,
      confidence: "HIGH",
      dataQuality: "VERIFIED",
    },
    evaluation: {
      id: "eval_mock_1",
      influencerId: mockInfluencerId,
      platform: "INSTAGRAM",
      contentType: "REEL",
      basePaise: 2000000,
      minPaise: 1500000,
      maxPaise: 2500000,
      expectedViews: 45000,
      viewStatistic: "MEDIAN",
      confidence: "HIGH",
      dataQuality: "VERIFIED" as const,
      flags: ["LOW_ENGAGEMENT"],
      explanation: [
        {
          step: "BASE_VIEWS",
          description: "Median of recent 12 posts: 45,000 views",
          contributionPaise: 1800000,
          runningTotalPaise: 1800000,
        },
        {
          step: "ENGAGEMENT_MULT",
          description: "High engagement boost (+10%)",
          multiplier: 1.1,
          contributionPaise: 200000,
          runningTotalPaise: 2000000,
        },
      ],
      engineVersion: "1.0.0",
      configVersion: 1,
      createdAt: fixedClock,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default feature flag enabled
    vi.spyOn(featureFlagsModule, "assertFeatureEnabled").mockResolvedValue(true as never);

    // Prisma mocks
    vi.spyOn(prisma.influencerProfile, "findUnique").mockResolvedValue(
      mockInfluencerProfile as unknown as import("@prisma/client").InfluencerProfile & {
        user: { email: string; name: string | null; trustScore: number };
      }
    );
    vi.spyOn(prisma.creatorMetricSnapshot, "findMany").mockResolvedValue(
      mockSnapshots as unknown as import("@prisma/client").CreatorMetricSnapshot[]
    );

    // Fair Price Service evaluation mock
    vi.spyOn(FairPriceService, "evaluateInfluencer").mockResolvedValue(
      mockEvaluation as unknown as Awaited<ReturnType<typeof FairPriceService.evaluateInfluencer>>
    );

    // Active pricing config version mock
    vi.spyOn(PricingConfigService, "getActivePricingConfig").mockResolvedValue({
      version: 1,
      config: {} as unknown as import("@/services/pricing-config.service").StoredPricingConfig,
    });

    // Verification service record mock
    vi.spyOn(ReportVerificationService, "recordReport").mockResolvedValue(undefined);

    // Audit logs mock
    vi.spyOn(auditModule, "createAuditLog").mockResolvedValue({} as unknown as import("@prisma/client").AuditLog);
    vi.spyOn(auditModule, "createActivityLog").mockResolvedValue({} as unknown as import("@prisma/client").ActivityLog);
  });

  describe("Section 10 Report Standard Compliance", () => {
    it("generates deterministic Report ID format (VM-RANGE-<YYYYMMDD>-<6 char Base32>)", async () => {
      const report = await MarketRangeReportService.generateReport(
        mockCreatorUser,
        mockInfluencerId,
        { clock: fixedClock }
      );

      // Report ID format: VM-RANGE-YYYYMMDD-XXXXXX
      expect(report.reportMeta.reportId).toMatch(/^VM-RANGE-20261122-[2-7A-Z]{6}$/);
      expect(report.reportMeta.type).toBe("RANGE");
      expect(report.reportMeta.period).toBe("Past 12 Weeks Assessment");
      expect(report.reportMeta.scope).toBe("@priyacreates");
    });

    it("masks user email according to Report Standard (p***@example.com)", async () => {
      const report = await MarketRangeReportService.generateReport(
        mockCreatorUser,
        mockInfluencerId,
        { clock: fixedClock }
      );

      expect(report.reportMeta.user.maskedEmail).toBe("p***@example.com");
      expect(report.reportMeta.user.role).toBe("INFLUENCER");
      expect(report.reportMeta.user.name).toBe("Priya Sharma");
    });

    it("generates deterministic 64-character SHA-256 payload integrity hash", async () => {
      const report1 = await MarketRangeReportService.generateReport(
        mockCreatorUser,
        mockInfluencerId,
        { clock: fixedClock }
      );
      const report2 = await MarketRangeReportService.generateReport(
        mockCreatorUser,
        mockInfluencerId,
        { clock: fixedClock }
      );

      expect(report1.reportMeta.integrityCode).toHaveLength(64);
      expect(report1.reportMeta.integrityCode).toMatch(/^[0-9a-f]{64}$/);
      // Deterministic integrity hash for identical payload
      expect(report1.reportMeta.integrityCode).toBe(report2.reportMeta.integrityCode);
    });

    it("registers report integrity verification in ReportVerificationService", async () => {
      const report = await MarketRangeReportService.generateReport(
        mockCreatorUser,
        mockInfluencerId,
        { clock: fixedClock }
      );

      expect(ReportVerificationService.recordReport).toHaveBeenCalledWith({
        id: report.reportMeta.reportId,
        type: "RANGE",
        userId: mockCreatorUser.id,
        scopeId: mockInfluencerId,
        payloadHash: report.reportMeta.integrityCode,
      });
    });

    it("builds CSV export with # metadata headers, blank line separator, data table, and custom sections", async () => {
      const report = await MarketRangeReportService.generateReport(
        mockCreatorUser,
        mockInfluencerId,
        { clock: fixedClock }
      );

      const { csv, filename } = MarketRangeReportService.generateCsv(report);

      expect(filename).toMatch(/^VyaparMedia-MarketRange-priyacreates-\d{8}\.csv$/);

      const lines = csv.split("\r\n");

      // 1. # Platform metadata header
      expect(lines[0]).toMatch(/^# Platform: Vyapar ?Media/);
      expect(lines.some((l) => l.startsWith(`# Report ID: ${report.reportMeta.reportId}`))).toBe(true);
      expect(lines.some((l) => l.startsWith("# Generated For: Priya Sharma (INFLUENCER) <p***@example.com>"))).toBe(true);
      expect(lines.some((l) => l.startsWith(`# SHA-256 Integrity: ${report.reportMeta.integrityCode}`))).toBe(true);

      // 2. Data Table separator
      const tableHeaderIdx = lines.indexOf(
        "Week #,Captured Date (IST),Platform,Followers / Subscribers,Average Views,Engagement Rate,Data Quality"
      );
      expect(tableHeaderIdx).toBeGreaterThan(5);
      expect(lines[tableHeaderIdx - 1]).toBe("");

      // 3. Custom Sections
      expect(csv).toContain("CREATOR PROFILE & ATTRIBUTES");
      expect(csv).toContain("ESTIMATED MARKET RANGE VALUATION");
      expect(csv).toContain("VALUATION WATERFALL BREAKDOWN");
      expect(csv).toContain("DATA QUALITY AUDIT & LEGEND");
      expect(csv).toContain("STATUTORY & ADVISORY DISCLAIMER");
    });

    it("escapes CSV injection characters safely in custom sections and rows", () => {
      const reportWithFormula: MarketRangeReportData = {
        creator: {
          id: "inf_hack",
          userId: "user_hack",
          displayName: "=cmd|' /C calc'!A0",
          instagramHandle: null,
          youtubeHandle: null,
          categories: ["@SUM(1,2)"],
          primaryPlatform: "INSTAGRAM",
          followers: 50000,
          followerTier: "micro",
          authenticityScore: 85,
          drsScore: 700,
        },
        marketRange: {
          minPaise: 500000,
          maxPaise: 1000000,
          basePaise: 750000,
          minRupees: "5,000",
          maxRupees: "10,000",
          baseRupees: "7,500",
          confidence: "MEDIUM",
          dataQuality: "ESTIMATED",
          flags: [],
          explanation: [],
          engineVersion: "1.0.0",
          configVersion: 1,
        },
        snapshots: [],
        dataQualitySummary: {
          verifiedPercent: 0,
          estimatedPercent: 100,
          selfReportedPercent: 0,
          text: "Data quality: 0% verified, 100% estimated, 0% self-reported",
        },
        reportMeta: {
          reportId: "VM-RANGE-20261122-TEST01",
          type: "RANGE",
          scope: "Test Scope",
          period: "Test Period",
          generatedAtUtc: fixedClock.toISOString(),
          generatedAtIst: "22 Nov 2026, 15:30 IST",
          user: { id: "u1", name: "Hacker", email: "h@bad.com", maskedEmail: "h***@bad.com", role: "INFLUENCER" },
          dataQualitySummary: { verifiedPercent: 0, estimatedPercent: 100, selfReportedPercent: 0, text: "0% verified" },
          versions: { engine: "1.0.0", config: "v1" },
          dataSources: ["Test Source"],
          integrityCode: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          shortHash: "ABCDEF",
        },
        disclaimer: "Indicative disclaimer",
      };

      const { csv } = MarketRangeReportService.generateCsv(reportWithFormula);

      // Formula triggers (=, @) must be escaped with leading single quote
      expect(csv).toContain("'=cmd|' /C calc'!A0");
      expect(csv).toContain("'@SUM(1,2)");
    });
  });

  describe("Authorization Matrix & IDOR Security", () => {
    it("allows a creator to generate their own Market Range report", async () => {
      const report = await MarketRangeReportService.generateReport(
        mockCreatorUser,
        mockInfluencerId,
        { clock: fixedClock }
      );

      expect(report.creator.displayName).toBe("Priya Sharma");
      expect(report.marketRange.minRupees).toBe("15000.00");
      expect(report.marketRange.maxRupees).toBe("25000.00");
    });

    it("throws 404 (not 403) when another creator attempts IDOR access to hide profile existence", async () => {
      await expect(
        MarketRangeReportService.generateReport(
          mockOtherUser,
          mockInfluencerId,
          { clock: fixedClock }
        )
      ).rejects.toThrow(AppError);

      try {
        await MarketRangeReportService.generateReport(mockOtherUser, mockInfluencerId);
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).statusCode).toBe(404);
        expect((err as AppError).message).toBe("Influencer profile not found");
      }
    });

    it("throws 404 if profile does not exist in the database", async () => {
      vi.spyOn(prisma.influencerProfile, "findUnique").mockResolvedValue(null);

      await expect(
        MarketRangeReportService.generateReport(
          mockCreatorUser,
          "non_existent_id",
          { clock: fixedClock }
        )
      ).rejects.toThrow("Influencer profile not found");
    });

    it("allows ADMIN to generate report for any creator and records an audit log", async () => {
      const report = await MarketRangeReportService.generateReport(
        mockAdminUser,
        mockInfluencerId,
        { clock: fixedClock, format: "csv" }
      );

      expect(report.creator.displayName).toBe("Priya Sharma");
      expect(report.reportMeta.user.role).toBe("ADMIN");

      // Verifies admin audit log was created
      expect(auditModule.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: mockAdminUser.id,
          actionType: "REPORT_EXPORT_ADMIN",
          entityType: "InfluencerProfile",
          entityId: mockInfluencerId,
        })
      );
    });

    it("records an activity log for creator self-service report generation", async () => {
      await MarketRangeReportService.generateReport(
        mockCreatorUser,
        mockInfluencerId,
        { clock: fixedClock, format: "json" }
      );

      expect(auditModule.createActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockCreatorUser.id,
          action: "REPORT_EXPORT",
          entityType: "InfluencerProfile",
          entityId: mockInfluencerId,
        })
      );
    });
  });

  describe("Data Quality & Estimated Labelling Mandates", () => {
    it("accurately computes verified vs estimated percentage breakdown", async () => {
      // 2 snapshots: 1 API verified, 1 Heuristic estimated
      // Valuation evaluation: 1 API verified
      // Total data points: 3; Verified: 2; Estimated: 1
      // Verified % = Math.round(2 / 3 * 100) = 67%
      // Estimated % = 100 - 67 = 33%
      const report = await MarketRangeReportService.generateReport(
        mockCreatorUser,
        mockInfluencerId,
        { clock: fixedClock }
      );

      expect(report.dataQualitySummary.verifiedPercent).toBe(67);
      expect(report.dataQualitySummary.estimatedPercent).toBe(33);
      expect(report.dataQualitySummary.selfReportedPercent).toBe(0);
      expect(report.dataQualitySummary.text).toBe(
        "Data quality: 67% verified, 33% estimated, 0% self-reported"
      );
    });

    it("labels estimated views with '~' and '(est.)' while keeping verified views exact", async () => {
      const report = await MarketRangeReportService.generateReport(
        mockCreatorUser,
        mockInfluencerId,
        { clock: fixedClock }
      );

      const verifiedRow = report.snapshots.find((s) => s.id === "snap_1");
      const estimatedRow = report.snapshots.find((s) => s.id === "snap_2");

      expect(verifiedRow?.dataQuality).toBe("VERIFIED");
      expect(verifiedRow?.avgViewsFormatted).toBe("45,000");
      expect(verifiedRow?.isEstimated).toBe(false);

      expect(estimatedRow?.dataQuality).toBe("ESTIMATED");
      expect(estimatedRow?.avgViewsFormatted).toBe("~38,000 (est.)");
      expect(estimatedRow?.isEstimated).toBe(true);
    });
  });

  describe("Feature Flag Gating", () => {
    it("throws 403 Forbidden when branded_reports feature flag is disabled", async () => {
      vi.spyOn(featureFlagsModule, "assertFeatureEnabled").mockRejectedValue(
        AppError.forbidden("Feature 'branded_reports' is not enabled")
      );

      await expect(
        MarketRangeReportService.generateReport(mockCreatorUser, mockInfluencerId)
      ).rejects.toThrow("Feature 'branded_reports' is not enabled");
    });
  });

  describe("MarketRangeReportView Component Rendering", () => {
    it("renders complete official report with Letterhead, Meta, Range, Waterfall, Snapshots, and Footer", async () => {
      const report = await MarketRangeReportService.generateReport(
        mockCreatorUser,
        mockInfluencerId,
        { clock: fixedClock }
      );

      const html = renderToStaticMarkup(
        React.createElement(MarketRangeReportView, { data: report })
      );

      // 1. Letterhead & Corporate Information
      expect(html).toContain("logo-vm.png");
      expect(html).toContain("MARKET RANGE ASSESSMENT &amp; BENCHMARK REPORT");
      if (PLATFORM_CONFIG.legalName) {
        expect(html).toContain(PLATFORM_CONFIG.legalName);
      }

      // 2. Metadata Block
      expect(html).toContain(report.reportMeta.reportId);
      expect(html).toContain("Priya Sharma");
      expect(html).toContain("p***@example.com");

      // 3. Creator Profile Attributes
      expect(html).toContain("@priyacreates");
      expect(html).toContain("@priyasharma_vlogs");
      expect(html).toContain("lifestyle");
      expect(html).toContain("fashion");
      expect(html).toContain("88/100"); // Authenticity
      expect(html).toContain(`${report.creator.drsScore}/900`); // DRS

      // 4. Valuation Range Card & Badges
      expect(html).toContain("₹15,000 – ₹25,000");
      expect(html).toContain("₹20,000"); // Midpoint
      expect(html).toContain("Confidence: HIGH");
      expect(html).toContain("Quality: VERIFIED");

      // 5. Valuation Waterfall Table
      expect(html).toContain("Median of recent 12 posts: 45,000 views");
      expect(html).toContain("High engagement boost (+10%)");

      // 6. Data Quality Summary
      expect(html).toContain("67% verified, 33% estimated, 0% self-reported");

      // 7. Historical Delivery Snapshots Table with (est.) indicator
      expect(html).toContain("45,000");
      expect(html).toContain("~38,000 (est.)");

      // 8. Advisory Disclaimer
      expect(html).toContain(
        "Estimated figures are indicative benchmark ranges derived from statistical models"
      );

      // 9. Report Integrity Footer
      expect(html).toContain(report.reportMeta.integrityCode);

      // 10. Platform copy mandates: MUST NOT contain "guaranteed" or "fair price"
      const lowerHtml = html.toLowerCase();
      expect(lowerHtml).not.toContain("guaranteed deliverable");
      expect(lowerHtml).not.toContain("guaranteed views");
    });
  });
});
