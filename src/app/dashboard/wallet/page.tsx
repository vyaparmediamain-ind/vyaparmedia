"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { createSchemaFetcher } from "@/lib/fetcher";
import { apiClient } from "@/lib/api-client";
import { formatUserError } from "@/lib/user-messages";
import {
  walletTransactionsResponseSchema,
  type WalletTransactionsResponse,
  type WalletSummary,
  type WalletTransactionItem,
} from "@/lib/schemas";
import DashboardShell from "@/components/dashboard/DashboardShell";
import BankAccountManager from "@/components/dashboard/wallet/BankAccountManager";
import { VirtualizedTransactionList } from "@/components/dashboard/wallet/VirtualizedTransactionList";
import { FullScreenWithdrawFlow } from "@/components/dashboard/wallet/FullScreenWithdrawFlow";
import { StatementExportModal } from "@/components/dashboard/wallet/StatementExportModal";
import {
  MIN_WALLET_TOPUP_RUPEES,
  DEFAULT_TOAST_DURATION_MS,
} from "@/constants";
import { useTokenRefreshGuard } from "@/hooks/useTokenRefreshGuard";
import { useWallet } from "@/hooks/api/useWallet";
import { formatCurrency, formatDateTime } from "@/lib/utils-client";
import { checkWalletTopUpEligibility, checkWithdrawalEligibility } from "@/lib/action-eligibility";
import { copyToClipboard } from "@/lib/clipboard";
import {
  Button,
  Input,
  Modal,
  PullToRefresh,
  ToastContainer,
  type ToastItem,
  type ToastType,
  Skeleton,
  PageContainer,
  PageHeader,
} from "@/components/ui";

import {
  ShieldCheck,
  Lock,
  ArrowUpRight,
  ArrowDownLeft,
  Download,
  Building2,
  RefreshCw,
  Plus,
  TrendingUp,
  Zap,
  CheckCircle2,
  Copy,
  Check,
  CreditCard,
  Clock,
  AlertTriangle,
  AlertCircle,
  FileText,
  ExternalLink,
} from "lucide-react";

const walletTransactionsFetcher = createSchemaFetcher(walletTransactionsResponseSchema);

export type WalletData = WalletSummary;

