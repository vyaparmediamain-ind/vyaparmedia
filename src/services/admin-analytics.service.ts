import prisma from "@/lib/db";
import {
subDays,
subMonths,
format,
} from "date-fns";
import { cache } from "@/lib/cache";

export class AdminAnalyticsService {

/**
* returns strict financial metrics for the financial report page/API
*/
static async getFinancialOverview() {
return cache(
"admin:financial_overview",
async () => {
const now = new Date();
const thirtyDaysAgo = subDays(now, 30);

// Core Financial Metrics
const [
totalDeals,
completedDeals,
activeDeals,
disputedDeals,
cancelledDeals,
] = await Promise.all([
prisma.deal.count(),
prisma.deal.count({ where: { status: "COMPLETED" } }),
prisma.deal.count({
where: {
status: {
in: [
"PENDING_SIGNATURE",
"PAYMENT_PENDING",
"PAYMENT_HELD",
"ACTIVE",
"CONTENT_SUBMITTED",
"REVISION_REQUESTED",
"CONTENT_APPROVED",
"POSTED",
"VERIFICATION_PENDING",
"VERIFIED",
],
},
},
}),
prisma.deal.count({ where: { status: "DISPUTED" } }),
prisma.deal.count({ where: { status: "CANCELLED" } }),
]);

// GMV & Revenue
const dealAggregations = await prisma.deal.aggregate({
_sum: {
totalAmount: true,
platformFee: true,
gatewayFee: true,
influencerPayout: true,
},
where: { status: "COMPLETED" },
});

const gmv = dealAggregations._sum.totalAmount || 0;
const platformRevenue = dealAggregations._sum.platformFee || 0;
const gatewayFees = dealAggregations._sum.gatewayFee || 0;
const influencerPayouts = dealAggregations._sum.influencerPayout || 0;

// Last 30 days GMV
const recentDealAgg = await prisma.deal.aggregate({
_sum: {
totalAmount: true,
platformFee: true,
},
where: {
status: "COMPLETED",
completedAt: { gte: thirtyDaysAgo },
},
});

const gmvLast30Days = recentDealAgg._sum.totalAmount || 0;
const revenueLast30Days = recentDealAgg._sum.platformFee || 0;

// Pending Payouts (Escrow)
const pendingPayouts = await prisma.deal.aggregate({
_sum: { amount: true },
_count: true,
where: {
status: {
in: [
"PAYMENT_HELD",
"ACTIVE",
"CONTENT_SUBMITTED",
"REVISION_REQUESTED",
"CONTENT_APPROVED",
"POSTED",
"VERIFICATION_PENDING",
"VERIFIED",
"DISPUTED",
],
},
},
});

// Refunds
const totalRefunds = await prisma.transaction.aggregate({
_sum: { amount: true },
_count: true,
where: { type: "REFUND", status: "COMPLETED" },
});

const recentRefunds = await prisma.transaction.aggregate({
_sum: { amount: true },
_count: true,
where: {
type: "REFUND",
status: "COMPLETED",
createdAt: { gte: thirtyDaysAgo },
},
});

// Wallet Balances (Liabilities) Exclude platform treasury
const walletAgg = await prisma.wallet.aggregate({
_sum: {
balance: true,
totalEarned: true,
totalWithdrawn: true,
},
where: {
// PLATFORM_TREASURY is the platform's own operating wallet, NOT a
// user liability. Excluding it gives accurate liability figures.
userId: { not: "PLATFORM_TREASURY" },
},
});

// Withdrawal Stats
const totalWithdrawals = await prisma.withdrawal.aggregate({
_sum: { amount: true },
_count: true,
where: { status: "COMPLETED" },
});

const pendingWithdrawals = await prisma.withdrawal.aggregate({
_sum: { amount: true },
_count: true,
where: { status: "PENDING" },
});

// Payment Success Rate (last 30 days)
const [successfulPayments, failedPayments] = await Promise.all([
prisma.transaction.count({
where: {
status: "COMPLETED",
createdAt: { gte: thirtyDaysAgo },
},
}),
prisma.transaction.count({
where: {
status: "FAILED",
createdAt: { gte: thirtyDaysAgo },
},
}),
]);

const totalPaymentAttempts = successfulPayments + failedPayments;
const paymentSuccessRate =
totalPaymentAttempts > 0
? Math.round((successfulPayments / totalPaymentAttempts) * 10000) / 100
: 100;

// Monthly Revenue Trend (last 6 months)
const monthlyRevenue = await this.getMonthlyRevenueHistory(6);

// Late Fees Collected
const lateFees = await prisma.transaction.aggregate({
_sum: { amount: true },
_count: true,
where: {
description: { contains: "Late approval fee" },
type: "DEBIT",
status: "COMPLETED",
},
});

// Clawbacks
const clawbacks = await prisma.transaction.aggregate({
_sum: { amount: true },
_count: true,
where: { type: "CLAWBACK", status: "COMPLETED" },
});

const result = {
overview: {
gmv,
gmvLast30Days,
platformRevenue,
revenueLast30Days,
gatewayFees,
influencerPayouts,
netProfit: platformRevenue - gatewayFees,
},
deals: {
total: totalDeals,
completed: completedDeals,
active: activeDeals,
disputed: disputedDeals,
cancelled: cancelledDeals,
completionRate:
totalDeals > 0
? Math.round((completedDeals / totalDeals) * 10000) / 100
: 0,
},
payments: {
pendingPayouts: pendingPayouts._sum.amount || 0,
pendingPayoutCount: pendingPayouts._count || 0,
successRate: paymentSuccessRate,
},
refunds: {
totalAmount: totalRefunds._sum.amount || 0,
totalCount: totalRefunds._count || 0,
last30DaysAmount: recentRefunds._sum.amount || 0,
last30DaysCount: recentRefunds._count || 0,
},
wallets: {
totalBalance: walletAgg._sum.balance || 0,
totalEarned: walletAgg._sum.totalEarned || 0,
totalWithdrawn: walletAgg._sum.totalWithdrawn || 0,
},
withdrawals: {
completedAmount: totalWithdrawals._sum.amount || 0,
completedCount: totalWithdrawals._count || 0,
pendingAmount: pendingWithdrawals._sum.amount || 0,
pendingCount: pendingWithdrawals._count || 0,
},
fees: {
lateFees: lateFees._sum.amount || 0,
lateFeeCount: lateFees._count || 0,
clawbacks: clawbacks._sum.amount || 0,
clawbackCount: clawbacks._count || 0,
},
monthlyRevenue,
};
return result;
},
60, // 1 minute TTL
);
}

/**
* Returns the comprehensive dashboard statistics for the Admin Analytics View.
* Consolidates logic that was previously in analytics-engine.ts
*/
static async getDashboardStats() {
return cache(
"admin:dashboard_stats",
async () => {
const now = new Date();
const thirtyDaysAgo = subDays(now, 30);
const sevenDaysAgo = subDays(now, 7);
const istOffset = 5.5 * 60 * 60 * 1000;
const todayIST = new Date(now.getTime() + istOffset);
todayIST.setUTCHours(0, 0, 0, 0);
const today = new Date(todayIST.getTime() - istOffset);

// ===== 1. REAL-TIME COUNTS =====
const [totalUsers, totalInfluencers, totalBrands, activeUsers7d] =
await Promise.all([
prisma.user.count(),
prisma.user.count({
where: { userType: "INFLUENCER", status: "ACTIVE" },
}),
prisma.user.count({ where: { userType: "BRAND", status: "ACTIVE" } }),
prisma.user.count({ where: { updatedAt: { gte: sevenDaysAgo } } }),
]);

// ===== 2. DEALS IN PROGRESS =====
const [
activeDeals,
completedDealsToday,
totalCompletedDeals,
disputesOpen,
] = await Promise.all([
prisma.deal.count({
where: { status: { notIn: ["COMPLETED", "CANCELLED", "DISPUTED"] } },
}),
prisma.deal.count({
where: { status: "COMPLETED", completedAt: { gte: today } },
}),
prisma.deal.count({ where: { status: "COMPLETED" } }),
prisma.dispute.count({
where: {
status: {
in: ["OPEN", "TIER1_AUTO", "TIER2_MEDIATION", "TIER3_ARBITRATION"],
},
},
}),
]);

// ===== 3. REVENUE TODAY =====
const revenueToday = await prisma.deal.aggregate({
where: { status: "COMPLETED", completedAt: { gte: today } },
_sum: { platformFee: true },
});

// ===== 4. USER GROWTH (Last 30 days) =====
const users = await prisma.user.findMany({
where: { createdAt: { gte: thirtyDaysAgo } },
select: { createdAt: true, userType: true },
take: 10000, // Safety cap to prevent loading excessive user data
});

const growthByDay = new Map<
string,
{ total: number; influencer: number; brand: number }
>();
users.forEach((u) => {
const day = format(u.createdAt, "yyyy-MM-dd");
if (!growthByDay.has(day))
growthByDay.set(day, { total: 0, influencer: 0, brand: 0 });
const entry = growthByDay.get(day)!;
entry.total++;
if (u.userType === "INFLUENCER") entry.influencer++;
else if (u.userType === "BRAND") entry.brand++;
});

// ===== 5. FINANCIAL OVERVIEW =====
const [totalRevenue, totalGMV, pendingPayouts, totalRefunds] =
await Promise.all([
  prisma.deal.aggregate({
    where: { status: "COMPLETED" },
    _sum: { platformFee: true },
  }),
  prisma.deal.aggregate({
    where: { status: "COMPLETED" },
    _sum: { totalAmount: true },
  }),
  prisma.deal.aggregate({
    _sum: { amount: true },
    where: {
      status: {
        in: [
          "PAYMENT_HELD",
          "ACTIVE",
          "CONTENT_SUBMITTED",
          "REVISION_REQUESTED",
          "CONTENT_APPROVED",
          "POSTED",
          "VERIFICATION_PENDING",
          "VERIFIED",
          "DISPUTED",
        ],
      },
    },
  }),
  prisma.transaction.aggregate({
    where: {
      type: "CREDIT",
      description: { contains: "refund", mode: "insensitive" },
    },
    _sum: { amount: true },
  }),
]);

// Monthly revenue for cash flow chart
// Reusing custom logic here instead of calling getFinancialOverview to match format
const monthlyRevenue =
await AdminAnalyticsService.getMonthlyRevenueHistory(12);

// ===== 6. GROWTH METRICS =====
// Signups trend (last 30d vs previous 30d)
const sixtyDaysAgo = subDays(now, 60);
const signupsLast30 = users.length;
const signupsPrev30 = await prisma.user.count({
where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
});
const signupGrowthRate =
signupsPrev30 > 0
? Math.round(((signupsLast30 - signupsPrev30) / signupsPrev30) * 100)
: 100;

// Activation rate (users who completed at least 1 deal / total signups)
const activatedUsers = await prisma.user.count({
where: {
OR: [
{ influencerProfile: { completedDeals: { gt: 0 } } },
{ brandProfile: { totalCampaigns: { gt: 0 } } },
],
},
});
const activationRate =
totalUsers > 0 ? Math.round((activatedUsers / totalUsers) * 100) : 0;

// Churn rate (users who haven't been active in 30 days)
const inactiveUsers = await prisma.user.count({
where: { updatedAt: { lt: thirtyDaysAgo }, status: "ACTIVE" },
});
const churnRate =
totalUsers > 0 ? Math.round((inactiveUsers / totalUsers) * 100) : 0;

// K-Factor (viral coefficient) = invites per user conversion rate
const totalReferrals = await prisma.user.count({
where: { referredBy: { not: null } },
});
const referringUsers = await prisma.user.count({
where: { referredUsers: { some: {} } },
});
const avgInvitesPerUser =
referringUsers > 0 ? totalReferrals / referringUsers : 0;
const referralConversionRate =
totalUsers > 0 ? totalReferrals / totalUsers : 0;
const kFactor = Number(
(avgInvitesPerUser * referralConversionRate).toFixed(2),
);

// ===== 7. PAYMENT SUCCESS RATE =====
const [totalPayments, failedPayments] = await Promise.all([
prisma.transaction.count({
where: { type: { in: ["CREDIT", "DEBIT"] } },
}),
prisma.transaction.count({ where: { status: "FAILED" } }),
]);
const paymentSuccessRate =
totalPayments > 0
? Math.round(((totalPayments - failedPayments) / totalPayments) * 100)
: 100;

// ===== 8. SYSTEM HEALTH =====
const recentErrors = await prisma.activityLog.count({
where: {
action: { contains: "ERROR" },
createdAt: { gte: sevenDaysAgo },
},
});

const fraudAlerts = await prisma.userViolation.count({
where: {
type: "FRAUD",
createdAt: { gte: sevenDaysAgo },
},
});

let systemStatus = "CRITICAL";
if (recentErrors < 10) {
systemStatus = "HEALTHY";
} else if (recentErrors < 50) {
systemStatus = "WARNING";
}

const result = {
realTime: {
totalUsers,
totalInfluencers,
totalBrands,
activeUsers7d,
activeDeals,
completedDealsToday,
revenueToday: revenueToday._sum.platformFee || 0,
disputesOpen,
},
growth: Array.from(growthByDay.entries())
.map(([date, stats]) => ({ date, ...stats }))
.sort((a, b) => a.date.localeCompare(b.date)),
financials: {
totalRevenue: totalRevenue._sum.platformFee || 0,
totalGMV: totalGMV._sum.totalAmount || 0,
pendingPayouts: pendingPayouts._sum.amount || 0,
totalRefunds: totalRefunds._sum.amount || 0,
revenueToday: revenueToday._sum.platformFee || 0,
revenueHistory: monthlyRevenue,
},
activity: {
activeDeals,
totalCompletedDeals,
disputesOpen,
},
growthMetrics: {
signupsLast30,
signupGrowthRate,
activationRate,
churnRate,
kFactor,
totalReferrals,
paymentSuccessRate,
},
systemHealth: {
recentErrors,
fraudAlerts,
paymentSuccessRate,
status: systemStatus,
},
};
return result;
},
60, // 1 minute TTL
);
}

