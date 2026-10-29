"use client";

import React, { useState, useRef, useEffect } from "react";
import { Sparkles, HelpCircle, X, TrendingUp, ShieldCheck, Zap, Target, Award } from "lucide-react";
import {
  MATCHING_PRIORITY_META,
  MATCHING_PRIORITY_PRESETS,
  type MatchingPriorityPreset,
  type MatchingWeights,
} from "@/lib/matching-priority";

export interface MatchBreakdownData {
  categoryScore?: number;
  engagementScore?: number;
  authenticityScore?: number;
  qualityScore?: number;
  roiScore?: number;
  estimatedViews?: number;
  estimatedCpvPaise?: number;
  categoryBaselineCpvPaise?: number;
  categoryBenchmarkSource?: string;
  relativeCpvRatio?: number;
  categoryName?: string;
  matchingPriority?: MatchingPriorityPreset;
  weights?: MatchingWeights;
}

interface MatchScoreBadgeProps {
  score: number;
  breakdown?: MatchBreakdownData | null | undefined;
  creatorName?: string | undefined;
  className?: string | undefined;
}

export function MatchScoreBadge({
  score,
  breakdown,
  creatorName,
  className = "",
}: MatchScoreBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        isOpen &&
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const priority: MatchingPriorityPreset = breakdown?.matchingPriority || "BALANCED";
  const priorityMeta = MATCHING_PRIORITY_META[priority] || MATCHING_PRIORITY_META.BALANCED;
  const weights: MatchingWeights = breakdown?.weights || MATCHING_PRIORITY_PRESETS[priority] || MATCHING_PRIORITY_PRESETS.BALANCED;

  const getScoreColor = (val: number) => {
    if (val >= 80) return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
    if (val >= 60) return "bg-primary/10 text-primary border-primary/30";
    if (val >= 40) return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30";
    return "bg-muted text-muted-foreground border-border";
  };

  const getBarColor = (val: number) => {
    if (val >= 80) return "bg-emerald-500";
    if (val >= 60) return "bg-primary";
    if (val >= 40) return "bg-amber-500";
    return "bg-muted-foreground";
  };

  const pillars = [
    {
      id: "category",
      label: "Category & Niche Relevance",
      icon: <Target className="w-3.5 h-3.5" />,
      score: breakdown?.categoryScore ?? 50,
      weight: Math.round(weights.category * 100),
      description: "Direct match with campaign target categories and creator niche focus.",
    },
    {
      id: "engagement",
      label: "Audience Engagement Rate",
      icon: <Zap className="w-3.5 h-3.5" />,
      score: breakdown?.engagementScore ?? 50,
      weight: Math.round(weights.engagement * 100),
      description: "Interaction rate compared to tier benchmark medians.",
    },
    {
      id: "authenticity",
      label: "Audience Authenticity",
      icon: <ShieldCheck className="w-3.5 h-3.5" />,
      score: breakdown?.authenticityScore ?? 50,
      weight: Math.round(weights.authenticity * 100),
      description: "Verified active follower audit & bot protection score.",
    },
    {
      id: "quality",
      label: "Quality & Platform DRS Track Record",
      icon: <Award className="w-3.5 h-3.5" />,
      score: breakdown?.qualityScore ?? 50,
      weight: Math.round(weights.quality * 100),
      description: "Past deal ratings, on-time submissions & dispute record.",
    },
    {
      id: "roi",
      label: "Category-Relative CPV / Commercial ROI",
      icon: <TrendingUp className="w-3.5 h-3.5" />,
      score: breakdown?.roiScore ?? 50,
      weight: Math.round(weights.roi * 100),
      description: "Cost-Per-View efficiency relative to category baseline benchmarks.",
    },
  ];

  const estimatedCpv = breakdown?.estimatedCpvPaise ? breakdown.estimatedCpvPaise / 100 : null;
  const baselineCpv = breakdown?.categoryBaselineCpvPaise ? breakdown.categoryBaselineCpvPaise / 100 : null;

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Badge Button Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-all duration-150 hover:brightness-105 active:scale-95 shrink-0 whitespace-nowrap ${getScoreColor(
          score
        )}`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        title="Click to view detailed match score breakdown"
      >
        <Sparkles className="w-3.5 h-3.5 shrink-0" />
        <span>{score}% Match</span>
        <HelpCircle className="w-3 h-3 opacity-70 ml-0.5 hover:opacity-100" />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Match score breakdown details"
          className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl bg-card border border-border shadow-2xl p-5 z-50 animate-in fade-in-50 zoom-in-95 duration-150 text-left"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-border">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black text-foreground">
                  Match Score Breakdown
                </span>
                <span
                  className={`text-xs font-black px-2 py-0.5 rounded-full border shrink-0 whitespace-nowrap ${getScoreColor(
                    score
                  )}`}
                >
                  {score}/100
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {creatorName ? `Analysis for ${creatorName}` : "Algorithmic multi-factor fit"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              aria-label="Close breakdown"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Active Priority Tag */}
          <div className="my-3 p-2.5 rounded-xl bg-muted/40 border border-border flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Campaign Priority:
              </span>
              <span className="text-xs font-bold text-foreground">
                {priorityMeta.label}
              </span>
            </div>
            <span className="text-[10px] font-semibold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap">
              {priorityMeta.badge}
            </span>
          </div>

          {/* 5 Pillars Breakdown */}
          <div className="space-y-3 my-3">
            {pillars.map((pillar) => (
              <div key={pillar.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-foreground font-semibold">
                    <span className="text-muted-foreground">{pillar.icon}</span>
                    <span className="truncate max-w-[240px] sm:max-w-xs">{pillar.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5 tabular-nums shrink-0">
                    <span className="text-2xs text-muted-foreground font-medium">
                      ({pillar.weight}%)
                    </span>
                    <span className="font-bold text-foreground">{pillar.score}/100</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${getBarColor(
                      pillar.score
                    )}`}
                    style={{ width: `${Math.min(100, Math.max(0, pillar.score))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Commercial Projections Card */}
          {(estimatedCpv !== null || breakdown?.estimatedViews) && (
            <div className="mt-3 pt-3 border-t border-border space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Commercial Efficiency Projections
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {estimatedCpv !== null && (
                  <div className="p-2 rounded-lg bg-muted/40 border border-border">
                    <span className="text-[10px] text-muted-foreground block">Projected CPV</span>
                    <span className="font-black text-foreground tabular-nums">
                      ₹{estimatedCpv.toFixed(2)}
                    </span>
                    {baselineCpv !== null && (
                      <span className="text-[10px] text-muted-foreground block mt-0.5">
                        vs ₹{baselineCpv.toFixed(2)} {breakdown?.categoryName || "niche"} avg
                      </span>
                    )}
                  </div>
                )}
                {breakdown?.estimatedViews && (
                  <div className="p-2 rounded-lg bg-muted/40 border border-border">
                    <span className="text-[10px] text-muted-foreground block">Est. Views / Reel</span>
                    <span className="font-black text-foreground tabular-nums">
                      {breakdown.estimatedViews.toLocaleString("en-IN")}
                    </span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                      Based on verified reach
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer Note */}
          <div className="mt-3 pt-2 text-[10px] text-muted-foreground text-center">
            Weighted automatically according to your campaign priority strategy
          </div>
        </div>
      )}
    </div>
  );
}
