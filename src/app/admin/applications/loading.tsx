/**
* Route-level Suspense skeleton for Admin Applications page.
*/
export default function AdminApplicationsLoading() {
return (
<div className="admin-page" aria-hidden="true">
<div className="admin-toolbar mb-6">
<div>
<div className="skeleton h-9 w-52 rounded-md mb-2" />
<div className="skeleton h-4 w-80 rounded-sm" />
</div>
<div className="skeleton h-9 w-48 rounded-md" />
</div>
<div className="card overflow-hidden p-0">
<div className="admin-table-wrap">
<table className="w-full border-collapse">
<thead>
<tr className="bg-secondary">
{["Influencer", "Campaign", "Proposed Rate", "Status", "Date", "Action"].map((col) => (
<th key={col} className="text-left border-b border-card p-4">
<div className={`skeleton h-3 rounded-sm ${col === "Campaign" ? "w-16" : "w-12"}`} />
</th>
))}
</tr>
</thead>
<tbody>
{Array.from({ length: 8 }).map((_, i) => (
<tr key={i} className="border-b border-card">
<td className="p-card">
<div className="skeleton h-4 w-36 rounded-sm mb-1" />
<div className="skeleton h-3 w-44 rounded-sm" />
</td>
<td className="p-card"><div className="skeleton h-4 w-44 rounded-sm" /></td>
<td className="p-card"><div className="skeleton h-4 w-20 rounded-sm" /></td>
<td className="p-card"><div className="skeleton h-6 w-24 rounded-md" /></td>
<td className="p-card"><div className="skeleton h-4 w-20 rounded-sm" /></td>
<td className="p-card"><div className="skeleton h-8 w-24 rounded-md" /></td>
</tr>
))}
</tbody>
</table>
</div>
</div>
</div>
);
}
