"use client";

import React, { useState, useEffect } from "react";
import { CampaignFormData, calculateCampaignEscrowPaise } from "./CampaignCreateHelpers";
import { formatCurrency, formatDate } from "@/lib/utils-client";
import {
  ShieldCheck,
  Lock,
  Layers,
  Users,
  Calendar,
  X,
  ReceiptText,
  Wallet,
  Sliders,
} from "lucide-react";
import { MATCHING_PRIORITY_META } from "@/lib/matching-priority";

interface CampaignSummarySidebarProps {
  readonly formData: CampaignFormData;
  readonly walletBalancePaise?: number | undefined;
}

function SidebarContent({ formData, walletBalancePaise = 0 }: CampaignSummarySidebarProps) {
  const {
    creatorPayoutPoolPaise,
    platformFeePaise: _platformFeePaise,
    basePlatformFeePaise,
    gatewayFeePaise,
    totalEscrowRequiredPaise,
    platformFeePercent,
    gatewayFeePercent,
    productHandlingFeePaise = 0,
  } = calculateCampaignEscrowPaise(
    formData.totalBudget,
    undefined,
    undefined,
    {
      requiresProduct: formData.requiresProduct,
      productValueRupees: formData.productValue,
      maxInfluencers: formData.maxInfluencers,
      perInfluencerBudgetRupees: formData.perInfluencerBudget,
    },
  );

  const totalDeliverablesCount = formData.deliverables.reduce(
    (acc, d) => acc + (d.count || 0),
    0
  );

  return (
    <div className="p-5 sm:p-6 rounded-3xl border border-border bg-card shadow-sm space-y-5">
      {/* Header Badge */}
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-escrow-muted text-escrow border border-escrow-border shrink-0 whitespace-nowrap">
          <Lock className="w-3 h-3" />
          <span>Escrow Estimate</span>
        </span>
        <span className="text-[11px] font-medium text-muted-foreground">
          Escrow-Protected
        </span>
      </div>

      {/* Campaign Title & Categories */}
      <div className="space-y-1.5">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Campaign Brief
        </p>
        <h4 className="text-sm font-black text-foreground line-clamp-2">
          {formData.title.trim() || "Untitled Campaign"}
        </h4>
        {formData.targetCategories.length > 0 ? (
          <div className="flex flex-wrap gap-1 pt-1">
            {formData.targetCategories.slice(0, 3).map((cat, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-muted text-foreground"
              >
                {cat}
              </span>
            ))}
            {formData.targetCategories.length > 3 && (
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-muted text-muted-foreground">
                +{formData.targetCategories.length - 3}
              </span>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground italic">
            No categories selected yet
          </p>
        )}
      </div>

      {/* Deliverables & Target Creators */}
      <div className="space-y-2 py-3 border-y border-border text-xs">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-primary" />
            <span>Deliverables</span>
          </span>
          <span className="font-bold text-foreground tabular-nums">
            {totalDeliverablesCount} items / creator
          </span>
        </div>

        <div className="flex items-center justify-between text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-primary" />
            <span>Influencer Slots</span>
          </span>
          <span className="font-bold text-foreground tabular-nums">
            {formData.maxInfluencers ? `${formData.maxInfluencers} Creators` : "Open Pool"}
          </span>
        </div>

        {formData.postingDeadline && (
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span>Posting Date</span>
            </span>
            <span className="font-bold text-foreground tabular-nums">
              {formatDate(formData.postingDeadline)}
            </span>
          </div>
        )}

        {formData.matchingPriority && (
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-primary" />
              <span>Match Priority</span>
            </span>
            <span className="font-bold text-foreground">
              {MATCHING_PRIORITY_META[formData.matchingPriority]?.label.split(" ")[0]}
            </span>
          </div>
        )}
      </div>

      {/* Creator Reach & Tier Estimator */}
      {(() => {
        const minFollowers = Math.max(0, formData.minFollowers || 0);
        const maxFollowers = formData.maxFollowers && formData.maxFollowers > minFollowers ? formData.maxFollowers : null;
        const slots = Math.max(1, formData.maxInfluencers || 1);

        let tier = "Nano Creators";
        let tierRange = "< 10K";
        if (minFollowers >= 500000) {
          tier = "Macro Creators";
          tierRange = "500K+";
        } else if (minFollowers >= 50000) {
          tier = "Mid-Tier Creators";
          tierRange = "50K–500K";
        } else if (minFollowers >= 10000) {
          tier = "Micro Creators";
          tierRange = "10K–50K";
        }

        let estimatedFollowersPerCreator = minFollowers;
        if (maxFollowers) {
          estimatedFollowersPerCreator = Math.round((minFollowers + maxFollowers) / 2);
        } else if (minFollowers > 0) {
          const multiplier = minFollowers < 10000 ? 1.4 : minFollowers < 50000 ? 1.3 : 1.2;
          estimatedFollowersPerCreator = Math.round(minFollowers * multiplier);
        } else {
          estimatedFollowersPerCreator = 1000;
        }

        let totalImpressionsPerCreator = 0;
        const deliverables = formData.deliverables && formData.deliverables.length > 0
          ? formData.deliverables
          : [{ type: "INSTAGRAM_POST", count: 1 }];

        for (const item of deliverables) {
          const count = Number(item.count) || 1;
          const type = String(item.type || "").toUpperCase();
          let reachRate = 0.30;
          if (type.includes("REEL") || type.includes("SHORT")) {
            reachRate = 0.45;
          } else if (type.includes("STORY")) {
            reachRate = 0.12;
          } else if (type.includes("VIDEO")) {
            reachRate = 0.35;
          }
          totalImpressionsPerCreator += Math.round(estimatedFollowersPerCreator * reachRate * count);
        }

        const minFloor = Math.round(minFollowers * 0.25 * deliverables.reduce((acc, d) => acc + (d.count || 1), 0));
        totalImpressionsPerCreator = Math.max(minFloor, totalImpressionsPerCreator);

        const totalProjectedReach = totalImpressionsPerCreator * slots;

        const formatImpressions = (val: number): string => {
          if (val >= 1000000) return `~${(val / 1000000).toFixed(1)}M impressions`;
          if (val >= 10000) return `~${Math.round(val / 1000)}K impressions`;
          if (val >= 1000) return `~${(val / 1000).toFixed(1)}K impressions`;
          return `~${val} impressions`;
        };

        return (
          <div className="p-3.5 rounded-2xl bg-muted/40 border border-border text-xs space-y-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <span className="text-primary font-bold">✨</span>
                <span>{tier}</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-card border border-border">
                {tierRange}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-border/60">
              <span className="text-[11px] text-muted-foreground">Projected Reach</span>
              <span className="font-bold text-primary tabular-nums font-mono text-xs">
                {formatImpressions(totalProjectedReach)}
              </span>
            </div>
          </div>
        );
      })()}

      {/* Financial Escrow Breakdown */}
      <div className="space-y-2 text-xs">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Financial Escrow Breakdown
        </p>

        <div className="flex items-center justify-between text-muted-foreground">
          <span>Creator Payout Pool</span>
          <span className="font-bold text-foreground tabular-nums">
            {formatCurrency(creatorPayoutPoolPaise)}
          </span>
        </div>

        {(creatorPayoutPoolPaise > 0 || productHandlingFeePaise === 0) && (
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Platform Escrow Fee ({platformFeePercent}%)</span>
            <span className="font-medium text-foreground tabular-nums">
              {formatCurrency(basePlatformFeePaise)}
            </span>
          </div>
        )}

        {productHandlingFeePaise > 0 && (
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Product Handling Escrow</span>
            <span className="font-medium text-foreground tabular-nums">
              {formatCurrency(productHandlingFeePaise)}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between text-muted-foreground">
          <span>Payment Gateway Fee ({gatewayFeePercent}%)</span>
          <span className="font-medium text-foreground tabular-nums">
            {formatCurrency(gatewayFeePaise)}
          </span>
        </div>

        {/* Grand Total Escrow Requirement */}
        <div className="pt-3 border-t border-border flex items-baseline justify-between">
          <div>
            <span className="text-xs font-black text-foreground block">
              Total Escrow Lock
            </span>
            <span className="text-[10px] text-muted-foreground">
              100% refundable if unfulfilled
            </span>
          </div>
          <span className="text-lg sm:text-xl font-black text-foreground tabular-nums text-right">
            {formatCurrency(totalEscrowRequiredPaise)}
          </span>
        </div>

        {/* Available Wallet Balance & Shortfall */}
        {walletBalancePaise !== undefined && (
          <div className="pt-3 border-t border-border space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-primary" />
                <span>Available Balance</span>
              </span>
              <span className="font-bold text-foreground tabular-nums">
                {formatCurrency(walletBalancePaise)}
              </span>
            </div>

            {walletBalancePaise < totalEscrowRequiredPaise ? (
              <div className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/25 text-destructive text-xs space-y-1">
                <div className="flex items-center justify-between font-bold">
                  <span>Shortfall:</span>
                  <span className="tabular-nums font-black">
                    {formatCurrency(totalEscrowRequiredPaise - walletBalancePaise)}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Deposit funds before launching.
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-between text-[11px] text-verified font-semibold">
                <span>Coverage</span>
                <span>Fully Funded ✓</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* High-Trust Escrow Guarantee Box */}
      <div className="p-3 rounded-2xl bg-verified-muted border border-verified-border flex items-start gap-2.5 text-xs text-verified">
        <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-bold text-foreground text-[11px]">
            Guaranteed Milestone Protection
          </p>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Funds are held securely in an escrow account and released to creators only upon your milestone approval.
          </p>
        </div>
      </div>
    </div>
  );
}

export function CampaignSummarySidebar({
  formData,
  walletBalancePaise = 0,
}: CampaignSummarySidebarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Lock body scroll when drawer is open on mobile
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  // Close on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const { totalEscrowRequiredPaise } = calculateCampaignEscrowPaise(
    formData.totalBudget,
    undefined,
    undefined,
    {
      requiresProduct: formData.requiresProduct,
      productValueRupees: formData.productValue,
      maxInfluencers: formData.maxInfluencers,
      perInfluencerBudgetRupees: formData.perInfluencerBudget,
    },
  );

  return (
    <>
      {/* ── Desktop: Sticky right panel ── */}
      <aside
        aria-label="Campaign Escrow Live Summary"
        className="hidden lg:block w-80 shrink-0 sticky top-24"
      >
        <SidebarContent formData={formData} walletBalancePaise={walletBalancePaise} />
      </aside>

      {/* ── Mobile: Floating Action Button ── */}
      <button
        type="button"
        aria-label="View escrow summary"
        onClick={() => setDrawerOpen(true)}
        className="lg:hidden fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] right-[max(1rem,calc(env(safe-area-inset-right,0px)+1rem))] z-40 flex items-center gap-2 pl-3 pr-4 py-3 rounded-2xl bg-escrow text-white shadow-xl shadow-escrow/30 text-xs font-bold transition-transform active:scale-95"
      >
        <ReceiptText className="w-4 h-4 shrink-0" />
        <span>Escrow Summary</span>
        {formData.totalBudget > 0 && (
          <span className="ml-1 bg-background/20 rounded-lg px-2 py-0.5 tabular-nums">
            {formatCurrency(totalEscrowRequiredPaise)}
          </span>
        )}
      </button>

      {/* ── Mobile: Slide-in Drawer ── */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer panel */}
          <div
            role="dialog"
            aria-label="Escrow summary drawer"
            aria-modal="true"
            className="lg:hidden fixed bottom-0 inset-x-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-background shadow-2xl animate-in slide-in-from-bottom duration-300 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))]"
          >
            {/* Drag handle + header */}
            <div className="sticky top-0 bg-background/95 backdrop-blur-sm px-5 pt-4 pb-3 border-b border-border flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-escrow" />
                <span className="text-sm font-black text-foreground">Escrow Summary</span>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close drawer"
                className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 pb-[max(2rem,calc(env(safe-area-inset-bottom,0px)+1rem))]">
              <SidebarContent formData={formData} walletBalancePaise={walletBalancePaise} />
            </div>
          </div>
        </>
      )}
    </>
  );
}
