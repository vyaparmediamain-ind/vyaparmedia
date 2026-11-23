import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  calculateDealFinance,
  aggregateCampaignFinance,
  filterDealsByIndianFY,
  extractAvailableFYs,
  generateCampaignFinanceCsv,
  type RawFinanceDeal,
} from "@/lib/campaign-finance";
import { paiseToRupees, csvEsc, getIndianFYBounds } from "@/lib/csv-export";
import { CampaignFinanceService } from "@/services/campaign-finance.service";
import prisma from "@/lib/db";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe("Campaign Finance & Indian Tax Accounting Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. RECONCILIATION TESTS (SUM OF PARTS = TOTAL)
  // =========================================================================
  describe("1. Mathematical Reconciliation (Sum of Parts = Total)", () => {
    it("successfully verifies reconciliation when deal parts match the escrow total exactly", () => {
      // Deal 1: amount = 10,000 INR (1,000,000 paise)
      // platformFee = 1,000 INR (100,000 paise)
      // gatewayFee = 0
      // grossPayout = 9,000 INR (900,000 paise)
      // tdsDeducted = 9 INR (900 paise, 0.1% under Section 194-O)
      // netPayout = 8,991 INR (899,100 paise)
      // netPayout + tdsDeducted = 900,000 == grossPayout
      // grossPayout + platformFee = 1,000,000 == amount
      const deals: RawFinanceDeal[] = [
        {
          id: "deal_reconciled_1",
          campaignId: "camp_1",
          influencerId: "inf_1",
          influencerName: "Priya Sharma",
          influencerHandle: "priyasharma",
          status: "COMPLETED",
          amount: 1000000,
          platformFee: 100000,
          gatewayFee: 0,
          influencerPayout: 900000,
          tdsDeducted: 900,
          grossPayout: 900000,
          netPayout: 899100,
          createdAt: new Date("2025-05-10T10:00:00.000Z"),
          completedAt: new Date("2025-05-20T10:00:00.000Z"),
        },
      ];

      const { summary, calculatedDeals } = aggregateCampaignFinance({
        budgetTotalPaise: 2000000,
        deals,
      });

      expect(calculatedDeals[0]?.isReconciled).toBe(true);
      expect(calculatedDeals[0]?.reconciliationNotes).toHaveLength(0);

      // Aggregate reconciliation
      expect(summary.reconciliation.isReconciled).toBe(true);
      expect(summary.reconciliation.discrepancyPaise).toBe(0);
      expect(summary.reconciliation.warnings).toHaveLength(0);

      // Verify exact sum of parts
      expect(summary.totalGrossPayoutPaise).toBe(
        summary.totalNetPayoutPaise + summary.totalTdsDeductedPaise
      );
      expect(summary.escrowReleasedPaise).toBe(
        summary.totalGrossPayoutPaise + summary.totalPlatformFeePaise + summary.totalGatewayFeePaise
      );
    });

    it("detects discrepancy and raises advisory warnings when parts do not equal total", () => {
      // Discrepant Deal: amount is 1,000,000 paise, but grossPayout (800,000) + platformFee (100,000) = 900,000 (100,000 paise missing!)
      const discrepantDeals: RawFinanceDeal[] = [
        {
          id: "deal_discrepant_1",
          campaignId: "camp_1",
          influencerId: "inf_1",
          influencerName: "Rohan Varma",
          influencerHandle: "rohanv",
          status: "COMPLETED",
          amount: 1000000,
          platformFee: 100000,
          gatewayFee: 0,
          influencerPayout: 900000,
          tdsDeducted: 900,
          grossPayout: 800000, // Discrepant by 100,000 paise!
          netPayout: 799100,
          createdAt: new Date("2025-06-10T10:00:00.000Z"),
          completedAt: new Date("2025-06-20T10:00:00.000Z"),
        },
      ];

      const { summary, calculatedDeals } = aggregateCampaignFinance({
        budgetTotalPaise: 2000000,
        deals: discrepantDeals,
      });

      expect(calculatedDeals[0]?.isReconciled).toBe(false);
      expect(calculatedDeals[0]?.reconciliationNotes.length).toBeGreaterThan(0);

      expect(summary.reconciliation.isReconciled).toBe(false);
      expect(summary.reconciliation.discrepancyPaise).toBe(100000);
      expect(summary.reconciliation.discrepancyRupees).toBe("1000.00");
      expect(summary.reconciliation.warnings.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 2. INDIAN FINANCIAL YEAR (FY) BOUNDARY TESTS
  // =========================================================================
  describe("2. Indian FY Boundary Calculations (April 1 to March 31 IST)", () => {
    it("accurately constructs UTC bounds for Indian FY (UTC+05:30)", () => {
      // Indian FY 2025-26: runs from April 1, 2025 00:00 IST to March 31, 2026 23:59:59.999 IST
      // In UTC: April 1 00:00 IST = March 31, 2025 18:30:00 UTC
      // In UTC: March 31 23:59:59.999 IST = March 31, 2026 18:29:59.999 UTC
      const bounds = getIndianFYBounds("2025-26");
      expect(bounds).not.toBeNull();
      if (!bounds) return;

      expect(bounds.start.toISOString()).toBe("2025-03-31T18:30:00.000Z");
      expect(bounds.end.toISOString()).toBe("2026-03-31T18:29:59.999Z");
    });

    it("correctly filters deals on the exact FY boundary", () => {
      const deals: RawFinanceDeal[] = [
        // Just before FY 2025-26 (March 31, 2025 18:29:59 UTC = 23:59:59 IST, FY 2024-25)
        {
          id: "deal_fy24_25",
          campaignId: "camp_1",
          influencerId: "inf_1",
          status: "COMPLETED",
          amount: 500000,
          platformFee: 50000,
          gatewayFee: 0,
          influencerPayout: 450000,
          tdsDeducted: 450,
          grossPayout: 450000,
          netPayout: 449550,
          createdAt: new Date("2025-03-31T18:25:00.000Z"),
          completedAt: new Date("2025-03-31T18:29:59.000Z"),
        },
        // Exactly at start of FY 2025-26 (March 31, 2025 18:30:00 UTC = April 1, 2025 00:00:00 IST)
        {
          id: "deal_fy25_26_start",
          campaignId: "camp_1",
          influencerId: "inf_2",
          status: "COMPLETED",
          amount: 600000,
          platformFee: 60000,
          gatewayFee: 0,
          influencerPayout: 540000,
          tdsDeducted: 540,
          grossPayout: 540000,
          netPayout: 539460,
          createdAt: new Date("2025-03-31T18:30:00.000Z"),
          completedAt: new Date("2025-03-31T18:30:00.000Z"),
        },
        // Inside FY 2025-26
        {
          id: "deal_fy25_26_mid",
          campaignId: "camp_1",
          influencerId: "inf_3",
          status: "COMPLETED",
          amount: 700000,
          platformFee: 70000,
          gatewayFee: 0,
          influencerPayout: 630000,
          tdsDeducted: 630,
          grossPayout: 630000,
          netPayout: 629370,
          createdAt: new Date("2025-09-15T12:00:00.000Z"),
          completedAt: new Date("2025-09-15T12:00:00.000Z"),
        },
        // After FY 2025-26 (April 1, 2026 00:00:01 IST = March 31, 2026 18:30:01 UTC, FY 2026-27)
        {
          id: "deal_fy26_27",
          campaignId: "camp_1",
          influencerId: "inf_4",
          status: "COMPLETED",
          amount: 800000,
          platformFee: 80000,
          gatewayFee: 0,
          influencerPayout: 720000,
          tdsDeducted: 720,
          grossPayout: 720000,
          netPayout: 719280,
          createdAt: new Date("2026-03-31T18:35:00.000Z"),
          completedAt: new Date("2026-03-31T18:35:00.000Z"),
        },
      ];

      const filtered = filterDealsByIndianFY(deals, "2025-26");
      expect(filtered.map((d) => d.id)).toEqual(["deal_fy25_26_start", "deal_fy25_26_mid"]);
    });

    it("correctly extracts available FY options across deals", () => {
      const deals: RawFinanceDeal[] = [
        {
          id: "d1",
          campaignId: "c1",
          influencerId: "i1",
          status: "COMPLETED",
          amount: 100000,
          platformFee: 10000,
          gatewayFee: 0,
          influencerPayout: 90000,
          tdsDeducted: 90,
          grossPayout: 90000,
          netPayout: 89910,
          createdAt: new Date("2024-05-01T10:00:00.000Z"),
          completedAt: new Date("2024-05-01T10:00:00.000Z"),
        },
        {
          id: "d2",
          campaignId: "c1",
          influencerId: "i2",
          status: "COMPLETED",
          amount: 100000,
          platformFee: 10000,
          gatewayFee: 0,
          influencerPayout: 90000,
          tdsDeducted: 90,
          grossPayout: 90000,
          netPayout: 89910,
          createdAt: new Date("2025-08-01T10:00:00.000Z"),
          completedAt: new Date("2025-08-01T10:00:00.000Z"),
        },
      ];

      const fys = extractAvailableFYs(deals);
      expect(fys).toContain("2024-25");
      expect(fys).toContain("2025-26");
    });
  });

  // =========================================================================
  // 3. CANCELLED AND REFUNDED DEALS ACCOUNTING
  // =========================================================================
  describe("3. Cancelled & Refunded Deals Accounting", () => {
    it("excludes cancelled deals from active/completed escrow and isolates in escrowRefunded", () => {
      const deals: RawFinanceDeal[] = [
        // Completed deal
        {
          id: "deal_completed",
          campaignId: "c1",
          influencerId: "i1",
          status: "COMPLETED",
          amount: 500000,
          platformFee: 50000,
          gatewayFee: 0,
          influencerPayout: 450000,
          tdsDeducted: 450,
          grossPayout: 450000,
          netPayout: 449550,
          createdAt: new Date("2025-07-01T10:00:00.000Z"),
          completedAt: new Date("2025-07-10T10:00:00.000Z"),
        },
        // Active in-flight deal
        {
          id: "deal_active",
          campaignId: "c1",
          influencerId: "i2",
          status: "ACTIVE",
          amount: 300000,
          platformFee: 30000,
          gatewayFee: 0,
          influencerPayout: 270000,
          tdsDeducted: 0,
          grossPayout: 0,
          netPayout: 0,
          createdAt: new Date("2025-07-02T10:00:00.000Z"),
          completedAt: null,
        },
        // Cancelled deal (funds refunded to brand wallet)
        {
          id: "deal_cancelled",
          campaignId: "c1",
          influencerId: "i3",
          status: "CANCELLED",
          amount: 200000,
          platformFee: 20000,
          gatewayFee: 0,
          influencerPayout: 180000,
          tdsDeducted: 0,
          grossPayout: 0,
          netPayout: 0,
          createdAt: new Date("2025-07-03T10:00:00.000Z"),
          completedAt: null,
        },
      ];

      const { summary } = aggregateCampaignFinance({
        budgetTotalPaise: 2000000, // 20,000 INR
        deals,
      });

      // Escrow breakdown:
      // Completed = 500,000 paise (5,000 INR)
      expect(summary.escrowReleasedPaise).toBe(500000);
      // Active = 300,000 paise (3,000 INR)
      expect(summary.escrowLockedPaise).toBe(300000);
      // Cancelled = 200,000 paise (2,000 INR)
      expect(summary.escrowRefundedPaise).toBe(200000);

      // Funded Budget = Active + Completed only = 800,000 paise
      expect(summary.budgetFundedPaise).toBe(800000);

      // Budget Remaining = 2,000,000 - 800,000 = 1,200,000 paise (12,000 INR)
      expect(summary.budgetRemainingPaise).toBe(1200000);

      // Cancelled deals do not charge platform fee
      expect(summary.totalPlatformFeePaise).toBe(80000); // 50,000 + 30,000, NOT 100,000
    });
  });

  // =========================================================================
  // 4. MONEY / PAISE TO RUPEES DISPLAY CONVERSIONS
  // =========================================================================
  describe("4. Currency Precision (Integer Paise to Rupee Formatting)", () => {
    it("accurately converts paise to 2-decimal rupee strings", () => {
      expect(paiseToRupees(100)).toBe("1.00");
      expect(paiseToRupees(0)).toBe("0.00");
      expect(paiseToRupees(99)).toBe("0.99");
      expect(paiseToRupees(150000)).toBe("1500.00");
      expect(paiseToRupees(150100)).toBe("1501.00");
      expect(paiseToRupees(50000000)).toBe("500000.00");
    });
  });

  // =========================================================================
  // 5. CSV FORMULA INJECTION PREVENTION (csvEsc)
  // =========================================================================
  describe("5. CSV Export Security & Formula Injection Prevention", () => {
    it("neutralizes dangerous formula injection prefixes (=, +, -, @, \\t, \\r)", () => {
      // Spreadsheet formula injection attacks
      expect(csvEsc("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
      expect(csvEsc("+cmd|'/C calc'!A0")).toBe("'+cmd|'/C calc'!A0");
      expect(csvEsc("-2+3*cmd")).toBe("'-2+3*cmd");
      expect(csvEsc("@HYPERLINK('http://evil.com')")).toBe("'@HYPERLINK('http://evil.com')");
      expect(csvEsc("\t=cmd")).toBe("'\t=cmd");
    });

    it("wraps values containing commas or quotes in valid CSV format", () => {
      expect(csvEsc("Sharma, Priya")).toBe('"Sharma, Priya"');
      expect(csvEsc('Title with "Quotes"')).toBe('"Title with ""Quotes"""');
    });

    it("generates complete CSV ledger with safe escaping", () => {
      const csv = generateCampaignFinanceCsv({
        campaign: {
          id: "camp_test_csv",
          title: "=SUM(1,2) Promo",
          status: "ACTIVE",
          brandName: "+Acme Corp",
          targetCategories: ["tech"],
        },
        selectedFy: "2025-26",
        availableFys: ["2025-26"],
        summary: {
          budgetTotalPaise: 1000000,
          budgetTotalRupees: "10000.00",
          budgetFundedPaise: 500000,
          budgetFundedRupees: "5000.00",
          escrowLockedPaise: 200000,
          escrowLockedRupees: "2000.00",
          escrowReleasedPaise: 300000,
          escrowReleasedRupees: "3000.00",
          escrowRefundedPaise: 0,
          escrowRefundedRupees: "0.00",
          budgetRemainingPaise: 500000,
          budgetRemainingRupees: "5000.00",
          totalPlatformFeePaise: 50000,
          totalPlatformFeeRupees: "500.00",
          totalGstOnPlatformFeePaise: 9000,
          totalGstOnPlatformFeeRupees: "90.00",
          totalGatewayFeePaise: 0,
          totalGatewayFeeRupees: "0.00",
          totalGrossPayoutPaise: 450000,
          totalGrossPayoutRupees: "4500.00",
          totalTdsDeductedPaise: 450,
          totalTdsDeductedRupees: "4.50",
          totalNetPayoutPaise: 449550,
          totalNetPayoutRupees: "4495.50",
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
        taxSummary: {
          gstRatePercentString: "18%",
          gstExemptThresholdRupees: 1500,
          tdsRatePercentString: "0.1%",
          tdsStatutorySection: "Section 393(1)",
          brandGstin: null,
          brandPan: null,
          taxReadinessStatus: "READY",
          advisories: [],
        },
        deals: [
          {
            id: "deal_1",
            creatorName: "=Malicious Formula",
            creatorHandle: "evil",
            status: "COMPLETED",
            amountPaise: 500000,
            amountRupees: "5000.00",
            platformFeePaise: 50000,
            platformFeeRupees: "500.00",
            gstOnPlatformFeePaise: 9000,
            gstOnPlatformFeeRupees: "90.00",
            gatewayFeePaise: 0,
            gatewayFeeRupees: "0.00",
            influencerPayoutPaise: 450000,
            influencerPayoutRupees: "4500.00",
            tdsDeductedPaise: 450,
            tdsDeductedRupees: "4.50",
            grossPayoutPaise: 450000,
            grossPayoutRupees: "4500.00",
            netPayoutPaise: 449550,
            netPayoutRupees: "4495.50",
            isReconciled: true,
            reconciliationNotes: [],
            createdAt: "2025-07-01T10:00:00.000Z",
            completedAt: "2025-07-10T10:00:00.000Z",
          },
        ],
      });

      // Assert malicious formulas are escaped with leading single quote
      expect(csv).toContain("'=SUM(1,2) Promo");
      expect(csv).toContain("'+Acme Corp");
      expect(csv).toContain("'=Malicious Formula");
      expect(csv).toContain("'@evil");
    });
  });

  // =========================================================================
  // 6. STATUTORY TAX (GST & TDS) RULES
  // =========================================================================
  describe("6. Statutory Tax Rules (GST & TDS Exemption Thresholds)", () => {
    it("exempts deals <= ₹1,500 from GST on platform fee, but applies 18% for deals > ₹1,500", () => {
      // Deal 1: ₹1,500 exactly (150,000 paise) -> GST on fee = 0
      const exemptDeal: RawFinanceDeal = {
        id: "deal_exempt",
        campaignId: "c1",
        influencerId: "i1",
        status: "COMPLETED",
        amount: 150000,
        platformFee: 15000,
        gatewayFee: 0,
        influencerPayout: 135000,
        tdsDeducted: 135,
        grossPayout: 135000,
        netPayout: 134865,
        createdAt: new Date("2025-07-01T10:00:00.000Z"),
        completedAt: new Date("2025-07-10T10:00:00.000Z"),
      };
      const calculatedExempt = calculateDealFinance(exemptDeal);
      expect(calculatedExempt.gstOnPlatformFeePaise).toBe(0);

      // Deal 2: ₹1,501 (150,100 paise) -> GST on fee = 18% of 15,010 = 2,702 paise
      const taxableDeal: RawFinanceDeal = {
        id: "deal_taxable",
        campaignId: "c1",
        influencerId: "i2",
        status: "COMPLETED",
        amount: 150100,
        platformFee: 15010,
        gatewayFee: 0,
        influencerPayout: 135090,
        tdsDeducted: 135,
        grossPayout: 135090,
        netPayout: 134955,
        createdAt: new Date("2025-07-01T10:00:00.000Z"),
        completedAt: new Date("2025-07-10T10:00:00.000Z"),
      };
      const calculatedTaxable = calculateDealFinance(taxableDeal);
      expect(calculatedTaxable.gstOnPlatformFeePaise).toBe(Math.round(15010 * 0.18));
      expect(calculatedTaxable.gstOnPlatformFeeRupees).toBe("27.02");
    });
  });

  // =========================================================================
  // 7. SERVICE LAYER & OBJECT-LEVEL AUTHORIZATION (IDOR DEFENSE)
  // =========================================================================
  describe("7. Service Security & IDOR Defense", () => {
    it("allows the owner brand to access financial ledger", async () => {
      vi.spyOn(prisma.campaign, "findUnique").mockResolvedValue({
        id: "camp_fin_1",
        title: "Brand Campaign",
        status: "ACTIVE",
        totalBudget: 5000000,
        targetCategories: ["tech"],
        brandId: "bp_1",
        brand: { id: "bp_1", userId: "owner_user", companyName: "TechCorp" },
      } as unknown as import("@prisma/client").Campaign);

      vi.spyOn(prisma.deal, "findMany").mockResolvedValue([]);
      vi.spyOn(prisma.indiaTaxCompliance, "findUnique").mockResolvedValue({
        panLast4: "1234",
        gstinLast4: "5678",
        status: "READY",
        gstRegistrationType: "REGISTERED",
      } as unknown as import("@prisma/client").IndiaTaxCompliance);

      const report = await CampaignFinanceService.getCampaignFinance("camp_fin_1", "owner_user", false);
      expect(report.campaign.title).toBe("Brand Campaign");
      expect(report.taxSummary.brandGstin).toBe("****5678");
    });

    it("allows an active admin to access financial ledger", async () => {
      vi.spyOn(prisma.campaign, "findUnique").mockResolvedValue({
        id: "camp_fin_1",
        title: "Brand Campaign",
        status: "ACTIVE",
        totalBudget: 5000000,
        targetCategories: ["tech"],
        brandId: "bp_1",
        brand: { id: "bp_1", userId: "owner_user", companyName: "TechCorp" },
      } as unknown as import("@prisma/client").Campaign);

      vi.spyOn(prisma.deal, "findMany").mockResolvedValue([]);
      vi.spyOn(prisma.indiaTaxCompliance, "findUnique").mockResolvedValue(null);

      const report = await CampaignFinanceService.getCampaignFinance("camp_fin_1", "admin_user", true);
      expect(report.campaign.brandName).toBe("TechCorp");
    });

    it("throws 404 AppError.notFound when unauthorized user tries to access campaign finance (IDOR)", async () => {
      vi.spyOn(prisma.campaign, "findUnique").mockResolvedValue({
        id: "camp_fin_1",
        title: "Brand Campaign",
        status: "ACTIVE",
        totalBudget: 5000000,
        targetCategories: ["tech"],
        brandId: "bp_1",
        brand: { id: "bp_1", userId: "owner_user", companyName: "TechCorp" },
      } as unknown as import("@prisma/client").Campaign);

      await expect(
        CampaignFinanceService.getCampaignFinance("camp_fin_1", "attacker_user", false)
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Campaign not found",
      });
    });
  });
});
