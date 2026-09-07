"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import EmptyState from "@/components/ui/EmptyState";
import { Badge, Input } from "@/components/ui";
import type { AdminService } from "@/services/admin.service";
import type { Prisma } from "@prisma/client";

type AdminViolationElement = Prisma.PromiseReturnType<typeof AdminService.listViolations>[number];
type ListViolationsResult = {
success: boolean;
data: AdminViolationElement[];
};

function getSeverityVariant(severity: string): "danger" | "warning" | "success" | "ghost" {
switch (severity) {
case "CRITICAL":
case "HIGH":
return "danger";
case "MEDIUM":
return "warning";
case "LOW":
return "success";
default:
return "ghost";
}
}

function getActionVariant(action: string): "danger" | "warning" | "ghost" {
switch (action) {
case "PERMANENT_BAN":
return "danger";
case "TEMP_SUSPENSION":
return "warning";
default:
return "ghost";
}
}

export default function AdminViolationsPage() {
const [userIdFilter, setUserIdFilter] = useState("");

const queryParams = new URLSearchParams();
if (userIdFilter.trim()) queryParams.set("userId", userIdFilter.trim());

const { data, error, isLoading } = useSWR<ListViolationsResult>(
`/api/admin/violations?${queryParams.toString()}`,
fetcher
);

const violations = data?.data || [];

let content;
if (isLoading) {
content = (
<div className="flex justify-center p-12">
<span className="loading w-16 h-16" />
</div>
);
} else if (error) {
content = (
<div className="text-center text-rose p-6">Failed to load violations.</div>
);
} else if (violations.length === 0) {
content = (
<EmptyState
emoji=""
title="No Violations"
description="No violations match the filter."
/>
);
} else {
content = (
<div className="card overflow-hidden p-0">
<div className="admin-table-wrap">
<table className="w-full border-collapse" aria-label="User violations list">
<thead>
<tr className="bg-secondary">
{["User", "Type", "Severity", "Action", "Description", "Date", "Expires"].map(
(heading) => (
<th
key={heading}
scope="col"
className="text-left border-b border-card text-muted text-xs font-extrabold uppercase p-14-18"
>
{heading}
</th>
)
)}
</tr>
</thead>
<tbody>
{violations.map((violation: AdminViolationElement) => {
const name =
violation.user.influencerProfile?.displayName ||
violation.user.brandProfile?.companyName ||
violation.user.email;

return (
<tr key={violation.id} className="border-b border-card">
<td className="p-card">
<div className="font-extrabold">{name}</div>
<div className="text-muted text-xs mt-1">
{violation.user.email} ({violation.user.userType})
</div>
</td>
<td className="p-card font-bold">
{violation.type}
</td>
<td className="p-card">
<Badge variant={getSeverityVariant(violation.severity)} className="font-extrabold text-xs uppercase">
{violation.severity}
</Badge>
</td>
<td className="p-card">
<Badge variant={getActionVariant(violation.action)} className="font-extrabold text-xs uppercase">
{violation.action}
</Badge>
</td>
<td className="p-card text-sm text-primary">
<div className="overflow-hidden whitespace-nowrap max-w-240 text-ellipsis" title={violation.description}>
{violation.description}
</div>
</td>
<td className="p-card text-secondary text-sm">
{new Date(violation.createdAt).toLocaleDateString("en-IN")}
</td>
<td className="p-card text-secondary text-sm">
{violation.expiresAt
? new Date(violation.expiresAt).toLocaleDateString("en-IN")
: "Never"}
</td>
</tr>
);
})}
</tbody>
</table>
</div>
</div>
);
}

return (
<div className="admin-page">
<div className="admin-toolbar mb-6">
<div>
<h1 className="text-3xl font-extrabold mb-1">User Violations</h1>
<p className="text-secondary text-sm">
View all user violations and enforcement actions.
</p>
</div>
</div>

{/* Interactive Filter */}
<div className="card p-4 mb-6 max-w-400">
<Input
label="Filter by User ID"
id="filter-user-id"
value={userIdFilter}
onChange={(e) => setUserIdFilter(e.target.value)}
placeholder="Enter exact User ID..."
fullWidth
/>
</div>

{content}
</div>
);
}
