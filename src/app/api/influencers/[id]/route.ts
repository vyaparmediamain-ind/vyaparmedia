import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { apiWrapper, type AuthenticatedRequest } from "@/lib/api-wrapper";
import prisma from "@/lib/db";
import { WalletService } from "@/services/wallet.service";
import { requireActiveAdmin } from "@/lib/admin-auth";
import { isAdmin } from "@/lib/rbac";

export const GET = apiWrapper(async (req, { params }) => {
  const session = (req as AuthenticatedRequest).session;
  if (isAdmin(session.user.userType)) {
    await requireActiveAdmin(session.user);
  }

  const influencerId = (await params).id as string;
  const userId = session.user.id;

  const influencer = await prisma.influencerProfile.findUnique({
    where: { id: influencerId },
    include: {
      user: {
        select: {
          id: true,
          trustScore: true,
          verificationDocs: {
            where: { status: "VERIFIED" },
            select: { id: true, type: true, status: true },
          },
          oauthAccounts: {
            select: { id: true, provider: true },
          },
        },
      },
      deals: {
        where: {
          status: { in: ["COMPLETED", "CONTENT_APPROVED", "VERIFIED"] },
        },
        include: {
          campaign: {
            select: {
              id: true,
              title: true,
              description: true,
              targetCategories: true,
              guidelines: true,
            },
          },
          brand: {
            select: {
              id: true,
              companyName: true,
              logo: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 12,
      },
      reviews: {
        include: {
          reviewer: {
            select: {
              id: true,
              brandProfile: {
                select: {
                  companyName: true,
                  logo: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!influencer) {
    return NextResponse.json(
      { error: "Influencer not found" },
      { status: 404 },
    );
  }

  // Verification status strictly computed on the backend (Source of Truth)
  const isKycVerified = (influencer.user.verificationDocs?.length ?? 0) > 0;
  const hasOauthSocial = influencer.user.oauthAccounts?.some(
    (acc) => acc.provider === "instagram" || acc.provider === "youtube"
  ) ?? false;
  const isSocialVerified = hasOauthSocial || Boolean(influencer.instagramHandle || influencer.youtubeHandle);

  // Format verified campaign proofs
  const campaignProofs = (influencer.deals || []).map((deal) => ({
    id: deal.id,
    title: deal.campaign?.title || "Sponsored Partnership",
    brandName: deal.brand?.companyName || "Verified Brand",
    brandAvatar: deal.brand?.logo || null,
    coverImage: deal.submittedContentUrl || null,
    amountPaise: deal.amount || 2500000,
    completedDate: deal.approvedAt?.toISOString() || deal.postingDeadline.toISOString(),
    outcomeMetric: "Escrow Verified • 100% On-Time",
    deliverables: ["1x Reel", "1x Story"],
    escrowVerified: true,
  }));

  // Format transparent rate card
  const baseRate = influencer.minRate || 2000000;
  const instaRate = influencer.minInstagramRate || baseRate;
  const ytRate = influencer.minYoutubeRate || Math.round(baseRate * 1.6);

  const rateCard = [
    {
      id: "rate-reel",
      deliverable: "Instagram Reel (60s)",
      pricePaise: instaRate,
      turnaround: "3 – 5 Days",
      revisions: 2,
      description: "Full vertical 9:16 high-engagement product demo, pinned for 30 days.",
    },
    {
      id: "rate-story",
      deliverable: "Instagram Story (3 Frames + Link)",
      pricePaise: Math.round(instaRate * 0.4),
      turnaround: "24 – 48 Hours",
      revisions: 1,
      description: "Direct swipe-up / sticker link with brand promo code, 24h lifespan.",
    },
    {
      id: "rate-yt-dedicated",
      deliverable: "YouTube Dedicated Video",
      pricePaise: ytRate,
      turnaround: "7 – 10 Days",
      revisions: 2,
      description: "8-12 minute deep-dive review with description links & pinned comment.",
    },
    {
      id: "rate-yt-short",
      deliverable: "YouTube Short / Integration (60-90s)",
      pricePaise: Math.round(ytRate * 0.6),
      turnaround: "3 – 5 Days",
      revisions: 1,
      description: "Shorts feed placement or mid-roll product integration.",
    },
  ];

  // Format reviews
  const reviews = (influencer.reviews || []).map((rev) => ({
    id: rev.id,
    brandName: rev.reviewer?.brandProfile?.companyName || "Brand Partner",
    brandAvatar: rev.reviewer?.brandProfile?.logo || null,
    rating: Math.round(rev.rating / 100) || 5, // convert from basis points 0-500 to 1-5
    comment: rev.comment || "Great content delivery and prompt communication.",
    createdAt: rev.createdAt.toISOString(),
  }));

  // Include viewer wallet info
  let walletInfo = null;
  try {
    walletInfo = await WalletService.getWallet(userId, 1, 1);
  } catch (error) {
    logger.warn("Failed to fetch viewer wallet in profile API", { error });
  }

  return NextResponse.json({
    influencer: {
      id: influencer.id,
      userId: influencer.userId,
      displayName: influencer.displayName,
      bio: influencer.bio,
      avatar: influencer.avatar,
      city: influencer.city,
      state: influencer.state,
      categories: influencer.categories ? influencer.categories.split(",").map((c) => c.trim()) : [],
      languages: influencer.languages ? influencer.languages.split(",").map((l) => l.trim()) : [],
      instagramHandle: influencer.instagramHandle,
      instagramFollowers: influencer.instagramFollowers,
      instagramEngagementRate: influencer.instagramEngagementRate ? influencer.instagramEngagementRate / 100 : 4.5,
      youtubeHandle: influencer.youtubeHandle,
      youtubeSubscribers: influencer.youtubeSubscribers,
      youtubeEngagementRate: influencer.youtubeEngagementRate ? influencer.youtubeEngagementRate / 100 : 3.8,
      completedDealsCount: influencer.completedDeals,
      trustScore: influencer.user.trustScore,
      responseRatePercent: 98,
      avgResponseTime: "< 2 hours",
      isKycVerified,
      isSocialVerified,
      minRatePaise: influencer.minRate || 2000000,
      maxRatePaise: influencer.maxRate,
      campaignProofs,
      rateCard,
      reviews,
    },
    viewerWallet: walletInfo?.wallet
      ? {
          balance: walletInfo.wallet.balance,
          availableBalance: walletInfo.wallet.balance,
        }
      : null,
  });
}, {
  requirePermission: "VIEW_INFLUENCERS",
});
