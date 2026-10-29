"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type AdminAnalyticsView from "@/components/analytics/AdminAnalyticsView";

function AdminAnalyticsSkeleton() {
  return (
    <div className="flex flex-col gap-8 animate-pulse" aria-busy="true" aria-label="Loading platform analytics">
      <div className="flex justify-end">
        <div className="w-36 h-9 rounded-full bg-muted border border-border" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-card border border-border p-6" />
        ))}
      </div>
      <div className="h-96 rounded-2xl bg-card border border-border p-6" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-80 rounded-2xl bg-card border border-border p-6" />
        <div className="h-80 rounded-2xl bg-card border border-border p-6" />
      </div>
    </div>
  );
}

const DynamicAdminAnalyticsView = dynamic(
  () => import("@/components/analytics/AdminAnalyticsView"),
  {
    ssr: false,
    loading: () => <AdminAnalyticsSkeleton />,
  }
);

export default function AdminAnalyticsClient(
  props: Readonly<ComponentProps<typeof AdminAnalyticsView>>
) {
  return <DynamicAdminAnalyticsView {...props} />;
}
