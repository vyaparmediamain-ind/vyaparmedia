import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { resolveActor } from "@/lib/authz";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { PageContainer } from "@/components/ui";
import { CampaignAnalyticsClient } from "./CampaignAnalyticsClient";

interface CampaignAnalyticsPageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: "Campaign Analytics & Funnel Attribution | VyaparMedia",
  description: "Audited multi-stage conversion funnel, creator performance, and telemetry audience analytics.",
};

export default async function CampaignAnalyticsPage({ params }: CampaignAnalyticsPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { id: campaignId } = await params;

  // Verify campaign exists and caller owns it or is active admin
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      title: true,
      brand: { select: { userId: true } },
    },
  });

  if (!campaign) {
    notFound();
  }

  const actor = await resolveActor(session);
  const isOwner = campaign.brand?.userId === session.user.id;
  const isAdmin = actor.isActiveAdmin;

  // Return 404 for unauthorized users to prevent campaign enumeration / IDOR attacks
  if (!isOwner && !isAdmin) {
    notFound();
  }

  return (
    <DashboardShell user={session.user}>
      <PageContainer maxWidth="7xl" className="pt-4 pb-0 sm:py-6">
        <CampaignAnalyticsClient campaignId={campaignId} />
      </PageContainer>
    </DashboardShell>
  );
}
