import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import DashboardShell from "@/components/dashboard/DashboardShell";

import CampaignDetailClient from "./CampaignDetailClient";

export default async function CampaignDetailPage() {
const session = await auth();

if (!session?.user) {
redirect("/login");
}

let influencerProfile = null;
if (session.user.userType === "INFLUENCER") {
influencerProfile = await prisma.influencerProfile.findUnique({
where: { userId: session.user.id },
select: {
id: true,
instagramFollowers: true,
instagramEngagementRate: true,
youtubeSubscribers: true,
youtubeEngagementRate: true,
},
});
}

return (
<DashboardShell user={session.user}>
<CampaignDetailClient user={session.user} influencerProfile={influencerProfile} />
</DashboardShell>
);
}
