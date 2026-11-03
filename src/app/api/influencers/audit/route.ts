import { NextResponse } from "next/server";
import { apiWrapper } from "@/lib/api-wrapper";
import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import prisma from "@/lib/db";
import { CreatorAuditService } from "@/services/creator-audit.service";
import { isInfluencer } from "@/lib/rbac";

export const GET = apiWrapper(async () => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw AppError.unauthorized("Authentication required");
  }

  const profile = await prisma.influencerProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      displayName: true,
      instagramHandle: true,
      instagramFollowers: true,
      instagramEngagementRate: true,
      followerAuthenticityScore: true,
      contentQualityScore: true,
      updatedAt: true,
    },
  });

  if (!profile) {
    throw AppError.notFound("Creator profile not found");
  }

  return NextResponse.json({
    success: true,
    data: {
      ...profile,
      instagramEngagementRate: profile.instagramEngagementRate
        ? profile.instagramEngagementRate / 100
        : 0,
      authenticityTier:
        profile.followerAuthenticityScore >= 85
          ? "EXCELLENT"
          : profile.followerAuthenticityScore >= 70
            ? "GOOD"
            : profile.followerAuthenticityScore >= 50
              ? "SUSPICIOUS"
              : "HIGH_RISK",
    },
  });
});

export const POST = apiWrapper(async () => {
  const session = await auth();
  const userId = session?.user?.id;
  const userType = session?.user?.userType;

  if (!userId) {
    throw AppError.unauthorized("Authentication required");
  }

  if (!isInfluencer(userType) && userType !== "ADMIN") {
    throw AppError.forbidden("Only creators or administrators can trigger social audit");
  }

  const auditResult = await CreatorAuditService.auditHistoricalInstagramData(userId);

  if (!auditResult.success) {
    throw AppError.badRequest(auditResult.error || "Failed to execute historical social audit");
  }

  return NextResponse.json({
    success: true,
    message: "Historical social audit completed successfully",
    data: auditResult.metrics,
  });
});
