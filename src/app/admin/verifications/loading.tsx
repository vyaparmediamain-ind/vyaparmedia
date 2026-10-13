/**
 * Route-level Suspense skeleton for Admin Verifications page.
 */
export default function AdminVerificationsLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-6" aria-hidden="true">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-8 w-56 bg-muted rounded-xl animate-pulse" />
        <div className="h-4 w-80 bg-muted rounded-md animate-pulse" />
      </div>

      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-card border border-border animate-pulse"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-muted" />
              <div className="space-y-1.5">
                <div className="h-4 w-40 bg-muted rounded" />
                <div className="h-3 w-56 bg-muted rounded" />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-8 w-24 bg-muted rounded-lg" />
              <div className="h-8 w-20 bg-muted rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
