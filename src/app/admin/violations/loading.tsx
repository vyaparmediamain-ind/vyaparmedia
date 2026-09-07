/**
* Route-level Suspense skeleton for Admin Violations table.
* Mirrors: header + table with 7 columns.
*/
export default function AdminViolationsLoading() {
return (
<div className="admin-page" aria-hidden="true">
{/* Header */}
<div className="admin-toolbar mb-6">
<div>
<div className="skeleton h-9 w-52 rounded-md mb-2" />
<div className="skeleton h-4 w-72 rounded-sm" />
</div>
</div>

{/* Table skeleton */}
<div className="card overflow-hidden p-0">
<div className="admin-table-wrap">
<table className="w-full border-collapse">
<thead>
<tr className="bg-secondary">
{["User", "Type", "Severity", "Action", "Description", "Date", "Expires"].map((col) => (
<th key={col} className="text-left border-b border-card p-4">
<div className={`skeleton h-3 rounded-sm ${col === "Description" ? "w-20" : "w-12"}`} />
</th>
))}
</tr>
</thead>
<tbody>
{[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
<tr key={i} className="border-b border-card">
{/* User */}
<td className="p-card">
<div className="skeleton h-4 w-32 rounded-sm mb-1" />
<div className="skeleton h-3 w-40 rounded-sm" />
</td>
{/* Type */}
<td className="p-card">
<div className="skeleton h-4 w-28 rounded-sm" />
</td>
{/* Severity */}
<td className="p-card">
<div className="skeleton h-6 w-20 rounded-lg" />
</td>
{/* Action */}
<td className="p-card">
<div className="skeleton h-6 w-24 rounded-md" />
</td>
{/* Description */}
<td className="p-card">
<div className="skeleton h-4 w-48 rounded-sm" />
</td>
{/* Date */}
<td className="p-card">
<div className="skeleton h-4 w-20 rounded-sm" />
</td>
{/* Expires */}
<td className="p-card">
<div className="skeleton h-4 w-16 rounded-sm" />
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
