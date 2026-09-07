/**
* Route-level Suspense skeleton for dashboard Settings page.
*/
export default function SettingsLoading() {
return (
<div className="flex-1 p-6" aria-hidden="true">
<div className="skeleton h-8 w-36 rounded-md mb-6" />
{/* Settings section cards */}
{[1, 2, 3].map((i) => (
<div key={i} className="card p-6 mb-5">
<div className="skeleton h-5 w-48 rounded-md mb-5" />
<div className="grid gap-4">
{[1, 2, 3].map((j) => (
<div key={j}>
<div className="skeleton h-3.5 w-32 rounded-sm mb-2" />
<div className="skeleton h-10 w-full rounded-md" />
</div>
))}
</div>
<div className="mt-5 flex justify-end">
<div className="skeleton h-9 w-28 rounded-md" />
</div>
</div>
))}
</div>
);
}
