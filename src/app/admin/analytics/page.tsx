import { AdminAnalyticsService } from "@/services/admin-analytics.service";
import AdminAnalyticsView from "@/components/analytics/AdminAnalyticsView";
import { auth } from "@/lib/auth";
import { requireActiveAdmin } from "@/lib/admin-auth";
import { redirect } from "next/navigation";

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
<div className="admin-page">
<div className="mb-10 text-center sm:text-left">
<h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent inline-flex items-center gap-3">
Platform Analytics
</h1>
<p className="text-gray-400 mt-2 text-sm md:text-base font-medium pl-1 hidden sm:block">
Real-time monitoring and growth metrics dashboard
</p>
</div>

<AdminAnalyticsView data={data} />
</div>
);
}
