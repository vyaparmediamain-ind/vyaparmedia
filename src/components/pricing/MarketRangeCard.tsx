"use client";

import { useState } from "react";
import {
  TrendingUp,
  ShieldCheck,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  RefreshCw,
  Info,
  FileText,
} from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { compareQuotedRate, FairPriceOutput } from "@/lib/fair-price-engine";

export interface MarketRangeExplanationItem {
  step: string;
  description: string;
  contributionPaise?: number | undefined;
  runningTotalPaise?: number | undefined;
}

export interface MarketRangeCardProps {
  readonly minPaise?: number | null | undefined;
  readonly maxPaise?: number | null | undefined;
  readonly basePaise?: number | null | undefined;
  readonly confidence?: "HIGH" | "MEDIUM" | "LOW" | string | null | undefined;
  readonly dataQuality?: "VERIFIED" | "ESTIMATED" | "SELF_REPORTED" | string | null | undefined;
  readonly flags?: string[] | null | undefined;
  readonly explanation?: MarketRangeExplanationItem[] | null | undefined;
  readonly quotedRatePaise?: number | null | undefined;
  readonly isLoading?: boolean | undefined;
  readonly error?: string | null | undefined;
  readonly onRecompute?: (() => void) | undefined;
  readonly isRecomputing?: boolean | undefined;
  readonly compact?: boolean | undefined;
  readonly className?: string | undefined;
  readonly id?: string | undefined;
  readonly onViewReport?: (() => void) | undefined;
}

const FLAG_LABELS: Record<string, string> = {
  LOW_REACH_RATIO: "Reach ratio lower than peer average",
  LOW_ENGAGEMENT: "Engagement below tier benchmark",
  LOW_AUTHENTICITY: "Audience authenticity review recommended",
  INSUFFICIENT_DATA: "Limited recent API data points",
  ESTIMATED_VIEWS: "Views projected via reach estimator",
  PROFILE_STALE: "Metrics last updated over 60 days ago",
  RATE_ABOVE_RANGE: "Quoted rate is above estimated market range",
  RATE_BELOW_RANGE: "Quoted rate is below estimated market range",
};

/**
 * Market Range Card Component
 *
 * Displays algorithmic estimated market range guidance for influencer deliverables.
 * Strictly complies with platform copy mandates: never promises "guaranteed" or "fair price".
 */
