import { DbClient, GamificationUser } from "./types";

async function checkDealStreak(badgeId: string, userId: string, db: DbClient, startOfMonth: Date): Promise<boolean> {
  const count = await db.deal.count({
    where: { influencerId: userId, status: "COMPLETED", completedAt: { gte: startOfMonth } },
  });
  if (badgeId === "deal_streak_5") return count >= 5;
  if (badgeId === "deal_streak_10") return count >= 10;
  return false;
}

async function checkFinancialStreak(badgeId: string, userId: string, db: DbClient, startOfMonth: Date): Promise<boolean> {
  if (badgeId === "fast_earner") {
    const monthlyPayouts = await db.transaction.aggregate({
      where: {
        wallet: { userId },
        type: "CREDIT",
        dealId: { not: null },
        createdAt: { gte: startOfMonth },
      },
      _sum: { amount: true },
    });
    const earnedAmount = monthlyPayouts?._sum?.amount ?? 0;
    return earnedAmount >= 5000000;
  }
  return false;
}

async function checkSpeedDemon(userId: string, db: DbClient): Promise<boolean> {
  const speedDeals = await db.deal.findMany({
    where: { influencerId: userId, status: "COMPLETED", submittedAt: { not: null }, startedAt: { not: null } },
    select: { submittedAt: true, startedAt: true },
  });
  return speedDeals.some((d: { submittedAt: Date | null; startedAt: Date | null }) => {
    const diff = new Date(d.submittedAt!).getTime() - new Date(d.startedAt!).getTime();
    return diff <= 24 * 60 * 60 * 1000;
  });
}

async function checkEarlyBird(userId: string, db: DbClient): Promise<boolean> {
  const earlyDeals = await db.deal.findMany({
    where: { influencerId: userId, status: "COMPLETED", submittedAt: { not: null } },
    select: { submittedAt: true, submissionDeadline: true },
  });
  const earlyCount = earlyDeals.filter((d: { submittedAt: Date | null; submissionDeadline: Date }) => new Date(d.submittedAt!).getTime() < new Date(d.submissionDeadline).getTime()).length;
  return earlyCount >= 5;
}

async function checkNightOwl(userId: string, db: DbClient): Promise<boolean> {
  const nightDeals = await db.deal.findMany({
    where: { influencerId: userId, status: "COMPLETED", submittedAt: { not: null } },
    select: { submittedAt: true },
  });
  return nightDeals.some((d: { submittedAt: Date | null }) => {
    // Convert UTC to IST (+5:30)
    const istTime = new Date(new Date(d.submittedAt!).getTime() + (5.5 * 60 * 60 * 1000));
    const hour = istTime.getUTCHours();
    return hour >= 2 && hour < 5;
  });
}

async function checkWeekendWarrior(userId: string, db: DbClient): Promise<boolean> {
  const weekendDeals = await db.deal.findMany({
    where: { influencerId: userId, status: "COMPLETED", completedAt: { not: null } },
    select: { completedAt: true },
  });
  return weekendDeals.some((d: { completedAt: Date | null }) => {
    // Convert UTC to IST (+5:30)
    const istTime = new Date(new Date(d.completedAt!).getTime() + (5.5 * 60 * 60 * 1000));
    const day = istTime.getUTCDay();
    return day === 0 || day === 6; // Sunday (0) or Saturday (6)
  });
}

async function checkSpeedAndTimingStreak(badgeId: string, userId: string, db: DbClient): Promise<boolean> {
  if (badgeId === "speed_demon") return checkSpeedDemon(userId, db);
  if (badgeId === "early_bird") return checkEarlyBird(userId, db);
  if (badgeId === "night_owl") return checkNightOwl(userId, db);
  if (badgeId === "weekend_warrior") return checkWeekendWarrior(userId, db);
  return false;
}

