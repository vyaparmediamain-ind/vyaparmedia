"use client";

import React, { useState, useMemo } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  HelpCircle,
  RotateCcw,
  Lock,
  Receipt,
  X,
} from "lucide-react";
import { Input, Card, PullToRefresh } from "@/components/ui";
import { formatCurrency, formatDateTime, formatDate } from "@/lib/utils-client";
import type { WalletTransactionItem } from "@/lib/schemas";

export type TransactionItem = WalletTransactionItem;

interface VirtualizedTransactionListProps {
  transactions: TransactionItem[];
  isLoading: boolean;
  onRefresh?: () => Promise<unknown> | void;
  onSelectTransaction?: (transaction: TransactionItem) => void;
}

const CREDIT_TYPES = new Set(["CREDIT", "REFUND"]);
const DEBIT_TYPES = new Set(["DEBIT", "WITHDRAWAL", "PLATFORM_FEE", "CLAWBACK", "CHARGEBACK"]);
const ESCROW_TYPES = new Set(["ESCROW_RELEASE", "ESCROW_LOCK", "ESCROW_HOLD", "MILESTONE_PAYMENT"]);

function getDateLabel(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const todayStr = now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === todayStr) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return formatDate(d, "Older", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "Older";
  }
}

function getCategoryIcon(type: string): React.ReactNode {
  switch (type.toUpperCase()) {
    case "CREDIT":
      return (
        <div className="w-9 h-9 rounded-full bg-verified-muted text-verified flex items-center justify-center shrink-0 border border-verified-border">
          <ArrowDownLeft className="w-4 h-4" />
        </div>
      );
    case "REFUND":
      return (
        <div className="w-9 h-9 rounded-full bg-verified-muted text-verified flex items-center justify-center shrink-0 border border-verified-border">
          <RotateCcw className="w-4 h-4" />
        </div>
      );
    case "WITHDRAWAL":
      return (
        <div className="w-9 h-9 rounded-full bg-escrow-muted text-escrow flex items-center justify-center shrink-0 border border-escrow-border">
          <Building2 className="w-4 h-4" />
        </div>
      );
    case "PLATFORM_FEE":
      return (
        <div className="w-9 h-9 rounded-full bg-muted text-muted-foreground flex items-center justify-center shrink-0 border border-border">
          <Receipt className="w-4 h-4" />
        </div>
      );
    case "ESCROW_RELEASE":
    case "ESCROW_LOCK":
    case "MILESTONE_PAYMENT":
      return (
        <div className="w-9 h-9 rounded-full bg-escrow-muted text-escrow flex items-center justify-center shrink-0 border border-escrow-border">
          <Lock className="w-4 h-4" />
        </div>
      );
    case "CLAWBACK":
    case "CHARGEBACK":
      return (
        <div className="w-9 h-9 rounded-full bg-disputed-muted text-disputed flex items-center justify-center shrink-0 border border-disputed-border">
          <AlertTriangle className="w-4 h-4" />
        </div>
      );
    default:
      return (
        <div className="w-9 h-9 rounded-full bg-muted text-muted-foreground flex items-center justify-center shrink-0 border border-border">
          <ArrowUpRight className="w-4 h-4" />
        </div>
      );
  }
}

