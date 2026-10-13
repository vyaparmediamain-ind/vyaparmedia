import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { PageContainer } from "@/components/ui";
import { getUserVerificationTier } from "@/lib/verification-tiers";
// PageHeader is rendered inside CampaignDetailClient for dynamic budget metrics and application modal triggers
import CampaignDetailClient from "./CampaignDetailClient";

export default async function CampaignDetailPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  let influencerProfile = null;
  let kycTier = 0;
  if (session.user.userType === "INFLUENCER") {
    const [profile, tier] = await Promise.all([
      prisma.influencerProfile.findUnique({
        where: { userId: session.user.id },
        select: {
          id: true,
          instagramFollowers: true,
          instagramEngagementRate: true,
          youtubeSubscribers: true,
          youtubeEngagementRate: true,
        },
      }),
      getUserVerificationTier(session.user.id, "INFLUENCER"),
    ]);
    influencerProfile = profile;
    kycTier = tier;
  }

  return (
    <DashboardShell user={session.user}>
      <PageContainer maxWidth="6xl" className="py-4 sm:py-6">
        <CampaignDetailClient
          user={session.user}
          influencerProfile={influencerProfile}
          kycTier={kycTier}
        />
      </PageContainer>
    </DashboardShell>
  );
}
