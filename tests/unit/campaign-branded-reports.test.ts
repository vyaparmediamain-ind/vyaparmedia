import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CampaignPerformanceReportService,
  type CampaignPerformanceReportData,
} from "@/services/campaign-performance-report.service";
import { CampaignGovernanceReportService } from "@/services/campaign-governance-report.service";
import { CampaignRoiService } from "@/services/campaign-roi.service";
import { CampaignFinanceService } from "@/services/campaign-finance.service";
import { buildReportMeta, maskEmail } from "@/lib/report-meta";
import { paiseToRupees, csvEsc, buildBrandedCsv } from "@/lib/csv-export";
import prisma from "@/lib/db";
import { AppError } from "@/lib/errors";
import { PLATFORM_CONFIG } from "@/lib/platform-config";
import * as platformConfigCheck from "@/lib/platform-config-check";
import * as adminAuthModule from "@/lib/admin-auth";
import * as auditModule from "@/lib/audit";
import * as featureFlagsModule from "@/lib/feature-flags";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe("Campaign Branded Reports & Report Standard Compliance (Performance & Governance)", () => {
  const fixedNow = new Date("2026-11-23T12:00:00.000Z");

  const mockBrandUser = {
    id: "usr_brand_101",
    name: "Acme Consumer Brands",
    email: "finance@acmebrands.in",
    userType: "BRAND",
  };

  const mockAdminUser = {
    id: "usr_admin_42",
    name: "Chief Compliance Officer",
    email: "compliance@vyaparmedia.in",
    userType: "ADMIN",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. REPORT STANDARD SECTION 10: METADATA, LETTERHEAD & SECURITY
  // =========================================================================
  describe("1. Report Standard Compliance (Section 10)", () => {
    it("generates deterministic Report ID matching format VM-<TYPE>-<YYYYMMDD>-<6 char Base32>", () => {
      const meta = buildReportMeta({
        type: "PERF",
        scope: "Campaign: Diwali Blitz (camp_100)",
        period: "FY 2026-27",
        user: {
          id: mockBrandUser.id,
          name: mockBrandUser.name,
          email: mockBrandUser.email,
          role: "BRAND",
        },
        now: fixedNow,
        payload: { campaignId: "camp_100", totalSpend: 500000 },
      });

      // Format: VM-PERF-YYYYMMDD-XXXXXX (Base32)
      expect(meta.reportId).toMatch(/^VM-PERF-20261123-[A-Z2-7]{6}$/);
      expect(meta.generatedAtIst).toContain("23 Nov 2026");
      expect(meta.generatedAtUtc).toBe("2026-11-23T12:00:00.000Z");
      expect(meta.integrityCode).toHaveLength(64); // SHA-256 hex string
    });

    it("masks registered user email in compliance with PII privacy rules", () => {
      expect(maskEmail("finance@acmebrands.in")).toBe("f***@acmebrands.in");
      expect(maskEmail("rohit.sharma@gmail.com")).toBe("r***@gmail.com");
      expect(maskEmail("a@b.com")).toBe("a***@b.com");
    });

    it("prevents CSV formula injection by prepending single quote to formula triggers", () => {
      expect(csvEsc("=SUM(1,2)")).toBe("\"'=SUM(1,2)\"");
      expect(csvEsc("+Acme Corp")).toBe("'+Acme Corp");
      expect(csvEsc("-Discount")).toBe("'-Discount");
      expect(csvEsc("@SpecialUser")).toBe("'@SpecialUser");
    });

    it("blocks report generation when mandatory platform tax configuration is missing", async () => {
      vi.spyOn(platformConfigCheck, "assertTaxReportPrerequisites").mockImplementationOnce(() => {
        throw AppError.badRequest(
          "Platform configuration incomplete: Company Legal Name, Company GSTIN must be configured in environment variables"
        );
      });

      await expect(
        CampaignPerformanceReportService.getCampaignPerformanceReport(
          "camp_1",
          mockBrandUser.id,
          false,
          fixedNow
        )
      ).rejects.toThrow("Platform configuration incomplete");
    });
  });

  // =========================================================================
  // 2. RECONCILIATION EQUALS FINANCE TAB
  // =========================================================================
  describe("2. Mathematical Reconciliation Equals Finance Tab", () => {
    it("asserts that sum of creator gross payout and platform fee matches escrow total exactly", async () => {
      // Mock campaign
      vi.spyOn(prisma.campaign, "findUnique").mockResolvedValueOnce({
        id: "camp_reconciled",
        title: "Pan-India Summer Launch",
        status: "COMPLETED",
        totalBudget: 1100000, // ₹11,000
        fundedAmount: 1100000,
        targetCategories: ["Fashion", "Lifestyle"],
        brandId: "brand_prof_1",
        brand: {
          id: "brand_prof_1",
          userId: mockBrandUser.id,
          companyName: "Acme Consumer Brands Ltd",
          website: "https://acmebrands.in",
          address: "123 Nariman Point",
          city: "Mumbai",
          state: "Maharashtra",
          pinCode: "400021",
          user: {
            id: mockBrandUser.id,
            name: "Rajesh Kumar",
            email: mockBrandUser.email,
            userType: "BRAND",
            taxCompliance: {
              panLast4: "5678",
              gstinLast4: "1Z5",
              gstStateCode: "27",
            },
          },
        },
      } as unknown as import("@prisma/client").Campaign & {
        brand: {
          id: string;
          userId: string;
          companyName: string;
          website: string | null;
          address: string | null;
          city: string | null;
          state: string | null;
          pinCode: string | null;
          user: {
            id: string;
            name: string | null;
            email: string;
            userType: string;
            taxCompliance: {
              panLast4: string | null;
              gstinLast4: string | null;
              gstStateCode: string | null;
            } | null;
          } | null;
        } | null;
      });

      vi.spyOn(CampaignRoiService, "getCampaignRoiReport").mockResolvedValueOnce({
        campaign: {
          id: "camp_reconciled",
          title: "Pan-India Summer Launch",
          status: "COMPLETED",
          totalBudgetPaise: 1000000,
          totalBudgetRupees: "10000.00",
          targetCategories: ["Fashion"],
          brandName: "Acme Consumer Brands Ltd",
        },
        summary: {
          totalSpendPaise: 1000000,
          totalSpendRupees: "10000.00",
          totalReach: 75000,
          totalViews: 50000,
          totalVerifiedViews: 50000,
          totalEstimatedViews: 0,
          totalPredictedViews: 48000,
          totalEngagements: 2950,
          avgEngagementRate: 5.9,
          blendedCPE: "3.39",
          effectiveCpvPaise: 20,
          effectiveCpvRupees: "0.20",
          effectiveCprRupees: "0.13",
          categoryBaselineCpvPaise: 25,
          categoryBaselineCpvRupees: "0.25",
          categoryBenchmarkSource: "PLATFORM_DEFAULT",
          efficiencyMultiplier: 1.25,
          influencerCount: 1,
          overallAlgorithmAccuracy: 96,
          overallViewsVariancePercent: 4,
          overallDeliveryMultiplier: 1.04,
          predictedAverageCpvPaise: 21,
          predictedAverageCpvRupees: "0.21",
          hasEstimatedData: false,
          dataQualityStatus: "VERIFIED",
        },
        influencers: [
          {
            dealId: "deal_1",
            influencerId: "inf_1",
            influencer: "Priya Sharma",
            handle: "priyasharma",
            followers: 120000,
            paid: 1000000,
            paidRupees: "10000.00",
            reach: 75000,
            views: 50000,
            predictedViews: 48000,
            predictedCpvPaise: 21,
            predictedCpvRupees: "0.21",
            predictedRoiScore: 92,
            actualRoiScore: 95,
            accuracyPercentage: 96,
            viewsVariance: 2000,
            viewsVariancePercent: 4,
            deliveryMultiplier: 1.04,
            likes: 2500,
            comments: 200,
            shares: 150,
            saves: 100,
            totalEngagements: 2950,
            engagementRate: 5.9,
            cpvPaise: 20,
            costPerView: "0.20",
            costPerEngagement: "3.39",
            costPerReach: "0.13",
            rating: 480,
            isEstimated: false,
            metricsQuality: "VERIFIED",
            snapshotInterval: "7d",
            drsScore: 92,
            isOnTime: true,
            approvalCycleHours: 24,
          },
        ],
        reportMeta: {} as unknown as import("@/lib/report-meta").ReportMeta,
        dataDisclaimer: null,
      });

      vi.spyOn(CampaignFinanceService, "getCampaignFinance").mockResolvedValueOnce({
        campaign: {
          id: "camp_reconciled",
          title: "Pan-India Summer Launch",
          status: "COMPLETED",
          brandName: "Acme Consumer Brands Ltd",
          targetCategories: ["Fashion"],
        },
        selectedFy: null,
        availableFys: ["2026-2027"],
        summary: {
          budgetTotalPaise: 1000000,
          budgetTotalRupees: "10000.00",
          budgetFundedPaise: 1000000,
          budgetFundedRupees: "10000.00",
          escrowLockedPaise: 0,
          escrowLockedRupees: "0.00",
          escrowReleasedPaise: 1000000,
          escrowReleasedRupees: "10000.00",
          escrowRefundedPaise: 0,
          escrowRefundedRupees: "0.00",
          budgetRemainingPaise: 0,
          budgetRemainingRupees: "0.00",
          totalPlatformFeePaise: 100000,
          totalPlatformFeeRupees: "1000.00",
          totalGstOnPlatformFeePaise: 18000,
          totalGstOnPlatformFeeRupees: "180.00",
          totalGatewayFeePaise: 0,
          totalGatewayFeeRupees: "0.00",
          totalGrossPayoutPaise: 900000,
          totalGrossPayoutRupees: "9000.00",
          totalTdsDeductedPaise: 900,
          totalTdsDeductedRupees: "9.00",
          totalNetPayoutPaise: 899100,
          totalNetPayoutRupees: "8991.00",
          dealCount: 1,
          activeDealCount: 0,
          completedDealCount: 1,
          cancelledDealCount: 0,
          reconciliation: {
            isReconciled: true,
            discrepancyPaise: 0,
            discrepancyRupees: "0.00",
            warnings: [],
          },
        },
        taxSummary: {} as unknown as import("@/lib/campaign-finance").CampaignFinanceTaxSummary,
        deals: [],
      });

      const report = await CampaignPerformanceReportService.getCampaignPerformanceReport(
        "camp_reconciled",
        mockBrandUser.id,
        false,
        fixedNow
      );

      // Verify Mathematical Reconciliation:
      expect(report.finance.reconciled).toBe(true);
      expect(report.finance.totalEscrowPaise).toBe(1000000);
      expect(report.finance.grossPayoutPaise).toBe(900000);
      expect(report.finance.platformFeePaise).toBe(100000);
      expect(report.finance.tdsDeductedPaise).toBe(900);
      expect(report.finance.netPayoutPaise).toBe(899100);
      expect(report.finance.discrepancyPaise).toBe(0);

      // Verify sum of parts
      expect(report.finance.grossPayoutPaise + report.finance.platformFeePaise).toBe(
        report.finance.totalEscrowPaise
      );
      expect(report.finance.netPayoutPaise + report.finance.tdsDeductedPaise).toBe(
        report.finance.grossPayoutPaise
      );
    });
  });

  // =========================================================================
  // 3. AUTHORIZATION MATRIX & IDOR PROTECTION
  // =========================================================================
  describe("3. Authorization Matrix & Security Guardrails", () => {
    it("returns 404 (not 403) when a non-owner brand attempts to view a campaign performance report", async () => {
      vi.spyOn(prisma.campaign, "findUnique").mockResolvedValueOnce({
        id: "camp_private",
        brand: { userId: "usr_other_brand_999" },
      } as unknown as import("@prisma/client").Campaign & {
        brand: { userId: string } | null;
      });

      await expect(
        CampaignPerformanceReportService.getCampaignPerformanceReport(
          "camp_private",
          "usr_attacker_brand",
          false,
          fixedNow
        )
      ).rejects.toThrow("Campaign not found");
    });

    it("allows active platform administrator to view brand campaign performance report", async () => {
      vi.spyOn(prisma.campaign, "findUnique").mockResolvedValueOnce({
        id: "camp_admin_view",
        title: "Acme Tech Push",
        status: "ACTIVE",
        totalBudget: 500000,
        fundedAmount: 500000,
        targetCategories: ["Tech"],
        brand: {
          id: "brand_prof_2",
          userId: mockBrandUser.id,
          companyName: "Acme Tech Ltd",
          user: {
            id: mockBrandUser.id,
            name: "Rajesh Kumar",
            email: mockBrandUser.email,
            userType: "BRAND",
            taxCompliance: null,
          },
        },
      } as unknown as import("@prisma/client").Campaign & {
        brand: {
          id: string;
          userId: string;
          companyName: string;
          user: { id: string; name: string | null; email: string; userType: string; taxCompliance: null } | null;
        } | null;
      });

      vi.spyOn(CampaignRoiService, "getCampaignRoiReport").mockResolvedValueOnce({
        campaign: {
          id: "camp_admin_view",
          title: "Acme Tech Push",
          status: "ACTIVE",
          totalBudgetPaise: 500000,
          totalBudgetRupees: "5000.00",
          targetCategories: ["Tech"],
          brandName: "Acme Tech Ltd",
        },
        summary: {
          totalSpendPaise: 0,
          totalSpendRupees: "0.00",
          totalReach: 0,
          totalViews: 0,
          totalVerifiedViews: 0,
          totalEstimatedViews: 0,
          totalPredictedViews: 0,
          totalEngagements: 0,
          avgEngagementRate: 0,
          blendedCPE: "0.00",
          effectiveCpvPaise: 0,
          effectiveCpvRupees: "0.00",
          effectiveCprRupees: "0.00",
          categoryBaselineCpvPaise: 25,
          categoryBaselineCpvRupees: "0.25",
          categoryBenchmarkSource: "PLATFORM_DEFAULT",
          efficiencyMultiplier: null,
          influencerCount: 0,
          overallAlgorithmAccuracy: 0,
          overallViewsVariancePercent: 0,
          overallDeliveryMultiplier: 0,
          predictedAverageCpvPaise: 0,
          predictedAverageCpvRupees: "0.00",
          hasEstimatedData: false,
          dataQualityStatus: "VERIFIED",
        },
        influencers: [],
        reportMeta: {} as unknown as import("@/lib/report-meta").ReportMeta,
        dataDisclaimer: null,
      });

      vi.spyOn(CampaignFinanceService, "getCampaignFinance").mockResolvedValueOnce({
        campaign: {
          id: "camp_admin_view",
          title: "Acme Tech Push",
          status: "ACTIVE",
          brandName: "Acme Tech Ltd",
          targetCategories: ["Tech"],
        },
        selectedFy: null,
        availableFys: ["2026-2027"],
        summary: {
          budgetTotalPaise: 0,
          budgetTotalRupees: "0.00",
          budgetFundedPaise: 0,
          budgetFundedRupees: "0.00",
          escrowLockedPaise: 0,
          escrowLockedRupees: "0.00",
          escrowReleasedPaise: 0,
          escrowReleasedRupees: "0.00",
          escrowRefundedPaise: 0,
          escrowRefundedRupees: "0.00",
          budgetRemainingPaise: 0,
          budgetRemainingRupees: "0.00",
          totalPlatformFeePaise: 0,
          totalPlatformFeeRupees: "0.00",
          totalGstOnPlatformFeePaise: 0,
          totalGstOnPlatformFeeRupees: "0.00",
          totalGatewayFeePaise: 0,
          totalGatewayFeeRupees: "0.00",
          totalGrossPayoutPaise: 0,
          totalGrossPayoutRupees: "0.00",
          totalTdsDeductedPaise: 0,
          totalTdsDeductedRupees: "0.00",
          totalNetPayoutPaise: 0,
          totalNetPayoutRupees: "0.00",
          dealCount: 0,
          activeDealCount: 0,
          completedDealCount: 0,
          cancelledDealCount: 0,
          reconciliation: {
            isReconciled: true,
            discrepancyPaise: 0,
            discrepancyRupees: "0.00",
            warnings: [],
          },
        },
        taxSummary: {} as unknown as import("@/lib/campaign-finance").CampaignFinanceTaxSummary,
        deals: [],
      });

      const report = await CampaignPerformanceReportService.getCampaignPerformanceReport(
        "camp_admin_view",
        mockAdminUser.id,
        true, // isAdmin = true
        fixedNow
      );

      expect(report.campaign.id).toBe("camp_admin_view");
      expect(report.campaign.brandName).toBe("Acme Tech Ltd");
    });

    it("strictly blocks non-admin callers from accessing Campaign Governance Report", async () => {
      vi.spyOn(adminAuthModule, "requireActiveAdmin").mockRejectedValueOnce(
        AppError.forbidden("Unauthorized: Admin access required")
      );

      await expect(
        CampaignGovernanceReportService.getCampaignGovernanceReport(
          "camp_any",
          mockBrandUser,
          "127.0.0.1",
          fixedNow
        )
      ).rejects.toThrow("Unauthorized: Admin access required");
    });
  });

  // =========================================================================
  // 4. BRANDED CSV GENERATION (Report Standard Section 7)
  // =========================================================================
  describe("4. Branded CSV Generation & Layout Compliance", () => {
    it("generates CSV with platform header, metadata comments, data table, and platform footer", () => {
      const mockReportData: CampaignPerformanceReportData = {
        campaign: {
          id: "camp_csv_test",
          title: "Diwali Special Promo",
          status: "COMPLETED",
          totalBudgetPaise: 1000000,
          totalBudgetRupees: "10000.00",
          fundedAmountPaise: 1000000,
          fundedAmountRupees: "10000.00",
          targetCategories: ["E-Commerce"],
          brandName: "Acme Retail Ltd",
          brandLegalDetails: {
            companyName: "Acme Retail Ltd",
            gstin: "27AABCU9603R1ZM",
            pan: "XXXXXX1234",
            address: "Bandra Kurla Complex, Mumbai",
          },
        },
        kpis: {
          totalSpendPaise: 1000000,
          totalSpendRupees: "10000.00",
          totalReach: 150000,
          totalViews: 85000,
          verifiedViews: 85000,
          estimatedViews: 0,
          totalEngagements: 4500,
          avgEngagementRate: 5.29,
          effectiveCpvPaise: 12,
          effectiveCpvRupees: "0.12",
          categoryBaselineCpvPaise: 25,
          categoryBaselineCpvRupees: "0.25",
          efficiencyMultiplier: 2.08,
          algorithmMatchAccuracy: 95,
        },
        funnel: {
          reach: 150000,
          views: 85000,
          engagements: 4500,
          conversions: 620,
        },
        creators: [
          {
            dealId: "deal_1",
            influencerId: "inf_1",
            influencer: "Rohan Varma",
            handle: "rohanv",
            followers: 90000,
            paid: 1000000,
            paidRupees: "10000.00",
            reach: 150000,
            views: 85000,
            predictedViews: 80000,
            predictedCpvPaise: 13,
            predictedCpvRupees: "0.13",
            predictedRoiScore: 88,
            actualRoiScore: 92,
            accuracyPercentage: 95,
            viewsVariance: 5000,
            viewsVariancePercent: 6,
            deliveryMultiplier: 1.06,
            likes: 4000,
            comments: 300,
            shares: 120,
            saves: 80,
            totalEngagements: 4500,
            engagementRate: 5.29,
            cpvPaise: 12,
            costPerView: "0.12",
            costPerEngagement: "2.22",
            costPerReach: "0.07",
            rating: 490,
            isEstimated: false,
            metricsQuality: "VERIFIED",
            snapshotInterval: "7d",
            drsScore: 92,
            isOnTime: true,
            approvalCycleHours: 24,
          },
        ],
        finance: {
          totalEscrowPaise: 1000000,
          totalEscrowRupees: "10000.00",
          platformFeePaise: 100000,
          platformFeeRupees: "1000.00",
          gstOnPlatformFeePaise: 18000,
          gstOnPlatformFeeRupees: "180.00",
          grossPayoutPaise: 900000,
          grossPayoutRupees: "9000.00",
          tdsDeductedPaise: 900,
          tdsDeductedRupees: "9.00",
          netPayoutPaise: 899100,
          netPayoutRupees: "8991.00",
          reconciled: true,
          discrepancyPaise: 0,
          reconciliationMessage: "100% Mathematically Reconciled",
        },
        dataQualitySummary: {
          verifiedPercent: 100,
          estimatedPercent: 0,
          selfReportedPercent: 0,
          text: "100% Verified API",
        },
        reportMeta: buildReportMeta({
          type: "CAMPAIGN_PERFORMANCE",
          scope: "Campaign: Diwali Special Promo (camp_csv_test)",
          period: "FY 2026-27",
          user: { id: mockBrandUser.id, name: mockBrandUser.name, email: mockBrandUser.email, role: "BRAND" },
          now: fixedNow,
          payload: { campaignId: "camp_csv_test" },
        }),
        disclaimer: "Estimated figures are indicative. This report is not tax, legal or financial advice.",
      };

      const csv = CampaignPerformanceReportService.generateCampaignPerformanceCsv(mockReportData);

      // Verify Platform Letterhead in CSV (prefixed with # )
      expect(csv).toContain(`# Legal Name: ${PLATFORM_CONFIG.legalName}`);
      expect(csv).toContain(`# GSTIN: ${PLATFORM_CONFIG.gstin}`);
      expect(csv).toContain(`# Report ID: ${mockReportData.reportMeta.reportId}`);

      // Verify Primary Columns Header Row
      expect(csv).toContain("Creator Partner,Handle,Followers,Paid (INR),Delivered Views");

      // Verify Data Rows
      expect(csv).toContain("Rohan Varma,'@rohanv,90000,10000.00,85000");

      // Verify Custom Sections: Dossier, Funnel, and Finance Reconciliation
      expect(csv).toContain("CAMPAIGN & BRAND LEGAL DOSSIER");
      expect(csv).toContain("FINANCE & STATUTORY TAX RECONCILIATION");
      expect(csv).toContain("CONVERSION FUNNEL ATTRIBUTION");
      expect(csv).toContain("Mathematical Reconciliation Status,RECONCILED (100% Match)");

      // Verify Platform Footer
      expect(csv).toContain("# Disclaimer: Estimated figures are indicative.");
      expect(csv).toContain(`Report ID: ${mockReportData.reportMeta.reportId}`);
    });
  });

  // =========================================================================
  // 5. LARGE-CAMPAIGN PERFORMANCE SIMULATION
  // =========================================================================
  describe("5. Large-Campaign Performance Simulation", () => {
    it("processes a 100-deal campaign and generates branded report in under 100ms", () => {
      const largeDeals = Array.from({ length: 100 }, (_, i) => ({
        dealId: `deal_${i}`,
        influencerId: `inf_${i}`,
        influencer: `Creator ${i}`,
        handle: `creator_${i}`,
        followers: 50000 + i * 500,
        paid: 500000,
        paidRupees: "5000.00",
        reach: 75000,
        views: 40000,
        predictedViews: 38000,
        predictedCpvPaise: 13,
        predictedCpvRupees: "0.13",
        predictedRoiScore: 85,
        actualRoiScore: 88,
        accuracyPercentage: 95,
        viewsVariance: 2000,
        viewsVariancePercent: 5,
        deliveryMultiplier: 1.05,
        likes: 2000,
        comments: 100,
        shares: 50,
        saves: 40,
        totalEngagements: 2190,
        engagementRate: 5.48,
        cpvPaise: 12,
        costPerView: "0.12",
        costPerEngagement: "2.28",
        costPerReach: "0.07",
        rating: 470,
        isEstimated: false,
        metricsQuality: "VERIFIED",
        snapshotInterval: "7d",
        drsScore: 85,
        isOnTime: true,
        approvalCycleHours: 18,
      }));

      const start = performance.now();

      const meta = buildReportMeta({
        type: "CAMPAIGN_PERFORMANCE",
        scope: "Campaign: Massive National Push (camp_large)",
        period: "FY 2026-27",
        user: { id: mockBrandUser.id, name: mockBrandUser.name, email: mockBrandUser.email, role: "BRAND" },
        now: fixedNow,
        payload: { dealsCount: largeDeals.length },
      });

      const csv = buildBrandedCsv({
        meta,
        columns: [
          { key: "influencer", label: "Creator" },
          { key: "paidRupees", label: "Paid" },
          { key: "views", label: "Views" },
        ],
        rows: largeDeals as unknown as Record<string, unknown>[],
      });

      const durationMs = performance.now() - start;

      expect(largeDeals).toHaveLength(100);
      expect(csv).toContain("Creator 99");
      expect(durationMs).toBeLessThan(100); // Strict performance budget: < 100ms
    });
  });
});
