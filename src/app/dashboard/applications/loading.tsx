/**
* Route-level Suspense skeleton for dashboard Applications page.
* Mirrors: page header + data table with 5 columns.
*/
export default function ApplicationsLoading() {
return (
<div className="flex-1 p-6" aria-hidden="true">
<div className="max-w-1000 mx-auto">
{/* Page header */}
<div className="mb-8">
<div className="skeleton h-8 w-48 rounded-md mb-2" />
<div className="skeleton h-4 w-80 rounded-sm" />
</div>
{/* Table */}
<div className="card overflow-hidden p-0">
<div className="overflow-x-auto w-full">
<table className="w-full border-collapse min-w-600" style={{ minWidth: "600px" }}>
<thead>
<tr className="border-b border-card bg-tertiary">
{["CAMPAIGN", "PROPOSED RATE", "SUBMITTED ON", "STATUS", "ACTION"].map((col) => (
<th key={col} className="p-4">
<div className={`skeleton h-3 rounded-sm ${col === "CAMPAIGN" ? "w-20" : "w-14"}`} />
</th>
))}
</tr>
</thead>
<tbody>
{[1, 2, 3, 4, 5, 6, 7].map((i) => (
<tr key={i} className="border-b border-card">
<td className="p-4">
<div className="flex items-center gap-3">
<div className="skeleton rounded-sm flex-shrink-0 w-9 h-9" />
<div>
<div className="skeleton h-4 w-40 rounded-sm mb-1" />
<div className="skeleton h-3 w-28 rounded-sm" />
</div>
</div>
</td>
<td className="p-4"><div className="skeleton h-4 w-20 rounded-sm" /></td>
<td className="p-4"><div className="skeleton h-4 w-24 rounded-sm" /></td>
<td className="p-4"><div className="skeleton h-6 w-20 rounded-md" /></td>
<td className="p-4 text-right"><div className="skeleton h-8 w-28 rounded-md ml-auto" /></td>
</tr>
))}
</tbody>
</table>
</div>
</div>
</div>
</div>
);
}
