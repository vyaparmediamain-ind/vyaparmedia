import { AppError } from "@/lib/errors";
import prisma, { ensurePlatformTreasury } from "./db";
import { Prisma } from "@prisma/client";
import { logger } from "./logger";
import { redis } from "./redis";
import { getErrorMessage, generateReferralCode } from "./utils";
import { isEligibleForReferralEarnings } from "./enterprise-trust-guard";
import { addUserXp, checkAndAwardBadges } from "./gamification-engine";
import { NotificationService } from "@/services/notification.service";
import { WalletService } from "@/services/wallet.service";
import { checkChallengeProgress } from "./weekly-challenges";
import { env } from "@/env";

/**
* Referral Engine 5-Tier System
*
* Bronze (10 referrals): +250 XP, 1% fee discount
* Silver (50 referrals): +1500 XP, 1.5% fee discount
* Gold (100 referrals): +3500 XP, 2% fee discount
* Platinum(500 referrals): 1% GMV revenue share (lifetime)
* Diamond (1000 referrals): 2% GMV revenue share (lifetime) + equity option
*/

interface ReferralTier {
name: string;
min: number;
commission: number; // For backward compatibility / generic use
feeDiscount: number; // % discount on user's own platform fees
revenueShare: number; // % of ALL referral revenue (lifetime)
xpReward: number; // XP granted on reaching tier
label: string;
color: string;
icon: string;
}

const REFERRAL_TIERS: Record<"STARTER" | "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "DIAMOND", ReferralTier> = {
STARTER: {
name: "STARTER",
min: 0,
commission: 0,
feeDiscount: 0,
revenueShare: 0,
xpReward: 0,
label: "Starter",
color: "#6b7280",
icon: "★",
},
BRONZE: {
name: "BRONZE",
min: 10,
commission: 0,
feeDiscount: 1,
revenueShare: 0,
xpReward: 250,
label: "Bronze",
color: "#cd7f32",
icon: "🥉",
},
SILVER: {
name: "SILVER",
min: 50,
commission: 0,
feeDiscount: 1.5,
revenueShare: 0,
xpReward: 1500,
label: "Silver",
color: "#c0c0c0",
icon: "🥈",
},
GOLD: {
name: "GOLD",
min: 200,
commission: 0,
feeDiscount: 2,
revenueShare: 0,
xpReward: 5000,
label: "Gold",
color: "#ffd700",
icon: "🥇",
},
PLATINUM: {
name: "PLATINUM",
min: 500,
commission: 0,
feeDiscount: 2, // Retains Gold discount
revenueShare: 0.01, // 1% of GMV
xpReward: 0,
label: "Platinum",
color: "#e5e4e2",
icon: "🏆",
},
DIAMOND: {
name: "DIAMOND",
min: 1000,
commission: 0,
feeDiscount: 2, // Retains Gold discount
revenueShare: 0.02, // 2% of GMV
xpReward: 0,
label: "Diamond",
color: "#b9f2ff",
icon: "💎",
},
};

/**
* Determine referral tier from active referral count.
*/
function getTierFromCount(activeReferrals: number): ReferralTier {
if (activeReferrals >= REFERRAL_TIERS.DIAMOND.min)
return REFERRAL_TIERS.DIAMOND;
if (activeReferrals >= REFERRAL_TIERS.PLATINUM.min)
return REFERRAL_TIERS.PLATINUM;
if (activeReferrals >= REFERRAL_TIERS.GOLD.min) return REFERRAL_TIERS.GOLD;
if (activeReferrals >= REFERRAL_TIERS.SILVER.min)
return REFERRAL_TIERS.SILVER;
if (activeReferrals >= REFERRAL_TIERS.BRONZE.min)
return REFERRAL_TIERS.BRONZE;
return REFERRAL_TIERS.STARTER;
}

/**
* Get next tier info for progression display.
*/
function getNextTier(currentTier: ReferralTier): ReferralTier | null {
const tierOrder: ReferralTier[] = [
REFERRAL_TIERS.STARTER,
REFERRAL_TIERS.BRONZE,
REFERRAL_TIERS.SILVER,
REFERRAL_TIERS.GOLD,
REFERRAL_TIERS.PLATINUM,
REFERRAL_TIERS.DIAMOND,
];
const idx = tierOrder.findIndex((t) => t.name === currentTier.name);
return idx >= 0 && idx < tierOrder.length - 1 ? tierOrder[idx + 1] ?? null : null;
}

// ==================== REFERRAL STATS ====================

