import { describe, it, expect, vi, beforeEach } from "vitest";
import { CampaignMetricsService } from "@/services/campaign-metrics.service";
import { CampaignRoiService, type CampaignRoiReportResult } from "@/services/campaign-roi.service";
import { CampaignFinanceService } from "@/services/campaign-finance.service";
import type { CampaignFinanceReportData } from "@/lib/campaign-finance";
import prisma from "@/lib/db";
import { AppError } from "@/lib/errors";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe("Campaign Analytics & Funnel Attribution Page Service", () => {
  const mockCampaignId = "camp_analytics_123";
  const ownerUserId = "user_brand_owner_789";
  const otherUserId = "user_hacker_456";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(CampaignFinanceService, "getCampaignFinance").mockResolvedValue({
      campaign: {
        id: mockCampaignId,
        title: "Test Campaign",
        status: "ACTIVE",
        brandName: "Acme Tech",
        targetCategories: ["tech"],
      },
      selectedFy: null,
      availableFys: ["2026-27"],
      summary: {
        budgetTotalPaise: 5000000,
        budgetTotalRupees: "50,000.00",
        budgetFundedPaise: 4000000,
        budgetFundedRupees: "40,000.00",
        escrowLockedPaise: 0,
        escrowLockedRupees: "0.00",
        escrowReleasedPaise: 4000000,
        escrowReleasedRupees: "40,000.00",
        escrowRefundedPaise: 0,
        escrowRefundedRupees: "0.00",
        budgetRemainingPaise: 1000000,
        budgetRemainingRupees: "10,000.00",
        totalPlatformFeePaise: 400000,
        totalPlatformFeeRupees: "4,000.00",
        totalGstOnPlatformFeePaise: 72000,
        totalGstOnPlatformFeeRupees: "720.00",
        totalGatewayFeePaise: 0,
        totalGatewayFeeRupees: "0.00",
        totalGrossPayoutPaise: 3600000,
        totalGrossPayoutRupees: "36,000.00",
        totalTdsDeductedPaise: 3600,
        totalTdsDeductedRupees: "36.00",
        totalNetPayoutPaise: 3596400,
        totalNetPayoutRupees: "35,964.00",
        dealCount: 2,
        activeDealCount: 0,
        completedDealCount: 2,
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
      deals: [],
    } as unknown as CampaignFinanceReportData);
  });

  // =========================================================================
  // 1. OBJECT-LEVEL AUTHORIZATION & IDOR PROTECTION
  // =========================================================================
  describe("1. Object-Level Authorization & IDOR Defense", () => {
    it("allows the campaign owner to retrieve analytics overview", async () => {
      vi.spyOn(CampaignRoiService, "getCampaignRoiReport").mockResolvedValue({
        campaign: {
          id: mockCampaignId,
          title: "Diwali Electronics Festival",
          status: "ACTIVE",
          totalBudgetPaise: 5000000,
          totalBudgetRupees: "50,000",
          targetCategories: ["tech"],
          brandName: "Acme Tech",
        },
        summary: {
          totalSpendPaise: 4000000,
          totalSpendRupees: "40,000",
          totalViews: 80000,
          totalVerifiedViews: 80000,
          totalEstimatedViews: 0,
          hasEstimatedData: false,
          totalEngagements: 4000,
          blendedCPE: "10.00",
          effectiveCpvPaise: 50,
          effectiveCpvRupees: "0.50",
          categoryBaselineCpvPaise: 60,
          categoryBaselineCpvRupees: "0.60",
          activeDealsCount: 2,
          dataQualityStatus: "VERIFIED",
        },
        influencers: [],
        deals: [],
      } as unknown as CampaignRoiReportResult);

      vi.spyOn(prisma.campaignDailyMetric, "findMany").mockResolvedValue([]);
      vi.spyOn(prisma.application, "count").mockResolvedValue(0);
      vi.spyOn(prisma.pageViewEvent, "findMany").mockResolvedValue([]);

      const result = await CampaignMetricsService.getCampaignAnalyticsOverview(
        mockCampaignId,
        ownerUserId,
        false
      );

      expect(result).toBeDefined();
      expect(result.campaign.id).toBe(mockCampaignId);
      expect(result.overview.totalSpendPaise).toBe(4000000);
      expect(result.overview.hasEstimatedData).toBe(false);
    });

    it("allows an active admin to retrieve analytics overview", async () => {
      vi.spyOn(CampaignRoiService, "getCampaignRoiReport").mockResolvedValue({
        campaign: {
          id: mockCampaignId,
          title: "Diwali Electronics Festival",
          status: "ACTIVE",
          totalBudgetPaise: 5000000,
          totalBudgetRupees: "50,000",
          targetCategories: ["tech"],
          brandName: "Acme Tech",
        },
        summary: {
          totalSpendPaise: 4000000,
          totalSpendRupees: "40,000",
          totalViews: 80000,
          totalVerifiedViews: 80000,
          totalEstimatedViews: 0,
          hasEstimatedData: false,
          totalEngagements: 4000,
          blendedCPE: "10.00",
          effectiveCpvPaise: 50,
          effectiveCpvRupees: "0.50",
          categoryBaselineCpvPaise: 60,
          categoryBaselineCpvRupees: "0.60",
          activeDealsCount: 0,
          dataQualityStatus: "VERIFIED",
        },
        influencers: [],
        deals: [],
      } as unknown as CampaignRoiReportResult);

      vi.spyOn(prisma.campaignDailyMetric, "findMany").mockResolvedValue([]);
      vi.spyOn(prisma.application, "count").mockResolvedValue(0);
      vi.spyOn(prisma.pageViewEvent, "findMany").mockResolvedValue([]);

      const result = await CampaignMetricsService.getCampaignAnalyticsOverview(
        mockCampaignId,
        "admin_user_id",
        true
      );

      expect(result).toBeDefined();
      expect(result.campaign.brandName).toBe("Acme Tech");
    });

    it("throws 404 AppError.notFound when unauthorized user tries to access campaign (IDOR)", async () => {
      vi.spyOn(CampaignRoiService, "getCampaignRoiReport").mockRejectedValue(
        AppError.notFound("Campaign not found")
      );

      await expect(
        CampaignMetricsService.getCampaignAnalyticsOverview(
          mockCampaignId,
          otherUserId,
          false
        )
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Campaign not found",
      });
    });
  });

  // =========================================================================
  // 2. EMPTY CAMPAIGN HANDLING (ZERO DIVISION IMMUNITY)
  // =========================================================================
  describe("2. Clean Empty State & Zero Division Immunity", () => {
    it("handles an empty campaign with 0 impressions, 0 apps, 0 deals without NaN or crash", async () => {
      vi.spyOn(CampaignRoiService, "getCampaignRoiReport").mockResolvedValue({
        campaign: {
          id: mockCampaignId,
          title: "Fresh Unlaunched Campaign",
          status: "DRAFT",
          totalBudgetPaise: 10000000,
          totalBudgetRupees: "1,00,000",
          targetCategories: ["lifestyle"],
          brandName: "Organic Living",
        },
        summary: {
          totalSpendPaise: 0,
          totalSpendRupees: "0",
          totalViews: 0,
          totalVerifiedViews: 0,
          totalEstimatedViews: 0,
          hasEstimatedData: false,
          totalEngagements: 0,
          blendedCPE: "0.00",
          effectiveCpvPaise: 0,
          effectiveCpvRupees: "0.00",
          categoryBaselineCpvPaise: 50,
          categoryBaselineCpvRupees: "0.50",
          activeDealsCount: 0,
          dataQualityStatus: "VERIFIED",
        },
        influencers: [],
        deals: [],
      } as unknown as CampaignRoiReportResult);

      vi.spyOn(prisma.campaignDailyMetric, "findMany").mockResolvedValue([]);
      vi.spyOn(prisma.application, "count").mockResolvedValue(0);
      vi.spyOn(prisma.pageViewEvent, "findMany").mockResolvedValue([]);

      const result = await CampaignMetricsService.getCampaignAnalyticsOverview(
        mockCampaignId,
        ownerUserId,
        false
      );

      // Verify no NaN or Infinity in funnel
      expect(result.funnel.briefViews).toBe(0);
      expect(result.funnel.applications).toBe(0);
      expect(result.funnel.viewsToAppPercent).toBe(0);
      expect(result.funnel.appToShortlistPercent).toBe(0);
      expect(result.funnel.shortlistToHirePercent).toBe(0);
      expect(result.funnel.hireToSubmitPercent).toBe(0);
      expect(result.funnel.submitToPostPercent).toBe(0);
      expect(result.funnel.postToCompletePercent).toBe(0);
      expect(result.funnel.overallConversionPercent).toBe(0);

      // Verify audience defaults
      expect(result.audience.deviceSplit).toEqual([]);
      expect(result.audience.avgActiveReadingTimeSec).toBe(0);
      expect(result.audience.bounceRatePercent).toBe(0);
      expect(result.audience.citySplit).toBeNull();

      // Creators list is empty
      expect(result.creators).toEqual([]);
    });
  });

  // =========================================================================
  // 3. FUNNEL STEP-BY-STEP CONVERSION CALCULATIONS
  // =========================================================================
  describe("3. Funnel Pipeline Conversion Math", () => {
    it("accurately calculates conversion steps and dropoff rates", async () => {
      vi.spyOn(CampaignRoiService, "getCampaignRoiReport").mockResolvedValue({
        campaign: {
          id: mockCampaignId,
          title: "Mega Campaign",
          status: "ACTIVE",
          totalBudgetPaise: 20000000,
          totalBudgetRupees: "2,00,000",
          targetCategories: ["fashion"],
          brandName: "Zudio Vibes",
        },
        summary: {
          totalSpendPaise: 15000000,
          totalSpendRupees: "1,50,000",
          totalViews: 300000,
          totalVerifiedViews: 300000,
          totalEstimatedViews: 0,
          hasEstimatedData: false,
          totalEngagements: 15000,
          blendedCPE: "10.00",
          effectiveCpvPaise: 50,
          effectiveCpvRupees: "0.50",
          categoryBaselineCpvPaise: 50,
          categoryBaselineCpvRupees: "0.50",
          activeDealsCount: 5,
          dataQualityStatus: "VERIFIED",
        },
        influencers: [
          {
            dealId: "deal_1",
            influencerId: "inf_1",
            influencer: "Priya Sharma",
            handle: "priya_fashion",
            paid: 3000000,
            paidRupees: "30,000",
            reach: 100000,
            views: 60000,
            predictedViews: 50000,
            viewsVariancePercent: 20,
            deliveryMultiplier: 1.2,
            likes: 2500,
            comments: 300,
            shares: 150,
            saves: 50,
            totalEngagements: 3000,
            engagementRate: 5,
            cpvPaise: 50,
            costPerView: "0.50",
            costPerEngagement: "10.00",
            costPerReach: "0.30",
            isEstimated: false,
            snapshotInterval: "7d",
            isOnTime: true,
            approvalCycleHours: 12.5,
            drsScore: 92,
            actualRoiScore: 88,
          },
        ],
        deals: [],
      } as unknown as CampaignRoiReportResult);

      vi.spyOn(prisma.campaignDailyMetric, "findMany").mockResolvedValue([]);
      // 50 total applications, 20 shortlisted
      vi.spyOn(prisma.application, "count")
        .mockResolvedValueOnce(50) // total applications
        .mockResolvedValueOnce(20); // shortlisted applications

      // 500 brief views
      const mockPageViews = Array.from({ length: 500 }, (_, i) => ({
        sessionHash: `sess_${i}`,
        deviceType: i % 2 === 0 ? "mobile" : "desktop",
        activeMs: 15000,
      }));
      vi.spyOn(prisma.pageViewEvent, "findMany").mockResolvedValue(
        mockPageViews as unknown as import("@prisma/client").PageViewEvent[]
      );

      const result = await CampaignMetricsService.getCampaignAnalyticsOverview(
        mockCampaignId,
        ownerUserId,
        false
      );

      expect(result.funnel.briefViews).toBe(500);
      expect(result.funnel.applications).toBe(50);
      expect(result.funnel.shortlisted).toBe(20);
      expect(result.funnel.hired).toBe(1);

      // Conversion rates:
      // 50 / 500 = 10%
      expect(result.funnel.viewsToAppPercent).toBe(10);
      // 20 / 50 = 40%
      expect(result.funnel.appToShortlistPercent).toBe(40);
      // 1 / 20 = 5%
      expect(result.funnel.shortlistToHirePercent).toBe(5);
      // 1 / 1 = 100%
      expect(result.funnel.hireToSubmitPercent).toBe(100);
      expect(result.funnel.submitToPostPercent).toBe(100);
      expect(result.funnel.postToCompletePercent).toBe(100);
      // Overall 1 / 500 = 0.2%
      expect(result.funnel.overallConversionPercent).toBe(0.2);
    });
  });

  // =========================================================================
  // 4. CREATOR PERFORMANCE & VERDICT CHIPS
  // =========================================================================
  describe("4. Creator Performance Breakdown & Verdict Chips", () => {
    it("assigns appropriate verdicts and identifies small sample size ('Data kam hai')", async () => {
      vi.spyOn(CampaignRoiService, "getCampaignRoiReport").mockResolvedValue({
        campaign: {
          id: mockCampaignId,
          title: "Multi-Creator Test",
          status: "ACTIVE",
          totalBudgetPaise: 10000000,
          totalBudgetRupees: "1,00,000",
          targetCategories: ["fitness"],
          brandName: "FitCore",
        },
        summary: {
          totalSpendPaise: 8000000,
          totalSpendRupees: "80,000",
          totalViews: 45500,
          totalVerifiedViews: 45000,
          totalEstimatedViews: 500,
          hasEstimatedData: true,
          totalEngagements: 2000,
          blendedCPE: "40.00",
          effectiveCpvPaise: 176,
          effectiveCpvRupees: "1.76",
          categoryBaselineCpvPaise: 60,
          categoryBaselineCpvRupees: "0.60",
          activeDealsCount: 4,
          dataQualityStatus: "ESTIMATED",
        },
        influencers: [
          // Creator 1: High ROI (>= 85) -> SUPERIOR ROI, mature sample
          {
            dealId: "deal_superior",
            influencerId: "inf_1",
            influencer: "Rahul Fitness",
            handle: "rahul_fit",
            paid: 2000000,
            paidRupees: "20,000",
            reach: 50000,
            views: 40000,
            predictedViews: 35000,
            viewsVariancePercent: 14.3,
            deliveryMultiplier: 1.14,
            likes: 2000,
            comments: 100,
            shares: 50,
            saves: 20,
            totalEngagements: 2170,
            engagementRate: 5.4,
            cpvPaise: 50,
            costPerView: "0.50",
            costPerEngagement: "9.22",
            costPerReach: "0.40",
            isEstimated: false,
            snapshotInterval: "7d",
            isOnTime: true,
            approvalCycleHours: 8.0,
            drsScore: 95,
            actualRoiScore: 92,
          },
          // Creator 2: Fair ROI (70 - 84) -> FAIR MARKET, mature sample
          {
            dealId: "deal_fair",
            influencerId: "inf_2",
            influencer: "Ananya Yoga",
            handle: "ananya_yoga",
            paid: 2000000,
            paidRupees: "20,000",
            reach: 30000,
            views: 5000,
            predictedViews: 6000,
            viewsVariancePercent: -16.7,
            deliveryMultiplier: 0.83,
            likes: 400,
            comments: 20,
            shares: 10,
            saves: 5,
            totalEngagements: 435,
            engagementRate: 8.7,
            cpvPaise: 400,
            costPerView: "4.00",
            costPerEngagement: "45.98",
            costPerReach: "0.67",
            isEstimated: false,
            snapshotInterval: "7d",
            isOnTime: true,
            approvalCycleHours: 14.0,
            drsScore: 85,
            actualRoiScore: 78,
          },
          // Creator 3: Moderate ROI (50 - 69) -> MODERATE, small sample (< 1,000 views)
          {
            dealId: "deal_moderate",
            influencerId: "inf_3",
            influencer: "Sam Nutrition",
            handle: "sam_nutri",
            paid: 2000000,
            paidRupees: "20,000",
            reach: 2000,
            views: 500, // < 1,000 views!
            predictedViews: 4000,
            viewsVariancePercent: -87.5,
            deliveryMultiplier: 0.125,
            likes: 50,
            comments: 5,
            shares: 2,
            saves: 1,
            totalEngagements: 58,
            engagementRate: 11.6,
            cpvPaise: 4000,
            costPerView: "40.00",
            costPerEngagement: "344.83",
            costPerReach: "10.00",
            isEstimated: true,
            snapshotInterval: "24h",
            isOnTime: false,
            approvalCycleHours: 36.0,
            drsScore: 68,
            actualRoiScore: 55,
          },
          // Creator 4: Low ROI (< 50) -> OVERPRICED
          {
            dealId: "deal_overpriced",
            influencerId: "inf_4",
            influencer: "Kunal Gym",
            handle: "kunal_gym",
            paid: 2000000,
            paidRupees: "20,000",
            reach: 1000,
            views: 0,
            predictedViews: 5000,
            viewsVariancePercent: -100,
            deliveryMultiplier: 0,
            likes: 0,
            comments: 0,
            shares: 0,
            saves: 0,
            totalEngagements: 0,
            engagementRate: 0,
            cpvPaise: 0,
            costPerView: "0.00",
            costPerEngagement: "0.00",
            costPerReach: "0.00",
            isEstimated: false,
            snapshotInterval: "none",
            isOnTime: false,
            approvalCycleHours: 0,
            drsScore: 40,
            actualRoiScore: 35,
          },
        ],
        deals: [],
      } as unknown as CampaignRoiReportResult);

      vi.spyOn(prisma.campaignDailyMetric, "findMany").mockResolvedValue([]);
      vi.spyOn(prisma.application, "count").mockResolvedValue(4);
      vi.spyOn(prisma.pageViewEvent, "findMany").mockResolvedValue([]);

      const result = await CampaignMetricsService.getCampaignAnalyticsOverview(
        mockCampaignId,
        ownerUserId,
        false
      );

      expect(result.creators).toHaveLength(4);

      const [rahul, ananya, sam, kunal] = result.creators;

      // Rahul: SUPERIOR ROI, mature sample
      expect(rahul?.verdict).toBe("SUPERIOR ROI");
      expect(rahul?.isSmallSample).toBe(false);
      expect(rahul?.isEstimated).toBe(false);

      // Ananya: FAIR MARKET, mature sample
      expect(ananya?.verdict).toBe("FAIR MARKET");
      expect(ananya?.isSmallSample).toBe(false);

      // Sam: MODERATE, small sample (< 1000 views)
      expect(sam?.verdict).toBe("MODERATE");
      expect(sam?.isSmallSample).toBe(true);
      expect(sam?.isEstimated).toBe(true);

      // Kunal: OVERPRICED, 0 views
      expect(kunal?.verdict).toBe("OVERPRICED");
      expect(kunal?.isSmallSample).toBe(true);
    });
  });

  // =========================================================================
  // 5. AUDIENCE TELEMETRY (DEVICE SPLIT & DWELL TIME)
  // =========================================================================
  describe("5. Audience Telemetry & Dwell Time Calculation", () => {
    it("computes device split, dwell time, and bounce rate accurately", async () => {
      vi.spyOn(CampaignRoiService, "getCampaignRoiReport").mockResolvedValue({
        campaign: {
          id: mockCampaignId,
          title: "Audience Telemetry Test",
          status: "ACTIVE",
          totalBudgetPaise: 5000000,
          totalBudgetRupees: "50,000",
          targetCategories: ["tech"],
          brandName: "GadgetWorld",
        },
        summary: {
          totalSpendPaise: 1000000,
          totalSpendRupees: "10,000",
          totalViews: 20000,
          totalVerifiedViews: 20000,
          totalEstimatedViews: 0,
          hasEstimatedData: false,
          totalEngagements: 1000,
          blendedCPE: "10.00",
          effectiveCpvPaise: 50,
          effectiveCpvRupees: "0.50",
          categoryBaselineCpvPaise: 50,
          categoryBaselineCpvRupees: "0.50",
          activeDealsCount: 1,
          dataQualityStatus: "VERIFIED",
        },
        influencers: [],
        deals: [],
      } as unknown as CampaignRoiReportResult);

      vi.spyOn(prisma.campaignDailyMetric, "findMany").mockResolvedValue([]);
      vi.spyOn(prisma.application, "count").mockResolvedValue(0);

      // 4 page views: 3 mobile (25s, 35s, 5s), 1 desktop (15s)
      // Total visitors = 4
      // Mobile = 3 (75%), Desktop = 1 (25%)
      // Total dwell ms = 25000 + 35000 + 5000 + 15000 = 80000 ms -> avg 20s
      // Bounces (<10s active) = 1 (the 5s mobile visit) -> bounce rate 25%
      vi.spyOn(prisma.pageViewEvent, "findMany").mockResolvedValue([
        { sessionHash: "s1", deviceType: "mobile", activeMs: 25000 },
        { sessionHash: "s2", deviceType: "mobile", activeMs: 35000 },
        { sessionHash: "s3", deviceType: "mobile", activeMs: 5000 },
        { sessionHash: "s4", deviceType: "desktop", activeMs: 15000 },
      ] as unknown as import("@prisma/client").PageViewEvent[]);

      const result = await CampaignMetricsService.getCampaignAnalyticsOverview(
        mockCampaignId,
        ownerUserId,
        false
      );

      expect(result.audience.deviceSplit).toHaveLength(2);
      expect(result.audience.deviceSplit[0]?.device).toBe("Mobile");
      expect(result.audience.deviceSplit[0]?.visitors).toBe(3);
      expect(result.audience.deviceSplit[0]?.percentage).toBe(75);

      expect(result.audience.deviceSplit[1]?.device).toBe("Desktop");
      expect(result.audience.deviceSplit[1]?.visitors).toBe(1);
      expect(result.audience.deviceSplit[1]?.percentage).toBe(25);

      expect(result.audience.avgActiveReadingTimeSec).toBe(20);
      expect(result.audience.bounceRatePercent).toBe(25);
      expect(result.audience.citySplit).toBeNull();
    });
  });
});
