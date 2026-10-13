/**
 * Route-level Suspense skeleton for Admin Financial Overview.
 */
export default function AdminFinancialLoading() {
  return (
    <div className="max-w-6xl mx-auto space-y-6" aria-hidden="true">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-8 w-64 bg-muted rounded-xl animate-pulse" />
        <div className="h-4 w-96 bg-muted rounded-md animate-pulse" />
      </div>

      {/* 4 overview metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-5 rounded-2xl bg-card border border-border space-y-3 animate-pulse">
            <div className="h-3 w-32 bg-muted rounded" />
            <div className="h-8 w-28 bg-muted rounded-md" />
            <div className="h-3 w-24 bg-muted rounded" />
          </div>
        ))}
      </div>

      {/* Treasury + Escrow sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div key={i} className="p-6 rounded-2xl bg-card border border-border space-y-4 animate-pulse">
            <div className="h-5 w-44 bg-muted rounded" />
            <div className="space-y-3">
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-10 w-full bg-muted/40 rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
