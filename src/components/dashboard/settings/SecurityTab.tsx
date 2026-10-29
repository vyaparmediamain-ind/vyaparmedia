"use client";

import type { User } from "./ProfileTab";
import ContactVerificationPanel from "./ContactVerificationPanel";
import PasswordPanel from "./PasswordPanel";
import TwoFactorAuthPanel from "./TwoFactorAuthPanel";
import LoginActivityPanel from "./LoginActivityPanel";
import DeleteAccountPanel from "./DeleteAccountPanel";
import { ShieldCheck, Lock, CheckCircle2, AlertTriangle } from "lucide-react";

interface SecurityTabProps {
  user: User;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  isSaving: boolean;
  setIsSaving: (val: boolean) => void;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}

export default function SecurityTab({
  user,
  setUser,
  isSaving,
  setIsSaving,
  showToast,
}: Readonly<SecurityTabProps>) {
  // Calculate security health score
  let securityScore = 15; // Base credentials score
  if (user?.emailVerified) securityScore += 25;
  if (user?.phoneVerified) securityScore += 25;
  if (user?.isTwoFactorEnabled) securityScore += 35;

  const isHighProtection = securityScore >= 80;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* 1. Security Health Overview Card (matching KYC TierStatusCardComponent) */}
      <div className="p-5 sm:p-6 rounded-2xl border border-border bg-card shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Account Security &amp; Access Controls
            </span>
            <div className="flex items-center gap-3 mt-1.5">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-foreground tracking-tight">
                  Security Shield &amp; Protection
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Protect your escrow wallet, contracts, and creator identity with enterprise safeguards.
                </p>
              </div>
            </div>
          </div>

          <div className="sm:text-right p-3 sm:p-0 rounded-xl bg-muted/30 sm:bg-transparent border sm:border-0 border-border">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Protection Level
            </span>
            <div className="mt-1">
              {isHighProtection ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-verified bg-verified-muted px-2.5 py-1 rounded-full border border-verified-border shrink-0 whitespace-nowrap">
                  <CheckCircle2 className="w-3.5 h-3.5" /> High Protection
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-pending bg-pending-muted px-2.5 py-1 rounded-full border border-pending-border shrink-0 whitespace-nowrap">
                  <AlertTriangle className="w-3.5 h-3.5" /> Action Recommended
                </span>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground mt-1 block">
              2FA: {user?.isTwoFactorEnabled ? "Active (TOTP)" : "Recommended"}
            </span>
          </div>
        </div>

        {/* Health Score Bar */}
        <div className="pt-2 border-t border-border">
          <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-verified" /> Verified Defense Checkpoints
            </span>
            <span className="text-foreground font-bold tabular-nums">
              {securityScore} / 100 Health Score
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="bg-verified h-full rounded-full transition-all duration-300"
              style={{ width: `${securityScore}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. Contact Authentication Panel */}
      <ContactVerificationPanel
        user={user}
        setUser={setUser}
        isSaving={isSaving}
        setIsSaving={setIsSaving}
        showToast={showToast}
      />

      {/* 3. Two-Factor Authentication (2FA) */}
      <TwoFactorAuthPanel
        isSaving={isSaving}
        setIsSaving={setIsSaving}
        showToast={showToast}
      />

      {/* 4. Password & Credentials */}
      <PasswordPanel
        user={user}
        isSaving={isSaving}
        setIsSaving={setIsSaving}
        showToast={showToast}
      />

      {/* 5. Active Sessions & Devices */}
      <LoginActivityPanel showToast={showToast} />

      {/* 6. Delete Account Danger Zone */}
      <DeleteAccountPanel
        isSaving={isSaving}
        setIsSaving={setIsSaving}
        showToast={showToast}
      />
    </div>
  );
}
