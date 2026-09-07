"use client";



import { useState, useMemo } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import Image from "next/image";
import { useSession } from "next-auth/react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { formatCurrency, normalizeDeliverables } from "@/lib/utils-client";
import EmptyState from "@/components/ui/EmptyState";
import { Badge, Button } from "@/components/ui";

const statusConfig: Record<
string,
{ label: string; tone: string; icon: string }
> = {
PENDING_SIGNATURE: {
label: "Awaiting Signature",
tone: "warning",
icon: "✏️",
},
ACTIVE: { label: "Active", tone: "cyan", icon: "▶️" },
CONTENT_SUBMITTED: {
label: "Awaiting Review",
tone: "warning",
icon: "⏳",
},
REVISION_REQUESTED: {
label: "Revision Needed",
tone: "warning",
icon: "↺",
},
CONTENT_APPROVED: {
label: "Ready to Post",
tone: "primary",
icon: "✅",
},
POSTED: {
label: "Post Submitted",
tone: "cyan",
icon: "📤",
},
VERIFICATION_PENDING: {
label: "Verifying",
tone: "warning",
icon: "🔍",
},
VERIFIED: { label: "Verified", tone: "success", icon: "✓" },
COMPLETED: { label: "Completed", tone: "success", icon: "🏁" },
DISPUTED: { label: "Disputed", tone: "danger", icon: "⚠️" },
CANCELLED: {
label: "Cancelled",
tone: "muted",
icon: "✕",
},
PAYMENT_PENDING: {
label: "Payment Pending",
tone: "warning",
icon: "⏳",
},
PAYMENT_HELD: {
label: "Payment Secured",
tone: "success",
icon: "🔒",
},
};

function getStatusInfo(status: string) {
return (
statusConfig[status] || {
label: status.replaceAll("_", " "),
tone: "muted",
icon: "--",
}
);
}

function getBadgeToneVariant(tone: string) {
if (tone === "success") return "success";
if (tone === "danger") return "danger";
if (tone === "warning") return "warning";
if (tone === "cyan") return "primary";
return "ghost";
}

interface Deal {
id: string;
status: string;
amount: number;
createdAt: string;
postingDeadline: string;
campaign: { title: string };
brand: { companyName: string; logo: string | null };
deliverables: { type: string; count: number }[];
}

interface RawDeal {
id: string;
status: string;
amount: number;
createdAt: string | Date;
postingDeadline?: string;
campaign?: {
title?: string;
postingDeadline?: string;
deliverables?: unknown;
};
brand?: {
companyName?: string;
logo?: string | null;
};
deliverables?: unknown;
}

function normalizeDeal(raw: RawDeal): Deal {
const campaign = raw?.campaign || {};
const brand = raw?.brand || {};

return {
id: String(raw?.id || ""),
status: String(raw?.status || "PENDING_SIGNATURE"),
amount: Number(raw?.amount || 0),
createdAt: raw?.createdAt
? new Date(raw.createdAt).toLocaleDateString("en-IN")
: "Not started",
postingDeadline: raw?.postingDeadline || campaign?.postingDeadline || new Date().toISOString(),
campaign: {
title: String(campaign?.title || "Untitled Campaign"),
},
brand: {
companyName: String(brand?.companyName || "Brand"),
logo: brand?.logo || null,
},
deliverables: normalizeDeliverables(raw?.deliverables || campaign?.deliverables),
};
}

interface DealsApiResponse {
data?: {
deals?: RawDeal[];
pagination?: { totalPages?: number };
stats?: { active?: number; completed?: number; totalEarnings?: number };
};
deals?: RawDeal[];
pagination?: { totalPages?: number };
stats?: { active?: number; completed?: number; totalEarnings?: number };
}

function getDeliverableIcon(type: string): string {
const icons: Record<string, string> = {
INSTAGRAM_POST: "IG",
INSTAGRAM_REEL: "IG",
INSTAGRAM_STORY: "IG",
YOUTUBE_VIDEO: "YT",
YOUTUBE_SHORT: "YT",
TWITTER_POST: "X",
LINKEDIN_POST: "LI",
};
return icons[type] || "POST";
}

