/**
* Route-level Suspense skeleton for dashboard Messages page.
* Mirrors: conversation sidebar + chat panel layout.
*/
export default function MessagesLoading() {
return (
<div className="flex-1 p-6" aria-hidden="true">
<div className="flex flex-1 overflow-hidden card p-0" style={{ height: "calc(100vh - 120px)" }} aria-hidden="true">
{/* Conversations sidebar */}
<div className="flex flex-col border-r border-r-card flex-shrink-0 w-80">
<div className="p-4 border-b border-card">
<div className="skeleton h-9 w-full rounded-md" />
</div>
<div className="flex flex-col gap-1 p-2">
{[1, 2, 3, 4, 5, 6, 7].map((i) => (
<div key={i} className="flex items-center gap-3 p-3 rounded-md">
<div className="skeleton rounded-full flex-shrink-0 w-10 h-10" />
<div className="flex-1">
<div className="skeleton h-4 w-28 rounded-sm mb-1.5" />
<div className="skeleton h-3 w-40 rounded-sm" />
</div>
</div>
))}
</div>
</div>

{/* Chat panel placeholder */}
<div className="flex-1 flex flex-col items-center justify-center gap-4">
<div className="skeleton rounded-full w-14 h-14" />
<div className="skeleton h-5 w-48 rounded-sm" />
<div className="skeleton h-3.5 w-64 rounded-sm" />
</div>
</div>
</div>
);
}
