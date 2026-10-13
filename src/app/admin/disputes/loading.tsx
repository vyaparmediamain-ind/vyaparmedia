/**
 * Route-level Suspense skeleton for Admin Disputes queue.
 */
export default function AdminDisputesLoading() {
  return (
    <div className="max-w-6xl mx-auto space-y-6" aria-hidden="true">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-8 w-56 bg-muted rounded-xl animate-pulse" />
        <div className="h-4 w-80 bg-muted rounded-md animate-pulse" />
      </div>

      {/* Tab buttons */}
      <div className="flex gap-2">
        <div className="h-9 w-36 bg-muted rounded-xl animate-pulse" />
        <div className="h-9 w-36 bg-muted rounded-xl animate-pulse" />
      </div>

      {/* Dispute card list */}
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between p-5 rounded-2xl bg-card border border-border animate-pulse"
          >
            <div className="space-y-2 flex-1 pr-4">
              <div className="h-5 w-48 bg-muted rounded" />
              <div className="h-3 w-72 bg-muted rounded" />
              <div className="flex gap-2 pt-1">
                <div className="h-5 w-16 bg-muted rounded" />
                <div className="h-5 w-24 bg-muted rounded" />
              </div>
            </div>
            <div className="h-9 w-24 bg-muted rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
