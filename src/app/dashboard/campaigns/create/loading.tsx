import React from "react";
import { PageContainer } from "@/components/ui";

export default function CreateCampaignLoading() {
  return (
    <PageContainer maxWidth="6xl" className="space-y-6 animate-pulse py-4 sm:py-6" aria-hidden="true">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-64 bg-muted rounded-xl" />
        <div className="h-4 w-96 bg-muted/60 rounded-lg" />
      </div>

      {/* Stepper skeleton */}
      <div className="h-16 w-full bg-card border border-border rounded-2xl p-3" />

      {/* Form + Sidebar skeleton */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="flex-1 w-full h-[520px] bg-card border border-border rounded-3xl p-8" />
        <div className="w-full lg:w-80 h-[440px] bg-card border border-border rounded-3xl p-6" />
      </div>
    </PageContainer>
  );
}
