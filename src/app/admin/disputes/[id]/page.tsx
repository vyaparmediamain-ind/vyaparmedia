import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { resolveDispute } from "../../dispute-actions";
import EmptyState from "@/components/ui/EmptyState";
import { Button } from "@/components/ui";

export const dynamic = "force-dynamic";

function StatusBadge({ status }: { readonly status: string }) {
let color = "badge-info";
if (status === "COMPLETED" || status === "VERIFIED") {
color = "badge-success";
} else if (status === "DISPUTED") {
color = "badge-danger";
} else if (status === "CANCELLED") {
color = "badge-warning";
}
return <span className={`badge ${color}`}>{status}</span>;
}

function DealHistoryList({
deals,
}: {
readonly deals: Array<{
id: string;
status: string;
amount: number;
createdAt: Date;
campaign: { title: string } | null;
}>;
}) {
if (deals.length === 0) {
return (
<EmptyState
emoji=""
title="No Previous Deals"
description="No previous deals found for this user."
compact
/>
);
}
return (
<div className="flex flex-col gap-2">
{(deals ?? []).map((d) => (
<div
key={d.id}
className="flex justify-between items-center bg-tertiary rounded-md border-card px-3 py-2-5"
>
<div>
<div className="text-sm font-semibold">{d.campaign?.title || "Campaign"}</div>
<div className="text-muted text-xs">
{new Date(d.createdAt).toLocaleDateString()} {(d.amount / 100).toFixed(0)}
</div>
</div>
<StatusBadge status={d.status} />
</div>
))}
</div>
);
}

export default async function AdminDisputeDetailPage({
params,
}: {
readonly params: Promise<{ readonly id: string }>;
}) {
const { id } = await params;
const dispute = await prisma.dispute.findUnique({
where: { id },
include: {
deal: {
include: {
campaign: true,
influencer: {
include: {
user: { select: { id: true, email: true } },
},
},
brand: {
include: {
user: { select: { id: true, email: true } },
},
},
},
},
raisedBy: true,
evidence: true,
},
});

if (!dispute) notFound();

// Fetch deal histories for both parties
const [influencerDeals, brandDeals] = await Promise.all([
prisma.deal.findMany({
where: {
influencerId: dispute.deal.influencerId,
id: { not: dispute.dealId },
},
orderBy: { createdAt: "desc" },
take: 10,
select: {
id: true,
status: true,
amount: true,
createdAt: true,
campaign: { select: { title: true } },
},
}),
prisma.deal.findMany({
where: {
brandId: dispute.deal.brandId,
id: { not: dispute.dealId },
},
orderBy: { createdAt: "desc" },
take: 10,
select: {
id: true,
status: true,
amount: true,
createdAt: true,
campaign: { select: { title: true } },
},
}),
]);

return (
<div className="admin-page">
<div className="admin-toolbar">
<div>
<h1 className="text-3xl font-extrabold mb-1">
Dispute Resolution
</h1>
<p className="text-secondary text-sm">
Final decision workspace for case {dispute.id.slice(0, 8)}.
</p>
</div>
</div>

<div className="grid-2 gap-8">
{/* Details */}
<div className="card">
<h2>Case Details</h2>
<dl
className="grid mt-4 metadata-dl"
>
<dt className="font-semibold text-secondary">Status</dt>
<dd className={`badge badge-${dispute.status === "OPEN" ? "warning" : "success"}`}>
{dispute.status}
</dd>
<dt className="font-semibold text-secondary">Reason</dt>
<dd>{dispute.type}</dd>
<dt className="font-semibold text-secondary">Description</dt>
<dd>{dispute.description}</dd>
<dt className="font-semibold text-secondary">Amount</dt>
<dd>{(dispute.deal.amount / 100).toFixed(2)}</dd>
<dt className="font-semibold text-secondary">Campaign</dt>
<dd>{dispute.deal.campaign?.title || "N/A"}</dd>
</dl>
</div>

{/* Evidence */}
<div className="card">
<h2>Evidence Log</h2>
{dispute.evidence.length === 0 ? (
<EmptyState
emoji=""
title="No Evidence Yet"
description="No evidence has been submitted for this dispute."
compact
/>
) : (
<ul className="p-0">
{dispute.evidence.map((ev) => (
<li
key={ev.id}
className="p-3 border-b border-card"
>
<div className="font-semibold">{ev.description}</div>
<div
className="text-xs text-muted"
>
Uploaded by User {ev.submittedByUserId.slice(0, 8)}... on{" "}
{new Date(ev.submittedAt).toLocaleDateString()}
</div>
{ev.url && (
<a
href={ev.url}
target="_blank"
rel="noopener noreferrer"
className="btn btn-sm btn-outline mt-1"
>
View File
</a>
)}
</li>
))}
</ul>
)}
</div>
</div>

{/* Party Deal Timelines */}
<div className="grid-2 gap-8 mt-8">
{/* Influencer History */}
<div className="card">
<h2 className="mb-4">
Influencer Deal History{" "}
<span className="text-sm font-normal text-secondary ml-2">
(last 10 deals, excl. this dispute)
</span>
</h2>
<DealHistoryList deals={influencerDeals} />
</div>

{/* Brand History */}
<div className="card">
<h2 className="mb-4">
Brand Deal History{" "}
<span className="text-sm font-normal text-secondary ml-2">
(last 10 deals, excl. this dispute)
</span>
</h2>
<DealHistoryList deals={brandDeals} />
</div>
</div>

{/* Actions */}
<div
className="mt-8 p-6 bg-tertiary rounded-lg"
>
<h3 className="mb-4">Administrator Verdict</h3>
<p
className="mb-4 text-secondary"
>
Make a final binding decision. This will transfer funds immediately.
</p>

<div className="flex gap-4 flex-wrap">
<form
action={resolveDispute.bind(
null,
dispute.id,
"REFUND_BRAND",
"Admin Decision: Refund to Brand",
)}
>
<Button type="submit" variant="danger" className="px-6-py-3">
Start Refund (To Brand)
</Button>
</form>

<form
action={resolveDispute.bind(
null,
dispute.id,
"RELEASE_INFLUENCER",
"Admin Decision: Release to Influencer",
)}
>
<Button
type="submit"
variant="success"
className="px-6-py-3"
>
Release Funds (To Influencer)
</Button>
</form>
</div>
</div>
</div>
);
}
