import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import DashboardShell from "@/components/dashboard/DashboardShell";
import AdminAnalyticsView from "@/components/analytics/AdminAnalyticsView";
import {
getInfluencerAnalytics,
getBrandAnalytics,
} from "@/lib/analytics-engine";
import { logger } from "@/lib/logger";
import AnalyticsPageClient from "./analytics/AnalyticsPageClient";
import { isAdmin as rbacIsAdmin, isBrand, isInfluencer } from "@/lib/rbac";
import { Button } from "@/components/ui";

export const dynamic = "force-dynamic";

// Data fetching

async function fetchDashboardData(userId: string, userType: string, fy?: string) {
let influencerData = null;
let brandData = null;

if (isInfluencer(userType)) {
try {
influencerData = await getInfluencerAnalytics(userId, fy);
} catch (error) {
logger.error("Influencer analytics fetch failed", error, { userId });
}
} else if (isBrand(userType)) {
try {
brandData = await getBrandAnalytics(userId, fy);
} catch (error) {
logger.error("Brand analytics fetch failed", error, { userId });
}
}

return { influencerData, brandData };
}

// Sub-components (extracted to reduce DashboardPage cognitive complexity)

function DashboardErrorFallback({ user }: Readonly<{ user: Session["user"] }>) {
return (
<DashboardShell user={user}>
<div className="text-center rounded-xl max-w-600 dashboard-error-fallback">
<div className="mb-5 text-3xl" aria-hidden="true">
!
</div>
<h2
className="gradient-text text-2xl mb-3 font-extrabold bg-gradient-rose-orange"
>
Dashboard Interrupted
</h2>
<p
className="text-secondary mb-8 text-sm leading-relaxed"
>
The dashboard could not load the latest workspace data. Please
refresh or try again after a moment.
</p>
<Button
href="/dashboard"
variant="danger"
aria-label="Reload dashboard"
className="dashboard-fallback-button"
>
Reload Dashboard
</Button>
</div>
</DashboardShell>
);
}

function DashboardEmptyState({ dataLoadFailed }: Readonly<{ dataLoadFailed: boolean }>) {
return (
<div className="text-center dashboard-empty-wrap">
<div className="glass mx-auto dashboard-empty-card">
<div
className="mb-6 dashboard-empty-icon"
aria-hidden="true"
>
{dataLoadFailed ? "!" : "..."}
</div>
<h2
className="gradient-text mb-4 text-3xl font-extrabold"
>
{dataLoadFailed ? "Access Interrupted" : "Initializing Workspace"}
</h2>
<p
className="text-secondary text-sm leading-relaxed mb-8"
>
{dataLoadFailed
? "We could not load your dashboard data. Please refresh or try again after a moment."
: "We are fetching your latest campaign, engagement, and financial data."}
</p>
<Button
href="/dashboard"
variant="primary"
size="lg"
aria-label={
dataLoadFailed
? "Retry dashboard data load"
: "Refresh dashboard data"
}
className="dashboard-empty-button"
>
{dataLoadFailed ? "Retry" : "Refresh"}
</Button>
</div>
</div>
);
}

// Page

export default async function DashboardPage({
searchParams,
}: {
readonly searchParams: Promise<{ fy?: string }>;
}) {
const session = await auth();

if (!session?.user) {
redirect("/login");
}

const resolvedSearchParams = await searchParams;
const { userType, id: userId } = session.user;
const isAdmin = rbacIsAdmin(userType);
const fy = resolvedSearchParams?.fy;

if (isAdmin) {
redirect("/admin");
}

let influencerData = null;
let brandData = null;
const adminData = null;

try {
const data = await fetchDashboardData(userId, userType, fy);
influencerData = data.influencerData;
brandData = data.brandData;
} catch (error) {
logger.error("Dashboard critical error", error, { userId, userType });
return <DashboardErrorFallback user={session.user} />;
}

const dataLoadFailed = !adminData && !influencerData && !brandData;

const renderDashboardContent = () => {
if (isAdmin && adminData) {
return (
<div className="mx-auto dashboard-admin-content">
<header className="mb-10">
<h1
className="gradient-text mb-2 text-3xl font-extrabold"
>
Admin Ops Center
</h1>
<p className="text-secondary text-sm">
Platform health, financial operations, and ecosystem monitoring.
</p>
</header>
<AdminAnalyticsView data={adminData} />
</div>
);
}
if (isInfluencer(userType) && influencerData) {
return (
<AnalyticsPageClient
userType="INFLUENCER"
initialData={influencerData}
currentFY={fy || undefined}
/>
);
}
if (isBrand(userType) && brandData) {
return (
<AnalyticsPageClient
userType="BRAND"
initialData={brandData}
currentFY={fy || undefined}
/>
);
}
return <DashboardEmptyState dataLoadFailed={dataLoadFailed} />;
};

return (
<DashboardShell user={session.user}>
{renderDashboardContent()}
</DashboardShell>
);
}
