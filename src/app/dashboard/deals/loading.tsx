import { PageContainer } from "@/components/ui";

export default function DealsLoading() {
  return (
    <PageContainer maxWidth="7xl" className="space-y-6 animate-pulse py-4 sm:py-6" aria-hidden="true">
      {/* Header skeleton */}
      <div className="space-y-2 border-b border-border pb-5">
        <div className="h-8 w-48 bg-muted rounded-xl" />
        <div className="h-4 w-72 bg-muted rounded-md" />
      </div>

      {/* Metrics skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-card border border-border p-5 flex flex-col justify-between">
            <div className="w-24 h-4 bg-muted rounded" />
            <div className="w-32 h-8 bg-muted rounded" />
            <div className="w-40 h-3 bg-muted rounded" />
          </div>
        ))}
      </div>

      {/* Filter skeleton */}
      <div className="h-10 bg-muted/60 rounded-xl" />

      {/* Card list skeleton */}
      <div className="space-y-3.5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-full bg-muted shrink-0" />
              <div className="space-y-2">
                <div className="w-48 h-4 bg-muted rounded" />
                <div className="w-32 h-3 bg-muted rounded" />
              </div>
            </div>
            <div className="w-32 h-9 bg-muted rounded-xl" />
          </div>
        ))}
      </div>
    </PageContainer>
  );
}
