"use client";

import React, { useState, useTransition } from "react";
import {
  Target,
  Sliders,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Database,
  Calculator,
  Search,
  Check,
  Layers,
  Percent,
  Maximize2,
  Radio,
  UserCheck,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { Badge, Button, Input } from "@/components/ui";
import {
  updateCategoryBenchmarkAction,
  resetCategoryBenchmarkAction,
  updatePricingConfigAction,
} from "@/app/admin/actions";
import { calculateRoiScore } from "@/lib/roi-calculator";
import {
  StoredPricingConfig,
  PricingConfigUpdates,
  ChangedFieldDetail,
} from "@/services/pricing-config.service";
import {
  calculateFairPrice,
  CreatorFollowerTier,
  FairPriceInput,
  FairPriceOutput,
} from "@/lib/fair-price-engine";
import { estimateExpectedViews, ReachPlatform, ReachContentType } from "@/lib/reach-estimator";

export interface CategoryBenchmarkItem {
  category: string;
  rawKey: string;
  baselinePaise: number;
  baselineRupees: string;
  source: "DYNAMIC_30D" | "CONFIG_DB" | "INDUSTRY_SEEDED" | "PLATFORM_DEFAULT";
  isDbConfigured: boolean;
  dealCount?: number;
}

interface Props {
  initialBenchmarks: CategoryBenchmarkItem[];
  initialConfig: StoredPricingConfig;
  initialVersion: number;
  updatedAt?: string | undefined;
}

type TabKey = "categories" | "tiers" | "addons" | "range" | "reach" | "simulate";

export default function CategoryBenchmarksClient({
  initialBenchmarks,
  initialConfig,
  initialVersion,
  updatedAt,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("categories");
  const [benchmarks, setBenchmarks] = useState<CategoryBenchmarkItem[]>(initialBenchmarks);
  const [config, setConfig] = useState<StoredPricingConfig>(initialConfig);
  const [version, setVersion] = useState<number>(initialVersion);
  const [lastUpdated, setLastUpdated] = useState<string | undefined>(updatedAt);

  const [searchTerm, setSearchTerm] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editPaiseValue, setEditPaiseValue] = useState<string>("");
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Confirmation modal for >25% shifts
  const [pendingBigShift, setPendingBigShift] = useState<{
    maxShift: number;
    changedFields: ChangedFieldDetail[];
    pendingUpdates: PricingConfigUpdates;
  } | null>(null);

  // Editable drafts for config sections
  const [tierDraft, setTierDraft] = useState(config.tierFactors);
  const [addOnDraft, setAddOnDraft] = useState(config.addOnMultipliers);
  const [rangeDraft, setRangeDraft] = useState(config.rangeRatios);
  const [reachDraft, setReachDraft] = useState(config.reachRateBands);

  // Interactive ROI Simulator Sandbox state (Category baselines)
  const [simCategoryA, setSimCategoryA] = useState("finance");
  const [simCategoryB, setSimCategoryB] = useState("fashion");
  const [simCpvRupees, setSimCpvRupees] = useState("0.50");

  // "Simulate a Creator" Sandbox state (Fair Price Engine)
  const [simCreator, setSimCreator] = useState({
    platform: "INSTAGRAM",
    contentType: "REEL",
    followers: 45000,
    engagementRatePercent: "2.5",
    authenticityScore: 82,
    drsScore: 650,
    categoryKey: "fashion",
    deliverablesCount: 1,
    storiesCount: 0,
    usageRightsDays: 0,
    exclusivityMonths: 0,
    rawFootage: false,
    quotedRateRupees: "",
  });

  const filteredBenchmarks = benchmarks.filter(
    (b) =>
      b.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.rawKey.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handler: Save category CPV benchmark
  const handleStartEdit = (item: CategoryBenchmarkItem) => {
    setEditingCategory(item.rawKey);
    setEditPaiseValue(String(item.baselinePaise));
  };

  const handleSaveCategory = (rawKey: string) => {
    const paise = parseInt(editPaiseValue, 10);
    if (isNaN(paise) || paise < 1 || paise > 5000) {
      setNotice({
        type: "error",
        message: "Baseline CPV must be between 1 and 5000 paise (₹0.01 - ₹50.00)",
      });
      return;
    }

    startTransition(async () => {
      try {
        await updateCategoryBenchmarkAction(rawKey, paise);
        setBenchmarks((prev) =>
          prev.map((item) =>
            item.rawKey === rawKey
              ? {
                  ...item,
                  baselinePaise: paise,
                  baselineRupees: (paise / 100).toFixed(2),
                  source: "CONFIG_DB",
                  isDbConfigured: true,
                }
              : item
          )
        );
        setEditingCategory(null);
        setNotice({
          type: "success",
          message: `Updated ${rawKey.toUpperCase()} baseline to ₹${(paise / 100).toFixed(
            2
          )} (${paise} paise). Takes effect immediately in matching algorithms!`,
        });
      } catch (err: unknown) {
        setNotice({
          type: "error",
          message: err instanceof Error ? err.message : "Failed to update category baseline",
        });
      }
    });
  };

  const handleResetCategory = (rawKey: string) => {
    startTransition(async () => {
      try {
        await resetCategoryBenchmarkAction(rawKey);
        setBenchmarks((prev) =>
          prev.map((item) =>
            item.rawKey === rawKey
              ? {
                  ...item,
                  isDbConfigured: false,
                  source: "INDUSTRY_SEEDED",
                }
              : item
          )
        );
        setNotice({
          type: "success",
          message: `Reset ${rawKey.toUpperCase()} baseline back to dynamic/seeded market benchmark.`,
        });
      } catch (err: unknown) {
        setNotice({
          type: "error",
          message: err instanceof Error ? err.message : "Failed to reset category baseline",
        });
      }
    });
  };

  // Submit configuration updates via Server Action
  const submitConfigUpdate = async (
    updates: PricingConfigUpdates,
    confirmBigShift = false
  ) => {
    try {
      const res = await updatePricingConfigAction(
        updates,
        confirmBigShift,
        `Admin update to ${Object.keys(updates).join(", ")}`
      );

      if (res.requiresConfirmation) {
        setPendingBigShift({
          maxShift: res.maxShift || 0,
          changedFields: res.changedFields || [],
          pendingUpdates: updates,
        });
        return;
      }

      // Update succeeded
      setPendingBigShift(null);
      if (res.config) {
        setConfig(res.config);
        setTierDraft(res.config.tierFactors);
        setAddOnDraft(res.config.addOnMultipliers);
        setRangeDraft(res.config.rangeRatios);
        setReachDraft(res.config.reachRateBands);
      }
      if (res.version) {
        setVersion(res.version);
        setLastUpdated(new Date().toISOString());
      }

      setNotice({
        type: "success",
        message: `Pricing configuration updated to v${res.version}. Changes take effect immediately.`,
      });
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to save configuration",
      });
    }
  };

  // Tier Factors Save
  const handleSaveTierFactors = () => {
    for (const [tier, factor] of Object.entries(tierDraft)) {
      if (factor < 0.5 || factor > 2.5) {
        setNotice({
          type: "error",
          message: `Tier factor for ${tier} must be between 0.50 and 2.50.`,
        });
        return;
      }
    }
    startTransition(() => {
      submitConfigUpdate({ tierFactors: tierDraft });
    });
  };

  // Add-on % Save
  const handleSaveAddOns = () => {
    if (addOnDraft.story < 0.01 || addOnDraft.story > 1.0) {
      setNotice({ type: "error", message: "Story multiplier must be between 1% and 100% (0.01 - 1.00)." });
      return;
    }
    if (addOnDraft.usageRightsPer30d < 0.01 || addOnDraft.usageRightsPer30d > 1.0) {
      setNotice({ type: "error", message: "Usage rights multiplier must be between 1% and 100% (0.01 - 1.00)." });
      return;
    }
    if (addOnDraft.exclusivityPerMonth < 0.01 || addOnDraft.exclusivityPerMonth > 1.5) {
      setNotice({ type: "error", message: "Exclusivity multiplier must be between 1% and 150% (0.01 - 1.50)." });
      return;
    }
    if (addOnDraft.rawFootage < 0.01 || addOnDraft.rawFootage > 1.0) {
      setNotice({ type: "error", message: "Raw footage multiplier must be between 1% and 100% (0.01 - 1.00)." });
      return;
    }
    startTransition(() => {
      submitConfigUpdate({ addOnMultipliers: addOnDraft });
    });
  };

  // Range Width Save
  const handleSaveRange = () => {
    if (rangeDraft.minRatio < 0.5 || rangeDraft.minRatio > 0.99) {
      setNotice({ type: "error", message: "Standard min ratio must be between 0.50 and 0.99." });
      return;
    }
    if (rangeDraft.maxRatio < 1.01 || rangeDraft.maxRatio > 2.0) {
      setNotice({ type: "error", message: "Standard max ratio must be between 1.01 and 2.00." });
      return;
    }
    if (rangeDraft.widenedMinRatio < 0.4 || rangeDraft.widenedMinRatio > 0.95) {
      setNotice({ type: "error", message: "Widened min ratio must be between 0.40 and 0.95." });
      return;
    }
    if (rangeDraft.widenedMaxRatio < 1.1 || rangeDraft.widenedMaxRatio > 2.5) {
      setNotice({ type: "error", message: "Widened max ratio must be between 1.10 and 2.50." });
      return;
    }
    if (rangeDraft.widenedMinRatio >= rangeDraft.minRatio) {
      setNotice({ type: "error", message: "Widened min ratio must be strictly less than standard min ratio." });
      return;
    }
    if (rangeDraft.minRatio >= rangeDraft.maxRatio) {
      setNotice({ type: "error", message: "Standard min ratio must be less than standard max ratio." });
      return;
    }
    if (rangeDraft.widenedMaxRatio <= rangeDraft.maxRatio) {
      setNotice({ type: "error", message: "Widened max ratio must be strictly greater than standard max ratio." });
      return;
    }

    startTransition(() => {
      submitConfigUpdate({ rangeRatios: rangeDraft });
    });
  };

  // Reach Bands Save
  const handleSaveReach = () => {
    startTransition(() => {
      submitConfigUpdate({ reachRateBands: reachDraft });
    });
  };

  // Calculate live simulator scores for category comparison
  const simCpvPaise = Math.round(parseFloat(simCpvRupees || "0") * 100);
  const scoreCatA = calculateRoiScore(simCpvPaise, simCategoryA);
  const scoreCatB = calculateRoiScore(simCpvPaise, simCategoryB);

  // Live "Simulate a Creator" Evaluation calculation using pure engine
  const runCreatorSimulation = (): FairPriceOutput => {
    const selectedBenchmark =
      benchmarks.find((b) => b.rawKey === simCreator.categoryKey)?.baselinePaise || 35;
    const erBps = Math.round(parseFloat(simCreator.engagementRatePercent || "0") * 100);

    const expected = estimateExpectedViews({
      platform: simCreator.platform as ReachPlatform,
      contentType: simCreator.contentType as ReachContentType,
      followers: simCreator.followers,
      authenticityScore: simCreator.authenticityScore,
      engagementRateBps: erBps,
      customBands: config.reachRateBands,
    });

    const engineInput: FairPriceInput = {
      platform: simCreator.platform,
      contentType: simCreator.contentType,
      followers: simCreator.followers,
      engagementRateBps: erBps,
      expectedViews: expected,
      categoryBaselineCpvPaise: selectedBenchmark,
      authenticityScore: simCreator.authenticityScore,
      drsScore: simCreator.drsScore,
      deliverables: {
        count: Math.max(1, simCreator.deliverablesCount || 1),
        stories: simCreator.storiesCount,
        usageRightsDays: simCreator.usageRightsDays,
        exclusivityMonths: simCreator.exclusivityMonths,
        rawFootage: simCreator.rawFootage,
      },
      dataQuality: "ESTIMATED",
      quotedRatePaise: simCreator.quotedRateRupees
        ? Math.round(parseFloat(simCreator.quotedRateRupees) * 100)
        : undefined,
    };

    return calculateFairPrice(engineInput, config);
  };

  const simulationResult = runCreatorSimulation();

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {notice && (
        <div
          className={`p-4 rounded-2xl border text-sm font-medium flex items-center justify-between gap-3 ${
            notice.type === "success"
              ? "bg-verified-muted text-verified border-verified-border"
              : "bg-disputed-muted text-disputed border-disputed-border"
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span>{notice.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-xs font-bold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Confirmation Modal for >25% Shift */}
      {pendingBigShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-3xl bg-card border border-border p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-disputed-muted border border-disputed-border flex items-center justify-center text-disputed shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-foreground">
                  Confirm Significant Benchmark Shift (&gt;25%)
                </h3>
                <p className="text-xs text-muted-foreground">
                  One or more parameters deviate by over 25% from the currently active valuation baseline. This change will immediately increment the engine version and affect active creator valuations.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-muted/30 p-3 space-y-2 text-xs">
              <div className="font-bold text-muted-foreground uppercase text-2xs tracking-wider">
                Impacted Parameters
              </div>
              <ul className="divide-y divide-border/60">
                {pendingBigShift.changedFields.map((cf) => (
                  <li key={cf.field} className="py-1.5 flex items-center justify-between font-mono">
                    <span className="font-sans font-medium text-foreground">{cf.field}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-muted-foreground">{cf.oldVal}</span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      <span className="font-bold text-foreground">{cf.newVal}</span>
                      <Badge variant="danger" className="text-2xs font-bold px-1.5 py-0">
                        +{cf.shiftPercent}%
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="ghost"
                onClick={() => setPendingBigShift(null)}
                disabled={isPending}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={isPending}
                onClick={() => {
                  startTransition(() => {
                    submitConfigUpdate(pendingBigShift.pendingUpdates, true);
                  });
                }}
                className="text-xs font-bold"
              >
                Confirm &amp; Apply Changes (Bump to v{version + 1})
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Engine Status & Version Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-card border border-border shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-foreground">
                Fair Price Engine Configuration
              </span>
              <Badge variant="primary" className="text-2xs font-mono font-extrabold uppercase">
                Active v{version}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {lastUpdated
                ? `Last modified: ${new Date(lastUpdated).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                  })}`
                : "Active production baseline"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-block w-2 h-2 rounded-full bg-verified animate-pulse" />
          <span>Real-time DB cache synced</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-border overflow-x-auto gap-2 pb-px text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab("categories")}
          className={`px-4 py-2.5 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === "categories"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Target className="w-4 h-4" /> Category CPV Baselines
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("tiers")}
          className={`px-4 py-2.5 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === "tiers"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers className="w-4 h-4" /> Follower Tier Factors
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("addons")}
          className={`px-4 py-2.5 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === "addons"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Percent className="w-4 h-4" /> Deliverable Add-ons %
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("range")}
          className={`px-4 py-2.5 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === "range"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Maximize2 className="w-4 h-4" /> Market Range Width
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("reach")}
          className={`px-4 py-2.5 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === "reach"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Radio className="w-4 h-4" /> Reach-Rate Bands
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("simulate")}
          className={`px-4 py-2.5 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === "simulate"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <UserCheck className="w-4 h-4" /> Simulate a Creator
        </button>
      </div>

      {/* TAB 1: Category CPV Benchmarks & ROI Simulator */}
      {activeTab === "categories" && (
        <div className="space-y-6">
          {/* Simulator Section */}
          <section
            aria-label="Interactive Relative ROI Simulator"
            className="rounded-3xl border border-border bg-card p-6 shadow-xs relative overflow-hidden"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                    Relative Category-Aware ROI Simulator
                    <span className="text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-verified-muted text-verified border border-verified-border shrink-0 whitespace-nowrap">
                      Live Engine
                    </span>
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Compares how the same CPV receives different ROI scores across diverse market categories.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              <div className="space-y-2">
                <label htmlFor="sim-cpv" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Creator Benchmark CPV (INR)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">
                    ₹
                  </span>
                  <Input
                    id="sim-cpv"
                    type="number"
                    step="0.05"
                    min="0.01"
                    max="50"
                    value={simCpvRupees}
                    onChange={(e) => setSimCpvRupees(e.target.value)}
                    className="pl-10 text-base font-bold font-mono"
                  />
                </div>
                <p className="text-2xs text-muted-foreground">
                  Equivalent to {simCpvPaise} paise per verified view
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <select
                    aria-label="Select first category"
                    value={simCategoryA}
                    onChange={(e) => setSimCategoryA(e.target.value)}
                    className="text-xs font-bold bg-card border border-border rounded-lg px-2 py-1 text-foreground"
                  >
                    {benchmarks.map((b) => (
                      <option key={`a-${b.rawKey}`} value={b.rawKey}>
                        {b.category} (₹{b.baselineRupees} baseline)
                      </option>
                    ))}
                  </select>
                  <Badge variant="primary" className="text-xs font-mono font-extrabold">
                    {scoreCatA}/100
                  </Badge>
                </div>
                <div className="text-2xs text-muted-foreground">
                  {scoreCatA >= 85
                    ? "🔥 Exceptional high-value deal in this niche"
                    : scoreCatA >= 70
                    ? "✅ Fair and competitive market pricing"
                    : "⚠️ High cost relative to category delivery"}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <select
                    aria-label="Select second category"
                    value={simCategoryB}
                    onChange={(e) => setSimCategoryB(e.target.value)}
                    className="text-xs font-bold bg-card border border-border rounded-lg px-2 py-1 text-foreground"
                  >
                    {benchmarks.map((b) => (
                      <option key={`b-${b.rawKey}`} value={b.rawKey}>
                        {b.category} (₹{b.baselineRupees} baseline)
                      </option>
                    ))}
                  </select>
                  <Badge variant="primary" className="text-xs font-mono font-extrabold">
                    {scoreCatB}/100
                  </Badge>
                </div>
                <div className="text-2xs text-muted-foreground">
                  {scoreCatB >= 85
                    ? "🔥 Exceptional high-value deal in this niche"
                    : scoreCatB >= 70
                    ? "✅ Fair and competitive market pricing"
                    : "⚠️ High cost relative to category delivery"}
                </div>
              </div>
            </div>
          </section>

          {/* Main Benchmarks Table Card */}
          <section
            aria-label="Category Benchmarks Management"
            className="rounded-3xl border border-border bg-card p-6 shadow-xs space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  Category Cost-Per-View (CPV) Baseline Benchmarks
                </h3>
                <p className="text-xs text-muted-foreground">
                  Tune baseline CPVs in database without code deployment. Higher baseline categories award higher ROI scores for equivalent spend.
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-11 text-xs"
                />
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-muted-foreground border-b border-border uppercase font-mono tracking-wider text-2xs select-none">
                  <tr>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5">Baseline CPV (INR)</th>
                    <th className="p-3.5">Baseline (Paise)</th>
                    <th className="p-3.5">Resolution Tier</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredBenchmarks.map((b) => {
                    const isEditing = editingCategory === b.rawKey;

                    return (
                      <tr key={b.rawKey} className="hover:bg-muted/20 transition-colors">
                        <td className="p-3.5 font-bold text-foreground">{b.category}</td>

                        <td className="p-3.5 font-mono font-bold text-foreground">
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground font-bold">₹</span>
                              <Input
                                aria-label={`Edit ${b.category} CPV rupees`}
                                type="number"
                                step="0.01"
                                value={(parseInt(editPaiseValue || "0", 10) / 100).toFixed(2)}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value || "0");
                                  setEditPaiseValue(String(Math.round(val * 100)));
                                }}
                                className="w-24 text-xs font-mono h-8"
                              />
                            </div>
                          ) : (
                            `₹${b.baselineRupees}`
                          )}
                        </td>

                        <td className="p-3.5 font-mono text-muted-foreground">
                          {isEditing ? (
                            <Input
                              aria-label={`Edit ${b.category} CPV paise`}
                              type="number"
                              value={editPaiseValue}
                              onChange={(e) => setEditPaiseValue(e.target.value)}
                              className="w-20 text-xs font-mono h-8"
                            />
                          ) : (
                            `${b.baselinePaise} paise`
                          )}
                        </td>

                        <td className="p-3.5">
                          {b.source === "CONFIG_DB" && (
                            <span className="inline-flex items-center gap-1 text-2xs font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                              <Database className="w-2.5 h-2.5" /> DB Configured
                            </span>
                          )}
                          {b.source === "DYNAMIC_30D" && (
                            <span className="inline-flex items-center gap-1 text-2xs font-bold px-2 py-0.5 rounded-md bg-verified-muted text-verified border border-verified-border">
                              <Sparkles className="w-2.5 h-2.5" /> 30-Day Platform Median ({b.dealCount ?? 0} deals)
                            </span>
                          )}
                          {b.source === "INDUSTRY_SEEDED" && (
                            <span className="inline-flex items-center gap-1 text-2xs font-bold px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
                              Industry Seeded
                            </span>
                          )}
                          {b.source === "PLATFORM_DEFAULT" && (
                            <span className="inline-flex items-center gap-1 text-2xs font-bold px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
                              Platform Default (Fallback)
                            </span>
                          )}
                        </td>

                        <td className="p-3.5">
                          {b.isDbConfigured ? (
                            <span className="text-2xs font-semibold text-primary">Custom Override</span>
                          ) : (
                            <span className="text-2xs text-muted-foreground">Market Standard</span>
                          )}
                        </td>

                        <td className="p-3.5 text-right">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="primary"
                                disabled={isPending}
                                onClick={() => handleSaveCategory(b.rawKey)}
                                className="h-7 text-2xs font-bold gap-1"
                              >
                                <Check className="w-3 h-3" /> Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={isPending}
                                onClick={() => setEditingCategory(null)}
                                className="h-7 text-2xs font-bold"
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleStartEdit(b)}
                                className="h-7 text-2xs font-bold gap-1"
                              >
                                <Sliders className="w-3 h-3 text-primary" /> Tune
                              </Button>
                              {b.isDbConfigured && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={isPending}
                                  onClick={() => handleResetCategory(b.rawKey)}
                                  className="h-7 text-2xs text-disputed hover:bg-disputed-muted/30 gap-1"
                                  title="Reset back to platform/industry standard"
                                >
                                  <RotateCcw className="w-3 h-3" /> Reset
                                </Button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: Follower Tier Factors */}
      {activeTab === "tiers" && (
        <section className="rounded-3xl border border-border bg-card p-6 shadow-xs space-y-6">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              Follower Tier Scaling Multipliers
            </h3>
            <p className="text-xs text-muted-foreground">
              Adjust how follower volume scales base creator market valuation. Nano/micro creators deliver higher attention density, while macro creators experience higher audience dilution.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(["nano", "micro", "mid", "macro"] as CreatorFollowerTier[]).map((tier) => (
              <div key={tier} className="p-4 rounded-2xl border border-border bg-muted/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm uppercase text-foreground">{tier}</span>
                  <span className="text-2xs text-muted-foreground font-mono">0.50 - 2.50</span>
                </div>
                <Input
                  type="number"
                  step="0.05"
                  min="0.5"
                  max="2.5"
                  value={tierDraft[tier]}
                  onChange={(e) =>
                    setTierDraft({
                      ...tierDraft,
                      [tier]: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="font-mono font-bold text-sm"
                />
                <p className="text-2xs text-muted-foreground">
                  Current: <span className="font-mono font-bold">{config.tierFactors[tier]}x</span>
                </p>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <Button
              variant="primary"
              disabled={isPending}
              onClick={handleSaveTierFactors}
              className="text-xs font-bold"
            >
              Save Tier Factors (v{version + 1})
            </Button>
          </div>
        </section>
      )}

      {/* TAB 3: Deliverable Add-ons % */}
      {activeTab === "addons" && (
        <section className="rounded-3xl border border-border bg-card p-6 shadow-xs space-y-6">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Percent className="w-4 h-4 text-primary" />
              Deliverable Add-on Multipliers (% of Deliverable Base)
            </h3>
            <p className="text-xs text-muted-foreground">
              Configure baseline incremental pricing for additional deliverables and rights: stories, usage rights, exclusivity, and raw footage.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl border border-border bg-muted/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs uppercase text-foreground">Story Add-on</span>
                <span className="text-2xs text-muted-foreground font-mono">1% - 100%</span>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  step="1"
                  min="1"
                  max="100"
                  value={Math.round(addOnDraft.story * 100)}
                  onChange={(e) =>
                    setAddOnDraft({
                      ...addOnDraft,
                      story: Math.round(parseFloat(e.target.value || "0")) / 100,
                    })
                  }
                  className="pr-8 font-mono font-bold text-sm"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xs">
                  %
                </span>
              </div>
              <p className="text-2xs text-muted-foreground">
                Per accompanying story (Active: {Math.round(config.addOnMultipliers.story * 100)}%)
              </p>
            </div>

            <div className="p-4 rounded-2xl border border-border bg-muted/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs uppercase text-foreground">Usage Rights (30d)</span>
                <span className="text-2xs text-muted-foreground font-mono">1% - 100%</span>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  step="1"
                  min="1"
                  max="100"
                  value={Math.round(addOnDraft.usageRightsPer30d * 100)}
                  onChange={(e) =>
                    setAddOnDraft({
                      ...addOnDraft,
                      usageRightsPer30d: Math.round(parseFloat(e.target.value || "0")) / 100,
                    })
                  }
                  className="pr-8 font-mono font-bold text-sm"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xs">
                  %
                </span>
              </div>
              <p className="text-2xs text-muted-foreground">
                Per 30 days of paid ad rights (Active:{" "}
                {Math.round(config.addOnMultipliers.usageRightsPer30d * 100)}%)
              </p>
            </div>

            <div className="p-4 rounded-2xl border border-border bg-muted/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs uppercase text-foreground">Exclusivity (Month)</span>
                <span className="text-2xs text-muted-foreground font-mono">1% - 150%</span>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  step="1"
                  min="1"
                  max="150"
                  value={Math.round(addOnDraft.exclusivityPerMonth * 100)}
                  onChange={(e) =>
                    setAddOnDraft({
                      ...addOnDraft,
                      exclusivityPerMonth: Math.round(parseFloat(e.target.value || "0")) / 100,
                    })
                  }
                  className="pr-8 font-mono font-bold text-sm"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xs">
                  %
                </span>
              </div>
              <p className="text-2xs text-muted-foreground">
                Per month of category exclusivity (Active:{" "}
                {Math.round(config.addOnMultipliers.exclusivityPerMonth * 100)}%)
              </p>
            </div>

            <div className="p-4 rounded-2xl border border-border bg-muted/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs uppercase text-foreground">Raw Footage</span>
                <span className="text-2xs text-muted-foreground font-mono">1% - 100%</span>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  step="1"
                  min="1"
                  max="100"
                  value={Math.round(addOnDraft.rawFootage * 100)}
                  onChange={(e) =>
                    setAddOnDraft({
                      ...addOnDraft,
                      rawFootage: Math.round(parseFloat(e.target.value || "0")) / 100,
                    })
                  }
                  className="pr-8 font-mono font-bold text-sm"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xs">
                  %
                </span>
              </div>
              <p className="text-2xs text-muted-foreground">
                Flat asset buyout (Active: {Math.round(config.addOnMultipliers.rawFootage * 100)}%)
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              variant="primary"
              disabled={isPending}
              onClick={handleSaveAddOns}
              className="text-xs font-bold"
            >
              Save Add-on Multipliers (v{version + 1})
            </Button>
          </div>
        </section>
      )}

      {/* TAB 4: Market Range Width */}
      {activeTab === "range" && (
        <section className="rounded-3xl border border-border bg-card p-6 shadow-xs space-y-6">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Maximize2 className="w-4 h-4 text-primary" />
              Estimated Market Range Width &amp; Confidence Bands
            </h3>
            <p className="text-xs text-muted-foreground">
              Control the lower and upper bounds of the estimated market range. High-confidence evaluations use standard ratios; lower confidence or estimated views widen the range to protect both parties.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="p-5 rounded-2xl border border-border bg-muted/20 space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <span className="w-2.5 h-2.5 rounded-full bg-verified" />
                Standard Range (Verified Views / High Confidence)
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-2xs font-bold text-muted-foreground uppercase">
                    Min Ratio (0.50 - 0.99)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.5"
                    max="0.99"
                    value={rangeDraft.minRatio}
                    onChange={(e) =>
                      setRangeDraft({
                        ...rangeDraft,
                        minRatio: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="font-mono font-bold text-sm"
                  />
                  <p className="text-2xs text-muted-foreground">
                    Active: {rangeDraft.minRatio * 100}% of base
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-2xs font-bold text-muted-foreground uppercase">
                    Max Ratio (1.01 - 2.00)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="1.01"
                    max="2.0"
                    value={rangeDraft.maxRatio}
                    onChange={(e) =>
                      setRangeDraft({
                        ...rangeDraft,
                        maxRatio: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="font-mono font-bold text-sm"
                  />
                  <p className="text-2xs text-muted-foreground">
                    Active: {rangeDraft.maxRatio * 100}% of base
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-border bg-muted/20 space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <span className="w-2.5 h-2.5 rounded-full bg-warning" />
                Widened Range (Estimated Views / Low Confidence)
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-2xs font-bold text-muted-foreground uppercase">
                    Widened Min (0.40 - 0.95)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.4"
                    max="0.95"
                    value={rangeDraft.widenedMinRatio}
                    onChange={(e) =>
                      setRangeDraft({
                        ...rangeDraft,
                        widenedMinRatio: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="font-mono font-bold text-sm"
                  />
                  <p className="text-2xs text-muted-foreground">
                    Active: {rangeDraft.widenedMinRatio * 100}% of base
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-2xs font-bold text-muted-foreground uppercase">
                    Widened Max (1.10 - 2.50)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="1.1"
                    max="2.5"
                    value={rangeDraft.widenedMaxRatio}
                    onChange={(e) =>
                      setRangeDraft({
                        ...rangeDraft,
                        widenedMaxRatio: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="font-mono font-bold text-sm"
                  />
                  <p className="text-2xs text-muted-foreground">
                    Active: {rangeDraft.widenedMaxRatio * 100}% of base
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              variant="primary"
              disabled={isPending}
              onClick={handleSaveRange}
              className="text-xs font-bold"
            >
              Save Range Widths (v{version + 1})
            </Button>
          </div>
        </section>
      )}

      {/* TAB 5: Reach-Rate Bands */}
      {activeTab === "reach" && (
        <section className="rounded-3xl border border-border bg-card p-6 shadow-xs space-y-6">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Radio className="w-4 h-4 text-primary" />
              Platform Reach-Rate Bands (P03 Fallback)
            </h3>
            <p className="text-xs text-muted-foreground">
              Tuned in Basis Points (100 bps = 1.00%). When historical API delivery snapshots are unavailable, expected views are projected using these algorithmic distribution bands multiplied by authentic audience reach.
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Instagram Reach Bands
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(["REEL", "POST", "STORY"] as const).map((fmt) => {
                const band = reachDraft.INSTAGRAM[fmt];
                return (
                  <div key={fmt} className="p-4 rounded-2xl border border-border bg-muted/20 space-y-3">
                    <span className="font-bold text-xs uppercase text-foreground">{fmt}</span>
                    <div className="grid grid-cols-3 gap-2 text-2xs font-mono">
                      <div>
                        <span className="text-muted-foreground block">Low</span>
                        <Input
                          type="number"
                          value={band.lowBps}
                          onChange={(e) =>
                            setReachDraft({
                              ...reachDraft,
                              INSTAGRAM: {
                                ...reachDraft.INSTAGRAM,
                                [fmt]: { ...band, lowBps: parseInt(e.target.value, 10) || 0 },
                              },
                            })
                          }
                          className="h-7 text-xs font-mono font-bold"
                        />
                        <span className="text-muted-foreground">{(band.lowBps / 100).toFixed(1)}%</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Mid</span>
                        <Input
                          type="number"
                          value={band.midBps}
                          onChange={(e) =>
                            setReachDraft({
                              ...reachDraft,
                              INSTAGRAM: {
                                ...reachDraft.INSTAGRAM,
                                [fmt]: { ...band, midBps: parseInt(e.target.value, 10) || 0 },
                              },
                            })
                          }
                          className="h-7 text-xs font-mono font-bold"
                        />
                        <span className="text-muted-foreground">{(band.midBps / 100).toFixed(1)}%</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">High</span>
                        <Input
                          type="number"
                          value={band.highBps}
                          onChange={(e) =>
                            setReachDraft({
                              ...reachDraft,
                              INSTAGRAM: {
                                ...reachDraft.INSTAGRAM,
                                [fmt]: { ...band, highBps: parseInt(e.target.value, 10) || 0 },
                              },
                            })
                          }
                          className="h-7 text-xs font-mono font-bold"
                        />
                        <span className="text-muted-foreground">{(band.highBps / 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground pt-2">
              YouTube Reach Bands
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(["VIDEO", "SHORT"] as const).map((fmt) => {
                const band = reachDraft.YOUTUBE[fmt];
                return (
                  <div key={fmt} className="p-4 rounded-2xl border border-border bg-muted/20 space-y-3">
                    <span className="font-bold text-xs uppercase text-foreground">{fmt}</span>
                    <div className="grid grid-cols-3 gap-2 text-2xs font-mono">
                      <div>
                        <span className="text-muted-foreground block">Low</span>
                        <Input
                          type="number"
                          value={band.lowBps}
                          onChange={(e) =>
                            setReachDraft({
                              ...reachDraft,
                              YOUTUBE: {
                                ...reachDraft.YOUTUBE,
                                [fmt]: { ...band, lowBps: parseInt(e.target.value, 10) || 0 },
                              },
                            })
                          }
                          className="h-7 text-xs font-mono font-bold"
                        />
                        <span className="text-muted-foreground">{(band.lowBps / 100).toFixed(1)}%</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Mid</span>
                        <Input
                          type="number"
                          value={band.midBps}
                          onChange={(e) =>
                            setReachDraft({
                              ...reachDraft,
                              YOUTUBE: {
                                ...reachDraft.YOUTUBE,
                                [fmt]: { ...band, midBps: parseInt(e.target.value, 10) || 0 },
                              },
                            })
                          }
                          className="h-7 text-xs font-mono font-bold"
                        />
                        <span className="text-muted-foreground">{(band.midBps / 100).toFixed(1)}%</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">High</span>
                        <Input
                          type="number"
                          value={band.highBps}
                          onChange={(e) =>
                            setReachDraft({
                              ...reachDraft,
                              YOUTUBE: {
                                ...reachDraft.YOUTUBE,
                                [fmt]: { ...band, highBps: parseInt(e.target.value, 10) || 0 },
                              },
                            })
                          }
                          className="h-7 text-xs font-mono font-bold"
                        />
                        <span className="text-muted-foreground">{(band.highBps / 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              variant="primary"
              disabled={isPending}
              onClick={handleSaveReach}
              className="text-xs font-bold"
            >
              Save Reach Bands (v{version + 1})
            </Button>
          </div>
        </section>
      )}

      {/* TAB 6: "Simulate a Creator" Sandbox */}
      {activeTab === "simulate" && (
        <section className="rounded-3xl border border-border bg-card p-6 shadow-xs space-y-6">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-primary" />
              Creator Valuation Simulation Sandbox
            </h3>
            <p className="text-xs text-muted-foreground">
              Run test scenarios through the pure Fair Price Engine (v{version}) to test how inputs, multipliers, and bounds evaluate into an estimated market range.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Input Parameters Column */}
            <div className="lg:col-span-1 space-y-4 rounded-2xl border border-border bg-muted/20 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Simulation Inputs
              </h4>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-2xs font-bold text-muted-foreground uppercase">
                    Platform &amp; Format
                  </label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <select
                      value={simCreator.platform}
                      onChange={(e) =>
                        setSimCreator({
                          ...simCreator,
                          platform: e.target.value,
                          contentType: e.target.value === "YOUTUBE" ? "VIDEO" : "REEL",
                        })
                      }
                      className="text-xs font-bold bg-card border border-border rounded-lg px-2 py-1.5 text-foreground"
                    >
                      <option value="INSTAGRAM">Instagram</option>
                      <option value="YOUTUBE">YouTube</option>
                    </select>

                    <select
                      value={simCreator.contentType}
                      onChange={(e) => setSimCreator({ ...simCreator, contentType: e.target.value })}
                      className="text-xs font-bold bg-card border border-border rounded-lg px-2 py-1.5 text-foreground"
                    >
                      {simCreator.platform === "INSTAGRAM" ? (
                        <>
                          <option value="REEL">Reel</option>
                          <option value="POST">Post / Carousel</option>
                          <option value="STORY">Story</option>
                        </>
                      ) : (
                        <>
                          <option value="VIDEO">Video</option>
                          <option value="SHORT">Short</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-2xs font-bold text-muted-foreground uppercase">
                    Category Baseline
                  </label>
                  <select
                    value={simCreator.categoryKey}
                    onChange={(e) => setSimCreator({ ...simCreator, categoryKey: e.target.value })}
                    className="w-full text-xs font-bold bg-card border border-border rounded-lg px-2 py-1.5 text-foreground mt-1"
                  >
                    {benchmarks.map((b) => (
                      <option key={b.rawKey} value={b.rawKey}>
                        {b.category} (₹{b.baselineRupees} CPV)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-2xs font-bold text-muted-foreground uppercase">
                    Followers / Subscribers
                  </label>
                  <Input
                    type="number"
                    value={simCreator.followers}
                    onChange={(e) =>
                      setSimCreator({
                        ...simCreator,
                        followers: Math.max(0, parseInt(e.target.value, 10) || 0),
                      })
                    }
                    className="font-mono text-xs font-bold mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-2xs font-bold text-muted-foreground uppercase">
                      Eng. Rate %
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      value={simCreator.engagementRatePercent}
                      onChange={(e) =>
                        setSimCreator({
                          ...simCreator,
                          engagementRatePercent: e.target.value,
                        })
                      }
                      className="font-mono text-xs font-bold mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-2xs font-bold text-muted-foreground uppercase">
                      Authenticity (0-100)
                    </label>
                    <Input
                      type="number"
                      value={simCreator.authenticityScore}
                      onChange={(e) =>
                        setSimCreator({
                          ...simCreator,
                          authenticityScore: Math.min(
                            100,
                            Math.max(0, parseInt(e.target.value, 10) || 0)
                          ),
                        })
                      }
                      className="font-mono text-xs font-bold mt-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-2xs font-bold text-muted-foreground uppercase">
                    DRS Reputation Score (300 - 900)
                  </label>
                  <Input
                    type="number"
                    value={simCreator.drsScore}
                    onChange={(e) =>
                      setSimCreator({
                        ...simCreator,
                        drsScore: Math.min(900, Math.max(300, parseInt(e.target.value, 10) || 0)),
                      })
                    }
                    className="font-mono text-xs font-bold mt-1"
                  />
                </div>

                <div className="pt-2 border-t border-border/60 space-y-2">
                  <div className="font-bold text-2xs uppercase tracking-wider text-muted-foreground">
                    Add-ons &amp; Deliverables
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-2xs text-muted-foreground">Count</span>
                      <Input
                        type="number"
                        min="1"
                        value={simCreator.deliverablesCount}
                        onChange={(e) =>
                          setSimCreator({
                            ...simCreator,
                            deliverablesCount: Math.max(1, parseInt(e.target.value, 10) || 1),
                          })
                        }
                        className="h-7 text-xs font-mono font-bold mt-0.5"
                      />
                    </div>
                    <div>
                      <span className="text-2xs text-muted-foreground">Stories</span>
                      <Input
                        type="number"
                        min="0"
                        value={simCreator.storiesCount}
                        onChange={(e) =>
                          setSimCreator({
                            ...simCreator,
                            storiesCount: Math.max(0, parseInt(e.target.value, 10) || 0),
                          })
                        }
                        className="h-7 text-xs font-mono font-bold mt-0.5"
                      />
                    </div>
                    <div>
                      <span className="text-2xs text-muted-foreground">Usage (days)</span>
                      <Input
                        type="number"
                        min="0"
                        value={simCreator.usageRightsDays}
                        onChange={(e) =>
                          setSimCreator({
                            ...simCreator,
                            usageRightsDays: Math.max(0, parseInt(e.target.value, 10) || 0),
                          })
                        }
                        className="h-7 text-xs font-mono font-bold mt-0.5"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <label className="text-2xs text-foreground font-medium flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={simCreator.rawFootage}
                        onChange={(e) =>
                          setSimCreator({ ...simCreator, rawFootage: e.target.checked })
                        }
                        className="rounded border-border text-primary"
                      />
                      Raw Footage Buyout
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Output & Step-by-Step Valuation Column */}
            <div className="lg:col-span-2 space-y-4">
              {/* Valuation Result Banner */}
              <div className="p-5 rounded-2xl border border-primary/20 bg-primary/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">
                    Estimated Market Range
                  </span>
                  <Badge variant="primary" className="text-2xs font-mono font-bold uppercase">
                    Confidence: {simulationResult.confidence}
                  </Badge>
                </div>

                <div className="flex items-baseline gap-3">
                  <span className="text-2xl sm:text-3xl font-extrabold text-foreground font-mono">
                    ₹{(simulationResult.minPaise / 100).toLocaleString("en-IN")} – ₹
                    {(simulationResult.maxPaise / 100).toLocaleString("en-IN")}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    (Mid: ₹{(simulationResult.basePaise / 100).toLocaleString("en-IN")})
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1 text-2xs">
                  <span className="text-muted-foreground">
                    Projected Views:{" "}
                    <strong className="text-foreground font-mono">
                      {simulationResult.expectedViews.toLocaleString("en-IN")}
                    </strong>
                  </span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">
                    Quality Flag:{" "}
                    <Badge variant="ghost" className="text-2xs py-0">
                      {simulationResult.dataQuality}
                    </Badge>
                  </span>
                </div>
              </div>

              {/* Engine Step Breakdown Table */}
              <div className="rounded-2xl border border-border overflow-hidden">
                <div className="bg-muted/40 px-4 py-2.5 border-b border-border text-xs font-bold text-foreground">
                  Valuation Breakdown Waterfall
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/20 text-muted-foreground uppercase font-mono tracking-wider text-2xs">
                    <tr>
                      <th className="p-3">Step</th>
                      <th className="p-3">Description</th>
                      <th className="p-3 text-right">Running Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {simulationResult.explanation.map((item, idx) => (
                      <tr key={idx} className="hover:bg-muted/10 font-mono">
                        <td className="p-3 font-sans font-bold text-foreground">{item.step}</td>
                        <td className="p-3 font-sans text-muted-foreground">{item.description}</td>
                        <td className="p-3 text-right font-bold text-foreground">
                          ₹{(item.runningTotalPaise / 100).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
