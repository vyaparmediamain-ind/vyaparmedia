"use client";

import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { formatUserError } from "@/lib/user-messages";
import { logger } from "@/lib/logger-client";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { Button, Input } from "@/components/ui";
import { z } from "zod";
import { AlertTriangle, Trash2, AlertCircle } from "lucide-react";
import { checkAccountDeletionEligibility } from "@/lib/action-eligibility";

export const deleteAccountSchema = z.object({
  confirmText: z.literal("DELETE", {
    message: "Please type DELETE to confirm",
  }),
  password: z.string().min(1, "Password is required to delete your account"),
  reason: z.string().max(500, "Reason cannot exceed 500 characters").optional(),
});

interface DeleteAccountPanelProps {
  isSaving: boolean;
  setIsSaving: (val: boolean) => void;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}

export default function DeleteAccountPanel({
  isSaving,
  setIsSaving,
  showToast,
}: Readonly<DeleteAccountPanelProps>) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState("");

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const eligibility = checkAccountDeletionEligibility(
      undefined,
      undefined,
      confirmText,
      password
    );
    if (!eligibility.allowed) {
      setError(eligibility.reason || "Invalid input details.");
      return;
    }

    const validation = deleteAccountSchema.safeParse({
      confirmText,
      password,
      reason: reason || undefined,
    });

    if (!validation.success) {
      setError(validation.error.issues[0]?.message || "Invalid input details.");
      return;
    }

    setIsSaving(true);
    try {
      await apiClient.users.deleteAccount({ password, reason });
      showToast("Account deleted successfully. Logging you out...", "success");
      // Wait briefly for the toast to display then sign out and redirect to home
      setTimeout(() => {
        signOut({ callbackUrl: "/" });
      }, 1500);
    } catch (err: unknown) {
      logger.error("[delete-account] error:", err);
      setError(
        formatUserError(
          err,
          "Unable to delete account. Please verify your password and active deals before retrying."
        )
      );
      setIsSaving(false);
    }
  };

  return (
    <div className="p-5 sm:p-6 rounded-2xl border border-disputed-border/40 bg-disputed-muted/10 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-disputed-border/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-disputed-muted text-disputed flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-disputed">
              Danger Zone — Delete Account
            </h3>
            <p className="text-xs text-muted-foreground">
              Permanently delete your user account, creator profile, and session data
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-disputed bg-disputed-muted px-2.5 py-0.5 rounded-full border border-disputed-border">
          Irreversible Action
        </span>
      </div>

      <p className="text-xs text-foreground/80 leading-relaxed">
        Permanently delete your account. This action is irreversible. All your personal data will be anonymized in compliance with DPDP Act 2023. Financial transactions and escrow tax records will be retained for statutory audit compliance.
      </p>

      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="p-3.5 rounded-xl bg-disputed-muted text-disputed border border-disputed-border text-xs font-semibold flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          {error.includes("deal") && (
            <Link href="/dashboard/deals" className="underline font-bold text-primary whitespace-nowrap ml-2">
              Go to Deals →
            </Link>
          )}
          {(error.includes("wallet") || error.includes("balance")) && (
            <Link href="/dashboard/wallet" className="underline font-bold text-primary whitespace-nowrap ml-2">
              Withdraw Balance →
            </Link>
          )}
        </div>
      )}

      {!isConfirming ? (
        <div className="pt-1">
          <Button
            type="button"
            variant="danger"
            size="md"
            onClick={() => setIsConfirming(true)}
            className="text-xs font-bold flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete My Account
          </Button>
        </div>
      ) : (
        <form onSubmit={handleDelete} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Account Password"
              id="delete-password-input"
              type="password"
              placeholder="Enter your current password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isSaving}
              fullWidth
            />

            <Input
              label="Reason for Deletion (Optional)"
              id="delete-reason-input"
              type="text"
              placeholder="e.g. No longer active on this platform"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isSaving}
              fullWidth
            />
          </div>

          <div>
            <label className="text-xs font-bold text-foreground block mb-1.5" htmlFor="delete-confirm-input">
              Type <strong className="text-disputed font-mono">DELETE</strong> to confirm:
            </label>
            <Input
              id="delete-confirm-input"
              type="text"
              placeholder="Type DELETE"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              required
              disabled={isSaving}
              fullWidth
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => {
                setIsConfirming(false);
                setPassword("");
                setReason("");
                setConfirmText("");
                setError("");
              }}
              disabled={isSaving}
              className="text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="md"
              disabled={isSaving || !checkAccountDeletionEligibility(undefined, undefined, confirmText, password).allowed}
              title={!checkAccountDeletionEligibility(undefined, undefined, confirmText, password).allowed ? checkAccountDeletionEligibility(undefined, undefined, confirmText, password).reason : undefined}
              className="text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? "Deleting Account..." : "Permanently Delete Account"}
            </Button>
          </div>
          {!checkAccountDeletionEligibility(undefined, undefined, confirmText, password).allowed && (confirmText.length > 0 || password.length > 0) && (
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium pt-1">
              ⚠️ {checkAccountDeletionEligibility(undefined, undefined, confirmText, password).reason}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