async function checkPortfolioAndLoyaltyStreak(badgeId: string, userId: string, db: DbClient): Promise<boolean> {
  if (badgeId === "diverse_portfolio") {
    const portfolioDeals = await db.deal.findMany({
      where: { influencerId: userId, status: "COMPLETED" },
      include: { campaign: { select: { targetCategories: true } } },
    });
    const categoriesSet = new Set<string>();
    for (const deal of portfolioDeals) {
      if (deal.campaign?.targetCategories) {
        for (const cat of deal.campaign.targetCategories) {
          categoriesSet.add(cat);
        }
      }
    }
    return categoriesSet.size >= 5;
  }
  if (badgeId === "loyalist") {
    const loyaltyGroups = await db.deal.groupBy({
      by: ["brandId"],
      where: { influencerId: userId, status: "COMPLETED", brandId: { not: null } },
      _count: { id: true },
    });
    return loyaltyGroups.some((group: { _count: { id: number | null } }) => (group._count.id ?? 0) >= 5);
  }
  return false;
}

async function checkRatingAndViralStreak(badgeId: string, userId: string, db: DbClient, influencerProfile: GamificationUser["influencerProfile"]): Promise<boolean> {
if (badgeId === "perfect_rating") {
const rating = influencerProfile?.averageRating || 0;
const completedDeals = influencerProfile?.completedDeals || 0;
return completedDeals >= 10 && rating === 500;
}
if (badgeId === "creative_genius") {
const creativeReviews = await db.review.findFirst({
where: {
receiverId: userId,
comment: { contains: "creative", mode: "insensitive" },
},
});
return !!creativeReviews;
}
if (badgeId === "viral_post") {
const igAvg = influencerProfile?.instagramEngagementRate || 0;
const ytAvg = influencerProfile?.youtubeEngagementRate || 0;
const myCompletedDeals = await db.deal.findMany({
where: { influencerId: userId, status: "COMPLETED" },
select: { id: true, postUrl: true },
});
const dealIds = myCompletedDeals.map((d: { id: string; postUrl?: string | null }) => d.id);
if (dealIds.length === 0) return false;

const snapshots = await db.engagementSnapshot.findMany({
where: { dealId: { in: dealIds } },
select: { engagementRate: true, dealId: true },
});

return snapshots.some((snap: { engagementRate: number; dealId: string }) => {
const deal = myCompletedDeals.find((d: { id: string; postUrl?: string | null }) => d.id === snap.dealId);
const url = (deal?.postUrl || "").toLowerCase();
if (url.includes("instagram.com") || url.includes("ig.me")) {
return igAvg > 0 && snap.engagementRate >= igAvg * 10;
}
if (url.includes("youtube.com") || url.includes("youtu.be")) {
return ytAvg > 0 && snap.engagementRate >= ytAvg * 10;
}
const avg = Math.max(igAvg, ytAvg);
return avg > 0 && snap.engagementRate >= avg * 10;
});
}
return false;
}

async function checkCategoryKing(userId: string, db: DbClient, influencerProfile: GamificationUser["influencerProfile"]): Promise<boolean> {
  const myCompleted = influencerProfile?.completedDeals || 0;
  if (myCompleted === 0) return false;

  const categories = (influencerProfile?.categories || "")
    .split(",")
    .map((c: string) => c.trim().toLowerCase())
    .filter(Boolean);
  if (categories.length === 0) return false;

  const allProfiles = await db.influencerProfile.findMany({
    select: { categories: true, completedDeals: true },
  });

  return categories.some((cat: string) => {
    const catProfiles = allProfiles.filter((p: { categories?: string | null; completedDeals?: number }) => (p.categories || "")
      .split(",")
      .map((c: string) => c.trim().toLowerCase())
      .includes(cat)
    );
    if (catProfiles.length === 0) return false;
    const maxCompleted = Math.max(...catProfiles.map((p: { completedDeals?: number }) => p.completedDeals || 0));
    return myCompleted >= maxCompleted;
  });
}

