"use client";

import React, { useState } from "react";
import { apiClient } from "@/lib/api-client";
import { formatUserError } from "@/lib/user-messages";
import { Download, FileText, Calendar, Filter, CheckCircle2, AlertCircle, Printer, Loader2 } from "lucide-react";
import { Button, Input, Modal } from "@/components/ui";
import { StatementPrintView, type StatementTransaction } from "./StatementPrintView";

interface StatementExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  userType?: string | null | undefined;
  userName?: string | null | undefined;
  userEmail?: string | null | undefined;
  userId?: string | null | undefined;
  currentBalance?: number | undefined;
}

export function StatementExportModal({
  isOpen,
  onClose,
  userType,
  userName,
  userEmail,
  userId,
  currentBalance = 0,
}: StatementExportModalProps) {
  const [period, setPeriod] = useState<"30D" | "CURRENT_MONTH" | "90D" | "FY2526" | "CUSTOM">("CURRENT_MONTH");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [txnType, setTxnType] = useState<"ALL" | "CREDIT" | "WITHDRAWAL">("ALL");
  const [isExporting, setIsExporting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [printData, setPrintData] = useState<{
    transactions: StatementTransaction[];
    periodLabel: string;
    startStr: string;
    endStr: string;
  } | null>(null);

  if (!isOpen) return null;

  const calculateDateRange = () => {
    const now = new Date();
    let start: Date;
    let end = now;

    if (period === "30D") {
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (period === "CURRENT_MONTH") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === "90D") {
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    } else if (period === "FY2526") {
      start = new Date("2025-04-01T00:00:00Z");
      end = new Date("2026-03-31T23:59:59Z");
    } else {
      start = startDate ? new Date(startDate) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      end = endDate ? new Date(endDate) : now;
    }

    const formatLocalDate = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    return {
      startStr: formatLocalDate(start),
      endStr: formatLocalDate(end),
    };
  };

  const handleDownloadCsv = async () => {
    setIsExporting(true);
    setExportError(null);

    const todayStr = new Date().toISOString().slice(0, 10);
    if (period === "CUSTOM") {
      if (startDate && startDate > todayStr) {
        setExportError("Start date cannot be in the future.");
        setIsExporting(false);
        return;
      }
      if (endDate && endDate > todayStr) {
        setExportError("End date cannot be in the future.");
        setIsExporting(false);
        return;
      }
      if (startDate && endDate && startDate > endDate) {
        setExportError("Start date cannot be after end date.");
        setIsExporting(false);
        return;
      }
    }

    try {
      const { startStr, endStr } = calculateDateRange();

      const blob = await apiClient.wallet.exportTransactionsCsv({
        startDate: startStr,
        endDate: endStr,
        type: txnType,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `VyaparMedia-Statement-${startStr}-to-${endStr}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      onClose();
    } catch (err: unknown) {
      setExportError(formatUserError(err, "Failed to download statement. Please try again."));
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrintStatement = async () => {
    setIsPrinting(true);
    setExportError(null);

    const todayStr = new Date().toISOString().slice(0, 10);
    if (period === "CUSTOM") {
      if (startDate && startDate > todayStr) {
        setExportError("Start date cannot be in the future.");
        setIsPrinting(false);
        return;
      }
      if (endDate && endDate > todayStr) {
        setExportError("End date cannot be in the future.");
        setIsPrinting(false);
        return;
      }
      if (startDate && endDate && startDate > endDate) {
        setExportError("Start date cannot be after end date.");
        setIsPrinting(false);
        return;
      }
    }

    try {
      const { startStr, endStr } = calculateDateRange();
      const params: Parameters<typeof apiClient.wallet.getTransactions>[0] = {
        startDate: startStr,
        endDate: endStr,
        limit: 100,
      };
      if (txnType !== "ALL") {
        params.type = txnType;
      }
      const res = await apiClient.wallet.getTransactions(params);

      const txns: StatementTransaction[] = (res?.data?.transactions || []).map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        status: t.status,
        description: t.description,
        createdAt: t.createdAt,
      }));

      const label =
        period === "CURRENT_MONTH"
          ? "This Month"
          : period === "30D"
          ? "Last 30 Days"
          : period === "90D"
          ? "Last Quarter"
          : period === "FY2526"
          ? "Financial Year 2025-26"
          : `${startStr} to ${endStr}`;

      setPrintData({
        transactions: txns,
        periodLabel: label,
        startStr,
        endStr,
      });
    } catch (err: unknown) {
      setExportError(formatUserError(err, "Failed to load statement for print preview. Please try again."));
    } finally {
      setIsPrinting(false);
    }
  };

  const headerTitle = (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
        <FileText className="w-5 h-5" />
      </div>
      <div>
        <h3 className="font-heading font-bold text-base text-foreground">
          Download Financial Statement
        </h3>
        <p className="text-xs text-muted-foreground font-normal">
          Generate an official ledger statement for accounting &amp; tax records.
        </p>
      </div>
    </div>
  );

  return (
    <>
      <Modal
        open={isOpen && !printData}
        onClose={onClose}
        title={headerTitle}
        maxWidth="32rem"
    >
      <div className="space-y-5">
        {/* Period Selector */}
        <div>
          <label className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-primary" />
            Statement Period
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {[
              { id: "CURRENT_MONTH", label: "This Month" },
              { id: "30D", label: "Last 30 Days" },
              { id: "90D", label: "Last Quarter" },
              { id: "FY2526", label: "FY 2025-26" },
              { id: "CUSTOM", label: "Custom Range" },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id as typeof period)}
                className={`p-2.5 rounded-xl border font-semibold text-center transition-all cursor-pointer ${
                  period === p.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted/30 hover:bg-muted text-muted-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Range Inputs */}
        {period === "CUSTOM" && (
          <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-muted/40 border border-border">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground mb-1 block" htmlFor="custom-start-date">
                Start Date
              </label>
              <Input
                id="custom-start-date"
                type="date"
                max={endDate || new Date().toISOString().slice(0, 10)}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground mb-1 block" htmlFor="custom-end-date">
                End Date
              </label>
              <Input
                id="custom-end-date"
                type="date"
                min={startDate || undefined}
                max={new Date().toISOString().slice(0, 10)}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>
        )}

        {/* Filter by Type */}
        <div>
          <label className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-primary" />
            Transaction Filter
          </label>
          <div className="flex gap-2 text-xs">
            {[
              { id: "ALL", label: "All Activity" },
              { id: "CREDIT", label: "Credits Only" },
              { id: "WITHDRAWAL", label: "Withdrawals Only" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTxnType(t.id as typeof txnType)}
                className={`flex-1 p-2 rounded-xl border font-semibold text-center transition-all cursor-pointer ${
                  txnType === t.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted/30 hover:bg-muted text-muted-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tax Compliance Note */}
        <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 text-xs text-muted-foreground space-y-1">
          <div className="font-semibold text-foreground flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-verified" />
            <span>Includes PAN &amp; TDS Section 194-O / 194-S Line Items</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            Statements generated conform to Indian tax reporting guidelines and can be submitted for ITR/GST filing.
          </p>
        </div>

        {exportError && (
          <div className="p-3 rounded-xl bg-disputed-muted border border-disputed-border text-disputed text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{exportError}</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handlePrintStatement}
            disabled={isPrinting || isExporting}
            className="gap-1.5 text-xs font-semibold"
          >
            {isPrinting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Preparing PDF...</span>
              </>
            ) : (
              <>
                <Printer className="w-3.5 h-3.5" />
                <span>Print / Save PDF</span>
              </>
            )}
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={isExporting || isPrinting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleDownloadCsv}
              disabled={isExporting || isPrinting}
              className="gap-1.5 font-bold"
            >
              <Download className="w-4 h-4" />
              {isExporting ? "Generating..." : "Download CSV"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>

    {/* Official RazorpayX / Stripe Benchmark Printable Statement */}
    {printData && (
      <StatementPrintView
        user={{
          id: userId || "VM-USER",
          email: userEmail,
          name: userName,
          userType,
        }}
        transactions={printData.transactions}
        periodLabel={printData.periodLabel}
        startDate={printData.startStr}
        endDate={printData.endStr}
        currentBalance={currentBalance}
        onClose={() => {
          setPrintData(null);
          onClose();
        }}
      />
    )}
    </>
  );
}
