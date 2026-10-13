"use client";

import React from "react";
import { Button } from "@/components/ui";
import {
  getTierIcon,
  getMonthlyLimitText,
  getTierUpgradeActionText,
} from "./VerificationHelpers";
import {
  ShieldCheck,
  CheckCircle2,
  Lock,
  Clock,
  Sparkles,
  Award,
  Mail,
  Phone,
} from "lucide-react";

interface DigiLockerCardProps {
  readonly isConnectingDigiLocker: boolean;
  readonly handleDigiLockerConnect: () => void;
}

export function DigiLockerCardComponent({
  isConnectingDigiLocker,
  handleDigiLockerConnect,
}: DigiLockerCardProps) {
  return (
    <div className="p-5 sm:p-6 rounded-2xl border border-verified-border bg-verified-muted/10 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden">
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-verified-muted text-verified flex items-center justify-center font-bold text-xl border border-verified-border">
            🇮🇳
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-foreground">
                Instant Verification via DigiLocker
              </h3>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-verified-muted text-verified border border-verified-border">
                <ShieldCheck className="w-3 h-3" /> Official UIDAI &amp; ITD
              </span>
            </div>
            <p className="text-xs text-muted-foreground">National e-Governance Division (Government of India)</p>
          </div>
        </div>

        <p className="text-xs text-foreground/80 leading-relaxed max-w-2xl">
          Connect your DigiLocker to automatically verify your <strong>Aadhaar</strong> and <strong>PAN Card</strong> in under 60 seconds — zero document uploads or scans required.
        </p>

        <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1">
          <span className="flex items-center gap-1 text-verified font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" /> 100% Paperless
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Lock className="w-3.5 h-3.5 text-primary" /> Read-Only 256-bit Encrypted
          </span>
        </div>
      </div>

      <Button
        variant="primary"
        size="md"
        aria-label="Connect to DigiLocker for instant government ID verification"
        aria-busy={isConnectingDigiLocker}
        onClick={handleDigiLockerConnect}
        disabled={isConnectingDigiLocker}
        className="self-start md:self-center font-bold text-xs shrink-0 shadow-sm flex items-center gap-2 px-5 py-2.5"
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span>{isConnectingDigiLocker ? "Connecting to DigiLocker..." : "Connect DigiLocker"}</span>
      </Button>
    </div>
  );
}

interface TierCardProps {
  readonly tier: number;
  readonly isBrand: boolean;
  readonly renderDocRow: (type: string, label: string, icon: string, desc: string) => React.ReactNode;
}

