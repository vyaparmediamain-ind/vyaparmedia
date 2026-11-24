"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion, Variants } from "framer-motion";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
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
    revenueHistory: Array<{ month: string; revenue: number; gmv: number }>;
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
  hidden: { opacity: shouldReduceMotion ? 1 : 0, y: shouldReduceMotion ? 0 : 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 24 },
  },
});

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
  const fmt = (v: number) => formatCurrency(v);

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

  const containerVariants: Variants = {
    hidden: { opacity: shouldReduceMotion ? 1 : 0 },
    show: {
      opacity: 1,
      transition: shouldReduceMotion ? { duration: 0 } : { staggerChildren: 0.08 },
    },
  };

  const itemVariants = getItemVariants(shouldReduceMotion);

  useEffect(() => {
    const id = window.setTimeout(() => setChartsReady(true), 50);
    return () => window.clearTimeout(id);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "HEALTHY": return "bg-verified shadow-verified/50";
      case "WARNING": return "bg-pending shadow-pending/50";
      default: return "bg-destructive shadow-destructive/50";
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case "HEALTHY": return "text-verified";
      case "WARNING": return "text-pending";
      default: return "text-destructive";
    }
  };

  return (
    <motion.div
      className="flex flex-col gap-8"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div
        variants={itemVariants}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4"
      >
        <div role="tablist" aria-label="Admin Analytics Navigation" className="inline-flex flex-wrap rounded-xl bg-muted/60 p-1 border border-border">
          <button
            type="button"
            role="tab"
            aria-selected={currentTab === "overview"}
            aria-controls="panel-overview"
            onClick={() => handleTabChange("overview")}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-primary focus:outline-none ${
              currentTab === "overview"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
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
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-primary focus:outline-none ${
              currentTab === "funnel"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
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
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-primary focus:outline-none ${
              currentTab === "crons"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
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
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-primary focus:outline-none ${
              currentTab === "traffic"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-primary" />
            <span>Traffic &amp; Behaviour</span>
          </button>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 bg-card/60 border border-border rounded-full backdrop-blur-xl shrink-0">
          <div
            className={`w-2.5 h-2.5 rounded-full shadow-lg animate-pulse ${getStatusColor(
              data.systemHealth.status
            )}`}
          />
          <span
            className={`text-sm font-semibold tracking-wide ${getStatusTextColor(
              data.systemHealth.status
            )}`}
          >
            System Status: {data.systemHealth.status}
          </span>
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
          <motion.div variants={itemVariants} className="card p-6 sm:p-8 border border-border glass rounded-2xl space-y-6">
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
          <motion.div variants={itemVariants} className="card p-6 sm:p-8 border border-border glass rounded-2xl space-y-6">
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
                  Derived using reach estimators, category baselines, and engagement modeling.
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
                  User profile inputs and non-verified onboarding metrics.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Tab Content: Cron Health & Config */}
      {currentTab === "crons" && (
        <div id="panel-crons" role="tabpanel" aria-label="Cron Health & Config" className="space-y-6">
          {/* Cron Health Monitor */}
          <motion.div variants={itemVariants} className="card p-6 sm:p-8 border border-border glass rounded-2xl space-y-6">
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
          <motion.div variants={itemVariants} className="card p-6 sm:p-8 border border-border glass rounded-2xl space-y-6">
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
        <div id="panel-overview" role="tabpanel" aria-label="Overview & Financials" className="space-y-6">
          {/* Real-Time Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              icon="US"
              label="Total Users"
              value={formatNumber(data.realTime.totalUsers)}
              gradient="from-primary/20 to-accent/20"
              textColor="text-primary"
            />
            <MetricCard
              icon="AU"
              label="Active (7d)"
              value={formatNumber(data.realTime.activeUsers7d)}
              gradient="from-pending/20 to-pending/10"
              textColor="text-pending"
            />
            <MetricCard
              icon="DL"
              label="Active Deals"
              value={formatNumber(data.realTime.activeDeals)}
              gradient="from-escrow/20 to-verified/20"
              textColor="text-escrow"
            />
            <MetricCard
              icon="RV"
              label="Revenue Today"
              value={fmt(data.realTime.revenueToday)}
              gradient="from-verified/20 to-escrow/20"
              textColor="text-verified"
            />
          </div>

          {/* Financial Overview */}
          <motion.div variants={itemVariants} className="card relative overflow-hidden group border border-border glass">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-verified/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10 p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-6">
                <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
                  Financial Performance &amp; Escrow Ledger
                </h2>
                <div className="flex flex-wrap gap-8">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-muted-foreground font-medium">Total GMV</span>
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-verified/15 text-verified">
                        <ShieldCheck className="w-3 h-3" /> VERIFIED
                      </span>
                    </div>
                    <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums">{fmt(data.financials.totalGMV)}</span>
                  </div>

                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-muted-foreground font-medium">Resolved Fee Revenue</span>
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-verified/15 text-verified">
                        <ShieldCheck className="w-3 h-3" /> SETTLED
                      </span>
                    </div>
                    <span className="text-2xl font-bold tracking-tight text-verified tabular-nums">
                      {fmt(data.financials.actualResolvedRevenue ?? data.financials.totalRevenue)}
                    </span>
                    {data.financials.bookedEscrowRevenue !== undefined && data.financials.bookedEscrowRevenue > 0 && (
                      <span className="text-[11px] text-muted-foreground">
                        + {fmt(data.financials.bookedEscrowRevenue)} held in active escrow
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="w-full mt-4 h-[350px]">
                {chartsReady ? (
                  <ResponsiveContainer width="100%" height={350} minWidth={100}>
                    <BarChart data={data.financials.revenueHistory} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/40" vertical={false} />
                      <XAxis dataKey="month" stroke="currentColor" className="text-muted-foreground text-xs" tickFormatter={(str) => str.slice(0, 3)} axisLine={false} tickLine={false} dy={10} />
                      <YAxis yAxisId="left" stroke="currentColor" className="text-muted-foreground text-xs" tickFormatter={(val) => `Rs ${val / 1000}k`} axisLine={false} tickLine={false} dx={-10} />
                      <YAxis yAxisId="right" orientation="right" stroke="currentColor" className="text-muted-foreground text-xs" tickFormatter={(val) => `Rs ${val / 1000}k`} axisLine={false} tickLine={false} dx={10} />
                      <Tooltip
                        cursor={{ fill: "rgba(255, 255, 255, 0.05)" }}
                        formatter={(value) => [fmt(typeof value === "number" ? value : Number(value) || 0), ""]}
                      />
                      <Legend />
                      <Bar yAxisId="right" dataKey="gmv" fill="url(#gmvGrad)" name="GMV" radius={[6, 6, 0, 0]} />
                      <Bar yAxisId="left" dataKey="revenue" fill="url(#revGrad)" name="Net Revenue" radius={[6, 6, 0, 0]} />
                      <defs>
                        <linearGradient id="gmvGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                        </linearGradient>
                        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--escrow))" stopOpacity={0.8} />
                          <stop offset="100%" stopColor="hsl(var(--escrow))" stopOpacity={0.2} />
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full rounded-2xl bg-muted/10 animate-pulse" />
                )}
              </div>
            </div>
          </motion.div>

          {/* Growth & Health Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* User Growth Chart */}
            <motion.div variants={itemVariants} className="card lg:col-span-2 relative overflow-hidden group border border-border glass p-6 sm:p-8">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10">
                <h3 className="text-lg font-bold mb-6 text-foreground tracking-tight">User Growth (30 Days)</h3>
                <div className="w-full h-[280px]">
                  {chartsReady ? (
                    <ResponsiveContainer width="100%" height={280} minWidth={100}>
                      <LineChart data={data.growth} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/40" vertical={false} />
                        <XAxis dataKey="date" stroke="currentColor" className="text-muted-foreground text-xs" tickFormatter={(str) => str.slice(5)} axisLine={false} tickLine={false} dy={10} />
                        <YAxis stroke="currentColor" className="text-muted-foreground text-xs" axisLine={false} tickLine={false} dx={-10} />
                        <Tooltip />
                        <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 2 }} name="New Users" />
                        <Line type="monotone" dataKey="brand" stroke="hsl(var(--accent))" strokeWidth={3} dot={false} name="Brands" />
                        <Line type="monotone" dataKey="influencer" stroke="hsl(var(--verified))" strokeWidth={3} dot={false} name="Influencers" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="w-full h-full rounded-2xl bg-muted/10 animate-pulse" />
                  )}
                </div>
              </div>
            </motion.div>

            {/* System Health */}
            <motion.div variants={itemVariants} className="card relative overflow-hidden group border border-border glass p-6 sm:p-8">
              <div className="absolute inset-0 bg-gradient-to-br from-verified/5 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10 flex flex-col h-full">
                <h3 className="text-lg font-bold mb-6 text-foreground tracking-tight flex items-center gap-2">
                  Health &amp; Risk
                </h3>
                <div className="flex flex-col gap-4 flex-grow justify-center">
                  <HealthRow
                    label="Payment Success"
                    value={`${data.systemHealth.paymentSuccessRate}%`}
                    color={data.systemHealth.paymentSuccessRate > 95 ? "text-verified" : "text-pending"}
                  />
                  <HealthRow
                    label="Recent Errors"
                    value={data.systemHealth.recentErrors}
                    color={data.systemHealth.recentErrors > 10 ? "text-destructive" : "text-verified"}
                  />
                  <HealthRow
                    label="Fraud Alerts"
                    value={data.systemHealth.fraudAlerts}
                    color={data.systemHealth.fraudAlerts > 5 ? "text-destructive" : "text-verified"}
                  />
                  <HealthRow
                    label="Open Disputes"
                    value={data.activity.disputesOpen}
                    color={data.activity.disputesOpen > 5 ? "text-destructive" : "text-verified"}
                  />
                  <div className="h-px w-full bg-border my-2" />
                  <HealthRow
                    label="K-Factor"
                    value={data.growthMetrics.kFactor.toFixed(2)}
                    color={data.growthMetrics.kFactor >= 1 ? "text-verified" : "text-pending"}
                  />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

interface MetricCardProps {
  readonly icon: string;
  readonly label: string;
  readonly value: string | number;
  readonly gradient: string;
  readonly textColor: string;
}

function MetricCard({ icon, label, value, gradient, textColor }: MetricCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const itemVariants = getItemVariants(shouldReduceMotion);
  return (
    <motion.div variants={itemVariants} className="relative group">
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} rounded-2xl blur-xl opacity-50 group-hover:opacity-100 transition-opacity duration-500`} />
      <div className="relative bg-card card glass border border-border rounded-2xl p-6 hover:-translate-y-1 transition-transform duration-300">
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-muted-foreground mb-1">{label}</span>
            <span className={`text-3xl font-bold tracking-tight ${textColor}`}>{value}</span>
          </div>
          <div className="text-3xl filter drop-shadow-md">{icon}</div>
        </div>
      </div>
    </motion.div>
  );
}

function HealthRow({ label, value, color }: Readonly<{ label: string; value: string | number; color: string }>) {
  return (
    <div className="flex justify-between items-center bg-muted/60 rounded-lg p-3 border border-border transition-colors hover:bg-muted">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className={`text-base font-bold drop-shadow-sm ${color}`}>{value}</span>
    </div>
  );
}
