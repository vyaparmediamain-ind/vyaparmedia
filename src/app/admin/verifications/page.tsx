import { AdminService } from "@/services/admin.service";
import VerificationQueue from "@/components/admin/VerificationQueue";
import { PageContainer, PageHeader } from "@/components/ui";
import { ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Verification Queue | Admin",
  description: "Review pending KYC requests from influencers and brands",
};

export default async function AdminVerificationsPage() {
  // Call service directly on the server to prevent port-binding failures and loopback request overhead
  const pendingUsers = await AdminService.getVerificationQueue();

  return (
    <PageContainer maxWidth="4xl" className="space-y-6 py-2 sm:py-4">
      {/* Page header */}
      <PageHeader
        icon={
          <div className="w-10 h-10 rounded-xl bg-verified/10 border border-verified-border flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-verified" />
          </div>
        }
        title="Verification Queue"
        subtitle="Manage and review pending KYC requests from influencers and brands."
      />

      <VerificationQueue pendingUsers={pendingUsers} isNarrow={true} />
    </PageContainer>
  );
}
