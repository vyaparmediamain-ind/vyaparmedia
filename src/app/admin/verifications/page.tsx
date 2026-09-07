import { AdminService } from "@/services/admin.service";
import VerificationQueue from "@/components/admin/VerificationQueue";

export const dynamic = "force-dynamic";

export default async function VerifiedQueuePage() {
// Call service directly on the server to prevent port-binding failures and loopback request overhead
const pendingUsers = await AdminService.getVerificationQueue();

return (
<div className="admin-page admin-page-narrow">
<header className="mb-8">
<h1 className="gradient-text mb-2 text-3xl font-extrabold">
Verification Queue
</h1>
<p className="text-secondary text-sm">
Manage and review pending KYC requests from influencers and brands.
</p>
</header>

<VerificationQueue pendingUsers={pendingUsers} isNarrow={true} />
</div>
);
}
