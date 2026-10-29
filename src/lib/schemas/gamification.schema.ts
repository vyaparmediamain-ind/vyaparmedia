import { z } from "zod";

/**
 * Badge item with unlock progress.
 */
export const badgeItemSchema = z
  .object({
    id: z.string(),
    slug: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    icon: z.string().optional(),
    category: z.string().optional(),
    isUnlocked: z.boolean().optional(),
    unlockedAt: z.string().nullable().optional(),
    progress: z.number().optional(),
    earned: z.boolean().optional(),
    earnedAt: z.string().nullable().optional(),
    hasProgress: z.boolean().optional(),
    currentProgress: z.number().optional(),
    targetProgress: z.number().optional(),
    xpReward: z.number().optional(),
  })
  .catchall(z.unknown());

export type BadgeItem = z.infer<typeof badgeItemSchema>;


export const gamificationStatsSchema = z.object({
  xp: z.number().default(0),
  level: z.number().default(1),
  totalBadges: z.number().default(0),
  availableBadges: z.number().default(0),
});

export type GamificationStats = z.infer<typeof gamificationStatsSchema>;

/**
 * GET /api/user/badges response schema.
 */
export const badgesResponseSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
  badges: z.array(badgeItemSchema).default([]),
  stats: gamificationStatsSchema.optional(),
});

export type BadgesResponse = z.infer<typeof badgesResponseSchema>;

/**
 * Challenge item schema.
 */
export const challengeItemSchema = z
  .object({
    id: z.string().optional(),
    challengeId: z.string().default(""),
    title: z.string(),
    description: z.string(),
    icon: z.string(),
    category: z.string().optional(),
    type: z.string().optional(),
    xpReward: z.number().default(0),
    target: z.number().optional(),
    goal: z.number().default(1),
    progress: z.number().default(0),
    completed: z.boolean().default(false),
    completedAt: z.union([z.string(), z.date()]).nullable().optional(),
    bonusPerk: z.string().nullable().optional(),
    difficulty: z.string().default("MEDIUM"),
  })
  .catchall(z.unknown());

export type ChallengeItem = z.infer<typeof challengeItemSchema>;



/**
 * GET /api/gamification/challenges response schema.
 */
export const challengesResponseSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
  data: z.array(challengeItemSchema).optional(),
  challenges: z.array(challengeItemSchema).optional(),
});

export type ChallengesResponse = z.infer<typeof challengesResponseSchema>;

/**
 * Referral list item schema.
 */
export const referralItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().optional(),
  joinedAt: z.string(),
  status: z.string(),
  type: z.string(),
  earnings: z.number().int().default(0),
});


export type ReferralItem = z.infer<typeof referralItemSchema>;

/**
 * GET /api/referrals response schema.
 */
export const referralsResponseSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
  referrals: z.array(referralItemSchema).default([]),
});

export type ReferralsResponse = z.infer<typeof referralsResponseSchema>;
