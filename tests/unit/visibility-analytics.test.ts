import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  calculateVisibilityTrend,
  applySmallNumberSuppression,
  filterAndFormatIdentifiedBrandViewers,
  calculateViewsToConversionRate,
  calculateApplicationsPer100Views,
  rankBestCategories,
  type RawBrandViewer,
} from "@/lib/visibility-analytics";
import { VisibilityAnalyticsService } from "@/services/visibility-analytics.service";
import prisma from "@/lib/db";
import { AppError } from "@/lib/errors";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/cache", () => ({
  cache: vi.fn((_key: string, fetcher: () => Promise<unknown>) => fetcher()),
}));

describe("Visibility Analytics Engine & Privacy Controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. SMALL-NUMBER SUPPRESSION (<5 PRIVACY RULE)
  // =========================================================================
  describe("1. Small-Number Suppression (<5 Privacy Rule)", () => {
    it("suppresses counts strictly under 5 to '<5'", () => {
      expect(applySmallNumberSuppression(0)).toBe("<5");
      expect(applySmallNumberSuppression(1)).toBe("<5");
      expect(applySmallNumberSuppression(2)).toBe("<5");
      expect(applySmallNumberSuppression(3)).toBe("<5");
      expect(applySmallNumberSuppression(4)).toBe("<5");
    });

    it("displays exact counts when count is 5 or greater", () => {
      expect(applySmallNumberSuppression(5)).toBe("5");
      expect(applySmallNumberSuppression(6)).toBe("6");
      expect(applySmallNumberSuppression(42)).toBe("42");
      expect(applySmallNumberSuppression(1000)).toBe("1000");
    });

    it("handles custom threshold configuration correctly", () => {
      expect(applySmallNumberSuppression(9, 10)).toBe("<10");
      expect(applySmallNumberSuppression(10, 10)).toBe("10");
    });
  });

  // =========================================================================
  // 2. IDENTIFIED BRAND VIEWERS & CONSENT ENFORCEMENT
  // =========================================================================
  describe("2. Telemetry Consent & Brand Identity Masking", () => {
    const rawEvents: RawBrandViewer[] = [
      // Consenting Brand A with 6 views
      {
        userId: "user_brand_1",
        role: "BRAND",
        telemetryConsent: true,
        companyName: "Mamaearth Naturals",
        activeMs: 15000,
        createdAt: new Date("2026-11-20T10:00:00Z"),
      },
      {
        userId: "user_brand_1",
        role: "BRAND",
        telemetryConsent: true,
        companyName: "Mamaearth Naturals",
        activeMs: 12000,
        createdAt: new Date("2026-11-20T10:05:00Z"),
      },
      {
        userId: "user_brand_1",
        role: "BRAND",
        telemetryConsent: true,
        companyName: "Mamaearth Naturals",
        activeMs: 14000,
        createdAt: new Date("2026-11-20T10:10:00Z"),
      },
      {
        userId: "user_brand_1",
        role: "BRAND",
        telemetryConsent: true,
        companyName: "Mamaearth Naturals",
        activeMs: 11000,
        createdAt: new Date("2026-11-20T10:15:00Z"),
      },
      {
        userId: "user_brand_1",
        role: "BRAND",
        telemetryConsent: true,
        companyName: "Mamaearth Naturals",
        activeMs: 16000,
        createdAt: new Date("2026-11-20T10:20:00Z"),
      },
      {
        userId: "user_brand_1",
        role: "BRAND",
        telemetryConsent: true,
        companyName: "Mamaearth Naturals",
        activeMs: 18000,
        createdAt: new Date("2026-11-20T10:25:00Z"),
      },

      // Consenting Brand B with 2 views (<5 suppression)
      {
        userId: "user_brand_2",
        role: "BRAND",
        telemetryConsent: true,
        companyName: "Boat Audio",
        activeMs: 9000,
        createdAt: new Date("2026-11-21T11:00:00Z"),
      },
      {
        userId: "user_brand_2",
        role: "BRAND",
        telemetryConsent: true,
        companyName: "Boat Audio",
        activeMs: 8000,
        createdAt: new Date("2026-11-21T11:02:00Z"),
      },

      // Non-consenting Brand (telemetryConsent: false) -> MUST BE OMITTED
      {
        userId: "user_brand_no_consent",
        role: "BRAND",
        telemetryConsent: false,
        companyName: "Secret Stealth Brand",
        activeMs: 5000,
        createdAt: new Date("2026-11-21T12:00:00Z"),
      },

      // Non-brand user (e.g. INFLUENCER) -> MUST BE OMITTED
      {
        userId: "user_influencer_peeking",
        role: "INFLUENCER",
        telemetryConsent: true,
        companyName: null,
        activeMs: 7000,
        createdAt: new Date("2026-11-21T13:00:00Z"),
      },

      // Empty / missing company name -> MUST BE OMITTED
      {
        userId: "user_brand_missing_name",
        role: "BRAND",
        telemetryConsent: true,
        companyName: "   ",
        activeMs: 3000,
        createdAt: new Date("2026-11-21T14:00:00Z"),
      },
    ];

    it("filters strictly to consenting brand users and omits non-consenting or non-brand viewers", () => {
      const result = filterAndFormatIdentifiedBrandViewers(rawEvents);

      // Only Brand 1 (Mamaearth) and Brand 2 (Boat Audio)
      expect(result.identifiedBrands).toHaveLength(2);
      const brandNames = result.identifiedBrands.map((b) => b.companyName);
      expect(brandNames).toContain("Mamaearth Naturals");
      expect(brandNames).toContain("Boat Audio");
      expect(brandNames).not.toContain("Secret Stealth Brand");
    });

    it("masks individual brand views to '<5' when views < 5", () => {
      const result = filterAndFormatIdentifiedBrandViewers(rawEvents);
      const boatBrand = result.identifiedBrands.find((b) => b.companyName === "Boat Audio");
      expect(boatBrand).toBeDefined();
      expect(boatBrand?.isSuppressed).toBe(true);
      expect(boatBrand?.viewsDisplay).toBe("<5");
      expect(boatBrand?.viewsCount).toBe(2);

      const mamaearthBrand = result.identifiedBrands.find((b) => b.companyName === "Mamaearth Naturals");
      expect(mamaearthBrand).toBeDefined();
      expect(mamaearthBrand?.isSuppressed).toBe(false);
      expect(mamaearthBrand?.viewsDisplay).toBe("6");
      expect(mamaearthBrand?.viewsCount).toBe(6);
    });

    it("sets isSmallNumberSuppressed to true when total distinct brand viewers is less than 5", () => {
      const result = filterAndFormatIdentifiedBrandViewers(rawEvents);
      // Only 2 distinct brands found (< 5 threshold)
      expect(result.isSmallNumberSuppressed).toBe(true);
      expect(result.totalIdentifiedBrandsCount).toBe(2);
    });

    it("sets isSmallNumberSuppressed to false when 5 or more distinct brands viewed", () => {
      const manyBrands: RawBrandViewer[] = Array.from({ length: 6 }, (_, i) => ({
        userId: `brand_${i}`,
        role: "BRAND",
        telemetryConsent: true,
        companyName: `Brand ${i} Ltd`,
        activeMs: 10000,
        createdAt: new Date(),
      }));

      const result = filterAndFormatIdentifiedBrandViewers(manyBrands);
      expect(result.identifiedBrands).toHaveLength(6);
      expect(result.isSmallNumberSuppressed).toBe(false);
      expect(result.totalIdentifiedBrandsCount).toBe(6);
    });
  });

  // =========================================================================
  // 3. TREND & CONVERSION MATHEMATICS
  // =========================================================================
  describe("3. Trend and Rate Calculation Logic", () => {
    it("calculates positive trend percentage and basis points", () => {
      const trend = calculateVisibilityTrend(150, 100);
      expect(trend.trendPercent).toBe(50);
      expect(trend.trendBps).toBe(5000);
      expect(trend.direction).toBe("up");
    });

    it("calculates negative trend percentage and basis points", () => {
      const trend = calculateVisibilityTrend(75, 100);
      expect(trend.trendPercent).toBe(-25);
      expect(trend.trendBps).toBe(-2500);
      expect(trend.direction).toBe("down");
    });

    it("handles zero previous views gracefully as 100% positive growth", () => {
      const trend = calculateVisibilityTrend(25, 0);
      expect(trend.trendPercent).toBe(100);
      expect(trend.trendBps).toBe(10000);
      expect(trend.direction).toBe("up");
    });

    it("handles zero both current and previous as 0.0%", () => {
      const trend = calculateVisibilityTrend(0, 0);
      expect(trend.trendPercent).toBe(0);
      expect(trend.trendBps).toBe(0);
      expect(trend.direction).toBe("flat");
    });

    it("calculates views to conversion rate in percent and basis points", () => {
      const conv = calculateViewsToConversionRate(200, 10);
      expect(conv.conversionRatePercent).toBe(5);
      expect(conv.conversionRateBps).toBe(500);

      const zeroConv = calculateViewsToConversionRate(0, 5);
      expect(zeroConv.conversionRatePercent).toBe(0);
      expect(zeroConv.conversionRateBps).toBe(0);
    });

    it("calculates applications per 100 views correctly", () => {
      const rate = calculateApplicationsPer100Views(250, 15);
      // 15 / 250 * 100 = 6.0
      expect(rate.applicationsPer100Views).toBe(6);
      expect(rate.applicationsRateBps).toBe(600);

      const zeroRate = calculateApplicationsPer100Views(0, 10);
      expect(zeroRate.applicationsPer100Views).toBe(0);
      expect(zeroRate.applicationsRateBps).toBe(0);
    });

    it("ranks best categories with count and percentage share", () => {
      const categories = [
        "Tech",
        "Fashion",
        "Tech",
        "Lifestyle",
        "Tech",
        "Fashion",
      ];
      const ranked = rankBestCategories(categories);

      expect(ranked).toHaveLength(3);
      expect(ranked[0]).toEqual({
        category: "Tech",
        applicationsCount: 3,
        percentShare: 50,
      });
      expect(ranked[1]).toEqual({
        category: "Fashion",
        applicationsCount: 2,
        percentShare: 33.3,
      });
      expect(ranked[2]).toEqual({
        category: "Lifestyle",
        applicationsCount: 1,
        percentShare: 16.7,
      });
    });
  });

  // =========================================================================
  // 4. OBJECT-LEVEL AUTHORIZATION & IDOR GUARDS
  // =========================================================================
  describe("4. Object-Level Authorization (IDOR Protection)", () => {
    it("throws 404 AppError.notFound when creator profile is not found", async () => {
      vi.spyOn(prisma.influencerProfile, "findUnique").mockResolvedValue(null);

      await expect(
        VisibilityAnalyticsService.getCreatorVisibilityStats("invalid_creator_id")
      ).rejects.toThrow(AppError);

      await expect(
        VisibilityAnalyticsService.getCreatorVisibilityStats("invalid_creator_id")
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Creator profile not found",
      });
    });

    it("throws 404 AppError.notFound when brand profile is not found", async () => {
      vi.spyOn(prisma.brandProfile, "findUnique").mockResolvedValue(null);

      await expect(
        VisibilityAnalyticsService.getBrandCampaignVisibilityStats("invalid_brand_id")
      ).rejects.toThrow(AppError);

      await expect(
        VisibilityAnalyticsService.getBrandCampaignVisibilityStats("invalid_brand_id")
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Brand profile not found",
      });
    });

    it("restricts creator metrics strictly to targetInfluencerId matching authenticated creator", async () => {
      const mockCreatorProfile = {
        id: "inf_profile_123",
        userId: "usr_creator_123",
      };

      vi.spyOn(prisma.influencerProfile, "findUnique").mockResolvedValue(
        mockCreatorProfile as unknown as import("@prisma/client").InfluencerProfile
      );

      const findManySpy = vi.spyOn(prisma.pageViewEvent, "findMany").mockResolvedValue([
        {
          sessionHash: "hash_brand_999",
          activeMs: 45000,
          userId: "usr_brand_999",
          user: {
            telemetryConsent: true,
            userType: "BRAND",
            brandProfile: { companyName: "Acme Corp" },
          },
          createdAt: new Date(),
        } as unknown as import("@prisma/client").PageViewEvent,
      ]);

      vi.spyOn(prisma.pageViewEvent, "count").mockResolvedValue(0);
      vi.spyOn(prisma.deal, "count").mockResolvedValue(1);

      const result = await VisibilityAnalyticsService.getCreatorVisibilityStats(
        "usr_creator_123"
      );

      // Verify that query was strictly filtered by targetInfluencerId
      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            targetInfluencerId: "inf_profile_123",
          }),
        })
      );

      expect(result.dataQuality).toBe("VERIFIED");
      expect(result.views).toBe(1);
      expect(result.uniqueViewers).toBe(1);
      expect(result.avgTimeOnProfileSec).toBe(45);
      expect(result.conversionRatePercent).toBe(100);
      expect(result.conversionRateBps).toBe(10000);
      expect(result.identifiedBrands).toHaveLength(1);
      expect(result.identifiedBrands[0]?.companyName).toBe("Acme Corp");
    });

    it("restricts brand metrics strictly to campaigns owned by the authenticated brand", async () => {
      const mockBrandProfile = {
        id: "brand_profile_456",
        userId: "usr_brand_456",
      };

      vi.spyOn(prisma.brandProfile, "findUnique").mockResolvedValue(
        mockBrandProfile as unknown as import("@prisma/client").BrandProfile
      );

      const campaignFindSpy = vi.spyOn(prisma.campaign, "findMany").mockResolvedValue([
        { id: "camp_1" },
        { id: "camp_2" },
      ] as unknown as import("@prisma/client").Campaign[]);

      const pageViewFindSpy = vi.spyOn(prisma.pageViewEvent, "findMany").mockResolvedValue([
        {
          sessionHash: "hash_creator_abc",
          activeMs: 60000,
        } as unknown as import("@prisma/client").PageViewEvent,
      ]);

      vi.spyOn(prisma.application, "findMany").mockResolvedValue([
        {
          id: "app_1",
          influencer: {
            categories: "Tech, Gaming",
          },
        } as unknown as import("@prisma/client").Application,
      ]);

      const result = await VisibilityAnalyticsService.getBrandCampaignVisibilityStats(
        "usr_brand_456"
      );

      // Verify campaign lookup is scoped strictly to brandId
      expect(campaignFindSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { brandId: "brand_profile_456" },
        })
      );

      // Verify page view query is scoped strictly to campaigns owned by this brand
      expect(pageViewFindSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            targetCampaignId: { in: ["camp_1", "camp_2"] },
          }),
        })
      );

      expect(result.dataQuality).toBe("VERIFIED");
      expect(result.campaignBriefViews).toBe(1);
      expect(result.avgReadTimeSec).toBe(60);
      expect(result.totalApplications).toBe(1);
      expect(result.applicationsPer100Views).toBe(100);
      expect(result.bestCategories[0]?.category).toBe("Gaming");
      expect(result.bestCategories[1]?.category).toBe("Tech");
    });
  });
});
