"use client";

import React from "react";
import { formatCurrency } from "@/lib/utils-client";
import { Layers, CheckCircle2, TrendingUp, ShieldCheck } from "lucide-react";

interface DealsMetricsBarProps {
  activeCount: number;
  completedCount: number;
  totalEarningsPaise: number;
  isInfluencer: boolean;
}

export function DealsMetricsBar({
  activeCount,
  completedCount,
  totalEarningsPaise,
  isInfluencer,
}: Readonly<DealsMetricsBarProps>) {
  return (
    <section aria-label="Deal collaboration metrics" className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      {/* 1. Active Collaborations */}
      <div className="rounded-2xl border border-primary/20 bg-card p-5 shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-primary" /> Active Pipeline
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary shrink-0 whitespace-nowrap">
            In Progress
          </span>
        </div>
        <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-foreground">
          {activeCount}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          Live milestone collaborations with locked escrow.
        </p>
      </div>

      {/* 2. Completed Deals */}
      <div className="rounded-2xl border border-verified-border bg-card p-5 shadow-xs hover:border-verified-border/80 transition-all flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-verified" /> Completed Deals
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-verified-muted text-verified border border-verified-border shrink-0 whitespace-nowrap">
            <ShieldCheck className="w-3 h-3" /> Settled
          </span>
        </div>
        <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-foreground">
          {completedCount}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          Successfully verified campaigns with escrow released.
        </p>
      </div>

      {/* 3. Total Commercial Volume */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs hover:border-border/80 transition-all flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
            {isInfluencer ? "Total Earnings" : "Total Campaign Spend"}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground shrink-0 whitespace-nowrap">
            INR
          </span>
        </div>
        <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-foreground">
          {formatCurrency(totalEarningsPaise)}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          {isInfluencer
            ? "Cumulative earnings across all verified collaborations."
            : "Total budget deployed across verified creators."}
        </p>
      </div>
    </section>
  );
}
