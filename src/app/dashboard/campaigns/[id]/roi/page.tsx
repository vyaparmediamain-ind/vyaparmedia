import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { PageContainer } from "@/components/ui";
// PageHeader is rendered inside RoiClient for real-time ROI computation and date-range controls
import { RoiClient } from "./RoiClient";

interface CampaignRoiPageProps {
  params: Promise<{ id: string }>;
}

export default async function CampaignRoiPage({ params }: CampaignRoiPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { id: campaignId } = await params;

  // Verify campaign exists and user is brand or admin
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      title: true,
      brand: { select: { userId: true } },
    },
  });

  if (!campaign) {
    redirect("/dashboard/campaigns");
  }

  const isOwner = campaign.brand?.userId === session.user.id;
  const isAdmin = session.user.userType === "ADMIN";

  if (!isOwner && !isAdmin) {
    redirect(`/dashboard/campaigns/${campaignId}`);
  }

  return (
    <DashboardShell user={session.user}>
      <PageContainer maxWidth="6xl" className="py-4 sm:py-6">
        <RoiClient campaignId={campaignId} />
      </PageContainer>
    </DashboardShell>
  );
}
