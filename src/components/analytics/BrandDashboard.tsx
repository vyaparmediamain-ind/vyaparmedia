"use client";

import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import Link from "next/link";
import EmptyState from "@/components/ui/EmptyState";
import { Badge, Button, ToastContainer, useToasts } from "@/components/ui";
import { formatCurrency } from "@/lib/utils-client";
import { copyToClipboard } from "@/lib/clipboard";
import { GST_STANDARD_RATE, GST_STANDARD_RATE_PERCENT_STRING } from "@/constants";
import {
  DollarSign,
  Layers,
  Briefcase,
  ShieldCheck,
  TrendingUp,
  Users,
  Copy,
  Plus,
} from "lucide-react";

export interface BrandAnalyticsData {
  overview: {
    totalSpent: number;
    activeCampaigns: number;
    totalCampaigns: number;
    activeDeals: number;
    trustScore: number;
    completedDeals: number;
    avgDealCost: number;
    memberSince: Date;
  };
  spendHistory: Array<{ month: string; amount: number }>;
  recentCampaigns: Array<{
    id: string;
    title: string;
    status: string;
    budget: number;
    dealsCount: number;
    category: string;
    completedDeals: number;
    amountSpent: number;
  }>;
  dealStatusBreakdown: Array<{
    status: string;
    count: number;
    totalAmount: number;
  }>;
  microVsMacro: {
    micro: {
      count: number;
      avgCost: number;
      avgRating: string;
    };
    macro: {
      count: number;
      avgCost: number;
      avgRating: string;
    };
  };
  referralStats: {
    totalReferrals: number;
    activeReferrals: number;
    totalEarnings: number;
    tier?: { label: string };
    earnings?: number;
    referralCode?: string;
  };
  error?: string;
}

interface BrandDashboardProps {
  readonly data: BrandAnalyticsData;
  readonly currentFY?: string | undefined;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function GlassmorphicTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    const amount = payload[0]?.value ?? 0;
    return (
      <div className="rounded-xl border border-border bg-card/95 backdrop-blur-md p-3 shadow-xl select-none">
        <p className="text-xs font-semibold text-muted-foreground mb-1">{label}</p>
        <p className="text-base font-extrabold text-foreground tabular-nums">
          {formatCurrency(amount)}
        </p>
        <div className="flex items-center gap-1 mt-1.5 text-[10px] font-semibold text-primary">
          <ShieldCheck className="w-3 h-3" />
          <span>Escrow Protected Spend</span>
        </div>
      </div>
    );
  }
  return null;
}

/** Lightweight inline SVG sparkline */
function MiniSparkline({
  data,
  color = "#16A34A",
}: {
  data: number[];
  color?: string;
}) {
  if (!data || data.length < 2) return null;
  const W = 80;
  const H = 24;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * W;
      const y = H - ((v - min) / range) * H;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const rising = (data[data.length - 1] ?? 0) >= (data[0] ?? 0);
  const lineColor = rising ? color : "#EF4444";
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="shrink-0">
      <polyline
        points={pts}
        fill="none"
        stroke={lineColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.75}
      />
    </svg>
  );
}