async function checkCityChampion(userId: string, db: DbClient, influencerProfile: GamificationUser["influencerProfile"]): Promise<boolean> {
  const myCity = (influencerProfile?.city || "").trim().toLowerCase();
  if (!myCity) return false;
  const myCompletedDeals = influencerProfile?.completedDeals || 0;
  if (myCompletedDeals === 0) return false;

  const sameCityProfiles = await db.influencerProfile.findMany({
    where: { city: { mode: "insensitive", equals: myCity } },
    select: { completedDeals: true },
  });
  if (sameCityProfiles.length === 0) return false;
  const maxCompletedDeals = Math.max(...sameCityProfiles.map((p: { completedDeals?: number }) => p.completedDeals || 0));
  return myCompletedDeals >= maxCompletedDeals;
}

async function checkComebackKid(userId: string, db: DbClient): Promise<boolean> {
  const logins = await db.loginAttempt.findMany({
    where: { userId, success: true },
    orderBy: { createdAt: "desc" },
    take: 2,
  });
  if (logins.length < 2) return false;
  const latestLogin = logins[0]?.createdAt;
  const previousLogin = logins[1]?.createdAt;
  if (!latestLogin || !previousLogin) return false;
  const ninetyDays = 90 * 24 * 60 * 60 * 1000;
  return latestLogin.getTime() - previousLogin.getTime() >= ninetyDays;
}

async function checkTrendsetter(userId: string, db: DbClient): Promise<boolean> {
  const firstUsers = await db.user.findMany({
    orderBy: { createdAt: "asc" },
    take: 100,
    select: { id: true },
  });
  return firstUsers.some((u: { id: string }) => u.id === userId);
}

async function checkHolidaySpecial(userId: string, db: DbClient): Promise<boolean> {
  const completedDeals = await db.deal.findMany({
    where: { influencerId: userId, status: "COMPLETED" },
    select: { completedAt: true },
  });
  return completedDeals.some((d: { completedAt: Date | null }) => {
    if (!d.completedAt) return false;
    const month = d.completedAt.getMonth();
    return month === 9 || month === 10;
  });
}

async function checkLocationAndOtherStreak(badgeId: string, userId: string, db: DbClient, influencerProfile: GamificationUser["influencerProfile"]): Promise<boolean> {
  if (badgeId === "category_king") return checkCategoryKing(userId, db, influencerProfile);
  if (badgeId === "city_champion") return checkCityChampion(userId, db, influencerProfile);
  if (badgeId === "comeback_kid") return checkComebackKid(userId, db);
  if (badgeId === "trendsetter") return checkTrendsetter(userId, db);
  if (badgeId === "holiday_special") return checkHolidaySpecial(userId, db);
  return false;
}

export async function checkStreakActivity(
badgeId: string,
userId: string,
user: GamificationUser,
db: DbClient,
completedDealsCount: number,
influencerProfile: GamificationUser["influencerProfile"]
): Promise<boolean> {
  const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const startOfMonth = new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), 1, 0, 0, 0) - 5.5 * 60 * 60 * 1000);
if (badgeId === "first_login") return true;
if (badgeId === "highly_responsive") {
const messageCount = await db.message.count({ where: { senderId: userId } });
return messageCount >= 10;
}
if (badgeId.startsWith("deal_streak_")) {
return checkDealStreak(badgeId, userId, db, startOfMonth);
}
if (badgeId === "fast_earner") {
return checkFinancialStreak(badgeId, userId, db, startOfMonth);
}
if (["speed_demon", "early_bird", "night_owl", "weekend_warrior"].includes(badgeId)) {
return checkSpeedAndTimingStreak(badgeId, userId, db);
}
if (["diverse_portfolio", "loyalist"].includes(badgeId)) {
return checkPortfolioAndLoyaltyStreak(badgeId, userId, db);
}
if (["perfect_rating", "creative_genius", "viral_post"].includes(badgeId)) {
return checkRatingAndViralStreak(badgeId, userId, db, influencerProfile);
}
return checkLocationAndOtherStreak(badgeId, userId, db, influencerProfile);
}



