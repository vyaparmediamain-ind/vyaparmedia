import { NextRequest, NextResponse } from "next/server";
import { apiWrapper } from "@/lib/api-wrapper";
import prisma from "@/lib/db";
import { logger } from "@/lib/logger";
import { awardBadgeIfNotExists } from "@/lib/gamification-engine";
import { validateCronSecret } from "../guard";
import { subDays } from "date-fns";

async function awardVeteranBadges(now: Date): Promise<number> {
  const oneYearAgo = subDays(now, 365);
  const veterans = await prisma.user.findMany({
    where: {
      createdAt: { lte: oneYearAgo },
      userType: "INFLUENCER",
      badges: { none: { badgeId: "platform_veteran" } },
    },
    select: { id: true },
    take: 100,
    orderBy: { createdAt: "asc" },
  });

  for (const user of veterans) {
    await awardBadgeIfNotExists(user.id, "platform_veteran");
  }
  return veterans.length;
}

async function awardBrandAmbassadorBadges(now: Date): Promise<number> {
  const sixMonthsAgo = subDays(now, 180);
  const brandAmbassadors = await prisma.user.findMany({
    where: {
      createdAt: { lte: sixMonthsAgo },
      userType: "BRAND",
      badges: { none: { badgeId: "brand_ambassador" } },
    },
    select: { id: true },
    take: 100,
    orderBy: { createdAt: "asc" },
  });

  for (const user of brandAmbassadors) {
    await awardBadgeIfNotExists(user.id, "brand_ambassador");
  }
  return brandAmbassadors.length;
}

async function awardOgMemberBadges(): Promise<number> {
  const LAUNCH_DATE = new Date("2026-01-01T00:00:00.000Z");
  const ONE_MONTH_AFTER_LAUNCH = new Date(LAUNCH_DATE.getTime() + 30 * 24 * 60 * 60 * 1000);
  const ogMembers = await prisma.user.findMany({
    where: {
      createdAt: { gte: LAUNCH_DATE, lte: ONE_MONTH_AFTER_LAUNCH },
      badges: { none: { badgeId: "og_member" } },
    },
    select: { id: true },
    take: 100,
    orderBy: { createdAt: "asc" },
  });

  for (const user of ogMembers) {
    await awardBadgeIfNotExists(user.id, "og_member");
  }
  return ogMembers.length;
}

async function awardHotCreatorBadges(now: Date): Promise<string[]> {
  const sevenDaysAgo = subDays(now, 7);
  const topInfluencerDeals = await prisma.deal.groupBy({
    by: ["influencerId"],
    where: {
      status: "COMPLETED",
      completedAt: { gte: sevenDaysAgo },
    },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
  });

  const hotCreatorUserIds: string[] = [];
  if (topInfluencerDeals.length > 0) {
    const firstDeal = topInfluencerDeals[0];
    if (firstDeal?._count?.id !== undefined) {
      const maxCount = firstDeal._count.id;
      const tiedInfluencers = topInfluencerDeals.filter((item) => item._count?.id === maxCount);

      for (const item of tiedInfluencers) {
        if (item.influencerId) {
          const influencer = await prisma.influencerProfile.findUnique({
            where: { id: item.influencerId },
            select: { userId: true },
          });
          if (influencer) {
            hotCreatorUserIds.push(influencer.userId);
            await awardBadgeIfNotExists(influencer.userId, "hot_creator");
          }
        }
      }
    }
  }
  return hotCreatorUserIds;
}

async function _handler_POST(_req: NextRequest) {
  await validateCronSecret(_req);

  const now = new Date();

  const veteransAwarded = await awardVeteranBadges(now);
  const brandAmbassadorsAwarded = await awardBrandAmbassadorBadges(now);
  const ogMembersAwarded = await awardOgMemberBadges();
  const hotCreatorUserIds = await awardHotCreatorBadges(now);

  logger.info("Tenure and leaderboard badges cron execution complete", {
    veteransAwarded,
    brandAmbassadorsAwarded,
    ogMembersAwarded,
    hotCreatorAwardedTo: hotCreatorUserIds.join(", "),
  });

  return NextResponse.json({
    success: true,
    badgesAwarded: {
      platform_veteran: veteransAwarded,
      brand_ambassador: brandAmbassadorsAwarded,
      og_member: ogMembersAwarded,
      hot_creator: hotCreatorUserIds.length,
    },
  });
}

export const GET = apiWrapper(_handler_POST);
export const POST = apiWrapper(_handler_POST);
