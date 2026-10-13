/**
 * Route-level Suspense skeleton for Admin Newsletter page.
 */
export default function AdminNewsletterLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-6" aria-hidden="true">
      <div className="space-y-2">
        <div className="h-8 w-48 bg-muted rounded-xl animate-pulse" />
        <div className="h-4 w-72 bg-muted rounded-md animate-pulse" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-5 rounded-2xl bg-card border border-border space-y-2 animate-pulse">
            <div className="h-3 w-28 bg-muted rounded" />
            <div className="h-8 w-16 bg-muted rounded-md" />
          </div>
        ))}
      </div>

      <div className="p-6 rounded-2xl bg-card border border-border space-y-4 animate-pulse">
        <div className="h-10 w-full bg-muted rounded-xl" />
        <div className="h-40 w-full bg-muted rounded-xl" />
        <div className="h-11 w-full bg-muted rounded-xl" />
      </div>
    </div>
  );
}
