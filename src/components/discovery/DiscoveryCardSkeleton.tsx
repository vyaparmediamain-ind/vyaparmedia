import React from "react";

export default function DiscoveryCardSkeleton() {
  return (
    <article
      aria-hidden="true"
      className="w-full rounded-2xl border border-border/80 bg-card overflow-hidden shadow-sm animate-pulse flex flex-col mb-6"
    >
      {/* Card Header Skeleton */}
      <div className="flex items-center justify-between p-4 border-b border-border/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-muted shrink-0" />
          <div className="space-y-1.5">
            <div className="w-28 h-3.5 bg-muted rounded-md" />
            <div className="w-16 h-2.5 bg-muted/80 rounded-md" />
          </div>
        </div>
        <div className="w-6 h-6 rounded-full bg-muted/70" />
      </div>

      {/* Media Aspect Ratio Container Skeleton (Zero CLS placeholder) */}
      <div className="relative aspect-[16/10] w-full bg-muted/60 flex items-center justify-center">
        {/* Floating Trust Badge Skeleton */}
        <div className="absolute top-3 left-3 w-32 h-6 rounded-full bg-card/80 backdrop-blur-sm" />
        <div className="absolute top-3 right-3 w-20 h-6 rounded-full bg-card/80 backdrop-blur-sm" />
      </div>

      {/* Card Body Content Skeleton */}
      <div className="p-4 md:p-5 flex-1 flex flex-col space-y-3">
        {/* Title */}
        <div className="w-4/5 h-5 bg-muted rounded-md" />

        {/* Description lines */}
        <div className="space-y-1.5 pt-0.5">
          <div className="w-full h-3 bg-muted/70 rounded-md" />
          <div className="w-3/4 h-3 bg-muted/70 rounded-md" />
        </div>

        {/* Niche & Trust Signal Pills Row */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <div className="w-20 h-6 rounded-full bg-muted" />
          <div className="w-28 h-6 rounded-full bg-muted" />
          <div className="w-24 h-6 rounded-full bg-muted" />
        </div>

        {/* Divider */}
        <div className="pt-2 border-t border-border/60" />

        {/* Action Row Skeleton */}
        <div className="flex items-center justify-between pt-1">
          <div className="space-y-1">
            <div className="w-14 h-2.5 bg-muted/60 rounded" />
            <div className="w-24 h-5 bg-muted rounded" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-muted" />
            <div className="w-28 h-9 rounded-xl bg-muted" />
          </div>
        </div>
      </div>
    </article>
  );
}
