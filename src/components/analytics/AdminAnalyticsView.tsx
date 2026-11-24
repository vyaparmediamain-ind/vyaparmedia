"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
} from "recharts";
import { formatCurrency, formatNumber } from "@/lib/utils-client";
import { TrafficAndBehaviourTab } from "./TrafficAndBehaviourTab";
import { HelpTip } from "@/components/guides/HelpTip";
import {
  BarChart3,
  Activity,
  Filter,
  Server,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  FileCheck,
  Database,
  Users,
  UserCheck,
  Briefcase,
  IndianRupee,
  TrendingUp,
  RefreshCw,
  Sparkles,
  ShieldAlert,
  ArrowUpRight,
  Shield,
  Layers,
} from "lucide-react";
import type {
  AdminFunnelStage,
  AdminDataQualityBreakdown,
  AdminCronHealthItem,
  ReportConfigCompletenessSummary,
} from "@/lib/admin-analytics-calc";

interface AdminData {
  realTime: {
    totalUsers: number;
    totalInfluencers: number;
    totalBrands: number;
    activeUsers7d: number;
    activeDeals: number;
    completedDealsToday: number;
    revenueToday: number;
    disputesOpen: number;
  };
  growth: Array<{
    date: string;
    total: number;
    influencer: number;
    brand: number;
  }>;
  financials: {
    totalRevenue: number;
    totalGMV: number;
    gmvDataQuality?: "VERIFIED" | undefined;
    actualResolvedRevenue?: number | undefined;
    bookedEscrowRevenue?: number | undefined;
    pendingPayouts: number;
    totalRefunds: number;
    revenueToday: number;
    revenueHistory: Array<{ month: string; revenue: number; gmv: number; deals?: number }>;
  };
  growthMetrics: {
    signupsLast30: number;
    signupGrowthRate: number;
    activationRate: number;
    churnRate: number;
    kFactor: number;
    totalReferrals: number;
    paymentSuccessRate: number;
  };
  systemHealth: {
    recentErrors: number;
    fraudAlerts: number;
    paymentSuccessRate: number;
    status: string;
  };
  activity: {
    activeDeals: number;
    totalCompletedDeals: number;
    disputesOpen: number;
  };
  resolvedRevenue?: {
    actualResolvedFeePaise: number;
    bookedEscrowFeePaise: number;
    netResolvedPlatformRevenuePaise: number;
    dataQuality: "VERIFIED";
  } | undefined;
  funnelDropOffs?: AdminFunnelStage[] | undefined;
  dataQualityShare?: AdminDataQualityBreakdown | undefined;
  cronHealth?: {
    overallStatus: "HEALTHY" | "DEGRADED" | "CRITICAL";
    jobs: AdminCronHealthItem[];
    failingJobsCount: number;
  } | undefined;
  reportConfigCompleteness?: ReportConfigCompletenessSummary | undefined;
}

interface AdminAnalyticsProps {
  readonly data: AdminData;
}

const getItemVariants = (shouldReduceMotion: boolean | null): Variants => ({
  hidden: { opacity: shouldReduceMotion ? 1 : 0, y: shouldReduceMotion ? 0 : 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 26 },
  },
});

/**
 * Enterprise Indian Rupee Y-Axis Formatter
 * Accurately formats integer amounts in Paise into clean standard Rupee notation (₹k, ₹L, ₹Cr).
 */
