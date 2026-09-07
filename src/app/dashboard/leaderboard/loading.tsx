/**
* Route-level Suspense skeleton for dashboard Leaderboard page.
*/
export default function LeaderboardLoading() {
return (
<div className="flex-1 p-6" aria-hidden="true">
<div className="mb-6">
<div className="skeleton h-8 w-44 rounded-md mb-2" />
<div className="skeleton h-4 w-72 rounded-sm" />
</div>
{/* Top 3 podium placeholders */}
<div className="flex justify-center gap-4 mb-8">
{["w-14 h-14", "w-[72px] h-[72px]", "w-14 h-14"].map((sizeClass, i) => (
<div key={i} className="flex flex-col items-center gap-2">
<div className={`skeleton rounded-full ${sizeClass}`} />
<div className="skeleton h-4 w-24 rounded-sm" />
<div className="skeleton h-3.5 w-16 rounded-sm" />
</div>
))}
</div>
{/* Ranked list */}
<div className="card p-0 overflow-hidden">
{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
<div key={i} className="flex items-center gap-4 p-4 border-b border-card">
<div className="skeleton h-5 w-8 rounded-sm flex-shrink-0" />
<div className="skeleton rounded-full flex-shrink-0 w-10 h-10" />
<div className="flex-1">
<div className="skeleton h-4 w-36 rounded-sm mb-1.5" />
<div className="skeleton h-3 w-24 rounded-sm" />
</div>
<div className="skeleton h-5 w-16 rounded-sm" />
</div>
))}
</div>
</div>
);
}