  private static async getMonthlyRevenueHistory(monthsCount: number) {
    const baseDate = new Date();
    baseDate.setDate(1);
    const months = Array.from({ length: monthsCount }, (_, i) => {
      const d = subMonths(baseDate, i);
      return {
        date: d,
        month: format(d, "MMM yyyy"),
        revenue: 0,
        gmv: 0,
        deals: 0,
      };
    }).reverse();

const transactions = await prisma.transaction.findMany({
where: {
type: "PLATFORM_FEE",
createdAt: { gte: subMonths(new Date(), monthsCount) },
},
take: 10000, // Safety cap to prevent loading excessive transaction history
});

transactions.forEach((tx) => {
const monthStr = format(tx.createdAt, "MMM yyyy");
const monthObj = months.find((m) => m.month === monthStr);
if (monthObj) monthObj.revenue += tx.amount;
});

const deals = await prisma.deal.findMany({
where: {
status: "COMPLETED",
completedAt: { gte: subMonths(new Date(), monthsCount) },
},
select: { totalAmount: true, completedAt: true },
take: 10000,
});

deals.forEach((deal) => {
if (!deal.completedAt) return;
const monthStr = format(deal.completedAt, "MMM yyyy");
const monthObj = months.find((m) => m.month === monthStr);
if (monthObj) {
monthObj.gmv += deal.totalAmount;
monthObj.deals += 1;
}
});

return months.map((m) => ({
month: m.month,
revenue: m.revenue,
gmv: m.gmv,
deals: m.deals,
}));
}
}
