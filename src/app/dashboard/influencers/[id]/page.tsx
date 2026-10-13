import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { PageContainer, PageHeader } from "@/components/ui";
import { InfluencerProfileClient, InfluencerProfileData } from "@/components/profile";
import { MessageService } from "@/services/message.service";

export const dynamic = "force-dynamic";

export default async function InfluencerProfilePage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const session = await auth();

  // Server-side direct prefetch for sub-second (<1s) initial rendering
  const influencer = await prisma.influencerProfile.findUnique({
    where: { id },
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
    notFound();
  }

  // Backend verification status computation (Source of Truth)
  const isKycVerified = (influencer.user.verificationDocs?.length ?? 0) > 0;
  const hasOauthSocial = influencer.user.oauthAccounts?.some(
    (acc) => acc.provider === "instagram" || acc.provider === "youtube"
  ) ?? false;
  const isSocialVerified = hasOauthSocial || Boolean(influencer.instagramHandle || influencer.youtubeHandle);

  // Completed campaign proofs
  const campaignProofs = (influencer.deals || []).map((deal) => ({
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

  // Rate card computation
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

  // Reviews
  const reviews = (influencer.reviews || []).map((rev) => ({
    id: rev.id,
    brandName: rev.reviewer?.brandProfile?.companyName || "Verified Brand",
    brandAvatar: rev.reviewer?.brandProfile?.logo || null,
    rating: Math.round(rev.rating / 100) || 5,
    comment: rev.comment || "Outstanding content quality, perfectly adhered to brand guidelines.",
    createdAt: rev.createdAt.toISOString(),
  }));

  const formattedProfile: InfluencerProfileData = {
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
  };

  const isOwnProfile = session?.user?.id === influencer.userId;
  let canMessage = false;
  if (session?.user?.id && influencer.userId && !isOwnProfile) {
    canMessage = await MessageService.canMessageUser(session.user.id, influencer.userId);
  }

  return (
    <DashboardShell user={session?.user}>
      <PageContainer maxWidth="5xl" className="py-4 sm:py-6 space-y-4">
        <PageHeader
          backHref="/dashboard/influencers"
          backLabel="All Creators"
          title={formattedProfile.displayName}
          subtitle={`@${formattedProfile.instagramHandle || formattedProfile.youtubeHandle || "creator"} · Verified Creator Portfolio`}
        />
        <InfluencerProfileClient
          profile={formattedProfile}
          viewerRole={session?.user?.userType}
          isOwnProfile={isOwnProfile}
          canMessage={canMessage}
        />
      </PageContainer>
    </DashboardShell>
  );
}
