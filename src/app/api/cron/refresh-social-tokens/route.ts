import { NextRequest, NextResponse } from "next/server";
import { apiWrapper } from "@/lib/api-wrapper";
import { validateCronSecret } from "../guard";
import { logger } from "@/lib/logger";
import prisma from "@/lib/db";
import { acquireDistributedLock, releaseDistributedLock } from "@/lib/lock";
import { refreshInstagramToken } from "@/lib/instagram";
import { encrypt, decrypt } from "@/lib/encryption";
import { NotificationService } from "@/services/notification.service";
import { createActivityLog } from "@/lib/audit";
import { purgeOrRefreshStaleYouTubeData } from "@/lib/youtube-retention";

/**
 * Social OAuth Token Lifecycle Refresh Cron
 *
 * Runs daily to refresh long-lived tokens expiring within 10 days that are at least 24 hours old.
 * Per Meta Docs:
 * GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=<long>
 *
 * If refresh fails (token revoked or expired on Meta's side):
 * 1. Mark account as NEEDS_RECONNECT (nullify accessToken, set scope = "NEEDS_RECONNECT")
 * 2. Proactively notify user to reconnect their account
 * 3. Never silently use dead tokens
 */
async function _handler(_req: NextRequest) {
  await validateCronSecret(_req);

  const lockKey = "cron:refresh-social-tokens:lock";
  const lock = await acquireDistributedLock(lockKey, 120);
  if (!lock) {
    return NextResponse.json({
      success: true,
      skipped: true,
      message: "Social token refresh job already running.",
    });
  }

  const now = new Date();
  const tenDaysFromNow = new Date(now.getTime() + 10 * 86400 * 1000);
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 3600 * 1000);

  let refreshedCount = 0;
  let failedCount = 0;

  try {
    // Select tokens expiring within 10 days, unexpired, at least 24 hours old
    const expiringAccounts = await prisma.oAuthAccount.findMany({
      where: {
        provider: "instagram",
        accessToken: { not: null },
        expiresAt: {
          lte: tenDaysFromNow,
          gt: now,
        },
        updatedAt: {
          lte: twentyFourHoursAgo,
        },
      },
      select: {
        id: true,
        userId: true,
        provider: true,
        accessToken: true,
        expiresAt: true,
      },
    });

    for (const account of expiringAccounts) {
      if (!account.accessToken) continue;

      let plainToken: string | null = null;
      try {
        plainToken = decrypt(account.accessToken);
      } catch (err) {
        logger.error("Failed to decrypt access token for refresh", { accountId: account.id, error: err });
      }

      if (!plainToken) {
        // Un-decryptable token -> mark needs reconnect
        await markAccountNeedsReconnect(account.id, account.userId, account.provider);
        failedCount++;
        continue;
      }

      const refreshed = await refreshInstagramToken(plainToken);

      if (refreshed?.accessToken) {
        const newExpiresAt = new Date(now.getTime() + refreshed.expiresIn * 1000);

        await prisma.oAuthAccount.update({
          where: { id: account.id },
          data: {
            accessToken: encrypt(refreshed.accessToken),
            expiresAt: newExpiresAt,
            scope: "instagram_business_basic",
          },
        });

        await createActivityLog({
          userId: account.userId,
          action: "OAUTH_TOKEN_REFRESH",
          entityType: "OAUTH_ACCOUNT",
          entityId: account.id,
          metadata: { provider: account.provider, success: true },
        });

        refreshedCount++;
      } else {
        // Refresh failed (token dead/revoked)
        await markAccountNeedsReconnect(account.id, account.userId, account.provider);
        failedCount++;
      }
    }

    // O2-T6: Enforce YouTube 30-day API data retention compliance
    const retentionResult = await purgeOrRefreshStaleYouTubeData(now);

    logger.info("Social OAuth token refresh cron completed", {
      totalEvaluated: expiringAccounts.length,
      refreshed: refreshedCount,
      failed: failedCount,
      youtubeRetentionPurged: retentionResult.purged,
      youtubeRetentionRefreshed: retentionResult.refreshed,
    });

    return NextResponse.json({
      success: true,
      refreshed: refreshedCount,
      failed: failedCount,
      youtubeRetention: retentionResult,
    });
  } finally {
    await releaseDistributedLock(lockKey, lock);
  }
}

async function markAccountNeedsReconnect(accountId: string, userId: string, provider: string) {
  try {
    await prisma.oAuthAccount.update({
      where: { id: accountId },
      data: {
        accessToken: null,
        scope: "NEEDS_RECONNECT",
      },
    });

    await NotificationService.createNotification({
      userId,
      type: "security_alert",
      title: "Instagram Connection Expired",
      message: "Your Instagram connection has expired. Please reconnect in Settings > Social to continue campaign tracking.",
      data: { provider, action: "reconnect" },
    });

    await createActivityLog({
      userId,
      action: "OAUTH_TOKEN_REFRESH_FAILED",
      entityType: "OAUTH_ACCOUNT",
      entityId: accountId,
      metadata: { provider, success: false, reason: "NEEDS_RECONNECT" },
    });
  } catch (err) {
    logger.error("Failed to mark account as NEEDS_RECONNECT", { accountId, userId, error: err });
  }
}

export const GET = apiWrapper(_handler);
export const POST = apiWrapper(_handler);
