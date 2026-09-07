/**
* Route-level Suspense skeleton for dashboard Campaigns page.
* Mirrors: page header + filter toolbar + campaign card grid.
*/
export default function CampaignsLoading() {
return (
<div className="flex-1 p-6" aria-hidden="true">
{/* Page header */}
<div className="mb-6">
<div className="skeleton h-8 w-44 rounded-md mb-2" />
<div className="skeleton h-4 w-72 rounded-sm" />
</div>
{/* Filter toolbar */}
<div className="flex gap-3 mb-6">
<div className="skeleton h-9 w-32 rounded-md" />
<div className="skeleton h-9 w-32 rounded-md" />
<div className="skeleton h-9 flex-1 rounded-md max-w-280" />
</div>
{/* Campaign cards */}
<div className="grid gap-5 grid-auto-360">
{[1, 2, 3, 4, 5, 6].map((i) => (
<div key={i} className="card p-5">
<div className="skeleton h-40 rounded-md mb-4" />
<div className="skeleton h-5 w-3/4 rounded-sm mb-2" />
<div className="skeleton h-3.5 w-1/2 rounded-sm mb-4" />
<div className="flex justify-between items-center">
<div className="skeleton h-6 w-20 rounded-md" />
<div className="skeleton h-9 w-28 rounded-md" />
</div>
</div>
))}
</div>
</div>
);
}
