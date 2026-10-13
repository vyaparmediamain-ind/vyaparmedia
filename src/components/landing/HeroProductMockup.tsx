"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function HeroProductMockup() {
  const [view, setView] = useState<"influencer" | "brand">("influencer");

  return (
    <div className="w-full max-w-4xl mx-auto my-10 flex flex-col items-center gap-4">
      {/* View Selector Switch */}
      <div className="inline-flex p-1 rounded-full bg-muted border border-border shadow-inner">
        <button
          type="button"
          onClick={() => setView("influencer")}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
            view === "influencer"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Creator Workspace
        </button>
        <button
          type="button"
          onClick={() => setView("brand")}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
            view === "brand"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Brand Campaign Control
        </button>
      </div>

      {/* Main Glass/Token Panel */}
      <div className="w-full rounded-2xl border border-border bg-card shadow-2xl p-5 sm:p-7 relative overflow-hidden text-left">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between pb-4 mb-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-verified animate-pulse" />
            <span className="text-sm font-bold text-foreground">
              {view === "influencer" ? "Creator Deal Room & Escrow Hub" : "Brand Campaign Control Room"}
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-escrow-muted text-escrow border border-escrow-border shrink-0 whitespace-nowrap">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Live Escrow Active
          </span>
        </div>

        {view === "influencer" ? (
          /* ============ CREATOR DASHBOARD MOCK ============ */
          <div className="flex flex-col gap-5">
            {/* Top Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl border border-border bg-background">
                <span className="block text-[11px] font-medium text-muted-foreground">Available to Withdraw</span>
                <span className="text-xl font-black text-foreground">₹42,850</span>
                <span className="block text-[10px] text-verified font-medium mt-0.5">UPI Instant Transfer</span>
              </div>
              <div className="p-3.5 rounded-xl border border-border bg-background">
                <span className="block text-[11px] font-medium text-muted-foreground">DRS™ Trust Score</span>
                <span className="text-xl font-black text-verified">99% <span className="text-xs font-semibold text-muted-foreground">(Elite)</span></span>
                <span className="block text-[10px] text-muted-foreground mt-0.5">14/14 On-Time Deliveries</span>
              </div>
              <div className="p-3.5 rounded-xl border border-border bg-background">
                <span className="block text-[11px] font-medium text-muted-foreground">Escrow In-Progress</span>
                <span className="text-xl font-black text-primary">₹25,000</span>
                <span className="block text-[10px] text-muted-foreground mt-0.5">Locked & Secured</span>
              </div>
            </div>

            {/* Active Deal Status */}
            <div className="p-4 rounded-xl border border-border bg-muted/30">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <h4 className="text-sm font-bold text-foreground">
                    Nike India: Air Max Launch Campaign
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Deliverable: 1 Dedicated Instagram Reel (60s) + 1 Story Link
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 self-start sm:self-auto px-2.5 py-1 rounded-md text-xs font-bold bg-verified-muted text-verified border border-verified-border">
                  ₹25,000 Protected in Escrow
                </span>
              </div>

              {/* Milestone Stepper */}
              <div className="grid grid-cols-4 gap-2 pt-3 border-t border-border text-center">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-6 h-6 rounded-full bg-verified text-primary-foreground flex items-center justify-center text-xs font-bold">
                    ✓
                  </div>
                  <span className="text-[11px] font-bold text-foreground">Contract Signed</span>
                  <span className="text-[10px] text-muted-foreground">Legally Binding</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="w-6 h-6 rounded-full bg-verified text-primary-foreground flex items-center justify-center text-xs font-bold">
                    ✓
                  </div>
                  <span className="text-[11px] font-bold text-foreground">Escrow Funded</span>
                  <span className="text-[10px] text-muted-foreground">100% Locked</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold animate-pulse">
                    ●
                  </div>
                  <span className="text-[11px] font-bold text-primary">Brand Review</span>
                  <span className="text-[10px] text-muted-foreground">Draft Submitted</span>
                </div>
                <div className="flex flex-col items-center gap-1 opacity-60">
                  <div className="w-6 h-6 rounded-full bg-muted border border-border text-muted-foreground flex items-center justify-center text-xs">
                    4
                  </div>
                  <span className="text-[11px] font-semibold text-foreground">Instant Payout</span>
                  <span className="text-[10px] text-muted-foreground">Direct to UPI</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ============ BRAND DASHBOARD MOCK ============ */
          <div className="flex flex-col gap-5">
            {/* Top Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl border border-border bg-background">
                <span className="block text-[11px] font-medium text-muted-foreground">Active Campaigns</span>
                <span className="text-xl font-black text-foreground">3 Campaigns</span>
                <span className="block text-[10px] text-verified font-medium mt-0.5">8 Creators Engaged</span>
              </div>
              <div className="p-3.5 rounded-xl border border-border bg-background">
                <span className="block text-[11px] font-medium text-muted-foreground">Secured in Escrow</span>
                <span className="text-xl font-black text-primary">₹1,85,000</span>
                <span className="block text-[10px] text-muted-foreground mt-0.5">Zero Pre-payment Risk</span>
              </div>
              <div className="p-3.5 rounded-xl border border-border bg-background">
                <span className="block text-[11px] font-medium text-muted-foreground">ROI Performance</span>
                <span className="text-xl font-black text-verified">4.2x Earned Media</span>
                <span className="block text-[10px] text-muted-foreground mt-0.5">380K Authentic Reach</span>
              </div>
            </div>

            {/* Campaign Submissions Review */}
            <div className="p-4 rounded-xl border border-border bg-muted/30">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-foreground">
                  Submissions Awaiting Approval (1)
                </h4>
                <span className="text-xs font-semibold text-pending flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-pending animate-ping" />
                  48h Review Window
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border border-border bg-background gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                    AM
                  </div>
                  <div>
                    <span className="text-sm font-bold block text-foreground">Ananya Mehta (@stylewithananya)</span>
                    <span className="text-xs text-muted-foreground">Draft Reel preview submitted &bull; 58s duration</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" className="text-xs font-semibold">
                    Inspect Reel
                  </Button>
                  <Button size="sm" className="text-xs font-bold bg-verified hover:bg-verified/90 text-primary-foreground">
                    1-Click Approve & Pay
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
