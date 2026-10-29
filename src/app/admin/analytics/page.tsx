import { AdminAnalyticsService } from "@/services/admin-analytics.service";
import AdminAnalyticsClient from "./AdminAnalyticsClient";
import { auth } from "@/lib/auth";
import { requireActiveAdmin } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Platform Analytics | Admin",
  description: "Real-time monitoring and growth metrics",
};

export default async function AdminAnalyticsPage() {
  const session = await auth();

  try {
    await requireActiveAdmin(session?.user);
  } catch {
    redirect("/dashboard");
  }

  const data = await AdminAnalyticsService.getDashboardStats();

  return (
    <PageContainer maxWidth="6xl" className="space-y-6 py-2 sm:py-4">
      <PageHeader
        icon={
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
        }
        title="Platform Analytics"
        subtitle="Real-time escrow volume, platform GMV, growth velocity, and system health."
      />

      <AdminAnalyticsClient data={data} />
    </PageContainer>
  );
}
