"use client";

import React from "react";
import Link from "next/link";
import { formatCurrency, getTrustTierLabel } from "@/lib/utils-client";
import { type WalletSummary } from "@/lib/schemas";
import { ShieldCheck, Lock, ArrowUpRight, Plus, Wallet, TrendingUp, Sparkles, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui";

interface FinancialOverviewBarProps {
  walletData: WalletSummary | null;
  isLoading: boolean;
  isBrand: boolean;
  trustScore?: number | undefined;
  level?: number | undefined;
}

export function FinancialOverviewBar({
  walletData,
  isLoading,
  isBrand,
  trustScore = 750,
  level = 1,
}: Readonly<FinancialOverviewBarProps>) {
  if (isLoading) {
    return (
      <section aria-label="Financial overview loading" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-36 rounded-2xl bg-card border border-border p-5 flex flex-col justify-between animate-pulse"
          >
            <div className="flex items-center justify-between">
              <div className="w-28 h-4 bg-muted rounded-md" />
              <div className="w-14 h-4 bg-muted rounded-full" />
            </div>
            <div className="w-44 h-8 bg-muted rounded-lg" />
            <div className="flex items-center justify-between pt-2 border-t border-border/40">
              <div className="w-24 h-3 bg-muted rounded-md" />
              <div className="w-16 h-3 bg-muted rounded-md" />
            </div>
          </div>
        ))}
      </section>
    );
  }

  const availableBalance = walletData?.balance ?? 0;
  const lockedInEscrow = walletData?.totalHeld ?? walletData?.pendingBalance ?? 0;
  const totalVolume = isBrand
    ? walletData?.totalSpent ?? 0
    : walletData?.totalEarned ?? 0;

  const trustTier = getTrustTierLabel(trustScore);

  return (
    <section aria-label="Financial overview" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* 1. AVAILABLE BALANCE CARD (CRED / JUPITER STYLE) */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between group hover:border-primary/50 transition-all">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5" />
              {isBrand ? "Wallet Balance" : "Available for Payout"}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
              Instant
            </span>
          </div>

          <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums tracking-tight text-foreground pt-1">
            {formatCurrency(availableBalance)}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {isBrand
              ? "Funds ready for 1-click campaign escrow lock."
              : "Immediately withdrawable to verified bank account."}
          </p>
        </div>

        <div className="pt-4 flex items-center gap-2 border-t border-border/60 mt-4">
          {isBrand ? (
            <Button
              href="/dashboard/wallet"
              variant="primary"
              size="sm"
              className="text-xs font-bold gap-1 shadow-xs w-full sm:w-auto"
            >
              <Plus className="w-3.5 h-3.5" /> Add Funds
            </Button>
          ) : (
            <Button
              href="/dashboard/wallet"
              variant="primary"
              size="sm"
              className="text-xs font-bold gap-1 shadow-xs w-full sm:w-auto"
            >
              <ArrowUpRight className="w-3.5 h-3.5" /> Withdraw
            </Button>
          )}
          <Button
            href="/dashboard/wallet"
            variant="ghost"
            size="sm"
            className="text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Ledger →
          </Button>
        </div>
      </div>

      {/* 2. ESCROW PROTECTED VAULT (COLLABR / CRED STYLE) */}
      <div className="rounded-2xl border border-escrow-border bg-escrow-muted p-5 shadow-xs flex flex-col justify-between">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-escrow flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              Locked in Escrow
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-escrow/15 text-escrow font-bold">
              Safe Vault
            </span>
          </div>

          <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums tracking-tight text-foreground pt-1">
            {formatCurrency(lockedInEscrow)}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {isBrand
              ? "Held in neutral escrow pending deliverable approval."
              : "Secured for active deals — releases upon brand sign-off."}
          </p>
        </div>

        <div className="pt-4 flex items-center justify-between border-t border-escrow-border/40 mt-4">
          <span className="text-[11px] font-semibold text-escrow flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> 100% Guaranteed Settlement
          </span>
          <Link
            href="/dashboard/deals"
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5"
          >
            Active Deals <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* 3. LIFETIME VOLUME & TRUST REPUTATION (PHONEPE / CRED STYLE) */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between sm:col-span-2 lg:col-span-1">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-verified" />
              {isBrand ? "Total Campaign Spend" : "Total Platform Earnings"}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-verified-muted text-verified font-bold flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Level {level}
            </span>
          </div>

          <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums tracking-tight text-foreground pt-1">
            {formatCurrency(totalVolume)}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Cumulative settled volume across all completed collaborations.
          </p>
        </div>

        <div className="pt-4 flex items-center justify-between border-t border-border mt-4">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold text-foreground">
              DRS: <span className="font-mono text-primary font-extrabold">{trustScore}</span>
              <span className="text-[10px] text-muted-foreground font-normal"> / 900</span>
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-medium" title="CIBIL-standard creator reputation tier (300-900)">
              {trustTier} (300-900)
            </span>
          </div>
          <Link
            href="/dashboard/leaderboard"
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5"
          >
            Rankings <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </section>
  );
}
