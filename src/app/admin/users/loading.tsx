/**
 * Route-level Suspense skeleton for Admin Users page.
 */
export default function AdminUsersLoading() {
  return (
    <div className="max-w-6xl mx-auto space-y-6" aria-hidden="true">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-muted rounded-xl animate-pulse" />
          <div className="h-4 w-72 bg-muted rounded-md animate-pulse" />
        </div>
        <div className="h-12 w-44 bg-muted rounded-xl animate-pulse" />
      </div>

      {/* Filter toolbar skeleton */}
      <div className="p-4 rounded-2xl bg-card border border-border flex gap-3">
        <div className="h-10 flex-1 bg-muted rounded-lg animate-pulse" />
        <div className="h-10 w-36 bg-muted rounded-lg animate-pulse" />
        <div className="h-10 w-44 bg-muted rounded-lg animate-pulse" />
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden p-4 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={`skeleton-user-${i}`}
            className="flex items-center justify-between p-4 rounded-xl bg-muted/20 border border-border/40 animate-pulse"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted" />
              <div className="space-y-1.5">
                <div className="h-4 w-36 bg-muted rounded" />
                <div className="h-3 w-48 bg-muted rounded" />
              </div>
            </div>
            <div className="h-6 w-20 bg-muted rounded" />
            <div className="h-6 w-20 bg-muted rounded hidden sm:block" />
            <div className="h-8 w-24 bg-muted rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
