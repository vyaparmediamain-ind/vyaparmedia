import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { PageContainer } from "@/components/ui";
import { Suspense } from "react";
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
        <Suspense
          fallback={
            <div className="space-y-6 animate-pulse py-8">
              <div className="h-10 w-64 bg-muted/60 rounded-xl" />
              <div className="h-64 bg-muted/40 rounded-2xl border border-border" />
            </div>
          }
        >
          <CreateCampaignClient />
        </Suspense>
      </PageContainer>
    </DashboardShell>
  );
}