export function VirtualizedTransactionList({
  transactions,
  isLoading,
  onRefresh,
  onSelectTransaction,
}: Readonly<VirtualizedTransactionListProps>) {
  const [activeFilter, setActiveFilter] = useState<"ALL" | "CREDIT" | "DEBIT" | "ESCROW" | "PENDING">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (activeFilter === "CREDIT" && !CREDIT_TYPES.has(tx.type)) return false;
      if (activeFilter === "DEBIT" && !DEBIT_TYPES.has(tx.type)) return false;
      if (activeFilter === "ESCROW") {
        const isEscrow = ESCROW_TYPES.has(tx.type) || (tx.description || "").toLowerCase().includes("escrow");
        if (!isEscrow) return false;
      }
      if (activeFilter === "PENDING" && tx.status !== "PENDING") return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const descMatch = (tx.description || "").toLowerCase().includes(query);
        const idMatch = tx.id.toLowerCase().includes(query);
        const typeMatch = tx.type.toLowerCase().includes(query);
        return descMatch || idMatch || typeMatch;
      }
      return true;
    });
  }, [transactions, activeFilter, searchQuery]);

  // Group by date label for CRED/Jupiter pattern
  const groupedTransactions = useMemo(() => {
    const groups: { label: string; items: TransactionItem[] }[] = [];
    const seen = new Map<string, number>();
    for (const tx of filteredTransactions) {
      const label = getDateLabel(tx.createdAt);
      const existingIdx = seen.get(label);
      if (existingIdx !== undefined) {
        const group = groups[existingIdx];
        if (group) group.items.push(tx);
      } else {
        seen.set(label, groups.length);
        groups.push({ label, items: [tx] });
      }
    }
    return groups;
  }, [filteredTransactions]);

  return (
    <Card className="p-5 sm:p-6 rounded-2xl border border-border bg-card shadow-xs flex flex-col h-full">
      {/* Header with Title and Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-base sm:text-lg font-heading font-bold text-foreground">
            Transaction Ledger
          </h2>
          <p className="text-xs text-muted-foreground">
            Chronological audit trail of all earnings, escrow settlements, and withdrawals.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Search by ID or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 text-xs sm:text-sm min-h-[44px] h-11 rounded-xl"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="w-11 h-11 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0 cursor-pointer"
              title="Refresh ledger"
              aria-label="Refresh transaction ledger"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          )}
        </div>
      </div>

      {/* PhonePe/CRED Categorized Filter Chips */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted border border-border mb-4 overflow-x-auto text-xs scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveFilter("ALL")}
          className={`px-3.5 py-2 min-h-[44px] inline-flex items-center justify-center rounded-lg font-semibold shrink-0 transition-colors cursor-pointer ${
            activeFilter === "ALL"
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          All ({transactions.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter("CREDIT")}
          className={`px-3.5 py-2 min-h-[44px] inline-flex items-center justify-center rounded-lg font-semibold shrink-0 transition-colors gap-1.5 cursor-pointer ${
            activeFilter === "CREDIT"
              ? "bg-card text-verified shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ArrowDownLeft className="w-3.5 h-3.5 text-verified" />
          Credits
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter("DEBIT")}
          className={`px-3.5 py-2 min-h-[44px] inline-flex items-center justify-center rounded-lg font-semibold shrink-0 transition-colors gap-1.5 cursor-pointer ${
            activeFilter === "DEBIT"
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground" />
          Debits
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter("ESCROW")}
          className={`px-3.5 py-2 min-h-[44px] inline-flex items-center justify-center rounded-lg font-semibold shrink-0 transition-colors gap-1.5 cursor-pointer ${
            activeFilter === "ESCROW"
              ? "bg-card text-escrow shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Lock className="w-3.5 h-3.5 text-escrow" />
          Escrow
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter("PENDING")}
          className={`px-3.5 py-2 min-h-[44px] inline-flex items-center justify-center rounded-lg font-semibold shrink-0 transition-colors gap-1.5 cursor-pointer ${
            activeFilter === "PENDING"
              ? "bg-card text-pending shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-pending" />
          Pending
        </button>
      </div>

      {/* Transaction List Area */}
      <PullToRefresh onRefresh={onRefresh || (() => {})} disabled={!onRefresh} className="relative w-full">
        {isLoading ? (
        <div className="space-y-3 py-2 animate-pulse" aria-label="Loading transactions">
          {[1, 2, 3, 4, 5].map((idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-muted/30"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted" />
                <div className="space-y-2">
                  <div className="w-32 sm:w-48 h-3.5 bg-muted rounded" />
                  <div className="w-20 h-2.5 bg-muted/80 rounded" />
                </div>
              </div>
              <div className="space-y-1.5 text-right">
                <div className="w-20 h-4 bg-muted rounded ml-auto" />
                <div className="w-14 h-3 bg-muted/80 rounded ml-auto" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border border-dashed border-border rounded-xl">
          <HelpCircle className="w-10 h-10 text-muted-foreground/50 mb-2" />
          <h3 className="font-heading font-bold text-sm text-foreground mb-1">
            No Transactions Found
          </h3>
          <p className="text-xs max-w-xs text-muted-foreground">
            {searchQuery
              ? "No transactions match your search filter."
              : "When you receive campaign payouts or perform withdrawals, they will appear here in your audit ledger."}
          </p>
        </div>
      ) : (
        /* ── CRED/Jupiter date-grouped ledger ──────────────────────────── */
        <div className="h-[480px] overflow-auto rounded-xl border border-border" aria-label="Transaction history">
          {groupedTransactions.map((group) => (
            <div key={group.label}>
              {/* Sticky date group header */}
              <div className="sticky top-0 z-10 px-4 py-1.5 bg-muted/80 backdrop-blur-sm border-b border-border flex items-center gap-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  {group.label}
                </span>
                <span className="text-[10px] text-muted-foreground/60 font-mono">
                  · {group.items.length} {group.items.length === 1 ? "txn" : "txns"}
                </span>
              </div>

              {/* Transactions in this group */}
              <div className="divide-y divide-border">
                {group.items.map((tx) => {
                  const isCredit = CREDIT_TYPES.has(tx.type);
                  const formattedAmount = formatCurrency(tx.amount);

                  let statusBadge = (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-verified-muted text-verified border border-verified-border">
                      <CheckCircle2 className="w-3 h-3" /> Completed
                    </span>
                  );

                  if (tx.status === "PENDING") {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-pending-muted text-pending border border-pending-border">
                        <Clock className="w-3 h-3" /> Pending
                      </span>
                    );
                  } else if (tx.status === "FAILED" || tx.status === "REVERSED") {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-disputed-muted text-disputed border border-disputed-border">
                        <AlertTriangle className="w-3 h-3" /> {tx.status}
                      </span>
                    );
                  }

                  return (
                    <div
                      key={tx.id}
                      onClick={() => onSelectTransaction?.(tx)}
                      className="flex items-center justify-between p-3.5 hover:bg-muted/40 transition-colors cursor-pointer"
                    >
                      {/* Left: Category Icon & Description */}
                      <div className="flex items-center gap-3 min-w-0">
                        {getCategoryIcon(tx.type)}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs sm:text-sm font-semibold truncate text-foreground">
                              {tx.description || tx.type.replaceAll("_", " ")}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span>{formatDateTime(tx.createdAt)}</span>
                            <span>•</span>
                            <span className="font-mono text-[10px]">
                              Ref: {tx.id.slice(0, 10)}...
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Amount & Status Badge */}
                      <div className="text-right shrink-0 pl-3">
                        <div
                          className={`text-sm sm:text-base font-bold font-mono tabular-nums tracking-tight ${
                            isCredit ? "text-verified" : "text-foreground"
                          }`}
                        >
                          {isCredit ? `+ ${formattedAmount}` : `- ${formattedAmount}`}
                        </div>
                        <div className="mt-0.5">{statusBadge}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      </PullToRefresh>
    </Card>
  );
}
