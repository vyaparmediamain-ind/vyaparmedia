import { AdminService } from "@/services/admin.service";
import { Prisma } from "@prisma/client";
import { approveFlaggedApplication, rejectFlaggedApplication } from "../actions";
import { formatCurrency } from "@/lib/utils-client";
import { z } from "zod";
import EmptyState from "@/components/ui/EmptyState";
import { Badge, Button, Input } from "@/components/ui";

export const dynamic = "force-dynamic";

type FlaggedApp = Prisma.PromiseReturnType<
typeof AdminService.getFlaggedApplications
>[number];

function getTrustTone(score: number) {
if (score < 30) return "danger";
if (score < 60) return "warning";
return "success";
}

export default async function AdminApplicationsPage() {
// Call service directly on the server consistent with other admin pages; avoids loopback REST overhead
const flaggedApps = await AdminService.getFlaggedApplications();

return (
<div className="admin-page admin-page-narrow">
<header className="mb-8">
<div className="flex justify-between items-start flex-wrap gap-4">
<div>
<h1 className="gradient-text mb-2 text-3xl font-extrabold">
Flagged Applications
</h1>
<p className="text-secondary text-sm">
Review campaign pitches flagged by the automated security risk engine.
</p>
</div>
<Button
href="/admin"
variant="secondary"
size="sm"
aria-label="Back to Admin Dashboard"
>
 Admin Dashboard
</Button>
</div>
</header>

{/* Summary stats */}
<div
className="card mb-6 flex gap-8 flex-wrap px-6-py-4 admin-flagged-summary"
>
<div>
<div className="text-muted font-bold text-xs uppercase">
Total Flagged
</div>
<div className="text-2xl font-extrabold text-rose">
{flaggedApps.length}
</div>
</div>
<div>
<div className="text-muted font-bold text-xs uppercase">
Total Value at Risk
</div>
<div className="text-2xl font-extrabold text-amber">
{formatCurrency(
flaggedApps.reduce((sum, app) => sum + (app.proposedRate || 0), 0)
)}
</div>
</div>
</div>

{flaggedApps.length === 0 ? (
<EmptyState
emoji=""
title="No Flagged Applications"
description="All applications have passed the security risk check."
/>
) : (
<div className="grid gap-4">
{flaggedApps.map((app: FlaggedApp) => {
const approveAction = approveFlaggedApplication.bind(null, app.id);
const rejectAction = async (formData: FormData) => {
"use server";
const rawReason = (formData.get("reason") as string) || "";
const reason = z.string().max(200, "Reason must be less than 200 characters").default("Security check failed").parse(rawReason);
await rejectFlaggedApplication(app.id, reason);
};

return (
<div
key={app.id}
className="card p-6 bg-rose-02 admin-flagged-card"
>
{/* Header row */}
<div
className="flex justify-between flex-wrap gap-4 mb-4"
>
<div>
<div className="flex items-center gap-2 mb-1">
<Badge variant="danger" className="uppercase text-2xs tracking-wider">
FLAGGED
</Badge>
<span className="text-muted text-xs">
{new Date(app.createdAt).toLocaleDateString("en-IN", {
day: "numeric",
month: "short",
year: "numeric",
})}
</span>
</div>
<h3 className="font-extrabold mb-1 text-primary text-base">
{app.campaign.title}
</h3>
<p className="text-sm text-secondary">
Brand: <strong>{app.campaign.brand?.companyName || "Unknown"}</strong>
</p>
</div>
<div className="text-right">
<div className="text-muted text-xs">Proposed Rate</div>
<div className="text-xl font-extrabold text-emerald">
{formatCurrency(app.proposedRate || 0)}
</div>
</div>
</div>

{/* Influencer info */}
<div
className="flex justify-between items-center flex-wrap gap-3 mb-4 bg-tertiary rounded-md border-card px-4 py-3"
>
<div>
<div className="font-bold text-sm mb-0-5">
{app.influencer.displayName}
</div>
<div className="text-xs text-secondary flex gap-4 flex-wrap">
<span>{app.influencer.user.email}</span>
<span>
Trust Score:{" "}
<strong
className="admin-trust-score"
data-tone={getTrustTone(app.influencer.user.trustScore)}
>
{app.influencer.user.trustScore}
</strong>
</span>
</div>
</div>
<Button
href={`/admin/users?search=${encodeURIComponent(app.influencer.user.email)}`}
variant="secondary"
size="sm"
aria-label={`View profile for ${app.influencer.displayName}`}
>
View User Profile
</Button>
</div>

{/* Action buttons */}
<div
className="flex justify-end items-center gap-3 flex-wrap border-t border-card pt-4"
>
<form action={approveAction}>
<Button
type="submit"
variant="success"
className="text-sm px-4-py-2"
>
Approve Application
</Button>
</form>

<form action={rejectAction} className="flex gap-2 items-center">
<Input
type="text"
name="reason"
placeholder="Rejection reason (optional)..."
className="text-sm px-3-py-1 admin-reject-reason"
/>
<Button
type="submit"
variant="danger"
className="text-sm px-4-py-2"
>
Reject
</Button>
</form>
</div>
</div>
);
})}
</div>
)}
</div>
);
}
