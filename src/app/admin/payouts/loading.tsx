/**
 * Route-level Suspense skeleton for Admin Payouts page.
 */
export default function AdminPayoutsLoading() {
  return (
    <div className="max-w-6xl mx-auto space-y-6" aria-hidden="true">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-56 bg-muted rounded-xl animate-pulse" />
          <div className="h-4 w-80 bg-muted rounded-md animate-pulse" />
        </div>
        <div className="h-12 w-48 bg-muted rounded-xl animate-pulse" />
      </div>

      {/* Filter chips skeleton */}
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-8 w-20 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>

      {/* Table Skeleton */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden p-4 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={`skeleton-payout-${i}`}
            className="flex items-center justify-between p-4 rounded-xl bg-muted/20 border border-border/40 animate-pulse"
          >
            <div className="space-y-2">
              <div className="h-4 w-40 bg-muted rounded" />
              <div className="h-3 w-28 bg-muted rounded" />
            </div>
            <div className="h-5 w-24 bg-muted rounded" />
            <div className="h-5 w-32 bg-muted rounded hidden sm:block" />
            <div className="h-8 w-20 bg-muted rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
