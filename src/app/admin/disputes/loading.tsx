/**
* Route-level Suspense skeleton for Admin Disputes queue.
* Mirrors: header + toolbar + tab buttons + list of dispute cards.
*/
export default function AdminDisputesLoading() {
return (
<div className="admin-page" aria-hidden="true">
{/* Header */}
<div className="admin-toolbar mb-6">
<div>
<div className="skeleton h-9 w-72 rounded-md mb-2" />
<div className="skeleton h-4 w-80 rounded-sm" />
</div>
</div>

{/* Tab buttons */}
<div className="flex gap-2 mb-6">
<div className="skeleton h-9 w-36 rounded-md" />
<div className="skeleton h-9 w-36 rounded-md" />
</div>

{/* Dispute card list */}
<div className="grid gap-4">
{[1, 2, 3, 4, 5].map((i) => (
<div key={i} className="card flex justify-between items-center gap-4 flex-wrap bg-secondary border-card rounded-lg px-6-py-4">
<div className="flex-1">
<div className="skeleton h-4 w-56 rounded-sm mb-2" />
<div className="skeleton h-3 w-72 rounded-sm mb-3" />
<div className="flex gap-2">
<div className="skeleton h-5 w-20 rounded-sm" />
<div className="skeleton h-5 w-24 rounded-sm" />
<div className="skeleton h-5 w-28 rounded-sm" />
</div>
</div>
<div className="skeleton h-9 w-24 rounded-md" />
</div>
))}
</div>
</div>
);
}
