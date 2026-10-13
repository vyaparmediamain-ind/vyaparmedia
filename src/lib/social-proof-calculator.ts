/**
 * Social Proof Calculator — Follower Authenticity & Content Quality Scoring
 *
 * Runs on profile creation and periodically via weekly cron.
 * Integrates hardened cross-platform checks, spike outlier winsorization, and fraud risk detection.
 *
 * STRICT RULE-BASED LOGIC ONLY — NO UNTRANSPARENT BLACK BOXES.
 */

import prisma from "./db";
import { logger } from "./logger";
import { getYouTubeChannel, calculateYouTubeEngagement } from "./youtube";
import { getInstagramProfile, calculateEngagement } from "./instagram";
import { decrypt } from "./encryption";
import { NotificationService } from "@/services/notification.service";
import {
  calculateFollowerAuthenticity,
  calculateContentQuality,
  type SocialProofResult,
  type CrossPlatformMetrics,
} from "./social-proof-core";

export * from "./social-proof-core";

interface SyncedStats {
  youtubeSubscribers: number | null;
  youtubeEngagementRate: number | null;
  instagramFollowers: number | null;
  instagramEngagementRate: number | null;
}

async function syncYoutubeProfileStats(
  handle: string,
  currentSubs: number | null,
  currentRate: number | null
): Promise<{ subscribers: number | null; engagementRate: number | null }> {
  let subscribers = currentSubs;
  let engagementRate = currentRate;

  try {
    const channel = await getYouTubeChannel(handle);
    if (channel) {
      subscribers = channel.subscriberCount;
      const insights = await calculateYouTubeEngagement(channel.id);
      if (insights) {
        engagementRate = insights.engagementRate;
      }
    }
  } catch (err) {
    logger.error("Error syncing YouTube stats in cron", err);
  }

  return { subscribers, engagementRate };
}

async function syncInstagramProfileStats(
  handle: string,
  userId: string,
  currentFollowers: number | null,
  currentRate: number | null
): Promise<{ followers: number | null; engagementRate: number | null }> {
  let followers = currentFollowers;
  let engagementRate = currentRate;

  try {
    const oauth = await prisma.oAuthAccount.findFirst({
      where: { userId, provider: "instagram" },
      select: { accessToken: true },
    });

    const decryptedAccessToken = oauth?.accessToken ? decrypt(oauth.accessToken) : null;

    if (decryptedAccessToken) {
      const instaProfile = await getInstagramProfile(decryptedAccessToken);
      if (instaProfile?.username.toLowerCase() === handle.toLowerCase()) {
        followers = instaProfile.followersCount;
        const insights = await calculateEngagement(decryptedAccessToken);
        if (insights) {
          engagementRate = insights.engagementRate;
        }
      }
    } else {
      logger.warn("Skipping Instagram social proof sync without OAuth token", {
        userId,
      });
    }
  } catch (err) {
    logger.error("Error syncing Instagram stats in cron", err);
  }

  return { followers, engagementRate };
}

async function saveSyncedProfileStatsIfChanged(
  profile: {
    youtubeSubscribers: number | null;
    youtubeEngagementRate: number | null;
    instagramFollowers: number | null;
    instagramEngagementRate: number | null;
  },
  userId: string,
  updates: SyncedStats
): Promise<void> {
  if (
    updates.youtubeSubscribers !== profile.youtubeSubscribers ||
    updates.youtubeEngagementRate !== profile.youtubeEngagementRate ||
    updates.instagramFollowers !== profile.instagramFollowers ||
    updates.instagramEngagementRate !== profile.instagramEngagementRate
  ) {
    await prisma.influencerProfile.update({
      where: { userId },
      data: {
        youtubeSubscribers: updates.youtubeSubscribers,
        youtubeEngagementRate: updates.youtubeEngagementRate,
        instagramFollowers: updates.instagramFollowers,
        instagramEngagementRate: updates.instagramEngagementRate,
      },
    });

    profile.youtubeSubscribers = updates.youtubeSubscribers;
    profile.youtubeEngagementRate = updates.youtubeEngagementRate;
    profile.instagramFollowers = updates.instagramFollowers;
    profile.instagramEngagementRate = updates.instagramEngagementRate;
  }
}

