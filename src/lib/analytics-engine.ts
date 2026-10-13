import { AppError } from "@/lib/errors";
/**
* Analytics Engine Enhanced with Portfolio, ROI, and Admin Metrics
*
* Influencer: Earnings chart, success rate, portfolio, top posts
* Brand: Campaign ROI, cost per engagement, influencer comparison
* Admin: Real-time stats, growth metrics (CAC, K-factor, churn), cash flow
*/

import prisma from "./db";
import { getReferralStats } from "./referral-engine";
// BADGES removed (unused) from './badges';
import { logger } from "./logger";
import { subMonths, format } from "date-fns";
import { getIndianFYBounds } from "./csv-export";
import { WalletService } from "@/services/wallet.service";
import { cache } from "./cache";

function getPrimaryCategory(value: unknown): string {
if (Array.isArray(value)) {
return String(value[0] || "Other").trim() || "Other";
}

if (typeof value === "string") {
return value.split(",")[0]?.trim() || "Other";
}

return "Other";
}

export async function getInfluencerAnalytics(userId: string, fy?: string) {
  const cacheKey = `analytics:influencer:${userId}:${fy || "default"}`;
  return cache(cacheKey, async () => {
    const profile = await prisma.influencerProfile.findUnique({
where: { userId },
include: {
user: {
select: {
trustScore: true,
xp: true,
level: true,
verificationLevel: true,
createdAt: true,
},
},
},
});

if (!profile) {
logger.error("Influencer profile not found for analytics", { userId });
throw AppError.notFound("Influencer profile not found");
}

  // 1. Overview stats from profile
  const totalEarnings = profile.totalEarnings;
  const completedDeals = profile.completedDeals;

  // 2. Parallelize all independent database queries via Promise.all
  const [
    activeDeals,
    earningsHistory,
    deliveryRate,
    recentActivity,
    referralStats,
    userBadges,
    topDeals,
    allDeals,
    closedDealsGroupBy,
  ] = await Promise.all([
    // Active deals count
    prisma.deal.count({
      where: {
        influencerId: profile.id,
        status: {
          in: [
            "ACTIVE",
            "CONTENT_SUBMITTED",
            "REVISION_REQUESTED",
            "CONTENT_APPROVED",
            "POSTED",
            "VERIFICATION_PENDING",
          ],
        },
      },
    }),
    // Earnings history
    getMonthlyEarnings(profile.id, fy),
    // Performance delivery rate
    calculateDeliveryRate(profile.id),
    // Recent activity log
    prisma.activityLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { action: true, createdAt: true, metadata: true },
    }),
    // Gamification & referrals
    getReferralStats(userId, { includeUsers: false }),
    // Badges
    prisma.userBadge.findMany({
      where: { userId },
      include: { badge: true },
      orderBy: { earnedAt: "desc" },
      take: 5,
    }),
    // Top performing content
    prisma.deal.findMany({
      where: { influencerId: profile.id, status: "COMPLETED" },
      orderBy: { amount: "desc" },
      take: 5,
      select: {
        id: true,
        amount: true,
        completedAt: true,
        postUrl: true,
        campaign: { select: { title: true } },
      },
    }),
    // Category breakdown deals
    prisma.deal.findMany({
      where: { influencerId: profile.id, status: "COMPLETED" },
      select: {
        id: true,
        campaign: { select: { targetCategories: true } },
      },
      take: 1000,
    }),
    // Success rate status counts in a single group query
    prisma.deal.groupBy({
      by: ["status"],
      where: {
        influencerId: profile.id,
        status: { in: ["COMPLETED", "CANCELLED"] },
      },
      _count: { id: true },
    }),
  ]);

  const recentBadges = userBadges.map((ub) => ({
    ...ub.badge,
    earnedAt: ub.earnedAt,
  }));

  const categoryMap = new Map<string, number>();
  allDeals.forEach((d) => {
    const cat = getPrimaryCategory(d.campaign?.targetCategories);
    categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
  });
  const categoryBreakdown = Array.from(categoryMap.entries())
    .map(([category, count]) => ({
      category,
      count,
      percentage: Math.round((count / (allDeals.length || 1)) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  const completedCount = closedDealsGroupBy.find((g) => g.status === "COMPLETED")?._count.id || 0;
  const cancelledCount = closedDealsGroupBy.find((g) => g.status === "CANCELLED")?._count.id || 0;
  const totalClosed = completedCount + cancelledCount;
  const successRate = totalClosed > 0 ? Math.round((completedCount / totalClosed) * 100) : 100;

logger.debug("InfluencerAnalytics data fetched successfully", { userId });
return {
overview: {
totalEarnings,
completedDeals,
activeDeals,
averageRating: profile.averageRating,
trustScore: Math.min(profile.user?.trustScore || 0, 900),
level: profile.user?.level || 1,
xp: profile.user?.xp || 0,
successRate,
memberSince: profile.user?.createdAt,
},
earningsHistory,
performance: {
deliveryRate,
engagementRate: profile.instagramEngagementRate || 0,
successRate,
},
topContent: topDeals.map((d) => ({
id: d.id,
campaignTitle: d.campaign?.title || "Direct Deal",
amount: d.amount,
completedAt: d.completedAt,
postUrl: d.postUrl,
})),
categoryBreakdown,
recentActivity,
      gamification: {
        recentBadges,
        referralStats,
      },
    };
  }, 60);
}

/** Resolves analytics date range: FY bounds if fy is valid, else rolling 12 months. */
function resolveAnalyticsDates(fy?: string): { startDate: Date; endDate: Date } {
  if (fy) {
    const bounds = getIndianFYBounds(fy);
    if (bounds) return { startDate: bounds.start, endDate: bounds.end };
  }
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { startDate, endDate };
}

/** Generates an empty 12-month timeseries (rolling from now). */
function emptyMonthlyTimeseries(): Array<{ month: string; amount: number }> {
return Array.from({ length: 12 }, (_, i) => {
const d = subMonths(new Date(), 11 - i);
return { month: format(d, "MMM yyyy"), amount: 0 };
});
}

/** Aggregates a wallet's monthly transaction totals for a given type and date range. */
async function getMonthlyTransactions(
walletId: string,
type: "CREDIT" | "DEBIT",
startDate: Date,
endDate: Date,
): Promise<Array<{ month: string; amount: number }>> {
const monthlyData = await prisma.$queryRaw<Array<{ month: string; amount: bigint }>>`
SELECT
TO_CHAR(DATE_TRUNC('month', "createdAt"), 'Mon YYYY') as month,
COALESCE(SUM("amount"), 0) as amount
FROM "Transaction"
WHERE "walletId" = ${walletId}
AND "type"::text = ${type}
AND "createdAt" >= ${startDate}
AND "createdAt" <= ${endDate}
GROUP BY DATE_TRUNC('month', "createdAt")
ORDER BY DATE_TRUNC('month', "createdAt") ASC
`;

  const monthMap = new Map(monthlyData.map((m) => [m.month, Number(m.amount)]));
  const result: Array<{ month: string; amount: number }> = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(startDate);
    d.setDate(1);
    d.setMonth(d.getMonth() + i);
    const monthStr = format(d, "MMM yyyy");
    result.push({ month: monthStr, amount: monthMap.get(monthStr) || 0 });
  }
  return result;
}

async function getMonthlyEarnings(influencerId: string, fy?: string) {
const wallet = await prisma.wallet.findFirst({
where: { user: { influencerProfile: { id: influencerId } } },
});
if (!wallet) return emptyMonthlyTimeseries();

const { startDate, endDate } = resolveAnalyticsDates(fy);
return getMonthlyTransactions(wallet.id, "CREDIT", startDate, endDate);
}

async function calculateDeliveryRate(influencerId: string) {
const totalDeals = await prisma.deal.count({
where: { influencerId, status: { in: ["COMPLETED", "CANCELLED"] } },
});

if (totalDeals === 0) return 100;

const completed = await prisma.deal.count({
where: { influencerId, status: "COMPLETED" },
});

return Math.round((completed / totalDeals) * 100);
}

export async function getBrandAnalytics(userId: string, fy?: string) {
  const cacheKey = `analytics:brand:${userId}:${fy || "default"}`;
  return cache(cacheKey, async () => {
    const profile = await prisma.brandProfile.findUnique({
where: { userId },
include: {
user: {
select: { trustScore: true, verificationLevel: true, createdAt: true },
},
},
});


if (!profile) {
logger.error("Profile not found for brand analytics", { userId });
throw AppError.notFound("Brand profile not found");
}

// 1. Overview
const totalSpent = profile.totalSpent;
const activeCampaigns = profile.activeCampaigns;
const totalCampaigns = profile.totalCampaigns;

// 1. Parallelize all independent database queries via Promise.all
const [
  activeDeals,
  spendHistory,
  campaigns,
  aggregateResult,
  categoryPerf,
  influencerDeals,
  referralStats,
] = await Promise.all([
  // Active deals
  prisma.deal.count({
    where: {
      brandId: profile.id,
      status: { notIn: ["COMPLETED", "CANCELLED", "DISPUTED"] },
    },
  }),
  // Spend History (Last 12 Months or FY)
  getMonthlySpend(userId, fy),
  // Campaign Performance
  prisma.campaign.findMany({
    where: { brandId: profile.id },
    select: {
      id: true,
      title: true,
      status: true,
      totalBudget: true,
      targetCategories: true,
      _count: { select: { deals: true } },
      deals: {
        where: { status: "COMPLETED" },
        select: { amount: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  }),
  // ROI Calculation aggregate
  prisma.deal.aggregate({
    where: { brandId: profile.id, status: "COMPLETED" },
    _sum: { totalAmount: true },
    _count: { id: true },
  }),
  // Content Type Performance
  prisma.deal.groupBy({
    by: ["status"],
    where: { brandId: profile.id },
    _count: true,
    _sum: { amount: true },
  }),
  // Micro vs Macro comparison
  prisma.deal.findMany({
    where: { brandId: profile.id, status: "COMPLETED" },
    select: {
      amount: true,
      influencer: {
        select: {
          instagramFollowers: true,
          averageRating: true,
        },
      },
    },
    take: 1000,
  }),
  // Referrals
  getReferralStats(userId, { includeUsers: false }),
]);

const totalDealSpend = aggregateResult._sum.totalAmount ?? 0;
const avgDealCost =
  aggregateResult._count.id > 0
    ? Math.round(totalDealSpend / aggregateResult._count.id)
    : 0;

const micro = influencerDeals.filter(
(d) => (d.influencer?.instagramFollowers || 0) < 50000,
);
const macro = influencerDeals.filter(
(d) => (d.influencer?.instagramFollowers || 0) >= 50000,
);

const microVsMacro = {
micro: {
count: micro.length,
avgCost:
micro.length > 0
? Math.round(
micro.reduce((s: number, d) => s + d.amount, 0) /
micro.length,
)
: 0,
avgRating:
micro.length > 0
? (
micro.reduce(
(s: number, d) => s + (d.influencer?.averageRating || 0),
0,
) / micro.length
).toFixed(1)
: "0",
},
macro: {
count: macro.length,
avgCost:
macro.length > 0
? Math.round(
macro.reduce((s: number, d) => s + d.amount, 0) /
macro.length,
)
: 0,
avgRating:
macro.length > 0
? (
macro.reduce(
(s: number, d) => s + (d.influencer?.averageRating || 0),
0,
) / macro.length
).toFixed(1)
: "0",
},
};

return {
overview: {
totalSpent,
activeCampaigns,
totalCampaigns,
activeDeals,
trustScore: Math.min(profile.user.trustScore, 900),
completedDeals: aggregateResult._count.id,
avgDealCost,
memberSince: profile.user.createdAt,
},
spendHistory,
recentCampaigns: campaigns.map((c) => ({
id: c.id,
title: c.title,
status: c.status,
budget: c.totalBudget,
dealsCount: c._count.deals,
category: getPrimaryCategory(c.targetCategories),
completedDeals: c.deals.length,
amountSpent: c.deals.reduce((s: number, d) => s + d.amount, 0),
})),
dealStatusBreakdown: categoryPerf.map((p) => ({
status: p.status,
count: p._count,
totalAmount: p._sum.amount || 0,
})),
      microVsMacro,
      referralStats,
    };
  }, 60);
}

async function getMonthlySpend(userId: string, fy?: string) {
const wallet = await WalletService.getWalletBasic(userId);
if (!wallet) return emptyMonthlyTimeseries();

const { startDate, endDate } = resolveAnalyticsDates(fy);
return getMonthlyTransactions(wallet.id, "DEBIT", startDate, endDate);
}
