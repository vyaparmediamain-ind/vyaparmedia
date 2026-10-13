import { PageContainer } from "@/components/ui";

export default function CampaignsLoading() {
  return (
    <PageContainer maxWidth="7xl" className="space-y-6 animate-pulse py-4 sm:py-6" aria-hidden="true">
      {/* Header skeleton */}
      <div className="space-y-2 border-b border-border pb-5">
        <div className="h-8 w-48 bg-muted rounded-xl" />
        <div className="h-4 w-72 bg-muted rounded-md" />
      </div>

      {/* Filter toolbar skeleton */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="h-10 flex-1 bg-muted/60 rounded-xl" />
        <div className="h-10 sm:w-56 bg-muted/60 rounded-xl" />
      </div>

      {/* Category pills skeleton */}
      <div className="flex gap-2 overflow-x-auto pb-1.5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-8 w-24 bg-muted/50 rounded-xl shrink-0" />
        ))}
      </div>

      {/* Campaign card grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-muted shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="w-24 h-3.5 bg-muted rounded" />
                <div className="w-40 h-4 bg-muted rounded" />
              </div>
              <div className="w-16 h-6 bg-muted rounded-full" />
            </div>
            <div className="h-10 bg-muted/60 rounded" />
            <div className="flex gap-2">
              <div className="w-16 h-5 bg-muted rounded" />
              <div className="w-20 h-5 bg-muted rounded" />
            </div>
            <div className="h-16 bg-muted/40 rounded-xl" />
            <div className="flex justify-between items-center pt-2">
              <div className="w-24 h-4 bg-muted rounded" />
              <div className="w-24 h-8 bg-muted rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </PageContainer>
  );
}
