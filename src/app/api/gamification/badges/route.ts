import { apiWrapper } from "@/lib/api-wrapper";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { BADGES } from "@/lib/badges";
import { logger } from "@/lib/logger";
import { WalletService } from "@/services/wallet.service";

async function _handler_GET() {
try {
const session = await auth();
if (!session?.user?.id) {
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const userId = session.user.id;

// Fetch user details, profile, wallet, reviews, and referral count
const [user, influencer, brand, wallet, reviews5StarCount, referralCount, userBadges] = await Promise.all([
prisma.user.findUnique({
where: { id: userId },
select: { xp: true, level: true, userType: true },
}),
prisma.influencerProfile.findUnique({
where: { userId },
select: { id: true, completedDeals: true },
}),
prisma.brandProfile.findUnique({
where: { userId },
select: { id: true, totalCampaigns: true },
}),
WalletService.getWalletBasic(userId),
prisma.review.count({
where: {
receiverId: userId,
rating: { gte: 5 },
},
}),
prisma.user.count({
where: {
referredBy: userId,
OR: [
{ influencerProfile: { completedDeals: { gt: 0 } } },
{ brandProfile: { totalCampaigns: { gt: 0 } } },
],
},
}),
prisma.userBadge.findMany({
where: { userId },
include: { badge: true },
}),
]);

const responseBadges = BADGES.map((def) => {
const userBadge = userBadges.find(
(ub) => ub.badge?.name === def.name,
);

let currentProgress = 0;
let targetProgress = 1;
let hasProgress = false;

// 1. Deal Count
if (def.id === "first_deal" || def.id === "five_deals" || def.id === "ten_deals" ||
def.id === "twenty_five_deals" || def.id === "fifty_deals" || def.id === "hundred_deals" ||
def.id === "five_hundred_deals" || def.id === "thousand_deals") {
currentProgress = influencer?.completedDeals || 0;
const targets: Record<string, number> = {
first_deal: 1,
five_deals: 5,
ten_deals: 10,
twenty_five_deals: 25,
fifty_deals: 50,
hundred_deals: 100,
five_hundred_deals: 500,
thousand_deals: 1000,
};
targetProgress = targets[def.id] || 1;
hasProgress = true;
}

// 2. Brand Campaigns
if (def.id === "first_campaign" || def.id === "campaign_master") {
currentProgress = brand?.totalCampaigns || 0;
const targets: Record<string, number> = {
first_campaign: 1,
campaign_master: 25,
};
targetProgress = targets[def.id] || 1;
hasProgress = true;
}

// 3. Earnings
if (def.id === "earn_1k" || def.id === "earn_10k" || def.id === "earn_50k" ||
def.id === "earn_1lakh" || def.id === "earn_5lakh" || def.id === "earn_10lakh" ||
def.id === "earn_1crore") {
currentProgress = wallet ? Math.floor(wallet.totalEarned / 100) : 0;
const targets: Record<string, number> = {
earn_1k: 1000,
earn_10k: 10000,
earn_50k: 50000,
earn_1lakh: 100000,
earn_5lakh: 500000,
earn_10lakh: 1000000,
earn_1crore: 10000000,
};
targetProgress = targets[def.id] || 1;
hasProgress = true;
}

// 4. 5-Star Reviews
if (def.id === "first_5_star" || def.id === "five_5_star" || def.id === "ten_5_star") {
currentProgress = reviews5StarCount;
const targets: Record<string, number> = {
first_5_star: 1,
five_5_star: 5,
ten_5_star: 10,
};
targetProgress = targets[def.id] || 1;
hasProgress = true;
}

// 5. Referrals
if (def.id === "first_referral" || def.id === "five_referrals" || def.id === "ten_referrals" || def.id === "referral_king") {
currentProgress = referralCount;
const targets: Record<string, number> = {
first_referral: 1,
five_referrals: 5,
ten_referrals: 10,
referral_king: 50,
};
targetProgress = targets[def.id] || 1;
hasProgress = true;
}

const earned = !!userBadge;
if (earned) {
currentProgress = targetProgress;
}

return {
...def,
earned,
earnedAt: userBadge?.earnedAt || null,
hasProgress,
currentProgress,
targetProgress,
};
});

return NextResponse.json({
badges: responseBadges,
stats: {
xp: user?.xp || 0,
level: user?.level || 1,
totalBadges: userBadges.length,
availableBadges: BADGES.length,
},
});
} catch (error) {
logger.error("Badges fetch error", error);
return NextResponse.json(
{ error: "Failed to fetch badges", details: String(error) },
{ status: 500 },
);
}
}


// Wrapped handlers via apiWrapper
export const GET = apiWrapper(_handler_GET);