/**
 * Recalculate and save social proof scores for a specific influencer.
 */
export async function recalculateSocialProof(
  userId: string,
): Promise<SocialProofResult | null> {
  try {
    const profile = await prisma.influencerProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        instagramHandle: true,
        instagramFollowers: true,
        instagramEngagementRate: true,
        youtubeHandle: true,
        youtubeSubscribers: true,
        youtubeEngagementRate: true,
        totalDeals: true,
        completedDeals: true,
        averageRating: true,
        accountAge: true,
        user: {
          select: { createdAt: true, status: true },
        },
      },
    });

    if (profile) {
      // Sync YouTube stats
      let updatedYoutubeSubscribers = profile.youtubeSubscribers;
      let updatedYoutubeEngagementRate = profile.youtubeEngagementRate;

      if (profile.youtubeHandle) {
        const yt = await syncYoutubeProfileStats(
          profile.youtubeHandle,
          profile.youtubeSubscribers,
          profile.youtubeEngagementRate
        );
        updatedYoutubeSubscribers = yt.subscribers;
        updatedYoutubeEngagementRate = yt.engagementRate;
      }

      // Sync Instagram stats
      let updatedInstagramFollowers = profile.instagramFollowers;
      let updatedInstagramEngagementRate = profile.instagramEngagementRate;

      if (profile.instagramHandle) {
        const insta = await syncInstagramProfileStats(
          profile.instagramHandle,
          userId,
          profile.instagramFollowers,
          profile.instagramEngagementRate
        );
        updatedInstagramFollowers = insta.followers;
        updatedInstagramEngagementRate = insta.engagementRate;
      }

      // Save updated stats if they changed
      await saveSyncedProfileStatsIfChanged(profile, userId, {
        youtubeSubscribers: updatedYoutubeSubscribers,
        youtubeEngagementRate: updatedYoutubeEngagementRate,
        instagramFollowers: updatedInstagramFollowers,
        instagramEngagementRate: updatedInstagramEngagementRate,
      });
    }

    if (!profile) {
      logger.warn("recalculateSocialProof: Profile not found", { userId });
      return null;
    }

    // Fetch deal stats for quality calculation
    const deals = await prisma.deal.findMany({
      where: {
        influencer: { userId },
        status: { in: ["VERIFIED", "COMPLETED"] },
      },
      select: {
        submittedAt: true,
        postingDeadline: true,
      },
    });

    const onTimeDeals = deals.filter(
      (d: { postingDeadline: Date | null; submittedAt: Date | null }) =>
        d.postingDeadline &&
        d.submittedAt &&
        new Date(d.submittedAt) <= new Date(d.postingDeadline),
    ).length;
    const onTimeRate = deals.length > 0 ? onTimeDeals / deals.length : 1;

    const followers =
      profile.instagramFollowers ?? profile.youtubeSubscribers ?? 0;
    const engagementRate =
      profile.instagramEngagementRate ?? profile.youtubeEngagementRate ?? 0;
    const accountAgeDays = Math.floor(
      (Date.now() -
        new Date(profile.accountAge || profile.user.createdAt).getTime()) /
        (86400 * 1000),
    );

    const crossPlatform: CrossPlatformMetrics = {
      instagramFollowers: profile.instagramFollowers ?? undefined,
      instagramEngagementRate: profile.instagramEngagementRate
        ? profile.instagramEngagementRate / 100
        : undefined,
      youtubeSubscribers: profile.youtubeSubscribers ?? undefined,
      youtubeEngagementRate: profile.youtubeEngagementRate
        ? profile.youtubeEngagementRate / 100
        : undefined,
    };

    // Calculate scores with hardened fraud detection
    const authResult = calculateFollowerAuthenticity({
      followers,
      following: 0, // Would need API data in production
      engagementRate,
      accountAgeDays,
      avgCommentsPerPost: 0,
      avgLikesPerPost: 0,
      uniqueCommentersRatio: 0.7, // Default assumption
      followerGrowthMonthly: 5, // Default assumption (steady growth)
      crossPlatform,
    });

    const followerAuthenticityScore = authResult.score;

    const contentQualityScore = calculateContentQuality({
      avgEngagementRate: engagementRate,
      postingFrequencyPerWeek: 3, // Default assumption
      contentTypeVariety: 2, // Default assumption
      completedDeals: profile.completedDeals,
      totalDeals: profile.totalDeals,
      averageRating: profile.averageRating,
      onTimeDeliveryRate: onTimeRate,
    });

    // Save to profile
    await prisma.influencerProfile.update({
      where: { userId },
      data: {
        followerAuthenticityScore,
        contentQualityScore,
      },
    });

    // If flagged by hardened fraud checks and user is ACTIVE, update to FLAGGED for review
    if (authResult.isFlagged && profile.user.status === "ACTIVE") {
      await prisma.user.update({
        where: { id: userId },
        data: { status: "FLAGGED" },
      });
      await NotificationService.createNotification({
        userId,
        type: "system",
        title: "Account Under Authenticity Review",
        message:
          "Your profile has triggered an automated authenticity review due to anomalous engagement signals. You can review signals and submit an appeal in your dashboard.",
      });
    }

    const result: SocialProofResult = {
      followerAuthenticityScore,
      contentQualityScore,
      fraudRiskLevel: authResult.fraudRiskLevel,
      isFlagged: authResult.isFlagged,
      fraudSignals: authResult.fraudSignals,
      breakdown: {
        engagementRateScore: authResult.breakdown.engagementRateScore,
        followingRatioScore: authResult.breakdown.followingRatioScore,
        accountAgeScore: authResult.breakdown.accountAgeScore,
        commentDiversityScore: authResult.breakdown.commentDiversityScore,
        growthConsistencyScore: authResult.breakdown.growthConsistencyScore,
        crossPlatformScore: authResult.breakdown.crossPlatformScore,
        engagementSpikeScore: authResult.breakdown.engagementSpikeScore,
        avgEngagementScore: engagementRate > 2 ? 15 : 10,
        postingConsistencyScore: 5,
        contentVarietyScore: 3,
        completionRateScore:
          profile.totalDeals > 0
            ? Math.round((profile.completedDeals / profile.totalDeals) * 10)
            : 5,
      },
    };

    logger.info("Social proof recalculated with fraud check", {
      userId,
      followerAuthenticityScore,
      contentQualityScore,
      fraudRiskLevel: authResult.fraudRiskLevel,
      fraudSignalsCount: authResult.fraudSignals.length,
    });

    return result;
  } catch (error) {
    logger.error("recalculateSocialProof failed", error, { userId });
    return null;
  }
}

