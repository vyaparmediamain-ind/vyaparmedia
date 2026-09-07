/**
* Route-level Suspense skeleton for Admin Analytics.
* Mirrors the page layout: header + 4 stat cards + chart area.
*/
export default function AdminAnalyticsLoading() {
return (
<div className="admin-page" aria-hidden="true">
{/* Page header */}
<div className="mb-10">
<div className="skeleton h-9 w-64 rounded-md mb-3" />
<div className="skeleton h-4 w-80 rounded-sm" />
</div>

{/* Stat cards grid */}
<div className="grid gap-6 mb-8 grid-auto-240">
{[1, 2, 3, 4].map((i) => (
<div key={i} className="card p-6">
<div className="skeleton h-3 w-24 rounded-sm mb-3" />
<div className="skeleton h-8 w-32 rounded-md mb-2" />
<div className="skeleton h-3 w-20 rounded-sm" />
</div>
))}
</div>

{/* Chart area */}
<div className="grid gap-6 grid-auto-360">
<div className="card p-6">
<div className="skeleton h-5 w-40 rounded-md mb-5" />
<div className="skeleton rounded-md h-220" />
</div>
<div className="card p-6">
<div className="skeleton h-5 w-36 rounded-md mb-5" />
{[1, 2, 3, 4, 5].map((i) => (
<div key={i} className="flex items-center gap-3 mb-4">
<div className="skeleton rounded-full flex-shrink-0 w-9 h-9" />
<div className="flex-1">
<div className="skeleton h-3.5 rounded-sm mb-2 w-3/4" />
<div className="skeleton h-3 rounded-sm w-1/2" />
</div>
<div className="skeleton h-3.5 w-16 rounded-sm" />
</div>
))}
</div>
</div>
</div>
);
}
