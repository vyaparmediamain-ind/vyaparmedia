/**
 * Route-level Suspense skeleton for Admin Violations table.
 */
export default function AdminViolationsLoading() {
  return (
    <div className="max-w-6xl mx-auto space-y-6" aria-hidden="true">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-8 w-56 bg-muted rounded-xl animate-pulse" />
        <div className="h-4 w-80 bg-muted rounded-md animate-pulse" />
      </div>

      {/* Filter toolbar skeleton */}
      <div className="p-4 rounded-2xl bg-card border border-border">
        <div className="h-10 w-full sm:w-80 bg-muted rounded-lg animate-pulse" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden p-4 space-y-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-4 rounded-xl bg-muted/20 border border-border/40 animate-pulse"
          >
            <div className="space-y-1.5">
              <div className="h-4 w-32 bg-muted rounded" />
              <div className="h-3 w-40 bg-muted rounded" />
            </div>
            <div className="h-4 w-28 bg-muted rounded hidden sm:block" />
            <div className="h-6 w-20 bg-muted rounded" />
            <div className="h-6 w-24 bg-muted rounded" />
            <div className="h-4 w-20 bg-muted rounded hidden md:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