function formatAxisPaise(valInPaise: number | string): string {
  const num = typeof valInPaise === "number" ? valInPaise : Number(valInPaise) || 0;
  const rupees = num / 100;
  if (rupees === 0) return "₹0";
  const abs = Math.abs(rupees);
  if (abs >= 10000000) return `₹${(rupees / 10000000).toFixed(1)}Cr`;
  if (abs >= 100000) return `₹${(rupees / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `₹${Math.round(rupees / 1000)}k`;
  return `₹${Math.round(rupees)}`;
}

export default function AdminAnalyticsView({ data }: AdminAnalyticsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab");
  const currentTab: "overview" | "funnel" | "crons" | "traffic" =
    rawTab === "traffic" || rawTab === "funnel" || rawTab === "crons"
      ? rawTab
      : "overview";

  const shouldReduceMotion = useReducedMotion();
  const [chartsReady, setChartsReady] = useState(false);
  const [chartViewMode, setChartViewMode] = useState<"ALL" | "GMV" | "REVENUE">("ALL");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fmt = (v: number | null | undefined) => formatCurrency(v);

  const handleTabChange = (newTab: "overview" | "funnel" | "crons" | "traffic") => {
    const params = new URLSearchParams(searchParams.toString());
    if (newTab === "overview") {
      params.delete("tab");
      params.delete("range");
    } else {
      params.set("tab", newTab);
    }
    router.replace(`?${params.toString()}`);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const containerVariants: Variants = {
    hidden: { opacity: shouldReduceMotion ? 1 : 0 },
    show: {
      opacity: 1,
      transition: shouldReduceMotion ? { duration: 0 } : { staggerChildren: 0.06 },
    },
  };

  const itemVariants = getItemVariants(shouldReduceMotion);

  useEffect(() => {
    const id = window.setTimeout(() => setChartsReady(true), 60);
    return () => window.clearTimeout(id);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case "HEALTHY":
      case "OPERATIONAL":
        return "bg-emerald-500 shadow-emerald-500/50";
      case "WARNING":
      case "DEGRADED":
        return "bg-amber-500 shadow-amber-500/50";
      default:
        return "bg-rose-500 shadow-rose-500/50";
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case "HEALTHY":
      case "OPERATIONAL":
        return "text-emerald-500";
      case "WARNING":
      case "DEGRADED":
        return "text-amber-500";
      default:
        return "text-rose-500";
    }
  };

  // Retention rate computation
  const retentionPercent = useMemo(() => {
    if (!data.realTime.totalUsers || data.realTime.totalUsers <= 0) return 0;
    return Math.min(100, Math.round((data.realTime.activeUsers7d / data.realTime.totalUsers) * 100));
  }, [data.realTime.activeUsers7d, data.realTime.totalUsers]);

  return (
    <motion.div
      className="flex flex-col gap-8 pb-12"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* Top Operations Header Bar */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border/80 pb-5"
      >
        {/* Navigation Tabs */}
        <div
          role="tablist"
          aria-label="Admin Analytics Navigation"
          className="inline-flex flex-wrap items-center rounded-2xl bg-muted/70 p-1.5 border border-border shadow-xs backdrop-blur-md"
        >
          <button
            type="button"
            role="tab"
            aria-selected={currentTab === "overview"}
            aria-controls="panel-overview"
            onClick={() => handleTabChange("overview")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus:outline-none ${
              currentTab === "overview"
                ? "bg-card text-foreground shadow-sm border border-border/60"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-primary" />
            <span>Overview &amp; Financials</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={currentTab === "funnel"}
            aria-controls="panel-funnel"
            onClick={() => handleTabChange("funnel")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus:outline-none ${
              currentTab === "funnel"
                ? "bg-card text-foreground shadow-sm border border-border/60"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <Filter className="w-3.5 h-3.5 text-primary" />
            <span>Funnel &amp; Quality</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={currentTab === "crons"}
            aria-controls="panel-crons"
            onClick={() => handleTabChange("crons")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus:outline-none ${
              currentTab === "crons"
                ? "bg-card text-foreground shadow-sm border border-border/60"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <Server className="w-3.5 h-3.5 text-primary" />
            <span>Cron Health &amp; Config</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={currentTab === "traffic"}
            aria-controls="panel-traffic"
            onClick={() => handleTabChange("traffic")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus:outline-none ${
              currentTab === "traffic"
                ? "bg-card text-foreground shadow-sm border border-border/60"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-primary" />
            <span>Traffic &amp; Behaviour</span>
          </button>
        </div>

        {/* Global Control Status */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all cursor-pointer shadow-xs disabled:opacity-60"
            title="Refresh real-time telemetry metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-primary" : ""}`} />
            <span>Sync</span>
          </button>

          <div className="flex items-center gap-2.5 px-3.5 py-1.5 bg-card border border-border rounded-xl shadow-xs backdrop-blur-md">
            <div
              className={`w-2.5 h-2.5 rounded-full ring-4 ring-emerald-500/10 ${getStatusColor(
                data.systemHealth.status
              )}`}
            />
            <span
              className={`text-xs font-bold tracking-tight uppercase ${getStatusTextColor(
                data.systemHealth.status
              )}`}
            >
              System: {data.systemHealth.status || "HEALTHY"}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Tab Content: Traffic & Behaviour */}
      {currentTab === "traffic" && (
        <div id="panel-traffic" role="tabpanel" aria-label="Traffic & Behaviour">
          <TrafficAndBehaviourTab />
        </div>
      )}

      {/* Tab Content: Funnel & Quality */}
      {currentTab === "funnel" && (
        <div id="panel-funnel" role="tabpanel" aria-label="Funnel & Quality" className="space-y-6">
          {/* 5-Stage Conversion Funnel */}
          <motion.div variants={itemVariants} className="card p-6 sm:p-8 border border-border rounded-2xl bg-card shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Filter className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">Platform Conversion Funnel</h2>
                  <p className="text-xs text-muted-foreground">
                    Conversion progression and drop-off velocity across discovery, bidding, escrow funding, and completion.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-verified/10 text-verified border border-verified/20">
                  <ShieldCheck className="w-3.5 h-3.5" /> VERIFIED TELEMETRY
                </span>
                <HelpTip guideId="admin-analytics-intelligence" stepIndex={2} label="Verified Telemetry Guide" />
              </div>
            </div>

            {data.funnelDropOffs && data.funnelDropOffs.length > 0 ? (
              <div className="space-y-4">
                {data.funnelDropOffs.map((stage, idx) => (
                  <div key={stage.stage} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-foreground">
                          {idx + 1}
                        </span>
                        <span className="text-foreground font-bold">{stage.stage}</span>
                      </div>
                      <div className="flex items-center gap-3 tabular-nums">
                        <span className="text-foreground font-extrabold">{stage.count.toLocaleString("en-IN")}</span>
                        {idx > 0 && (
                          <span className="text-muted-foreground text-[11px]">
                            ({stage.conversionPercent}% conversion · <span className="text-pending font-bold">{stage.dropOffPercent}% drop-off</span>)
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="w-full h-3 bg-muted/60 rounded-full overflow-hidden border border-border">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(5, stage.conversionPercent)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-6 text-center">
                Funnel progression will populate as creators and brands transact.
              </p>
            )}
          </motion.div>

          {/* Data Quality Share */}
          <motion.div variants={itemVariants} className="card p-6 sm:p-8 border border-border rounded-2xl bg-card shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-verified/10 text-verified flex items-center justify-center">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-foreground">Platform Data Quality Distribution</h2>
                    <HelpTip guideId="admin-analytics-intelligence" stepIndex={2} label="How data quality share is audited" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Proportion of API-verified vs heuristic estimated metrics across the platform network.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-card border border-verified/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-verified uppercase tracking-wider">Verified (API)</span>
                  <span className="text-xs font-extrabold text-verified tabular-nums">{data.dataQualityShare?.verifiedPercent ?? 100}%</span>
                </div>
                <div className="text-xl font-black text-foreground tabular-nums">
                  {data.dataQualityShare?.verifiedCount.toLocaleString("en-IN") ?? 0}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Directly measured from Instagram Graph API, settled escrow, or platform logs.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-card border border-pending/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-pending uppercase tracking-wider">Estimated (Algorithmic)</span>
                  <span className="text-xs font-extrabold text-pending tabular-nums">{data.dataQualityShare?.estimatedPercent ?? 0}%</span>
                </div>
                <div className="text-xl font-black text-foreground tabular-nums">
                  {data.dataQualityShare?.estimatedCount.toLocaleString("en-IN") ?? 0}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Derived from category baseline CPV benchmarks and median historical comparisons.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-card border border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Self-Reported</span>
                  <span className="text-xs font-extrabold text-muted-foreground tabular-nums">{data.dataQualityShare?.selfReportedPercent ?? 0}%</span>
                </div>
                <div className="text-xl font-black text-foreground tabular-nums">
                  {data.dataQualityShare?.selfReportedCount.toLocaleString("en-IN") ?? 0}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Unverified initial profile onboarding estimates prior to automated verification.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Tab Content: Cron Health & Heartbeats */}
      {currentTab === "crons" && (
        <div id="panel-crons" role="tabpanel" aria-label="Cron Health & Config" className="space-y-6">
          <motion.div variants={itemVariants} className="card p-6 sm:p-8 border border-border rounded-2xl bg-card shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">Background Cron Health &amp; Heartbeat Monitor</h2>
                  <p className="text-xs text-muted-foreground">
                    Real-time execution status of all 21 scheduled QStash and Vercel background jobs.
                  </p>
                </div>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-1 rounded-full ${
                  data.cronHealth?.overallStatus === "HEALTHY"
                    ? "bg-verified/15 text-verified border border-verified/30"
                    : data.cronHealth?.overallStatus === "DEGRADED"
                    ? "bg-pending/15 text-pending border border-pending/30"
                    : "bg-destructive/15 text-destructive border border-destructive/30"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                Status: {data.cronHealth?.overallStatus || "HEALTHY"}
              </span>
            </div>

            {data.cronHealth?.jobs && data.cronHealth.jobs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground font-bold">
                      <th className="py-2.5 px-3">Job Name</th>
                      <th className="py-2.5 px-3">Endpoint</th>
                      <th className="py-2.5 px-3">Schedule</th>
                      <th className="py-2.5 px-3">Duration</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {data.cronHealth.jobs.map((job) => (
                      <tr key={job.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-foreground">{job.name}</td>
                        <td className="py-2.5 px-3 text-muted-foreground font-mono text-[11px]">{job.path}</td>
                        <td className="py-2.5 px-3 text-muted-foreground font-mono text-[11px]">{job.cron}</td>
                        <td className="py-2.5 px-3 tabular-nums text-muted-foreground">
                          {job.durationMs ? `${job.durationMs}ms` : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              job.status === "HEALTHY" || job.status === "PENDING"
                                ? "bg-verified/15 text-verified"
                                : "bg-destructive/15 text-destructive"
                            }`}
                          >
                            {job.status === "CRITICAL" ? "FAILED" : "SUCCESS"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-4 text-center">No background cron jobs detected.</p>
            )}
          </motion.div>

          {/* Report Configuration Completeness Auditor */}
          <motion.div variants={itemVariants} className="card p-6 sm:p-8 border border-border rounded-2xl bg-card shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-verified/10 text-verified flex items-center justify-center">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">Platform Report Configuration Completeness</h2>
                  <p className="text-xs text-muted-foreground">
                    Prerequisites required for generating legally compliant Indian FY tax and escrow audit reports.
                  </p>
                </div>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full ${
                  data.reportConfigCompleteness?.isReady
                    ? "bg-verified/15 text-verified border border-verified/30"
                    : "bg-pending/15 text-pending border border-pending/30"
                }`}
              >
                {data.reportConfigCompleteness?.completenessPercent ?? 100}% Ready
              </span>
            </div>

            {data.reportConfigCompleteness?.items ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.reportConfigCompleteness.items.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between p-3 rounded-xl bg-card border border-border text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {item.isConfigured ? (
                        <CheckCircle2 className="w-4 h-4 text-verified shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-pending shrink-0" />
                      )}
                      <span className="font-semibold text-foreground truncate">{item.label}</span>
                    </div>
                    <span className="text-[11px] font-mono tabular-nums text-muted-foreground shrink-0 ml-2">
                      {item.isConfigured ? item.valueMasked || "CONFIGURED" : "MISSING"}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </motion.div>
        </div>
      )}

      {/* Tab Content: Overview & Financials */}
      {currentTab === "overview" && (
        <div id="panel-overview" role="tabpanel" aria-label="Overview & Financials" className="space-y-8">
          {/* Executive Real-Time KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* 1. Total Registered Users */}
            <motion.div
              variants={itemVariants}
              className="relative rounded-2xl border border-border/80 bg-card p-6 shadow-xs hover:border-primary/40 hover:shadow-md transition-all duration-300 flex flex-col justify-between group overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform duration-500" />
              <div>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Total Users
                  </span>
                  <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-3xl font-black tracking-tight text-foreground tabular-nums">
                  {formatNumber(data.realTime.totalUsers)}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  <span className="font-bold text-foreground">{formatNumber(data.realTime.totalInfluencers)}</span> Creators · <span className="font-bold text-foreground">{formatNumber(data.realTime.totalBrands)}</span> Brands
                </span>
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-verified bg-verified/10 px-1.5 py-0.5 rounded-md">
                  <TrendingUp className="w-3 h-3" />
                  +{data.growthMetrics.signupGrowthRate}%
                </span>
              </div>
            </motion.div>

            {/* 2. Active Users (7D) */}
            <motion.div
              variants={itemVariants}
              className="relative rounded-2xl border border-border/80 bg-card p-6 shadow-xs hover:border-pending/40 hover:shadow-md transition-all duration-300 flex flex-col justify-between group overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-pending/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform duration-500" />
              <div>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Active (7d)
                  </span>
                  <div className="p-2.5 rounded-xl bg-pending/10 border border-pending/20 text-pending shrink-0">
                    <UserCheck className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-3xl font-black tracking-tight text-pending tabular-nums">
                  {formatNumber(data.realTime.activeUsers7d)}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border/60 flex flex-col gap-1.5 text-xs">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Weekly Retention</span>
                  <span className="font-bold text-foreground tabular-nums">{retentionPercent}%</span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-pending rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, retentionPercent)}%` }}
                  />
                </div>
              </div>
            </motion.div>

            {/* 3. Active Deals Pipeline */}
            <motion.div
              variants={itemVariants}
              className="relative rounded-2xl border border-border/80 bg-card p-6 shadow-xs hover:border-escrow/40 hover:shadow-md transition-all duration-300 flex flex-col justify-between group overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-escrow/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform duration-500" />
              <div>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Active Deals
                  </span>
                  <div className="p-2.5 rounded-xl bg-escrow/10 border border-escrow/20 text-escrow shrink-0">
                    <Briefcase className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-3xl font-black tracking-tight text-escrow tabular-nums">
                  {formatNumber(data.realTime.activeDeals)}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  <span className="font-bold text-foreground">{data.activity.totalCompletedDeals}</span> Completed deals
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-escrow bg-escrow/10 px-2 py-0.5 rounded-full">
                  In Pipeline
                </span>
              </div>
            </motion.div>

            {/* 4. Resolved Fee Revenue Today */}
            <motion.div
              variants={itemVariants}
              className="relative rounded-2xl border border-border/80 bg-card p-6 shadow-xs hover:border-verified/40 hover:shadow-md transition-all duration-300 flex flex-col justify-between group overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-verified/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform duration-500" />
              <div>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Revenue Today
                  </span>
                  <div className="p-2.5 rounded-xl bg-verified/10 border border-verified/20 text-verified shrink-0">
                    <IndianRupee className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-3xl font-black tracking-tight text-verified tabular-nums">
                  {fmt(data.realTime.revenueToday)}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs">
                <span className="text-muted-foreground truncate">
                  Platform Fee Share
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-verified bg-verified/10 px-2 py-0.5 rounded-full shrink-0">
                  <ShieldCheck className="w-3 h-3" /> Settled
                </span>
              </div>
            </motion.div>
          </div>

          {/* Hero Financial Ledger & Performance Section */}
          <motion.div
            variants={itemVariants}
            className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-xs relative overflow-hidden"
          >
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 pb-6 border-b border-border/70">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-bold tracking-tight text-foreground">
                    Financial Performance &amp; Escrow Ledger
                  </h2>
                </div>
                <p className="text-xs text-muted-foreground pl-9">
                  12-month gross escrow merchandise volume, settled platform fee revenue, and settlement cadence.
                </p>
              </div>

              {/* Financial Summary Badges */}
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex flex-col bg-muted/40 px-4 py-2.5 rounded-xl border border-border/60">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs font-semibold text-muted-foreground">Total GMV</span>
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-verified/15 text-verified">
                      <ShieldCheck className="w-2.5 h-2.5" /> VERIFIED
                    </span>
                  </div>
                  <span className="text-2xl font-black tracking-tight text-foreground tabular-nums">
                    {fmt(data.financials.totalGMV)}
                  </span>
                </div>

                <div className="flex flex-col bg-muted/40 px-4 py-2.5 rounded-xl border border-border/60">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs font-semibold text-muted-foreground">Resolved Fee Revenue</span>
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-verified/15 text-verified">
                      <ShieldCheck className="w-2.5 h-2.5" /> SETTLED
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black tracking-tight text-verified tabular-nums">
                      {fmt(data.financials.actualResolvedRevenue ?? data.financials.totalRevenue)}
                    </span>
                    {data.financials.bookedEscrowRevenue !== undefined && data.financials.bookedEscrowRevenue > 0 && (
                      <span className="text-[11px] font-medium text-muted-foreground">
                        (+ {fmt(data.financials.bookedEscrowRevenue)} held)
                      </span>
                    )}
                  </div>
                </div>

                {/* View Mode Switcher */}
                <div className="inline-flex rounded-xl bg-muted/70 p-1 border border-border shadow-xs">
                  <button
                    type="button"
                    onClick={() => setChartViewMode("ALL")}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      chartViewMode === "ALL"
                        ? "bg-card text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Combined
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartViewMode("GMV")}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      chartViewMode === "GMV"
                        ? "bg-card text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    GMV
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartViewMode("REVENUE")}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      chartViewMode === "REVENUE"
                        ? "bg-card text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Revenue
                  </button>
                </div>
              </div>
            </div>

            {/* Main Bar Chart */}
            <div className="w-full mt-6 h-[340px]">
              {chartsReady ? (
                <ResponsiveContainer width="100%" height={340} minWidth={100}>
                  <BarChart
                    data={data.financials.revenueHistory}
                    margin={{ top: 16, right: 16, left: 0, bottom: 4 }}
                    barGap={6}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="currentColor"
                      className="text-border/40"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="month"
                      stroke="currentColor"
                      className="text-muted-foreground text-xs font-medium"
                      tickFormatter={(str: string) => str?.slice(0, 3)}
                      axisLine={false}
                      tickLine={false}
                      dy={10}
                    />
                    <YAxis
                      yAxisId="revenue"
                      orientation="left"
                      stroke="currentColor"
                      className="text-muted-foreground text-[11px] font-mono"
                      tickFormatter={formatAxisPaise}
                      axisLine={false}
                      tickLine={false}
                      dx={-8}
                    />
                    <YAxis
                      yAxisId="gmv"
                      orientation="right"
                      stroke="currentColor"
                      className="text-muted-foreground text-[11px] font-mono"
                      tickFormatter={formatAxisPaise}
                      axisLine={false}
                      tickLine={false}
                      dx={8}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(255, 255, 255, 0.04)" }}
                      content={({ active, payload, label }) => {
                        if (!active || !payload || !payload.length) return null;
                        const gmvVal = Number(payload.find((p) => p.dataKey === "gmv")?.value || 0);
                        const revVal = Number(payload.find((p) => p.dataKey === "revenue")?.value || 0);
                        const takeRate = gmvVal > 0 ? ((revVal / gmvVal) * 100).toFixed(1) : "0.0";
                        return (
                          <div className="p-3.5 rounded-xl bg-card/95 border border-border shadow-xl backdrop-blur-md text-xs space-y-2 min-w-[200px]">
                            <div className="font-bold text-foreground border-b border-border/60 pb-1.5 flex items-center justify-between">
                              <span>{label}</span>
                              <span className="text-[10px] font-mono font-normal text-muted-foreground">
                                Escrow Audit
                              </span>
                            </div>
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-muted-foreground flex items-center gap-1.5">
                                  <span className="w-2.5 h-2.5 rounded-sm bg-primary inline-block" />
                                  Gross Volume (GMV):
                                </span>
                                <span className="font-bold text-foreground tabular-nums">
                                  {fmt(gmvVal)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-muted-foreground flex items-center gap-1.5">
                                  <span className="w-2.5 h-2.5 rounded-sm bg-escrow inline-block" />
                                  Net Platform Fee:
                                </span>
                                <span className="font-bold text-verified tabular-nums">
                                  {fmt(revVal)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-4 pt-1 border-t border-border/40 text-[11px]">
                                <span className="text-muted-foreground">Effective Take Rate:</span>
                                <span className="font-extrabold text-foreground">{takeRate}%</span>
                              </div>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      wrapperStyle={{ paddingBottom: 16 }}
                      iconType="circle"
                      iconSize={8}
                    />
                    {(chartViewMode === "ALL" || chartViewMode === "GMV") && (
                      <Bar
                        yAxisId="gmv"
                        dataKey="gmv"
                        fill="url(#gmvGrad)"
                        name="Gross Volume (GMV)"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={48}
                      />
                    )}
                    {(chartViewMode === "ALL" || chartViewMode === "REVENUE") && (
                      <Bar
                        yAxisId="revenue"
                        dataKey="revenue"
                        fill="url(#revGrad)"
                        name="Net Platform Revenue"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={48}
                      />
                    )}
                    <defs>
                      <linearGradient id="gmvGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.85} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                      </linearGradient>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--escrow))" stopOpacity={0.85} />
                        <stop offset="100%" stopColor="hsl(var(--escrow))" stopOpacity={0.25} />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full rounded-2xl bg-muted/20 animate-pulse" />
              )}
            </div>
          </motion.div>

          {/* User Growth & Health / Risk Operational Cockpit */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* User Acquisition Growth Trajectory (30-Day) */}
            <motion.div
              variants={itemVariants}
              className="lg:col-span-2 rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-foreground tracking-tight">
                        User Growth (30 Days)
                      </h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        Daily Run-rate
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Acquisition progression split by creators vs commercial brand sponsors.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" />
                      <span>Total ({data.growthMetrics.signupsLast30})</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-semibold">
                      <span className="w-2.5 h-2.5 rounded-full bg-verified inline-block" />
                      <span>Creators</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-semibold">
                      <span className="w-2.5 h-2.5 rounded-full bg-accent inline-block" />
                      <span>Brands</span>
                    </div>
                  </div>
                </div>

                <div className="w-full h-[280px]">
                  {chartsReady ? (
                    <ResponsiveContainer width="100%" height={280} minWidth={100}>
                      <LineChart data={data.growth} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="currentColor"
                          className="text-border/40"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="date"
                          stroke="currentColor"
                          className="text-muted-foreground text-[11px] font-mono"
                          tickFormatter={(str: string) => (str && str.length >= 10 ? str.slice(5) : str)}
                          axisLine={false}
                          tickLine={false}
                          dy={10}
                        />
                        <YAxis
                          stroke="currentColor"
                          className="text-muted-foreground text-[11px] font-mono"
                          axisLine={false}
                          tickLine={false}
                          dx={-6}
                        />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (!active || !payload || !payload.length) return null;
                            return (
                              <div className="p-3 rounded-xl bg-card/95 border border-border shadow-xl backdrop-blur-md text-xs space-y-1.5 min-w-[170px]">
                                <div className="font-bold text-foreground border-b border-border/50 pb-1">
                                  {label}
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-primary" /> New Users:
                                  </span>
                                  <span className="font-bold text-foreground">
                                    {payload.find((p) => p.dataKey === "total")?.value ?? 0}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-verified" /> Creators:
                                  </span>
                                  <span className="font-bold text-verified">
                                    {payload.find((p) => p.dataKey === "influencer")?.value ?? 0}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-accent" /> Brands:
                                  </span>
                                  <span className="font-bold text-accent">
                                    {payload.find((p) => p.dataKey === "brand")?.value ?? 0}
                                  </span>
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="total"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2.5}
                          dot={false}
                          activeDot={{
                            r: 5,
                            fill: "hsl(var(--primary))",
                            stroke: "hsl(var(--background))",
                            strokeWidth: 2,
                          }}
                          name="New Users"
                        />
                        <Line
                          type="monotone"
                          dataKey="influencer"
                          stroke="hsl(var(--verified))"
                          strokeWidth={2}
                          dot={false}
                          name="Influencers"
                        />
                        <Line
                          type="monotone"
                          dataKey="brand"
                          stroke="hsl(var(--accent))"
                          strokeWidth={2}
                          dot={false}
                          name="Brands"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="w-full h-full rounded-2xl bg-muted/20 animate-pulse" />
                  )}
                </div>
              </div>
            </motion.div>

            {/* Health & Risk Cockpit */}
            <motion.div
              variants={itemVariants}
              className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
                      <Shield className="w-4 h-4 text-verified" />
                      Health &amp; Risk
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Platform fraud resilience and operational thresholds.
                    </p>
                  </div>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-verified/15 text-verified border border-verified/30">
                    Optimal
                  </span>
                </div>

                <div className="space-y-3">
                  {/* Payment Success Rate */}
                  <div className="p-3 rounded-xl bg-muted/40 border border-border/70">
                    <div className="flex items-center justify-between mb-1.5 text-xs font-semibold">
                      <span className="text-muted-foreground">Payment Success</span>
                      <span className="font-extrabold text-verified tabular-nums">
                        {data.systemHealth.paymentSuccessRate}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-verified rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, data.systemHealth.paymentSuccessRate)}%` }}
                      />
                    </div>
                  </div>

                  {/* Recent Errors */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/70 text-xs">
                    <span className="font-semibold text-muted-foreground">Recent Errors</span>
                    <div className="flex items-center gap-1.5 font-extrabold tabular-nums">
                      <span className={data.systemHealth.recentErrors > 10 ? "text-destructive" : "text-verified"}>
                        {data.systemHealth.recentErrors}
                      </span>
                      <span className="text-[10px] font-normal text-muted-foreground">
                        {data.systemHealth.recentErrors === 0 ? "Zero incidents" : "Active alerts"}
                      </span>
                    </div>
                  </div>

                  {/* Fraud Alerts */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/70 text-xs">
                    <span className="font-semibold text-muted-foreground">Fraud Alerts</span>
                    <div className="flex items-center gap-1.5 font-extrabold tabular-nums">
                      <span className={data.systemHealth.fraudAlerts > 5 ? "text-destructive" : "text-verified"}>
                        {data.systemHealth.fraudAlerts}
                      </span>
                      <span className="text-[10px] font-normal text-muted-foreground">
                        {data.systemHealth.fraudAlerts === 0 ? "Protected" : "Action required"}
                      </span>
                    </div>
                  </div>

                  {/* Open Disputes */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/70 text-xs">
                    <span className="font-semibold text-muted-foreground">Open Disputes</span>
                    <div className="flex items-center gap-1.5 font-extrabold tabular-nums">
                      <span className={data.activity.disputesOpen > 5 ? "text-destructive" : "text-verified"}>
                        {data.activity.disputesOpen}
                      </span>
                      <span className="text-[10px] font-normal text-muted-foreground">
                        {data.activity.disputesOpen === 0 ? "Zero in review" : "In arbitration"}
                      </span>
                    </div>
                  </div>

                  {/* Viral K-Factor */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/70 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-muted-foreground">K-Factor</span>
                      <span className="text-[10px] text-muted-foreground/80">(Viral Growth)</span>
                    </div>
                    <span className="font-extrabold text-foreground tabular-nums">
                      {data.growthMetrics.kFactor.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border/60 text-[11px] text-muted-foreground flex items-center justify-between">
                <span>Network Integrity</span>
                <span className="font-bold text-verified flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 100% Guaranteed
                </span>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
