import prisma from "./db";
import { Prisma } from "@prisma/client";
import { BADGES, BadgeDefinition } from "./badges";
import { calculateLevel } from "./drs-score";
import { NotificationService } from "@/services/notification.service";
import { createActivityLog } from "./audit";
import { randomUUID } from "node:crypto";

import { TRIGGER_TO_BADGES } from "./gamification/types";
import { checkMilestoneEarningsReferrals, checkVerificationReviews } from "./gamification/badges-milestones";
import { checkStreakActivity } from "./gamification/badges-streaks";
import { checkBrandCompliance } from "./gamification/badges-brands";
import { redis } from "./redis";
import { logger } from "./logger";

type ReferralProcessor = (
  userId: string,
  amount: number,
  tx: Prisma.TransactionClient,
  treasuryWalletId?: string,
  dealId?: string
) => Promise<{ referrerId?: string } | undefined>;

type ChallengeTracker = (
  userId: string,
  type: string,
  amount: number,
  tx?: Prisma.TransactionClient
) => Promise<unknown>;

let _referralProcessor: ReferralProcessor | null = null;
let _challengeTracker: ChallengeTracker | null = null;

export function registerDealCompletionHooks(hooks: {
  processReferralReward?: ReferralProcessor;
  checkChallengeProgress?: (
    userId: string,
    type: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    amount?: number,
    tx?: Prisma.TransactionClient
  ) => Promise<unknown>;
}) {
  if (hooks.processReferralReward) _referralProcessor = hooks.processReferralReward;
  if (hooks.checkChallengeProgress) _challengeTracker = hooks.checkChallengeProgress as ChallengeTracker;
}

export async function finalizeDealGamification(
  userId: string,
  amount: number,
  tx: Prisma.TransactionClient,
  options?: {
    skipReferral?: boolean;
    treasuryWalletId?: string;
    dealId?: string;
  }
): Promise<{ referrerId?: string } | undefined> {
  // Update influencer profile stats
  await tx.influencerProfile.update({
    where: { userId },
    data: {
      completedDeals: { increment: 1 },
      totalEarnings: { increment: amount },
    },
  });

  // Award XP for completing deal
  await addUserXp(userId, 100, "DEAL_COMPLETED", tx);

  // Track influencer weekly challenges (earn_5k_week, earn_25k_week)
  if (_challengeTracker) {
    await _challengeTracker(userId, "EARNINGS", amount, tx);
  }

  let referralResult: { referrerId?: string } | undefined;
  if (!options?.skipReferral && _referralProcessor) {
    referralResult = await _referralProcessor(userId, amount, tx, options?.treasuryWalletId, options?.dealId);
  }

  await checkAndAwardBadges(userId, "DEAL_COMPLETED", tx);
  return referralResult;
}

export async function awardBadgeIfNotExists(
  userId: string,
  badgeId: string,
  tx?: Prisma.TransactionClient,
) {
  const db = tx || prisma;
  const badgeDef = BADGES.find((b) => b.id === badgeId);
  if (!badgeDef) return;

  await awardBadges(userId, [badgeDef], db);
}

