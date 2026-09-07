/**
* Route-level Suspense skeleton for dashboard Deals page.
* Mirrors: page header + filter tabs + deal card list.
*/
export default function DealsLoading() {
return (
<div className="flex-1 p-6" aria-hidden="true">
<div className="mb-6">
<div className="skeleton h-8 w-32 rounded-md mb-2" />
<div className="skeleton h-4 w-60 rounded-sm" />
</div>
<div className="flex gap-2 mb-6">
{[1, 2, 3, 4].map((i) => (
<div key={i} className="skeleton h-9 w-28 rounded-md" />
))}
</div>
<div className="grid gap-4">
{[1, 2, 3, 4, 5].map((i) => (
<div key={i} className="card p-5 flex justify-between items-center gap-4 flex-wrap">
<div className="flex items-center gap-4 flex-1">
<div className="skeleton rounded-full flex-shrink-0 w-12 h-12" />
<div className="flex-1">
<div className="skeleton h-5 w-56 rounded-sm mb-2" />
<div className="skeleton h-3.5 w-40 rounded-sm mb-2" />
<div className="flex gap-2">
<div className="skeleton h-5 w-20 rounded-md" />
<div className="skeleton h-5 w-24 rounded-md" />
</div>
</div>
</div>
<div className="skeleton h-9 w-28 rounded-md" />
</div>
))}
</div>
</div>
);
}
