import { apiWrapper, ValidatedNextRequest } from "@/lib/api-wrapper";
import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { logger } from "@/lib/logger";
import { createActivityLog } from "@/lib/audit";

async function _handler_POST(_req: ValidatedNextRequest) {
  try {
    const session = _req.session;
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete the Instagram OAuth account and clear cached stats in transaction
    await prisma.$transaction([
      prisma.oAuthAccount.deleteMany({
        where: {
          userId: session.user.id,
          provider: "instagram",
        },
      }),
      prisma.influencerProfile.updateMany({
        where: { userId: session.user.id },
        data: {
          instagramHandle: null,
          instagramFollowers: 0,
          instagramEngagementRate: 0,
        },
      }),
    ]);

    // Note: Meta has no API-based token revocation for Instagram Login tokens.
    // User must manually revoke from Instagram app > Settings > Apps & Websites.
    await createActivityLog({
      userId: session.user.id,
      action: "OAUTH_DISCONNECT",
      entityType: "OAUTH_ACCOUNT",
      entityId: "instagram",
      metadata: {
        provider: "instagram",
        note: "Meta has no API revocation endpoint for Instagram Login. Instruction provided to user.",
      },
    });

    return NextResponse.json({
      success: true,
      message:
        "Instagram disconnected from VyaparMedia. To revoke app access on Instagram, open Instagram app > Settings > Website permissions / Apps & Websites > Active > Remove.",
    });
  } catch (error: unknown) {
    logger.error("Instagram disconnect error", error);
    return NextResponse.json({ error: "Failed to disconnect Instagram" }, { status: 500 });
  }
}


// Wrapped handlers via apiWrapper
export const POST = apiWrapper(_handler_POST, { requireAuth: true });