export async function checkAndAwardBadges(
  userId: string,
  trigger:
    | "CAMPAIGN_CREATED"
    | "DEAL_COMPLETED"
    | "REVIEW_RECEIVED"
    | "VERIFICATION"
    | "LOGIN"
    | "REFERRAL"
    | "FIRST_REVIEW"
    | "FIVE_STAR_RATING"
    | "TRUST_UPDATED",
  tx?: Prisma.TransactionClient,
) {
  const db = tx || prisma;

  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      badges: { select: { badgeId: true } },
      influencerProfile: true,
      brandProfile: true,
    },
  });

  if (!user) return;

  const ownedBadgeIds = new Set(
    user.badges.map((b: { badgeId: string }) => b.badgeId),
  );
  const newBadges: BadgeDefinition[] = [];

  // 1. Check all badges defined in BADGES
  // We filter out badges already owned and limit to those relevant to this trigger
  const unearnedBadges = BADGES.filter((b) => !ownedBadgeIds.has(b.id));
  const relevantBadgeIds = TRIGGER_TO_BADGES[trigger] || [];
  const badgesToCheck = unearnedBadges.filter((b) => relevantBadgeIds.includes(b.id));

  // Early return if no badges are eligible for evaluation on this trigger
  if (badgesToCheck.length === 0) {
    return;
  }

  // Reuse profile objects already loaded on user to avoid redundant DB queries
  const influencerProfile = user.influencerProfile;
  const brandProfile = user.brandProfile;

  // Conditionally query only the auxiliary metrics required by the specific candidate badges
  const needsWallet = badgesToCheck.some((b) => b.id.startsWith("earn_"));
  const needsCompletedDeals = badgesToCheck.some(
    (b) => b.id.startsWith("first_deal") || b.id.endsWith("_deals") || b.id === "fraud_shield",
  );
  const needsFraudViolations = badgesToCheck.some((b) => b.id === "fraud_shield");
  const needsZeroRevisions = badgesToCheck.some(
    (b) => b.id === "strict_compliance" || b.id === "no_revisions",
  );

  const [
    wallet,
    completedDealsCount,
    fraudViolationsCount,
    zeroRevisionDealsCount,
  ] = await Promise.all([
    needsWallet ? db.wallet.findUnique({ where: { userId } }) : null,
    needsCompletedDeals
      ? db.deal.count({
          where: {
            influencer: { userId },
            status: { in: ["COMPLETED", "VERIFIED"] },
          },
        })
      : 0,
    needsFraudViolations
      ? db.userViolation.count({
          where: { userId, type: "FRAUD" },
        })
      : 0,
    needsZeroRevisions
      ? db.deal.count({
          where: {
            influencer: { userId },
            status: { in: ["COMPLETED", "VERIFIED"] },
            revisionsUsed: 0,
          },
        })
      : 0,
  ]);

  for (const badge of badgesToCheck) {
    let earned = false;

    if (badge.id.startsWith("first_deal") || badge.id.endsWith("_deals") || badge.id.startsWith("earn_") || badge.id.endsWith("_referral") || badge.id.endsWith("_referrals") || badge.id === "referral_king") {
      earned = await checkMilestoneEarningsReferrals(badge.id, user, db, wallet);
    } else if (badge.id === "verified_identity" || badge.id === "social_connected" || badge.id === "verified_pro" || badge.id === "profile_complete" || badge.id.endsWith("_5_star")) {
      earned = await checkVerificationReviews(badge.id, userId, user, db, influencerProfile, brandProfile);
    } else if (badge.id.startsWith("campaign_") || badge.id === "first_campaign" || badge.id === "big_spender" || badge.id === "mega_campaign" || badge.id.startsWith("trust_") || badge.id === "cibil_elite" || badge.id === "fraud_shield" || badge.id === "strict_compliance" || badge.id === "no_revisions" || badge.id === "fast_approver" || badge.id === "roi_master" || badge.id === "partnership_pro" || badge.id === "fair_payer") {
      earned = await checkBrandCompliance({
        badgeId: badge.id,
        userId,
        user,
        db,
        brandProfile,
        completedDealsCount,
        fraudViolationsCount,
        zeroRevisionDealsCount,
      });
    } else {
      earned = await checkStreakActivity(badge.id, userId, user, db, completedDealsCount, influencerProfile);
    }

    if (earned) {
      newBadges.push(badge);
    }
  }

  // 2. Award new badges
  if (newBadges.length > 0) {
    await awardBadges(userId, newBadges, db);
  }
}

