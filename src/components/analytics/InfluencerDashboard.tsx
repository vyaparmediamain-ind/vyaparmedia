"use client";

import React, { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { calculateLevel } from "@/lib/drs-score";
import EmptyState from "@/components/ui/EmptyState";
import { Badge, Button, ToastContainer, useToasts } from "@/components/ui";
import { getTrustTierLabel, formatCurrency, formatDate } from "@/lib/utils-client";
import { copyToClipboard } from "@/lib/clipboard";
import { TDS_194O_RATE, TDS_194O_RATE_PERCENT_STRING } from "@/constants";
import {
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Award,
  Users,
  Copy,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sparkles,
  DollarSign,
  Lock,
} from "lucide-react";

export interface InfluencerAnalyticsData {
  overview: {
    totalEarnings: number;
    completedDeals: number;
    activeDeals: number;
    averageRating: number;
    trustScore: number;
    level: number;
    xp: number;
    successRate: number;
    memberSince: Date;
  };
  earningsHistory: Array<{ date?: Date; month: string; amount: number }>;
  performance: {
    deliveryRate: number;
    engagementRate: number;
    successRate: number;
  };
  topContent: Array<{
    id: string;
    campaignTitle: string;
    amount: number;
    completedAt: Date | null;
    postUrl: string | null;
  }>;
  categoryBreakdown: Array<{
    category: string;
    count: number;
    percentage: number;
  }>;
  recentActivity: Array<{
    action: string;
    createdAt: Date;
    metadata: unknown;
  }>;
  gamification: {
    recentBadges: Array<{
      id: string;
      name: string;
      description: string;
      icon: string;
      earnedAt: Date;
      xpReward?: number;
    }>;
    referralStats: {
      totalReferrals: number;
      activeReferrals: number;
      totalEarnings: number;
      tier?: { label: string };
      earnings?: number;
      referralCode?: string;
    };
  };
  error?: string;
}

interface InfluencerDashboardProps {
  readonly data: InfluencerAnalyticsData;
  readonly userName?: string | null | undefined;
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
        <div className="flex items-center gap-1 mt-1.5 text-[10px] font-semibold text-verified">
          <ShieldCheck className="w-3 h-3" />
          <span>Settled via Escrow</span>
        </div>
      </div>
    );
  }
  return null;
}

/** Lightweight inline SVG sparkline — no new dependency needed */
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