export function MarketRangeCard({
  minPaise,
  maxPaise,
  basePaise,
  confidence,
  dataQuality,
  flags = [],
  explanation = [],
  quotedRatePaise,
  isLoading = false,
  error = null,
  onRecompute,
  isRecomputing = false,
  compact = false,
  className = "",
  id,
  onViewReport,
}: MarketRangeCardProps) {
  const [showExplanation, setShowExplanation] = useState(false);

  // 1. Loading / Skeleton State
  if (isLoading) {
    return (
      <div
        id={id}
        className={`rounded-xl border border-border bg-card p-4 sm:p-5 animate-pulse ${className}`}
        aria-busy="true"
        aria-label="Loading estimated market range"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="h-5 w-40 bg-muted rounded" />
          <div className="h-5 w-24 bg-muted rounded-full" />
        </div>
        <div className="h-8 w-56 bg-muted rounded my-3" />
        <div className="h-4 w-3/4 bg-muted rounded" />
      </div>
    );
  }

  // 2. Error State
  if (error) {
    return (
      <div
        id={id}
        className={`rounded-xl border border-border bg-card p-4 sm:p-5 ${className}`}
        role="alert"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-pending shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-foreground">
              Unable to load estimated market range
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
            {onRecompute && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onRecompute()}
                disabled={Boolean(isRecomputing)}
                className="mt-3 text-xs"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 mr-1.5 ${isRecomputing ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                Retry evaluation
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 3. Empty State ("Data kam hai")
  if (!minPaise || !maxPaise || minPaise <= 0 || maxPaise <= 0) {
    return (
      <div
        id={id}
        className={`rounded-xl border border-dashed border-border bg-muted/30 p-5 text-center ${className}`}
        role="status"
        aria-live="polite"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted mx-auto mb-2.5 text-muted-foreground">
          <AlertCircle className="h-5 w-5" aria-hidden="true" />
        </div>
        <h4 className="text-sm font-semibold text-foreground">Data kam hai</h4>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
          Insufficient verified data to estimate market range. Connect your social accounts or publish more deliverables to establish benchmarks.
        </p>
        {onRecompute && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onRecompute()}
            disabled={Boolean(isRecomputing)}
            className="mt-3 text-xs"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 mr-1.5 ${isRecomputing ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            Check for new metrics
          </Button>
        )}
      </div>
    );
  }

  const minRupees = Math.round(minPaise / 100).toLocaleString("en-IN");
  const maxRupees = Math.round(maxPaise / 100).toLocaleString("en-IN");

  // Comparison evaluation if quotedRatePaise is supplied
  let comparison: { position: "BELOW" | "WITHIN" | "ABOVE"; deltaPercent: number; statusMessage: string } | null = null;
  if (quotedRatePaise !== undefined && quotedRatePaise !== null && quotedRatePaise > 0) {
    const mockOutput: FairPriceOutput = {
      basePaise: basePaise ?? Math.round((minPaise + maxPaise) / 2),
      minPaise,
      maxPaise,
      expectedViews: 0,
      viewStatistic: "MEDIAN",
      confidence: (confidence as "HIGH" | "MEDIUM" | "LOW") || "MEDIUM",
      dataQuality: (dataQuality as "VERIFIED" | "ESTIMATED" | "SELF_REPORTED") || "ESTIMATED",
      flags: (flags as FairPriceOutput["flags"]) || [],
      explanation: (explanation as FairPriceOutput["explanation"]) || [],
      engineVersion: "1.0.0",
    };
    comparison = compareQuotedRate(quotedRatePaise, mockOutput);
  }

  return (
    <section
      id={id}
      aria-label="Estimated Market Range"
      className={`rounded-xl border border-border bg-card p-4 sm:p-5 ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 mb-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
            <TrendingUp className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Estimated Market Range
            </h3>
            <p className="text-xs text-muted-foreground">
              Statistical benchmark based on audience size, reach, and engagement
            </p>
          </div>
        </div>

        {/* Quality & Confidence Chips */}
        <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto">
          {confidence && (
            <Badge variant="ghost" className="text-xs">
              {confidence} confidence
            </Badge>
          )}

          {dataQuality === "VERIFIED" ? (
            <Badge variant="success" className="text-xs flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
              Verified API Data
            </Badge>
          ) : dataQuality === "SELF_REPORTED" ? (
            <Badge variant="ghost" className="text-xs">
              Self-reported
            </Badge>
          ) : (
            <Badge variant="ghost" className="text-xs">
              Estimated Views
            </Badge>
          )}
        </div>
      </div>

      {/* Main Range Display */}
      <div className="my-3 flex items-baseline gap-2">
        <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground tabular-nums">
          ₹{minRupees} – ₹{maxRupees}
        </span>
        <span className="text-xs text-muted-foreground font-normal">
          per primary deliverable
        </span>
      </div>

      {/* Non-blocking Quoted Rate Hint */}
      {comparison && (
        <div
          className={`p-2.5 rounded-lg mb-3 text-xs flex items-start gap-2 ${
            comparison.position === "WITHIN"
              ? "bg-verified-muted/60 text-verified border border-verified-border"
              : comparison.position === "ABOVE"
              ? "bg-pending/10 text-pending border border-pending/20"
              : "bg-muted text-foreground border border-border"
          }`}
          role="status"
        >
          <Info className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-semibold">
              {comparison.position === "WITHIN"
                ? "Within estimated market range"
                : comparison.position === "ABOVE"
                ? `${comparison.deltaPercent}% above benchmark midpoint`
                : `${Math.abs(comparison.deltaPercent)}% below benchmark midpoint`}
            </p>
            <p className="text-[11px] opacity-90 mt-0.5">{comparison.statusMessage}</p>
          </div>
        </div>
      )}

      {/* Plain-Language Flags */}
      {flags && flags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {flags.map((flag) => (
            <span
              key={flag}
              className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground border border-border"
            >
              {FLAG_LABELS[flag] || flag}
            </span>
          ))}
        </div>
      )}

      {/* Expandable "Kaise nikala" Explanation */}
      {!compact && explanation && explanation.length > 0 && (
        <div className="border-t border-border pt-3 mt-1">
          <button
            type="button"
            onClick={() => setShowExplanation((prev) => !prev)}
            className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
            aria-expanded={showExplanation}
            aria-controls="market-range-explanation-list"
          >
            <span>{showExplanation ? "Hide breakdown (Kaise nikala)" : "Kaise nikala? (Calculation breakdown)"}</span>
            {showExplanation ? (
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>

          {showExplanation && (
            <ul
              id="market-range-explanation-list"
              className="mt-2.5 space-y-1.5 text-xs text-muted-foreground"
              aria-live="polite"
            >
              {explanation.map((item, idx) => (
                <li
                  key={`${item.step}-${idx}`}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 rounded-lg bg-muted/40 border border-border/50 p-2"
                >
                  <span className="font-medium text-foreground">{item.description}</span>
                  {item.runningTotalPaise !== undefined && item.runningTotalPaise > 0 && (
                    <span className="tabular-nums text-xs text-muted-foreground shrink-0 font-mono">
                      Running Total: ₹{Math.round(item.runningTotalPaise / 100).toLocaleString("en-IN")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* A11y & Legal Transparency Footer */}
      <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <HelpCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span>Estimated market range is statistical guidance and does not guarantee deal bookings.</span>
        </span>

        <div className="flex items-center gap-1.5 shrink-0">
          {onViewReport && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onViewReport()}
              className="h-6 text-[11px] px-2 text-muted-foreground hover:text-foreground shrink-0 flex items-center gap-1"
            >
              <FileText className="h-3 w-3" aria-hidden="true" />
              View Market Range Report
            </Button>
          )}

          {onRecompute && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onRecompute()}
              disabled={Boolean(isRecomputing)}
              className="h-6 text-[11px] px-2 text-muted-foreground hover:text-foreground shrink-0"
            >
              <RefreshCw
                className={`h-3 w-3 mr-1 ${isRecomputing ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              Recalculate
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Compact Badge for Public Profiles & Discovery Cards
 * Renders "Within estimated market range" only when dataQuality is VERIFIED and flag is ON.
 */
export function MarketRangeBadge({
  dataQuality,
  isWithinRange = true,
  showPublicBadge = false,
  className = "",
}: {
  readonly dataQuality?: string | null | undefined;
  readonly isWithinRange?: boolean | undefined;
  readonly showPublicBadge?: boolean | undefined;
  readonly className?: string | undefined;
}) {
  if (!showPublicBadge || dataQuality !== "VERIFIED" || !isWithinRange) {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-verified-muted text-verified border border-verified-border shrink-0 whitespace-nowrap ${className}`}
      title="Creator rates are aligned with verified market reach"
    >
      <ShieldCheck className="w-3 h-3" aria-hidden="true" />
      <span>Within estimated market range</span>
    </span>
  );
}



/**
 * Comparison Pill for Applications Review & Pitch Comparison
 * Renders quoted rate vs estimated market range using compareQuotedRate.
 */
export function MarketRangeComparisonPill({
  quotedPaise,
  minPaise,
  maxPaise,
  className = "",
}: {
  readonly quotedPaise: number;
  readonly minPaise?: number | null | undefined;
  readonly maxPaise?: number | null | undefined;
  readonly className?: string | undefined;
}) {
  if (!minPaise || !maxPaise || minPaise <= 0 || maxPaise <= 0 || !quotedPaise || quotedPaise <= 0) {
    return null;
  }

  const mockOutput: FairPriceOutput = {
    basePaise: Math.round((minPaise + maxPaise) / 2),
    minPaise,
    maxPaise,
    expectedViews: 0,
    viewStatistic: "MEDIAN",
    confidence: "MEDIUM",
    dataQuality: "ESTIMATED",
    flags: [],
    explanation: [],
    engineVersion: "1.0.0",
  };

  const comparison = compareQuotedRate(quotedPaise, mockOutput);

  if (comparison.position === "WITHIN") {
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-verified-muted text-verified border border-verified-border shrink-0 ${className}`}
        title={comparison.statusMessage}
      >
        <ShieldCheck className="w-3 h-3" aria-hidden="true" />
        <span>Within estimated market range</span>
      </span>
    );
  }

  if (comparison.position === "ABOVE") {
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-pending/10 text-pending border border-pending/20 shrink-0 ${className}`}
        title={comparison.statusMessage}
      >
        <span>+{comparison.deltaPercent}% above benchmark</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground border border-border shrink-0 ${className}`}
      title={comparison.statusMessage}
    >
      <span>{comparison.deltaPercent}% below benchmark</span>
    </span>
  );
}