async function getCachedReferralStats(cacheKey: string) {
  try {
    const cached = await redis.get(cacheKey);
    return cached ? JSON.parse(cached) : null;
  } catch (err) {
    logger.warn("Redis read failed for getReferralStats", err instanceof Error ? { error: err.message } : { error: String(err) });
    return null;
  }
}

async function ensureMemorableReferralCode(user: {
  id: string;
  referralCode: string | null;
  brandProfile?: { companyName: string | null } | null;
  influencerProfile?: { displayName: string | null } | null;
}): Promise<string> {
  const current = user.referralCode;
  const isLegacyCode = !current || (current.startsWith("c") && current.length >= 20);
  if (!isLegacyCode) {
    return current;
  }

  const rawSeed = user.brandProfile?.companyName || user.influencerProfile?.displayName || "VM";
  const seed = rawSeed.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) || "VM";
  const newCode = generateReferralCode(seed);

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { referralCode: newCode },
    });
    return newCode;
  } catch (codeErr) {
    logger.warn("Could not update legacy referral code", codeErr instanceof Error ? { error: codeErr.message } : { error: String(codeErr) });
    return current || newCode;
  }
}

type RawReferredUserRecord = {
  id: string;
  email: string;
  status: string;
  userType: string;
  createdAt: Date;
  influencerProfile: { displayName: string | null; completedDeals: number; totalEarnings: number } | null;
  brandProfile: { companyName: string | null; totalCampaigns: number; totalSpent: number; campaigns: Array<{ id: string }> } | null;
};

function formatReferredUser(ru: RawReferredUserRecord) {
  let isActive = false;
  if (ru.influencerProfile) {
    isActive = ru.influencerProfile.completedDeals > 0;
  } else if (ru.brandProfile) {
    isActive = ru.brandProfile.totalSpent > 0 || ru.brandProfile.campaigns.length > 0;
  }

  const fallbackName = ru.influencerProfile?.displayName || ru.brandProfile?.companyName || ru.email.split("@")[0];
  const maskedEmail = ru.email.replace(/^([^@]{2})[^@]*(@.*)$/, "$1***$2");

  return {
    id: ru.id,
    name: fallbackName,
    email: maskedEmail,
    joinedAt: ru.createdAt,
    status: isActive ? "ACTIVE" : "PENDING",
    type: ru.userType,
    deals: ru.influencerProfile?.completedDeals || ru.brandProfile?.totalCampaigns || 0,
    earnings: ru.influencerProfile?.totalEarnings || ru.brandProfile?.totalSpent || 0,
  };
}

