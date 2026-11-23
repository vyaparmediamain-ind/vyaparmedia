import { auth } from "@/lib/auth";
import { requireActiveAdmin } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import { AdminCampaignService } from "@/services/admin-campaign.service";
import AdminCampaignsListClient from "./AdminCampaignsListClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Campaign Management & Audit | Admin",
  description: "Platform-wide campaign oversight, status monitoring, budget tracking, and risk inspection",
};

export default async function AdminCampaignsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly page?: string; readonly status?: string; readonly search?: string }>;
}) {
  const session = await auth();

  try {
    await requireActiveAdmin(session?.user);
  } catch {
    redirect("/dashboard");
  }

  const { page, status, search } = await searchParams;
  const pageNum = Number.parseInt(page || "1", 10) || 1;

  const data = await AdminCampaignService.listAdminCampaigns(session?.user, {
    page: pageNum,
    limit: 20,
    status: status || undefined,
    search: search || undefined,
  });

  return (
    <AdminCampaignsListClient
      initialCampaigns={data.campaigns}
      pagination={data.pagination}
      currentStatus={status || ""}
      currentSearch={search || ""}
    />
  );
}
