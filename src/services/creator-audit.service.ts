import prisma from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  getFreshInstagramAccessToken,
  getRecentPosts,
  getPostComments,
  InstagramPost,
} from "@/lib/instagram";
import { checkCommentQuality } from "@/lib/fraud-detection/social";
import { redis } from "@/lib/redis";

export interface CreatorAuditMetrics {
  analyzedPostsCount: number;
  totalLikes: number;
  totalComments: number;
  avgLikes: number;
  avgComments: number;
  engagementRatePercent: number;
  followerAuthenticityScore: number; // 0 - 100 (CAS / AQS)
  contentQualityScore: number;       // 0 - 100
  authenticityTier: "EXCELLENT" | "GOOD" | "SUSPICIOUS" | "HIGH_RISK";
  flags: string[];
  podDetected: boolean;
  botLikesDetected: boolean;
  ghostFollowersDetected: boolean;
}

export interface CreatorAuditResult {
  success: boolean;
  userId: string;
  instagramHandle?: string | null;
  metrics?: CreatorAuditMetrics;
  error?: string;
}

/**
 * Pure Evaluation Function:
 * Analyzes historical post metrics, engagement dispersion, like/comment ratios,
 * and comment text quality to compute Authenticity & Quality Scores.
 */
export function evaluateHistoricalPostMetrics(
  posts: InstagramPost[],
  followers: number,
  allComments: string[] = [],
): CreatorAuditMetrics {
  const flags: string[] = [];
  const safeFollowers = Math.max(followers || 0, 100);

  if (!posts || posts.length === 0) {
    return {
      analyzedPostsCount: 0,
      totalLikes: 0,
      totalComments: 0,
      avgLikes: 0,
      avgComments: 0,
      engagementRatePercent: 0,
      followerAuthenticityScore: 50,
      contentQualityScore: 50,
      authenticityTier: "SUSPICIOUS",
      flags: ["NO_HISTORICAL_POSTS_FOUND"],
      podDetected: false,
      botLikesDetected: false,
      ghostFollowersDetected: false,
    };
  }

  const totalLikes = posts.reduce((sum, p) => sum + (p.likeCount || 0), 0);
  const totalComments = posts.reduce((sum, p) => sum + (p.commentsCount || 0), 0);
  const avgLikes = Math.round(totalLikes / posts.length);
  const avgComments = Math.round(totalComments / posts.length);

  // Industry Standard ER: ((Avg Likes + Avg Comments) / Followers) * 100
  const engagementRatePercent = Number(
    (((avgLikes + avgComments) / safeFollowers) * 100).toFixed(2),
  );

  let penalty = 0;
  let podDetected = false;
  let botLikesDetected = false;
  let ghostFollowersDetected = false;

  // 1. Like-to-Comment Ratio Check (Bot Likes / Purchase Detection)
  // Healthy organic ratio is usually 1% to 8% (1-8 comments per 100 likes).
  if (avgLikes >= 250) {
    const commentLikeRatio = (avgComments / avgLikes) * 100;
    if (commentLikeRatio < 0.3) {
      botLikesDetected = true;
      flags.push("BOT_LIKES_SUSPECTED: Less than 0.3% comments relative to likes");
      penalty += 30;
    } else if (commentLikeRatio < 0.6) {
      flags.push("LOW_COMMENT_RATIO: Below normal organic threshold");
      penalty += 15;
    }
  }

  // 2. Engagement Pod Collusion Detection
  // Unusually high comment-to-like ratio (>35%) indicates creator exchange pod
  if (avgLikes >= 30) {
    const commentLikeRatio = (avgComments / avgLikes) * 100;
    if (commentLikeRatio > 40) {
      podDetected = true;
      flags.push("ENGAGEMENT_POD_SUSPECTED: Abnormal comment-to-like density (>40%)");
      penalty += 25;
    }
  }

  // 3. Follower Tier vs Engagement Rate Anomaly
  // Nano (1k-10k): 3-8% | Micro (10k-50k): 2-5% | Mid (50k-500k): 1-3.5% | Macro (500k+): 0.5-2%
  if (safeFollowers >= 10000 && engagementRatePercent > 18) {
    flags.push("SUSPICIOUSLY_HIGH_ENGAGEMENT: ER exceeds 18% for 10k+ follower tier");
    penalty += 20;
  }
  if (safeFollowers >= 40000 && engagementRatePercent < 0.2) {
    ghostFollowersDetected = true;
    flags.push("GHOST_FOLLOWERS_SUSPECTED: Sub-0.2% ER indicates inactive/purchased follower base");
    penalty += 25;
  }

  // 4. Comment Text NLP Quality & Duplicate Check
  if (allComments.length > 0) {
    const commentCheck = checkCommentQuality(allComments);
    if (!commentCheck.passed || commentCheck.riskScore > 0) {
      penalty += Math.min(commentCheck.riskScore, 25);
      flags.push(...commentCheck.flags.map((f) => `COMMENT_AUDIT: ${f.rule} - ${f.description}`));
    }
  }

  // 5. Compute Follower Authenticity Score (0 - 100)
  const rawScore = 100 - penalty;
  const followerAuthenticityScore = Math.max(15, Math.min(98, rawScore));

  // 6. Content Quality Score
  // Evaluates media format diversity (Reels vs Static Photos) and posting regularity
  const reelCount = posts.filter(
    (p) => p.mediaType === "VIDEO" || p.mediaType === "REELS",
  ).length;
  const reelRatio = reelCount / posts.length;
  let qualityScore = 70;
  if (reelRatio >= 0.4) qualityScore += 15; // Video reels bonus
  if (posts.length >= 12) qualityScore += 10; // Consistency bonus
  if (flags.length > 0) qualityScore -= Math.min(flags.length * 5, 20);
  const contentQualityScore = Math.max(25, Math.min(95, qualityScore));

  let authenticityTier: CreatorAuditMetrics["authenticityTier"] = "HIGH_RISK";
  if (followerAuthenticityScore >= 85) authenticityTier = "EXCELLENT";
  else if (followerAuthenticityScore >= 70) authenticityTier = "GOOD";
  else if (followerAuthenticityScore >= 50) authenticityTier = "SUSPICIOUS";

  return {
    analyzedPostsCount: posts.length,
    totalLikes,
    totalComments,
    avgLikes,
    avgComments,
    engagementRatePercent,
    followerAuthenticityScore,
    contentQualityScore,
    authenticityTier,
    flags,
    podDetected,
    botLikesDetected,
    ghostFollowersDetected,
  };
}

