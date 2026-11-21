"use client";

import React, { useState, useEffect } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Button, Input } from "@/components/ui";
import { formatUserError } from "@/lib/user-messages";
import {
  Lock,
  Unlock,
  ShieldCheck,
  Key,
  Users,
  CheckCircle2,
  RefreshCw,
  Sparkles,
} from "lucide-react";

interface RegistrationGateApiResponse {
  success: boolean;
  data: {
    requireReferral: boolean;
    masterInviteCode: string;
    updatedAt?: string;
    updatedBy?: string;
  };
}

interface RegistrationGateManagerProps {
  onShowToast: (type: "success" | "error" | "info", msg: string) => void;
}

export default function RegistrationGateManager({ onShowToast }: RegistrationGateManagerProps) {
  const { data, isLoading, mutate } = useSWR<RegistrationGateApiResponse>(
    "/api/admin/system/registration-gate",
    fetcher
  );

  const [requireReferral, setRequireReferral] = useState(false);
  const [masterInviteCode, setMasterInviteCode] = useState("VIPBETA");
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (data?.data) {
      setRequireReferral(data.data.requireReferral);
      setMasterInviteCode(data.data.masterInviteCode || "VIPBETA");
    }
  }, [data]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/admin/system/registration-gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requireReferral,
          masterInviteCode: masterInviteCode.trim().toUpperCase(),
          reason: reason.trim() || undefined,
        }),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.message || "Failed to update registration policy");
      }

      onShowToast(
        requireReferral ? "info" : "success",
        requireReferral
          ? "🔒 Invite-Only Beta mode engaged! Registration now requires a referral code."
          : "🌐 Open registration restored! Users can sign up without a referral code."
      );
      setReason("");
      mutate();
    } catch (err) {
      onShowToast("error", formatUserError(err, "Failed to save registration gate configuration."));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 rounded-2xl bg-card border border-border shadow-xs flex items-center justify-center gap-3 text-muted-foreground">
        <RefreshCw className="w-5 h-5 animate-spin" />
        <span className="text-sm font-medium">Loading registration gate settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div
        className={`p-6 rounded-2xl border transition-all ${
          requireReferral
            ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
            : "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
        }`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                requireReferral ? "bg-amber-500/20" : "bg-emerald-500/20"
              }`}
            >
              {requireReferral ? <Lock className="w-6 h-6 text-amber-500" /> : <Unlock className="w-6 h-6 text-emerald-500" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-foreground">
                  {requireReferral ? "Invite-Only Beta Mode Active" : "Open Public Registration Active"}
                </h3>
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                    requireReferral ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  }`}
                >
                  {requireReferral ? "Gated Beta" : "Public Mode"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {requireReferral
                  ? "Every new user MUST provide a valid user referral code or master invite code during signup."
                  : "Anyone can register on VyaparMedia. Referral code is purely optional."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant={requireReferral ? "secondary" : "primary"}
              size="sm"
              onClick={() => setRequireReferral(!requireReferral)}
              className="cursor-pointer"
            >
              {requireReferral ? "Switch to Open Registration" : "Activate Invite-Only Beta"}
            </Button>
          </div>
        </div>
      </div>

      {/* Control Form Card */}
      <div className="p-6 rounded-2xl bg-card border border-border shadow-xs space-y-6">
        <div>
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Registration Gatekeeper Configuration
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            Configure how referral codes are enforced across Influencer and Brand registrations.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Setting 1: Toggle */}
          <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Users className="w-4 h-4 text-muted-foreground" />
                Referral Code Mandatory
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={requireReferral}
                onClick={() => setRequireReferral(!requireReferral)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  requireReferral ? "bg-amber-500" : "bg-muted"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out ${
                    requireReferral ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              When toggled ON, the registration page requires a valid referral code or the VIP master code. Direct signups are prevented.
            </p>
          </div>

          {/* Setting 2: Master VIP Invite Code */}
          <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Key className="w-4 h-4 text-muted-foreground" />
                Master VIP Invite Code
              </span>
              <span className="text-[10px] font-semibold text-primary px-2 py-0.5 rounded-md bg-primary/10">
                Admin Bypass
              </span>
            </div>
            <Input
              id="masterInviteCode"
              type="text"
              placeholder="e.g. VIPBETA"
              value={masterInviteCode}
              onChange={(e) => setMasterInviteCode(e.target.value.toUpperCase())}
              className="font-mono uppercase font-bold"
            />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Universal bypass code for partner agencies, founders, and VIP campaigns to register without an existing user&apos;s code.
            </p>
          </div>
        </div>

        {/* Audit Reason */}
        <div className="space-y-1.5">
          <label htmlFor="auditReason" className="text-xs font-medium text-foreground">
            Audit Reason (Optional)
          </label>
          <Input
            id="auditReason"
            type="text"
            placeholder="e.g. Enabling invite-only mode for Phase 2 creator onboarding batch"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        {/* Live Behavior Comparison */}
        <div className="p-4 rounded-xl border border-border/80 bg-background/50 space-y-3">
          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-primary" />
            Live Signup Form Preview
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div
              className={`p-3 rounded-lg border ${
                requireReferral
                  ? "border-amber-500/40 bg-amber-500/5 text-foreground"
                  : "border-border bg-muted/30 text-muted-foreground opacity-60"
              }`}
            >
              <div className="font-bold flex items-center gap-1.5 text-amber-500 mb-1">
                <Lock className="w-3.5 h-3.5" />
                Invite-Only Active (Current Selection: {requireReferral ? "YES" : "NO"})
              </div>
              <ul className="space-y-1 text-[11px] text-muted-foreground list-disc pl-4">
                <li>Input: <code>Invite / Referral Code * (Required)</code></li>
                <li>Blank submission: Blocked with error banner</li>
                <li>Valid code or <code>{masterInviteCode}</code>: Registration permitted</li>
              </ul>
            </div>

            <div
              className={`p-3 rounded-lg border ${
                !requireReferral
                  ? "border-emerald-500/40 bg-emerald-500/5 text-foreground"
                  : "border-border bg-muted/30 text-muted-foreground opacity-60"
              }`}
            >
              <div className="font-bold flex items-center gap-1.5 text-emerald-500 mb-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Open Registration (Current Selection: {!requireReferral ? "YES" : "NO"})
              </div>
              <ul className="space-y-1 text-[11px] text-muted-foreground list-disc pl-4">
                <li>Input: <code>Referral Code (optional)</code></li>
                <li>Blank submission: Allowed without restriction</li>
                <li>Entered code: Validated and bonuses credited</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="text-[11px] text-muted-foreground">
            {data?.data?.updatedAt ? (
              <span>Last updated: {new Date(data.data.updatedAt).toLocaleString("en-IN")}</span>
            ) : (
              <span>Default system policy active</span>
            )}
          </div>

          <Button
            type="button"
            variant="primary"
            onClick={handleSave}
            disabled={isSaving}
            className="cursor-pointer font-bold"
          >
            {isSaving ? "Saving Policy..." : "Save Gatekeeper Configuration"}
          </Button>
        </div>
      </div>
    </div>
  );
}
