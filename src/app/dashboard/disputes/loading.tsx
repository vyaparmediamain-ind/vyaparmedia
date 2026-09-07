/**
* Route-level Suspense skeleton for dashboard Disputes page.
*/
export default function DashboardDisputesLoading() {
return (
<div className="flex-1 p-6" aria-hidden="true">
<div className="mb-6">
<div className="skeleton h-8 w-40 rounded-md mb-2" />
<div className="skeleton h-4 w-64 rounded-sm" />
</div>
<div className="grid gap-4">
{[1, 2, 3, 4].map((i) => (
<div key={i} className="card p-5">
<div className="flex justify-between items-start gap-4 mb-3">
<div className="flex-1">
<div className="skeleton h-5 w-56 rounded-sm mb-2" />
<div className="skeleton h-3.5 w-44 rounded-sm" />
</div>
<div className="skeleton h-6 w-24 rounded-md" />
</div>
<div className="skeleton h-3.5 w-full rounded-sm mb-1" />
<div className="skeleton h-3.5 w-4/5 rounded-sm mb-4" />
<div className="flex gap-2 justify-end">
<div className="skeleton h-9 w-28 rounded-md" />
</div>
</div>
))}
</div>
</div>
);
}
