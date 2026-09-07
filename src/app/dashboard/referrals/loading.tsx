/**
* Route-level Suspense skeleton for dashboard Referrals page.
*/
export default function ReferralsLoading() {
return (
<div className="flex-1 p-6" aria-hidden="true">
<div className="mb-6">
<div className="skeleton h-8 w-36 rounded-md mb-2" />
<div className="skeleton h-4 w-64 rounded-sm" />
</div>
{/* Referral code card */}
<div className="card p-6 mb-6">
<div className="skeleton h-4 w-40 rounded-sm mb-3" />
<div className="flex gap-3">
<div className="skeleton h-10 flex-1 rounded-md" />
<div className="skeleton h-10 w-24 rounded-md" />
</div>
</div>
{/* Stats */}
<div className="grid gap-4 mb-6 grid-cols-3">
{[1, 2, 3].map((i) => (
<div key={i} className="card p-5">
<div className="skeleton h-3 w-24 rounded-sm mb-2" />
<div className="skeleton h-7 w-16 rounded-md" />
</div>
))}
</div>
{/* Referrals list */}
<div className="card p-6">
<div className="skeleton h-5 w-36 rounded-md mb-5" />
{[1, 2, 3, 4].map((i) => (
<div key={i} className="flex justify-between items-center border-b border-card py-3">
<div className="flex items-center gap-3">
<div className="skeleton rounded-full w-8 h-8" />
<div className="skeleton h-4 w-36 rounded-sm" />
</div>
<div className="skeleton h-6 w-20 rounded-md" />
</div>
))}
</div>
</div>
);
}
