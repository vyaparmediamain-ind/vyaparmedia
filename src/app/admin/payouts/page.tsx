"use client";

import { FormEvent, useCallback, useMemo, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { formatCurrency, formatDateTime } from "@/lib/utils-client";
import { apiClient } from "@/lib/api-client";
import { formatUserError } from "@/lib/user-messages";
import EmptyState from "@/components/ui/EmptyState";
import { Badge, Button, Textarea, Modal, PageContainer, PageHeader } from "@/components/ui";
import { z } from "zod";
import {
  Banknote,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Building2,
} from "lucide-react";
import {
  type AdminWithdrawalItem as Withdrawal,
  type AdminPayoutsResponse as PayoutResponse,
} from "@/lib/schemas";

const payoutDecisionSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  note: z.string().max(250),
}).refine(data => data.action !== "REJECT" || data.note.trim().length >= 5, {
  message: "Rejection reason must be at least 5 characters.",
  path: ["note"],
});

type PayoutAction = "APPROVE" | "REJECT";

type ActionDraft = {
  withdrawal: Withdrawal;
  action: PayoutAction;
  note: string;
};

const filters = ["PENDING", "PROCESSING", "COMPLETED", "FAILED", "ALL"] as const;

function maskAccount(value?: string | null) {
  if (!value) return "****";
  const clean = value.replace(/\s+/g, "");
  if (clean.length <= 4) return "****";
  return `****${clean.slice(-4)}`;
}

function getUserName(user: Withdrawal["wallet"]["user"]) {
  if (user.influencerProfile) return user.influencerProfile.displayName;
  if (user.brandProfile) return user.brandProfile.companyName;
  return user.email;
}

function getStatusBadgeVariant(status: string): "success" | "danger" | "warning" | "ghost" {
  if (status === "COMPLETED") return "success";
  if (status === "FAILED") return "danger";
  if (status === "PENDING" || status === "PROCESSING" || status === "PENDING_REVIEW") return "warning";
  return "ghost";
}

