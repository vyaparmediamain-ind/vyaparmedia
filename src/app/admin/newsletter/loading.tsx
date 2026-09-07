/**
* Route-level Suspense skeleton for Admin Newsletter page.
*/
export default function AdminNewsletterLoading() {
return (
<div className="admin-page" aria-hidden="true">
<div className="mb-6">
<div className="skeleton h-9 w-44 rounded-md mb-2" />
<div className="skeleton h-4 w-72 rounded-sm" />
</div>
{/* Compose card */}
<div className="card p-6 mb-6">
<div className="skeleton h-5 w-48 rounded-md mb-5" />
<div className="skeleton h-10 w-full rounded-md mb-4" />
<div className="skeleton h-40 w-full rounded-md mb-4" />
<div className="flex gap-3">
<div className="skeleton h-10 w-36 rounded-md" />
<div className="skeleton h-10 w-28 rounded-md" />
</div>
</div>
{/* Subscribers list */}
<div className="card p-6">
<div className="skeleton h-5 w-40 rounded-md mb-5" />
{Array.from({ length: 6 }).map((_, i) => (
<div key={i} className="flex justify-between items-center border-b border-card py-3">
<div className="skeleton h-4 w-52 rounded-sm" />
<div className="skeleton h-4 w-24 rounded-sm" />
</div>
))}
</div>
</div>
);
}
