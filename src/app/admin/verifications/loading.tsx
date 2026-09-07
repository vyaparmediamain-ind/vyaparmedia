/**
* Route-level Suspense skeleton for Admin Verifications page.
*/
export default function AdminVerificationsLoading() {
return (
<div className="admin-page" aria-hidden="true">
<div className="admin-toolbar mb-6">
<div>
<div className="skeleton h-9 w-52 rounded-md mb-2" />
<div className="skeleton h-4 w-80 rounded-sm" />
</div>
</div>
<div className="grid gap-5">
{Array.from({ length: 4 }).map((_, i) => (
<div key={i} className="card p-6">
<div className="flex justify-between items-start gap-4 mb-4">
<div className="flex items-center gap-4">
<div className="skeleton rounded-full flex-shrink-0 w-12 h-12" />
<div>
<div className="skeleton h-5 w-44 rounded-sm mb-2" />
<div className="skeleton h-3 w-56 rounded-sm" />
</div>
</div>
<div className="skeleton h-6 w-24 rounded-md" />
</div>
<div className="grid gap-3 grid-cols-3">
{[1, 2, 3].map((j) => (
<div key={j}>
<div className="skeleton h-3 w-24 rounded-sm mb-1.5" />
<div className="skeleton h-4 w-32 rounded-sm" />
</div>
))}
</div>
<div className="flex gap-3 mt-4 justify-end">
<div className="skeleton h-9 w-28 rounded-md" />
<div className="skeleton h-9 w-28 rounded-md" />
</div>
</div>
))}
</div>
</div>
);
}
