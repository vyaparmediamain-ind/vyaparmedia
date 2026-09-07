import { apiWrapper } from "@/lib/api-wrapper";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { subDays } from "date-fns";
import { logger } from "@/lib/logger";

async function getWeeklyLeaderboard(city: string, category: string, limit: number) {
  const weekAgo = subDays(new Date(), 7);

  const weeklyTopInfluencers = await prisma.deal.groupBy({
    by: ["influencerId"],
    where: {
      status: "COMPLETED",
      completedAt: { gte: weekAgo },
      deletedAt: null,
      influencer: {
        user: { trustScore: { gte: 300 } },
        ...(city
          ? { city: { contains: city, mode: "insensitive" as const } }
          : {}),
        ...(category
          ? {
              categories: {
                contains: category,
                mode: "insensitive" as const,
              },
            }
          : {}),
      },
    },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: limit,
  });

  const influencerIds = weeklyTopInfluencers.map(
    (d: { influencerId: string }) => d.influencerId,
  );

  const profiles = await prisma.influencerProfile.findMany({
    where: {
      id: { in: influencerIds },
      ...(city
        ? { city: { contains: city, mode: "insensitive" as const } }
        : {}),
      ...(category
        ? {
            categories: {
              contains: category,
              mode: "insensitive" as const,
            },
          }
        : {}),
    },
    take: limit,
    include: {
      user: {
        select: { id: true, xp: true, level: true, trustScore: true },
      },
    },
  });

  const weeklyInfluencers = weeklyTopInfluencers
    .map((d) => {
      const profile = profiles.find((p) => p.id === d.influencerId);
      if (!profile) return null;
      return {
        id: profile.user.id,
        name: profile.displayName,
        avatar: profile.avatar,
        subtitle: profile.categories?.split(",")[0] || "",
        city: profile.city || "",
        score: d._count.id, // Deals completed this week
        xp: profile.user.xp,
        trustScore: profile.user.trustScore,
        level: profile.user.level,
        isWeeklyChampion: false as boolean,
      };
    })
    .filter((influencer): influencer is NonNullable<typeof influencer> => Boolean(influencer && influencer.trustScore >= 300));

  // Mark #1 as "Hot Creator"
  if (weeklyInfluencers.length > 0 && weeklyInfluencers[0]) {
    weeklyInfluencers[0].isWeeklyChampion = true;
  }

  // ================== BRANDS (WEEKLY) ==================
  const weeklyTopBrands = await getTopBrands(limit, "weekly", city);

  return {
    filter: "weekly" as const,
    influencers: weeklyInfluencers,
    brands: weeklyTopBrands,
  };
}

async function getAllTimeLeaderboard(
  influencerWhere: Prisma.UserWhereInput,
  influencerOrderBy: Prisma.UserOrderByWithRelationInput,
  limit: number,
  city: string,
) {
  const topInfluencers = await prisma.user.findMany({
    where: influencerWhere,
    take: limit,
    orderBy: influencerOrderBy,
    select: {
      id: true,
      xp: true,
      level: true,
      trustScore: true,
      influencerProfile: {
        select: {
          displayName: true,
          avatar: true,
          categories: true,
          city: true,
          completedDeals: true,
          totalEarnings: true,
        },
      },
    },
  });

  const topBrands = await getTopBrands(limit, "all-time", city);

  // Hall of Fame top 3 all-time
  const hallOfFame = topInfluencers.slice(0, 3).map((u, i: number) => ({
    rank: i + 1,
    id: u.id,
    name: u.influencerProfile?.displayName,
    avatar: u.influencerProfile?.avatar,
    xp: u.xp,
    level: u.level,
    deals: u.influencerProfile?.completedDeals || 0,
  }));

  return {
    filter: "all-time" as const,
    influencers: topInfluencers.map((u) => ({
      id: u.id,
      name: u.influencerProfile?.displayName,
      avatar: u.influencerProfile?.avatar,
      subtitle: u.influencerProfile?.categories?.split(",")[0] || "",
      city: u.influencerProfile?.city || "",
      score: u.xp,
      trustScore: u.trustScore,
      level: u.level,
      deals: u.influencerProfile?.completedDeals || 0,
    })),
    brands: topBrands,
    hallOfFame,
  };
}

