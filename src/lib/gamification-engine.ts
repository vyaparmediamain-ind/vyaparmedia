import prisma from "./db";
import { Prisma } from "@prisma/client";
import { BADGES, BadgeDefinition } from "./badges";
import { calculateLevel } from "./drs-score";
import { NotificationService } from "@/services/notification.service";
import { checkChallengeProgress } from "./weekly-challenges";
import { createActivityLog } from "./audit";
import { randomUUID } from "node:crypto";

import { TRIGGER_TO_BADGES } from "./gamification/types";
import { checkMilestoneEarningsReferrals, checkVerificationReviews } from "./gamification/badges-milestones";
import { checkStreakActivity } from "./gamification/badges-streaks";
import { checkBrandCompliance } from "./gamification/badges-brands";

export async function finalizeDealGamification(
  userId: string,
  amount: number,
  tx: Prisma.TransactionClient,
  options?: {
    skipReferral?: boolean;
    treasuryWalletId?: string;
    dealId?: string;
  }
) {
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
  // amount is stored in paise, matching the challenge template goals (e.g. 500000 paise = 5000 INR)
  await checkChallengeProgress(userId, "EARNINGS", amount, tx);

  let referralResult;
  if (!options?.skipReferral) {
    const { processReferralReward } = await import("./referral-engine");
    // Do not catch and swallow errors. Let them propagate to safely roll back the transaction
    referralResult = await processReferralReward(userId, amount, tx, options?.treasuryWalletId, options?.dealId);
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

  // Pre-fetch common data in parallel for efficiency
  const [
    wallet,
    influencerProfile,
    brandProfile,
    completedDealsCount,
    fraudViolationsCount,
    zeroRevisionDealsCount,
  ] = await Promise.all([
    db.wallet.findUnique({ where: { userId } }),
    db.influencerProfile.findUnique({ where: { userId } }),
    db.brandProfile.findUnique({ where: { userId } }),
    db.deal.count({
      where: {
        influencer: { userId },
        status: { in: ["COMPLETED", "VERIFIED"] },
      },
    }),
    db.userViolation.count({
      where: { userId, type: "FRAUD" },
    }),
    db.deal.count({
      where: {
        influencer: { userId },
        status: { in: ["COMPLETED", "VERIFIED"] },
        revisionsUsed: 0,
      },
    }),
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

export async function addUserXp(
  userId: string,
  amount: number,
  reason: string,
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  if (!Number.isInteger(amount) || amount <= 0) return null;

  const updatedUser = await db.user.update({
    where: { id: userId },
    data: { xp: { increment: amount } },
    select: { xp: true, level: true },
  });

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
      xpAwarded: amount,
      totalXp: updatedUser.xp,
      oldLevel: updatedUser.level,
      newLevel: nextLevel,
    },
  }, db);

  return { xp: updatedUser.xp, level: nextLevel };
}
