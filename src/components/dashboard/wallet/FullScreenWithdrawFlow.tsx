"use client";

import React, { useState, useEffect, useMemo } from "react";
import { apiClient } from "@/lib/api-client";
import { formatUserError } from "@/lib/user-messages";
import {
  X,
  Building2,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Lock,
  RefreshCw,
  Clock,
  Plus,
  AlertCircle,
} from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { formatCurrency } from "@/lib/utils-client";
import {
  MIN_WITHDRAWAL_AMOUNT_PAISE,
  MAX_WITHDRAWAL_AMOUNT_PAISE,
} from "@/constants";
import { checkWithdrawalEligibility } from "@/lib/action-eligibility";
import { haptic } from "@/lib/haptics";


export interface SavedBankAccount {
  id: string;
  accountName: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  upiId?: string | null;
  isDefault?: boolean;
  isVerified?: boolean;
}

interface FullScreenWithdrawFlowProps {
  isOpen: boolean;
  onClose: () => void;
  availableBalanceInPaise: number;
  onSuccess?: (() => void) | (() => Promise<void>) | undefined;
  userEmail?: string | null | undefined;
  userName?: string | null | undefined;
}

type WithdrawStep = "amount" | "destination" | "confirm" | "success";

const MIN_WITHDRAWAL_PAISE = MIN_WITHDRAWAL_AMOUNT_PAISE; // ₹500 minimum
const MAX_WITHDRAWAL_PAISE = MAX_WITHDRAWAL_AMOUNT_PAISE; // ₹5,00,000 maximum

export function validateWithdrawalAmount(
  amountRupees: string,
  availableBalanceInPaise: number,
): { valid: boolean; error: string | null } {
  const sanitized = typeof amountRupees === "string" ? amountRupees.replace(/,/g, "").trim() : String(amountRupees || "");
  const parsedAmountRupees = parseFloat(sanitized) || 0;
  const parsedAmountPaise = Math.round(parsedAmountRupees * 100);

  if (!sanitized) {
    return { valid: false, error: null };
  }
  if (Number.isNaN(parsedAmountRupees) || parsedAmountRupees <= 0) {
    return { valid: false, error: "Please enter a valid positive amount." };
  }
  if (parsedAmountPaise < MIN_WITHDRAWAL_PAISE) {
    return {
      valid: false,
      error: `Minimum withdrawal amount is ${formatCurrency(MIN_WITHDRAWAL_PAISE)}.`,
    };
  }
  if (parsedAmountPaise > MAX_WITHDRAWAL_PAISE) {
    return {
      valid: false,
      error: `Maximum single withdrawal is ${formatCurrency(MAX_WITHDRAWAL_PAISE)}.`,
    };
  }
  if (parsedAmountPaise > availableBalanceInPaise) {
    return {
      valid: false,
      error: `Amount exceeds your available balance (${formatCurrency(availableBalanceInPaise)}).`,
    };
  }
  return { valid: true, error: null };
}

