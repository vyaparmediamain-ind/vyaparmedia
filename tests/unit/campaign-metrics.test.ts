import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  aggregateCampaignDailyMetrics,
  calculateDerivedCampaignMetrics,
  isApiQualitySnapshot,
  selectBestSnapshot,
  getKolkataDayBounds,
  type RawCampaignApplication,
  type RawCampaignDeal,
  type RawCampaignSubmission,
  type RawCampaignSnapshot,
  type RawCampaignPageView,
  type RawCampaignPaymentHold,
} from "@/lib/campaign-aggregator";
import { CampaignMetricsService } from "@/services/campaign-metrics.service";
import prisma from "@/lib/db";
import { AppError } from "@/lib/errors";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe("Campaign Daily Metrics & Funnel Aggregator", () => {
  const targetDate = new Date("2026-11-20T12:00:00.000Z"); // Within Nov 20, 2026 IST
  const { dayStart } = getKolkataDayBounds(targetDate);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. IST DAY BOUNDARIES & TIMEZONE CONSISTENCY
  // =========================================================================
  describe("1. Asia/Kolkata Day Boundary Calculations", () => {
    it("correctly computes UTC bounds for Asia/Kolkata (+05:30) calendar day", () => {
      // Nov 20 2026 in IST runs from Nov 19 18:30:00 UTC to Nov 20 18:30:00 UTC
      const bounds = getKolkataDayBounds(new Date("2026-11-20T10:00:00.000Z"));
      expect(bounds.dateStr).toBe("2026-11-20");
      expect(bounds.dayStart.toISOString()).toBe("2026-11-19T18:30:00.000Z");
      expect(bounds.dayEnd.toISOString()).toBe("2026-11-20T18:30:00.000Z");
    });

    it("correctly handles early morning UTC that belongs to previous IST calendar day", () => {
      // Nov 20 02:00:00 UTC is Nov 20 07:30:00 IST
      const bounds = getKolkataDayBounds(new Date("2026-11-20T02:00:00.000Z"));
      expect(bounds.dateStr).toBe("2026-11-20");

      // Nov 19 18:00:00 UTC is Nov 19 23:30:00 IST (still Nov 19)
      const prevBounds = getKolkataDayBounds(new Date("2026-11-19T18:00:00.000Z"));
      expect(prevBounds.dateStr).toBe("2026-11-19");
    });
  });

  // =========================================================================
  // 2. MATURE SNAPSHOT SELECTION & API-QUALITY CLASSIFICATION
  // =========================================================================
  describe("2. Snapshot Quality & Selection Hierarchy", () => {
    it("prefers 7d snapshot over 48h, 24h, or fallback", () => {
      const snapshots: RawCampaignSnapshot[] = [
        {
          id: "s1",
          dealId: "d1",
          interval: "24h",
          views: 1000,
          likes: 50,
          comments: 10,
          shares: 5,
          saves: 5,
          clicks: 20,
          isEstimated: true,
          capturedAt: new Date("2026-11-18T10:00:00Z"),
        },
        {
          id: "s2",
          dealId: "d1",
          interval: "48h",
          views: 2500,
          likes: 120,
          comments: 25,
          shares: 10,
          saves: 15,
          clicks: 45,
          isEstimated: true,
          capturedAt: new Date("2026-11-19T10:00:00Z"),
        },
        {
          id: "s3",
          dealId: "d1",
          interval: "7d",
          views: 5000,
          likes: 250,
          comments: 50,
          shares: 20,
          saves: 30,
          clicks: 90,
          isEstimated: false,
          capturedAt: new Date("2026-11-20T10:00:00Z"),
        },
      ];

      const best = selectBestSnapshot(snapshots);
      expect(best?.id).toBe("s3");
      expect(best?.interval).toBe("7d");
      expect(best?.views).toBe(5000);
    });

    it("correctly identifies API-verified snapshots vs estimated snapshots", () => {
      const apiSnap: RawCampaignSnapshot = {
        id: "s_api",
        dealId: "d1",
        interval: "7d",
        views: 10000,
        likes: 500,
        comments: 100,
        shares: 50,
        saves: 50,
        clicks: 100,
        isEstimated: false,
        capturedAt: new Date(),
      };

      const metaQualitySnap: RawCampaignSnapshot = {
        id: "s_meta",
        dealId: "d1",
        interval: "7d",
        views: 10000,
        likes: 500,
        comments: 100,
        shares: 50,
        saves: 50,
        clicks: 100,
        isEstimated: true,
        metricsQuality: { views: "API" },
        capturedAt: new Date(),
      };

      const estimatedSnap: RawCampaignSnapshot = {
        id: "s_est",
        dealId: "d1",
        interval: "7d",
        views: 8000,
        likes: 400,
        comments: 80,
        shares: 40,
        saves: 40,
        clicks: 80,
        isEstimated: true,
        metricsQuality: { views: "DERIVED" },
        capturedAt: new Date(),
      };

      expect(isApiQualitySnapshot(apiSnap)).toBe(true);
      expect(isApiQualitySnapshot(metaQualitySnap)).toBe(true);
      expect(isApiQualitySnapshot(estimatedSnap)).toBe(false);
    });
  });

  // =========================================================================
  // 3. DAILY AGGREGATION & CANCELLED DEAL EXCLUSION
  // =========================================================================
  describe("3. Funnel Rollups & Strict Exclusion of Cancelled Deals", () => {
    it("aggregates daily metrics and strictly excludes cancelled/refunded deals", () => {
      const midDay = new Date("2026-11-20T08:00:00.000Z"); // Inside day

      const applications: RawCampaignApplication[] = [
        { id: "app1", status: "PENDING", createdAt: midDay, updatedAt: midDay },
        { id: "app2", status: "SHORTLISTED", createdAt: midDay, updatedAt: midDay },
      ];

      const deals: RawCampaignDeal[] = [
        // Valid active deal
        {
          id: "deal_active",
          status: "COMPLETED",
          amount: 500000, // ₹5,000
          platformFee: 50000, // ₹500
          completedAt: midDay,
          createdAt: midDay,
          updatedAt: midDay,
        },
        // Cancelled deal (should be completely omitted from spend, views, hired count)
        {
          id: "deal_cancelled",
          status: "CANCELLED",
          amount: 800000, // ₹8,000
          platformFee: 80000,
          completedAt: midDay,
          createdAt: midDay,
          updatedAt: midDay,
        },
      ];

      const submissions: RawCampaignSubmission[] = [
        {
          id: "sub1",
          dealId: "deal_active",
          status: "APPROVED",
          submittedAt: midDay,
          reviewedAt: midDay,
        },
        // Submission on cancelled deal -> omitted
        {
          id: "sub2",
          dealId: "deal_cancelled",
          status: "REVISION_REQUESTED",
          submittedAt: midDay,
          reviewedAt: midDay,
        },
      ];

      const snapshots: RawCampaignSnapshot[] = [
        // Verified snapshot for active deal: 40,000 views
        {
          id: "snap1",
          dealId: "deal_active",
          interval: "7d",
          views: 40000,
          likes: 2000,
          comments: 400,
          shares: 200,
          saves: 200,
          clicks: 500,
          isEstimated: false,
          capturedAt: midDay,
        },
        // Snapshot on cancelled deal (50,000 views) -> MUST BE EXCLUDED
        {
          id: "snap2",
          dealId: "deal_cancelled",
          interval: "7d",
          views: 50000,
          likes: 3000,
          comments: 500,
          shares: 300,
          saves: 300,
          clicks: 600,
          isEstimated: false,
          capturedAt: midDay,
        },
      ];

      const pageViews: RawCampaignPageView[] = [
        { id: "pv1", sessionHash: "sess_a", activeMs: 15000, createdAt: midDay },
        { id: "pv2", sessionHash: "sess_b", activeMs: 25000, createdAt: midDay },
        { id: "pv3", sessionHash: "sess_a", activeMs: 10000, createdAt: midDay }, // Duplicate session
      ];

      const paymentHolds: RawCampaignPaymentHold[] = [
        {
          id: "hold1",
          dealId: "deal_active",
          amount: 500000,
          status: "RELEASED",
          createdAt: midDay,
          releasedAt: midDay,
        },
        // Hold on cancelled deal
        {
          id: "hold2",
          dealId: "deal_cancelled",
          amount: 800000,
          status: "RELEASED",
          createdAt: midDay,
          releasedAt: midDay,
        },
      ];

      const result = aggregateCampaignDailyMetrics({
        campaignId: "camp_123",
        date: targetDate,
        applications,
        deals,
        submissions,
        snapshots,
        pageViews,
        transactions: [],
        paymentHolds,
      });

      // 1. Brief Page Views: 3 page views, 2 unique visitors
      expect(result.briefViews).toBe(3);
      expect(result.uniqueBriefViewers).toBe(2);

      // 2. Applications & Funnel
      expect(result.applications).toBe(2);
      expect(result.shortlisted).toBe(1);
      expect(result.hired).toBe(1); // Only active deal counted; cancelled excluded
      expect(result.contentSubmitted).toBe(1);

      // 3. Delivered Views & Snapshots: Only active deal (40,000 views, 2,800 engagements)
      expect(result.deliveredViews).toBe(BigInt(40000));
      expect(result.engagements).toBe(BigInt(2800));
      expect(result.apiViewsShareBps).toBe(10000); // 100% API quality

      // 4. Financials: Only active deal (₹5,000 released, ₹500 fee; cancelled omitted)
      expect(result.escrowFundedPaise).toBe(BigInt(500000));
      expect(result.escrowReleasedPaise).toBe(BigInt(500000));
      expect(result.platformFeePaise).toBe(BigInt(50000));
    });
  });

  // =========================================================================
  // 4. MIXED REAL / ESTIMATED SNAPSHOTS & DATA QUALITY PROPAGATION
  // =========================================================================
  describe("4. Mixed Real and Estimated Views Data Quality", () => {
    it("computes apiViewsShareBps accurately and sets ESTIMATED when views are mixed", () => {
      const midDay = new Date("2026-11-20T08:00:00.000Z");

      const deals: RawCampaignDeal[] = [
        {
          id: "deal_api",
          status: "COMPLETED",
          amount: 200000,
          platformFee: 20000,
          createdAt: midDay,
          updatedAt: midDay,
        },
        {
          id: "deal_est",
          status: "COMPLETED",
          amount: 300000,
          platformFee: 30000,
          createdAt: midDay,
          updatedAt: midDay,
        },
      ];

      const snapshots: RawCampaignSnapshot[] = [
        // 30,000 API-verified views
        {
          id: "s_api",
          dealId: "deal_api",
          interval: "7d",
          views: 30000,
          likes: 1500,
          comments: 200,
          shares: 50,
          saves: 50,
          clicks: 100,
          isEstimated: false,
          capturedAt: midDay,
        },
        // 70,000 estimated views
        {
          id: "s_est",
          dealId: "deal_est",
          interval: "7d",
          views: 70000,
          likes: 3500,
          comments: 400,
          shares: 100,
          saves: 100,
          clicks: 200,
          isEstimated: true,
          capturedAt: midDay,
        },
      ];

      const daily = aggregateCampaignDailyMetrics({
        campaignId: "camp_mixed",
        date: targetDate,
        applications: [],
        deals,
        submissions: [],
        snapshots,
        pageViews: [],
        transactions: [],
        paymentHolds: [],
      });

      // Total views = 100,000, API views = 30,000 -> 30.0% -> 3,000 bps
      expect(daily.deliveredViews).toBe(BigInt(100000));
      expect(daily.apiViewsShareBps).toBe(3000);

      const derived = calculateDerivedCampaignMetrics({
        totalSpendPaise: 500000, // ₹5,000
        deliveredViews: Number(daily.deliveredViews),
        apiViewsShareBps: daily.apiViewsShareBps,
        engagements: Number(daily.engagements),
        categoryOrBaseline: "tech",
        deals,
        submissions: [],
      });

      // Blended CPV = ₹5,000 / 100,000 = 5 paise / view
      expect(derived.blendedCpvPaise.value).toBe(5);
      // Because views are mixed (apiViewsShareBps < 10,000), data quality is ESTIMATED
      expect(derived.blendedCpvPaise.dataQuality).toBe("ESTIMATED");
      expect(derived.totalDeliveredViews.dataQuality).toBe("ESTIMATED");
    });

    it("assigns VERIFIED data quality when 100% of delivered views are from API snapshots", () => {
      const derived = calculateDerivedCampaignMetrics({
        totalSpendPaise: 600000,
        deliveredViews: 50000,
        apiViewsShareBps: 10000, // 100% API
        engagements: 2500,
        categoryOrBaseline: "fashion",
        deals: [],
        submissions: [],
      });

      expect(derived.blendedCpvPaise.value).toBe(12); // 600,000 / 50,000 = 12 paise
      expect(derived.blendedCpvPaise.dataQuality).toBe("VERIFIED");
      expect(derived.totalDeliveredViews.dataQuality).toBe("VERIFIED");
      expect(derived.cpePaise.value).toBe(240); // 600,000 / 2,500 = 240 paise
      expect(derived.cpePaise.dataQuality).toBe("VERIFIED");
    });
  });

  // =========================================================================
  // 5. BOUNDARY CONDITIONS: ZERO-VIEW HANDLING & RATE FORMULAS
  // =========================================================================
  describe("5. Boundary Conditions, Zero Views & Derived Rates", () => {
    it("handles zero views gracefully without NaN or divide-by-zero errors", () => {
      const derived = calculateDerivedCampaignMetrics({
        totalSpendPaise: 100000,
        deliveredViews: 0,
        apiViewsShareBps: 0,
        engagements: 0,
        categoryOrBaseline: "beauty",
        deals: [],
        submissions: [],
      });

      expect(derived.blendedCpvPaise.value).toBe(0);
      expect(derived.blendedCpvPaise.dataQuality).toBe("ESTIMATED");
      expect(derived.cpePaise.value).toBe(0);
      expect(derived.cpePaise.dataQuality).toBe("ESTIMATED");
      expect(derived.roiScore.value).toBe(0); // 0 views delivered returns 0 ROI score sentinel
    });

    it("calculates on-time delivery rate, approval cycle time, and revision rate", () => {
      const now = new Date("2026-11-20T10:00:00Z");
      const subDate = new Date("2026-11-18T10:00:00Z");
      const revDate = new Date("2026-11-18T16:00:00Z"); // 6 hours review duration

      const deals: RawCampaignDeal[] = [
        // On time deal
        {
          id: "d1",
          status: "COMPLETED",
          amount: 100000,
          platformFee: 10000,
          postingDeadline: new Date("2026-11-19T10:00:00Z"),
          completedAt: new Date("2026-11-18T10:00:00Z"),
          createdAt: now,
          updatedAt: now,
        },
        // Late deal
        {
          id: "d2",
          status: "COMPLETED",
          amount: 100000,
          platformFee: 10000,
          postingDeadline: new Date("2026-11-17T10:00:00Z"),
          completedAt: new Date("2026-11-18T10:00:00Z"),
          createdAt: now,
          updatedAt: now,
        },
      ];

      const submissions: RawCampaignSubmission[] = [
        {
          id: "sub1",
          dealId: "d1",
          status: "APPROVED",
          submittedAt: subDate,
          reviewedAt: revDate, // 6 hours
        },
        {
          id: "sub2",
          dealId: "d2",
          status: "REVISION_REQUESTED",
          submittedAt: subDate,
          reviewedAt: revDate, // 6 hours
        },
      ];

      const derived = calculateDerivedCampaignMetrics({
        totalSpendPaise: 200000,
        deliveredViews: 20000,
        apiViewsShareBps: 10000,
        engagements: 1000,
        categoryOrBaseline: "education",
        deals,
        submissions,
      });

      // 1 on time out of 2 deals -> 50.0% -> 5,000 bps
      expect(derived.onTimeDeliveryRateBps.value).toBe(5000);
      expect(derived.onTimeDeliveryRatePercent.value).toBe(50);
      expect(derived.onTimeDeliveryRateBps.dataQuality).toBe("VERIFIED");

      // 6 hours average approval cycle
      expect(derived.approvalCycleTimeHours.value).toBe(6);
      expect(derived.approvalCycleTimeHours.dataQuality).toBe("VERIFIED");

      // 1 revision requested out of 2 submissions -> 50.0% -> 5,000 bps
      expect(derived.revisionRateBps.value).toBe(5000);
      expect(derived.revisionRatePercent.value).toBe(50);
      expect(derived.revisionRateBps.dataQuality).toBe("VERIFIED");
    });
  });

  // =========================================================================
  // 6. OBJECT-LEVEL AUTHORIZATION & SERVICE-LEVEL IDOR PROTECTION
  // =========================================================================
  describe("6. Object-Level Authorization & Service Security", () => {
    it("throws 404 AppError.notFound when campaign is not found", async () => {
      vi.spyOn(prisma.campaign, "findUnique").mockResolvedValue(null);

      await expect(
        CampaignMetricsService.getCampaignMetrics("non_existent_campaign")
      ).rejects.toThrow(AppError);

      await expect(
        CampaignMetricsService.getCampaignMetrics("non_existent_campaign")
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Campaign not found",
      });
    });

    it("throws 404 AppError.notFound when caller does not own the campaign (IDOR)", async () => {
      vi.spyOn(prisma.campaign, "findUnique").mockResolvedValue({
        id: "camp_123",
        title: "Winter Festival Sale",
        status: "ACTIVE",
        totalBudget: 1000000,
        targetCategories: ["tech"],
        brandId: "brand_profile_1",
        brand: { userId: "user_brand_owner" },
      } as unknown as import("@prisma/client").Campaign);

      await expect(
        CampaignMetricsService.getCampaignMetrics("camp_123", {
          userId: "user_unauthorized_attacker",
        })
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Campaign not found",
      });
    });

    it("idempotently upserts metrics without duplication", async () => {
      vi.spyOn(prisma.campaign, "findUnique").mockResolvedValue({
        id: "camp_idempotent",
        brandId: "brand_1",
      } as unknown as import("@prisma/client").Campaign);

      vi.spyOn(prisma.application, "findMany").mockResolvedValue([]);
      vi.spyOn(prisma.deal, "findMany").mockResolvedValue([]);
      vi.spyOn(prisma.contentSubmission, "findMany").mockResolvedValue([]);
      vi.spyOn(prisma.engagementSnapshot, "findMany").mockResolvedValue([]);
      vi.spyOn(prisma.pageViewEvent, "findMany").mockResolvedValue([]);
      vi.spyOn(prisma.transaction, "findMany").mockResolvedValue([]);
      vi.spyOn(prisma.paymentHold, "findMany").mockResolvedValue([]);

      const upsertSpy = vi.spyOn(prisma.campaignDailyMetric, "upsert").mockResolvedValue({
        campaignId: "camp_idempotent",
        date: dayStart,
        briefViews: 0,
        uniqueBriefViewers: 0,
        applications: 0,
        shortlisted: 0,
        hired: 0,
        contentSubmitted: 0,
        postsLive: 0,
        deliveredViews: BigInt(0),
        apiViewsShareBps: 0,
        engagements: BigInt(0),
        escrowFundedPaise: BigInt(0),
        escrowReleasedPaise: BigInt(0),
        platformFeePaise: BigInt(0),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Run twice for the exact same day
      await CampaignMetricsService.aggregateCampaignForDay("camp_idempotent", targetDate);
      await CampaignMetricsService.aggregateCampaignForDay("camp_idempotent", targetDate);

      expect(upsertSpy).toHaveBeenCalledTimes(2);
      expect(upsertSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: {
            campaignId_date: {
              campaignId: "camp_idempotent",
              date: dayStart,
            },
          },
        })
      );
    });
  });
});
