import { auth } from "@/lib/auth";
import { requireActiveAdmin } from "@/lib/admin-auth";
import { redirect, notFound } from "next/navigation";
import { AdminCampaignService } from "@/services/admin-campaign.service";
import AdminCampaignClient from "./AdminCampaignClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Campaign Operations Audit | Admin",
  description: "Administrative campaign monitoring, financial tracking, deadline risk & fraud audit",
};

export default async function AdminCampaignDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  try {
    await requireActiveAdmin(session?.user);
  } catch {
    redirect("/dashboard");
  }

  let data;
  try {
    data = await AdminCampaignService.getAdminCampaignDetails(id, session?.user);
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "statusCode" in err &&
      (err as { statusCode: number }).statusCode === 404
    ) {
      notFound();
    }
    throw err;
  }

  return <AdminCampaignClient initialData={data} />;
}
