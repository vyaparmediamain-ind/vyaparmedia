/**
* Route-level Suspense skeleton for Admin Audit Logs page.
*/
export default function AdminAuditLogsLoading() {
return (
<div className="admin-page" aria-hidden="true">
<div className="admin-toolbar mb-6">
<div>
<div className="skeleton h-9 w-44 rounded-md mb-2" />
<div className="skeleton h-4 w-80 rounded-sm" />
</div>
<div className="skeleton h-9 w-56 rounded-md" />
</div>
<div className="card overflow-hidden p-0">
<div className="admin-table-wrap">
<table className="w-full border-collapse">
<thead>
<tr className="bg-secondary">
{["Admin", "Action", "Entity", "Details", "IP", "Timestamp"].map((col) => (
<th key={col} className="text-left border-b border-card p-4">
<div className={`skeleton h-3 rounded-sm ${col === "Details" ? "w-14" : "w-10"}`} />
</th>
))}
</tr>
</thead>
<tbody>
{Array.from({ length: 10 }).map((_, i) => (
<tr key={i} className="border-b border-card">
<td className="p-card">
<div className="skeleton h-4 w-32 rounded-sm mb-1" />
<div className="skeleton h-3 w-40 rounded-sm" />
</td>
<td className="p-card"><div className="skeleton h-6 w-28 rounded-md" /></td>
<td className="p-card"><div className="skeleton h-4 w-20 rounded-sm" /></td>
<td className="p-card"><div className="skeleton h-4 w-48 rounded-sm" /></td>
<td className="p-card"><div className="skeleton h-4 w-28 rounded-sm" /></td>
<td className="p-card"><div className="skeleton h-4 w-32 rounded-sm" /></td>
</tr>
))}
</tbody>
</table>
</div>
</div>
</div>
);
}