/**
 * Batch recalculate social proof for all active influencers.
 * Used by the weekly cron job.
 */
export async function recalculateAllSocialProof(): Promise<{
  processed: number;
  failed: number;
}> {
  let processed = 0;
  let failed = 0;
  let skip = 0;
  const take = 50;
  const concurrency = 5;

  while (true) {
    const influencers = await prisma.influencerProfile.findMany({
      where: {
        user: { status: "ACTIVE" },
      },
      select: { userId: true },
      skip,
      take,
    });

    if (influencers.length === 0) {
      break;
    }

    // Process the batch in parallel chunks of concurrency 5
    for (let i = 0; i < influencers.length; i += concurrency) {
      const chunk = influencers.slice(i, i + concurrency);
      await Promise.all(
        chunk.map(async (inf: { userId: string }) => {
          try {
            const result = await recalculateSocialProof(inf.userId);
            if (result) {
              processed++;
            } else {
              failed++;
            }
          } catch (error) {
            logger.error("Batch social proof failed for user", error, {
              userId: inf.userId,
            });
            failed++;
          }
        }),
      );

      // Introduce a batch delay of 1.5 seconds between concurrent chunks to respect external API rate limits
      if (i + concurrency < influencers.length) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    skip += take;
  }

  return { processed, failed };
}
