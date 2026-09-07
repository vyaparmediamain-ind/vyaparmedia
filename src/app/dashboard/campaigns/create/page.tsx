import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard/DashboardShell";
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
<CreateCampaignClient />
</DashboardShell>
);
}
