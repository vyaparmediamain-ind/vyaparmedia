"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import useSWR from "swr";
import { type Session } from "next-auth";
import { createSchemaFetcher } from "@/lib/fetcher";
import {
  dealsListResponseSchema,
  type DealsListResponse,
  type RawDealItem,
} from "@/lib/schemas";
import { useWallet } from "@/hooks/api/useWallet";
import { isBrand as checkIsBrand, isInfluencer as checkIsInfluencer } from "@/lib/rbac";
import { formatCurrency } from "@/lib/utils-client";
import { ActionRequiredBanner } from "./ActionRequiredBanner";
import { FinancialOverviewBar } from "./FinancialOverviewBar";
import { ActiveDealsFeed, filterActiveDeals } from "./ActiveDealsFeed";
import { QuickDiscoveryRow } from "./QuickDiscoveryRow";
import { DashboardStoriesBar } from "./DashboardStoriesBar";
import { AuthenticityAppealBanner } from "@/components/dashboard/AuthenticityAppealBanner";
import AnalyticsPageClient from "@/app/dashboard/analytics/AnalyticsPageClient";
import { PageHeader } from "@/components/ui";
import type { InfluencerAnalyticsData } from "@/components/analytics/InfluencerDashboard";
import type { BrandAnalyticsData } from "@/components/analytics/BrandDashboard";
import { ShieldCheck, LayoutDashboard, BarChart3, Wallet, Lock, Layers } from "lucide-react";

interface DashboardHomeClientProps {
  user: Session["user"];
  influencerData?: InfluencerAnalyticsData | null | undefined;
  brandData?: BrandAnalyticsData | null | undefined;
  currentFY?: string | undefined;
}

const dealsFetcher = createSchemaFetcher(dealsListResponseSchema);

type DashboardViewTab = "feed" | "analytics";

