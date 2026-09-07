"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import Link from "next/link";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { useSession } from "next-auth/react";
import EmptyState from "@/components/ui/EmptyState";
import { Badge, Button, Spinner } from "@/components/ui";

interface Dispute {
id: string;
type: string;
status: string;
description: string;
createdAt: string;
deal: {
id: string;
amount: number;
campaign: { title: string };
influencer: { displayName: string };
brand: { companyName: string };
};
}

interface DisputesResponse {
disputes?: Dispute[];
}

export default function DisputesPage() {
const { data: session } = useSession();
const { data, isLoading } = useSWR<DisputesResponse>("/api/disputes", fetcher);
const disputes = data?.disputes || [];



const getStatusBorderClass = (status: string) => {
switch (status) {
case "OPEN": return "border-l-[var(--color-primary)]";
case "TIER1_AUTO": return "border-l-[var(--color-accent-cyan)]";
case "TIER2_MEDIATION": return "border-l-[var(--color-warning)]";
case "RESOLVED": return "border-l-[var(--color-success)]";
case "CLOSED": return "border-l-[var(--color-text-muted)]";
default: return "border-l-[var(--color-text-secondary)]";
}
};

const getStatusLabel = (status: string) => status.replaceAll("_", " ");

const getStatusBadgeVariant = (status: string) => {
if (status === "RESOLVED") return "success";
if (status === "OPEN") return "primary";
if (status === "CLOSED") return "ghost";
return "warning";
};

return (
<DashboardShell user={session?.user}>
<div className="animate-fade-in">
{/* Page Header */}
<div
className="flex justify-between items-center flex-wrap gap-3 mb-6"
>
<div>
<h1 className="font-extrabold text-2xl">
Disputes & Resolution
</h1>
<p className="text-secondary text-sm mt-1">
Manage and track your dispute cases
</p>
</div>
<Button
href="/dashboard/deals"
variant="secondary"
size="sm"
aria-label="Back to Deals"
>
 Back to Deals
</Button>
</div>

{/* Content */}
{(() => {
if (isLoading) {
return (
<div className="flex justify-center p-10">
<Spinner size="lg" />
</div>
);
}
if (disputes.length === 0) {
return (
<EmptyState
emoji=""
title="No Disputes Found"
description="You have no open disputes at the moment."
actionLabel="Go to Deals"
actionHref="/dashboard/deals"
/>
);
}
return (
<div className="flex flex-col gap-4">
{(disputes ?? []).map((dispute) => (
<Link
key={dispute.id}
href={`/dashboard/disputes/${dispute.id}`}
className="no-underline text-inherit"
>
<div className="card hover-lift cursor-pointer">
{/* Top Row: Status + meta */}
<div
className="flex justify-between items-start mb-3 flex-wrap gap-2"
>
<div className="flex flex-wrap items-center gap-2">
<Badge
variant={getStatusBadgeVariant(dispute.status)}
>
{getStatusLabel(dispute.status)}
</Badge>
<span className="text-xs text-secondary">
#{dispute.id.slice(-6)}
</span>
<span className="text-xs text-muted">
{new Date(dispute.createdAt).toLocaleDateString("en-IN", {
day: "numeric",
month: "short",
year: "numeric",
})}
</span>
</div>
<span
className="text-xs font-semibold text-amber rounded-md px-2 py-1 bg-amber-subtle"
>
{dispute.type} Issue
</span>
</div>

{/* Campaign Title */}
<h3 className="font-bold mb-1 text-base">
{dispute.deal.campaign.title}
</h3>

{/* Deal Info */}
<div
className="flex flex-wrap gap-3 text-sm text-secondary mb-3"
>
<span> {(dispute.deal.amount / 100).toLocaleString("en-IN")}</span>
<span> {dispute.deal.influencer?.displayName}</span>
<span> {dispute.deal.brand?.companyName}</span>
</div>

{/* Description Excerpt */}
<div
className={`text-sm text-secondary bg-tertiary rounded-md leading-relaxed py-3 px-3.5 border-l-[3px] ${getStatusBorderClass(dispute.status)}`}
>
"{dispute.description.length > 120
? dispute.description.slice(0, 120) + "..."
: dispute.description}"
</div>

{/* View Details CTA */}
<div className="flex justify-end mt-3-5">
<span
className="text-sm font-semibold text-primary"
>
View Full Details
</span>
</div>
</div>
</Link>
))}
</div>
);
})()}
</div>
</DashboardShell>
);
}
