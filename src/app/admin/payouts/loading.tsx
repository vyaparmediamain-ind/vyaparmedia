/**
* Route-level Suspense skeleton for Admin Payouts page.
*/
export default function AdminPayoutsLoading() {
return (
<div className="admin-page" aria-hidden="true">
<div className="admin-toolbar mb-6">
<div>
<div className="skeleton h-9 w-44 rounded-md mb-2" />
<div className="skeleton h-4 w-72 rounded-sm" />
</div>
</div>
<div className="grid gap-4 mb-6 grid-auto-240">
{[1, 2, 3, 4].map((i) => (
<div key={i} className="card p-6">
<div className="skeleton h-3 w-28 rounded-sm mb-3" />
<div className="skeleton h-8 w-32 rounded-md" />
</div>
))}
</div>
<div className="card overflow-hidden p-0">
<div className="admin-table-wrap">
<table className="w-full border-collapse">
<thead>
<tr className="bg-secondary">
{["User", "Amount", "Method", "Status", "Date", "Action"].map((col) => (
<th key={col} className="text-left border-b border-card p-4">
<div className="skeleton h-3 w-16 rounded-sm" />
</th>
))}
</tr>
</thead>
<tbody>
{Array.from({ length: 7 }).map((_, i) => (
<tr key={i} className="border-b border-card">
<td className="p-card">
<div className="skeleton h-4 w-36 rounded-sm mb-1" />
<div className="skeleton h-3 w-44 rounded-sm" />
</td>
<td className="p-card"><div className="skeleton h-5 w-24 rounded-sm" /></td>
<td className="p-card"><div className="skeleton h-6 w-20 rounded-md" /></td>
<td className="p-card"><div className="skeleton h-6 w-20 rounded-md" /></td>
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