export default function DashboardHomeClient({
  user,
  influencerData,
  brandData,
  currentFY,
}: Readonly<DashboardHomeClientProps>) {
  const [activeView, setActiveView] = useState<DashboardViewTab>("feed");
  const isBrand = checkIsBrand(user.userType);
  const isInfluencer = checkIsInfluencer(user.userType);

  // Real-time wallet synchronization via Supabase channel
  const { walletData, isLoading: walletLoading } = useWallet(true);

  // SWR fetch active deals for the action feed
  const { data: dealsResponse, isLoading: dealsLoading } = useSWR<DealsListResponse>(
    "/api/deals?limit=10&status=active",
    dealsFetcher,
    { revalidateOnFocus: true, dedupingInterval: 10000 }
  );

  const dealsSource: RawDealItem[] =
    dealsResponse?.data?.deals ?? dealsResponse?.deals ?? [];

  const activeDeals = filterActiveDeals(dealsSource);
  const displayName = user.name || (isBrand ? "Brand Partner" : "Creator");
  const userAvatar = user.image;

  // Extract trust metrics
  const trustScore = influencerData?.overview.trustScore ?? brandData?.overview.trustScore ?? 750;
  const level = influencerData?.overview.level ?? 1;
  const escrowBalancePaise = walletData?.totalHeld ?? walletData?.pendingBalance ?? 0;
  const availableBalancePaise = walletData?.balance ?? 0;

  return (
    <div className="space-y-6 sm:space-y-8 pb-12">
      {/* 1. TOP GREETING & VIEW SWITCHER */}
      <PageHeader
        icon={
          <div className="relative w-12 h-12 rounded-full overflow-hidden bg-primary/10 border-2 border-primary/20 shrink-0 flex items-center justify-center text-primary font-bold text-lg shadow-xs">
            {userAvatar ? (
              <Image src={userAvatar} alt={displayName} fill className="object-cover" />
            ) : (
              <span>{displayName[0]?.toUpperCase() || "U"}</span>
            )}
          </div>
        }
        title={`Welcome back, ${displayName}`}
        badge={
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-verified-muted text-verified border border-verified-border">
            <ShieldCheck className="w-3.5 h-3.5" /> Verified
          </span>
        }
        subtitle={
          isBrand
            ? "Manage campaigns, approve deliverables, and fund escrow-backed collaborations."
            : "Track your deliverables, verified brand deals, and instant escrow settlements."
        }
        actions={
          <div className="flex flex-wrap items-center gap-3 self-start lg:self-center">
            {/* Pinned quick KPI chips */}
            <div className="flex items-center gap-2">
              {isInfluencer && (
                <Link
                  href="/dashboard/wallet"
                  className="flex items-center gap-1.5 px-3.5 py-2.5 min-h-[44px] rounded-xl bg-card border border-border shadow-xs hover:border-primary/50 transition-colors"
                >
                  <Wallet className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[11px] text-muted-foreground font-medium">Available:</span>
                  <span className="text-xs font-mono font-extrabold text-foreground tabular-nums">
                    {formatCurrency(availableBalancePaise)}
                  </span>
                </Link>
              )}
              {isBrand && (
                <Link
                  href="/dashboard/deals"
                  className="flex items-center gap-1.5 px-3.5 py-2.5 min-h-[44px] rounded-xl bg-card border border-border shadow-xs hover:border-primary/50 transition-colors"
                >
                  <Layers className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[11px] text-muted-foreground font-medium">Active:</span>
                  <span className="text-xs font-mono font-extrabold text-foreground tabular-nums">
                    {activeDeals.length} Deals
                  </span>
                </Link>
              )}
              <Link
                href="/dashboard/wallet"
                className="flex items-center gap-1.5 px-3.5 py-2.5 min-h-[44px] rounded-xl bg-escrow-muted border border-escrow-border text-escrow shadow-xs hover:bg-escrow/15 transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
                <span className="text-[11px] font-medium">Escrow:</span>
                <span className="text-xs font-mono font-extrabold tabular-nums">
                  {formatCurrency(escrowBalancePaise)}
                </span>
              </Link>
            </div>

            {/* View Switcher: Action Feed vs Deep-Dive Analytics */}
            <div className="flex items-center bg-muted p-1 rounded-xl border border-border w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setActiveView("feed")}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeView === "feed"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                Action Feed
              </button>
              <button
                type="button"
                onClick={() => setActiveView("analytics")}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeView === "analytics"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                Analytics &amp; FY Reports
              </button>
            </div>
          </div>
        }
      />

      {/* 2. INSTAGRAM-STYLE HIGHLIGHT STORIES BAR */}
      <DashboardStoriesBar
        isBrand={isBrand}
        activeDealsCount={activeDeals.length}
        escrowBalancePaise={escrowBalancePaise}
        trustScore={trustScore}
        level={level}
      />

      {/* 3. MAIN VIEW CONTENT */}
      {activeView === "feed" ? (
        <main className="space-y-6 sm:space-y-8">
          {/* Creator Authenticity Audit Alert & Appeal Banner */}
          {isInfluencer && <AuthenticityAppealBanner />}

          {/* Collabr Priority Action Required Banner */}
          <ActionRequiredBanner
            deals={dealsSource}
            isBrand={isBrand}
            isInfluencer={isInfluencer}
          />

          {/* CRED / Jupiter Financial Overview Cards */}
          <FinancialOverviewBar
            walletData={walletData}
            isLoading={walletLoading}
            isBrand={isBrand}
            trustScore={trustScore}
            level={level}
          />

          {/* Active Collaborations Pipeline */}
          <ActiveDealsFeed
            deals={dealsSource}
            isLoading={dealsLoading}
            isBrand={isBrand}
            isInfluencer={isInfluencer}
          />

          {/* Discovery Strip (Recommended Campaigns / Creators) */}
          <QuickDiscoveryRow
            isBrand={isBrand}
            isInfluencer={isInfluencer}
          />
        </main>
      ) : (
        /* DEEP-DIVE ANALYTICS VIEW */
        <div className="space-y-6">
          {isInfluencer && influencerData && (
            <AnalyticsPageClient
              userType="INFLUENCER"
              initialData={influencerData}
              currentFY={currentFY}
            />
          )}
          {isBrand && brandData && (
            <AnalyticsPageClient
              userType="BRAND"
              initialData={brandData}
              currentFY={currentFY}
            />
          )}
        </div>
      )}
    </div>
  );
}