export default function PayoutsAdminPage() {
  const [filter, setFilter] = useState<string>("PENDING");
  const [processing, setProcessing] = useState<string | null>(null);
  const [draft, setDraft] = useState<ActionDraft | null>(null);
  const [actionError, setActionError] = useState<string>("");

  const { data, isLoading: loading, error: fetchErr, mutate: fetchWithdrawals } = useSWR<PayoutResponse>(
    `/api/admin/payouts?status=${encodeURIComponent(filter)}&page=1&limit=50`,
    fetcher
  );

  const withdrawals = useMemo<Withdrawal[]>(
    () => data?.withdrawals ?? data?.data?.withdrawals ?? [],
    [data]
  );
  const total = data?.total ?? data?.data?.total ?? withdrawals.length;
  const error = fetchErr ? "Failed to load payouts. Please try again." : "";

  const totalAmount = useMemo(
    () => withdrawals.reduce((sum, item) => sum + item.amount, 0),
    [withdrawals]
  );

  const openAction = useCallback((withdrawal: Withdrawal, action: PayoutAction) => {
    setActionError("");
    setDraft({ withdrawal, action, note: "" });
  }, []);

  const handleAction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) return;

    const validation = payoutDecisionSchema.safeParse({
      action: draft.action,
      note: draft.note,
    });

    if (!validation.success) {
      setActionError(validation.error.issues[0]?.message || "Invalid inputs");
      return;
    }

    const note = draft.note.trim();
    setProcessing(draft.withdrawal.id);
    setActionError("");

    try {
      const body =
        draft.action === "APPROVE"
          ? { action: draft.action }
          : { action: draft.action, failureReason: note };

      await apiClient.users.adminPayoutAction(draft.withdrawal.id, body);
      setDraft(null);
      await fetchWithdrawals();
    } catch (err) {
      setActionError(formatUserError(err, "Failed to process payout. Please try again."));
    } finally {
      setProcessing(null);
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="p-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={`skeleton-payout-${i}`}
              className="flex items-center justify-between p-4 rounded-xl bg-muted/20 border border-border/40 animate-pulse"
            >
              <div className="space-y-2">
                <div className="h-4 w-40 bg-muted rounded" />
                <div className="h-3 w-28 bg-muted rounded" />
              </div>
              <div className="h-5 w-24 bg-muted rounded" />
              <div className="h-5 w-32 bg-muted rounded hidden sm:block" />
              <div className="h-8 w-20 bg-muted rounded" />
            </div>
          ))}
        </div>
      );
    }

    if (withdrawals.length === 0) {
      return (
        <div className="p-8">
          <EmptyState
            emoji="🏦"
            title="No Payouts in This Queue"
            description={
              filter === "PENDING"
                ? "There are no pending withdrawals waiting for manual review."
                : `No ${filter.toLowerCase()} payouts found in the ledger.`
            }
          />
        </div>
      );
    }

    return (
      <>
        {/* Mobile Card Layout (sm:hidden) */}
        <div className="space-y-3 sm:hidden p-3">
          {withdrawals.map((withdrawal) => {
            const user = withdrawal.wallet.user;
            const isActionable =
              withdrawal.status === "PENDING" ||
              withdrawal.status === "PENDING_REVIEW" ||
              withdrawal.status === "PROCESSING";

            return (
              <div
                key={withdrawal.id}
                className="p-4 rounded-xl bg-card border border-border shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-sm text-foreground">
                      {getUserName(user)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {user.email}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-[10px]">
                      <span className="font-bold uppercase tracking-wider text-primary">
                        {user.userType}
                      </span>
                      <span>&bull;</span>
                      {user.taxCompliance?.panLast4 ? (
                        <span className="text-verified font-medium">PAN ****{user.taxCompliance.panLast4}</span>
                      ) : (
                        <span className="text-disputed font-medium">PAN missing</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-foreground text-base block">
                      {formatCurrency(withdrawal.amount)}
                    </span>
                    <Badge variant={getStatusBadgeVariant(withdrawal.status)} className="mt-1 text-[10px]">
                      {withdrawal.status}
                    </Badge>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60 text-xs space-y-1">
                  <div className="font-bold text-foreground flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                    {withdrawal.bankAccountName || "Bank Account"}
                  </div>
                  <div className="text-muted-foreground font-mono text-[11px]">
                    A/c {maskAccount(withdrawal.bankAccountNumber)} &bull; IFSC: {withdrawal.ifscCode}
                  </div>
                  {withdrawal.upiId && (
                    <div className="text-primary font-mono text-[11px]">
                      UPI: {withdrawal.upiId}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                  <span>Requested: {formatDateTime(withdrawal.createdAt)}</span>
                  <span>Risk: <strong>{withdrawal.riskScore}</strong></span>
                </div>

                {isActionable && (
                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={processing === withdrawal.id}
                      onClick={() => openAction(withdrawal, "REJECT")}
                      className="flex-1 min-h-[44px] font-bold text-xs"
                    >
                      Reject
                    </Button>
                    <Button
                      type="button"
                      variant="success"
                      disabled={processing === withdrawal.id}
                      onClick={() => openAction(withdrawal, "APPROVE")}
                      className="flex-1 min-h-[44px] font-bold text-xs gap-1 shadow-sm"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {processing === withdrawal.id ? "Working..." : "Approve"}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Desktop Table (hidden sm:block) */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left border-collapse" aria-label="Payouts queue">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Recipient", "Amount", "Destination", "Risk Assessment", "Requested", "Actions"].map(
                  (heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className="px-5 py-3.5 text-xs font-bold text-muted-foreground uppercase tracking-wider"
                    >
                      {heading}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {withdrawals.map((withdrawal) => {
                const user = withdrawal.wallet.user;
                const isActionable =
                  withdrawal.status === "PENDING" ||
                  withdrawal.status === "PENDING_REVIEW" ||
                  withdrawal.status === "PROCESSING";

                return (
                  <tr
                    key={withdrawal.id}
                    className="hover:bg-muted/20 transition-colors group"
                  >
                    {/* Recipient */}
                    <td className="px-5 py-4">
                      <div className="font-bold text-sm text-foreground">
                        {getUserName(user)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {user.email}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                          {user.userType}
                        </span>
                        &bull;
                        <span className="text-[10px] font-semibold text-muted-foreground">
                          {user.taxCompliance?.panLast4 ? (
                            <span className="text-verified font-medium">PAN ****{user.taxCompliance.panLast4}</span>
                          ) : (
                            <span className="text-disputed font-medium">PAN missing</span>
                          )}
                        </span>
                      </div>
                    </td>

                    {/* Amount */}
                    <td className="px-5 py-4 font-black text-foreground text-base">
                      {formatCurrency(withdrawal.amount)}
                    </td>

                    {/* Destination */}
                    <td className="px-5 py-4 text-xs">
                      <div className="font-bold text-foreground flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                        {withdrawal.bankAccountName || "Bank Account"}
                      </div>
                      <div className="text-muted-foreground font-mono mt-0.5">
                        A/c {maskAccount(withdrawal.bankAccountNumber)}
                      </div>
                      <div className="text-muted-foreground font-mono">
                        IFSC: {withdrawal.ifscCode}
                      </div>
                      {withdrawal.upiId && (
                        <div className="text-primary font-mono mt-0.5">
                          UPI: {withdrawal.upiId}
                        </div>
                      )}
                    </td>

                    {/* Risk */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <Badge variant={getStatusBadgeVariant(withdrawal.status)}>
                          {withdrawal.status}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                        Risk Score: <strong>{withdrawal.riskScore}</strong>
                        {withdrawal.isManualReview && (
                          <span className="text-warning font-bold">(Manual)</span>
                        )}
                      </div>
                    </td>

                    {/* Requested */}
                    <td className="px-5 py-4 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(withdrawal.createdAt)}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      {isActionable ? (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={processing === withdrawal.id}
                            onClick={() => openAction(withdrawal, "REJECT")}
                            className="font-bold"
                          >
                            Reject
                          </Button>
                          <Button
                            type="button"
                            variant="success"
                            size="sm"
                            disabled={processing === withdrawal.id}
                            onClick={() => openAction(withdrawal, "APPROVE")}
                            className="font-bold gap-1 shadow-sm"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {processing === withdrawal.id ? "Working..." : "Approve"}
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground font-medium">
                          Settled
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  return (
    <PageContainer maxWidth="6xl" className="space-y-6 py-2 sm:py-4">
      {/* Header */}
      <PageHeader
        icon={
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Banknote className="w-5 h-5 text-primary" />
          </div>
        }
        title="Payout Operations"
        subtitle="Review withdrawal risk, bank details, and authorize Razorpay transfers."
        actions={
          <div className="px-4 py-2.5 rounded-xl bg-card border border-border shadow-sm flex items-center gap-3 shrink-0">
            <div className="w-2 h-2 rounded-full bg-verified animate-pulse" />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Current Queue
              </div>
              <div className="text-sm font-black text-foreground">
                {total} payouts &bull; {formatCurrency(totalAmount)}
              </div>
            </div>
          </div>
        }
      />

      {/* Filter Chips Bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap pb-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          {filters.map((status) => (
            <Button
              key={status}
              type="button"
              variant={filter === status ? "primary" : "secondary"}
              onClick={() => setFilter(status)}
              className="font-bold text-xs min-h-[44px] px-3.5 py-2"
            >
              {status}
            </Button>
          ))}
        </div>

        <Button
          type="button"
          variant="ghost"
          onClick={() => { fetchWithdrawals(); }}
          className="gap-1.5 font-bold text-xs min-h-[44px] px-3.5 py-2"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      {/* Error Card */}
      {error && (
        <div className="p-4 rounded-xl bg-disputed/10 border border-disputed-border text-disputed text-sm font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Table Card */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden shadow-sm">
        {renderContent()}
      </div>

      {/* Decision Modal Dialog */}
      {draft && (
        <Modal
          open={Boolean(draft)}
          onClose={() => setDraft(null)}
          title={
            draft.action === "APPROVE" ? (
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-verified" />
                Approve Payout
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-disputed" />
                Reject Payout
              </span>
            )
          }
          maxWidth="32rem"
        >
          <form className="space-y-4" onSubmit={handleAction}>
            <div>
              <p className="text-sm text-muted-foreground">
                {formatCurrency(draft.withdrawal.amount)} for{" "}
                <strong>{getUserName(draft.withdrawal.wallet.user)}</strong>
              </p>
            </div>

            {actionError && (
              <div className="p-3 rounded-lg bg-disputed/10 border border-disputed-border text-disputed text-xs font-bold">
                {actionError}
              </div>
            )}

            {draft.action === "REJECT" ? (
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground block" htmlFor="payout-note">
                  Rejection Reason (minimum 5 characters)
                </label>
                <Textarea
                  id="payout-note"
                  rows={4}
                  required
                  value={draft.note}
                  onChange={(event) =>
                    setDraft({ ...draft, note: event.target.value })
                  }
                  placeholder="Explain why this withdrawal is being rejected (e.g., PAN name mismatch, invalid IFSC code)..."
                  className="resize-y"
                  fullWidth
                />
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-verified/10 border border-verified-border text-xs leading-relaxed text-foreground">
                <span className="font-bold text-verified block mb-1">
                  Razorpay Auto-Payout Authorization
                </span>
                Authorizing this payout will trigger the Razorpay Transfers API to release{" "}
                <strong>{formatCurrency(draft.withdrawal.amount)}</strong> directly to the creator&apos;s verified bank account.
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-3 border-t border-border">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDraft(null)}
                disabled={processing === draft.withdrawal.id}
                className="w-full sm:w-auto min-h-[44px]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant={draft.action === "APPROVE" ? "success" : "danger"}
                disabled={processing === draft.withdrawal.id}
                className="w-full sm:w-auto min-h-[44px] font-bold shadow-sm"
              >
                {processing === draft.withdrawal.id
                  ? "Processing..."
                  : draft.action === "APPROVE"
                  ? "Confirm & Release Transfer"
                  : "Confirm Rejection"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </PageContainer>
  );
}
