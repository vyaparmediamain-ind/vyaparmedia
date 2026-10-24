import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { PageContainer } from "@/components/ui";
// PageHeader is rendered inside CreateCampaignClient for interactive step navigation and draft actions
import CreateCampaignClient from "./CreateCampaignClient";

export default async function CreateCampaignPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { userType } = session.user;

  // Only Brands can create campaigns
  if (userType !== "BRAND") {
    redirect("/dashboard/campaigns");
  }

  return (
    <DashboardShell user={session.user}>
      <PageContainer maxWidth="6xl" className="pt-4 pb-0 sm:py-6">
        <CreateCampaignClient />
      </PageContainer>
    </DashboardShell>
  );
}
