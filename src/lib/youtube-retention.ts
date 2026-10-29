/**
 * YouTube API Services Policy: Data Retention Compliance
 *
 * Per YouTube API Developer Policies (Section III.E.4.b):
 * "If you store API data, you must refresh or purge stored API data that is older than 30 calendar days,
 * unless that data has been explicitly marked as non-expiring by Google."
 *
 * This routine:
 * 1. Scans InfluencerProfile records where stored YouTube metrics haven't been updated for >=30 days.
 * 2. If the user has a valid, active OAuth token, refreshes the statistics from the API.
 * 3. If the user has disconnected, revoked access, or cannot be refreshed, purges the stored metrics
 *    (resets subscribers and engagement rate to 0).
 */

import prisma from "./db";
import { logger } from "./logger";
import { getFreshYouTubeAccessToken, getYouTubeChannelByToken } from "./youtube";

export interface YouTubeRetentionResult {
  refreshed: number;
  purged: number;
  totalEvaluated: number;
}

export async function purgeOrRefreshStaleYouTubeData(
  referenceDate: Date = new Date(),
): Promise<YouTubeRetentionResult> {
  const thirtyDaysAgo = new Date(referenceDate.getTime() - 30 * 86400 * 1000);

  let refreshed = 0;
  let purged = 0;

  try {
    const staleProfiles = await prisma.influencerProfile.findMany({
      where: {
        youtubeHandle: { not: null },
        updatedAt: { lte: thirtyDaysAgo },
      },
      select: {
        id: true,
        userId: true,
        youtubeHandle: true,
      },
    });

    for (const profile of staleProfiles) {
      const oauth = await prisma.oAuthAccount.findFirst({
        where: {
          userId: profile.userId,
          provider: "youtube",
        },
        select: { id: true },
      });

      if (!oauth) {
        // Disconnected user - purge stored YouTube data older than 30 days
        await prisma.influencerProfile.update({
          where: { id: profile.id },
          data: {
            youtubeSubscribers: 0,
            youtubeEngagementRate: 0,
          },
        });
        logger.info("Purged stale YouTube metrics (>30d) for disconnected user", {
          userId: profile.userId,
          profileId: profile.id,
        });
        purged++;
        continue;
      }

      // Try refreshing with fresh access token
      const freshToken = await getFreshYouTubeAccessToken(profile.userId);
      if (freshToken) {
        const channelData = await getYouTubeChannelByToken(freshToken);
        if (channelData) {
          const subscribers = channelData.subscriberCount === -1 ? null : channelData.subscriberCount;
          await prisma.influencerProfile.update({
            where: { id: profile.id },
            data: {
              youtubeSubscribers: subscribers,
              updatedAt: referenceDate,
            },
          });
          logger.info("Refreshed stale YouTube metrics (>30d) via active OAuth token", {
            userId: profile.userId,
            profileId: profile.id,
          });
          refreshed++;
          continue;
        }
      }

      // If refresh failed (revoked/expired), purge metrics to remain compliant
      await prisma.influencerProfile.update({
        where: { id: profile.id },
        data: {
          youtubeSubscribers: 0,
          youtubeEngagementRate: 0,
        },
      });
      logger.warn("Purged stale YouTube metrics (>30d) because OAuth refresh failed", {
        userId: profile.userId,
        profileId: profile.id,
      });
      purged++;
    }

    return { refreshed, purged, totalEvaluated: staleProfiles.length };
  } catch (error) {
    logger.error("Error in purgeOrRefreshStaleYouTubeData", { error });
    return { refreshed, purged, totalEvaluated: 0 };
  }
}
