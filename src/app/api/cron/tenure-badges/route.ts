import { NextRequest, NextResponse } from "next/server";
import { apiWrapper } from "@/lib/api-wrapper";
import prisma from "@/lib/db";
import { logger } from "@/lib/logger";
import { awardBadgeIfNotExists } from "@/lib/gamification-engine";
import { validateCronSecret } from "../guard";
import { subDays } from "date-fns";
import { acquireDistributedLock, releaseDistributedLock } from "@/lib/lock";

const LOCK_KEY = "cron:tenure-badges:lock";
const LOCK_TTL_SECS = 300;

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

  let awarded = 0;
  for (const user of veterans) {
    try {
      await awardBadgeIfNotExists(user.id, "platform_veteran");
      awarded++;
    } catch (err) {
      logger.error("Failed to award veteran badge to user", { userId: user.id, error: err });
    }
  }
  return awarded;
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

  let awarded = 0;
  for (const user of brandAmbassadors) {
    try {
      await awardBadgeIfNotExists(user.id, "brand_ambassador");
      awarded++;
    } catch (err) {
      logger.error("Failed to award brand ambassador badge to user", { userId: user.id, error: err });
    }
  }
  return awarded;
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

  let awarded = 0;
  for (const user of ogMembers) {
    try {
      await awardBadgeIfNotExists(user.id, "og_member");
      awarded++;
    } catch (err) {
      logger.error("Failed to award OG member badge to user", { userId: user.id, error: err });
    }
  }
  return awarded;
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
    take: 20,
  });

  const hotCreatorUserIds: string[] = [];
  if (topInfluencerDeals.length > 0) {
    const firstDeal = topInfluencerDeals[0];
    if (firstDeal?._count?.id !== undefined) {
      const maxCount = firstDeal._count.id;
      const tiedInfluencers = topInfluencerDeals.filter((item) => item._count?.id === maxCount);

      for (const item of tiedInfluencers) {
        if (item.influencerId) {
          try {
            const influencer = await prisma.influencerProfile.findUnique({
              where: { id: item.influencerId },
              select: { userId: true },
            });
            if (influencer) {
              await awardBadgeIfNotExists(influencer.userId, "hot_creator");
              hotCreatorUserIds.push(influencer.userId);
            }
          } catch (err) {
            logger.error("Failed to award hot creator badge", { influencerId: item.influencerId, error: err });
          }
        }
      }
    }
  }
  return hotCreatorUserIds;
}

async function _handler_POST(_req: NextRequest) {
  await validateCronSecret(_req);

  const lockToken = await acquireDistributedLock(LOCK_KEY, LOCK_TTL_SECS);
  if (!lockToken) {
    return NextResponse.json({
      success: true,
      message: "Tenure badges award job already running, skipping",
      data: { locked: true },
    });
  }

  try {
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
  } finally {
    await releaseDistributedLock(LOCK_KEY, lockToken);
  }
}

export const GET = apiWrapper(_handler_POST);
export const POST = apiWrapper(_handler_POST);
