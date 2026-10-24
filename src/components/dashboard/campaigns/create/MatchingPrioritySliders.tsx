"use client";

import React from "react";
import {
  Scale,
  Zap,
  ShieldCheck,
  TrendingUp,
  Sliders,
  Target,
  Award,
  RotateCcw,
} from "lucide-react";
import {
  MATCHING_PRIORITY_META,
  MATCHING_PRIORITY_PRESETS,
  type MatchingPriorityPreset,
  type MatchingWeights,
} from "@/lib/matching-priority";
import { Button } from "@/components/ui";

interface MatchingPrioritySlidersProps {
  priority: MatchingPriorityPreset;
  customWeights?: MatchingWeights | undefined;
  onChange: (priority: MatchingPriorityPreset, weights?: MatchingWeights) => void;
}

export function MatchingPrioritySliders({
  priority,
  customWeights,
  onChange,
}: MatchingPrioritySlidersProps) {
  // Current effective weights
  const currentWeights: MatchingWeights =
    customWeights || MATCHING_PRIORITY_PRESETS[priority] || MATCHING_PRIORITY_PRESETS.BALANCED;

  const currentPercent = {
    category: Math.round(currentWeights.category * 100),
    engagement: Math.round(currentWeights.engagement * 100),
    authenticity: Math.round(currentWeights.authenticity * 100),
    quality: Math.round(currentWeights.quality * 100),
    roi: Math.round(currentWeights.roi * 100),
  };

  const totalPercent =
    currentPercent.category +
    currentPercent.engagement +
    currentPercent.authenticity +
    currentPercent.quality +
    currentPercent.roi;

  const handlePresetSelect = (presetKey: MatchingPriorityPreset) => {
    if (presetKey === "CUSTOM") {
      onChange("CUSTOM", { ...currentWeights });
    } else {
      onChange(presetKey, undefined);
    }
  };

  const handleSliderChange = (pillar: keyof MatchingWeights, valPercent: number) => {
    const updated = {
      ...currentWeights,
      [pillar]: Number((valPercent / 100).toFixed(2)),
    };
    onChange("CUSTOM", updated);
  };

  const handleNormalize = () => {
    const sum = totalPercent > 0 ? totalPercent : 100;
    const normalized: MatchingWeights = {
      category: Number((currentPercent.category / sum).toFixed(2)),
      engagement: Number((currentPercent.engagement / sum).toFixed(2)),
      authenticity: Number((currentPercent.authenticity / sum).toFixed(2)),
      quality: Number((currentPercent.quality / sum).toFixed(2)),
      roi: Number((currentPercent.roi / sum).toFixed(2)),
    };
    onChange("CUSTOM", normalized);
  };

  const pillars: Array<{
    key: keyof MatchingWeights;
    label: string;
    icon: React.ReactNode;
    description: string;
    color: string;
  }> = [
    {
      key: "category",
      label: "Category Relevance",
      icon: <Target className="w-3.5 h-3.5" />,
      description: "Match with campaign categories & creator niche focus",
      color: "accent-primary",
    },
    {
      key: "engagement",
      label: "Engagement Rate",
      icon: <Zap className="w-3.5 h-3.5" />,
      description: "Audience interaction vs tier benchmarks",
      color: "accent-sky-500",
    },
    {
      key: "authenticity",
      label: "Audience Authenticity",
      icon: <ShieldCheck className="w-3.5 h-3.5" />,
      description: "Bot-free audited followers & real community score",
      color: "accent-emerald-500",
    },
    {
      key: "quality",
      label: "Platform Quality & DRS",
      icon: <Award className="w-3.5 h-3.5" />,
      description: "Past deal ratings, on-time submissions & dispute history",
      color: "accent-amber-500",
    },
    {
      key: "roi",
      label: "Commercial ROI / CPV",
      icon: <TrendingUp className="w-3.5 h-3.5" />,
      description: "Cost-Per-View efficiency relative to category baseline",
      color: "accent-rose-500",
    },
  ];

  return (
    <div className="p-5 rounded-2xl border border-border bg-muted/40 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-primary" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            AI Matching Priority &amp; Weight Customization
          </h4>
        </div>
        <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20 w-fit">
          Brand Customizable
        </span>
      </div>

      <p className="text-xs text-muted-foreground">
        Choose a curated goal preset or fine-tune custom sliders to rank applicant creators and discovery results according to your campaign priorities.
      </p>

      {/* Preset Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {(["BALANCED", "REACH_FOCUSED", "TRUST_FOCUSED", "ROI_FOCUSED"] as MatchingPriorityPreset[]).map(
          (presetKey) => {
            const meta = MATCHING_PRIORITY_META[presetKey];
            const isSelected = priority === presetKey;

            const renderIcon = () => {
              switch (presetKey) {
                case "BALANCED":
                  return <Scale className="w-4 h-4" />;
                case "REACH_FOCUSED":
                  return <Zap className="w-4 h-4" />;
                case "TRUST_FOCUSED":
                  return <ShieldCheck className="w-4 h-4" />;
                case "ROI_FOCUSED":
                  return <TrendingUp className="w-4 h-4" />;
                default:
                  return <Sliders className="w-4 h-4" />;
              }
            };

            return (
              <button
                key={presetKey}
                type="button"
                onClick={() => handlePresetSelect(presetKey)}
                className={`flex flex-col text-left p-3.5 rounded-xl border transition-all duration-150 relative ${
                  isSelected
                    ? "bg-card border-primary shadow-xs ring-2 ring-primary/20"
                    : "bg-card/60 hover:bg-card border-border hover:border-border/80"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5 w-full">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {renderIcon()}
                  </div>
                  <span
                    className={`text-2xs font-bold px-1.5 py-0.5 rounded-full border shrink-0 whitespace-nowrap ${
                      isSelected
                        ? "bg-primary/10 text-primary border-primary/30"
                        : "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {meta.badge}
                  </span>
                </div>

                <span className="text-xs font-bold text-foreground block leading-tight">
                  {meta.label}
                </span>
                <span className="text-[11px] text-muted-foreground block leading-tight mt-0.5 line-clamp-1">
                  {meta.tagline}
                </span>
              </button>
            );
          }
        )}
      </div>

      {/* Fine-Tuning Sliders Section */}
      <div className="p-4 rounded-xl bg-card border border-border space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-bold text-foreground">
              Fine-Tune Weight Sliders
            </span>
            {priority === "CUSTOM" && (
              <span className="text-2xs font-bold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                Custom Sliders Active
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md border ${
                totalPercent === 100
                  ? "bg-verified-muted text-verified border-verified-border"
                  : "bg-warning-muted text-warning border-warning-border"
              }`}
            >
              Total: {totalPercent}%
            </span>
            {totalPercent !== 100 && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleNormalize}
                className="h-6 text-2xs px-2 font-bold gap-1"
              >
                <RotateCcw className="w-2.5 h-2.5" /> Auto-Balance
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-3.5 pt-1">
          {pillars.map((pillar) => {
            const val = currentPercent[pillar.key];

            return (
              <div key={pillar.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    {pillar.icon}
                    {pillar.label}
                  </span>
                  <span className="font-mono font-bold text-foreground">{val}%</span>
                </div>
                <input
                  id={`matching-slider-${pillar.key}`}
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={val}
                  onChange={(e) => handleSliderChange(pillar.key, parseInt(e.target.value, 10))}
                  aria-label={`${pillar.label} weighting percentage`}
                  className={`w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer ${pillar.color}`}
                />
                <p className="text-[11px] text-muted-foreground">{pillar.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
