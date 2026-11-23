/**
 * Route-level Suspense skeleton for Admin Campaign Operations Audit.
 */
export default function AdminCampaignLoading() {
  return (
    <div className="max-w-7xl mx-auto space-y-6 py-4" aria-hidden="true">
      {/* Page header */}
      <div className="space-y-2">
        <div className="h-8 w-72 bg-muted rounded-xl animate-pulse" />
        <div className="h-4 w-96 bg-muted rounded-md animate-pulse" />
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-5 rounded-2xl bg-card border border-border space-y-3 animate-pulse"
          >
            <div className="h-3 w-28 bg-muted rounded" />
            <div className="h-8 w-36 bg-muted rounded-md" />
            <div className="h-3 w-20 bg-muted rounded" />
          </div>
        ))}
      </div>

      {/* Section Blocks */}
      <div className="space-y-6">
        <div className="p-6 rounded-2xl bg-card border border-border space-y-4 animate-pulse">
          <div className="h-5 w-48 bg-muted rounded" />
          <div className="h-32 w-full bg-muted/40 rounded-xl" />
        </div>
        <div className="p-6 rounded-2xl bg-card border border-border space-y-4 animate-pulse">
          <div className="h-5 w-48 bg-muted rounded" />
          <div className="h-32 w-full bg-muted/40 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