function DealSkeleton() {
return (
<div className="card mb-4">
<div className="flex gap-4 items-center mb-4">
<div className="deal-skeleton-logo skeleton flex-shrink-0 rounded-md" />
<div className="flex-1">
<div className="deal-skeleton-title skeleton rounded-md" />
<div className="deal-skeleton-subtitle skeleton rounded-md h-3" />
</div>
<div className="skeleton rounded-full h-7 w-25" />
</div>
<div className="flex justify-between items-center flex-wrap gap-4">
<div className="deal-skeleton-meta flex flex-1">
<div>
<div className="deal-skeleton-label-wide skeleton rounded-sm h-3 mb-1-5" />
<div className="deal-skeleton-value-wide skeleton rounded-sm h-3-5" />
</div>
<div>
<div className="deal-skeleton-label skeleton rounded-sm h-3 mb-1-5" />
<div className="skeleton rounded-sm h-3-5 w-15" />
</div>
</div>
<div className="text-right">
<div className="deal-skeleton-label skeleton rounded-sm h-3 mb-1-5 ml-auto" />
<div className="deal-skeleton-value-wide skeleton rounded-sm h-5-5 ml-auto" />
</div>
</div>
</div>
);
}

interface DealListItemProps {
readonly deal: Deal;
readonly selectedDeal: string | null;
readonly setSelectedDeal: (id: string | null) => void;
}

interface DealsEmptyStateProps {
readonly statusFilter: string;
readonly isInfluencer: boolean;
readonly setStatusFilter: (filter: string) => void;
}

function DealsEmptyState({ statusFilter, isInfluencer, setStatusFilter }: DealsEmptyStateProps) {
let message = "No deals match this status filter. Try a different filter.";
if (statusFilter === "all") {
message = isInfluencer
? "Apply to campaigns to start collaborating with brands and earning!"
: "Create a campaign and invite influencers to start collaborating.";
}

const title = statusFilter === "all"
? "No Deals Yet"
: `No ${statusFilter.replaceAll("_", " ").toLowerCase()} deals`;

const isAll = statusFilter === "all";
let actionLabel = "View All Deals";
let actionHref: string | undefined = undefined;

if (isAll) {
  actionLabel = isInfluencer ? "Browse Campaigns" : "Create Campaign";
  actionHref = isInfluencer ? "/dashboard/campaigns" : "/dashboard/campaigns/create";
}

const onActionClick = !isAll ? () => setStatusFilter("all") : undefined;

return (
<EmptyState
title={title}
description={message}
actionLabel={actionLabel}
actionHref={actionHref}
onActionClick={onActionClick}
/>
);
}

