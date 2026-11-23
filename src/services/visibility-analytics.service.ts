import prisma from "@/lib/db";
import { AppError } from "@/lib/errors";
import { cache } from "@/lib/cache";
import {
  calculateVisibilityTrend,
  filterAndFormatIdentifiedBrandViewers,
  calculateViewsToConversionRate,
  calculateApplicationsPer100Views,
  rankBestCategories,
  type CreatorVisibilityKpis,
  type BrandCampaignVisibilityKpis,
  type RawBrandViewer,
} from "@/lib/visibility-analytics";

export class VisibilityAnalyticsService {
  /**
   * Retrieves 30-day profile visibility metrics for a creator.
   *
   * SECURITY:
   * Object-level authorization: Caller must own the creator profile.
   * Consenting users only: Never exposes non-consenting viewers.
   * Brand names only: Never exposes creator personal identities.
   * Small-number suppression: Displays "<5" for small counts.
   */
  public static async getCreatorVisibilityStats(
    creatorUserId: string,
    clock: Date = new Date()
  ): Promise<CreatorVisibilityKpis> {
    const profile = await prisma.influencerProfile.findUnique({
      where: { userId: creatorUserId },
      select: { id: true, userId: true },
    });

    if (!profile) {
      throw AppError.notFound("Creator profile not found");
    }

    const cacheKey = `analytics:creator:visibility:${profile.id}`;

    return cache(
      cacheKey,
      async () => {
        const currentStart = new Date(clock.getTime() - 30 * 24 * 60 * 60 * 1000);
        const prevStart = new Date(clock.getTime() - 60 * 24 * 60 * 60 * 1000);

        const [currentEvents, prevViewsCount, dealsCount] = await Promise.all([
          // 1. Current 30-day profile views
          prisma.pageViewEvent.findMany({
            where: {
              targetInfluencerId: profile.id,
              createdAt: { gte: currentStart, lte: clock },
            },
            select: {
              sessionHash: true,
              activeMs: true,
              userId: true,
              user: {
                select: {
                  telemetryConsent: true,
                  userType: true,
                  brandProfile: {
                    select: { companyName: true },
                  },
                },
              },
              createdAt: true,
            },
          }),
          // 2. Previous 30-day views count for trend comparison
          prisma.pageViewEvent.count({
            where: {
              targetInfluencerId: profile.id,
              createdAt: { gte: prevStart, lt: currentStart },
            },
          }),
          // 3. Current 30-day incoming collaboration deals/applications
          prisma.deal.count({
            where: {
              influencerId: profile.id,
              createdAt: { gte: currentStart, lte: clock },
            },
          }),
        ]);

        const views = currentEvents.length;
        const uniqueViewers = new Set(currentEvents.map((e) => e.sessionHash)).size;
        const totalActiveMs = currentEvents.reduce((acc, e) => acc + e.activeMs, 0);
        const avgTimeOnProfileMs = views > 0 ? Math.round(totalActiveMs / views) : 0;
        const avgTimeOnProfileSec = Math.round(avgTimeOnProfileMs / 1000);

        const trendVsPrevious30d = calculateVisibilityTrend(views, prevViewsCount);
        const { conversionRatePercent, conversionRateBps } = calculateViewsToConversionRate(
          views,
          dealsCount
        );

        // Filter identified viewers: only consenting brand profiles with verified company names
        const rawBrandViewers: RawBrandViewer[] = [];
        for (const ev of currentEvents) {
          if (!ev.userId || !ev.user) continue;
          if (ev.user.userType !== "BRAND") continue;

          rawBrandViewers.push({
            userId: ev.userId,
            telemetryConsent: Boolean(ev.user.telemetryConsent),
            role: ev.user.userType,
            companyName: ev.user.brandProfile?.companyName ?? null,
            activeMs: ev.activeMs,
            createdAt: ev.createdAt,
          });
        }

        const {
          identifiedBrands,
          totalIdentifiedBrandsCount,
          isSmallNumberSuppressed,
        } = filterAndFormatIdentifiedBrandViewers(rawBrandViewers);

        return {
          views,
          uniqueViewers,
          avgTimeOnProfileMs,
          avgTimeOnProfileSec,
          trendVsPrevious30d,
          applicationsCount: dealsCount,
          conversionRatePercent,
          conversionRateBps,
          identifiedBrands,
          totalIdentifiedBrandsCount,
          isSmallNumberSuppressed,
          dataQuality: "VERIFIED",
        };
      },
      60 // 1 minute TTL
    );
  }

  /**
   * Retrieves 30-day campaign brief visibility metrics for a brand.
   *
   * SECURITY:
   * Object-level authorization: Caller must own the brand profile.
   */
  public static async getBrandCampaignVisibilityStats(
    brandUserId: string,
    clock: Date = new Date()
  ): Promise<BrandCampaignVisibilityKpis> {
    const profile = await prisma.brandProfile.findUnique({
      where: { userId: brandUserId },
      select: { id: true, userId: true },
    });

    if (!profile) {
      throw AppError.notFound("Brand profile not found");
    }

    const cacheKey = `analytics:brand:campaign_visibility:${profile.id}`;

    return cache(
      cacheKey,
      async () => {
        const campaigns = await prisma.campaign.findMany({
          where: { brandId: profile.id },
          select: { id: true },
        });

        if (campaigns.length === 0) {
          return {
            campaignBriefViews: 0,
            uniqueViewers: 0,
            avgReadTimeMs: 0,
            avgReadTimeSec: 0,
            totalApplications: 0,
            applicationsPer100Views: 0,
            applicationsRateBps: 0,
            bestCategories: [],
            dataQuality: "VERIFIED",
          };
        }

        const campaignIds = campaigns.map((c) => c.id);
        const currentStart = new Date(clock.getTime() - 30 * 24 * 60 * 60 * 1000);

        const [campaignEvents, applications] = await Promise.all([
          // 1. Current 30-day views across all brand campaigns
          prisma.pageViewEvent.findMany({
            where: {
              targetCampaignId: { in: campaignIds },
              createdAt: { gte: currentStart, lte: clock },
            },
            select: {
              sessionHash: true,
              activeMs: true,
            },
          }),
          // 2. Applications submitted to these campaigns within 30 days
          prisma.application.findMany({
            where: {
              campaignId: { in: campaignIds },
              createdAt: { gte: currentStart, lte: clock },
            },
            select: {
              id: true,
              influencer: {
                select: {
                  categories: true,
                },
              },
            },
          }),
        ]);

        const campaignBriefViews = campaignEvents.length;
        const uniqueViewers = new Set(campaignEvents.map((e) => e.sessionHash)).size;
        const totalActiveMs = campaignEvents.reduce((acc, e) => acc + e.activeMs, 0);
        const avgReadTimeMs = campaignBriefViews > 0 ? Math.round(totalActiveMs / campaignBriefViews) : 0;
        const avgReadTimeSec = Math.round(avgReadTimeMs / 1000);

        const { applicationsPer100Views, applicationsRateBps } = calculateApplicationsPer100Views(
          campaignBriefViews,
          applications.length
        );

        const bestCategories = rankBestCategories(
          applications.map((a) => a.influencer?.categories)
        );

        return {
          campaignBriefViews,
          uniqueViewers,
          avgReadTimeMs,
          avgReadTimeSec,
          totalApplications: applications.length,
          applicationsPer100Views,
          applicationsRateBps,
          bestCategories,
          dataQuality: "VERIFIED",
        };
      },
      60 // 1 minute TTL
    );
  }
}