async function fetchReferredUsersList(userId: string, offset: number, limit: number) {
  const rawReferredUsers = await prisma.user.findMany({
    where: { referredBy: userId },
    select: {
      id: true,
      email: true,
      status: true,
      userType: true,
      createdAt: true,
      influencerProfile: {
        select: { displayName: true, completedDeals: true, totalEarnings: true },
      },
      brandProfile: {
        select: {
          companyName: true,
          totalCampaigns: true,
          totalSpent: true,
          campaigns: {
            where: { status: "COMPLETED" },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    skip: offset,
    take: limit,
  });

  return rawReferredUsers.map(formatReferredUser);
}

export async function getReferralStats(
  userId: string,
  options?: { includeUsers?: boolean; limit?: number; offset?: number },
) {
  const includeUsers = options?.includeUsers ?? true;
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const cacheKey = `referral_stats:${userId}:${includeUsers}:${limit}:${offset}`;
  const cached = await getCachedReferralStats(cacheKey);
  if (cached) return cached;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      influencerProfile: { select: { displayName: true } },
      brandProfile: { select: { companyName: true } },
      _count: {
        select: { referredUsers: true },
      },
    },
  });

  if (!user) return null;

  const activeReferralCode = await ensureMemorableReferralCode(user);
  const totalReferrals = user._count.referredUsers;

  const activeReferrals = await prisma.user.count({
    where: {
      referredBy: userId,
      OR: [
        { influencerProfile: { completedDeals: { gt: 0 } } },
        {
          brandProfile: {
            OR: [
              { campaigns: { some: { status: "COMPLETED" } } },
              { totalSpent: { gt: 0 } },
            ],
          },
        },
      ],
    },
  });

  const currentTier = getTierFromCount(activeReferrals);
  const nextTier = getNextTier(currentTier);

  const wallet = await WalletService.getWalletBasic(userId);
  const referralTx = await prisma.transaction.aggregate({
    where: {
      walletId: wallet?.id,
      type: "CREDIT",
      status: "COMPLETED",
      description: { contains: "Referral", mode: "insensitive" },
    },
    _sum: { amount: true },
  });

  const referredUsers = includeUsers ? await fetchReferredUsersList(userId, offset, limit) : [];
  const shareableLink = `${process.env.NEXT_PUBLIC_APP_URL || "https://VyaparMedia.in"}/register?ref=${activeReferralCode}`;

  const result = {
    totalReferrals,
    activeReferrals,
    tier: currentTier,
    nextTier,
    progressToNext: nextTier
      ? {
          current: activeReferrals,
          needed: nextTier.min,
          percentage: Math.min(100, Math.round((activeReferrals / nextTier.min) * 100)),
        }
      : null,
    earnings: referralTx._sum.amount || 0,
    referralCode: activeReferralCode,
    shareableLink,
    referredUsers,
    feeDiscount: currentTier.feeDiscount,
  };

// Cache the result for 5 minutes
try {
await redis.setex(cacheKey, 300, JSON.stringify(result));
} catch (err) {
logger.warn("Redis write failed for getReferralStats", err instanceof Error ? { error: err.message } : { error: String(err) });
}

return result;
}

// ==================== REFERRAL REWARD PROCESSING ====================

/**
* Process a referral reward for a completed deal.
* Includes commission + revenue share for Platinum/Diamond tiers.
*/
interface ReferralTriggerUser {
  id: string;
  userType: string;
  influencerProfile?: { id: string; completedDeals: number } | null;
  brandProfile?: { id: string } | null;
}

async function checkWasActiveBefore(
  triggeringUser: ReferralTriggerUser | null | undefined,
  dealAmount: number,
  db: Prisma.TransactionClient | typeof prisma,
  dealId?: string,
): Promise<boolean> {
  if (triggeringUser?.userType === "INFLUENCER" && triggeringUser.influencerProfile) {
    const otherCompletedDealsCount = await db.deal.count({
      where: {
        influencerId: triggeringUser.influencerProfile.id,
        status: "COMPLETED",
        ...(dealId ? { id: { not: dealId } } : {}),
      },
    });
    return otherCompletedDealsCount > 0;
  }
  if (triggeringUser?.userType === "BRAND" && triggeringUser?.brandProfile) {
    const otherCompletedDealsCount = await db.deal.count({
      where: {
        brandId: triggeringUser.brandProfile.id,
        status: "COMPLETED",
        ...(dealId ? { id: { not: dealId } } : {}),
      },
    });
    return otherCompletedDealsCount > 0;
  }
  return false;
}

interface PayoutReferralMonetaryRewardConfig {
db: Prisma.TransactionClient;
referrerId: string;
userId: string;
dealId?: string | undefined;
dealAmount: number;
totalReward: number;
revenueShareAmount: number;
currentTier: ReferralTier;
treasuryWalletId?: string | undefined;
tierUpgraded: boolean;
}

async function payoutReferralMonetaryReward(config: PayoutReferralMonetaryRewardConfig) {
const {
db,
referrerId,
userId,
dealId,
dealAmount,
totalReward,
revenueShareAmount,
currentTier,
treasuryWalletId,
tierUpgraded,
} = config;

  const referrerWallet = await db.wallet.upsert({
    where: { userId: referrerId },
    create: { userId: referrerId, balance: 0, pendingBalance: 0 },
    update: {},
  });

// Double-payment protection
if (dealId) {
const existing = await db.transaction.findFirst({
where: {
dealId,
walletId: referrerWallet.id,
type: "CREDIT",
description: { startsWith: "Referral Bonus" },
},
});
if (existing) {
logger.info("Referral reward already processed for this deal", { dealId, referrerId });
return;
}
}

// Double-entry bookkeeping: debit the PLATFORM_TREASURY wallet.
let treasuryWallet: { id: string } | null = null;

if (treasuryWalletId) {
treasuryWallet = { id: treasuryWalletId };
} else {
treasuryWallet = await ensurePlatformTreasury(db);
}

if (!treasuryWallet) {
throw AppError.badRequest("Treasury wallet could not be resolved");
}

// Floor-guard: match the updateMany+gte pattern used in all other wallet debit paths.
const treasuryDebitResult = await db.wallet.updateMany({
where: {
id: treasuryWallet.id,
balance: { gte: totalReward },
},
data: { balance: { decrement: totalReward } },
});

if (treasuryDebitResult.count === 0) {
// Treasury is underfunded debit anyway to keep double-entry accurate, but log loudly.
await db.wallet.update({
where: { id: treasuryWallet.id },
data: { balance: { decrement: totalReward } },
});
logger.error(
"CRITICAL: PLATFORM_TREASURY underfunded during referral payout. Treasury balance is negative. Immediate funding required.",
{
treasuryWalletId: treasuryWallet.id,
totalReward,
referrerId,
userId,
tier: currentTier.name,
},
);
}

// Record DEBIT transaction for treasury
await db.transaction.create({
data: {
walletId: treasuryWallet.id,
dealId: dealId ?? null,
type: "DEBIT",
amount: totalReward,
status: "COMPLETED",
description: `Referral Payout Debit for Referrer ${referrerId} (Deal Amount: ${dealAmount} Paise)`,
metadata: {
referralUserId: userId,
referrerId,
tier: currentTier.name,
},
},
});

await db.wallet.update({
where: { id: referrerWallet.id },
data: {
balance: { increment: totalReward },
totalEarned: { increment: totalReward },
},
});

await db.transaction.create({
data: {
walletId: referrerWallet.id,
dealId: dealId ?? null,
type: "CREDIT",
amount: totalReward,
status: "COMPLETED",
metadata: {
referralUserId: userId,
tier: currentTier.name,
revenueShareAmount,
},
description: `Referral Bonus (${currentTier.label} Tier): ${(totalReward / 100).toFixed(2)} GMV share`,
},
});

// 5. Notify referrer
await NotificationService.createNotification({
userId: referrerId,
type: "referral_bonus",
title: `${currentTier.icon} Referral Bonus Earned!`,
message: tierUpgraded
? `You leveled up to ${currentTier.label} (+${currentTier.xpReward} XP) and earned ${(totalReward / 100).toFixed(2)} GMV share lifetime passive income!`
: `You earned ${(totalReward / 100).toFixed(2)} lifetime passive income from a referral's deal!`,
data: structuredClone({
amount: totalReward,
tier: currentTier.label,
revenueShare: revenueShareAmount,
}),
}, db);

logger.info("Referral reward processed", {
referrerId,
userId,
totalReward,
tier: currentTier.label,
revenueShareAmount,
tierUpgraded,
xpAwarded: tierUpgraded ? currentTier.xpReward : 0
});
}

function buildActiveReferralWhere(referrerId: string): Prisma.UserWhereInput {
  return {
    referredBy: referrerId,
    OR: [
      { influencerProfile: { completedDeals: { gt: 0 } } },
      {
        brandProfile: {
          OR: [
            { campaigns: { some: { status: "COMPLETED" } } },
            { deals: { some: { status: "COMPLETED" } } },
            { totalSpent: { gt: 0 } },
          ],
        },
      },
    ],
  };
}

async function checkDuplicateReferral(
  db: Prisma.TransactionClient,
  referrerId: string,
  dealId: string | undefined,
): Promise<boolean> {
  if (!dealId) return false;
  const referrerWallet = await db.wallet.findUnique({
    where: { userId: referrerId },
    select: { id: true },
  });
  if (referrerWallet) {
    const existing = await db.transaction.findFirst({
      where: {
        dealId,
        walletId: referrerWallet.id,
        type: "CREDIT",
        description: { startsWith: "Referral Bonus" },
      },
    });
    if (existing) {
      return true;
    }
  }
  return false;
}

async function checkReferrerEligibility(
  db: Prisma.TransactionClient,
  referrerId: string,
): Promise<boolean> {
  const referrerUser = await db.user.findUnique({
    where: { id: referrerId },
    select: { trustScore: true },
  });
  if (!referrerUser || !isEligibleForReferralEarnings(referrerUser.trustScore)) {
    return false;
  }
  return true;
}

async function handleReferralGamification(
  db: Prisma.TransactionClient,
  referrerId: string,
  userId: string,
  isFirstActiveEvent: boolean,
  currentTier: ReferralTier,
  previousTier: ReferralTier,
): Promise<boolean> {
  let tierUpgraded = false;
  if (currentTier.name !== previousTier.name && currentTier.xpReward > 0) {
    tierUpgraded = true;
    await addUserXp(referrerId, currentTier.xpReward, "REFERRAL_TIER_UP", db);
  }

  if (isFirstActiveEvent) {
    await checkAndAwardBadges(referrerId, "REFERRAL", db);
    await checkChallengeProgress(referrerId, "REFERRALS", 1, db).catch((err) => {
      logger.error("Failed to track challenge progress for referral", { referrerId, userId, error: err });
    });
  }
  return tierUpgraded;
}

export async function processReferralReward(
  userId: string,
  dealAmount: number,
  tx?: Prisma.TransactionClient,
  treasuryWalletId?: string,
  dealId?: string,
): Promise<{ referrerId: string } | undefined> {
  if (!tx) {
    return prisma.$transaction(async (txClient) => {
      return processReferralReward(
        userId,
        dealAmount,
        txClient,
        treasuryWalletId,
        dealId
      );
    });
  }

  const db = tx;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { referredBy: true },
  });

  if (!user?.referredBy) return;

  const referrerId = user.referredBy;

  if (referrerId === userId) {
    logger.warn("Self-referral attempt detected and blocked", { userId, referrerId });
    return;
  }

  const isDuplicate = await checkDuplicateReferral(db, referrerId, dealId);
  if (isDuplicate) {
    logger.info("Referral reward already processed for this deal", { dealId, referrerId });
    return { referrerId };
  }

  try {
    await redis.del(`platform_fee:effective:${referrerId}`);
  } catch (err) {
    logger.warn("Redis invalidation failed in processReferralReward", { error: getErrorMessage(err) });
  }

  const isEligible = await checkReferrerEligibility(db, referrerId);
  if (!isEligible) {
    logger.warn(`Referrer ${referrerId} trust score too low to earn referral rewards. Deal ignored.`);
    return { referrerId };
  }

  const triggeringUser = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      userType: true,
      influencerProfile: { select: { id: true, completedDeals: true } },
      brandProfile: { select: { id: true, totalCampaigns: true } },
    },
  });

  const wasActiveBefore = await checkWasActiveBefore(triggeringUser, dealAmount, db, dealId);
  const isFirstActiveEvent = !wasActiveBefore;

  const activeReferralsCurrent = await db.user.count({
    where: buildActiveReferralWhere(referrerId),
  });

  const activeReferralsBefore = isFirstActiveEvent
    ? Math.max(0, activeReferralsCurrent - 1)
    : activeReferralsCurrent;

  const previousTier = getTierFromCount(activeReferralsBefore);
  const currentTier = getTierFromCount(activeReferralsCurrent);

  const revenueShareAmount =
    currentTier.revenueShare > 0
      ? Math.round(dealAmount * currentTier.revenueShare)
      : 0;

  const totalReward = revenueShareAmount;

  const tierUpgraded = await handleReferralGamification(
    db,
    referrerId,
    userId,
    isFirstActiveEvent,
    currentTier,
    previousTier,
  );

  if (totalReward <= 0) {
    if (tierUpgraded) {
      await NotificationService.createNotification({
        userId: referrerId,
        type: "referral_tier_up",
        title: `${currentTier.icon} Reached ${currentTier.label} Tier!`,
        message: `Congratulations! You unlocked the ${currentTier.label} tier and earned ${currentTier.xpReward} XP. Enjoy your ${currentTier.feeDiscount}% fee discount!`,
      }, db);
    }
    return { referrerId };
  }

  await payoutReferralMonetaryReward({
    db,
    referrerId,
    userId,
    dealId,
    dealAmount,
    totalReward,
    revenueShareAmount,
    currentTier,
    treasuryWalletId,
    tierUpgraded,
  });

  return { referrerId };
}

