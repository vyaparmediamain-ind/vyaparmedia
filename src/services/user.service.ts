import { AppError } from "@/lib/errors";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { logger } from "@/lib/logger";
import { searchCreators, invalidateCreatorSearchCache } from "@/lib/search";

type CreatorSortField = NonNullable<Parameters<typeof searchCreators>[0]["sortBy"]>;

export interface ListInfluencersParams {
  category?: string | undefined;
  minFollowers?: number | undefined;
  city?: string | undefined;
  minEngagementRate?: number | undefined; // In basis points
  minRate?: number | undefined; // In paise
  maxRate?: number | undefined; // In paise
  platform?: string | undefined;
  page: number;
  limit: number;
  searchTerm?: string | undefined;
  brandUserId?: string | undefined;
  sortBy?: string | undefined;
  sortOrder?: "asc" | "desc" | undefined;
  cursor?: string | undefined;
}

export class UserService {
  private static applyEngagementFilter(
    where: Prisma.InfluencerProfileWhereInput,
    platform?: string,
    minEngagementRate?: number,
  ) {
    if (minEngagementRate === undefined) return;
    if (platform === "instagram") {
      where.instagramEngagementRate = { gte: minEngagementRate };
    } else if (platform === "youtube") {
      where.youtubeEngagementRate = { gte: minEngagementRate };
    }
  }

  private static applyRateFilter(
    where: Prisma.InfluencerProfileWhereInput,
    minRate?: number,
    maxRate?: number,
  ) {
    if (minRate !== undefined && maxRate !== undefined) {
      where.OR = [
        { minRate: { gte: minRate, lte: maxRate } },
        { maxRate: { gte: minRate, lte: maxRate } },
      ];
    } else if (minRate !== undefined) {
      where.minRate = { gte: minRate };
    } else if (maxRate !== undefined) {
      where.maxRate = { lte: maxRate };
    }
  }

  private static applyBrandBudgetFilter(
    where: Prisma.InfluencerProfileWhereInput,
    brandBalance: number,
  ) {
    where.minRate = { lte: brandBalance };
  }

  private static applySocialHandlesFilter(where: Prisma.InfluencerProfileWhereInput) {
    const hasSocialHandleCondition: Prisma.InfluencerProfileWhereInput = {
      OR: [
        { instagramHandle: { not: null, notIn: [""] } },
        { youtubeHandle: { not: null, notIn: [""] } },
      ],
    };
    const existing = where.AND;
    let andConditions: Prisma.InfluencerProfileWhereInput[] = [];
    if (existing) {
      if (Array.isArray(existing)) {
        andConditions = [...existing];
      } else {
        andConditions = [existing as Prisma.InfluencerProfileWhereInput];
      }
    }
    andConditions.push(hasSocialHandleCondition);
    where.AND = andConditions;
  }

  static async listInfluencers(params: ListInfluencersParams) {
    try {
      // 0. Automatically clean up expired featured statuses
      try {
        await prisma.influencerProfile.updateMany({
          where: {
            isFeatured: true,
            featuredUntil: { lt: new Date() },
          },
          data: {
            isFeatured: false,
          },
        });
      } catch (err) {
        logger.warn("Failed to clean up expired featured creators in listInfluencers", { err });
      }

      const searchResult = await searchCreators({
        searchTerm: params.searchTerm,
        category: params.category,
        city: params.city,
        minFollowers: params.minFollowers,
        minEngagementRate: params.minEngagementRate,
        minRate: params.minRate,
        maxRate: params.maxRate,
        platform: params.platform,
        brandUserId: params.brandUserId,
        sortBy: (params.sortBy as CreatorSortField) || "relevance",
        sortOrder: params.sortOrder,
        cursor: params.cursor,
        limit: params.limit,
        page: params.page,
      });

      return {
        influencers: searchResult.items,
        nextCursor: searchResult.nextCursor,
        hasMore: searchResult.hasMore,
        total: searchResult.items.length,
        durationMs: searchResult.durationMs,
      };
    } catch (error) {
      logger.error("Error listing influencers", error, { params });
      throw AppError.badRequest("Failed to list influencers");
    }
  }

  static async invalidateSearchCache() {
    await invalidateCreatorSearchCache();
  }
}
