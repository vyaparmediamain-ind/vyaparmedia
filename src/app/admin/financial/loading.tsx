/**
* Route-level Suspense skeleton for Admin Financial Overview.
* Mirrors: header + 4 metric cards + treasury/escrow sections + deal stats + export section.
*/
export default function AdminFinancialLoading() {
return (
<div className="admin-page" aria-hidden="true">
{/* Header */}
<div className="mb-8">
<div className="skeleton h-9 w-64 rounded-md mb-2" />
<div className="skeleton h-4 w-96 rounded-sm" />
</div>

{/* 4 overview metric cards */}
<div className="grid gap-6 mb-8 grid-auto-240">
{[1, 2, 3, 4].map((i) => (
<div key={i} className="card p-6 border-l-4 border-card">
<div className="skeleton h-3 w-40 rounded-sm mb-3" />
<div className="skeleton h-8 w-32 rounded-md mb-2" />
<div className="skeleton h-3 w-28 rounded-sm" />
</div>
))}
</div>

{/* Treasury + Escrow sections */}
<div className="grid gap-6 mb-8 grid-auto-360">
{[1, 2].map((i) => (
<div key={i} className="card p-6">
<div className="skeleton h-5 w-56 rounded-md mb-5" />
{[1, 2, 3].map((j) => (
<div key={j} className="flex justify-between border-b border-card pb-3 mb-3">
<div className="skeleton h-4 w-52 rounded-sm" />
<div className="skeleton h-4 w-24 rounded-sm" />
</div>
))}
</div>
))}
</div>

{/* Deal stats + refunds */}
<div className="grid gap-6 mb-6 grid-auto-360">
{[1, 2].map((i) => (
<div key={i} className="card p-6">
<div className="skeleton h-5 w-48 rounded-md mb-5" />
<div className="grid gap-4 grid-cols-2">
{[1, 2, 3, 4, 5, 6].map((j) => (
<div key={j}>
<div className="skeleton h-3 w-28 rounded-sm mb-2" />
<div className="skeleton h-7 w-16 rounded-md" />
</div>
))}
</div>
</div>
))}
</div>

{/* Export section */}
<div className="card p-6">
<div className="skeleton h-5 w-52 rounded-md mb-3" />
<div className="skeleton h-4 w-full rounded-sm mb-5" />
<div className="flex gap-4">
<div className="skeleton h-10 w-56 rounded-md" />
<div className="skeleton h-10 w-52 rounded-md" />
</div>
</div>
</div>
);
}
