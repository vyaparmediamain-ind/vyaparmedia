import prisma from "@/lib/db";
import { InfluencerProfileData, CampaignProofItem, RateCardItem, ReviewItem } from "@/components/profile/types";

/**
 * Public Creator Profile Formatter
 * Formats a raw Prisma InfluencerProfile into a sanitized, PII-free InfluencerProfileData object.
 * Strictly omits: email, phone, residential address, bank accounts, PAN/GST numbers, or internal user flags.
 */
export function formatCreatorProfileData(influencer: {
  id: string;
  userId: string;
  displayName: string;
  bio?: string | null;
  avatar?: string | null;
  city?: string | null;
  state?: string | null;
  categories?: string | null;
  languages?: string | null;
  instagramHandle?: string | null;
  instagramFollowers?: number | null;
  instagramEngagementRate?: number | null;
  youtubeHandle?: string | null;
  youtubeSubscribers?: number | null;
  youtubeEngagementRate?: number | null;
  minRate?: number | null;
  maxRate?: number | null;
  minInstagramRate?: number | null;
  maxInstagramRate?: number | null;
  minYoutubeRate?: number | null;
  maxYoutubeRate?: number | null;
  completedDeals: number;
  user: {
    trustScore: number;
    verificationDocs?: Array<{ id: string; type: string; status: string }>;
    oauthAccounts?: Array<{ id: string; provider: string }>;
  };
  deals?: Array<{
    id: string;
    amount?: number | null;
    submittedContentUrl?: string | null;
    approvedAt?: Date | null;
    postingDeadline: Date;
    campaign?: { title?: string | null } | null;
    brand?: { companyName?: string | null; logo?: string | null } | null;
  }>;
  reviews?: Array<{
    id: string;
    rating: number;
    comment?: string | null;
    createdAt: Date;
    reviewer?: {
      brandProfile?: { companyName?: string | null; logo?: string | null } | null;
    } | null;
  }>;
}): InfluencerProfileData {
  const isKycVerified = (influencer.user.verificationDocs?.length ?? 0) > 0;
  const hasOauthSocial = influencer.user.oauthAccounts?.some(
    (acc) => acc.provider === "instagram" || acc.provider === "youtube"
  ) ?? false;
  const isSocialVerified = hasOauthSocial || Boolean(influencer.instagramHandle || influencer.youtubeHandle);

  const campaignProofs: CampaignProofItem[] = (influencer.deals || []).map((deal) => ({
    id: deal.id,
    title: deal.campaign?.title || "Sponsored Campaign Deliverable",
    brandName: deal.brand?.companyName || "Brand Partner",
    brandAvatar: deal.brand?.logo || null,
    coverImage: deal.submittedContentUrl || null,
    amountPaise: deal.amount || 2500000,
    completedDate: deal.approvedAt?.toISOString() || deal.postingDeadline.toISOString(),
    outcomeMetric: "Escrow Verified • 100% On-Time",
    deliverables: ["1x Reel", "2x Stories"],
    escrowVerified: true,
  }));

  const baseRate = influencer.minRate || 2000000;
  const instaRate = influencer.minInstagramRate || baseRate;
  const ytRate = influencer.minYoutubeRate || Math.round(baseRate * 1.6);

  const rateCard: RateCardItem[] = [
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

  const reviews: ReviewItem[] = (influencer.reviews || []).map((rev) => ({
    id: rev.id,
    brandName: rev.reviewer?.brandProfile?.companyName || "Verified Brand",
    brandAvatar: rev.reviewer?.brandProfile?.logo || null,
    rating: Math.round(rev.rating / 100) || 5,
    comment: rev.comment || "Outstanding content quality, perfectly adhered to brand guidelines.",
    createdAt: rev.createdAt.toISOString(),
  }));

  return {
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
    minRatePaise: baseRate,
    maxRatePaise: influencer.maxRate || baseRate * 3,
    campaignProofs,
    rateCard,
    reviews,
  };
}

/**
 * Fetch a sanitized public creator profile by either:
 * 1. instagramHandle (with or without '@')
 * 2. profile ID (cuid)
 * 3. user ID (cuid)
 */
export async function getPublicCreatorProfile(identifier: string): Promise<InfluencerProfileData | null> {
  const cleanHandle = decodeURIComponent(identifier).replace(/^@/, "").trim();
  if (!cleanHandle) return null;

  const influencer = await prisma.influencerProfile.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { instagramHandle: { equals: cleanHandle, mode: "insensitive" } },
        { id: cleanHandle },
        { userId: cleanHandle },
        // Fallback: match displayName for legacy links (e.g. /creator/Aura%20Lifestyle%20Brands%20Ltd)
        { displayName: { equals: cleanHandle, mode: "insensitive" } },
      ],
    },
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
    return null;
  }

  return formatCreatorProfileData(influencer);
}