export function FullScreenWithdrawFlow({
  isOpen,
  onClose,
  availableBalanceInPaise,
  onSuccess,
  userName,
}: FullScreenWithdrawFlowProps) {
  const [step, setStep] = useState<WithdrawStep>("amount");
  const [amountRupees, setAmountRupees] = useState<string>("");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [accounts, setAccounts] = useState<SavedBankAccount[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [hasPanCompliance, setHasPanCompliance] = useState<boolean | null>(null);

  // Confirmation state
  const [userConfirmed, setUserConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [completedTxnId, setCompletedTxnId] = useState<string | null>(null);

  // Fetch verified bank accounts and tax compliance on open
  useEffect(() => {
    if (!isOpen) return;

    setStep("amount");
    setAmountRupees("");
    setUserConfirmed(false);
    setSubmitError(null);
    setCompletedTxnId(null);

    const fetchBankAccounts = async () => {
      setIsLoadingAccounts(true);

      try {
        const data = (await apiClient.wallet.listBankAccounts()) as {
          success?: boolean;
          data?: SavedBankAccount[];
        };
        if (data.success && Array.isArray(data.data)) {
          setAccounts(data.data);
          const defaultAcc =
            data.data.find((a: SavedBankAccount) => a.isDefault && a.isVerified) ||
            data.data.find((a: SavedBankAccount) => a.isVerified) ||
            data.data[0];
          if (defaultAcc) {
            setSelectedAccountId(defaultAcc.id);
          }
        }
      } catch {
        // Handled silently, empty state will show
      } finally {
        setIsLoadingAccounts(false);
      }
    };

    const fetchTaxCompliance = async () => {
      try {
        const complianceData = (await apiClient.settings.getIndiaTaxCompliance()) as {
          data?: { summary?: { panPresent?: boolean }; compliance?: { panLast4?: string } };
        };
        const panPresent = Boolean(
          complianceData?.data?.summary?.panPresent || complianceData?.data?.compliance?.panLast4
        );
        setHasPanCompliance(panPresent);
      } catch {
        setHasPanCompliance(null);
      }
    };

    fetchBankAccounts();
    fetchTaxCompliance();
  }, [isOpen]);

  const sanitizedAmount = typeof amountRupees === "string" ? amountRupees.replace(/,/g, "").trim() : String(amountRupees || "");
  const parsedAmountRupees = parseFloat(sanitizedAmount) || 0;
  const parsedAmountPaise = Math.round(parsedAmountRupees * 100);

  const amountValidation = useMemo(
    () => validateWithdrawalAmount(amountRupees, availableBalanceInPaise),
    [amountRupees, availableBalanceInPaise],
  );

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  const withdrawalEligibility = useMemo(() => {
    return checkWithdrawalEligibility({
      wallet: { balance: availableBalanceInPaise },
      bankAccount: selectedAccount,
      hasPanCompliance: hasPanCompliance !== null ? hasPanCompliance : undefined,
      amountPaise: parsedAmountPaise > 0 ? parsedAmountPaise : undefined,
      hasVerifiedBankAccount: accounts.length > 0 ? accounts.some((a) => a.isVerified) : undefined,
    });
  }, [availableBalanceInPaise, selectedAccount, hasPanCompliance, parsedAmountPaise, accounts]);

  const setQuickAmount = (paise: number) => {
    const capped = Math.min(paise, availableBalanceInPaise);
    setAmountRupees((capped / 100).toString());
  };

  const handleExecuteWithdrawal = async () => {
    if (!amountValidation.valid || !selectedAccount || !userConfirmed || !withdrawalEligibility.allowed) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const rawUuid =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID().replaceAll("-", "")
        : `${Date.now()}`;
    const idempotencyKey = `withdraw_key_${rawUuid}`.slice(0, 32);

    try {
      const data = (await apiClient.wallet.withdraw(
        { amount: parsedAmountPaise, bankAccountId: selectedAccount.id },
        { headers: { "Idempotency-Key": idempotencyKey } } as RequestInit,
      )) as { data?: { id?: string; withdrawalId?: string } };

      setCompletedTxnId(data.data?.id || data.data?.withdrawalId || idempotencyKey);
      haptic.success();
      setStep("success");
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      setSubmitError(
        formatUserError(
          err,
          "Unable to complete withdrawal. Please review your balance and details, then try again.",
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      maxWidth="42rem"
      className="p-0 overflow-hidden sm:max-w-2xl sm:max-h-[92vh] sm:rounded-2xl border-0 sm:border border-border bg-card shadow-2xl text-foreground"
      bodyClassName="p-0 flex flex-col overflow-hidden max-h-[92vh]"
    >
      <div className="relative w-full h-full sm:h-auto sm:max-h-[92vh] flex flex-col overflow-hidden text-foreground">
        {/* Header */}
        <header className="flex items-center justify-between px-4 sm:px-6 pt-[max(1rem,env(safe-area-inset-top,0px))] pb-4 border-b border-border bg-card/90 backdrop-blur-md sticky top-0 z-20 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))]">
          <div className="flex items-center gap-2">
            {step !== "amount" && step !== "success" && (
              <button
                type="button"
                onClick={() => setStep(step === "confirm" ? "destination" : "amount")}
                className="w-11 h-11 min-h-[44px] min-w-[44px] flex items-center justify-center -ml-2 text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted transition-colors cursor-pointer"
                aria-label="Previous step"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h2 className="text-base sm:text-lg font-heading font-bold text-foreground">
                {step === "success" ? "Withdrawal Initiated" : "Withdraw to Bank"}
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="w-3.5 h-3.5 text-verified" />
                <span>Available Balance:</span>
                <strong className="text-foreground font-mono tabular-nums">
                  {formatCurrency(availableBalanceInPaise)}
                </strong>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 min-h-[44px] min-w-[44px] flex items-center justify-center -mr-2 text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted transition-colors cursor-pointer"
            aria-label="Close withdrawal flow"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Step Progress Bar */}
        {step !== "success" && (
          <div className="flex items-center border-b border-border bg-muted/30 px-4 sm:px-6 py-2.5 text-xs">
            <div className="flex items-center justify-between w-full max-w-sm mx-auto">
              <span
                className={`flex items-center gap-1.5 font-semibold ${
                  step === "amount" ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    step === "amount"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted border border-border"
                  }`}
                >
                  1
                </span>
                Amount
              </span>

              <div className={`h-0.5 flex-1 mx-3 ${step !== "amount" ? "bg-primary" : "bg-border"}`} />

              <span
                className={`flex items-center gap-1.5 font-semibold ${
                  step === "destination" ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    step === "destination"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted border border-border"
                  }`}
                >
                  2
                </span>
                Account
              </span>

              <div className={`h-0.5 flex-1 mx-3 ${step === "confirm" ? "bg-primary" : "bg-border"}`} />

              <span
                className={`flex items-center gap-1.5 font-semibold ${
                  step === "confirm" ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    step === "confirm"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted border border-border"
                  }`}
                >
                  3
                </span>
                Confirm
              </span>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {hasPanCompliance === false && (
            <div className="mb-4 max-w-md mx-auto p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>PAN tax compliance is required before withdrawals can be processed.</span>
              </div>
              <a
                href="/dashboard/settings?tab=verification"
                className="font-bold underline text-primary shrink-0"
              >
                Add PAN →
              </a>
            </div>
          )}

          {/* STEP 1: AMOUNT SELECTION */}
          {step === "amount" && (

            <div className="space-y-6 max-w-md mx-auto py-2">
              <div className="text-center">
                <label
                  className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2"
                  htmlFor="withdraw-amount-input"
                >
                  Enter Withdrawal Amount
                </label>
                <div className="relative inline-block w-full">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground">
                    ₹
                  </span>
                  <input
                    id="withdraw-amount-input"
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={amountRupees}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9.,]/g, "");
                      setAmountRupees(val);
                    }}
                    className="w-full text-center text-3xl sm:text-4xl font-extrabold font-mono tabular-nums tracking-tight py-3 px-10 bg-muted/30 border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                    autoFocus
                  />
                </div>

                {amountValidation.error && (
                  <p className="text-xs text-disputed font-semibold mt-2 animate-in fade-in">
                    {amountValidation.error}
                  </p>
                )}
              </div>

              {/* Quick Select Buttons */}
              <div>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2 text-center">
                  Quick Select
                </span>
                <div className="flex flex-wrap gap-2 justify-center">
                  {[1000, 2500, 5000, 10000].map((amt) => {
                    const amtPaise = amt * 100;
                    const isAvailable = amtPaise <= availableBalanceInPaise;
                    return (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setQuickAmount(amtPaise)}
                        disabled={!isAvailable}
                        className={`px-3.5 py-2 min-h-[44px] inline-flex items-center justify-center rounded-xl border text-xs font-bold font-mono transition-all cursor-pointer ${
                          isAvailable
                            ? "border-border bg-muted/40 hover:bg-muted text-foreground"
                            : "border-border/40 opacity-40 cursor-not-allowed text-muted-foreground"
                        }`}
                      >
                        {formatCurrency(amtPaise)}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setQuickAmount(availableBalanceInPaise)}
                    disabled={availableBalanceInPaise < MIN_WITHDRAWAL_PAISE}
                    className="px-3.5 py-2 min-h-[44px] inline-flex items-center justify-center rounded-xl border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold font-mono transition-all cursor-pointer"
                  >
                    All Available
                  </button>
                </div>
              </div>

              {/* Guardrails Info */}
              <div className="p-4 rounded-xl bg-muted/30 border border-border text-xs space-y-1 text-muted-foreground">
                <div className="flex justify-between">
                  <span>Minimum withdrawal:</span>
                  <span className="font-mono text-foreground">{formatCurrency(MIN_WITHDRAWAL_PAISE)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Maximum per payout:</span>
                  <span className="font-mono text-foreground">{formatCurrency(MAX_WITHDRAWAL_PAISE)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Platform payout fee:</span>
                  <span className="font-semibold text-verified">₹0.00 (Zero Fee)</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: DESTINATION ACCOUNT */}
          {step === "destination" && (
            <div className="space-y-5 max-w-md mx-auto py-2">
              <div>
                <h3 className="font-heading font-bold text-base text-foreground">
                  Select Destination Account
                </h3>
                <p className="text-xs text-muted-foreground">
                  Payouts can only be routed to KYC-verified bank accounts in your name.
                </p>
              </div>

              {isLoadingAccounts ? (
                <div className="p-6 text-center text-xs text-muted-foreground space-y-2">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-primary" />
                  <p>Loading verified bank accounts...</p>
                </div>
              ) : accounts.length === 0 ? (
                <div className="p-6 border border-dashed border-border rounded-xl text-center space-y-3">
                  <Building2 className="w-8 h-8 text-muted-foreground mx-auto" />
                  <div className="text-xs">
                    <strong className="block text-foreground mb-1">No Verified Bank Accounts</strong>
                    <p className="text-muted-foreground">
                      You must add and verify a bank account via penny-drop before withdrawing.
                    </p>
                  </div>
                  <a
                    href="/dashboard/wallet?tab=bank-accounts"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
                  >
                    <Plus className="w-4 h-4" /> Add Bank Account
                  </a>
                </div>
              ) : (
                <div className="space-y-3">
                  {!accounts.some((a) => a.isVerified) && (
                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>All linked bank accounts are pending penny-drop verification.</span>
                      </div>
                      <a
                        href="/dashboard/wallet?tab=bank-accounts"
                        className="font-bold underline text-primary shrink-0"
                      >
                        Verify Accounts →
                      </a>
                    </div>
                  )}
                  {accounts.map((acc) => {

                    const isSelected = selectedAccountId === acc.id;
                    const isVerified = acc.isVerified;

                    return (
                      <label
                        key={acc.id}
                        className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                          !isVerified
                            ? "opacity-50 cursor-not-allowed border-border bg-muted/10"
                            : isSelected
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border bg-card hover:border-border/80"
                        }`}
                      >
                        <input
                          type="radio"
                          name="destination-account"
                          value={acc.id}
                          checked={isSelected}
                          disabled={!isVerified}
                          onChange={() => setSelectedAccountId(acc.id)}
                          className="mt-1 accent-primary"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-foreground">
                              {acc.bankName || "Bank Account"}
                            </span>
                            {isVerified ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-verified bg-verified-muted px-2 py-0.5 rounded-full border border-verified-border">
                                <CheckCircle2 className="w-3 h-3" /> Verified
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-pending bg-pending-muted px-2 py-0.5 rounded-full border border-pending-border">
                                Verification Pending
                              </span>
                            )}
                          </div>

                          <div className="mt-1 font-mono text-xs text-foreground">
                            {acc.accountNumber}
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                            <span>Beneficiary: {acc.accountName || userName}</span>
                            <span>•</span>
                            <span>IFSC: {acc.ifscCode}</span>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}

              {/* Security Banner */}
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  All payouts are processed via RazorpayX directly to your bank account using IMPS. Account details are encrypted with AES-256.
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: EXPLICIT CONFIRMATION WITH TDS BREAKDOWN */}
          {step === "confirm" && selectedAccount && (
            <div className="space-y-5 max-w-md mx-auto py-2">
              <div className="text-center">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Total Payout to Bank
                </span>
                <div className="text-3xl sm:text-4xl font-extrabold font-mono text-verified tabular-nums">
                  {formatCurrency(parsedAmountPaise)}
                </div>
              </div>

              {/* Payout Breakdown Table */}
              <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2.5 text-xs">
                <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Payout Breakdown
                </h4>

                <div className="flex justify-between py-1 border-b border-border">
                  <span className="text-muted-foreground">Gross Withdrawal:</span>
                  <span className="font-mono text-foreground font-semibold">
                    {formatCurrency(parsedAmountPaise)}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-border">
                  <span className="text-muted-foreground">Platform Transfer Fee:</span>
                  <span className="font-semibold text-verified">
                    ₹0.00 (Zero Fee)
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-border">
                  <span className="text-muted-foreground">TDS Section 194-O / 194-S:</span>
                  <span className="font-mono text-muted-foreground">₹0.00 (PAN Verified)</span>
                </div>

                <div className="flex justify-between py-1 font-bold text-sm text-foreground pt-1">
                  <span>Net Credited to Bank:</span>
                  <span className="font-mono text-verified">
                    {formatCurrency(parsedAmountPaise)}
                  </span>
                </div>
              </div>

              {/* Destination Summary */}
              <div className="p-4 rounded-xl bg-card border border-border space-y-1.5 text-xs shadow-sm">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Receiving Bank Account
                </span>
                <div className="font-bold text-foreground text-sm flex items-center justify-between">
                  <span>{selectedAccount.bankName}</span>
                  <span className="font-mono text-xs">{selectedAccount.accountNumber}</span>
                </div>
                <div className="text-muted-foreground text-[11px]">
                  Beneficiary: {selectedAccount.accountName || userName} • IFSC: {selectedAccount.ifscCode}
                </div>
                <div className="text-[11px] text-verified flex items-center gap-1 pt-1 font-medium">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Transfer Mode: Instant IMPS (typically 2–4 hours)</span>
                </div>
              </div>

              {/* Mandatory Confirmation Checkbox */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-primary/30 bg-primary/5 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={userConfirmed}
                  onChange={(e) => setUserConfirmed(e.target.checked)}
                  className="mt-0.5 accent-primary h-4 w-4 rounded"
                />
                <span className="text-foreground leading-relaxed">
                  I confirm that the bank details above belong to me and authorize the immediate deduction of{" "}
                  <strong>{formatCurrency(parsedAmountPaise)}</strong> from my available wallet balance.
                </span>
              </label>

              {!withdrawalEligibility.allowed && withdrawalEligibility.reason && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{withdrawalEligibility.reason}</span>
                  </div>
                  {withdrawalEligibility.ctaText && withdrawalEligibility.ctaHref && (
                    <a
                      href={withdrawalEligibility.ctaHref}
                      className="font-bold underline text-primary shrink-0"
                    >
                      {withdrawalEligibility.ctaText} →
                    </a>
                  )}
                </div>
              )}

              {submitError && (
                <div className="p-3 rounded-xl bg-disputed-muted border border-disputed-border text-disputed text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: SUCCESS SCREEN */}
          {step === "success" && (
            <div className="py-8 px-4 text-center max-w-md mx-auto space-y-6 animate-in zoom-in-95 duration-300">
              <div className="w-16 h-16 rounded-full bg-verified-muted border border-verified-border flex items-center justify-center mx-auto text-verified">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h3 className="text-xl font-heading font-bold text-foreground">
                  Payout Request Initiated!
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Your withdrawal of{" "}
                  <strong className="text-foreground font-mono">
                    {formatCurrency(parsedAmountPaise)}
                  </strong>{" "}
                  has been submitted for processing.
                </p>
                {completedTxnId && (
                  <p className="text-[11px] font-mono text-muted-foreground mt-1">
                    Ref ID: {completedTxnId}
                  </p>
                )}
              </div>

              {/* SLA Timeline */}
              <div className="text-left bg-muted/40 border border-border rounded-xl p-4 space-y-3.5 text-xs">
                <h4 className="font-bold uppercase tracking-wider text-muted-foreground text-[11px]">
                  Payout Progress
                </h4>

                <div className="space-y-3">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-verified text-primary-foreground font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      ✓
                    </span>
                    <div>
                      <strong className="block text-foreground">Wallet Debited</strong>
                      <span className="text-muted-foreground text-[11px]">
                        Funds held in payout queue via RazorpayX.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      2
                    </span>
                    <div>
                      <strong className="block text-foreground">IMPS Bank Dispatch</strong>
                      <span className="text-muted-foreground text-[11px]">
                        Bank server confirms transfer. Usually resolves within 2–4 hours.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-muted text-muted-foreground font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5 border border-border">
                      3
                    </span>
                    <div>
                      <strong className="block text-muted-foreground">Account Credit</strong>
                      <span className="text-muted-foreground text-[11px]">
                        Deposit reflects in {selectedAccount?.bankName || "your bank account"}.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <Button
                variant="primary"
                onClick={onClose}
                fullWidth
                className="font-bold py-2.5"
              >
                Back to Wallet
              </Button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {step !== "success" && (
          <footer className="flex items-center justify-between px-4 sm:px-6 pt-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom,0px))] border-t border-border bg-card/90 backdrop-blur-md sticky bottom-0 z-20 gap-3 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))]">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-[44px] px-4"
            >
              Cancel
            </Button>

            {step === "amount" && (
              <Button
                type="button"
                variant="primary"
                disabled={!amountValidation.valid}
                onClick={() => setStep("destination")}
                className="gap-1 font-bold min-h-[44px] px-5"
              >
                <span>Select Bank</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}

            {step === "destination" && (
              <Button
                type="button"
                variant="primary"
                disabled={!selectedAccount || !selectedAccount.isVerified}
                title={!selectedAccount ? "Select an account" : !selectedAccount.isVerified ? "Selected account is not verified" : undefined}
                onClick={() => setStep("confirm")}
                className="gap-1 font-bold min-h-[44px] px-5 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span>Review &amp; Confirm</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}

            {step === "confirm" && (
              <Button
                type="button"
                variant="primary"
                disabled={!userConfirmed || isSubmitting || !withdrawalEligibility.allowed}
                title={!withdrawalEligibility.allowed ? withdrawalEligibility.reason : undefined}
                onClick={handleExecuteWithdrawal}
                className="gap-1.5 font-bold min-h-[44px] px-5 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processing Payout...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Authorize &amp; Withdraw</span>
                  </>
                )}
              </Button>
            )}
          </footer>
        )}
      </div>
    </Modal>
  );
}
