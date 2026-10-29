"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { checkFraudAppealEligibility } from "@/lib/action-eligibility";
import { formatUserError } from "@/lib/user-messages";
import {
  ShieldAlert,
  AlertTriangle,
  Send,
  Clock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui";
import { formatDate } from "@/lib/utils-client";

interface AppealStatusResponse {
  success: boolean;
  data: {
    isFlagged: boolean;
    status: string;
    followerAuthenticityScore: number;
    eligibility: {
      allowed: boolean;
      reason?: string;
      reasonCode?: string;
    };
    latestAppeal: {
      id: string;
      createdAt: string;
      metadata?: {
        reason?: string;
        evidenceUrl?: string;
        submittedAt?: string;
      };
    } | null;
  };
}

export function AuthenticityAppealBanner() {
  const { data, mutate, isLoading } = useSWR<AppealStatusResponse>(
    "/api/influencers/appeal",
    fetcher,
    { revalidateOnFocus: true, dedupingInterval: 15000 }
  );

  const [isExpanded, setIsExpanded] = useState(false);
  const [reason, setReason] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  if (isLoading || !data?.success || !data.data) {
    return null;
  }

  const { isFlagged, followerAuthenticityScore, latestAppeal } = data.data;

  // Only render if account is FLAGGED or score is low (< 60)
  if (!isFlagged && followerAuthenticityScore >= 60) {
    return null;
  }

  const hasPendingAppeal = Boolean(latestAppeal && isFlagged);

  const eligibility = checkFraudAppealEligibility({
    userType: "INFLUENCER",
    userStatus: data.data.status,
    followerAuthenticityScore,
    hasPendingAppeal,
    appealReasonLength: reason.trim().length,
  });

  const handleSubmitAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eligibility.allowed || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const res = await fetch("/api/influencers/appeal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reason.trim(),
          evidenceUrl: evidenceUrl.trim() || undefined,
        }),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.message || "Failed to submit appeal");
      }

      setSubmitSuccess(resData.message || "Appeal submitted successfully.");
      setReason("");
      setEvidenceUrl("");
      await mutate();
    } catch (err: unknown) {
      setSubmitError(formatUserError(err, "Could not submit appeal. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-danger/30 bg-danger/5 p-4 sm:p-5 shadow-sm space-y-4">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-danger/10 text-danger shrink-0 mt-0.5">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-extrabold text-foreground">
                Account Authenticity Audit Active
              </h3>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-danger/15 text-danger border border-danger/30">
                {isFlagged ? "Flagged for Review" : "Low Authenticity Score"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl leading-relaxed">
              Automated social proof algorithms flagged anomalous growth or cross-platform engagement
              divergence. Your current authenticity score is{" "}
              <span className="font-bold text-foreground font-mono">
                {followerAuthenticityScore}/100
              </span>
              . While under review, certain deal settlements or applications may require admin clearance.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="self-start sm:self-center inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border text-xs font-bold text-foreground hover:bg-muted transition-colors cursor-pointer"
          aria-expanded={isExpanded}
        >
          <span>{isExpanded ? "Hide Appeal Details" : "Appeal This Flag"}</span>
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </button>
      </div>

      {/* Pending Appeal Notice */}
      {hasPendingAppeal && latestAppeal && (
        <div className="p-3.5 rounded-xl bg-card border border-border space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-foreground flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-warning" /> Appeal Submitted & Pending Manual Audit
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              {formatDate(latestAppeal.createdAt)}
            </span>
          </div>
          <p className="text-muted-foreground italic">
            "{latestAppeal.metadata?.reason || "Submitted explanation"}"
          </p>
          <p className="text-[11px] text-muted-foreground">
            Our platform integrity team reviews appeals within 24–48 business hours. You will receive an
            in-app notification once audited.
          </p>
        </div>
      )}

      {/* Expanded Appeal Form */}
      {isExpanded && !hasPendingAppeal && (
        <form
          onSubmit={handleSubmitAppeal}
          className="space-y-3 pt-3 border-t border-danger/15 text-xs animate-in fade-in"
        >
          <div>
            <label htmlFor="appeal-reason" className="font-bold text-foreground block mb-1">
              Explain Your Audience Engagement & Growth Metrics
            </label>
            <textarea
              id="appeal-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide context regarding viral videos, format transition, sponsored reel performance, or ad spend spikes (minimum 15 characters)..."
              rows={3}
              className="w-full text-xs p-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex justify-between items-center mt-1 text-[11px] text-muted-foreground">
              <span>Explain any sudden engagement or cross-platform differences.</span>
              <span className={reason.trim().length >= 15 ? "text-success font-semibold" : "text-danger"}>
                {reason.trim().length}/15 min characters
              </span>
            </div>
          </div>

          <div>
            <label htmlFor="evidence-url" className="font-bold text-foreground block mb-1">
              Supporting Evidence Link (Optional)
            </label>
            <input
              id="evidence-url"
              type="url"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              placeholder="https://drive.google.com/... or public screenshot link showing creator studio analytics"
              className="w-full text-xs p-2.5 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {submitError && (
            <div className="p-2.5 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {submitSuccess && (
            <div className="p-2.5 rounded-lg bg-success/10 border border-success/20 text-success text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{submitSuccess}</span>
            </div>
          )}

          {/* Action Button & Inlined Disabled Reason (Rule #1 Gating) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            {!eligibility.allowed && (
              <p className="text-[11px] text-danger font-medium flex items-center gap-1">
                <span>⚠️ {eligibility.reason}</span>
              </p>
            )}
            <Button
              type="submit"
              variant="danger"
              disabled={!eligibility.allowed || isSubmitting}
              className="min-h-[40px] px-4 font-bold text-xs cursor-pointer ml-auto"
              aria-label="Submit Authenticity Appeal"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              {isSubmitting ? "Submitting Appeal..." : "Submit Appeal to Integrity Team"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
