"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  BookOpen,
  ArrowRight,
  X,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useGuideDrawer } from "./GuideDrawerContext";
import type { GuideUserType } from "@/lib/guides/schema";

export interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  guideId: string;
  href: string;
  actionText: string;
}

const ROLE_CHECKLISTS: Record<GuideUserType, ChecklistItem[]> = {
  INFLUENCER: [
    {
      id: "inf-kyc",
      title: "Complete PAN Verification",
      description: "Submit government PAN card to unlock 0.1% TDS and enable bank withdrawals.",
      estimatedMinutes: 3,
      guideId: "influencer-settings-verification",
      href: "/dashboard/settings",
      actionText: "Verify PAN",
    },
    {
      id: "inf-instagram",
      title: "Connect Instagram Account",
      description: "Link your Instagram business account to unlock verified metrics and badge boosts.",
      estimatedMinutes: 2,
      guideId: "influencer-settings-social",
      href: "/dashboard/settings",
      actionText: "Connect Social",
    },
    {
      id: "inf-discover",
      title: "Discover Campaigns & Submit Pitch",
      description: "Browse verified opportunities matching your niche and submit your deliverable quote.",
      estimatedMinutes: 5,
      guideId: "influencer-discover-campaigns",
      href: "/dashboard/campaigns",
      actionText: "Browse Campaigns",
    },
    {
      id: "inf-escrow",
      title: "Understand Deal Escrow & Milestones",
      description: "Learn how brand funds are secured in bank escrow before content production begins.",
      estimatedMinutes: 3,
      guideId: "influencer-deal-lifecycle",
      href: "/dashboard/deals",
      actionText: "View Deals",
    },
    {
      id: "inf-wallet",
      title: "Add Bank Account for Friday Payouts",
      description: "Register verified bank account or UPI ID for automated weekly earnings transfers.",
      estimatedMinutes: 2,
      guideId: "influencer-wallet-and-taxes",
      href: "/dashboard/wallet",
      actionText: "Setup Payouts",
    },
  ],
  BRAND: [
    {
      id: "br-kyc",
      title: "Verify Business Entity & GSTIN",
      description: "Verify your company GSTIN to enable tax-deductible invoicing and escrow deposits.",
      estimatedMinutes: 3,
      guideId: "brand-verification-kyc",
      href: "/dashboard/settings",
      actionText: "Verify Business",
    },
    {
      id: "br-campaign",
      title: "Create Your First Campaign Brief",
      description: "Launch a structured brief with explicit deliverables, CPV budget, and timeline.",
      estimatedMinutes: 5,
      guideId: "brand-campaign-creation",
      href: "/dashboard/campaigns/create",
      actionText: "Create Brief",
    },
    {
      id: "br-creators",
      title: "Discover & Bookmark Top Creators",
      description: "Use advanced filters to identify creators with verified engagement across target cities.",
      estimatedMinutes: 3,
      guideId: "brand-creator-discovery",
      href: "/dashboard/influencers",
      actionText: "Discover Creators",
    },
    {
      id: "br-escrow",
      title: "Review Milestone Escrow Safeguards",
      description: "Understand 100% money-back guarantees, revision limits, and dispute arbitration rules.",
      estimatedMinutes: 4,
      guideId: "brand-deal-management",
      href: "/dashboard/deals",
      actionText: "View Safeguards",
    },
    {
      id: "br-reports",
      title: "Review Financial Statements & GST Invoices",
      description: "Learn how to export monthly chartered accountant packages and tax filings.",
      estimatedMinutes: 2,
      guideId: "brand-finance-ca-export",
      href: "/dashboard/analytics",
      actionText: "View Reports",
    },
  ],
  SCOUT: [
    {
      id: "sc-verify",
      title: "Verify College Enrollment Proof",
      description: "Upload your valid student ID card to activate official ambassador privileges.",
      estimatedMinutes: 2,
      guideId: "scout-verification-gate",
      href: "/dashboard",
      actionText: "Submit Student ID",
    },
    {
      id: "sc-qr",
      title: "Generate Offline QR Code & Link",
      description: "Download customized recruitment posters and flyers for on-campus creator onboarding.",
      estimatedMinutes: 2,
      guideId: "scout-offline-qr-code",
      href: "/dashboard/referrals",
      actionText: "Get QR Code",
    },
    {
      id: "sc-invite",
      title: "Onboard Your First Campus Creator",
      description: "Share your referral link with creators in your college network to build your roster.",
      estimatedMinutes: 5,
      guideId: "scout-inviting-creators",
      href: "/dashboard/referrals",
      actionText: "Invite Creators",
    },
    {
      id: "sc-royalties",
      title: "Track 1% Lifetime Deal Royalties",
      description: "Monitor weekly earnings credited whenever creators deliver paid brand collaborations.",
      estimatedMinutes: 3,
      guideId: "scout-royalties-and-wallet",
      href: "/dashboard/wallet",
      actionText: "View Earnings",
    },
  ],
  ADMIN: [
    {
      id: "adm-command",
      title: "Inspect Command Center Health",
      description: "Review platform liquidity, active disputes, and pending verification queue depth.",
      estimatedMinutes: 3,
      guideId: "admin-command-center",
      href: "/admin",
      actionText: "Open Command Center",
    },
    {
      id: "adm-kyc",
      title: "Process Identity Verification Queue",
      description: "Audit pending PAN and GSTIN submissions against government databases within SLA.",
      estimatedMinutes: 5,
      guideId: "admin-kyc-verification-desk",
      href: "/admin/verifications",
      actionText: "Review KYC Queue",
    },
    {
      id: "adm-reconcile",
      title: "Verify Nodal Escrow Reconciliation",
      description: "Ensure user liability ledger perfectly reconciles against nodal bank reserve balances.",
      estimatedMinutes: 4,
      guideId: "admin-financial-reconciliation",
      href: "/admin/financial",
      actionText: "Reconcile Ledger",
    },
    {
      id: "adm-dlq",
      title: "Inspect System Health & DLQ Depth",
      description: "Monitor background worker heartbeats, feature flags, and dead-letter queue metrics.",
      estimatedMinutes: 4,
      guideId: "admin-system-health-and-dlq",
      href: "/admin/system",
      actionText: "System Controls",
    },
  ],
};