async function awardBadges(
  userId: string,
  badges: BadgeDefinition[],
  db: Prisma.TransactionClient | typeof prisma,
) {
  if (badges.length === 0) return;

  // 1. Ensure badges exist in DB in bulk
  const existingBadges = await db.badge.findMany({
    where: { name: { in: badges.map((b: BadgeDefinition) => b.name) } },
  });
  const existingNames = new Set(existingBadges.map((b: { name: string }) => b.name));
  const missingBadges = badges.filter((b: BadgeDefinition) => !existingNames.has(b.name));

  if (missingBadges.length > 0) {
    await db.badge.createMany({
      data: missingBadges.map((b: BadgeDefinition) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        icon: b.icon,
        category: b.category,
        xpReward: b.xpReward,
        criteria: {},
      })),
      skipDuplicates: true,
    });
  }

  // 2. Fetch all DB badge IDs
  const allDbBadges = await db.badge.findMany({
    where: { name: { in: badges.map((b: BadgeDefinition) => b.name) } },
    select: {
      id: true,
      name: true,
      icon: true,
    },
  });

  // 3. Filter out badges already owned by the user
  const ownedUserBadges = await db.userBadge.findMany({
    where: { userId, badgeId: { in: allDbBadges.map((b: { id: string }) => b.id) } },
    select: { badgeId: true },
  });
  const ownedIds = new Set(ownedUserBadges.map((ub: { badgeId: string }) => ub.badgeId));
  const newDbBadges = allDbBadges.filter((dbb: { id: string }) => !ownedIds.has(dbb.id));

  if (newDbBadges.length === 0) return;

  // 4. Create UserBadge records and send notifications
  const userBadgesToCreate = newDbBadges.map((dbb: { id: string }) => ({
    id: randomUUID(),
    userId,
    badgeId: dbb.id,
  }));

  await db.userBadge.createMany({
    data: userBadgesToCreate,
    skipDuplicates: true,
  });

  // Verify which user badges were actually inserted (in case skipDuplicates skipped some due to concurrent awards)
  const createdIds = userBadgesToCreate.map((ub) => ub.id);
  const insertedUserBadges = await db.userBadge.findMany({
    where: { id: { in: createdIds } },
    select: { badgeId: true },
  });
  const insertedBadgeIds = new Set(insertedUserBadges.map((ub) => ub.badgeId));
  const actuallyNewDbBadges = newDbBadges.filter((dbb) => insertedBadgeIds.has(dbb.id));

  let totalXp = 0;
  for (const dbb of actuallyNewDbBadges) {
    const badgeDef = badges.find((b) => b.name === dbb.name);
    if (!badgeDef) continue;
    totalXp += badgeDef.xpReward;

    // Notification
    await NotificationService.createNotification({
      userId,
      type: "badge_earned",
      title: `New Badge Unlocked: ${dbb.name} ${dbb.icon}`,
      message: `Congratulations! You've earned the "${dbb.name}" badge and ${badgeDef.xpReward} XP!`,
      data: { badgeId: dbb.id },
    }, db);
  }

  // 5. Update User XP
  if (totalXp > 0) {
    await addUserXp(userId, totalXp, "BADGE_EARNED", db);
  }
}

export const DAILY_XP_CONFIG = {
  FULL_REWARD_THRESHOLD: 200, // 0 to 200 XP: 100% full weight
  MAX_DAILY_CAP: 400,         // 201 to 400 XP: 50% diminishing returns; 401+ XP: 0% hard cap
  DIMINISHING_FACTOR: 0.5,    // 50% rate
  EXEMPT_REASONS: ["BADGE_EARNED", "REFERRAL_TIER_UP", "WEEKLY_CHALLENGE"] as const,
};

export function calculateDiminishingXp(
  currentDailyXp: number,
  rawAmount: number,
  fullThreshold = DAILY_XP_CONFIG.FULL_REWARD_THRESHOLD,
  maxCap = DAILY_XP_CONFIG.MAX_DAILY_CAP,
  factor = DAILY_XP_CONFIG.DIMINISHING_FACTOR,
): { awardedXp: number; capped: boolean; rateMultiplier: number } {
  if (rawAmount <= 0 || currentDailyXp >= maxCap) {
    return { awardedXp: 0, capped: true, rateMultiplier: 0 };
  }

  let remainingRaw = rawAmount;
  let awarded = 0;
  let effectiveDaily = currentDailyXp;

  // 1. Full-weight phase (up to fullThreshold)
  if (effectiveDaily < fullThreshold) {
    const availableFull = fullThreshold - effectiveDaily;
    const fullPortion = Math.min(remainingRaw, availableFull);
    awarded += fullPortion;
    effectiveDaily += fullPortion;
    remainingRaw -= fullPortion;
  }

  // 2. Diminishing-returns phase (between fullThreshold and maxCap)
  if (remainingRaw > 0 && effectiveDaily < maxCap) {
    const availableDiminishingRoom = maxCap - effectiveDaily;
    const potentialDiminished = Math.floor(remainingRaw * factor);
    const diminishedPortion = Math.min(potentialDiminished, availableDiminishingRoom);
    awarded += diminishedPortion;
    effectiveDaily += diminishedPortion;
  }

  const capped = (currentDailyXp + rawAmount) > (currentDailyXp + awarded) && (effectiveDaily >= maxCap || rawAmount > awarded);
  const rateMultiplier = rawAmount > 0 ? awarded / rawAmount : 0;

  return { awardedXp: awarded, capped, rateMultiplier };
}

