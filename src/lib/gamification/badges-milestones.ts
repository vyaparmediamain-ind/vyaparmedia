import { Prisma } from "@prisma/client";
import prisma from "../db";
import { DbClient, GamificationUser } from "./types";

export async function checkMilestoneEarningsReferrals(
badgeId: string,
user: GamificationUser,
db: DbClient,
wallet: { totalEarned: number } | null
): Promise<boolean> {
if (badgeId.startsWith("first_deal") || badgeId.endsWith("_deals")) {
return await checkDealCount(user, badgeId, db);
}
if (badgeId.startsWith("earn_")) {
return await checkEarnings(user, badgeId, db, wallet);
}
if (badgeId.endsWith("_referral") || badgeId.endsWith("_referrals") || badgeId === "referral_king") {
return await checkReferralCount(user, badgeId, db);
}
return false;
}

export async function checkVerificationReviews(
badgeId: string,
userId: string,
user: GamificationUser,
db: DbClient,
influencerProfile: GamificationUser["influencerProfile"],
brandProfile: GamificationUser["brandProfile"]
): Promise<boolean> {
switch (badgeId) {
case "verified_identity":
return user.verificationLevel === "IDENTITY" || user.verificationLevel === "FULL";
case "social_connected": {
const [insta, yt] = await Promise.all([
db.oAuthAccount.findFirst({ where: { userId, provider: "instagram" } }),
db.oAuthAccount.findFirst({ where: { userId, provider: "youtube" } }),
]);
return !!(insta && yt);
}
case "verified_pro": {
const profile = user.influencerProfile;
if (profile) {
const followers = profile.instagramFollowers || 0;
const er = profile.instagramEngagementRate || 0;
return followers >= 10000 && er >= 300;
}
return false;
}
case "profile_complete":
if (user.userType === "INFLUENCER" && user.influencerProfile?.bio && user.influencerProfile?.categories) return true;
if (user.userType === "BRAND" && user.brandProfile?.description && user.brandProfile?.industry) return true;
return false;
case "first_5_star":
return await checkReviews(user.id, 1, 5, db, influencerProfile, brandProfile);
case "five_5_star":
return await checkReviews(user.id, 5, 5, db, influencerProfile, brandProfile);
case "ten_5_star":
return await checkReviews(user.id, 10, 5, db, influencerProfile, brandProfile);
default:
return false;
}
}


async function checkDealCount(
user: {
userType: string;
influencerProfile?: { completedDeals: number } | null;
brandProfile?: { totalCampaigns: number } | null;
},
badgeId: string,
_db: Prisma.TransactionClient | typeof prisma,
): Promise<boolean> {
let count = 0;

if (user.userType !== "INFLUENCER") return false;
count = user.influencerProfile?.completedDeals || 0;

switch (badgeId) {
case "first_deal":
return count >= 1;
case "five_deals":
return count >= 5;
case "ten_deals":
return count >= 10;
case "twenty_five_deals":
return count >= 25;
case "fifty_deals":
return count >= 50;
case "hundred_deals":
return count >= 100;
case "five_hundred_deals":
return count >= 500;
case "thousand_deals":
return count >= 1000;
default:
return false;
}
}

async function checkEarnings(
user: { id: string },
badgeId: string,
db: Prisma.TransactionClient | typeof prisma,
wallet?: { totalEarned: number } | null,
): Promise<boolean> {
let amount = 0;
if (wallet) {
amount = wallet.totalEarned / 100;
} else {
const prismaRef = db;
const walletData = await prismaRef.wallet.findUnique({
where: { userId: user.id },
});
if (!walletData) return false;
amount = walletData.totalEarned / 100;
}

switch (badgeId) {
case "earn_1k":
return amount >= 1000;
case "earn_10k":
return amount >= 10000;
case "earn_50k":
return amount >= 50000;
case "earn_1lakh":
return amount >= 100000;
case "earn_5lakh":
return amount >= 500000;
case "earn_10lakh":
return amount >= 1000000;
case "earn_1crore":
return amount >= 10000000;
default:
return false;
}
}

async function checkReviews(
userId: string,
countNeeded: number,
minRating: number,
db: Prisma.TransactionClient | typeof prisma,
influencerProfile?: { id: string } | null,
brandProfile?: { id: string } | null,
): Promise<boolean> {
const prismaRef = db;

const influencer = influencerProfile || await prismaRef.influencerProfile.findUnique({
where: { userId },
});
const brand = brandProfile || await prismaRef.brandProfile.findUnique({ where: { userId } });

const whereClause: Record<string, unknown> = {};
if (influencer) whereClause.influencerRevieweeId = influencer.id;
else if (brand) whereClause.brandRevieweeId = brand.id;
else return false;

whereClause.rating = { gte: minRating };

const count = await prismaRef.review.count({ where: whereClause });
return count >= countNeeded;
}

async function checkReferralCount(
user: { id: string },
badgeId: string,
db: Prisma.TransactionClient | typeof prisma,
): Promise<boolean> {
const prismaRef = db;

const referralCount = await prismaRef.user.count({
where: {
referredBy: user.id,
OR: [
{ influencerProfile: { completedDeals: { gt: 0 } } },
{ brandProfile: { totalCampaigns: { gt: 0 } } },
],
},
});

switch (badgeId) {
case "first_referral":
return referralCount >= 1;
case "five_referrals":
return referralCount >= 5;
case "ten_referrals":
return referralCount >= 10;
case "referral_king":
return referralCount >= 50;
default:
return false;
}
}

