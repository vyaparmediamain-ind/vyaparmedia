"use client";

import React, { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import EmptyState from "@/components/ui/EmptyState";
import { logger } from "@/lib/logger-client";
import { Button, Input, Skeleton } from "@/components/ui";
import { apiClient } from "@/lib/api-client";
import { formatUserError, USER_SUCCESS_MESSAGES } from "@/lib/user-messages";
import { checkBankAccountDeleteEligibility } from "@/lib/action-eligibility";
import {
  Plus,
  ShieldCheck,
  Trash2,
  Building2,
  Smartphone,
  Star,
  CheckCircle2,
  Copy,
  Landmark,
  AlertCircle,
  Clock,
  RefreshCw,
} from "lucide-react";
import { copyToClipboard } from "@/lib/clipboard";
import {
  bankAccountInputSchema as bankAccountSchema,
  type BankAccountItem as BankAccount,
  type BankAccountsResponse,
} from "@/lib/schemas";

export { bankAccountSchema };

function getDisplayAccountNumber(isUpi: boolean, upiId?: string | null, accountNumber?: string | null): string {
  if (isUpi) {
    return upiId || "";
  }
  if (accountNumber?.startsWith("•")) {
    return accountNumber;
  }
  const digits = accountNumber?.replace(/\D/g, "") || "";
  const last4 = digits.length >= 4 ? digits.slice(-4) : accountNumber?.slice(-4) || "••••";
  return `••••  ••••  ${last4}`;
}

export default function BankAccountManager({
  onSelectAccount,
}: Readonly<{
  onSelectAccount?: (account: BankAccount) => void;
}>) {
  const [showForm, setShowForm] = useState(false);
  const [payoutType, setPayoutType] = useState<"bank" | "upi">("bank");
  const [newAccount, setNewAccount] = useState({
    accountName: "",
    accountNumber: "",
    confirmAccountNumber: "",
    ifscCode: "",
    bankName: "",
    upiId: "",
    isDefault: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);


  const {
    data,
    isLoading: loading,
    mutate: fetchAccounts,
  } = useSWR<BankAccountsResponse>("/api/wallet/bank-accounts", fetcher);

  const accounts: BankAccount[] = data?.accounts || [];

  const showNotice = (message: string, type: "success" | "error" = "success") => {
    setNotice({ type, message });
    setTimeout(() => setNotice(null), 4000);
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();

    if (payoutType === "bank" && newAccount.accountNumber !== newAccount.confirmAccountNumber) {
      showNotice("Account numbers do not match. Please verify and retype.", "error");
      return;
    }

    setIsSaving(true);

    const validation = bankAccountSchema.safeParse({
      payoutType,
      accountName: newAccount.accountName.trim(),
      accountNumber: newAccount.accountNumber.trim(),
      ifscCode: newAccount.ifscCode.trim().toUpperCase(),
      bankName: newAccount.bankName.trim(),
      upiId: newAccount.upiId.trim(),
    });

    if (!validation.success) {
      setIsSaving(false);
      showNotice(validation.error.issues[0]?.message || "Invalid bank account details", "error");
      return;
    }

    try {
      const payload =
        payoutType === "upi"
          ? {
              payoutType: "upi" as const,
              accountName: newAccount.accountName.trim(),
              upiId: newAccount.upiId.trim(),
              isDefault: newAccount.isDefault,
            }
          : {
              payoutType: "bank" as const,
              accountName: newAccount.accountName.trim(),
              accountNumber: newAccount.accountNumber.trim(),
              ifscCode: newAccount.ifscCode.trim().toUpperCase(),
              bankName: newAccount.bankName.trim(),
              upiId: newAccount.upiId.trim() || undefined,
              isDefault: newAccount.isDefault,
            };

      const res = (await apiClient.wallet.addBankAccount(payload)) as {
        success?: boolean;
        error?: string;
      };

      if (res && res.success !== false) {
        fetchAccounts();
        setShowForm(false);
        setPayoutType("bank");
        setNewAccount({
          accountName: "",
          accountNumber: "",
          confirmAccountNumber: "",
          ifscCode: "",
          bankName: "",
          upiId: "",
          isDefault: false,
        });
        showNotice(USER_SUCCESS_MESSAGES.BANK_ACCOUNT_SAVED);
      } else {
        showNotice(res?.error || "Failed to add account", "error");
      }
    } catch (error) {
      logger.error("[bank-account] Failed to add account:", error);
      showNotice(
        formatUserError(error, "Failed to add bank account. Please verify details and try again."),
        "error"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await apiClient.wallet.setDefaultAccount(id);
      fetchAccounts();
      showNotice("Default payout destination updated.");
    } catch (err) {
      showNotice(
        formatUserError(err, "Failed to set default bank account. Please try again."),
        "error"
      );
    }
  };

  const handleVerifyAccount = async (id: string) => {
    setVerifyingId(id);
    try {
      const res = (await apiClient.wallet.verifyBankAccount(id)) as {
        success?: boolean;
        alreadyVerified?: boolean;
        message?: string;
        error?: string;
      };
      if (res && res.success !== false) {
        showNotice(res.message || "Bank account verified successfully via penny-drop.");
        fetchAccounts();
      } else {
        showNotice(res?.error || "Failed to verify bank account.", "error");
      }
    } catch (err) {
      showNotice(formatUserError(err, "Failed to initiate bank verification."), "error");
    } finally {
      setVerifyingId(null);
    }
  };


  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;
    const accountToDelete = accounts.find((a) => a.id === deleteConfirmId);
    const eligibility = checkBankAccountDeleteEligibility(accountToDelete);
    if (!eligibility.allowed) {
      showNotice(eligibility.reason || "Cannot delete this bank account.", "error");
      setDeleteConfirmId(null);
      return;
    }
    const id = deleteConfirmId;
    setDeleteConfirmId(null);
    try {
      await apiClient.wallet.deleteBankAccount(id);
      fetchAccounts();
      showNotice(USER_SUCCESS_MESSAGES.BANK_ACCOUNT_DELETED);
    } catch (error) {
      logger.error("[bank-account] Failed to delete account:", error);
      showNotice(
        formatUserError(error, "Failed to delete bank account. Please try again."),
        "error"
      );
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="p-5 sm:p-6 rounded-2xl border border-border bg-card shadow-xs space-y-4">
          <div className="flex justify-between items-center">
            <Skeleton className="h-6 w-48 rounded-lg" />
            <Skeleton className="h-9 w-32 rounded-xl" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
        <div className="p-5 sm:p-6 rounded-2xl border border-border bg-card shadow-xs space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* 1. Overview Status Card (matching KYC TierStatusCardComponent) */}
      <div className="p-5 sm:p-6 rounded-2xl border border-border bg-card shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Payout Destinations &amp; Settlement Rails
            </span>
            <div className="flex items-center gap-3 mt-1.5">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Landmark className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-foreground tracking-tight">
                  Bank Accounts &amp; UPI VPAs
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Manage your verified beneficiary accounts for instant IMPS and UPI escrow disbursements.
                </p>
              </div>
            </div>
          </div>

          <div className="sm:text-right p-3 sm:p-0 rounded-xl bg-muted/30 sm:bg-transparent border sm:border-0 border-border">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Configured Payouts
            </span>
            <div className="text-2xl font-extrabold text-foreground tabular-nums tracking-tight mt-0.5">
              {accounts.length} {accounts.length === 1 ? "Account" : "Accounts"}
            </div>
            <span className="text-[11px] text-muted-foreground">Automated Escrow Settlements</span>
          </div>
        </div>

        {/* NPCI / Security Bar */}
        <div className="pt-2 border-t border-border">
          <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-verified" /> NPCI IMPS &amp; UPI 2.0 Settlement Rails
            </span>
            <span className="text-foreground font-bold tabular-nums">
              256-bit Bank Grade Encrypted
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="bg-verified h-full rounded-full transition-all duration-300"
              style={{ width: accounts.length > 0 ? "100%" : "30%" }}
            />
          </div>
        </div>
      </div>

      {/* 2. Instant Settlement Highlight Banner (matching KYC DigiLockerCardComponent) */}
      <div className="p-5 sm:p-6 rounded-2xl border border-verified-border bg-verified-muted/10 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-verified-muted text-verified flex items-center justify-center font-bold text-xl border border-verified-border">
              🇮🇳
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground">
                  Instant Payouts via NPCI IMPS &amp; UPI
                </h3>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-verified-muted text-verified border border-verified-border">
                  <ShieldCheck className="w-3 h-3" /> NPCI Certified
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Direct-to-bank settlement protocol for creator earnings</p>
            </div>
          </div>

          <p className="text-xs text-foreground/80 leading-relaxed max-w-2xl">
            When escrow milestones are released by brands, funds are dispatched directly to your primary bank account or UPI ID in under 60 seconds.
          </p>

          <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1">
            <span className="flex items-center gap-1 text-verified font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> Zero Settlement Delay
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Name-Match Verification Active
            </span>
          </div>
        </div>

        <Button
          variant={showForm ? "secondary" : "primary"}
          size="md"
          aria-label={showForm ? "Cancel adding account" : "Add new bank account or UPI ID"}
          onClick={() => setShowForm(!showForm)}
          className="self-start md:self-center font-bold text-xs shrink-0 shadow-sm flex items-center gap-2 px-5 py-2.5"
        >
          {showForm ? "Cancel" : <><Plus className="w-3.5 h-3.5" /> Add Payout Method</>}
        </Button>
      </div>

      {/* Notice Message */}
      {notice && (
        <div
          role="status"
          className={`text-xs font-semibold rounded-xl px-4 py-3 border flex items-center gap-2 transition-all ${
            notice.type === "success"
              ? "bg-verified-muted text-verified border-verified-border"
              : "bg-disputed-muted text-disputed border-disputed-border"
          }`}
        >
          {notice.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{notice.message}</span>
        </div>
      )}

      {/* Delete Confirmation Alert Modal/Box */}
      {deleteConfirmId && (() => {
        const accountToDelete = accounts.find((a) => a.id === deleteConfirmId);
        const deleteEligibility = checkBankAccountDeleteEligibility(accountToDelete);

        return (
          <div className="rounded-2xl p-5 bg-disputed-muted/60 border border-disputed-border space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-disputed shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-disputed">Confirm Removal of Beneficiary Account</h4>
                <p className="text-xs text-foreground/80 mt-0.5">
                  Are you sure you want to remove this account? Ongoing and future milestone payouts cannot be routed to it.
                </p>
              </div>
            </div>
            {!deleteEligibility.allowed && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5 font-medium">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{deleteEligibility.reason}</span>
              </div>
            )}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
              <Button
                variant="danger"
                size="sm"
                disabled={!deleteEligibility.allowed}
                title={deleteEligibility.reason}
                onClick={handleDeleteConfirm}
                className="text-xs font-bold min-h-[44px] px-4 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Yes, Delete Account
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setDeleteConfirmId(null)} className="text-xs min-h-[44px] px-4 flex items-center justify-center">
                Cancel
              </Button>
            </div>
          </div>
        );
      })()}

      {/* Add Account Form Card */}
      {showForm && (
        <div className="p-5 sm:p-6 rounded-2xl border border-border bg-card shadow-xs space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-foreground">
                  Add Payout Beneficiary
                </h3>
                <p className="text-xs text-muted-foreground">
                  Enter bank credentials matching your government ID / PAN card name
                </p>
              </div>
            </div>

            {/* Payout Method Toggle */}
            <div className="flex items-center bg-muted/50 p-1 rounded-xl border border-border w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setPayoutType("bank")}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all min-h-[44px] cursor-pointer ${
                  payoutType === "bank"
                    ? "bg-card text-foreground shadow-xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Building2 className="w-3.5 h-3.5" /> Bank Account
              </button>
              <button
                type="button"
                onClick={() => setPayoutType("upi")}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all min-h-[44px] cursor-pointer ${
                  payoutType === "upi"
                    ? "bg-card text-foreground shadow-xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" /> UPI ID
              </button>
            </div>
          </div>

          <form onSubmit={handleAddAccount} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                id="beneficiary-account-name"
                label="Beneficiary Full Name (as on PAN/Bank Record)"
                placeholder="e.g. Rahul Sharma"
                value={newAccount.accountName}
                onChange={(e) => setNewAccount((prev) => ({ ...prev, accountName: e.target.value }))}
                required
              />

              {payoutType === "bank" ? (
                <>
                  <Input
                    id="beneficiary-bank-name"
                    label="Bank Name"
                    placeholder="e.g. HDFC Bank, State Bank of India"
                    value={newAccount.bankName}
                    onChange={(e) => setNewAccount((prev) => ({ ...prev, bankName: e.target.value }))}
                    required
                  />
                  <Input
                    id="beneficiary-account-number"
                    label="Account Number"
                    type="password"
                    placeholder="Enter full bank account number"
                    value={newAccount.accountNumber}
                    onChange={(e) => setNewAccount((prev) => ({ ...prev, accountNumber: e.target.value }))}
                    required
                  />
                  <Input
                    id="beneficiary-confirm-account-number"
                    label="Confirm Account Number"
                    placeholder="Re-enter account number"
                    value={newAccount.confirmAccountNumber}
                    onChange={(e) => setNewAccount((prev) => ({ ...prev, confirmAccountNumber: e.target.value }))}
                    required
                  />
                  <div className="sm:col-span-2">
                    <Input
                      id="beneficiary-ifsc-code"
                      label="IFSC Code"
                      placeholder="e.g. HDFC0001234"
                      value={newAccount.ifscCode}
                      onChange={(e) => setNewAccount((prev) => ({ ...prev, ifscCode: e.target.value.toUpperCase() }))}
                      maxLength={11}
                      required
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      11-character Indian Financial System Code printed on your chequebook or passbook.
                    </p>
                  </div>
                </>
              ) : (
                <div className="sm:col-span-2">
                  <Input
                    id="beneficiary-upi-id"
                    label="Virtual Payment Address (UPI VPA)"
                    placeholder="e.g. yourname@oksbi, phone@paytm"
                    value={newAccount.upiId}
                    onChange={(e) => setNewAccount((prev) => ({ ...prev, upiId: e.target.value }))}
                    required
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Standard UPI handles supported (Google Pay, PhonePe, Paytm, BHIM, Bank VPAs).
                  </p>
                </div>
              )}
            </div>

            <div className="p-3.5 rounded-xl bg-muted/30 border border-border flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-foreground">Set as Primary Payout Destination</span>
                <p className="text-[11px] text-muted-foreground">All escrow releases will automatically be disbursed here</p>
              </div>
              <input
                type="checkbox"
                id="is-default-account"
                checked={newAccount.isDefault}
                onChange={(e) => setNewAccount((prev) => ({ ...prev, isDefault: e.target.checked }))}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setShowForm(false)}
                className="text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={isSaving}
                aria-busy={isSaving}
                className="text-xs font-bold px-5"
              >
                {isSaving ? "Verifying & Saving..." : "Save Beneficiary"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* 3. Beneficiaries Roster Card (matching KYC TierCardComponent) */}
      <div className="p-5 sm:p-6 rounded-2xl border border-border bg-card shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-foreground">
                  Active Beneficiaries
                </h3>
                <span className="text-xs font-normal text-muted-foreground">
                  ({accounts.length} linked)
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Verified Indian bank accounts and UPI addresses for escrow release
              </p>
            </div>
          </div>

          <div>
            {accounts.length > 0 ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-verified bg-verified-muted px-2.5 py-1 rounded-full border border-verified-border">
                <CheckCircle2 className="w-3.5 h-3.5" /> Payout Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-pending bg-pending-muted px-2.5 py-1 rounded-full border border-pending-border">
                <AlertCircle className="w-3.5 h-3.5" /> Action Required
              </span>
            )}
          </div>
        </div>

        {/* Accounts List */}
        {accounts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {accounts.map((acc) => {
              const isUpi = Boolean(acc.upiId && (!acc.accountNumber || acc.accountNumber.trim() === ""));
              const displayNum = getDisplayAccountNumber(isUpi, acc.upiId, acc.accountNumber);

              return (
                <div
                  key={acc.id}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                    acc.isDefault
                      ? "border-primary/40 bg-primary/[0.03] shadow-xs"
                      : "border-border bg-card hover:border-border/80"
                  }`}
                >
                  <div>
                    {/* Top Bar: Icon, Name, and Badges */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
                          {isUpi ? <Smartphone className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-foreground truncate">
                            {isUpi ? "UPI Payment Address" : acc.bankName || "Indian Bank Account"}
                          </h4>
                          <p className="text-xs text-muted-foreground truncate">{acc.accountName}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {acc.isDefault && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                            <Star className="w-3 h-3 fill-current" /> Primary
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Account / IFSC Details */}
                    <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-1.5 mb-4">
                      <div className="flex items-center justify-between text-xs font-mono font-bold text-foreground">
                        <span>{displayNum}</span>
                        <span className="text-[10px] font-sans font-semibold text-muted-foreground uppercase">
                          {isUpi ? "UPI VPA" : "IMPS/NEFT"}
                        </span>
                      </div>
                      {!isUpi && acc.ifscCode && (
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/60">
                          <span>IFSC: <strong className="font-mono text-foreground">{acc.ifscCode}</strong></span>
                          <button
                            type="button"
                            onClick={() => {
                              copyToClipboard(acc.ifscCode || "");
                              showNotice("IFSC code copied to clipboard!");
                            }}
                            className="hover:text-primary transition-colors inline-flex items-center gap-1 font-semibold p-1.5 min-h-[44px] cursor-pointer"
                          >
                            <Copy className="w-3 h-3" /> Copy
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer Controls: Status & Actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-border text-xs flex-wrap gap-2">
                    {acc.isVerified ? (
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-verified">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Verified Beneficiary</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-pending bg-pending-muted px-2 py-0.5 rounded-full border border-pending-border">
                          <Clock className="w-3 h-3" /> Verification Pending
                        </span>
                        <button
                          type="button"
                          disabled={verifyingId === acc.id}
                          onClick={() => handleVerifyAccount(acc.id)}
                          className="text-[11px] font-bold text-primary bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {verifyingId === acc.id ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              <span>Verifying...</span>
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="w-3 h-3" />
                              <span>Verify via Penny-Drop</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-1">
                      {onSelectAccount && (
                        <button
                          type="button"
                          onClick={() => onSelectAccount(acc)}
                          className="text-xs font-bold text-primary hover:underline px-2.5 py-1.5 min-h-[44px] inline-flex items-center cursor-pointer"
                        >
                          Select
                        </button>
                      )}
                      {!acc.isDefault && (
                        <button
                          type="button"
                          onClick={() => handleSetDefault(acc.id)}
                          className="text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 min-h-[44px] inline-flex items-center cursor-pointer"
                        >
                          Set Default
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={!checkBankAccountDeleteEligibility(acc).allowed}
                        onClick={() => {
                          const eligibility = checkBankAccountDeleteEligibility(acc);
                          if (!eligibility.allowed) {
                            showNotice(eligibility.reason || "Cannot delete this account", "error");
                            return;
                          }
                          setDeleteConfirmId(acc.id);
                        }}
                        title={!checkBankAccountDeleteEligibility(acc).allowed ? checkBankAccountDeleteEligibility(acc).reason : "Delete account"}
                        className="w-11 h-11 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors rounded-xl cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {!checkBankAccountDeleteEligibility(acc).allowed && (
                    <div className="mt-2 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2">
                      <span>{checkBankAccountDeleteEligibility(acc).reason}</span>
                      {checkBankAccountDeleteEligibility(acc).ctaText && checkBankAccountDeleteEligibility(acc).ctaHref && (
                        <Link
                          href={checkBankAccountDeleteEligibility(acc).ctaHref!}
                          className="font-bold underline text-primary hover:text-primary/80 whitespace-nowrap"
                        >
                          {checkBankAccountDeleteEligibility(acc).ctaText} →
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8">
            <EmptyState
              emoji=""
              title="No Payout Beneficiaries Added"
              description="Add a verified Indian bank account or UPI ID to receive escrow releases directly."
              compact
            />
          </div>
        )}
      </div>

      {/* Trust & RBI Compliance Footer */}
      <div className="p-4 rounded-2xl bg-muted/30 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-verified shrink-0" />
          <span>Beneficiary names are cross-verified with bank servers via NPCI IMPS standard protocols.</span>
        </div>
        <span className="font-semibold text-foreground">256-bit Bank-Grade Encryption</span>
      </div>
    </div>
  );
}
