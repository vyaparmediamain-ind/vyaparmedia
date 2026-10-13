"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import type { InfluencerAnalyticsData } from "@/components/analytics/InfluencerDashboard";
import type { BrandAnalyticsData } from "@/components/analytics/BrandDashboard";
import WeeklyChallenges from "@/components/dashboard/challenges/WeeklyChallenges";
import { Download, Calendar, Sparkles, FileSpreadsheet } from "lucide-react";
import { ToastContainer, useToasts } from "@/components/ui";

const InfluencerDashboard = dynamic(
  () => import("@/components/analytics/InfluencerDashboard"),
  {
    loading: () => (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-muted/60 animate-pulse border border-border" />
          ))}
        </div>
        <div className="h-80 rounded-2xl bg-muted/60 animate-pulse border border-border" />
      </div>
    ),
    ssr: false,
  }
);

const BrandDashboard = dynamic(
  () => import("@/components/analytics/BrandDashboard"),
  {
    loading: () => (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-muted/60 animate-pulse border border-border" />
          ))}
        </div>
        <div className="h-80 rounded-2xl bg-muted/60 animate-pulse border border-border" />
      </div>
    ),
    ssr: false,
  }
);

interface AnalyticsPageClientProps {
  readonly userType: "INFLUENCER" | "BRAND";
  readonly initialData: InfluencerAnalyticsData | BrandAnalyticsData;
  readonly currentFY?: string | undefined;
}

export default function AnalyticsPageClient({
  userType,
  initialData,
  currentFY,
}: AnalyticsPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toasts, showToast, removeToast } = useToasts();
  const [isExporting, setIsExporting] = useState(false);

  // Generate available Indian Financial Years (current FY and previous 3)
  const generateAvailableFYs = (): string[] => {
    const fys: string[] = [];
    const now = new Date();
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + IST_OFFSET_MS);
    const currentFYStart =
      istNow.getUTCMonth() >= 3
        ? istNow.getUTCFullYear()
        : istNow.getUTCFullYear() - 1;

    for (let i = 0; i < 4; i++) {
      const yr = currentFYStart - i;
      fys.push(`${yr}-${String(yr + 1).slice(-2)}`);
    }
    return fys;
  };

  const availableFYs = generateAvailableFYs();
  const selectedFY = currentFY || "";

  const handleFYChange = (fy: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (fy) {
      params.set("fy", fy);
    } else {
      params.delete("fy");
    }
    router.push(`?${params.toString()}`);
  };

  const handleExportReport = async () => {
    try {
      setIsExporting(true);
      const activeFY = selectedFY || availableFYs[0];
      const endpoint =
        userType === "INFLUENCER"
          ? `/api/reports/influencer/income?fy=${activeFY}&format=csv`
          : `/api/reports/brand/spend?fy=${activeFY}&format=csv`;

      // Trigger direct file download
      const res = await fetch(endpoint);
      if (!res.ok) {
        throw new Error("Failed to generate CSV export");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vyaparmedia-${userType.toLowerCase()}-fy${activeFY}-report.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToast("success", `FY ${activeFY} report exported successfully.`);
    } catch {
      showToast("error", "Unable to download report. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      {/* Financial Year & Period Filter Bar (Instagram Pro & Jupiter Filter Pattern) */}
      <section
        aria-label="Financial Year Filter"
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2.5 sm:p-3 rounded-2xl bg-card border border-border shadow-xs"
      >
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <span className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground px-2 whitespace-nowrap">
            <Calendar className="w-3.5 h-3.5 text-primary" /> Period:
          </span>

          <button
            type="button"
            onClick={() => handleFYChange("")}
            className={`px-3.5 py-2.5 min-h-[44px] inline-flex items-center justify-center rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedFY === ""
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
            }`}
          >
            Rolling 12 Months
          </button>

          {availableFYs.map((fy) => (
            <button
              key={fy}
              type="button"
              onClick={() => handleFYChange(fy)}
              className={`px-3.5 py-2.5 min-h-[44px] inline-flex items-center justify-center rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedFY === fy
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
              }`}
            >
              FY {fy}
            </button>
          ))}
        </div>

        {/* Quick Export Statement Action */}
        <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
          <button
            type="button"
            onClick={handleExportReport}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3.5 py-2.5 min-h-[44px] rounded-xl text-xs font-bold bg-muted hover:bg-muted/80 text-foreground transition-all border border-border disabled:opacity-50"
            title="Download verified Indian Financial Year audit report"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-verified" />
            <span>{isExporting ? "Exporting..." : `Export FY ${selectedFY || availableFYs[0]} CSV`}</span>
            <Download className="w-3 h-3 text-muted-foreground ml-0.5" />
          </button>
        </div>
      </section>

      {/* Gamified Weekly Challenges (Influencer Only) */}
      {userType === "INFLUENCER" && (
        <section aria-label="Weekly Challenges" className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-pending" />
            <h2 className="text-sm font-bold text-foreground">Active Milestone Challenges</h2>
          </div>
          <WeeklyChallenges />
        </section>
      )}

      {/* Main Dashboard Render */}
      {userType === "INFLUENCER" ? (
        <InfluencerDashboard
          data={initialData as InfluencerAnalyticsData}
          currentFY={selectedFY || undefined}
        />
      ) : (
        <BrandDashboard
          data={initialData as BrandAnalyticsData}
          currentFY={selectedFY || undefined}
        />
      )}
    </div>
  );
}
