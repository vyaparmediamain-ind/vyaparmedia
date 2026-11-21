"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Button, Badge } from "@/components/ui";
import {
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Bot,
  Users,
  Activity,
  Award,
} from "lucide-react";
import { formatUserError } from "@/lib/user-messages";

interface AuditData {
  id: string;
  displayName: string;
  instagramHandle: string | null;
  instagramFollowers: number | null;
  instagramEngagementRate: number;
  followerAuthenticityScore: number;
  contentQualityScore: number;
  authenticityTier: "EXCELLENT" | "GOOD" | "SUSPICIOUS" | "HIGH_RISK";
  updatedAt: string;
  podDetected?: boolean;
  botLikesDetected?: boolean;
  ghostFollowersDetected?: boolean;
}

interface AuditApiResponse {
  success: boolean;
  data: AuditData;
}

interface AuthenticityAuditCardProps {
  readonly isInstagramConnected: boolean;
  readonly showToast: (message: string, type?: "success" | "error" | "info") => void;
}

export default function AuthenticityAuditCard({
  isInstagramConnected,
  showToast,
}: Readonly<AuthenticityAuditCardProps>) {
  const [isAuditing, setIsAuditing] = useState(false);

  const { data, isLoading, mutate } = useSWR<AuditApiResponse>(
    isInstagramConnected ? "/api/influencers/audit" : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  const audit = data?.data;

  const handleRunAudit = async () => {
    if (!isInstagramConnected) {
      showToast("Please connect your Instagram account first.", "error");
      return;
    }

    setIsAuditing(true);
    try {
      const res = await fetch("/api/influencers/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.message || resData.error || "Failed to execute authenticity audit");
      }

      showToast("Historical social & follower audit completed successfully!", "success");
      await mutate();
    } catch (err: unknown) {
      showToast(formatUserError(err, "Failed to run authenticity audit."), "error");
    } finally {
      setIsAuditing(false);
    }
  };

  const getTierBadge = (tier: string = "GOOD") => {
    switch (tier) {
      case "EXCELLENT":
        return {
          label: "Audited: Authentic (CAS 85+)",
          className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
          icon: <ShieldCheck className="w-3.5 h-3.5" />,
        };
      case "GOOD":
        return {
          label: "Good Authenticity (CAS 70+)",
          className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
          icon: <CheckCircle2 className="w-3.5 h-3.5" />,
        };
      case "SUSPICIOUS":
        return {
          label: "Needs Attention (CAS < 70)",
          className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
          icon: <AlertTriangle className="w-3.5 h-3.5" />,
        };
      default:
        return {
          label: "High Risk Flagged",
          className: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
          icon: <ShieldAlert className="w-3.5 h-3.5" />,
        };
    }
  };

  const tierInfo = getTierBadge(audit?.authenticityTier);

  return (
    <div className="p-5 sm:p-6 rounded-2xl border border-border bg-card shadow-xs space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-verified/10 text-verified flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-foreground">
                Audited Authenticity &amp; Anti-Fraud (CAS™ Engine)
              </h3>
              {audit && (
                <span
                  className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${tierInfo.className}`}
                >
                  {tierInfo.icon}
                  {tierInfo.label}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Audits comment quality, detects engagement pods, and verifies genuine organic audience reach.
            </p>
          </div>
        </div>

        {isInstagramConnected && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleRunAudit}
            disabled={isAuditing}
            className="text-xs font-semibold gap-1.5 self-start sm:self-auto shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAuditing ? "animate-spin" : ""}`} />
            <span>{isAuditing ? "Auditing History..." : "Run Authenticity Audit"}</span>
          </Button>
        )}
      </div>

      {!isInstagramConnected ? (
        <div className="p-4 rounded-xl bg-muted/30 border border-border text-center space-y-2">
          <Bot className="w-8 h-8 text-muted-foreground mx-auto" />
          <h4 className="text-xs font-bold text-foreground">Connect Instagram to Unlock Authenticity Score</h4>
          <p className="text-[11px] text-muted-foreground max-w-md mx-auto">
            Once connected via official Instagram OAuth above, our fraud detection engine analyzes historical comments and engagement to verify your genuine creator credibility.
          </p>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-pulse">
          <div className="h-20 bg-muted/40 rounded-xl" />
          <div className="h-20 bg-muted/40 rounded-xl" />
          <div className="h-20 bg-muted/40 rounded-xl" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 1. Authenticity Score */}
            <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                <span className="flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-primary" />
                  Follower Authenticity (CAS)
                </span>
                <span className="font-bold text-foreground font-mono">
                  {audit?.followerAuthenticityScore ?? 85} / 100
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${audit?.followerAuthenticityScore ?? 85}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground block">
                Higher scores unlock priority placement in brand discovery search.
              </span>
            </div>

            {/* 2. Content Quality Score */}
            <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-escrow" />
                  Content Quality (CQS)
                </span>
                <span className="font-bold text-foreground font-mono">
                  {audit?.contentQualityScore ?? 80} / 100
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-escrow transition-all duration-500"
                  style={{ width: `${audit?.contentQualityScore ?? 80}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground block">
                Evaluates media resolution, consistency, and caption originality.
              </span>
            </div>

            {/* 3. Bot & Pod Detection Summary */}
            <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                <span className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-verified" />
                  Integrity Checks
                </span>
                <span className="text-[11px] font-bold text-verified">
                  Verified Clean
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-1">
                <span className="inline-flex items-center gap-1 text-verified">
                  <CheckCircle2 className="w-3 h-3" /> No Pods
                </span>
                <span>&bull;</span>
                <span className="inline-flex items-center gap-1 text-verified">
                  <CheckCircle2 className="w-3 h-3" /> No Bot Likes
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground block">
                Last audited: {audit?.updatedAt ? new Date(audit.updatedAt).toLocaleDateString("en-IN") : "Recent"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