// ==================== FEE DISCOUNT CALCULATOR ====================

/**
* Calculate the effective platform fee for a user considering referral tier discounts.
*/
export async function getEffectivePlatformFee(
userId: string,
): Promise<{
baseFee: number;
discount: number;
effectiveFee: number;
tier: string;
}> {
const cacheKey = `platform_fee:effective:${userId}`;
try {
const cached = await redis.get(cacheKey);
if (cached) {
return JSON.parse(cached);
}
} catch (err) {
logger.warn("Redis read failed for getEffectivePlatformFee", { error: getErrorMessage(err) });
}

const baseFee = env.PLATFORM_FEE_PERCENTAGE;

const activeReferrals = await prisma.user.count({
where: buildActiveReferralWhere(userId),
});

const tier = getTierFromCount(activeReferrals);
const ABSOLUTE_MIN_FEE = 1;
const effectiveFee = Math.max(ABSOLUTE_MIN_FEE, baseFee - tier.feeDiscount);

const result = {
baseFee,
discount: tier.feeDiscount,
effectiveFee,
tier: tier.label,
};

try {
await redis.setex(cacheKey, 300, JSON.stringify(result));
} catch (err) {
logger.warn("Redis write failed for getEffectivePlatformFee", { error: getErrorMessage(err) });
}

return result;
}
