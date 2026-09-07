/**
* Route-level Suspense skeleton for Admin Users page.
* Mirrors: search toolbar + status filter + user table with 7 columns.
*/
export default function AdminUsersLoading() {
return (
<div className="admin-page" aria-hidden="true">
{/* Header + toolbar */}
<div className="admin-toolbar mb-6">
<div>
<div className="skeleton h-9 w-40 rounded-md mb-2" />
<div className="skeleton h-4 w-64 rounded-sm" />
</div>
<div className="flex gap-3 flex-wrap">
<div className="skeleton h-9 w-56 rounded-md" />
<div className="skeleton h-9 w-40 rounded-md" />
<div className="skeleton h-9 w-40 rounded-md" />
</div>
</div>
{/* Table */}
<div className="card overflow-hidden p-0">
<div className="admin-table-wrap">
<table className="w-full border-collapse">
<thead>
<tr className="bg-secondary">
{["User", "Type", "Status", "Joined", "Trust", "Badges", "Actions"].map((col) => (
<th key={col} className="text-left border-b border-card p-4">
<div className={`skeleton h-3 rounded-sm ${col === "User" ? "w-10" : "w-14"}`} />
</th>
))}
</tr>
</thead>
<tbody>
{Array.from({ length: 8 }).map((_, i) => (
<tr key={i} className="border-b border-card">
<td className="p-card">
<div className="flex items-center gap-3">
<div className="skeleton rounded-full flex-shrink-0 w-9 h-9" />
<div>
<div className="skeleton h-4 w-36 rounded-sm mb-1" />
<div className="skeleton h-3 w-44 rounded-sm" />
</div>
</div>
</td>
<td className="p-card"><div className="skeleton h-6 w-20 rounded-md" /></td>
<td className="p-card"><div className="skeleton h-6 w-24 rounded-md" /></td>
<td className="p-card"><div className="skeleton h-4 w-20 rounded-sm" /></td>
<td className="p-card"><div className="skeleton h-4 w-12 rounded-sm" /></td>
<td className="p-card"><div className="skeleton h-4 w-16 rounded-sm" /></td>
<td className="p-card">
<div className="flex gap-2">
<div className="skeleton h-8 w-16 rounded-md" />
<div className="skeleton h-8 w-20 rounded-md" />
</div>
</td>
</tr>
))}
</tbody>
</table>
</div>
</div>
</div>
);
}