export function getStartOfDayIST(now: Date = new Date()): Date {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffsetMs);
  return new Date(
    Date.UTC(
      istDate.getUTCFullYear(),
      istDate.getUTCMonth(),
      istDate.getUTCDate(),
      0, 0, 0, 0
    ) - istOffsetMs
  );
}

export function getDailyXpRedisKey(userId: string, now: Date = new Date()): string {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffsetMs);
  const dateStr = istDate.toISOString().slice(0, 10);
  return `gamification:daily_xp:${userId}:${dateStr}`;
}

export async function addUserXp(
  userId: string,
  amount: number,
  reason: string,
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  if (!Number.isInteger(amount) || amount <= 0) return null;

  const isExempt = (DAILY_XP_CONFIG.EXEMPT_REASONS as readonly string[]).includes(reason);

  let effectiveAmount = amount;
  let calculation = { awardedXp: amount, capped: false, rateMultiplier: 1.0 };
  let currentDailyXp = 0;
  let redisKey = "";

  if (!isExempt) {
    redisKey = getDailyXpRedisKey(userId);
    let redisAvailable = false;

    try {
      const val = await redis.get(redisKey);
      if (val !== null) {
        currentDailyXp = parseInt(val, 10) || 0;
        redisAvailable = true;
      }
    } catch (err) {
      logger.warn("[Gamification] Redis get failed for daily XP, falling back to DB", { userId, error: err });
    }

    if (!redisAvailable) {
      const startOfDayIST = getStartOfDayIST();
      const logs = await db.activityLog.findMany({
        where: {
          userId,
          action: "XP_AWARDED",
          createdAt: { gte: startOfDayIST },
        },
        select: { metadata: true },
      });

      currentDailyXp = logs.reduce((sum, log) => {
        const meta = log.metadata as Record<string, unknown> | null;
        if (!meta || meta.isExemptFromDailyCap) return sum;
        return sum + (Number(meta.xpAwarded) || 0);
      }, 0);

      try {
        await redis.set(redisKey, currentDailyXp.toString(), "EX", 172800);
      } catch {
        // Ignore cache set error
      }
    }

    calculation = calculateDiminishingXp(currentDailyXp, amount);
    effectiveAmount = calculation.awardedXp;
  }

  // If effectiveAmount is 0 (daily cap fully reached)
  if (effectiveAmount <= 0) {
    const currentUser = await db.user.findUnique({
      where: { id: userId },
      select: { xp: true, level: true },
    });

    await createActivityLog({
      userId,
      action: "XP_AWARDED",
      metadata: {
        reason,
        rawXp: amount,
        xpAwarded: 0,
        dailyXpBefore: currentDailyXp,
        dailyXpAfter: currentDailyXp,
        rateMultiplier: 0,
        isDailyCapped: true,
        dailyCapReached: true,
        isExemptFromDailyCap: false,
        totalXp: currentUser?.xp ?? 0,
        oldLevel: currentUser?.level ?? 1,
        newLevel: currentUser?.level ?? 1,
      },
    }, db);

    return { xp: currentUser?.xp ?? 0, level: currentUser?.level ?? 1, effectiveXp: 0 };
  }

  const updatedUser = await db.user.update({
    where: { id: userId },
    data: { xp: { increment: effectiveAmount } },
    select: { xp: true, level: true },
  });

  if (!isExempt && redisKey) {
    try {
      await redis.incrby(redisKey, effectiveAmount);
      await redis.expire(redisKey, 172800);
    } catch {
      // Ignore cache increment error
    }
  }

  const nextLevel = calculateLevel(updatedUser.xp).level;
  if (nextLevel !== updatedUser.level) {
    // Fix #22: Only update if the level is actually increasing to prevent race conditions from downgrading the level
    await db.user.updateMany({
      where: { id: userId, level: { lt: nextLevel } },
      data: { level: nextLevel },
    });
  }

  await createActivityLog({
    userId,
    action: "XP_AWARDED",
    metadata: {
      reason,
      rawXp: amount,
      xpAwarded: effectiveAmount,
      dailyXpBefore: currentDailyXp,
      dailyXpAfter: currentDailyXp + effectiveAmount,
      rateMultiplier: calculation.rateMultiplier,
      isDailyCapped: calculation.capped,
      isExemptFromDailyCap: isExempt,
      totalXp: updatedUser.xp,
      oldLevel: updatedUser.level,
      newLevel: nextLevel,
    },
  }, db);

  return { xp: updatedUser.xp, level: nextLevel, effectiveXp: effectiveAmount };
}

