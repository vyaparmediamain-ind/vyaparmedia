import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import { apiWrapper, ApiResponse } from "@/lib/api-wrapper";
import { createActivityLog } from "@/lib/audit";
import { AppError } from "@/lib/errors";

const switchRoleSchema = z.object({
  targetRole: z.enum(["INFLUENCER", "BRAND"]),
});

export const POST = apiWrapper(async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiResponse.unauthorized();
    }

    const userId = session.user.id;
    const rateLimit = await checkRateLimit(userId, "AUTH");
    if (!rateLimit.success) {
      return ApiResponse.tooManyRequests("Too many requests. Please wait before switching roles again.");
    }

    const body = await req.json();
    const parsed = switchRoleSchema.safeParse(body);
    if (!parsed.success) {
      return ApiResponse.error("Invalid target role. Must be INFLUENCER or BRAND.");
    }

    const { targetRole } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        scoutProfile: true,
        influencerProfile: true,
        brandProfile: true,
      },
    });

    if (!user) {
      return ApiResponse.notFound("User not found");
    }

    if (user.userType !== "SCOUT") {
      return ApiResponse.error(
        "Only Campus Partner (Scout) accounts can convert to Creator or Brand accounts.",
        400
      );
    }

    await prisma.$transaction(async (tx) => {
      // 1. Update userType to targetRole
      await tx.user.update({
        where: { id: userId },
        data: {
          userType: targetRole,
        },
      });

      // 2. Ensure target profile exists, seeding details from ScoutProfile if available
      if (targetRole === "INFLUENCER") {
        if (!user.influencerProfile) {
          await tx.influencerProfile.create({
            data: {
              userId,
              displayName: user.scoutProfile?.fullName || user.email.split("@")[0] || "Creator",
              city: user.scoutProfile?.city || null,
              state: user.scoutProfile?.state || null,
              categories: "",
              languages: "Hindi,English",
            },
          });
        }
      } else if (targetRole === "BRAND") {
        if (!user.brandProfile) {
          await tx.brandProfile.create({
            data: {
              userId,
              companyName: user.scoutProfile?.fullName
                ? `${user.scoutProfile.fullName}'s Brand`
                : "My Business",
              city: user.scoutProfile?.city || null,
              state: user.scoutProfile?.state || null,
              panNumber: user.scoutProfile?.panNumber || null,
            },
          });
        }
      }

      // 3. Log audit event
      await createActivityLog(
        {
          userId,
          action: "USER_ROLE_SWITCHED",
          entityType: "USER",
          entityId: userId,
          metadata: {
            previousRole: "SCOUT",
            targetRole,
            scoutCode: user.scoutProfile?.scoutCode,
            preservedScoutEarnings: true,
          },
        },
        tx
      );
    });

    // Invalidate Redis caches
    try {
      await redis.del(`user:onboarding:${userId}`);
      await redis.del(`user:profile:${userId}`);
    } catch (cacheErr) {
      logger.warn("[SwitchRole] Failed to clear Redis cache", { userId, error: String(cacheErr) });
    }

    logger.info("[SwitchRole] Scout account converted successfully", {
      userId,
      previousRole: "SCOUT",
      targetRole,
      scoutCode: user.scoutProfile?.scoutCode,
    });

    return ApiResponse.success(
      {
        targetRole,
        redirectUrl: "/dashboard",
      },
      `Account converted to ${targetRole === "INFLUENCER" ? "Creator" : "Brand"} successfully! Your Scout referral royalties remain active.`
    );
  } catch (error) {
    logger.error("[SwitchRole] Error converting scout role", { error });
    if (error instanceof AppError) {
      return ApiResponse.error(error.message, error.statusCode);
    }
    return ApiResponse.error("Failed to convert account role. Please try again later.", 500);
  }
});
