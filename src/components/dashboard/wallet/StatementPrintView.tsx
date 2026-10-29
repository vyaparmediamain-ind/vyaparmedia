"use client";

import React, { useMemo } from "react";
import { ShieldCheck, FileText, Printer, X, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils-client";
import { Button } from "@/components/ui";
import { TDS_194O_RATE_PERCENT_STRING, TDS_194J_RATE_PERCENT_STRING } from "@/constants";
import { PLATFORM_CONFIG } from "@/lib/platform-config";

export interface StatementTransaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  description?: string | null | undefined;
  createdAt: string | Date;
}

export interface StatementPrintViewProps {
  user: {
    id: string;
    email?: string | null | undefined;
    userType?: string | null | undefined;
    name?: string | null | undefined;
  };
  transactions: StatementTransaction[];
  periodLabel: string;
  startDate: string;
  endDate: string;
  currentBalance: number;
  onClose: () => void;
  referenceId?: string | undefined;
  generatedDate?: string | undefined;
}

export function StatementPrintView({
  user,
  transactions,
  periodLabel,
  startDate,
  endDate,
  currentBalance,
  onClose,
  referenceId,
  generatedDate,
}: StatementPrintViewProps) {
  const statementRef = referenceId || `STMT-${user.id.slice(-6).toUpperCase()}`;
  const displayDate = generatedDate || endDate;

  // Compute summary numbers
  const { totalCredits, totalDebits, openingBalance } = useMemo(() => {
    let credits = 0;
    let debits = 0;

    for (const t of transactions) {
      if (t.status !== "COMPLETED") continue;
      const isCredit = ["DEPOSIT", "PAYOUT", "REFUND", "CREDIT"].includes(t.type);
      if (isCredit) {
        credits += t.amount;
      } else {
        debits += t.amount;
      }
    }

    const net = credits - debits;
    const opening = Math.max(0, currentBalance - net);

    return {
      totalCredits: credits,
      totalDebits: debits,
      openingBalance: opening,
    };
  }, [transactions, currentBalance]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-background/90 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pl-[max(0.75rem,env(safe-area-inset-left,0px))] pr-[max(0.75rem,env(safe-area-inset-right,0px))] print:p-0 print:bg-card print:static print:inset-auto">
      {/* Floating Action Bar (Hidden on Print) */}
      <div className="fixed top-[max(1rem,calc(env(safe-area-inset-top,0px)+8px))] right-[max(1rem,calc(env(safe-area-inset-right,0px)+8px))] z-[110] flex items-center gap-2.5 no-print bg-card/90 backdrop-blur-md p-2 rounded-2xl border border-border shadow-xl">
        <Button
          onClick={handlePrint}
          variant="primary"
          size="sm"
          className="gap-1.5 font-bold shadow-xs"
        >
          <Printer className="w-4 h-4" />
          <span>Print / Save PDF</span>
        </Button>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          title="Close Preview"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Official Financial Statement (Stripe & RazorpayX Standard) */}
      <div className="printable-document w-full max-w-4xl bg-card text-foreground rounded-2xl shadow-2xl p-8 sm:p-12 border border-border print:border-none print:shadow-none print:p-0 print:rounded-none">
        
        {/* Header & Platform Corporate Letterhead */}
        <div className="border-b-2 border-border pb-6 mb-8 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <span className="text-2xs font-mono font-bold tracking-widest text-primary uppercase block mb-1">
              OFFICIAL FINANCIAL STATEMENT &amp; LEDGER RECORD
            </span>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground uppercase">
              Wallet Account Statement
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Escrow-protected transactions governed by RBI guidelines &amp; Indian Contract Act
            </p>
          </div>

          <div className="text-left sm:text-right text-xs text-muted-foreground space-y-0.5 font-sans">
            <div className="font-bold text-foreground">{PLATFORM_CONFIG.legalName.toUpperCase()}</div>
            <div>
              {PLATFORM_CONFIG.cin && !["N/A", "NONE", "PROPRIETORSHIP"].includes(PLATFORM_CONFIG.cin.toUpperCase()) ? `CIN: ${PLATFORM_CONFIG.cin} | ` : ""}
              {PLATFORM_CONFIG.udyam ? `Udyam: ${PLATFORM_CONFIG.udyam} | ` : ""}
              GSTIN: {PLATFORM_CONFIG.gstin}
              {PLATFORM_CONFIG.pan ? ` | PAN: ${PLATFORM_CONFIG.pan}` : ""}
            </div>
            <div>{PLATFORM_CONFIG.address}</div>
            <div className="font-mono text-2xs text-muted-foreground pt-1">
              Generated: {displayDate} | Ref: {statementRef}
            </div>
          </div>
        </div>

        {/* Account Holder & Statement Period Details */}
        <section className="print-section mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="border border-border rounded-xl p-4 bg-muted/40 space-y-1.5">
              <span className="text-2xs font-bold text-muted-foreground uppercase tracking-wider block">
                Account Holder Dossier
              </span>
              <div className="text-sm font-bold text-foreground">
                {user.name || user.email || "Verified Platform Member"}
              </div>
              <div className="text-muted-foreground"><strong>User ID:</strong> {user.id}</div>
              <div className="text-muted-foreground"><strong>Account Type:</strong> {user.userType || "Standard Member"}</div>
              <div className="text-muted-foreground"><strong>Email:</strong> {user.email || "Protected"}</div>
            </div>

            <div className="border border-border rounded-xl p-4 bg-muted/40 space-y-1.5">
              <span className="text-2xs font-bold text-muted-foreground uppercase tracking-wider block">
                Statement Parameters
              </span>
              <div className="text-sm font-bold text-foreground">
                {periodLabel}
              </div>
              <div className="text-muted-foreground"><strong>From:</strong> {startDate}</div>
              <div className="text-muted-foreground"><strong>To:</strong> {endDate}</div>
              <div className="text-muted-foreground"><strong>Currency:</strong> Indian Rupee (INR ₹)</div>
            </div>
          </div>
        </section>

        {/* Executive Account Movement Summary (RazorpayX Benchmark) */}
        <section className="print-section mb-8 space-y-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-foreground border-b border-border pb-1">
            Account Balance &amp; Movement Summary
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 border border-border rounded-xl bg-muted/40">
              <span className="text-2xs text-muted-foreground font-semibold block uppercase">Opening Balance</span>
              <span className="text-base sm:text-lg font-black text-foreground tabular-nums">
                {formatCurrency(openingBalance)}
              </span>
              <span className="text-2xs text-muted-foreground block mt-0.5">At period start</span>
            </div>

            <div className="p-3.5 border border-verified-border rounded-xl bg-verified-muted">
              <span className="text-2xs text-verified font-semibold block uppercase flex items-center gap-1">
                <ArrowDownRight className="w-3 h-3 text-verified" />
                Total Inflow (+)
              </span>
              <span className="text-base sm:text-lg font-black text-verified tabular-nums">
                +{formatCurrency(totalCredits)}
              </span>
              <span className="text-2xs text-verified block mt-0.5">Deposits &amp; Earnings</span>
            </div>

            <div className="p-3.5 border border-destructive/30 rounded-xl bg-destructive/10">
              <span className="text-2xs text-destructive font-semibold block uppercase flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3 text-destructive" />
                Total Outflow (-)
              </span>
              <span className="text-base sm:text-lg font-black text-destructive tabular-nums">
                -{formatCurrency(totalDebits)}
              </span>
              <span className="text-2xs text-destructive block mt-0.5">Escrow, Fees, Payouts</span>
            </div>

            <div className="p-3.5 border border-primary/30 rounded-xl bg-primary/10">
              <span className="text-2xs text-primary font-semibold block uppercase">Closing Balance</span>
              <span className="text-base sm:text-lg font-black text-primary tabular-nums">
                {formatCurrency(currentBalance)}
              </span>
              <span className="text-2xs text-primary block mt-0.5">Current Withdrawable</span>
            </div>
          </div>
        </section>

        {/* Itemized Transaction Ledger (Stripe Standard) */}
        <section className="print-section mb-8 space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-1">
            <h2 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Itemized Transaction Ledger ({transactions.length} Records)</span>
            </h2>
            <span className="text-2xs font-mono text-muted-foreground">
              Amounts in INR (₹)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse border border-border">
              <thead>
                <tr className="bg-muted text-foreground">
                  <th className="border border-border p-2.5 font-bold">Date &amp; Time (IST)</th>
                  <th className="border border-border p-2.5 font-bold">Transaction Ref</th>
                  <th className="border border-border p-2.5 font-bold">Category</th>
                  <th className="border border-border p-2.5 font-bold">Description</th>
                  <th className="border border-border p-2.5 font-bold text-right">Inflow (+)</th>
                  <th className="border border-border p-2.5 font-bold text-right">Outflow (-)</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length > 0 ? (
                  transactions.map((t, idx) => {
                    const isCredit = ["DEPOSIT", "PAYOUT", "REFUND", "CREDIT"].includes(t.type);
                    return (
                      <tr key={t.id || idx} className="border-t border-border">
                        <td className="border border-border p-2 font-mono text-2xs text-muted-foreground whitespace-nowrap">
                          {formatDate(t.createdAt)}
                        </td>
                        <td className="border border-border p-2 font-mono text-2xs text-muted-foreground">
                          #{t.id.slice(-8).toUpperCase()}
                        </td>
                        <td className="border border-border p-2 font-semibold text-foreground">
                          {t.type.replaceAll("_", " ")}
                        </td>
                        <td className="border border-border p-2 text-muted-foreground max-w-xs truncate">
                          {t.description || "Escrow settlement transaction"}
                        </td>
                        <td className="border border-border p-2 text-right font-mono font-bold text-verified">
                          {isCredit ? `+${formatCurrency(t.amount)}` : "—"}
                        </td>
                        <td className="border border-border p-2 text-right font-mono font-bold text-destructive">
                          {!isCredit ? `-${formatCurrency(t.amount)}` : "—"}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="border border-border p-4 text-center text-muted-foreground italic">
                      No transactions recorded within this statement period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Statutory Disclosures & Compliance Notes */}
        <section className="print-section signature-block pt-6 border-t-2 border-border space-y-3 text-2xs text-muted-foreground">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
            <div className="flex items-center gap-1.5 font-bold text-foreground">
              <ShieldCheck className="w-4 h-4 text-verified" />
              <span>Statutory Compliance &amp; Tax Statement Verification</span>
            </div>
            <div className="font-mono text-muted-foreground">
              SAC Code: 998365 (Advertising, Marketing &amp; Influencer Services)
            </div>
          </div>

          <div className="space-y-1.5 leading-relaxed text-muted-foreground">
            <p>
              1. <strong>TDS Compliance:</strong> Tax Deduction at Source (TDS) under Section 194-O ({TDS_194O_RATE_PERCENT_STRING} for e-commerce transactions above statutory thresholds) 
              or Section 194-J ({TDS_194J_RATE_PERCENT_STRING} for professional fees) is withheld and deposited directly with the Government of India against verified PAN.
            </p>
            <p>
              2. <strong>Escrow Reassurance:</strong> All campaign funds are held in RBI-compliant escrow accounts and are disbursed strictly upon deliverable approval.
            </p>
            <p>
              3. <strong>System Certification:</strong> This is a computer-generated statement issued by the automated ledger system of {PLATFORM_CONFIG.legalName} 
              and does not require a physical signature. For queries, contact {PLATFORM_CONFIG.billingEmail}.
            </p>
          </div>
        </section>

      </div>
    </div>
  );
}
