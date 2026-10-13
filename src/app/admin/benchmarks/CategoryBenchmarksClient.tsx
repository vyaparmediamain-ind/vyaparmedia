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
} from "lucide-react";
import { Badge, Button, Input } from "@/components/ui";
import { updateCategoryBenchmarkAction, resetCategoryBenchmarkAction } from "@/app/admin/actions";
import { calculateRoiScore } from "@/lib/roi-calculator";

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
}

export default function CategoryBenchmarksClient({ initialBenchmarks }: Props) {
  const [benchmarks, setBenchmarks] = useState<CategoryBenchmarkItem[]>(initialBenchmarks);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editPaiseValue, setEditPaiseValue] = useState<string>("");
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Interactive ROI Simulator Sandbox state
  const [simCategoryA, setSimCategoryA] = useState("finance");
  const [simCategoryB, setSimCategoryB] = useState("fashion");
  const [simCpvRupees, setSimCpvRupees] = useState("0.50");

  const filteredBenchmarks = benchmarks.filter((b) =>
    b.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.rawKey.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleStartEdit = (item: CategoryBenchmarkItem) => {
    setEditingCategory(item.rawKey);
    setEditPaiseValue(String(item.baselinePaise));
  };

  const handleSave = (rawKey: string) => {
    const paise = parseInt(editPaiseValue, 10);
    if (isNaN(paise) || paise < 1 || paise > 5000) {
      setNotice({ type: "error", message: "Baseline CPV must be between 1 and 5000 paise (₹0.01 - ₹50.00)" });
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
          message: `Updated ${rawKey.toUpperCase()} baseline to ₹${(paise / 100).toFixed(2)} (${paise} paise). Takes effect immediately in matching algorithms!`,
        });
      } catch (err: unknown) {
        setNotice({
          type: "error",
          message: err instanceof Error ? err.message : "Failed to update category baseline",
        });
      }
    });
  };

  const handleReset = (rawKey: string) => {
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

  // Calculate live simulator scores
  const simCpvPaise = Math.round(parseFloat(simCpvRupees || "0") * 100);
  const scoreCatA = calculateRoiScore(simCpvPaise, simCategoryA);
  const scoreCatB = calculateRoiScore(simCpvPaise, simCategoryB);

  return (
    <div className="space-y-8">
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

      {/* Simulator Section: Proves Definition of Done */}
      <section aria-label="Interactive Relative ROI Simulator" className="rounded-3xl border border-border bg-card p-6 shadow-xs relative overflow-hidden">
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
          {/* Input: Benchmark CPV */}
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
                className="pl-8 text-base font-bold font-mono"
              />
            </div>
            <p className="text-2xs text-muted-foreground">
              Equivalent to {simCpvPaise} paise per verified view
            </p>
          </div>

          {/* Outcome Category A */}
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
              {scoreCatA >= 85 ? "🔥 Exceptional high-value deal in this niche" : scoreCatA >= 70 ? "✅ Fair and competitive market pricing" : "⚠️ High cost relative to category delivery"}
            </div>
          </div>

          {/* Outcome Category B */}
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
              {scoreCatB >= 85 ? "🔥 Exceptional high-value deal in this niche" : scoreCatB >= 70 ? "✅ Fair and competitive market pricing" : "⚠️ High cost relative to category delivery"}
            </div>
          </div>
        </div>
      </section>

      {/* Main Benchmarks Table Card */}
      <section aria-label="Category Benchmarks Management" className="rounded-3xl border border-border bg-card p-6 shadow-xs space-y-4">
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
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-xs"
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
                    <td className="p-3.5 font-bold text-foreground">
                      {b.category}
                    </td>

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
                            onClick={() => handleSave(b.rawKey)}
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
                              onClick={() => handleReset(b.rawKey)}
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
  );
}
