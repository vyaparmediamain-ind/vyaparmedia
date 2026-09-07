/**
* Route-level Suspense skeleton for dashboard Wallet page.
* Mirrors: balance hero + tabs + transactions list.
*/
export default function WalletLoading() {
return (
<div className="flex-1 p-6" aria-hidden="true">
{/* Balance hero card */}
<div className="card p-8 mb-6 text-center">
<div className="skeleton h-4 w-32 rounded-sm mb-3 mx-auto" />
<div className="skeleton h-12 w-48 rounded-md mb-2 mx-auto" />
<div className="skeleton h-3.5 w-40 rounded-sm mb-6 mx-auto" />
<div className="flex gap-4 justify-center">
<div className="skeleton h-10 w-36 rounded-md" />
<div className="skeleton h-10 w-36 rounded-md" />
</div>
</div>

{/* Stats row */}
<div className="grid gap-4 mb-6 grid-cols-3">
{[1, 2, 3].map((i) => (
<div key={i} className="card p-5">
<div className="skeleton h-3 w-24 rounded-sm mb-2" />
<div className="skeleton h-7 w-32 rounded-md" />
</div>
))}
</div>

{/* Transactions section */}
<div className="card p-6">
<div className="skeleton h-5 w-40 rounded-md mb-5" />
{[1, 2, 3, 4, 5, 6].map((i) => (
<div key={i} className="flex justify-between items-center border-b border-card py-4">
<div className="flex items-center gap-3">
<div className="skeleton rounded-full flex-shrink-0 w-9 h-9" />
<div>
<div className="skeleton h-4 w-40 rounded-sm mb-1.5" />
<div className="skeleton h-3 w-28 rounded-sm" />
</div>
</div>
<div className="skeleton h-5 w-20 rounded-sm" />
</div>
))}
</div>
</div>
);
}
