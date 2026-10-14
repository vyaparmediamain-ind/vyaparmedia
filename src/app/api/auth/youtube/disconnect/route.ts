import { apiWrapper } from "@/lib/api-wrapper";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { logger } from "@/lib/logger";
import { decrypt } from "@/lib/encryption";
import { revokeYouTubeToken } from "@/lib/youtube";
import { createActivityLog } from "@/lib/audit";

const GOOGLE_PERMISSIONS_URL = "https://myaccount.google.com/permissions";

async function _handler_POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    // Find YouTube OAuth account to get tokens for revocation
    const oauth = await prisma.oAuthAccount.findFirst({
      where: {
        userId,
        provider: "youtube",
      },
      select: {
        id: true,
        accessToken: true,
        refreshToken: true,
      },
    });

    let revokedWithGoogle = false;
    if (oauth) {
      const encryptedToken = oauth.refreshToken || oauth.accessToken;
      if (encryptedToken) {
        try {
          const plainToken = decrypt(encryptedToken);
          revokedWithGoogle = await revokeYouTubeToken(plainToken);
        } catch (decryptErr) {
          logger.warn("Failed to decrypt token for Google revocation", { userId, error: decryptErr });
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.oAuthAccount.deleteMany({
        where: {
          userId,
          provider: "youtube",
        },
      });

      await tx.influencerProfile.updateMany({
        where: { userId },
        data: {
          youtubeHandle: null,
          youtubeSubscribers: 0,
          youtubeEngagementRate: 0,
        },
      });

      await createActivityLog({
        userId,
        action: "OAUTH_DISCONNECT",
        entityType: "OAuthAccount",
        entityId: userId,
        metadata: {
          provider: "youtube",
          revokedWithGoogle,
          timestamp: new Date().toISOString(),
        },
      }, tx);
    });

    logger.info("YouTube account disconnected", { userId, revokedWithGoogle });

    return NextResponse.json({
      success: true,
      revokedWithGoogle,
      manualRevokeUrl: GOOGLE_PERMISSIONS_URL,
      message: revokedWithGoogle
        ? "YouTube channel disconnected and access revoked with Google."
        : "YouTube channel disconnected locally. You may also review permissions in your Google Account Security settings.",
    });
  } catch (error: unknown) {
    logger.error("YouTube disconnect error", error);
    return NextResponse.json(
      { error: "Failed to disconnect YouTube" },
      { status: 500 },
    );
  }
}

// Wrapped handlers via apiWrapper
export const POST = apiWrapper(_handler_POST);
