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
import { VisibilityAnalyticsService } from "@/services/visibility-analytics.service";
import { cache } from "./cache";
import { computeDrsTrend, type DrsTrendSummary } from "./drs-analytics";
import { getCategoryBaselineCpvSync } from "./roi-calculator";
import {
  calculateCampaignCpv,
  rankBestCreatorsByRoi,
  calculateRepeatCreators,
  generateBrandOperationalAlerts,
  type CampaignCpvComparison,
  type BestCreatorItem,
  type RepeatCreatorsSummary,
  type BrandOperationalAlert,
  type BrandDealCreatorInput,
  type BrandCampaignMetricInput,
} from "./brand-analytics-calc";

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
    earningsHistory,
    recentActivity,
    referralStats,
    userBadges,
    topDeals,
    allDeals,
    dealsByStatus,
    visibility,
    drsSnapshots,
  ] = await Promise.all([
    // Earnings history
    getMonthlyEarnings(profile.id, fy),
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
    // All deal status counts in a single group query
    prisma.deal.groupBy({
      by: ["status"],
      where: { influencerId: profile.id },
      _count: { id: true },
    }),
    // Creator 30-day profile visibility metrics
    VisibilityAnalyticsService.getCreatorVisibilityStats(userId).catch((err) => {
      logger.error("Failed to fetch creator visibility stats", err, { userId });
      return null;
    }),
    // DRS trust score history snapshots
    prisma.drsScoreSnapshot.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        previousScore: true,
        calculatedScore: true,
        finalScore: true,
        trigger: true,
        tier: true,
        createdAt: true,
      },
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

  const activeStatuses = new Set([
    "ACTIVE",
    "CONTENT_SUBMITTED",
    "REVISION_REQUESTED",
    "CONTENT_APPROVED",
    "POSTED",
    "VERIFICATION_PENDING",
  ]);
  const activeDeals = dealsByStatus
    .filter((g) => activeStatuses.has(g.status))
    .reduce((acc, g) => acc + g._count.id, 0);

  const completedCount = dealsByStatus.find((g) => g.status === "COMPLETED")?._count.id || 0;
  const cancelledCount = dealsByStatus.find((g) => g.status === "CANCELLED")?._count.id || 0;
  const totalClosed = completedCount + cancelledCount;
  const successRate = totalClosed > 0 ? Math.round((completedCount / totalClosed) * 100) : 100;
  const deliveryRate = successRate;

  const drsTrend: DrsTrendSummary = computeDrsTrend(
    drsSnapshots,
    profile.user?.trustScore ?? 600,
    "BRONZE"
  );

  const marketRangeSummary = {
    minPaise: profile.fairRateMinPaise ?? null,
    maxPaise: profile.fairRateMaxPaise ?? null,
    confidence: profile.fairRateConfidence ?? "MEDIUM",
    dataQuality: (profile.fairRateDataQuality as "VERIFIED" | "ESTIMATED") ?? "ESTIMATED",
    computedAt: profile.fairRateComputedAt ?? null,
    quotedRatePaise: profile.minRate ?? null,
  };

  logger.debug("InfluencerAnalytics data fetched successfully", { userId });
  return {
    overview: {
      totalEarnings,
      completedDeals,
      activeDeals,
      averageRating: profile.averageRating,
      trustScore: Math.max(300, Math.min(profile.user?.trustScore ?? 600, 900)),
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
      completedDeals: completedCount,
      cancelledDeals: cancelledCount,
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
    visibility,
    drsTrend,
    marketRangeSummary,
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

  const monthMap = new Map<string, number>(monthlyData.map((m) => [m.month, Number(m.amount)]));
  const result: Array<{ month: string; amount: number }> = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(startDate);
    d.setDate(1);
    d.setMonth(d.getMonth() + i);
    const monthStr = format(d, "MMM yyyy");
    const amount = monthMap.get(monthStr);
    result.push({ month: monthStr, amount: typeof amount === "number" ? amount : 0 });
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

export async function calculateDeliveryRate(influencerId: string) {
  const groups = await prisma.deal.groupBy({
    by: ["status"],
    where: { influencerId, status: { in: ["COMPLETED", "CANCELLED"] } },
    _count: { _all: true },
  });

  let completed = 0;
  let totalDeals = 0;
  for (const g of groups) {
    totalDeals += g._count._all;
    if (g.status === "COMPLETED") completed += g._count._all;
  }

  if (totalDeals === 0) return 100;
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
  spendHistory,
  campaigns,
  aggregateResult,
  categoryPerf,
  influencerDeals,
  referralStats,
  campaignVisibility,
] = await Promise.all([
  // Spend History (Last 12 Months or FY)
  getMonthlySpend(userId, fy),
  // Campaign Performance with Deal & Metrics Intelligence
  prisma.campaign.findMany({
    where: { brandId: profile.id },
    select: {
      id: true,
      title: true,
      status: true,
      totalBudget: true,
      targetCategories: true,
      applicationDeadline: true,
      postingDeadline: true,
      _count: { select: { deals: true } },
      deals: {
        select: {
          id: true,
          amount: true,
          status: true,
          submittedAt: true,
          influencerId: true,
          influencer: {
            select: {
              id: true,
              displayName: true,
              avatar: true,
              instagramHandle: true,
              instagramFollowers: true,
              instagramEngagementRate: true,
              averageRating: true,
            },
          },
          engagementSnapshots: {
            orderBy: { capturedAt: "desc" },
            take: 1,
            select: { views: true, isEstimated: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  }),
  // ROI Calculation aggregate
  prisma.deal.aggregate({
    where: { brandId: profile.id, status: "COMPLETED" },
    _sum: { totalAmount: true, amount: true },
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
  // Brand 30-day campaign visibility metrics
  VisibilityAnalyticsService.getBrandCampaignVisibilityStats(userId).catch((err) => {
    logger.error("Failed to fetch brand campaign visibility stats", err, { userId });
    return null;
  }),
]);

const activeDeals = categoryPerf
  .filter((g) => !["COMPLETED", "CANCELLED", "DISPUTED"].includes(g.status))
  .reduce((acc, g) => acc + g._count, 0);

const totalDealSpend = (aggregateResult._sum.amount || 0) > 0
  ? aggregateResult._sum.amount!
  : (aggregateResult._sum.totalAmount ?? 0);
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

  const brandDealList: BrandDealCreatorInput[] = [];
  let totalDeliveredViews = 0;
  let totalVerifiedViews = 0;
  let totalEstimatedViews = 0;
  let pendingSubmissionsCount = 0;

  const campaignMetricsInputs: BrandCampaignMetricInput[] = campaigns.map((c) => {
    let campSpend = 0;
    let campViews = 0;
    let campVerifiedViews = 0;
    let campEstimatedViews = 0;
    let activeDealsInCamp = 0;

    for (const d of c.deals) {
      if (d.status === "CONTENT_SUBMITTED") pendingSubmissionsCount++;
      if (!["COMPLETED", "CANCELLED", "DISPUTED"].includes(d.status)) activeDealsInCamp++;

      if (d.status === "COMPLETED") {
        campSpend += d.amount;
        const snap = d.engagementSnapshots[0];
        const views = snap?.views ?? Math.round(d.amount / 35);
        const isVerified = snap ? !snap.isEstimated : false;

        campViews += views;
        if (isVerified) {
          campVerifiedViews += views;
        } else {
          campEstimatedViews += views;
        }

        brandDealList.push({
          dealId: d.id,
          campaignId: c.id,
          campaignTitle: c.title,
          creatorId: d.influencerId,
          creatorName: d.influencer?.displayName || "Creator",
          creatorHandle: d.influencer?.instagramHandle,
          avatar: d.influencer?.avatar,
          amountPaise: d.amount,
          deliveredViews: views,
          isVerifiedViews: isVerified,
          engagementRateBps: Math.round((d.influencer?.instagramEngagementRate || 3) * 100),
          completedAt: null,
        });
      }
    }

    totalDeliveredViews += campViews;
    totalVerifiedViews += campVerifiedViews;
    totalEstimatedViews += campEstimatedViews;

    const rawCategories = Array.isArray(c.targetCategories)
      ? c.targetCategories
      : [String(c.targetCategories || "lifestyle")];
    const baselineCpvPaise = getCategoryBaselineCpvSync(rawCategories);

    return {
      id: c.id,
      title: c.title,
      status: c.status,
      category: getPrimaryCategory(c.targetCategories),
      budgetPaise: c.totalBudget,
      spendPaise: campSpend,
      deliveredViews: campViews,
      verifiedViews: campVerifiedViews,
      estimatedViews: campEstimatedViews,
      baselineCpvPaise,
      applicationDeadline: c.applicationDeadline,
      postingDeadline: c.postingDeadline,
      activeDealsCount: activeDealsInCamp,
    };
  });

  const campaignCpvMetrics: CampaignCpvComparison[] = campaignMetricsInputs.map(calculateCampaignCpv);
  const bestCreators: BestCreatorItem[] = rankBestCreatorsByRoi(brandDealList);
  const repeatCreators: RepeatCreatorsSummary = calculateRepeatCreators(brandDealList);
  const alerts: BrandOperationalAlert[] = generateBrandOperationalAlerts(campaignMetricsInputs, pendingSubmissionsCount);

  const spendVsViews = {
    totalSpendPaise: totalDealSpend,
    totalDeliveredViews,
    verifiedViews: totalVerifiedViews,
    estimatedViews: totalEstimatedViews,
    verifiedSharePercent: totalDeliveredViews > 0 ? Math.round((totalVerifiedViews / totalDeliveredViews) * 100) : 0,
    dataQuality: (totalVerifiedViews >= totalEstimatedViews ? "VERIFIED" : "ESTIMATED") as "VERIFIED" | "ESTIMATED",
  };

return {
overview: {
totalSpent,
activeCampaigns,
totalCampaigns,
activeDeals,
trustScore: Math.max(300, Math.min(profile.user.trustScore, 900)),
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
completedDeals: c.deals.filter((d) => d.status === "COMPLETED").length,
amountSpent: c.deals.filter((d) => d.status === "COMPLETED").reduce((s: number, d) => s + d.amount, 0),
})),
dealStatusBreakdown: categoryPerf.map((p) => ({
status: p.status,
count: p._count,
totalAmount: p._sum.amount || 0,
})),
      microVsMacro,
      referralStats,
      campaignVisibility,
      spendVsViews,
      campaignCpvMetrics,
      bestCreators,
      repeatCreators,
      alerts,
    };
  }, 60);
}

async function getMonthlySpend(userId: string, fy?: string) {
const wallet = await WalletService.getWalletBasic(userId);
if (!wallet) return emptyMonthlyTimeseries();

const { startDate, endDate } = resolveAnalyticsDates(fy);
return getMonthlyTransactions(wallet.id, "DEBIT", startDate, endDate);
}
