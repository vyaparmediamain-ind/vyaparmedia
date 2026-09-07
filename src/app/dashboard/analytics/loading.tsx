/**
* Route-level Suspense skeleton for dashboard Analytics page.
*/
export default function DashboardAnalyticsLoading() {
return (
<div className="flex-1 p-6" aria-hidden="true">
<div className="mb-6">
<div className="skeleton h-8 w-40 rounded-md mb-2" />
<div className="skeleton h-4 w-72 rounded-sm" />
</div>
{/* Stat cards */}
<div className="grid gap-5 mb-6 grid-auto-240">
{[1, 2, 3, 4].map((i) => (
<div key={i} className="card p-6">
<div className="skeleton h-3 w-24 rounded-sm mb-3" />
<div className="skeleton h-8 w-28 rounded-md mb-2" />
<div className="skeleton h-3 w-20 rounded-sm" />
</div>
))}
</div>
{/* Chart areas */}
<div className="grid gap-5 grid-auto-360">
<div className="card p-6">
<div className="skeleton h-5 w-36 rounded-md mb-5" />
<div className="skeleton rounded-md h-200" />
</div>
<div className="card p-6">
<div className="skeleton h-5 w-32 rounded-md mb-5" />
<div className="skeleton rounded-md h-200" />
</div>
</div>
</div>
);
}