export function Tier1CardComponent({ tier, renderDocRow }: Omit<TierCardProps, "isBrand">) {
  const isUnlocked = tier >= 1;

  return (
    <div
      className={`p-5 sm:p-6 rounded-2xl border transition-all ${
        isUnlocked
          ? "bg-card border-border shadow-xs"
          : "bg-card border-border/80"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-foreground">
                Tier 1 — Basic Identity Verification
              </h3>
              <span className="text-xs font-normal text-muted-foreground">
                (Up to ₹50,000 / month)
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Aadhaar Card + Liveness verification check
            </p>
          </div>
        </div>

        <div>
          {isUnlocked ? (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-verified bg-verified-muted px-2.5 py-1 rounded-full border border-verified-border shrink-0 whitespace-nowrap">
              <CheckCircle2 className="w-3.5 h-3.5" /> Tier 1 Unlocked
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20 shrink-0 whitespace-nowrap">
              Required for Payouts
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {renderDocRow("AADHAAR", "Aadhaar Card", "🪪", "Front & back photo of your Aadhaar card (identity and address proof)")}
        {renderDocRow("SELFIE", "Liveness Selfie", "🤳", "Clear selfie with face clearly visible (anti-impersonation fraud check)")}
      </div>
    </div>
  );
}

export function Tier2CardComponent({ tier, isBrand, renderDocRow }: TierCardProps) {
  const isUnlocked = tier >= 2;
  const isDisabled = tier < 1;

  return (
    <div
      className={`p-5 sm:p-6 rounded-2xl border transition-all ${
        isUnlocked
          ? "bg-card border-border shadow-xs"
          : isDisabled
          ? "bg-muted/30 border-border opacity-70"
          : "bg-card border-border"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pending-muted text-pending flex items-center justify-center">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-foreground">
                Tier 2 — Financial &amp; Tax Identity
              </h3>
              <span className="text-xs font-normal text-muted-foreground">
                {isBrand ? "(Up to ₹1,00,000 / month)" : "(Up to ₹5,00,000 / month)"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              PAN Card + Bank Statement for Form 26AS TDS Credit
            </p>
          </div>
        </div>

        <div>
          {isUnlocked ? (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-verified bg-verified-muted px-2.5 py-1 rounded-full border border-verified-border shrink-0 whitespace-nowrap">
              <CheckCircle2 className="w-3.5 h-3.5" /> Tier 2 Unlocked
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-pending bg-pending-muted px-2.5 py-1 rounded-full border border-pending-border shrink-0 whitespace-nowrap">
              {getTierUpgradeActionText(tier, isBrand)}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {renderDocRow("PAN_CARD", "Permanent Account Number (PAN)", "💳", "Clear photo of your Indian PAN card for TDS compliance")}
        {renderDocRow("BANK_STATEMENT", "Bank Statement / Cancelled Cheque", "📑", "Latest 3-month bank statement or cancelled cheque matching your PAN name")}
      </div>
    </div>
  );
}

export function Tier3CardComponent({ tier, renderDocRow }: Omit<TierCardProps, "isBrand">) {
  const isUnlocked = tier >= 3;
  const isDisabled = tier < 2;

  return (
    <div
      className={`p-5 sm:p-6 rounded-2xl border transition-all ${
        isUnlocked
          ? "bg-card border-border shadow-xs"
          : isDisabled
          ? "bg-muted/30 border-border opacity-70"
          : "bg-card border-border"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-verified-muted text-verified flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-foreground">
                Tier 3 — Business &amp; Enterprise GST
              </h3>
              <span className="text-xs font-bold text-verified">
                (∞ Unlimited Payouts &amp; Deals)
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Upload <strong>any one</strong> official corporate document for enterprise-tier privileges.
            </p>
          </div>
        </div>

        <div>
          {isUnlocked ? (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-verified bg-verified-muted px-2.5 py-1 rounded-full border border-verified-border shrink-0 whitespace-nowrap">
              <Sparkles className="w-3.5 h-3.5" /> Unlimited Tier Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground bg-muted px-2.5 py-1 rounded-full border border-border shrink-0 whitespace-nowrap">
              {isDisabled ? "Complete Tier 2 first" : "Upload any 1 document below"}
            </span>
          )}
        </div>
      </div>

      <div className="p-3 rounded-xl bg-verified-muted/20 border border-verified-border/40 text-xs text-foreground/80 mb-4 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-verified shrink-0" />
        <span>You only need to submit <strong>any single one</strong> of the business documents below to qualify.</span>
      </div>

      <div className="space-y-3">
        {renderDocRow("GST_CERTIFICATE", "GST Registration Certificate (Form REG-06)", "🏢", "Valid GST certificate with active GSTIN for business tax invoices")}
        {renderDocRow("MSME_CERTIFICATE", "Udyam / MSME Registration", "📜", "Government of India Udyam registration certificate")}
        {renderDocRow("STARTUP_CERTIFICATE", "Startup India DPIIT Recognition", "🚀", "DPIIT recognition letter or Startup India certificate")}
        {renderDocRow("CIN_CERTIFICATE", "Certificate of Incorporation (CIN)", "🏛️", "Ministry of Corporate Affairs (MCA) certificate for Pvt Ltd / LLP entities")}
      </div>
    </div>
  );
}

interface TierStatusCardProps {
  readonly tier: number;
  readonly tierColors: string[];
  readonly isUnlimited: boolean;
  readonly tierLimit: number | null;
  readonly tierDesc: string;
  readonly trustScore: number;
}

export function TierStatusCardComponent({
  tier,
  tierColors: _tierColors,
  isUnlimited,
  tierLimit,
  tierDesc,
  trustScore,
}: TierStatusCardProps) {
  const tierNames = ["Tier 0: Unverified", "Tier 1: Basic Identity", "Tier 2: Financial & Tax", "Tier 3: Business Enterprise"];
  const currentTierName = tierNames[Math.min(tier, 3)] || "Tier 0: Unverified";

  return (
    <div className="p-5 sm:p-6 rounded-2xl border border-border bg-card shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Verification Level &amp; Privileges
          </span>
          <div className="flex items-center gap-3 mt-1.5">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              {getTierIcon(tier)}
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-foreground tracking-tight">
                {currentTierName}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {tierDesc || "Complete identity checkpoints to expand payout volumes."}
              </p>
            </div>
          </div>
        </div>

        <div className="sm:text-right p-3 sm:p-0 rounded-xl bg-muted/30 sm:bg-transparent border sm:border-0 border-border">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Monthly Payout Cap
          </span>
          <div className="text-2xl font-extrabold text-foreground tabular-nums tracking-tight mt-0.5">
            {getMonthlyLimitText(isUnlimited, tier, tierLimit)}
          </div>
          <span className="text-[11px] text-muted-foreground">Automated Escrow Settlements</span>
        </div>
      </div>

      {/* Trust Score Contribution Bar */}
      <div className="pt-2 border-t border-border">
        <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-verified" /> Verified DRS Credit Rating (CIBIL 300-900)
          </span>
          <span className="text-foreground font-bold tabular-nums">
            {trustScore} / 900 Score
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <div
            className="bg-verified h-full rounded-full transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(0, ((trustScore - 300) / 600) * 100))}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
          <span>300 (Subprime)</span>
          <span>600 (Neutral)</span>
          <span>750+ (Prime)</span>
          <span>900 (Elite)</span>
        </div>
      </div>
    </div>
  );
}

interface Step1MandatoryCardProps {
  readonly emailVerified: boolean;
  readonly phoneVerified: boolean;
}

export function Step1MandatoryCardComponent({
  emailVerified,
  phoneVerified,
}: Step1MandatoryCardProps) {
  return (
    <div className="p-5 sm:p-6 rounded-2xl border border-border bg-card shadow-xs">
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm sm:text-base font-bold text-foreground">
            Prerequisite — Contact Authentication
          </h3>
          <p className="text-xs text-muted-foreground">
            Required for two-factor security alerts and escrow transaction notifications.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Email */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/30 border border-border">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-card border border-border text-primary">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">Email Address</div>
              <div className="text-[11px] text-muted-foreground">
                {emailVerified ? "Verified Account" : "OTP Required"}
              </div>
            </div>
          </div>
          {emailVerified ? (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-verified bg-verified-muted px-2.5 py-0.5 rounded-full border border-verified-border">
              <CheckCircle2 className="w-3.5 h-3.5" /> Verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-pending bg-pending-muted px-2.5 py-0.5 rounded-full border border-pending-border">
              <Clock className="w-3.5 h-3.5" /> Pending
            </span>
          )}
        </div>

        {/* Phone */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/30 border border-border">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-card border border-border text-primary">
              <Phone className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">Mobile Phone (SMS OTP)</div>
              <div className="text-[11px] text-muted-foreground">
                {phoneVerified ? "Verified Number" : "OTP Required"}
              </div>
            </div>
          </div>
          {phoneVerified ? (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-verified bg-verified-muted px-2.5 py-0.5 rounded-full border border-verified-border">
              <CheckCircle2 className="w-3.5 h-3.5" /> Verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-pending bg-pending-muted px-2.5 py-0.5 rounded-full border border-pending-border">
              <Clock className="w-3.5 h-3.5" /> Pending
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