function DealListItem({ deal, selectedDeal, setSelectedDeal }: DealListItemProps) {
const status = getStatusInfo(deal.status);
const canSubmitContent = [
"ACTIVE",
"PAYMENT_HELD",
"REVISION_REQUESTED",
].includes(deal.status);

return (
<div
className="deal-list-card card overflow-hidden p-0"
data-selected={selectedDeal === deal.id}
>
<Button
type="button"
variant="ghost"
onClick={() =>
setSelectedDeal(selectedDeal === deal.id ? null : deal.id)
}
aria-expanded={selectedDeal === deal.id}
className="block w-full p-6 text-left"
>
<div
className="flex justify-between items-start mb-4 flex-wrap gap-3"
>
<div
className="flex gap-4 items-center"
>
<div
className="deal-brand-logo"
>
{deal.brand.logo ? (
<Image
src={deal.brand.logo}
alt={deal.brand.companyName}
fill
unoptimized
className="object-cover"
/>
) : (
<span>{deal.brand.companyName?.[0]?.toUpperCase() || "B"}</span>
)}
</div>
<div>
<h3 className="text-base font-bold">
{deal.campaign.title}
</h3>
<p
className="text-sm text-secondary"
>
{deal.brand.companyName}
</p>
</div>
</div>
<Badge
variant={getBadgeToneVariant(status.tone)}
className="flex items-center gap-2"
>
<span>{status.icon}</span>
<span>{status.label}</span>
</Badge>
</div>

<div
className="flex justify-between items-center flex-wrap gap-4"
>
<div
className="flex gap-4 flex-wrap"
>
<div>
<div
className="text-xs text-muted"
>
Deliverables
</div>
<div
className="flex gap-2 mt-1 flex-wrap"
>
{deal.deliverables.map((d, idx) => (
<span key={d.type + "_" + idx} className="text-sm">
{getDeliverableIcon(d.type)} x{d.count}
</span>
))}
</div>
</div>
<div>
<div
className="text-xs text-muted"
>
Deadline
</div>
<div className="text-sm font-semibold">
{new Date(deal.postingDeadline).toLocaleDateString(
"en-IN",
{
day: "numeric",
month: "short",
},
)}
</div>
</div>
</div>
<div className="deal-amount text-right">
<div
className="text-xs text-muted"
>
Amount
</div>
<div

className="text-lg font-extrabold gradient-text"
>
{formatCurrency(deal.amount)}
</div>
</div>
</div>
</Button>

{selectedDeal === deal.id && (
<div
className="deal-expanded"
>
<div
className="deal-expanded-grid"
>
<div className="deal-expanded-section">
<div className="flex items-center gap-2 mb-2">
<span className="text-base">📅</span>
<h4 className="text-sm font-bold text-white">Deal Timeline</h4>
</div>
<div className="text-sm flex flex-col gap-1 text-secondary">
<div className="flex justify-between">
<span className="text-muted">Started:</span>
<span className="font-medium text-white">{deal.createdAt}</span>
</div>
<div className="flex justify-between">
<span className="text-muted">Post Deadline:</span>
<span className="font-semibold text-primary-light">
{new Date(deal.postingDeadline).toLocaleDateString("en-IN", {
day: "numeric",
month: "short",
year: "numeric"
})}
</span>
</div>
</div>
</div>

<div className="deal-expanded-section">
<div className="flex items-center gap-2 mb-2">
<span className="text-base">📦</span>
<h4 className="text-sm font-bold text-white">Required Deliverables</h4>
</div>
<div className="flex flex-wrap gap-2">
{deal.deliverables.map((d, idx) => (
<div
key={d.type + "_" + idx}
className="badge px-3 py-1 bg-secondary border border-card rounded-md text-xs font-semibold flex items-center gap-1.5"
>
<span className="text-emerald font-bold">{getDeliverableIcon(d.type)}</span>
<span>{d.type.replaceAll("_", " ")}</span>
<span className="text-muted">× {d.count}</span>
</div>
))}
</div>
</div>
</div>

        <div className="flex items-center justify-between flex-wrap gap-3 mt-4">
<div className="flex gap-2 flex-wrap">
<Button href={`/dashboard/messages?deal=${deal.id}`} variant="secondary" size="sm">
💬 Message
</Button>
<Button href={`/dashboard/deals/${deal.id}`} variant="ghost" size="sm">
📄 Details
</Button>
</div>

<div className="flex gap-2 flex-wrap">
{canSubmitContent && (
<Button href={`/dashboard/deals/${deal.id}`} variant="primary" size="sm">
📤 Submit Content
</Button>
)}
{deal.status === "CONTENT_APPROVED" && (
<Button href={`/dashboard/deals/${deal.id}`} variant="primary" size="sm">
🔗 Submit Post URL
</Button>
)}
</div>
</div>
</div>
)}
</div>
);
}