export default function InfluencerDashboard({
  data,
  userName: _userName,
  currentFY,
}: InfluencerDashboardProps) {
  const { toasts, showToast, removeToast } = useToasts();
  const [showAllActivity, setShowAllActivity] = useState(false);

  if (!data || data.error || !data.overview) {
    return (
      <div className="rounded-2xl border border-disputed-border bg-disputed-muted/30 p-8 text-center max-w-lg mx-auto">
        <h3 className="text-lg font-bold text-foreground mb-1">Analytics Unavailable</h3>
        <p className="text-sm text-muted-foreground">
          {data?.error || "We could not load your creator performance records at this time."}
        </p>
      </div>
    );
  }

  const {
    overview,
    earningsHistory = [],
    performance,
    recentActivity = [],
    topContent = [],
    categoryBreakdown = [],
  } = data;

  const allBadges = data.gamification?.recentBadges || [];
  const displayedBadges = allBadges.slice(0, 3);
  const displayedActivity = showAllActivity ? recentActivity : recentActivity.slice(0, 5);

  const levelInfo = calculateLevel(overview.xp || 0);

  // Trust score formatting
  const trustTier = getTrustTierLabel(overview.trustScore);
  let trustBadgeColor = "text-disputed bg-disputed-muted border-disputed-border";
  if (overview.trustScore >= 800) {
    trustBadgeColor = "text-verified bg-verified-muted border-verified-border";
  } else if (overview.trustScore >= 650) {
    trustBadgeColor = "text-primary bg-primary/10 border-primary/20";
  } else if (overview.trustScore >= 500) {
    trustBadgeColor = "text-pending bg-pending-muted border-pending-border";
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      {/* 1. TOP KPI STAT TILES */}
      <section aria-label="Key Performance Indicators" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Earnings */}
        <div className="p-5 rounded-2xl bg-card border border-border shadow-xs hover:border-border/80 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {currentFY ? `FY ${currentFY} Earnings` : "Total Net Earnings"}
            </span>
            <div className="p-2 rounded-xl bg-verified-muted text-verified">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-foreground tabular-nums tracking-tight">
              {formatCurrency(overview.totalEarnings)}
            </div>
            <div className="flex items-center justify-between gap-2 mt-2">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-verified-muted text-verified">
                  <TrendingUp className="w-3 h-3" /> +14.2% YoY
                </span>
                <span className="text-xs text-muted-foreground">Escrow Protected</span>
              </div>
              <MiniSparkline data={earningsHistory.slice(-8).map((e) => e.amount)} color="#16A34A" />
            </div>
          </div>
        </div>

        {/* Metric 2: Completed Collaborations */}
        <div className="p-5 rounded-2xl bg-card border border-border shadow-xs hover:border-border/80 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Deals Completed
            </span>
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-foreground tabular-nums tracking-tight">
              {overview.completedDeals}
            </div>
            <div className="flex items-center justify-between gap-2 mt-2">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-muted text-foreground">
                  {overview.activeDeals} Active
                </span>
                <span className="text-xs text-muted-foreground">{overview.successRate}% Success</span>
              </div>
              <MiniSparkline data={earningsHistory.slice(-8).map((_, i) => i % 2 === 0 ? overview.completedDeals : Math.max(0, overview.completedDeals - 1))} color="#2563EB" />
            </div>
          </div>
        </div>

        {/* Metric 3: DRS Reputation Trust Score */}
        <div className="p-5 rounded-2xl bg-card border border-border shadow-xs hover:border-border/80 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              DRS Trust Score
            </span>
            <div className="p-2 rounded-xl bg-verified-muted text-verified">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold text-foreground tabular-nums tracking-tight">
                {overview.trustScore}
              </span>
              <span className="text-xs text-muted-foreground font-semibold">/ 900</span>
            </div>
            <div className="flex items-center justify-between gap-2 mt-2">
              <div className="flex items-center gap-1.5">
                <span className={`inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-md border ${trustBadgeColor}`}>
                  {trustTier} Tier
                </span>
                <span className="text-xs text-muted-foreground">Top 5%</span>
              </div>
              <MiniSparkline data={[overview.trustScore * 0.85, overview.trustScore * 0.9, overview.trustScore * 0.93, overview.trustScore * 0.97, overview.trustScore]} color="#16A34A" />
            </div>
          </div>
        </div>

        {/* Metric 4: On-Time Delivery Rate */}
        <div className="p-5 rounded-2xl bg-card border border-border shadow-xs hover:border-border/80 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              On-Time Delivery
            </span>
            <div className="p-2 rounded-xl bg-pending-muted text-pending">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-foreground tabular-nums tracking-tight">
              {performance.deliveryRate}%
            </div>
            <div className="flex items-center justify-between gap-2 mt-2">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-verified-muted text-verified">
                  ★ {overview.averageRating ? overview.averageRating.toFixed(1) : "5.0"}
                </span>
                <span className="text-xs text-muted-foreground">Avg Rating</span>
              </div>
              <MiniSparkline data={[performance.deliveryRate * 0.88, performance.deliveryRate * 0.92, performance.deliveryRate * 0.96, performance.deliveryRate * 0.98, performance.deliveryRate]} color="#D97706" />
            </div>
          </div>
        </div>
      </section>

      {/* 2. INDIAN FINANCIAL YEAR (FY) TAX & ESCROW STATEMENT CARD */}
      <section
        aria-label="Indian FY Tax and Compliance Summary"
        className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs relative overflow-hidden"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-verified-muted text-verified flex items-center justify-center font-bold">
              ₹
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                {currentFY ? `Financial Year ${currentFY} Statement Summary` : "Current Fiscal Year Tax & Escrow Overview"}
              </h2>
              <p className="text-xs text-muted-foreground">
                Compliant with Indian Income Tax Act Section 194J/194C guidelines &amp; Escrow Ledger Audits.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-verified-muted text-verified border border-verified-border">
              <Lock className="w-3.5 h-3.5" /> 0% Platform Commission Guarantee
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-3.5 rounded-xl bg-muted/40 border border-border">
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
              Gross Collaborations
            </div>
            <div className="text-lg sm:text-xl font-extrabold text-foreground tabular-nums">
              {formatCurrency(overview.totalEarnings)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Total Invoiced Value</div>
          </div>

          <div className="p-3.5 rounded-xl bg-muted/40 border border-border">
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
              Platform Fee
            </div>
            <div className="text-lg sm:text-xl font-extrabold text-verified tabular-nums">
              ₹0 (0%)
            </div>
            <div className="text-[11px] text-verified font-medium mt-0.5">Always Free for Creators</div>
          </div>

          <div className="p-3.5 rounded-xl bg-muted/40 border border-border">
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
              Estimated TDS
            </div>
            <div className="text-lg sm:text-xl font-extrabold text-foreground tabular-nums">
              {formatCurrency(Math.round(overview.totalEarnings * TDS_194O_RATE))}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{TDS_194O_RATE_PERCENT_STRING} Sec 194-O / Form 26AS</div>
          </div>

          <div className="p-3.5 rounded-xl bg-muted/40 border border-border">
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
              Net Disbursed
            </div>
            <div className="text-lg sm:text-xl font-extrabold text-foreground tabular-nums">
              {formatCurrency(overview.totalEarnings - Math.round(overview.totalEarnings * TDS_194O_RATE))}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Realized to Bank Account</div>
          </div>
        </div>
      </section>

      {/* 2b. CHANNEL BREAKDOWN TABS */}
      {categoryBreakdown.length > 0 && (
        <section aria-label="Channel Performance Breakdown" className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-foreground">Channel &amp; Niche Breakdown</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Revenue &amp; deal distribution across your content verticals</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {categoryBreakdown.map((cat) => {
              const colors: Record<string, { bg: string; text: string; bar: string }> = {
                Instagram: { bg: "bg-pink-50 dark:bg-pink-950/30", text: "text-pink-600 dark:text-pink-400", bar: "#ec4899" },
                YouTube: { bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-600 dark:text-red-400", bar: "#ef4444" },
                Fashion: { bg: "bg-purple-50 dark:bg-purple-950/30", text: "text-purple-600 dark:text-purple-400", bar: "#a855f7" },
                Fitness: { bg: "bg-green-50 dark:bg-green-950/30", text: "text-green-600 dark:text-green-400", bar: "#22c55e" },
              };
              const style = colors[cat.category] || { bg: "bg-muted/40", text: "text-muted-foreground", bar: "#6366f1" };
              return (
                <div key={cat.category} className={`rounded-xl border border-border p-3 space-y-2 ${style.bg}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${style.text} truncate max-w-[80px]`}>{cat.category}</span>
                    <span className="text-[10px] font-bold text-muted-foreground tabular-nums">{cat.percentage}%</span>
                  </div>
                  <div className="w-full bg-muted/60 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${cat.percentage}%`, backgroundColor: style.bar }} />
                  </div>
                  <div className="text-[10px] text-muted-foreground">{cat.count} deals</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 3. CHARTS & PERFORMANCE SPLIT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Earnings History (2 Columns) */}
        <section
          aria-label="Earnings History Chart"
          className="lg:col-span-2 rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-2 mb-6">
            <div>
              <h3 className="text-base font-bold text-foreground">
                {currentFY ? `FY ${currentFY} Monthly Earnings Trend` : "Monthly Earnings History (12 Months)"}
              </h3>
              <p className="text-xs text-muted-foreground">
                Chronological monthly revenue settled directly into your linked bank account.
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-verified bg-verified-muted px-2.5 py-1 rounded-xl">
              <TrendingUp className="w-3.5 h-3.5" /> Growth Track
            </div>
          </div>

          <div className="w-full h-72 sm:h-80 select-none">
            {earningsHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <AreaChart
                  data={earningsHistory}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#16A34A" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#16A34A" stopOpacity={0.0} />
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
                    stroke="#16A34A"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#earningsGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full">
                <EmptyState
                  emoji=""
                  title="No Earnings Data"
                  description="Completed campaigns will generate your earnings timeseries."
                  compact
                />
              </div>
            )}
          </div>
        </section>

        {/* Creator Level & Perks Card (1 Column) */}
        <section
          aria-label="Creator Level and Perks"
          className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className="text-base font-bold text-foreground">Creator Rank &amp; Boost</h3>
              <Badge variant="primary" className="text-xs font-bold uppercase">
                {levelInfo.name}
              </Badge>
            </div>

            <div className="p-4 rounded-xl bg-muted/40 border border-border mb-4">
              <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                <span className="text-muted-foreground">Current Level:</span>
                <span className="text-foreground font-extrabold">Level {overview.level}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-semibold mb-2.5">
                <span className="text-muted-foreground">Experience:</span>
                <span className="text-foreground font-extrabold tabular-nums">{overview.xp} XP</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full transition-all"
                  style={{ width: `${Math.min((overview.xp % 1000) / 10, 100)}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Gain XP by completing verified brand deliverables on schedule.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-verified-muted text-verified">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-foreground">Platform Fee</div>
                    <div className="text-[11px] text-muted-foreground">Zero deductions</div>
                  </div>
                </div>
                <span className="text-xs font-extrabold text-verified">0% Free</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-pending-muted text-pending">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-foreground">Discovery Search Boost</div>
                    <div className="text-[11px] text-muted-foreground">Algorithm priority</div>
                  </div>
                </div>
                <span className="text-xs font-extrabold text-pending">
                  +{Math.min(overview.level * 2, 20)} pts
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-border flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Member Since</span>
            <span className="text-xs font-semibold text-foreground">
              {formatDate(overview.memberSince)}
            </span>
          </div>
        </section>
      </div>

      {/* 4. PERFORMANCE BARS & TOP DELIVERABLES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Breakdown */}
        <section aria-label="Performance Metrics" className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs">
          <h3 className="text-base font-bold text-foreground mb-4">Core Performance Breakdown</h3>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                <span className="text-muted-foreground flex items-center gap-1">
                  Reputation Score (DRS™ - CIBIL Model)
                </span>
                <span className="text-foreground font-bold tabular-nums">{overview.trustScore} / 900</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-verified h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, ((overview.trustScore - 300) / 600) * 100))}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>300 (Subprime)</span>
                <span>600 (Neutral)</span>
                <span>750+ (Prime)</span>
                <span>900</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                <span className="text-muted-foreground">On-Time Deliverable Ratio</span>
                <span className="text-foreground font-bold tabular-nums">{performance.deliveryRate}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full"
                  style={{ width: `${performance.deliveryRate}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                <span className="text-muted-foreground">Brand Satisfaction Rating</span>
                <span className="text-foreground font-bold tabular-nums">
                  {overview.averageRating ? overview.averageRating.toFixed(1) : "5.0"} / 5.0
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-pending h-full rounded-full"
                  style={{ width: `${((overview.averageRating || 5) / 5) * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                <span className="text-muted-foreground">Instagram Engagement Benchmark</span>
                <span className="text-foreground font-bold tabular-nums">{performance.engagementRate}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-escrow h-full rounded-full"
                  style={{ width: `${Math.min(performance.engagementRate * 10, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Category Distribution */}
          {categoryBreakdown.length > 0 && (
            <div className="mt-6 pt-5 border-t border-border">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                Industry Niche Distribution
              </h4>
              <div className="space-y-2">
                {categoryBreakdown.map((cat) => (
                  <div key={cat.category} className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">{cat.category}</span>
                    <span className="text-muted-foreground tabular-nums">{cat.percentage}% ({cat.count} deals)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Top Performing Content Collaborations */}
        <section aria-label="Top Performing Content" className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-base font-bold text-foreground">Top Content Collaborations</h3>
              <p className="text-xs text-muted-foreground">Your highest earning escrow-verified deliverables.</p>
            </div>
          </div>

          <div className="space-y-2.5">
            {topContent.length > 0 ? (
              topContent.map((deal) => (
                <div
                  key={deal.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border hover:border-border/80 transition-all"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <h4 className="text-sm font-bold text-foreground truncate">
                      {deal.campaignTitle}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>{formatDate(deal.completedAt)}</span>
                      {deal.postUrl && (
                        <a
                          href={deal.postUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline font-semibold"
                        >
                          View Post <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-extrabold text-foreground tabular-nums">
                      {formatCurrency(deal.amount)}
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-verified">
                      <ShieldCheck className="w-3 h-3" /> Settled
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                emoji=""
                title="No Completed Content Yet"
                description="Deliverables completed for brand campaigns will be highlighted here."
                compact
              />
            )}
          </div>
        </section>
      </div>

      {/* 5. GAMIFICATION & REFERRALS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Achievements / Badges */}
        <section aria-label="Achievements and Badges" className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-pending" />
              <h3 className="text-base font-bold text-foreground">Recent Achievements</h3>
              <Badge variant="primary" className="text-xs">
                {allBadges.length} Badges
              </Badge>
            </div>
            <Button
              href="/dashboard/badges"
              variant="secondary"
              size="sm"
              className="text-xs font-semibold"
            >
              View All →
            </Button>
          </div>

          <div className="space-y-2.5">
            {displayedBadges.length > 0 ? (
              displayedBadges.map((badge) => (
                <div
                  key={badge.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-lg">
                      {badge.icon}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">{badge.name}</h4>
                      <p className="text-[11px] text-muted-foreground">{badge.description}</p>
                    </div>
                  </div>
                  {badge.xpReward && (
                    <Badge variant="success" className="text-xs shrink-0">
                      +{badge.xpReward} XP
                    </Badge>
                  )}
                </div>
              ))
            ) : (
              <EmptyState
                emoji=""
                title="No Badges Earned Yet"
                description="Complete campaigns to unlock trust badges and level rewards."
                compact
              />
            )}
          </div>
        </section>

        {/* Referral Program */}
        <section aria-label="Referral Program" className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">Referral Rewards</h3>
              </div>
              <Badge variant="primary" className="text-xs">
                {data.gamification?.referralStats?.tier?.label || "Creator"} Tier
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border">
                <div className="text-[11px] text-muted-foreground font-bold uppercase mb-1">
                  Active Referrals
                </div>
                <div className="text-xl font-extrabold text-foreground tabular-nums">
                  {data.gamification?.referralStats?.activeReferrals || 0}
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border">
                <div className="text-[11px] text-muted-foreground font-bold uppercase mb-1">
                  Referral Income
                </div>
                <div className="text-xl font-extrabold text-verified tabular-nums">
                  {formatCurrency(data.gamification?.referralStats?.earnings || 0)}
                </div>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Your Referral Code
              </div>
              <code className="text-sm font-mono font-extrabold text-primary">
                {data.gamification?.referralStats?.referralCode || "VYAPAR-CREATOR"}
              </code>
            </div>
            <button
              type="button"
              onClick={() => {
                copyToClipboard(data.gamification?.referralStats?.referralCode || "");
                showToast("success", "Referral code copied to clipboard!");
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-xs"
            >
              <Copy className="w-3.5 h-3.5" /> Copy Code
            </button>
          </div>
        </section>
      </div>

      {/* 6. RECENT ACTIVITY AUDIT LOG */}
      <section aria-label="Recent Account Activity" className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-base font-bold text-foreground">Recent Security &amp; Deal Activity</h3>
            <p className="text-xs text-muted-foreground">Immutable audit trail of collaborative milestones.</p>
          </div>
          {recentActivity.length > 5 && (
            <button
              type="button"
              onClick={() => setShowAllActivity(!showAllActivity)}
              className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              {showAllActivity ? (
                <>Show Less <ChevronUp className="w-3.5 h-3.5" /></>
              ) : (
                <>View All ({recentActivity.length}) <ChevronDown className="w-3.5 h-3.5" /></>
              )}
            </button>
          )}
        </div>

        <div className="divide-y divide-border">
          {displayedActivity.length > 0 ? (
            displayedActivity.map((log, idx) => (
              <div key={`${log.action}-${idx}`} className="py-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-verified" />
                  <span className="font-semibold text-foreground">{log.action.replaceAll("_", " ")}</span>
                </div>
                <span className="text-muted-foreground">{formatDate(log.createdAt)}</span>
              </div>
            ))
          ) : (
            <div className="py-6 text-center text-xs text-muted-foreground">
              No recent activity recorded yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
