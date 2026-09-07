"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import EmptyState from "@/components/ui/EmptyState";
import { Badge, Input, Select } from "@/components/ui";
import type { AdminService } from "@/services/admin.service";
import type { Prisma } from "@prisma/client";

type AdminAuditLogElement = Prisma.PromiseReturnType<typeof AdminService.listAuditLogs>[number];
type ListAuditLogsResult = {
success: boolean;
data: AdminAuditLogElement[];
};

export default function AdminAuditLogsPage() {
const [actorId, setActorId] = useState("");
const [entityType, setEntityType] = useState("");
const [entityId, setEntityId] = useState("");

const queryParams = new URLSearchParams();
if (actorId.trim()) queryParams.set("actorId", actorId.trim());
if (entityType) queryParams.set("entityType", entityType);
if (entityId.trim()) queryParams.set("entityId", entityId.trim());

const { data, error, isLoading } = useSWR<ListAuditLogsResult>(
`/api/admin/audit-logs?${queryParams.toString()}`,
fetcher
);

const auditLogs = data?.data || [];

const getEntityBadgeVariant = (type: string | null) => {
if (type === "USER") return "primary";
if (type === "DEAL") return "success";
if (type === "CAMPAIGN") return "warning";
if (type === "FEEDBACK") return "primary";
if (type === "BUG") return "danger";
return "ghost";
};

let content;
if (isLoading) {
content = (
<div className="flex justify-center p-12">
<span className="loading w-16 h-16" />
</div>
);
} else if (error) {
content = (
<div className="text-center text-rose p-6">Failed to load audit logs.</div>
);
} else if (auditLogs.length === 0) {
content = (
<EmptyState
emoji=""
title="No Audit Logs"
description="No activity matches your filters."
/>
);
} else {
content = (
<div className="card overflow-hidden p-0">
<div className="admin-table-wrap">
<table className="w-full border-collapse">
<thead>
<tr className="bg-secondary">
{["Actor ID", "Action Type", "Entity Type", "Entity ID", "Timestamp", "Details"].map(
(heading) => (
<th
key={heading}
className="text-left border-b border-card text-muted text-xs font-extrabold uppercase p-14-18"
>
{heading}
</th>
)
)}
</tr>
</thead>
<tbody>
{auditLogs.map((log: AdminAuditLogElement) => {
return (
<tr key={log.id} className="border-b border-card">
<td className="p-card text-secondary text-sm">
{log.actorId}
</td>
<td className="p-card font-extrabold">
{log.actionType}
</td>
<td className="p-card">
<Badge
variant={getEntityBadgeVariant(log.entityType)}
className="uppercase text-xs"
>
{log.entityType}
</Badge>
</td>
<td className="p-card text-secondary text-sm">
{log.entityId || "-"}
</td>
<td className="p-card text-secondary text-sm">
{new Date(log.timestamp).toLocaleString("en-IN")}
</td>
<td className="p-card">
<div
className="text-sm overflow-hidden text-primary whitespace-nowrap max-w-240 text-ellipsis"
title={log.beforeJSON || log.afterJSON ? JSON.stringify({ before: log.beforeJSON, after: log.afterJSON }) : ""}
>
{log.beforeJSON || log.afterJSON ? JSON.stringify({ before: log.beforeJSON, after: log.afterJSON }) : "-"}
</div>
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
<h1 className="text-3xl font-extrabold mb-1">Audit Logs</h1>
<p className="text-secondary text-sm">
View all system activity and administrative actions.
</p>
</div>
</div>

{/* Interactive Filters */}
<div className="card p-4 mb-6 flex flex-wrap gap-4 items-end">
<div className="flex-1 min-w-200">
<Input
label="Actor ID"
id="filter-actor-id"
value={actorId}
onChange={(e) => setActorId(e.target.value)}
placeholder="Search by Actor ID..."
fullWidth
/>
</div>
<div className="w-180">
<Select
label="Entity Type"
id="filter-entity-type"
value={entityType}
onChange={(e) => setEntityType(e.target.value)}
fullWidth
>
<option value="">All Types</option>
<option value="USER">User</option>
<option value="DEAL">Deal</option>
<option value="CAMPAIGN">Campaign</option>
<option value="APPLICATION">Application</option>
<option value="WALLET">Wallet</option>
<option value="FEEDBACK">Feedback</option>
<option value="BUG">Bug Report</option>
</Select>
</div>
<div className="flex-1 min-w-200">
<Input
label="Entity ID"
id="filter-entity-id"
value={entityId}
onChange={(e) => setEntityId(e.target.value)}
placeholder="Search by Entity ID..."
fullWidth
/>
</div>
</div>

{content}
</div>
);
}