export default function DealsPage() {
const { data: session } = useSession();
const [statusFilter, setStatusFilter] = useState("all");
const [selectedDeal, setSelectedDeal] = useState<string | null>(null);
const [currentPage, setCurrentPage] = useState(1);
const DEALS_PER_PAGE = 50;
const isInfluencer = session?.user?.userType === "INFLUENCER";

const statusParam = statusFilter === "all" ? "" : `&status=${statusFilter}`;
const { data: payload, isLoading: loading } = useSWR<DealsApiResponse>(
`/api/deals?page=${currentPage}&limit=${DEALS_PER_PAGE}${statusParam}`,
fetcher
);

const { deals, totalPages, stats } = useMemo(() => {
const data = payload?.data || payload;
const rawDeals: unknown[] = Array.isArray(data?.deals) ? data.deals : [];
const mappedDeals = rawDeals.map((raw) => normalizeDeal(raw as RawDeal)).filter((deal) => deal.id);
const pages = data?.pagination?.totalPages || 1;
const dealStats = data?.stats || { active: 0, completed: 0, totalEarnings: 0 };
return { deals: mappedDeals, totalPages: pages, stats: dealStats };
}, [payload]);

const filteredDeals = deals;

const dealStats = stats;

if (!session) {
return <div className="p-8 text-center text-muted">Loading session...</div>;
}

return (
<DashboardShell user={session.user}>
{/* Page Header */}
<div
className="mb-6 flex justify-between items-center"
>
<div>
<h1 className="text-2xl font-extrabold">My Deals</h1>
<p className="text-secondary text-sm">
Manage your active collaborations
</p>
</div>
</div>

{loading ? (
<div>
{/* Stats skeleton */}
<div className="grid-3 mb-6">
{[1, 2, 3].map((i) => (
<div key={i} className="card text-center p-6">
<div className="deal-stat-skeleton skeleton h-9 w-20 rounded-md" />
<div className="skeleton rounded-sm mx-auto h-3 w-25" />
</div>
))}
</div>
{/* Deal card skeletons */}
{[1, 2, 3, 4].map((i) => <DealSkeleton key={i} />)}
</div>
) : (
<>
{/* Stats */}
<div className="grid-3 mb-6">
<div className="card text-center">
<div
className="font-extrabold text-3xl text-cyan"
>
{dealStats.active}
</div>
<div
className="text-secondary text-sm"
>
Active Deals
</div>
</div>
<div className="card text-center">
<div
className="font-extrabold text-3xl text-emerald"
>
{dealStats.completed}
</div>
<div
className="text-secondary text-sm"
>
Completed
</div>
</div>
<div className="card text-center">
<div
className="text-3xl font-extrabold gradient-text"
>
{formatCurrency(dealStats.totalEarnings || 0)}
</div>
<div
className="text-secondary text-sm"
>
{isInfluencer ? "Total Earned" : "Total Spent"}
</div>
</div>
</div>

{/* Filter */}
<div
className="scrollable-tabs flex gap-2 mb-6 pb-2"
>
{[
{ key: "all", label: "All Deals" },
{ key: "PENDING_SIGNATURE", label: "Awaiting Signature" },
{ key: "ACTIVE", label: "Active" },
{ key: "PAYMENT_HELD", label: "Secured" },
{ key: "CONTENT_SUBMITTED", label: "Awaiting Review" },
{ key: "REVISION_REQUESTED", label: "Revision Needed" },
{ key: "CONTENT_APPROVED", label: "Ready to Post" },
{ key: "POSTED", label: "Post Submitted" },
{ key: "VERIFICATION_PENDING", label: "Verifying" },
{ key: "COMPLETED", label: "Completed" },
{ key: "CANCELLED", label: "Cancelled" },
{ key: "DISPUTED", label: "Disputed" },
].map((f) => (
<Button
key={f.key}
variant={statusFilter === f.key ? "primary" : "secondary"}
onClick={() => {
setStatusFilter(f.key);
setCurrentPage(1);
}}
className="whitespace-nowrap"
>
{f.label}
</Button>
))}
</div>

{/* Deals List */}
<div
className="flex flex-col gap-4"
>
{filteredDeals.map((deal) => (
<DealListItem
key={deal.id}
deal={deal}
selectedDeal={selectedDeal}
setSelectedDeal={setSelectedDeal}
/>
))}
</div>

{filteredDeals.length === 0 && (
<DealsEmptyState
statusFilter={statusFilter}
isInfluencer={isInfluencer}
setStatusFilter={setStatusFilter}
/>
)}
</>
)}
{/* Pagination */}
{totalPages > 1 && (
<div className="deals-pagination flex justify-center items-center gap-4">
<Button
variant="secondary"
disabled={currentPage <= 1}
onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
className="min-w-100"
>
 Previous
</Button>
<span className="text-sm text-secondary">
Page {currentPage} of {totalPages}
</span>
<Button
variant="secondary"
disabled={currentPage >= totalPages}
onClick={() => setCurrentPage((p) => p + 1)}
className="min-w-100"
>
Next
</Button>
</div>
)}
</DashboardShell>
);
}