interface FirstRunChecklistProps {
  readonly role: string | null | undefined;
  readonly userId?: string | undefined;
  readonly compact?: boolean | undefined;
  readonly className?: string | undefined;
}

export function FirstRunChecklist({
  role,
  userId = "guest",
  compact = false,
  className = "",
}: Readonly<FirstRunChecklistProps>) {
  const { openGuideDrawer } = useGuideDrawer();
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const normalizedRole: GuideUserType = useMemo(() => {
    const upper = (role || "INFLUENCER").toUpperCase();
    if (upper === "BRAND") return "BRAND";
    if (upper === "SCOUT") return "SCOUT";
    if (upper === "ADMIN") return "ADMIN";
    return "INFLUENCER";
  }, [role]);

  const items = ROLE_CHECKLISTS[normalizedRole] || ROLE_CHECKLISTS.INFLUENCER;
  const storageKey = `vm_first_run_${normalizedRole}_${userId}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.completedIds)) {
          setCompletedIds(parsed.completedIds);
        }
        if (parsed.dismissed === true) {
          setIsDismissed(true);
        }
      }
    } catch {
      // Storage access error
    } finally {
      setIsLoaded(true);
    }
  }, [storageKey]);

  const saveState = useCallback(
    (newCompleted: string[], dismissed: boolean) => {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            completedIds: newCompleted,
            dismissed,
            updatedAt: Date.now(),
          })
        );
      } catch {
        // Storage access error
      }
    },
    [storageKey]
  );

  const toggleItem = (itemId: string) => {
    const updated = completedIds.includes(itemId)
      ? completedIds.filter((id) => id !== itemId)
      : [...completedIds, itemId];
    setCompletedIds(updated);
    saveState(updated, isDismissed);
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    saveState(completedIds, true);
  };

  const handleRestore = () => {
    setIsDismissed(false);
    saveState(completedIds, false);
  };

  const completedCount = completedIds.filter((id) =>
    items.some((item) => item.id === id)
  ).length;
  const progressPercent = Math.round((completedCount / items.length) * 100);

  if (!isLoaded) {
    return null;
  }

  if (isDismissed) {
    return (
      <div className={`flex justify-end ${className}`}>
        <button
          type="button"
          onClick={handleRestore}
          className="text-xs text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full border border-border hover:border-primary/40 bg-card cursor-pointer"
          title="Restore onboarding checklist"
        >
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span>Show Onboarding Checklist ({completedCount}/{items.length})</span>
        </button>
      </div>
    );
  }

  const roleTitles: Record<GuideUserType, string> = {
    INFLUENCER: "Creator Launch Checklist",
    BRAND: "Brand Onboarding Checklist",
    SCOUT: "Campus Ambassador Checklist",
    ADMIN: "Platform Operations Onboarding",
  };

  return (
    <section
      aria-label="First-run onboarding checklist"
      className={`card border border-border glass rounded-2xl p-5 sm:p-6 transition-all ${className}`}
    >
      {/* Header with Title, Progress Bar, and Collapse/Dismiss buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              {roleTitles[normalizedRole]}
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {progressPercent}% Complete
              </span>
            </h2>
            <p className="text-xs text-muted-foreground">
              Follow these recommended steps to set up your account and get started quickly.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            aria-label={isCollapsed ? "Expand checklist" : "Collapse checklist"}
            title={isCollapsed ? "Expand" : "Collapse"}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            aria-label="Dismiss onboarding checklist"
            title="Dismiss checklist"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden my-3">
        <div
          className="bg-primary h-full transition-all duration-500 rounded-full"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Checklist Items */}
      {!isCollapsed && (
        <div className="space-y-3 pt-2">
          {items.map((item) => {
            const isDone = completedIds.includes(item.id);
            return (
              <div
                key={item.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border transition-all ${
                  isDone
                    ? "bg-card/40 border-border/40 opacity-75"
                    : "bg-card border-border hover:border-primary/40 shadow-xs"
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => toggleItem(item.id)}
                    className="mt-0.5 text-muted-foreground hover:text-primary transition-colors cursor-pointer shrink-0"
                    aria-label={isDone ? `Mark "${item.title}" incomplete` : `Mark "${item.title}" completed`}
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-verified" />
                    ) : (
                      <Circle className="w-5 h-5" />
                    )}
                  </button>
                  <div>
                    <h3
                      className={`text-xs font-bold ${
                        isDone ? "line-through text-muted-foreground" : "text-foreground"
                      }`}
                    >
                      {item.title}
                      <span className="ml-2 text-[10px] font-normal text-muted-foreground">
                        (~{item.estimatedMinutes} min)
                      </span>
                    </h3>
                    {!compact && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1 sm:line-clamp-none">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => openGuideDrawer(item.guideId)}
                    data-guide-id={item.guideId}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-primary px-2.5 py-1 rounded-lg border border-border hover:border-primary/40 bg-muted/40 transition-colors cursor-pointer"
                    title="Read standard operating procedure"
                  >
                    <BookOpen className="w-3 h-3" />
                    <span>Guide</span>
                  </button>

                  <Link
                    href={item.href}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary/90 px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/15 transition-colors"
                  >
                    <span>{item.actionText}</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
