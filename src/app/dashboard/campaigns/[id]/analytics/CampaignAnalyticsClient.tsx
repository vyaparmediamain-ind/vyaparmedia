"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  BarChart3,
  TrendingUp,
  Users,
  Globe,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  Search,
  Clock,
  Layers,
  Smartphone,
  Monitor,
  Tablet,
  CheckCircle2,
  DollarSign,
  Eye,
  Heart,
  Target,
  Filter,
  IndianRupee,
  Download,
  ShieldCheck,
  Receipt,
  FileText,
} from "lucide-react";
import { CampaignPerformanceReportModal } from "@/components/reports/CampaignPerformanceReportModal";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { PageHeader, Button, Badge, Skeleton } from "@/components/ui";
import { formatCurrency, formatNumber } from "@/lib/utils-client";
import { apiClient } from "@/lib/api-client";
import { formatUserError } from "@/lib/user-messages";
import type { CampaignFullAnalyticsData } from "@/services/campaign-metrics.service";
import {
  aggregateCampaignFinance,
  type CalculatedDealFinance,
} from "@/lib/campaign-finance";

interface CampaignAnalyticsClientProps {
  campaignId: string;
}

type TabKey = "overview" | "funnel" | "creators" | "audience" | "finance";

export function CampaignAnalyticsClient({ campaignId }: CampaignAnalyticsClientProps) {
  const [data, setData] = useState<CampaignFullAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [chartsReady, setChartsReady] = useState(false);

  // Creators tab filters & pagination
  const [creatorSearch, setCreatorSearch] = useState("");
  const [creatorSort, setCreatorSort] = useState<
    "views" | "payout" | "cpv" | "cpe" | "roi" | "drs"
  >("views");
  const [creatorSortDir, setCreatorSortDir] = useState<"asc" | "desc">("desc");
  const [creatorPage, setCreatorPage] = useState(1);
  const pageSize = 10;

  // Finance tab filters & pagination
  const [selectedFy, setSelectedFy] = useState<string>("ALL");
  const [financeSearch, setFinanceSearch] = useState<string>("");
  const [financePage, setFinancePage] = useState<number>(1);

  // Official Branded Performance Report Modal
  const [showPerformanceReportModal, setShowPerformanceReportModal] = useState<boolean>(false);

  useEffect(() => {
    setChartsReady(true);
  }, []);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.campaigns.getAnalytics(campaignId);
      if (res && res.data) {
        setData(res.data);
      } else {
        throw new Error("Unable to retrieve campaign analytics data.");
      }
    } catch (err: unknown) {
      setError(
        formatUserError(
          err,
          "Failed to load campaign analytics. Please verify ownership and permissions."
        )
      );
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Filtered & sorted creators list
  const filteredCreators = useMemo(() => {
    if (!data?.creators) return [];
    let list = [...data.creators];

    if (creatorSearch.trim()) {
      const q = creatorSearch.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.handle && c.handle.toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => {
      let valA = 0;
      let valB = 0;
      switch (creatorSort) {
        case "views":
          valA = a.deliveredViews;
          valB = b.deliveredViews;
          break;
        case "payout":
          valA = a.amountPaise;
          valB = b.amountPaise;
          break;
        case "cpv":
          valA = a.cpvPaise;
          valB = b.cpvPaise;
          break;
        case "cpe":
          valA = a.cpePaise;
          valB = b.cpePaise;
          break;
        case "roi":
          valA = a.roiScore;
          valB = b.roiScore;
          break;
        case "drs":
          valA = a.drsScore;
          valB = b.drsScore;
          break;
      }
      return creatorSortDir === "desc" ? valB - valA : valA - valB;
    });

    return list;
  }, [data?.creators, creatorSearch, creatorSort, creatorSortDir]);

  const totalCreatorPages = Math.max(1, Math.ceil(filteredCreators.length / pageSize));
  const paginatedCreators = useMemo(() => {
    const start = (creatorPage - 1) * pageSize;
    return filteredCreators.slice(start, start + pageSize);
  }, [filteredCreators, creatorPage, pageSize]);

  // Dynamic client-side Indian FY finance aggregation
  const currentFinance = useMemo(() => {
    if (!data?.finance) return null;
    const { deals, summary: initialSummary, taxSummary, availableFys } = data.finance;

    if (selectedFy === "ALL") {
      return { summary: initialSummary, deals, taxSummary, availableFys };
    }

    const rawDeals = deals.map((d) => ({
      id: d.id,
      campaignId: data.campaign.id,
      influencerId: "",
      influencerName: d.creatorName,
      influencerHandle: d.creatorHandle,
      status: d.status,
      amount: d.amountPaise,
      platformFee: d.platformFeePaise,
      gatewayFee: d.gatewayFeePaise,
      influencerPayout: d.influencerPayoutPaise,
      tdsDeducted: d.tdsDeductedPaise,
      grossPayout: d.grossPayoutPaise,
      netPayout: d.netPayoutPaise,
      createdAt: new Date(d.createdAt),
      completedAt: d.completedAt ? new Date(d.completedAt) : null,
    }));

    const { summary, calculatedDeals } = aggregateCampaignFinance({
      budgetTotalPaise: data.campaign.totalBudgetPaise,
      deals: rawDeals,
      selectedFy,
    });

    return { summary, deals: calculatedDeals, taxSummary, availableFys };
  }, [data?.finance, data?.campaign, selectedFy]);

  // Filtered & paginated finance deals
  const filteredFinanceDeals = useMemo(() => {
    if (!currentFinance?.deals) return [];
    let list = [...currentFinance.deals];

    if (financeSearch.trim()) {
      const q = financeSearch.toLowerCase().trim();
      list = list.filter(
        (d) =>
          d.creatorName.toLowerCase().includes(q) ||
          (d.creatorHandle && d.creatorHandle.toLowerCase().includes(q)) ||
          d.id.toLowerCase().includes(q)
      );
    }
    return list;
  }, [currentFinance?.deals, financeSearch]);

  const totalFinancePages = Math.max(1, Math.ceil(filteredFinanceDeals.length / pageSize));
  const paginatedFinanceDeals = useMemo(() => {
    const start = (financePage - 1) * pageSize;
    return filteredFinanceDeals.slice(start, start + pageSize);
  }, [filteredFinanceDeals, financePage, pageSize]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <PageHeader
        title="Campaign Analytics & Attribution"
        subtitle="Audited multi-stage conversion funnel, creator performance, and telemetry audience analytics."
        backHref={`/dashboard/campaigns/${campaignId}`}
        backLabel="Back to Campaign Workspace"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              href={`/dashboard/campaigns/${campaignId}/roi`}
              variant="secondary"
              size="sm"
              className="text-xs font-semibold gap-1.5"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>ROI Financial Report</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowPerformanceReportModal(true)}
              className="text-xs font-semibold gap-1.5 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-primary" />
              <span>Performance Report (Print/CSV)</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchAnalytics}
              disabled={loading}
              className="text-xs font-semibold gap-1.5"
              title="Refresh real-time analytics"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Sync Realtime</span>
            </Button>
          </div>
        }
      />

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading analytics">
          <div className="h-10 w-full max-w-md bg-muted rounded-xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
          </div>
          <Skeleton className="h-72 rounded-3xl" />
        </div>
      )}

      {/* Error View */}
      {error && !loading && (
        <div className="p-6 rounded-2xl bg-destructive/10 border border-destructive/20 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-destructive">Analytics Load Error</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">{error}</p>
          </div>
          <Button onClick={fetchAnalytics} variant="secondary" size="sm" disabled={loading}>
            Retry
          </Button>
        </div>
      )}

      {/* Analytics Content */}
      {!loading && !error && data && (
        <div className="space-y-6">
          {/* Estimated Data Warning Banner */}
          {data.overview.hasEstimatedData && (
            <div className="p-4 rounded-2xl border border-pending-border bg-pending-muted text-pending flex items-start gap-3 shadow-xs">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-pending" />
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Estimated Data Warning
                  </span>
                  <Badge variant="warning" className="font-mono text-[10px]">
                    {Math.round(data.overview.apiViewsShareBps / 100)}% API Verified
                  </Badge>
                </div>
                <p className="text-xs leading-relaxed text-pending/90">
                  Some delivered views and engagement counts are derived or self-reported because
                  participating creators have not fully linked their official Meta/YouTube API
                  tokens. Metrics will automatically upgrade to <strong className="font-semibold">VERIFIED</strong> as social tokens sync.
                </p>
              </div>
            </div>
          )}

          {/* Tab Selector */}
          <div className="flex items-center gap-2 p-1.5 bg-muted/60 border border-border rounded-2xl w-full max-w-3xl overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === "overview"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BarChart3 className="w-4 h-4 text-primary" />
              <span>Overview</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("funnel")}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === "funnel"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <TrendingUp className="w-4 h-4 text-primary" />
              <span>Funnel Pipeline</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("creators")}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === "creators"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users className="w-4 h-4 text-primary" />
              <span>Creators ({data.creators.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("audience")}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === "audience"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Globe className="w-4 h-4 text-primary" />
              <span>Audience Telemetry</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("finance")}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === "finance"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <IndianRupee className="w-4 h-4 text-primary" />
              <span>Finance &amp; Tax</span>
            </button>
          </div>

          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* 6 Core KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Total Spend */}
                <div className="bg-card border border-border rounded-2xl p-5 space-y-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-primary" />
                      Total Spend
                    </span>
                    <Badge variant="success" className="font-mono text-[10px]">
                      VERIFIED ESCROW
                    </Badge>
                  </div>
                  <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                    {formatCurrency(data.overview.totalSpendPaise)}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center justify-between pt-1 border-t border-border/50">
                    <span>Budget Allocated</span>
                    <span className="font-semibold text-foreground">
                      ₹{data.campaign.totalBudgetRupees}
                    </span>
                  </div>
                </div>

                {/* Delivered Views */}
                <div className="bg-card border border-border rounded-2xl p-5 space-y-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-primary" />
                      Delivered Views
                    </span>
                    <Badge
                      variant={
                        data.overview.deliveredViewsQuality === "VERIFIED" ? "success" : "warning"
                      }
                      className="font-mono text-[10px]"
                    >
                      {data.overview.deliveredViewsQuality}
                    </Badge>
                  </div>
                  <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                    {formatNumber(data.overview.totalDeliveredViews)}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center justify-between pt-1 border-t border-border/50">
                    <span>API Verified Share</span>
                    <span className="font-semibold text-foreground">
                      {Math.round(data.overview.apiViewsShareBps / 100)}%
                    </span>
                  </div>
                </div>

                {/* Total Engagements */}
                <div className="bg-card border border-border rounded-2xl p-5 space-y-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Heart className="w-3.5 h-3.5 text-primary" />
                      Total Engagements
                    </span>
                    <Badge
                      variant={
                        data.overview.engagementsQuality === "VERIFIED" ? "success" : "warning"
                      }
                      className="font-mono text-[10px]"
                    >
                      {data.overview.engagementsQuality}
                    </Badge>
                  </div>
                  <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                    {formatNumber(data.overview.totalEngagements)}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center justify-between pt-1 border-t border-border/50">
                    <span>Interactions</span>
                    <span className="font-semibold text-foreground">Likes, Comments &amp; Saves</span>
                  </div>
                </div>

                {/* Blended CPV */}
                <div className="bg-card border border-border rounded-2xl p-5 space-y-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-primary" />
                      Blended CPV
                    </span>
                    <Badge
                      variant={
                        data.overview.blendedCpvQuality === "VERIFIED" ? "success" : "warning"
                      }
                      className="font-mono text-[10px]"
                    >
                      {data.overview.blendedCpvQuality}
                    </Badge>
                  </div>
                  <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                    ₹{data.overview.blendedCpvRupees}
                    <span className="text-xs font-normal text-muted-foreground ml-1.5">
                      ({data.overview.blendedCpvPaise}p)
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center justify-between pt-1 border-t border-border/50">
                    <span>Category Benchmark</span>
                    <span className="font-semibold text-foreground">
                      ₹{data.overview.categoryBaselineCpvRupees}
                    </span>
                  </div>
                </div>

                {/* Blended CPE */}
                <div className="bg-card border border-border rounded-2xl p-5 space-y-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Heart className="w-3.5 h-3.5 text-primary" />
                      Blended CPE
                    </span>
                    <Badge
                      variant={
                        data.overview.blendedCpeQuality === "VERIFIED" ? "success" : "warning"
                      }
                      className="font-mono text-[10px]"
                    >
                      {data.overview.blendedCpeQuality}
                    </Badge>
                  </div>
                  <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                    ₹{data.overview.blendedCpeRupees}
                    <span className="text-xs font-normal text-muted-foreground ml-1.5">
                      ({data.overview.blendedCpePaise}p)
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center justify-between pt-1 border-t border-border/50">
                    <span>Cost / Interaction</span>
                    <span className="font-semibold text-foreground">Spend ÷ Interactions</span>
                  </div>
                </div>

                {/* Relative ROI Score */}
                <div className="bg-card border border-border rounded-2xl p-5 space-y-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-primary" />
                      Relative ROI Score
                    </span>
                    <Badge
                      variant={
                        data.overview.roiScore >= 85
                          ? "success"
                          : data.overview.roiScore >= 70
                          ? "primary"
                          : data.overview.roiScore >= 50
                          ? "warning"
                          : "danger"
                      }
                      className="font-mono text-[10px]"
                    >
                      {data.overview.roiScore >= 85
                        ? "SUPERIOR"
                        : data.overview.roiScore >= 70
                        ? "FAIR VALUE"
                        : data.overview.roiScore >= 50
                        ? "MODERATE"
                        : "OVERPRICED"}
                    </Badge>
                  </div>
                  <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                    {data.overview.roiScore}
                    <span className="text-xs font-normal text-muted-foreground ml-1">/ 100</span>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center justify-between pt-1 border-t border-border/50">
                    <span>Category Basis</span>
                    <span className="font-semibold text-foreground truncate max-w-[150px]">
                      {data.campaign.targetCategories.join(", ") || "General"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Daily Trend Time-Series Chart */}
              <div className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-primary" />
                      <span>Daily Delivery &amp; Exposure Trajectory</span>
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Continuous daily aggregates across brief views, verified video deliveries, and interactions.
                    </p>
                  </div>
                  <Badge variant="ghost" className="font-mono text-[10px]">
                    Asia/Kolkata Daily Rollup
                  </Badge>
                </div>

                {data.dailyTimeseries.length === 0 ? (
                  <div className="h-56 flex flex-col items-center justify-center border border-dashed border-border rounded-xl text-center p-6 space-y-2">
                    <Clock className="w-6 h-6 text-muted-foreground" />
                    <p className="text-xs font-semibold text-foreground">
                      No daily trend snapshots recorded yet
                    </p>
                    <p className="text-[11px] text-muted-foreground max-w-sm">
                      Daily rollup snapshots are aggregated automatically each afternoon at 13:30 IST (08:00 UTC).
                    </p>
                  </div>
                ) : (
                  <div className="w-full h-72">
                    {chartsReady ? (
                      <ResponsiveContainer width="100%" height={280}>
                        <AreaChart
                          data={data.dailyTimeseries}
                          margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                            </linearGradient>
                            <linearGradient id="briefsGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--escrow))" stopOpacity={0.8} />
                              <stop offset="95%" stopColor="hsl(var(--escrow))" stopOpacity={0.05} />
                            </linearGradient>
                            <linearGradient id="engGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--verified))" stopOpacity={0.8} />
                              <stop offset="95%" stopColor="hsl(var(--verified))" stopOpacity={0.05} />
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
                            className="text-muted-foreground text-xs"
                            tickFormatter={(str) => {
                              const parts = str.split("-");
                              return parts.length >= 3 ? `${parts[2]}/${parts[1]}` : str;
                            }}
                            axisLine={false}
                            tickLine={false}
                            dy={8}
                          />
                          <YAxis
                            stroke="currentColor"
                            className="text-muted-foreground text-xs"
                            tickFormatter={(val) =>
                              val >= 1000 ? `${(val / 1000).toFixed(0)}k` : String(val)
                            }
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              borderColor: "hsl(var(--border))",
                              borderRadius: "0.75rem",
                              fontSize: "0.75rem",
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: "0.75rem", paddingTop: "0.5rem" }} />
                          <Area
                            type="monotone"
                            dataKey="deliveredViews"
                            name="Delivered Views"
                            stroke="hsl(var(--primary))"
                            fillOpacity={1}
                            fill="url(#viewsGrad)"
                            strokeWidth={2}
                          />
                          <Area
                            type="monotone"
                            dataKey="briefViews"
                            name="Brief Views"
                            stroke="hsl(var(--escrow))"
                            fillOpacity={0.4}
                            fill="url(#briefsGrad)"
                            strokeWidth={1.5}
                          />
                          <Area
                            type="monotone"
                            dataKey="engagements"
                            name="Engagements"
                            stroke="hsl(var(--verified))"
                            fillOpacity={0.3}
                            fill="url(#engGrad)"
                            strokeWidth={1.5}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="w-full h-full rounded-2xl bg-muted/20 animate-pulse" />
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: FUNNEL */}
          {activeTab === "funnel" && (
            <div className="space-y-6">
              {/* Funnel Overview Banner */}
              <div className="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Layers className="w-4 h-4 text-primary" />
                      <span>Multi-Stage Conversion Attribution Pipeline</span>
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      End-to-end recruitment and fulfillment velocity from brief discovery to verified post completion.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Overall Brief-to-Complete:</span>
                    <Badge variant="primary" className="font-mono text-xs font-bold">
                      {data.funnel.overallConversionPercent}%
                    </Badge>
                  </div>
                </div>

                {/* Pipeline Stages Vertical / Stepper */}
                <div className="grid grid-cols-1 md:grid-cols-7 gap-3 pt-4">
                  {/* Stage 1: Brief Views */}
                  <div className="bg-muted/40 border border-border rounded-xl p-3 space-y-2 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                        <span>1. Brief Views</span>
                        <Eye className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div className="text-xl font-bold text-foreground mt-1 tabular-nums">
                        {formatNumber(data.funnel.briefViews)}
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground pt-2 border-t border-border/40">
                      Campaign visits
                    </div>
                  </div>

                  {/* Stage 2: Applications */}
                  <div className="bg-muted/40 border border-border rounded-xl p-3 space-y-2 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                        <span>2. Applied</span>
                        <Filter className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div className="text-xl font-bold text-foreground mt-1 tabular-nums">
                        {formatNumber(data.funnel.applications)}
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground pt-2 border-t border-border/40">
                      <span className="font-bold text-foreground">
                        {data.funnel.viewsToAppPercent}%
                      </span>{" "}
                      conv ({Math.max(0, Number((100 - data.funnel.viewsToAppPercent).toFixed(1)))}% drop)
                    </div>
                  </div>

                  {/* Stage 3: Shortlisted */}
                  <div className="bg-muted/40 border border-border rounded-xl p-3 space-y-2 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                        <span>3. Shortlist</span>
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div className="text-xl font-bold text-foreground mt-1 tabular-nums">
                        {formatNumber(data.funnel.shortlisted)}
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground pt-2 border-t border-border/40">
                      <span className="font-bold text-foreground">
                        {data.funnel.appToShortlistPercent}%
                      </span>{" "}
                      conv
                    </div>
                  </div>

                  {/* Stage 4: Hired */}
                  <div className="bg-muted/40 border border-border rounded-xl p-3 space-y-2 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                        <span>4. Hired</span>
                        <Users className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div className="text-xl font-bold text-foreground mt-1 tabular-nums">
                        {formatNumber(data.funnel.hired)}
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground pt-2 border-t border-border/40">
                      <span className="font-bold text-foreground">
                        {data.funnel.shortlistToHirePercent}%
                      </span>{" "}
                      conv
                    </div>
                  </div>

                  {/* Stage 5: Content Submitted */}
                  <div className="bg-muted/40 border border-border rounded-xl p-3 space-y-2 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                        <span>5. Submitted</span>
                        <Clock className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div className="text-xl font-bold text-foreground mt-1 tabular-nums">
                        {formatNumber(data.funnel.contentSubmitted)}
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground pt-2 border-t border-border/40">
                      <span className="font-bold text-foreground">
                        {data.funnel.hireToSubmitPercent}%
                      </span>{" "}
                      conv
                    </div>
                  </div>

                  {/* Stage 6: Posted Live */}
                  <div className="bg-muted/40 border border-border rounded-xl p-3 space-y-2 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                        <span>6. Live Post</span>
                        <TrendingUp className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div className="text-xl font-bold text-foreground mt-1 tabular-nums">
                        {formatNumber(data.funnel.postedLive)}
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground pt-2 border-t border-border/40">
                      <span className="font-bold text-foreground">
                        {data.funnel.submitToPostPercent}%
                      </span>{" "}
                      conv
                    </div>
                  </div>

                  {/* Stage 7: Completed */}
                  <div className="bg-muted/40 border border-border rounded-xl p-3 space-y-2 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                        <span>7. Completed</span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-verified" />
                      </div>
                      <div className="text-xl font-bold text-foreground mt-1 tabular-nums">
                        {formatNumber(data.funnel.completed)}
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground pt-2 border-t border-border/40">
                      <span className="font-bold text-foreground">
                        {data.funnel.postToCompletePercent}%
                      </span>{" "}
                      conv
                    </div>
                  </div>
                </div>
              </div>

              {/* Conversion Analysis Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-card border border-border rounded-2xl p-5 space-y-3 shadow-xs">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Brief Discovery Velocity
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Out of <strong className="text-foreground">{data.funnel.briefViews}</strong>{" "}
                    brief impressions, <strong className="text-foreground">{data.funnel.applications}</strong>{" "}
                    creators submitted an application (
                    <strong className="text-foreground">{data.funnel.viewsToAppPercent}%</strong> conversion rate).
                  </p>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${Math.min(100, Math.max(3, data.funnel.viewsToAppPercent))}%` }}
                    />
                  </div>
                </div>

                <div className="bg-card border border-border rounded-2xl p-5 space-y-3 shadow-xs">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Fulfillment &amp; Delivery Rate
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Out of <strong className="text-foreground">{data.funnel.hired}</strong> hired creators,{" "}
                    <strong className="text-foreground">{data.funnel.completed}</strong> creators have delivered verified content (
                    <strong className="text-foreground">
                      {data.funnel.hired > 0
                        ? Math.round((data.funnel.completed / data.funnel.hired) * 100)
                        : 0}
                      %
                    </strong>{" "}
                    completion rate).
                  </p>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-verified rounded-full transition-all"
                      style={{
                        width: `${
                          data.funnel.hired > 0
                            ? Math.min(100, Math.max(3, (data.funnel.completed / data.funnel.hired) * 100))
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CREATORS */}
          {activeTab === "creators" && (
            <div className="space-y-4">
              {/* Creator Controls */}
              <div className="flex items-center justify-between flex-wrap gap-3 p-4 bg-card border border-border rounded-2xl shadow-xs">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={creatorSearch}
                    onChange={(e) => {
                      setCreatorSearch(e.target.value);
                      setCreatorPage(1);
                    }}
                    placeholder="Search creators by name or @handle..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-muted/40 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">Sort by:</span>
                  <select
                    value={creatorSort}
                    onChange={(e) => {
                      setCreatorSort(
                        e.target.value as "views" | "payout" | "cpv" | "cpe" | "roi" | "drs"
                      );
                      setCreatorPage(1);
                    }}
                    className="text-xs bg-muted/40 border border-border rounded-xl px-2.5 py-1.5 text-foreground font-semibold focus:outline-hidden"
                  >
                    <option value="views">Delivered Views</option>
                    <option value="payout">Payout (₹)</option>
                    <option value="cpv">CPV (Low to High)</option>
                    <option value="cpe">CPE</option>
                    <option value="roi">ROI Score</option>
                    <option value="drs">DRS Score</option>
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      setCreatorSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
                    }
                    className="px-2.5 py-1.5 text-xs font-mono font-bold bg-muted/40 border border-border rounded-xl text-foreground hover:bg-muted"
                    title="Toggle Sort Direction"
                  >
                    {creatorSortDir.toUpperCase()}
                  </button>
                </div>
              </div>

              {/* Creators Table */}
              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
                {paginatedCreators.length === 0 ? (
                  <div className="p-8 text-center space-y-2">
                    <Users className="w-8 h-8 text-muted-foreground mx-auto" />
                    <p className="text-xs font-semibold text-foreground">
                      No creators match your current filter
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Once creators are hired and deliver content, their performance metrics appear here.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-muted/50 border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                          <th className="p-3.5">Creator</th>
                          <th className="p-3.5 text-center">DRS</th>
                          <th className="p-3.5 text-right">Payout (₹)</th>
                          <th className="p-3.5 text-right">Delivered / Exp. Views</th>
                          <th className="p-3.5 text-right">CPV</th>
                          <th className="p-3.5 text-right">CPE</th>
                          <th className="p-3.5 text-center">ROI Score</th>
                          <th className="p-3.5 text-center">Turnaround</th>
                          <th className="p-3.5 text-center">Verdict</th>
                          <th className="p-3.5 text-center">Data Quality</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {paginatedCreators.map((c) => (
                          <tr key={c.dealId} className="hover:bg-muted/30 transition-colors">
                            {/* Creator */}
                            <td className="p-3.5">
                              <div className="space-y-0.5">
                                <div className="font-bold text-foreground flex items-center gap-1.5 flex-wrap">
                                  <span>{c.name}</span>
                                  {c.isSmallSample && (
                                    <span
                                      className="px-1.5 py-0.5 text-[9px] font-bold rounded-md bg-pending-muted text-pending border border-pending-border"
                                      title="Small sample size (<1,000 views). Metrics may normalize over time."
                                    >
                                      Data kam hai
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-muted-foreground font-mono">
                                  {c.handle ? `@${c.handle}` : "No handle"}
                                </div>
                              </div>
                            </td>

                            {/* DRS */}
                            <td className="p-3.5 text-center">
                              <span className="font-mono font-bold text-foreground">
                                {c.drsScore}
                              </span>
                            </td>

                            {/* Payout */}
                            <td className="p-3.5 text-right font-mono font-bold text-foreground tabular-nums">
                              ₹{c.amountRupees}
                            </td>

                            {/* Delivered vs Predicted */}
                            <td className="p-3.5 text-right font-mono tabular-nums">
                              <div className="font-bold text-foreground">
                                {formatNumber(c.deliveredViews)}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                exp: {formatNumber(c.predictedViews)} (
                                <span
                                  className={
                                    c.viewsVariancePercent >= 0
                                      ? "text-verified font-bold"
                                      : "text-disputed font-bold"
                                  }
                                >
                                  {c.viewsVariancePercent >= 0 ? "+" : ""}
                                  {c.viewsVariancePercent}%
                                </span>
                                )
                              </div>
                            </td>

                            {/* CPV */}
                            <td className="p-3.5 text-right font-mono tabular-nums">
                              <span className="font-bold text-foreground">₹{c.cpvRupees}</span>
                            </td>

                            {/* CPE */}
                            <td className="p-3.5 text-right font-mono tabular-nums">
                              <span className="font-bold text-foreground">₹{c.cpeRupees}</span>
                            </td>

                            {/* ROI Score */}
                            <td className="p-3.5 text-center font-mono font-bold">
                              <span
                                className={
                                  c.roiScore >= 85
                                    ? "text-verified font-bold"
                                    : c.roiScore >= 70
                                    ? "text-primary font-bold"
                                    : c.roiScore >= 50
                                    ? "text-pending font-bold"
                                    : "text-disputed font-bold"
                                }
                              >
                                {c.roiScore}
                              </span>
                            </td>

                            {/* Turnaround */}
                            <td className="p-3.5 text-center font-mono text-muted-foreground">
                              {c.approvalCycleHours > 0 ? `${c.approvalCycleHours}h` : "N/A"}
                            </td>

                            {/* Verdict */}
                            <td className="p-3.5 text-center">
                              <Badge
                                variant={
                                  c.verdict === "SUPERIOR ROI"
                                    ? "success"
                                    : c.verdict === "FAIR MARKET"
                                    ? "primary"
                                    : c.verdict === "MODERATE"
                                    ? "warning"
                                    : "danger"
                                }
                                className="font-mono text-[10px]"
                              >
                                {c.verdict}
                              </Badge>
                            </td>

                            {/* Data Quality */}
                            <td className="p-3.5 text-center">
                              <Badge
                                variant={c.isEstimated ? "warning" : "success"}
                                className="font-mono text-[10px]"
                              >
                                {c.isEstimated ? "ESTIMATED" : "VERIFIED API"}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pagination */}
                {totalCreatorPages > 1 && (
                  <div className="flex items-center justify-between p-3.5 bg-muted/30 border-t border-border">
                    <span className="text-[11px] text-muted-foreground">
                      Showing {(creatorPage - 1) * pageSize + 1}–
                      {Math.min(creatorPage * pageSize, filteredCreators.length)} of{" "}
                      {filteredCreators.length} creators
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setCreatorPage((p) => Math.max(1, p - 1))}
                        disabled={creatorPage === 1}
                        className="text-xs"
                      >
                        Previous
                      </Button>
                      <span className="text-xs font-mono font-bold text-foreground">
                        {creatorPage} / {totalCreatorPages}
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setCreatorPage((p) => Math.min(totalCreatorPages, p + 1))}
                        disabled={creatorPage === totalCreatorPages}
                        className="text-xs"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: AUDIENCE */}
          {activeTab === "audience" && (
            <div className="space-y-6">
              {/* Device Split & Engagement Dwell */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Device Split */}
                <div className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-xs">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-primary" />
                    <span>Device Split Attribution</span>
                  </h3>
                  <div className="space-y-3">
                    {data.audience.deviceSplit.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">
                        No telemetry device events captured yet.
                      </p>
                    ) : (
                      data.audience.deviceSplit.map((dev) => (
                        <div key={dev.device} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-semibold text-foreground flex items-center gap-1.5">
                              {dev.device.toLowerCase() === "desktop" ? (
                                <Monitor className="w-3.5 h-3.5 text-muted-foreground" />
                              ) : dev.device.toLowerCase() === "tablet" ? (
                                <Tablet className="w-3.5 h-3.5 text-muted-foreground" />
                              ) : (
                                <Smartphone className="w-3.5 h-3.5 text-muted-foreground" />
                              )}
                              {dev.device}
                            </span>
                            <span className="font-mono tabular-nums text-muted-foreground">
                              {dev.percentage}% ({dev.visitors.toLocaleString("en-IN")} visits)
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${Math.min(100, Math.max(3, dev.percentage))}%` }}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Brief Dwell & Interaction Metrics */}
                <div className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-xs">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    <span>Brief Engagement &amp; Dwell Time</span>
                  </h3>
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="p-4 bg-muted/40 border border-border rounded-xl space-y-1">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase">
                        Avg Dwell Time
                      </span>
                      <div className="text-2xl font-bold text-foreground tabular-nums font-mono">
                        {data.audience.avgActiveReadingTimeSec}s
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Active reading time on campaign brief
                      </p>
                    </div>

                    <div className="p-4 bg-muted/40 border border-border rounded-xl space-y-1">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase">
                        Bounce Rate (&lt;10s)
                      </span>
                      <div className="text-2xl font-bold text-foreground tabular-nums font-mono">
                        {data.audience.bounceRatePercent}%
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Visits exited under 10 seconds
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* City Split (Honest Zero-Fabrication Privacy Standard) */}
              <div className="bg-card border border-border rounded-2xl p-6 space-y-3 shadow-xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Globe className="w-4 h-4 text-primary" />
                    <span>Geographic City Breakdown</span>
                  </h3>
                  <Badge variant="ghost" className="font-mono text-[10px]">
                    Zero-Fabrication Privacy Standard
                  </Badge>
                </div>
                <div className="p-4 rounded-xl border border-border bg-muted/40 text-xs text-muted-foreground space-y-1">
                  <p className="font-semibold text-foreground">
                    City-level geolocation telemetry is omitted.
                  </p>
                  <p className="leading-relaxed">
                    In compliance with the Digital Personal Data Protection (DPDP) Act and VyaparMedia&apos;s
                    zero-fabrication policy, granular IP-to-city resolution is never estimated or
                    synthetically imputed. City analytics will populate automatically as verified
                    state/metro telemetry becomes available.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: FINANCE & TAX */}
          {activeTab === "finance" && currentFinance && (
            <div className="space-y-6">
              {/* Financial Controls Header (FY Filter & CSV Export) */}
              <div className="flex items-center justify-between flex-wrap gap-3 p-4 bg-card border border-border rounded-2xl shadow-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                    Indian Financial Year (FY):
                  </span>
                  <select
                    value={selectedFy}
                    onChange={(e) => {
                      setSelectedFy(e.target.value);
                      setFinancePage(1);
                    }}
                    className="text-xs bg-muted/50 border border-border rounded-xl px-3 py-1.5 text-foreground font-semibold focus:outline-hidden"
                  >
                    <option value="ALL">All-Time (Campaign Inception)</option>
                    {currentFinance.availableFys.map((fy) => (
                      <option key={fy} value={fy}>
                        FY {fy} (Apr 1 – Mar 31 IST)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    href={`/api/campaigns/${campaignId}/finance/export${
                      selectedFy !== "ALL" ? `?fy=${selectedFy}` : ""
                    }`}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="secondary"
                    size="sm"
                    className="text-xs font-semibold gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5 text-primary" />
                    <span>Export Financial Ledger CSV</span>
                  </Button>
                </div>
              </div>

              {/* Reconciliation Status Alert / Banner */}
              {currentFinance.summary.reconciliation.isReconciled ? (
                <div className="p-4 rounded-2xl border border-verified-border bg-verified-muted text-verified flex items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="w-5 h-5 text-verified shrink-0" />
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider">
                        Ledger Reconciled &amp; Balanced
                      </span>
                      <p className="text-xs text-verified/90">
                        Sum of creator payouts, platform fees, gateway fees, and statutory tax withholdings
                        strictly equals the total escrow funds released.
                      </p>
                    </div>
                  </div>
                  <Badge variant="success" className="font-mono text-xs font-bold">
                    VERIFIED BALANCED
                  </Badge>
                </div>
              ) : (
                <div className="p-4 rounded-2xl border border-pending-border bg-pending-muted text-pending space-y-2 shadow-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-pending shrink-0" />
                      <span className="text-xs font-bold uppercase tracking-wider">
                        Reconciliation Variance Detected
                      </span>
                    </div>
                    <Badge variant="warning" className="font-mono text-xs font-bold">
                      ₹{currentFinance.summary.reconciliation.discrepancyRupees} Discrepancy
                    </Badge>
                  </div>
                  <ul className="text-xs space-y-1 list-disc list-inside text-pending/90">
                    {currentFinance.summary.reconciliation.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 5 Core Budget Allocation KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {/* Total Budget */}
                <div className="bg-card border border-border rounded-2xl p-4 space-y-1 shadow-xs">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                    Total Budget
                  </span>
                  <div className="text-xl font-bold text-foreground font-mono tabular-nums">
                    ₹{currentFinance.summary.budgetTotalRupees}
                  </div>
                  <p className="text-[10px] text-muted-foreground">Original budget allocation</p>
                </div>

                {/* Funded Budget */}
                <div className="bg-card border border-border rounded-2xl p-4 space-y-1 shadow-xs">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                    Funded in Deals
                  </span>
                  <div className="text-xl font-bold text-foreground font-mono tabular-nums">
                    ₹{currentFinance.summary.budgetFundedRupees}
                  </div>
                  <p className="text-[10px] text-muted-foreground">Active + completed commitments</p>
                </div>

                {/* Escrow Locked */}
                <div className="bg-card border border-border rounded-2xl p-4 space-y-1 shadow-xs">
                  <span className="text-[11px] font-bold text-escrow uppercase tracking-wide">
                    Escrow Locked
                  </span>
                  <div className="text-xl font-bold text-escrow font-mono tabular-nums">
                    ₹{currentFinance.summary.escrowLockedRupees}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {currentFinance.summary.activeDealCount} active deals in flight
                  </p>
                </div>

                {/* Escrow Released */}
                <div className="bg-card border border-border rounded-2xl p-4 space-y-1 shadow-xs">
                  <span className="text-[11px] font-bold text-verified uppercase tracking-wide">
                    Released (Completed)
                  </span>
                  <div className="text-xl font-bold text-verified font-mono tabular-nums">
                    ₹{currentFinance.summary.escrowReleasedRupees}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {currentFinance.summary.completedDealCount} deals verified &amp; settled
                  </p>
                </div>

                {/* Remaining Budget */}
                <div className="bg-card border border-border rounded-2xl p-4 space-y-1 shadow-xs">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                    Budget Remaining
                  </span>
                  <div className="text-xl font-bold text-foreground font-mono tabular-nums">
                    ₹{currentFinance.summary.budgetRemainingRupees}
                  </div>
                  <p className="text-[10px] text-muted-foreground">Available for recruitment</p>
                </div>
              </div>

              {/* Statutory Tax, GST & TDS Summary Card */}
              <div className="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-primary" />
                      <span>Statutory Indian Tax &amp; Platform Fee Breakdown</span>
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Compliant with Income-tax Act Section 393(1) (erstwhile 194-O) and CGST Section 9/52.
                    </p>
                  </div>
                  <Badge variant="ghost" className="font-mono text-[10px]">
                    Indian Tax Compliance
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                  <div className="p-4 bg-muted/30 border border-border rounded-xl space-y-1">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase">
                      Platform Fee (As Charged)
                    </span>
                    <div className="text-lg font-bold text-foreground font-mono tabular-nums">
                      ₹{currentFinance.summary.totalPlatformFeeRupees}
                    </div>
                    <p className="text-[10px] text-muted-foreground">Never recomputed retroactively</p>
                  </div>

                  <div className="p-4 bg-muted/30 border border-border rounded-xl space-y-1">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase">
                      GST on Platform Fee ({currentFinance.taxSummary.gstRatePercentString})
                    </span>
                    <div className="text-lg font-bold text-foreground font-mono tabular-nums">
                      ₹{currentFinance.summary.totalGstOnPlatformFeeRupees}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Exempt for deals &le; ₹{currentFinance.taxSummary.gstExemptThresholdRupees}
                    </p>
                  </div>

                  <div className="p-4 bg-muted/30 border border-border rounded-xl space-y-1">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase">
                      TDS Withheld ({currentFinance.taxSummary.tdsRatePercentString})
                    </span>
                    <div className="text-lg font-bold text-foreground font-mono tabular-nums">
                      ₹{currentFinance.summary.totalTdsDeductedRupees}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {currentFinance.taxSummary.tdsStatutorySection}
                    </p>
                  </div>

                  <div className="p-4 bg-muted/30 border border-border rounded-xl space-y-1">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase">
                      Net Creator Disbursals
                    </span>
                    <div className="text-lg font-bold text-verified font-mono tabular-nums">
                      ₹{currentFinance.summary.totalNetPayoutRupees}
                    </div>
                    <p className="text-[10px] text-muted-foreground">Total creator wallet credits</p>
                  </div>
                </div>

                {/* Tax Advisories */}
                {currentFinance.taxSummary.advisories.length > 0 && (
                  <div className="p-3 bg-muted/40 border border-border rounded-xl text-xs space-y-1">
                    <span className="font-bold text-foreground">Compliance Advisories:</span>
                    <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                      {currentFinance.taxSummary.advisories.map((adv, idx) => (
                        <li key={idx}>{adv}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Per-Deal Financial Ledger Table */}
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3 p-4 bg-card border border-border rounded-2xl shadow-xs">
                  <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={financeSearch}
                      onChange={(e) => {
                        setFinanceSearch(e.target.value);
                        setFinancePage(1);
                      }}
                      placeholder="Filter by creator name, @handle, or Deal ID..."
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-muted/40 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
                    />
                  </div>

                  <span className="text-xs text-muted-foreground">
                    Showing <strong className="text-foreground">{filteredFinanceDeals.length}</strong> deals
                  </span>
                </div>

                <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
                  {paginatedFinanceDeals.length === 0 ? (
                    <div className="p-8 text-center space-y-2">
                      <Receipt className="w-8 h-8 text-muted-foreground mx-auto" />
                      <p className="text-xs font-semibold text-foreground">No financial deals match your filter</p>
                      <p className="text-[11px] text-muted-foreground">
                        Deal escrow disbursements and tax records will appear here as deals progress.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-muted/50 border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                            <th className="p-3.5">Deal &amp; Creator</th>
                            <th className="p-3.5 text-center">Status</th>
                            <th className="p-3.5 text-right">Amount (₹)</th>
                            <th className="p-3.5 text-right">Fee (₹)</th>
                            <th className="p-3.5 text-right">GST (₹)</th>
                            <th className="p-3.5 text-right">Gateway (₹)</th>
                            <th className="p-3.5 text-right">Gross (₹)</th>
                            <th className="p-3.5 text-right">TDS (₹)</th>
                            <th className="p-3.5 text-right">Net Payout (₹)</th>
                            <th className="p-3.5 text-center">Reconciled</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {paginatedFinanceDeals.map((deal: CalculatedDealFinance) => (
                            <tr key={deal.id} className="hover:bg-muted/30 transition-colors">
                              {/* Creator & Deal ID */}
                              <td className="p-3.5">
                                <div className="space-y-0.5">
                                  <div className="font-bold text-foreground">{deal.creatorName}</div>
                                  <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-1.5">
                                    <span>{deal.creatorHandle ? `@${deal.creatorHandle}` : "No handle"}</span>
                                    <span>•</span>
                                    <span title={deal.id}>ID: {deal.id.slice(-6)}</span>
                                  </div>
                                </div>
                              </td>

                              {/* Status */}
                              <td className="p-3.5 text-center">
                                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-muted text-foreground border border-border">
                                  {deal.status}
                                </span>
                              </td>

                              {/* Amount */}
                              <td className="p-3.5 text-right font-mono font-bold text-foreground tabular-nums">
                                ₹{deal.amountRupees}
                              </td>

                              {/* Platform Fee */}
                              <td className="p-3.5 text-right font-mono tabular-nums text-muted-foreground">
                                ₹{deal.platformFeeRupees}
                              </td>

                              {/* GST on Fee */}
                              <td className="p-3.5 text-right font-mono tabular-nums text-muted-foreground">
                                ₹{deal.gstOnPlatformFeeRupees}
                              </td>

                              {/* Gateway Fee */}
                              <td className="p-3.5 text-right font-mono tabular-nums text-muted-foreground">
                                ₹{deal.gatewayFeeRupees}
                              </td>

                              {/* Gross Payout */}
                              <td className="p-3.5 text-right font-mono font-semibold text-foreground tabular-nums">
                                ₹{deal.grossPayoutRupees}
                              </td>

                              {/* TDS Deducted */}
                              <td className="p-3.5 text-right font-mono tabular-nums text-pending">
                                {deal.tdsDeductedPaise > 0 ? `₹${deal.tdsDeductedRupees}` : "₹0.00"}
                              </td>

                              {/* Net Payout */}
                              <td className="p-3.5 text-right font-mono font-bold text-verified tabular-nums">
                                ₹{deal.netPayoutRupees}
                              </td>

                              {/* Reconciled */}
                              <td className="p-3.5 text-center">
                                {deal.isReconciled ? (
                                  <span
                                    className="inline-flex items-center text-verified"
                                    title="Deal parts reconcile exactly"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                  </span>
                                ) : (
                                  <span
                                    className="inline-flex items-center text-pending"
                                    title={deal.reconciliationNotes.join("; ")}
                                  >
                                    <AlertTriangle className="w-4 h-4" />
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Pagination */}
                  {totalFinancePages > 1 && (
                    <div className="flex items-center justify-between p-3.5 bg-muted/30 border-t border-border">
                      <span className="text-[11px] text-muted-foreground">
                        Showing {(financePage - 1) * pageSize + 1}–
                        {Math.min(financePage * pageSize, filteredFinanceDeals.length)} of{" "}
                        {filteredFinanceDeals.length} deals
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setFinancePage((p) => Math.max(1, p - 1))}
                          disabled={financePage === 1}
                          className="text-xs"
                        >
                          Previous
                        </Button>
                        <span className="text-xs font-mono font-bold text-foreground">
                          {financePage} / {totalFinancePages}
                        </span>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setFinancePage((p) => Math.min(totalFinancePages, p + 1))}
                          disabled={financePage === totalFinancePages}
                          className="text-xs"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Official Branded Performance Report Modal */}
      <CampaignPerformanceReportModal
        campaignId={campaignId}
        isOpen={showPerformanceReportModal}
        onClose={() => setShowPerformanceReportModal(false)}
      />
    </div>
  );
}
