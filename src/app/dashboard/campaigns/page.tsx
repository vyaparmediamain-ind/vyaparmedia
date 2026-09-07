import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard/DashboardShell";
import CampaignsClient from "./CampaignsClient";

export default async function CampaignsPage() {
const session = await auth();

if (!session?.user) {
redirect("/login");
}

return (
<DashboardShell user={session.user}>
<CampaignsClient user={session.user} />
</DashboardShell>
);
}