const loadRazorpay = () => {
  return new Promise<boolean>((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const existingScript = document.getElementById("razorpay-checkout-sdk") as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(true), { once: true });
      existingScript.addEventListener("error", () => resolve(false), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = "razorpay-checkout-sdk";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

/* ── FinTech Loading Skeleton (Jupiter / PhonePe Style) ─────────────────── */

function WalletHeroSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-card border border-border p-6 sm:p-7 space-y-4">
          <div className="flex justify-between items-center">
            <Skeleton className="h-4 w-36 rounded-md" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <Skeleton className="h-12 w-64 rounded-lg" />
          <Skeleton className="h-4 w-48 rounded-md" />
          <Skeleton className="h-11 w-full rounded-xl pt-2" />
        </div>
        <div className="rounded-2xl bg-card border border-border p-6 sm:p-7 space-y-4">
          <div className="flex justify-between items-center">
            <Skeleton className="h-4 w-36 rounded-md" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <Skeleton className="h-12 w-64 rounded-lg" />
          <Skeleton className="h-4 w-48 rounded-md" />
          <Skeleton className="h-11 w-full rounded-xl pt-2" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
    </div>
  );
}

/* ── Transaction Receipt Modal (CRED / PhonePe Pattern) ───────────────────── */

interface ReceiptModalProps {
  transaction: WalletTransactionItem | null;
  isOpen: boolean;
  onClose: () => void;
}

function TransactionReceiptModal({ transaction, isOpen, onClose }: Readonly<ReceiptModalProps>) {
  const [copied, setCopied] = useState(false);

  if (!transaction) return null;

  const isCredit = transaction.type === "CREDIT" || transaction.type === "REFUND";
  const formattedAmount = formatCurrency(transaction.amount);

  const handleCopyId = async () => {
    if (!transaction.id) return;
    const ok = await copyToClipboard(transaction.id);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Modal open={isOpen} onClose={onClose} title="Transaction Details" maxWidth="460px">
      <div className="space-y-5 pt-1">
        {/* Big Amount Header */}
        <div className="text-center p-5 rounded-2xl bg-muted/40 border border-border flex flex-col items-center justify-center space-y-2">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center text-lg ${
              isCredit
                ? "bg-verified-muted text-verified border border-verified-border"
                : "bg-muted text-foreground border border-border"
            }`}
          >
            {isCredit ? <ArrowDownLeft className="w-6 h-6" /> : <ArrowUpRight className="w-6 h-6" />}
          </div>
          <div
            className={`text-3xl sm:text-4xl font-extrabold font-mono tabular-nums tracking-tight ${
              isCredit ? "text-verified" : "text-foreground"
            }`}
          >
            {isCredit ? `+ ${formattedAmount}` : `- ${formattedAmount}`}
          </div>
          <div className="flex items-center gap-2">
            {transaction.status === "COMPLETED" && (
              <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-verified-muted text-verified border border-verified-border shrink-0 whitespace-nowrap">
                <CheckCircle2 className="w-3.5 h-3.5" /> Successful Transfer
              </span>
            )}
            {transaction.status === "PENDING" && (
              <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-pending-muted text-pending border border-pending-border shrink-0 whitespace-nowrap">
                <Clock className="w-3.5 h-3.5" /> Processing IMPS
              </span>
            )}
            {(transaction.status === "FAILED" || transaction.status === "REVERSED") && (
              <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-disputed-muted text-disputed border border-disputed-border shrink-0 whitespace-nowrap">
                <AlertTriangle className="w-3.5 h-3.5" /> {transaction.status}
              </span>
            )}
          </div>
        </div>

        {/* Audit Breakdown List */}
        <div className="space-y-2.5 text-xs">
          <div className="flex justify-between py-2 border-b border-border/60">
            <span className="text-muted-foreground">Description</span>
            <span className="font-semibold text-foreground text-right max-w-[240px] truncate">
              {transaction.description || transaction.type.replaceAll("_", " ")}
            </span>
          </div>

          <div className="flex justify-between py-2 border-b border-border/60">
            <span className="text-muted-foreground">Category</span>
            <span className="font-semibold text-foreground uppercase tracking-wider text-[11px] px-2 py-0.5 rounded bg-muted">
              {transaction.type.replaceAll("_", " ")}
            </span>
          </div>

          <div className="flex justify-between py-2 border-b border-border/60">
            <span className="text-muted-foreground">Timestamp</span>
            <span className="font-semibold text-foreground font-mono">
              {formatDateTime(transaction.createdAt)}
            </span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-border/60">
            <span className="text-muted-foreground">Transaction ID</span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[11px] text-foreground truncate max-w-[180px]">
                {transaction.id}
              </span>
              <button
                type="button"
                onClick={handleCopyId}
                className="w-11 h-11 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Copy Transaction ID"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-verified" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <Button type="button" variant="secondary" fullWidth onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ── Main Wallet Page (CRED / PhonePe / Jupiter Benchmark) ─────── */

export default function WalletPage() {
  const { data: session } = useSession();
  const { requireFreshSession } = useTokenRefreshGuard();

  const [activeTab, setActiveTab] = useState<"ledger" | "accounts">("ledger");
  const [showWithdrawFlow, setShowWithdrawFlow] = useState(false);
  const [showAddFundsModal, setShowAddFundsModal] = useState(false);
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [selectedTx, setSelectedTx] = useState<WalletTransactionItem | null>(null);
  const [isAddingFunds, setIsAddingFunds] = useState(false);
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState<string>("");

  // ── Toasts ────────────────────────────────────────────────────────────────
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const handleRemoveToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: string) => {
      const id = String(Date.now());
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => handleRemoveToast(id), DEFAULT_TOAST_DURATION_MS);
    },
    [handleRemoveToast],
  );

  // ── Wallet Data Hook ──────────────────────────────────────────────────────
  const {
    walletData,
    userType: hookUserType,
    isLoading: isWalletLoading,
    refresh: fetchWalletData,
  } = useWallet();

  // ── Transactions Query ────────────────────────────────────────────────────
  const {
    data: txResponse,
    isLoading: isTxLoading,
    mutate: mutateTransactions,
  } = useSWR<WalletTransactionsResponse>(
    session?.user?.id ? "/api/wallet/transactions?limit=100" : null,
    walletTransactionsFetcher,
    { revalidateOnFocus: true },
  );

  const userType = hookUserType || session?.user?.userType || null;
  const isBrand = userType === "BRAND";
  const transactions = useMemo(() => txResponse?.transactions || [], [txResponse?.transactions]);

  const topUpEligibility = useMemo(() => {
    return checkWalletTopUpEligibility(
      topUpAmount,
      walletData ? { isFrozen: walletData.isFrozen } : null,
      (session?.user as { status?: string } | undefined)?.status
    );
  }, [topUpAmount, walletData, session?.user]);

  // ── Automatic Visibility Reconciliation ─────────────────────────────────────
  useEffect(() => {
    if (!session?.user?.id) return;
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        fetchWalletData();
        mutateTransactions();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [session?.user?.id, fetchWalletData, mutateTransactions]);

  const handleRefreshAll = useCallback(async () => {
    await Promise.all([fetchWalletData(), mutateTransactions()]);
    showToast("success", "Wallet data refreshed.");
  }, [fetchWalletData, mutateTransactions, showToast]);

  // ── Add Funds via Razorpay Gateway ─────────────────────────────────────────
  const handleAddFunds = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fresh = await requireFreshSession();
    if (!fresh) return;

    if (!topUpEligibility.allowed) {
      showToast("error", topUpEligibility.reason || `Minimum top-up amount is ₹${MIN_WALLET_TOPUP_RUPEES}`);
      return;
    }

    const amountRupees = parseFloat(topUpAmount);

    setIsAddingFunds(true);
    try {
      const isLoaded = await loadRazorpay();
      if (!isLoaded) {
        throw new Error("Unable to connect to payment gateway. Please check your connection.");
      }

      const rawUuid =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID().replaceAll("-", "")
          : `${Date.now()}`;
      const idempotencyKey = `topup_${rawUuid}`.slice(0, 32);

      const orderData = (await apiClient.wallet.addFunds(
        Math.round(amountRupees * 100),
        idempotencyKey,
      )) as {
        data?: { amount: number; orderId: string };
        orderId?: string;
        amount?: number;
      };

      if (!orderData?.data?.orderId && !orderData?.orderId) {
        throw new Error("Failed to initialize payment order");
      }

      const resolvedOrderId = orderData.data?.orderId ?? orderData.orderId!;
      const resolvedAmount = orderData.data?.amount ?? orderData.amount!;

      const rzp = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "",
        amount: resolvedAmount,
        currency: "INR",
        name: "VyaparMedia Marketplace",
        description: "Wallet Balance Top-Up",
        order_id: resolvedOrderId,
        modal: {
          ondismiss: () => {
            setIsAddingFunds(false);
            showToast("info", "Payment window closed.");
          },
        },
        handler: async (paymentResponse: {
          razorpay_payment_id?: string;
          razorpay_order_id?: string;
          razorpay_signature?: string;
        }) => {
          try {
            const verifyData = (await apiClient.wallet.verifyPayment({
              razorpay_payment_id: paymentResponse.razorpay_payment_id,
              razorpay_order_id: paymentResponse.razorpay_order_id,
              razorpay_signature: paymentResponse.razorpay_signature,
            })) as { success?: boolean };
            if (verifyData.success) {
              showToast("success", `Successfully added ${formatCurrency(Math.round(amountRupees * 100))} to wallet.`);
              handleRefreshAll();
              setShowAddFundsModal(false);
              setTopUpAmount("");
            } else {
              showToast("error", "Payment verification pending. Balance will update shortly.");
              setShowAddFundsModal(false);
            }
          } catch (err) {
            showToast("error", formatUserError(err, "Payment confirmation pending. Balance will update shortly."));
            setShowAddFundsModal(false);
          } finally {
            setIsAddingFunds(false);
          }
        },
        prefill: {
          name: session?.user?.name || "",
          email: session?.user?.email || "",
        },
        theme: { color: "#2563eb" },
      });

      rzp.on("payment.failed", (response: { error?: { description?: string; reason?: string } }) => {
        setIsAddingFunds(false);
        const description = response?.error?.description || response?.error?.reason || "Payment declined or cancelled.";
        showToast("error", formatUserError(description, "Payment failed. Please try again or use another payment method."));
      });

      rzp.open();
    } catch (err: unknown) {
      setIsAddingFunds(false);
      showToast("error", formatUserError(err, "Unable to initiate top-up. Please try again."));
    }
  };

  const withdrawalEligibility = useMemo(() => {
    return checkWithdrawalEligibility({
      wallet: walletData ? { balance: walletData.balance, isFrozen: walletData.isFrozen } : undefined,
    });
  }, [walletData]);

  const escrowLockedAmount = isBrand ? (walletData?.totalHeld || 0) : (walletData?.pendingBalance || 0);
  const lifetimeTotal = isBrand ? (walletData?.totalDeposited || 0) : (walletData?.totalEarned || 0);
  const lifetimeOutflow = isBrand ? (walletData?.totalSpent || 0) : (walletData?.totalWithdrawn || 0);

  // CRED / Jupiter Escrow Utilization Metric
  const totalFundsPaise = (walletData?.balance || 0) + escrowLockedAmount;
  const escrowUtilizationPct = totalFundsPaise > 0 ? Math.round((escrowLockedAmount / totalFundsPaise) * 100) : 0;

  const handleQuickAdd = (increment: number) => {
    const current = Number(topUpAmount) || 0;
    setTopUpAmount(String(current + increment));
  };

  return (
    <DashboardShell user={session?.user || undefined}>
      <ToastContainer toasts={toasts} onClose={handleRemoveToast} />

      <PullToRefresh onRefresh={handleRefreshAll}>
        <PageContainer maxWidth="5xl" className="space-y-6 pb-20 animate-fade-in py-4 sm:py-6">

        {/* ── 1. HEADER & LIVE SYNC CHIP ──────────────────────────────────── */}
        <PageHeader
          title="Escrow Wallet"
          badge={
            isRealtimeActive ? (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-verified-muted text-verified border border-verified-border shrink-0 whitespace-nowrap"
                title="Live Supabase channel synchronizes wallet updates automatically"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-verified animate-pulse" />
                Live Sync
              </span>
            ) : undefined
          }
          subtitle={
            isBrand
              ? "Manage your campaign escrow deposits, invoice settlements, and GST treasury balance."
              : "Your verified earnings, milestone payouts, and instant IMPS bank transfers."
          }
          actions={
            <>
              <button
                type="button"
                onClick={() => setShowStatementModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-card border border-border text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-xs cursor-pointer min-h-[44px]"
              >
                <Download className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Statement</span>
              </button>

              <button
                type="button"
                onClick={handleRefreshAll}
                className="w-11 h-11 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shadow-xs cursor-pointer shrink-0"
                title="Refresh wallet balances and transactions"
                aria-label="Refresh wallet balances and transactions"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </>
          }
          border={false}
        />

        {/* ── 2. DUAL FINTECH BALANCE CARDS (CRED / JUPITER BENCHMARK) ─────── */}
        {isWalletLoading ? (
          <WalletHeroSkeleton />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
            {/* Card A: Available Funds Card (Instant Payout / Add Funds) */}
            <div className="relative rounded-2xl bg-card border border-border p-6 sm:p-7 shadow-xs overflow-hidden flex flex-col justify-between group hover:border-verified-border transition-all">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-verified">
                    <Zap className="w-3.5 h-3.5" />
                    {isBrand ? "Available Balance" : "Ready for Payout"}
                  </span>
                  <span className="text-[11px] font-semibold text-muted-foreground px-2 py-0.5 rounded-md bg-muted/60">
                    24x7 IMPS Active
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="text-3xl sm:text-4xl lg:text-5xl font-extrabold font-mono tabular-nums text-foreground tracking-tight">
                    {formatCurrency(walletData?.balance || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isBrand
                      ? "Unallocated funds ready to lock into new campaign milestone agreements."
                      : "Cleared funds available for immediate, zero-delay withdrawal to your bank."}
                  </p>
                </div>
              </div>

              <div className="pt-6">
                {isBrand ? (
                  <div className="space-y-1.5 w-full">
                    <Button
                      type="button"
                      variant="primary"
                      disabled={walletData?.isFrozen}
                      title={walletData?.isFrozen ? "Wallet is frozen. Top-ups are locked." : undefined}
                      onClick={() => {
                        setTopUpAmount("");
                        setShowAddFundsModal(true);
                      }}
                      className="w-full font-bold justify-center shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                      leftIcon={<Plus className="w-4 h-4" />}
                    >
                      Add Funds via UPI / Cards
                    </Button>
                    {walletData?.isFrozen && (
                      <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium inline-flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 flex-shrink-0" />
                        <span>Wallet is frozen. Top-ups are locked.</span>
                        <Link href="/dashboard/support" className="underline font-bold text-primary">
                          Contact Support →
                        </Link>
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5 w-full">
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => setShowWithdrawFlow(true)}
                      disabled={!withdrawalEligibility.allowed}
                      className="w-full font-bold justify-center shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
                      leftIcon={<ArrowUpRight className="w-4 h-4" />}
                    >
                      Instant Bank Transfer
                    </Button>
                    {!withdrawalEligibility.allowed && withdrawalEligibility.reason && (
                      <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-center justify-between gap-1.5 px-0.5">
                        <span className="inline-flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 flex-shrink-0" />
                          <span>{withdrawalEligibility.reason}</span>
                        </span>
                        {withdrawalEligibility.ctaText && withdrawalEligibility.ctaHref && (
                          <Link href={withdrawalEligibility.ctaHref} className="underline font-bold text-primary shrink-0">
                            {withdrawalEligibility.ctaText} →
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Card B: Escrow Safeguarded Funds Card (Collabr / CRED Benchmark) */}
            <div className="rounded-2xl bg-escrow-muted/40 border border-escrow-border p-6 sm:p-7 shadow-xs overflow-hidden flex flex-col justify-between group hover:border-escrow transition-all">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-escrow">
                    <Lock className="w-3.5 h-3.5" />
                    Safeguarded in Escrow
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-escrow px-2 py-0.5 rounded-md bg-escrow-muted border border-escrow-border">
                    <ShieldCheck className="w-3 h-3" />
                    RBI-Compliant
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="text-3xl sm:text-4xl lg:text-5xl font-extrabold font-mono tabular-nums text-foreground tracking-tight">
                    {formatCurrency(escrowLockedAmount)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isBrand
                      ? "Funds locked in ongoing creator campaign milestones awaiting deliverable signoff."
                      : "Pending deal milestones reserved in escrow. Auto-releases upon deliverable approval."}
                  </p>
                </div>

                {/* CRED / Jupiter Escrow Utilization Progress Track */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground font-medium">Escrow Allocation</span>
                    <span className="font-mono font-bold text-escrow tabular-nums">
                      {escrowUtilizationPct}% of total assets
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-escrow transition-all duration-500"
                      style={{ width: `${Math.min(100, escrowUtilizationPct)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <Link
                  href="/dashboard/deals?status=active"
                  className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl border border-escrow-border bg-card text-foreground hover:bg-muted text-sm font-semibold transition-all shadow-xs"
                >
                  <span>View Active Deals Pipeline</span>
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ── 3. FINANCIAL SUMMARY METRICS STRIP (JUPITER STATS) ───────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="p-4 rounded-xl bg-card border border-border shadow-xs flex flex-col justify-between space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
              <span>{isBrand ? "Lifetime Deposits" : "Lifetime Earnings"}</span>
              <TrendingUp className="w-3.5 h-3.5 text-verified" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-foreground">
              {formatCurrency(lifetimeTotal)}
            </div>
            <span className="text-[11px] text-muted-foreground">Cumulative gross platform volume</span>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border shadow-xs flex flex-col justify-between space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
              <span>{isBrand ? "Total Campaign Spend" : "Total Withdrawn"}</span>
              <ArrowDownLeft className="w-3.5 h-3.5 text-pending" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-foreground">
              {formatCurrency(lifetimeOutflow)}
            </div>
            <span className="text-[11px] text-muted-foreground">Disbursed to external bank accounts</span>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border shadow-xs flex flex-col justify-between space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
              <span>TDS &amp; Compliance</span>
              <FileText className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-foreground">
              100% Tax Compliant
            </div>
            <span className="text-[11px] text-muted-foreground">Automated Form 16A &amp; GST Invoicing</span>
          </div>
        </div>

        {/* ── 4. TRUST & SECURITY BANNER (PHONEPE / CRED STYLE) ───────────── */}
        <div className="p-3.5 rounded-xl bg-muted/40 border border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-card border border-border flex items-center justify-center text-primary shrink-0 shadow-2xs">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span>
              <strong>Bank-Grade Escrow Protection:</strong> Funds are legally sequestered in an RBI-compliant escrow account. Payouts execute via instant IMPS within 60 seconds.
            </span>
          </div>
          <span className="shrink-0 text-[11px] font-bold text-foreground bg-card border border-border px-2.5 py-1 rounded-md">
            256-Bit SSL Encrypted
          </span>
        </div>

        {/* ── 5. SEGMENTED TABS: TRANSACTIONS VS BANK ACCOUNTS ──────────────── */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-3 gap-2">
            <div className="flex items-center gap-2 bg-muted/60 p-1 rounded-xl border border-border/60 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setActiveTab("ledger")}
                className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer min-h-[44px] flex items-center justify-center ${
                  activeTab === "ledger"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>Audit Ledger</span>
                {transactions.length > 0 && (
                  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold shrink-0 whitespace-nowrap">
                    {transactions.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("accounts")}
                className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px] ${
                  activeTab === "accounts"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Bank Accounts &amp; KYC</span>
              </button>
            </div>

            {activeTab === "ledger" && (
              <span className="hidden sm:inline-block text-xs text-muted-foreground">
                Click any transaction to view receipt breakdown
              </span>
            )}
          </div>

          {/* ── Tab Content 1: Transaction Ledger ───────────────────────────── */}
          {activeTab === "ledger" && (
            <VirtualizedTransactionList
              transactions={transactions}
              isLoading={isTxLoading}
              onRefresh={handleRefreshAll}
              onSelectTransaction={(tx) => setSelectedTx(tx)}
            />
          )}

          {/* ── Tab Content 2: Bank Account Manager ─────────────────────────── */}
          {activeTab === "accounts" && (
            <div className="max-w-2xl">
              <BankAccountManager />
            </div>
          )}
        </div>
        </PageContainer>
      </PullToRefresh>


      {/* ── Full-Screen Withdraw Flow Modal ─────────────────────────────────── */}
      <FullScreenWithdrawFlow
        isOpen={showWithdrawFlow}
        onClose={() => setShowWithdrawFlow(false)}
        availableBalanceInPaise={walletData?.balance || 0}
        onSuccess={handleRefreshAll}
        userEmail={session?.user?.email}
        userName={session?.user?.name}
      />

      {/* ── Statement Export Modal ─────────────────────────────────────────── */}
      <StatementExportModal
        isOpen={showStatementModal}
        onClose={() => setShowStatementModal(false)}
        userType={userType}
        userName={session?.user?.name}
        userEmail={session?.user?.email}
        userId={session?.user?.id}
        currentBalance={walletData?.balance || 0}
      />

      {/* ── Interactive Transaction Receipt Modal ──────────────────────────── */}
      <TransactionReceiptModal
        transaction={selectedTx}
        isOpen={Boolean(selectedTx)}
        onClose={() => setSelectedTx(null)}
      />

      {/* ── Add Funds Modal (PhonePe / Jupiter Quick Amount Pattern) ─────────── */}
      <Modal
        open={showAddFundsModal}
        onClose={() => setShowAddFundsModal(false)}
        title="Add Funds to Escrow Wallet"
        maxWidth="480px"
      >
        <form onSubmit={handleAddFunds} className="space-y-4">
          <div>
            <label
              className="text-xs font-semibold text-foreground mb-1.5 block"
              htmlFor="add-funds-amount-input"
            >
              Top-Up Amount (INR)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-foreground text-sm">
                ₹
              </span>
              <Input
                id="add-funds-amount-input"
                name="amount"
                type="number"
                min="100"
                required
                placeholder="Enter amount (e.g. 10000)"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                className="pl-8 text-base font-mono font-bold"
                fullWidth
                autoFocus
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Minimum top-up is ₹{MIN_WALLET_TOPUP_RUPEES}. Funds are instantly available for escrow locking.
            </p>

            {/* PhonePe / Jupiter Quick Amount Chips */}
            <div className="flex items-center gap-2 pt-2.5 flex-wrap">
              {[1000, 5000, 10000, 25000, 50000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handleQuickAdd(amt)}
                  className="px-3 py-2 min-h-[44px] inline-flex items-center justify-center rounded-lg text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground border border-border transition-colors cursor-pointer"
                >
                  +{formatCurrency(amt * 100)}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground space-y-1.5">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-primary" />
              Supported Payment Methods:
            </span>
            <div className="flex items-center gap-2 pt-0.5 flex-wrap">
              <span className="px-2 py-0.5 rounded-md bg-card border border-border text-[11px] font-bold text-foreground">
                UPI (GPay, PhonePe, Paytm, CRED)
              </span>
              <span className="px-2 py-0.5 rounded-md bg-card border border-border text-[11px] font-bold text-foreground">
                NetBanking (50+ Banks)
              </span>
              <span className="px-2 py-0.5 rounded-md bg-card border border-border text-[11px] font-bold text-foreground">
                Cards &amp; NEFT
              </span>
            </div>
          </div>

          {!topUpEligibility.allowed && Boolean(topUpAmount) && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-medium">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{topUpEligibility.reason}</span>
              </div>
              {topUpEligibility.ctaText && topUpEligibility.ctaHref && (
                <Link
                  href={topUpEligibility.ctaHref}
                  className="font-bold underline text-primary text-xs whitespace-nowrap"
                >
                  {topUpEligibility.ctaText} →
                </Link>
              )}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              disabled={isAddingFunds}
              onClick={() => setShowAddFundsModal(false)}
              className="w-full sm:w-auto min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isAddingFunds || !topUpEligibility.allowed}
              title={!topUpEligibility.allowed ? topUpEligibility.reason : undefined}
              className="w-full sm:w-auto min-h-[44px] font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAddingFunds ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Connecting to Gateway...</span>
                </>
              ) : (
                `Proceed to Pay ${topUpAmount ? formatCurrency(Number(topUpAmount) * 100) : ""}`
              )}
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardShell>
  );
}
