"use client";

import { useState } from "react";
import Image from "next/image";
import useSWR from "swr";
import { apiClient } from "@/lib/api-client";
import { formatUserError } from "@/lib/user-messages";
import { fetcher } from "@/lib/fetcher";
import { Button, Input } from "@/components/ui";
import { copyToClipboard } from "@/lib/clipboard";
import { checkDisable2FAEligibility } from "@/lib/action-eligibility";
import {
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Copy,
  X,
} from "lucide-react";
import { type UserSettingsResponse as SettingsResponse } from "@/lib/schemas";

interface TwoFactorAuthPanelProps {
  isSaving: boolean;
  setIsSaving: (val: boolean) => void;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}

export default function TwoFactorAuthPanel({
  isSaving,
  setIsSaving,
  showToast,
}: Readonly<TwoFactorAuthPanelProps>) {
  const { data: settingsData, mutate: refreshSettings } =
    useSWR<SettingsResponse>("/api/settings", fetcher);
  const [override2FA, setOverride2FA] = useState<boolean | null>(null);
  const [qrCodeData, setQrCodeData] = useState<{
    secret: string;
    qrCodeUrl: string;
  } | null>(null);
  const [setupCode, setSetupCode] = useState("");
  const [is2FASetupVisible, setIs2FASetupVisible] = useState(false);
  const [disable2FAPassword, setDisable2FAPassword] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  const is2FAEnabled = override2FA ?? !!settingsData?.user?.isTwoFactorEnabled;

  const setIs2FAEnabled = (val: boolean) => {
    setOverride2FA(val);
    refreshSettings();
  };

  return (
    <div className="p-5 sm:p-6 rounded-2xl border border-border bg-card shadow-xs space-y-4">
      {/* Recovery Codes Banner */}
      {recoveryCodes.length > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-pending-muted/60 border border-pending-border space-y-3 animate-in fade-in duration-200">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-pending shrink-0" />
              <h3 className="text-sm font-bold text-foreground">
                Save Your Backup Recovery Codes
              </h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRecoveryCodes([])}
              className="text-xs font-semibold"
            >
              I have saved them ✓
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Store these emergency codes in a safe password manager. If you lose access to your authenticator app, each code can be used once to regain access.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs font-bold text-foreground">
            {recoveryCodes.map((code) => (
              <div
                key={code}
                className="p-2 rounded-lg bg-card border border-border text-center tracking-wider"
              >
                {code}
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                copyToClipboard(recoveryCodes.join("\n"));
                showToast("Recovery codes copied to clipboard!", "success");
              }}
              className="text-xs gap-1.5 font-semibold"
            >
              <Copy className="w-3.5 h-3.5" /> Copy All Codes
            </Button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-foreground">
              Two-Factor Authentication (2FA / TOTP)
            </h3>
            <p className="text-xs text-muted-foreground">
              Require a 6-digit verification code from Google Authenticator or Authy when signing in
            </p>
          </div>
        </div>

        <div>
          {is2FAEnabled ? (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-verified bg-verified-muted px-2.5 py-1 rounded-full border border-verified-border">
              <CheckCircle2 className="w-3.5 h-3.5" /> 2FA Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-pending bg-pending-muted px-2.5 py-1 rounded-full border border-pending-border">
              <AlertTriangle className="w-3.5 h-3.5" /> Recommended
            </span>
          )}
        </div>
      </div>

      {/* Body: Enable 2FA Button or Setup Flow */}
      {!is2FAEnabled && !is2FASetupVisible && (
        <div className="p-4 rounded-xl bg-muted/30 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-foreground block">
              Protect your account against credential theft
            </span>
            <span className="text-[11px] text-muted-foreground">
              Compatible with Google Authenticator, Microsoft Authenticator, 1Password, and Authy.
            </span>
          </div>

          <Button
            variant="primary"
            size="md"
            disabled={isSaving}
            onClick={async () => {
              setIsSaving(true);
              try {
                const data = (await apiClient.users.setup2fa()) as {
                  qrCodeUrl?: string;
                  secret?: string;
                  error?: string;
                };
                if (data.qrCodeUrl && data.secret) {
                  setQrCodeData({
                    qrCodeUrl: data.qrCodeUrl,
                    secret: data.secret,
                  });
                  setIs2FASetupVisible(true);
                } else {
                  showToast(data.error || "Failed to initiate 2FA setup", "error");
                }
              } catch (err: unknown) {
                showToast(
                  formatUserError(
                    err,
                    "Unable to initiate 2FA setup. Please try again."
                  ),
                  "error"
                );
              } finally {
                setIsSaving(false);
              }
            }}
            className="text-xs font-bold shrink-0 px-5"
          >
            Enable Two-Factor Authentication
          </Button>
        </div>
      )}

      {/* Setup Step Modal / Card */}
      {is2FASetupVisible && qrCodeData && !is2FAEnabled && (
        <div className="p-4 sm:p-5 bg-muted/40 rounded-2xl border border-border space-y-4 animate-in fade-in duration-200">
          <div className="flex justify-between items-center pb-2 border-b border-border">
            <h4 className="text-sm font-bold text-foreground">
              Set Up Authenticator App
            </h4>
            <button
              type="button"
              aria-label="Cancel 2FA setup"
              className="w-11 h-11 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              onClick={() => setIs2FASetupVisible(false)}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-center">
            {/* QR Code Container */}
            <div className="flex flex-col items-center p-4 rounded-xl bg-card border border-border">
              <span className="text-xs font-bold text-muted-foreground mb-3">
                1. Scan with Authenticator app
              </span>
              <div className="p-3 bg-card rounded-xl shadow-xs border border-border">
                <Image
                  src={qrCodeData.qrCodeUrl}
                  alt="2FA QR Code"
                  width={140}
                  height={140}
                  unoptimized
                />
              </div>
              <div className="mt-3 text-center">
                <span className="text-[11px] text-muted-foreground block mb-1">
                  Or enter key manually:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    copyToClipboard(qrCodeData.secret);
                    showToast("Secret key copied to clipboard!", "success");
                  }}
                  className="font-mono text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" /> {qrCodeData.secret}
                </button>
              </div>
            </div>

            {/* Verification Step */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-foreground block">
                2. Enter the 6-digit code from your app
              </span>
              <p className="text-xs text-muted-foreground">
                Enter the numerical token generated by your authenticator app to confirm configuration.
              </p>
              <div className="space-y-3">
                <Input
                  id="2fa-setup-code"
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  aria-label="6-digit authenticator code"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  value={setupCode}
                  onChange={(e) =>
                    setSetupCode(e.target.value.replace(/\D/g, ""))
                  }
                  fullWidth
                />
                <Button
                  variant="primary"
                  size="md"
                  disabled={isSaving}
                  onClick={async () => {
                    if (setupCode.length !== 6) {
                      showToast("Please enter a 6-digit code", "error");
                      return;
                    }
                    setIsSaving(true);
                    try {
                      const data = (await apiClient.users.verify2fa({
                        token: setupCode,
                      })) as {
                        success?: boolean;
                        recoveryCodes?: string[];
                        error?: string;
                      };
                      if (data.success) {
                        setIs2FAEnabled(true);
                        setIs2FASetupVisible(false);
                        setSetupCode("");
                        if (Array.isArray(data.recoveryCodes)) {
                          setRecoveryCodes(data.recoveryCodes);
                        }
                        showToast(
                          "Two-Factor Authentication successfully enabled! Save your recovery codes.",
                          "success"
                        );
                      } else {
                        showToast(data.error || "Invalid code", "error");
                      }
                    } catch (err: unknown) {
                      showToast(
                        formatUserError(
                          err,
                          "The 2FA code is invalid or has expired. Please check and try again."
                        ),
                        "error"
                      );
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                  className="w-full text-xs font-bold"
                >
                  Verify &amp; Activate 2FA
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Disable 2FA Form (when enabled) */}
      {is2FAEnabled && (
        <div className="p-4 rounded-xl bg-muted/30 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-foreground block">
              Two-Factor Authentication is currently active
            </span>
            <span className="text-[11px] text-muted-foreground">
              To disable two-factor protection, provide your account password.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Input
              id="disable-2fa-password"
              type="password"
              placeholder="Current Password"
              aria-label="Current password to disable two-factor authentication"
              autoComplete="current-password"
              value={disable2FAPassword}
              onChange={(e) => setDisable2FAPassword(e.target.value)}
              className="text-xs w-44"
            />
            <Button
              variant="danger"
              size="sm"
              disabled={isSaving || !checkDisable2FAEligibility(is2FAEnabled, { password: disable2FAPassword }).allowed}
              title={!checkDisable2FAEligibility(is2FAEnabled, { password: disable2FAPassword }).allowed ? checkDisable2FAEligibility(is2FAEnabled, { password: disable2FAPassword }).reason : undefined}
              onClick={async () => {
                const eligibility = checkDisable2FAEligibility(is2FAEnabled, { password: disable2FAPassword });
                if (!eligibility.allowed) {
                  showToast(eligibility.reason || "Password required", "error");
                  return;
                }
                setIsSaving(true);
                try {
                  const data = (await apiClient.users.disable2fa({
                    token: disable2FAPassword,
                    password: disable2FAPassword,
                  })) as { success?: boolean; error?: string };
                  if (data.success) {
                    setIs2FAEnabled(false);
                    setDisable2FAPassword("");
                    showToast(
                      "Two-Factor Authentication successfully disabled.",
                      "success"
                    );
                  } else {
                    showToast(data.error || "Failed to disable 2FA", "error");
                  }
                } catch (err: unknown) {
                  showToast(
                    formatUserError(
                      err,
                      "Failed to disable 2FA. Please verify your password and try again."
                    ),
                    "error"
                  );
                } finally {
                  setIsSaving(false);
                }
              }}
              className="text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Disable 2FA
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