async function _handler_GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter")?.trim() || "all-time"; // all-time | weekly
    const city = searchParams.get("city")?.trim() || "";
    const category = searchParams.get("category")?.trim() || "";
    const parsedLimit = Number.parseInt(searchParams.get("limit") || "20", 10);
    const limit = Math.max(1, Math.min(Number.isNaN(parsedLimit) ? 20 : parsedLimit, 50));

    if (filter === "weekly") {
      const data = await getWeeklyLeaderboard(city, category, limit);
      return NextResponse.json(data);
    }

    const influencerWhere: Prisma.UserWhereInput = {
      userType: "INFLUENCER",
      status: "ACTIVE",
      trustScore: { gte: 300 },
      influencerProfile: { isNot: null },
    };

    if (city) {
      influencerWhere.influencerProfile = {
        is: {
          city: { contains: city, mode: "insensitive" as const },
        },
      };
    }

    if (category) {
      influencerWhere.influencerProfile = {
        is: {
          ...(city ? { city: { contains: city, mode: "insensitive" as const } } : {}),
          categories: { contains: category, mode: "insensitive" as const },
        },
      };
    }

    const influencerOrderBy: Prisma.UserOrderByWithRelationInput = { xp: "desc" };
    const data = await getAllTimeLeaderboard(influencerWhere, influencerOrderBy, limit, city);
    return NextResponse.json(data);
  } catch (error) {
    logger.error("Leaderboard fetch error", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 },
    );
  }
}

// ==================== HELPER ====================

async function getTopBrands(limit: number, filter: string, city: string) {
  if (filter === "weekly") {
    const weekAgo = subDays(new Date(), 7);
    const weeklyBrands = await prisma.deal.groupBy({
      by: ["brandId"],
      where: {
        status: "COMPLETED",
        completedAt: { gte: weekAgo },
        brandId: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: limit,
    });

    const brandIds = weeklyBrands
      .map((d) => d.brandId)
      .filter(Boolean) as string[];
    const profiles = await prisma.brandProfile.findMany({
      where: {
        id: { in: brandIds },
        ...(city ? { city: { contains: city, mode: "insensitive" as const } } : {}),
      },
      take: limit,
      include: {
        user: { select: { id: true, xp: true, level: true, trustScore: true } },
      },
    });

    return weeklyBrands
      .map((d) => {
        const profile = profiles.find((p) => p.id === d.brandId);
        if (!profile) return null;
        return {
          id: profile.user.id,
          name: profile.companyName,
          avatar: profile.logo,
          logo: profile.logo,
          subtitle: profile.industry,
          score: d._count.id,
          xp: profile.user.xp,
          level: profile.user.level,
          trustScore: profile.user.trustScore,
        };
      })
      .filter((brand): brand is NonNullable<typeof brand> => Boolean(brand && brand.trustScore >= 300));
  }

  const brands = await prisma.user.findMany({
    where: {
      userType: "BRAND",
      status: "ACTIVE",
      trustScore: { gte: 300 }, // Gamification Connection
      brandProfile: {
        is: city
          ? { city: { contains: city, mode: "insensitive" as const } }
          : {},
      },
    },
    take: limit,
    orderBy: { trustScore: "desc" },
    select: {
      id: true,
      xp: true,
      level: true,
      trustScore: true,
      brandProfile: {
        select: {
          companyName: true,
          logo: true,
          industry: true,
          totalCampaigns: true,
        },
      },
    },
  });

  return brands.map((u) => ({
    id: u.id,
    name: u.brandProfile?.companyName,
    avatar: u.brandProfile?.logo,
    logo: u.brandProfile?.logo,
    subtitle: u.brandProfile?.industry,
    score: u.trustScore,
    xp: u.xp,
    level: u.level,
    campaigns: u.brandProfile?.totalCampaigns || 0,
  }));
}


// Wrapped handlers via apiWrapper
export const GET = apiWrapper(_handler_GET);