export class CreatorAuditService {
  /**
   * Complete End-to-End Audit:
   * 1. Pulls historical Instagram media (up to 25 posts) using active token
   * 2. Samples top comments from recent posts
   * 3. Runs pure statistical & NLP anomaly detection
   * 4. Updates Prisma `InfluencerProfile` with authenticity & quality scores
   * 5. Records immutable audit activity log
   */
  static async auditHistoricalInstagramData(
    userId: string,
    explicitAccessToken?: string,
  ): Promise<CreatorAuditResult> {
    try {
      const profile = await prisma.influencerProfile.findUnique({
        where: { userId },
        select: {
          id: true,
          userId: true,
          instagramHandle: true,
          instagramFollowers: true,
          displayName: true,
        },
      });

      if (!profile) {
        return { success: false, userId, error: "Influencer profile not found" };
      }

      if (!profile.instagramHandle) {
        return { success: false, userId, error: "No connected Instagram handle found" };
      }

      // Resolve Access Token
      const accessToken = explicitAccessToken || (await getFreshInstagramAccessToken(userId));
      if (!accessToken) {
        return { success: false, userId, error: "No valid Instagram access token available" };
      }

      // Fetch historical posts (up to 25 posts)
      const posts = await getRecentPosts(accessToken, 25);
      if (!posts || posts.length === 0) {
        return {
          success: false,
          userId,
          instagramHandle: profile.instagramHandle,
          error: "No recent posts retrieved from Instagram Graph API",
        };
      }

      // Sample comments from the top 3 most recent posts for NLP check
      const sampleComments: string[] = [];
      const topPosts = posts.slice(0, 3);
      await Promise.all(
        topPosts.map(async (p) => {
          if (p.commentsCount > 0) {
            const comments = await getPostComments(p.id, accessToken, 15);
            comments.forEach((c) => {
              if (c.text) sampleComments.push(c.text);
            });
          }
        }),
      );

      // Evaluate historical post metrics
      const metrics = evaluateHistoricalPostMetrics(
        posts,
        profile.instagramFollowers || 1000,
        sampleComments,
      );

      // Basis points for DB storage (e.g., 3.85% -> 385)
      const engagementRateBasisPoints = Math.round(metrics.engagementRatePercent * 100);

      // Persist to Database
      await prisma.$transaction([
        prisma.influencerProfile.update({
          where: { userId },
          data: {
            followerAuthenticityScore: metrics.followerAuthenticityScore,
            contentQualityScore: metrics.contentQualityScore,
            instagramEngagementRate: engagementRateBasisPoints,
          },
        }),
        prisma.activityLog.create({
          data: {
            userId,
            action: "CREATOR_HISTORICAL_AUDIT_COMPLETED",
            entityType: "InfluencerProfile",
            entityId: profile.id,
            metadata: {
              followerAuthenticityScore: metrics.followerAuthenticityScore,
              contentQualityScore: metrics.contentQualityScore,
              engagementRatePercent: metrics.engagementRatePercent,
              analyzedPostsCount: metrics.analyzedPostsCount,
              authenticityTier: metrics.authenticityTier,
              flags: metrics.flags,
            },
          },
        }),
      ]);

      // Invalidate relevant redis caches
      try {
        await redis.del(`influencer:${profile.id}:profile`);
        if (profile.instagramHandle) {
          await redis.del(`influencer:${profile.instagramHandle.toLowerCase()}:profile`);
        }
      } catch (cacheErr) {
        logger.warn("Non-fatal redis cache invalidation failure during creator audit", { cacheErr });
      }

      logger.info("Creator historical audit completed successfully", {
        userId,
        handle: profile.instagramHandle,
        score: metrics.followerAuthenticityScore,
        tier: metrics.authenticityTier,
        analyzedPosts: metrics.analyzedPostsCount,
      });

      return {
        success: true,
        userId,
        instagramHandle: profile.instagramHandle,
        metrics,
      };
    } catch (error) {
      logger.error("Creator historical audit exception", { userId, error });
      return {
        success: false,
        userId,
        error: error instanceof Error ? error.message : "Unknown audit failure",
      };
    }
  }
}

