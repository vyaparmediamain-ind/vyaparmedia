"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/utils-client";
import {
  DEFAULT_BRAND_PLATFORM_FEE_PERCENT,
  DEFAULT_GATEWAY_FEE_PERCENT,
  DEFAULT_INCLUDED_REVISIONS,
} from "@/constants";

const MILESTONE_STAGE_PERCENTAGES = {
  STAGE_1: 30,
  STAGE_2: 40,
  STAGE_3: 30,
} as const;

const PRESET_BUDGETS = [25000, 50000, 100000, 250000];

export function EscrowSimulator() {
  const [budget, setBudget] = useState<number>(50000);

  const m1 = Math.round((budget * MILESTONE_STAGE_PERCENTAGES.STAGE_1) / 100);
  const m2 = Math.round((budget * MILESTONE_STAGE_PERCENTAGES.STAGE_2) / 100);
  const m3 = Math.round((budget * MILESTONE_STAGE_PERCENTAGES.STAGE_3) / 100);
  const platformFee = Math.round((budget * DEFAULT_BRAND_PLATFORM_FEE_PERCENT) / 100);
  const gatewayFee = Math.round(((budget + platformFee) * DEFAULT_GATEWAY_FEE_PERCENT) / 100);
  const totalBrandDeposit = budget + platformFee + gatewayFee;

  const formatRupees = (val: number) => formatCurrency(val * 100);

  return (
    <div className="w-full max-w-5xl mx-auto my-16 p-6 sm:p-10 rounded-2xl border border-border bg-card shadow-lg relative overflow-hidden">
      {/* Decorative gradient blur */}
      <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-verified/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 text-center max-w-2xl mx-auto mb-10">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-escrow-muted text-escrow border border-escrow-border mb-3 shrink-0 whitespace-nowrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Live Interactive Simulator
        </span>
        <h3 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
          See How Escrow Protects Every Rupee
        </h3>
        <p className="text-sm sm:text-base text-muted-foreground mt-2">
          Pick a campaign budget to visualize milestone-based fund locking and instant settlements.
        </p>
      </div>

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Budget Controls */}
        <div className="lg:col-span-5 flex flex-col gap-6 p-6 rounded-xl border border-border bg-background">
          <div>
            <label htmlFor="budget-slider" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Select Campaign Budget
            </label>
            <div className="flex items-center justify-between gap-2 mb-4">
              <span className="text-3xl font-black text-foreground">
                {formatRupees(budget)}
              </span>
              <span className="text-xs px-2.5 py-1 rounded-md font-semibold bg-verified-muted text-verified border border-verified-border">
                100% Guaranteed
              </span>
            </div>

            <input
              id="budget-slider"
              type="range"
              min={10000}
              max={500000}
              step={5000}
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              aria-label="Campaign budget slider"
              className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-muted accent-primary focus:outline-none"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>₹10,000</span>
              <span>₹5,00,000</span>
            </div>
          </div>

          {/* Preset Buttons */}
          <div>
            <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Quick Presets
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PRESET_BUDGETS.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant={budget === preset ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setBudget(preset)}
                  className="w-full text-xs font-semibold"
                >
                  {preset >= 100000 ? `₹${preset / 100000}L` : `₹${preset / 1000}K`}
                </Button>
              ))}
            </div>
          </div>

          {/* Financial Transparency Box */}
          <div className="pt-4 border-t border-border flex flex-col gap-2.5 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Creator Payout (Agreed Fee):</span>
              <span className="font-semibold text-foreground">{formatRupees(budget)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Platform Escrow Fee ({DEFAULT_BRAND_PLATFORM_FEE_PERCENT}%):</span>
              <span className="font-semibold text-foreground">{formatRupees(platformFee)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Payment Gateway Fee ({DEFAULT_GATEWAY_FEE_PERCENT}%):</span>
              <span className="font-semibold text-foreground">{formatRupees(gatewayFee)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Creator Deductions:</span>
              <span className="font-semibold text-verified font-mono">₹0 (Zero Cut)</span>
            </div>
            <div className="flex justify-between font-bold text-sm text-foreground pt-2 border-t border-border">
              <span>Total Brand Escrow Deposit:</span>
              <span className="text-primary">{formatRupees(totalBrandDeposit)}</span>
            </div>
          </div>

          <Link href="/register" className="w-full">
            <Button className="w-full font-bold shadow-md">
              Lock This Deal in Escrow
            </Button>
          </Link>
        </div>

        {/* Right Column: 3 Milestone Protection Cards */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Automated 3-Stage Milestone Release
            </span>
            <span className="text-xs text-escrow font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-escrow animate-pulse" />
              Protected by Razorpay Escrow
            </span>
          </div>

          {/* Milestone 1 */}
          <div className="p-4 sm:p-5 rounded-xl border border-border bg-background/50 hover:bg-background transition-all">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm flex-shrink-0">
                  1
                </span>
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-foreground">
                    Stage 1: Script & Storyboard Approval ({MILESTONE_STAGE_PERCENTAGES.STAGE_1}%)
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Creator shares script & visual concept in deal room.
                  </p>
                </div>
              </div>
              <span className="text-sm font-extrabold text-foreground flex-shrink-0">
                {formatRupees(m1)}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs pt-3 border-t border-border">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-escrow">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Locked in Escrow upfront
              </span>
              <span className="font-medium text-verified">Released on Brand Sign-off</span>
            </div>
          </div>

          {/* Milestone 2 */}
          <div className="p-4 sm:p-5 rounded-xl border border-border bg-background/50 hover:bg-background transition-all">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm flex-shrink-0">
                  2
                </span>
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-foreground">
                    Stage 2: Draft Video Preview ({MILESTONE_STAGE_PERCENTAGES.STAGE_2}%)
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Watermarked rough cut submitted for tweaks and branding check.
                  </p>
                </div>
              </div>
              <span className="text-sm font-extrabold text-foreground flex-shrink-0">
                {formatRupees(m2)}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs pt-3 border-t border-border">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-escrow">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Funds safely secured
              </span>
              <span className="font-medium text-verified">Up to {DEFAULT_INCLUDED_REVISIONS} revision rounds</span>
            </div>
          </div>

          {/* Milestone 3 */}
          <div className="p-4 sm:p-5 rounded-xl border border-border bg-background/50 hover:bg-background transition-all">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-verified/10 text-verified flex items-center justify-center font-bold text-sm flex-shrink-0">
                  3
                </span>
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-foreground">
                    Stage 3: Live Post & Verification ({MILESTONE_STAGE_PERCENTAGES.STAGE_3}%)
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Automated crawler verifies Instagram Reel/YouTube link & tags.
                  </p>
                </div>
              </div>
              <span className="text-sm font-extrabold text-verified flex-shrink-0">
                {formatRupees(m3)}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs pt-3 border-t border-border">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-verified">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Auto-Verified in 60s
              </span>
              <span className="font-bold text-verified">Instant UPI / Bank Settlement ⚡</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