export default function BrandDashboard({ data, currentFY }: BrandDashboardProps) {
  const { toasts, showToast, removeToast } = useToasts();

  if (!data || data.error || !data.overview) {
    return (
      <div className="rounded-2xl border border-disputed-border bg-disputed-muted/30 p-8 text-center max-w-lg mx-auto">
        <h3 className="text-lg font-bold text-foreground mb-1">Analytics Unavailable</h3>
        <p className="text-sm text-muted-foreground">
          {data?.error || "We could not load your brand campaign analytics at this time."}
        </p>
      </div>
    );
  }

  const {
    overview,
    spendHistory = [],
    recentCampaigns = [],
    dealStatusBreakdown = [],
    microVsMacro,
  } = data;

  return (
    <div className="space-y-6 sm:space-y-8">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      {/* 1. TOP KPI STAT TILES */}
      <section aria-label="Key Performance Indicators" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Spend */}
        <div className="p-5 rounded-2xl bg-card border border-border shadow-xs hover:border-border/80 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {currentFY ? `FY ${currentFY} Spend` : "Total Capital Deployed"}
            </span>
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-foreground tabular-nums tracking-tight">
              {formatCurrency(overview.totalSpent)}
            </div>
            <div className="flex items-center justify-between gap-2 mt-2">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-verified-muted text-verified">
                  <TrendingUp className="w-3 h-3" /> Avg {formatCurrency(overview.avgDealCost)} / deal
                </span>
              </div>
              <MiniSparkline data={spendHistory.slice(-8).map((e) => e.amount)} color="#2563EB" />
            </div>
          </div>
        </div>

        {/* Metric 2: Active Campaigns */}
        <div className="p-5 rounded-2xl bg-card border border-border shadow-xs hover:border-border/80 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Active Campaigns
            </span>
            <div className="p-2 rounded-xl bg-pending-muted text-pending">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-foreground tabular-nums tracking-tight">
              {overview.activeCampaigns}
            </div>
            <div className="flex items-center justify-between gap-2 mt-2">
              <span className="inline-flex items-center text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-muted text-foreground">
                {overview.totalCampaigns} Total Launched
              </span>
              <MiniSparkline data={spendHistory.slice(-6).map((_, i) => i + (overview.activeCampaigns - 2))} color="#D97706" />
            </div>
          </div>
        </div>

        {/* Metric 3: Active Collaborations */}
        <div className="p-5 rounded-2xl bg-card border border-border shadow-xs hover:border-border/80 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Active Collaborations
            </span>
            <div className="p-2 rounded-xl bg-escrow-muted text-escrow">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-foreground tabular-nums tracking-tight">
              {overview.activeDeals}
            </div>
            <div className="flex items-center justify-between gap-2 mt-2">
              <span className="inline-flex items-center text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-verified-muted text-verified">
                {overview.completedDeals} Completed
              </span>
              <MiniSparkline data={spendHistory.slice(-6).map((_, i) => Math.max(0, overview.activeDeals - i))} color="#1E40AF" />
            </div>
          </div>
        </div>

        {/* Metric 4: Platform Trust & Safety */}
        <div className="p-5 rounded-2xl bg-card border border-border shadow-xs hover:border-border/80 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Brand Safety Score
            </span>
            <div className="p-2 rounded-xl bg-verified-muted text-verified">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold text-foreground tabular-nums tracking-tight">
                {overview.trustScore || 850}
              </span>
              <span className="text-xs text-muted-foreground font-semibold">/ 900</span>
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-md bg-verified-muted text-verified border border-verified-border">
                Verified Brand Partner
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. INDIAN FINANCIAL YEAR (FY) GST & AUDIT STATEMENT CARD */}
      <section
        aria-label="Indian FY GST and Audit Statement"
        className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs relative overflow-hidden"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              ₹
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                {currentFY ? `Financial Year ${currentFY} Brand Expense Summary` : "Current Fiscal Year Escrow & GST Summary"}
              </h2>
              <p className="text-xs text-muted-foreground">
                Compliant with Indian GST ITC claim guidelines &amp; Escrow Deposit Statements.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-3.5 rounded-xl bg-muted/40 border border-border">
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
              Total Campaign Spend
            </div>
            <div className="text-lg sm:text-xl font-extrabold text-foreground tabular-nums">
              {formatCurrency(overview.totalSpent)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Escrow Settlements</div>
          </div>

          <div className="p-3.5 rounded-xl bg-muted/40 border border-border">
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
              Average Cost / Deal
            </div>
            <div className="text-lg sm:text-xl font-extrabold text-primary tabular-nums">
              {formatCurrency(overview.avgDealCost)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Per Completed Milestone</div>
          </div>

          <div className="p-3.5 rounded-xl bg-muted/40 border border-border">
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
              Input Tax Credit (GST)
            </div>
            <div className="text-lg sm:text-xl font-extrabold text-foreground tabular-nums">
              {formatCurrency(Math.round(overview.totalSpent * GST_STANDARD_RATE))}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{GST_STANDARD_RATE_PERCENT_STRING} GST Invoiced</div>
          </div>

          <div className="p-3.5 rounded-xl bg-muted/40 border border-border">
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
              Completed Deals
            </div>
            <div className="text-lg sm:text-xl font-extrabold text-verified tabular-nums">
              {overview.completedDeals}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">100% Verified Posts</div>
          </div>
        </div>
      </section>

      {/* 3. CHARTS & SPEND HISTORY */}
      <section
        aria-label="Spend History Chart"
        className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs flex flex-col justify-between"
      >
        <div className="flex items-center justify-between gap-2 mb-6">
          <div>
            <h3 className="text-base font-bold text-foreground">
              {currentFY ? `FY ${currentFY} Monthly Campaign Expenditure` : "Monthly Spend History (12 Months)"}
            </h3>
            <p className="text-xs text-muted-foreground">
              Direct escrow deposits and milestone releases across your marketing campaigns.
            </p>
          </div>
        </div>

        <div className="w-full h-72 sm:h-80 select-none">
          {spendHistory.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <AreaChart data={spendHistory} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(val) => {
                    const rs = val / 100;
                    if (rs >= 100000) return `₹${(rs / 100000).toFixed(1).replace(/\.0$/, "")}L`;
                    if (rs >= 1000) return `₹${(rs / 1000).toFixed(1).replace(/\.0$/, "")}K`;
                    return `₹${rs}`;
                  }}
                />
                <Tooltip content={<GlassmorphicTooltip />} />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#2563EB"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#spendGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full">
              <EmptyState
                emoji=""
                title="No Spend History"
                description="Fund a campaign deal to populate your expenditure timeline."
                compact
              />
            </div>
          )}
        </div>
      </section>

      {/* 4. CREATOR TIERS & RECENT CAMPAIGNS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Micro vs Macro ROI comparison */}
        {microVsMacro && (
          <section aria-label="Creator Tier Performance" className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs">
            <h3 className="text-base font-bold text-foreground mb-1">Creator Tier Performance</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Comparison between Micro and Macro creator partnerships.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-muted/40 border border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-foreground">Micro Creators</span>
                  <Badge variant="ghost" className="text-[10px]">10K-100K</Badge>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Collaborations:</span>
                    <span className="font-bold text-foreground">{microVsMacro.micro.count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg Cost:</span>
                    <span className="font-bold text-foreground">{formatCurrency(microVsMacro.micro.avgCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg Rating:</span>
                    <span className="font-bold text-verified">★ {microVsMacro.micro.avgRating || "4.9"}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-muted/40 border border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-foreground">Macro Creators</span>
                  <Badge variant="primary" className="text-[10px]">100K+</Badge>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Collaborations:</span>
                    <span className="font-bold text-foreground">{microVsMacro.macro.count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg Cost:</span>
                    <span className="font-bold text-foreground">{formatCurrency(microVsMacro.macro.avgCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg Rating:</span>
                    <span className="font-bold text-verified">★ {microVsMacro.macro.avgRating || "5.0"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Deal Status Breakdown */}
            {dealStatusBreakdown.length > 0 && (
              <div className="mt-5 pt-4 border-t border-border">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2.5">
                  Deal Status Distribution
                </h4>
                <div className="space-y-2">
                  {dealStatusBreakdown.map((item) => (
                    <div key={item.status} className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">{item.status.replaceAll("_", " ")}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {item.count} deals ({formatCurrency(item.totalAmount)})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Recent Campaigns Portfolio */}
        <section aria-label="Recent Campaigns" className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-base font-bold text-foreground">Recent Campaigns</h3>
                <p className="text-xs text-muted-foreground">Active briefs and creator rosters.</p>
              </div>
              <Button
                href="/dashboard/campaigns/create"
                variant="primary"
                size="sm"
                className="text-xs font-bold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> New Campaign
              </Button>
            </div>

            <div className="space-y-2.5">
              {recentCampaigns.length > 0 ? (
                recentCampaigns.map((camp) => (
                  <div
                    key={camp.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border hover:border-border/80 transition-all group gap-2"
                  >
                    <Link
                      href={`/dashboard/campaigns/${camp.id}`}
                      className="min-w-0 flex-1 pr-2 block"
                    >
                      <h4 className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
                        {camp.title}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>{camp.category}</span>
                        <span>•</span>
                        <span>{camp.dealsCount} creators</span>
                      </div>
                    </Link>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <div className="text-right">
                        <div className="text-sm font-extrabold text-foreground tabular-nums">
                          {formatCurrency(camp.budget)}
                        </div>
                        <Badge variant={camp.status === "ACTIVE" ? "success" : "ghost"} className="text-[10px]">
                          {camp.status}
                        </Badge>
                      </div>
                      <Link
                        href={`/dashboard/campaigns/${camp.id}/roi`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-bold text-foreground transition-colors shadow-2xs"
                        title="View Delivered ROI Report"
                      >
                        <TrendingUp className="w-3.5 h-3.5 text-primary" />
                        <span className="hidden sm:inline">ROI</span>
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState
                  emoji=""
                  title="No Campaigns Created"
                  description="Create your first campaign brief to start collaborating with creators."
                  compact
                />
              )}
            </div>
          </div>
        </section>
      </div>

      {/* 5. REFERRAL PROGRAM */}
      <section aria-label="Brand Referral Program" className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Invite Partner Brands</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Earn 1% cashback on all escrow deal volumes funded by referred brand accounts.
          </p>
        </div>

        <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between gap-3 shrink-0">
          <div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Referral Code
            </div>
            <code className="text-xs font-mono font-extrabold text-primary">
              {data.referralStats?.referralCode || "VYAPAR-BRAND"}
            </code>
          </div>
          <button
            type="button"
            onClick={() => {
              copyToClipboard(data.referralStats?.referralCode || "");
              showToast("success", "Brand referral code copied!");
            }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-xs"
          >
            <Copy className="w-3 h-3" /> Copy
          </button>
        </div>
      </section>
    </div>
  );
}
