"use client";

import React, { useState, use, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { logger } from "@/lib/logger-client";
import { apiClient } from "@/lib/api-client";
import { formatUserError } from "@/lib/user-messages";
import { haptic } from "@/lib/haptics";
import { Button, Textarea, Input, ToastContainer, type ToastItem, Skeleton, BottomSheet, PageContainer, PageHeader } from "@/components/ui";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { formatCurrency } from "@/lib/utils-client";
import { createDisputeSchema } from "@/lib/validations/campaign";
import { checkDisputeEligibility } from "@/lib/action-eligibility";
import {
  ArrowLeft,
  ArrowRight,
  Lock,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileWarning,
  Film,
  DollarSign,
  Trash2,
  ShieldAlert,
  Building2,
  User,
  Zap,
  Paperclip,
  Check,
} from "lucide-react";

interface DisputePageProps {
  readonly params: Promise<{ readonly id: string }>;
}

type DisputeIssueType =
  | "TIMELINE"
  | "QUALITY"
  | "PAYMENT"
  | "CONTENT_DELETED"
  | "TERMS_VIOLATION"
  | "OTHER";

interface DisputeOption {
  type: DisputeIssueType;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const DISPUTE_OPTIONS: DisputeOption[] = [
  {
    type: "TIMELINE",
    title: "Missed Deadlines & Delays",
    description: "Milestone draft or final posting is delayed beyond agreed dates without notice.",
    icon: Clock,
  },
  {
    type: "QUALITY",
    title: "Quality & Brief Mismatch",
    description: "Delivered content diverges significantly from the brief guidelines or brand voice.",
    icon: Film,
  },
  {
    type: "PAYMENT",
    title: "Payment or Milestone Conflict",
    description: "Discrepancy in milestone payout amounts or deliverables schedule.",
    icon: DollarSign,
  },
  {
    type: "CONTENT_DELETED",
    title: "Post Deleted Prematurely",
    description: "Creator removed or archived the sponsored content before the agreed retention period.",
    icon: Trash2,
  },
  {
    type: "TERMS_VIOLATION",
    title: "Terms of Service Violation",
    description: "Off-platform payment solicitation, confidentiality breach, or improper conduct.",
    icon: ShieldAlert,
  },
  {
    type: "OTHER",
    title: "Other Contractual Conflict",
    description: "Any other issue that cannot be resolved directly between brand and creator.",
    icon: FileWarning,
  },
];

export default function DealDisputePage({ params }: Readonly<DisputePageProps>) {
  const { id: dealId } = use(params);
  const router = useRouter();
  const { data: session } = useSession();

  // 3-Step Guided Wizard State (1. Issue Type -> 2. Statement & Evidence -> 3. Review & Submit)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Fetch Deal context
  const { data: dealResponse, isLoading: isDealLoading } = useSWR<{
    success: boolean;
    deal?: {
      id: string;
      amount: number;
      status: string;
      campaign?: { title: string };
      influencer?: { displayName?: string; name?: string };
      brand?: { companyName?: string; name?: string };
    };
    data?: {
      id: string;
      amount: number;
      status: string;
      campaign?: { title: string };
      influencer?: { displayName?: string; name?: string };
      brand?: { companyName?: string; name?: string };
    };
  }>(dealId ? `/api/deals/${dealId}` : null, fetcher);

  const deal = useMemo(
    () => dealResponse?.deal || dealResponse?.data || null,
    [dealResponse]
  );

  const disputeEligibility = useMemo(() => {
    type DealWithParties = {
      influencer?: { userId?: string | null };
      influencerUserId?: string | null;
      brand?: { userId?: string | null };
      brandUserId?: string | null;
    };
    const typedDeal = deal as unknown as DealWithParties;
    return checkDisputeEligibility(deal, session?.user?.id, {
      influencerUserId: typedDeal.influencer?.userId || typedDeal.influencerUserId,
      brandUserId: typedDeal.brand?.userId || typedDeal.brandUserId,
    });
  }, [deal, session?.user?.id]);

  const [issueType, setIssueType] = useState<DisputeIssueType>("TIMELINE");
  const [description, setDescription] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmSheet, setShowConfirmSheet] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const selectedOption = useMemo(
    () => DISPUTE_OPTIONS.find((opt) => opt.type === issueType) || DISPUTE_OPTIONS[0]!,
    [issueType]
  );

  const removeToast = (toastId: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== toastId));
  };

  const showToast = (type: ToastItem["type"], message: string) => {
    const id = `toast-${Date.now()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => removeToast(id), 5000);
  };

  const charCount = description.trim().length;
  const isDescriptionValid = charCount >= 50;

  const handleNextStep = () => {
    if (currentStep === 1) {
      setCurrentStep(2);
    } else if (currentStep === 2 && isDescriptionValid) {
      setCurrentStep(3);
    }
  };

  const handlePrevStep = () => {
    if (currentStep === 3) setCurrentStep(2);
    else if (currentStep === 2) setCurrentStep(1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeEligibility.allowed) {
      showToast("error", disputeEligibility.reason || "Dispute cannot be filed for this deal.");
      return;
    }
    if (!isDescriptionValid) {
      showToast("error", "Please provide at least 50 characters describing the issue.");
      return;
    }
    if (!acceptedTerms) {
      showToast("error", "You must acknowledge and accept the mediation terms.");
      return;
    }

    setShowConfirmSheet(true);
  };

  const handleConfirmedSubmit = async () => {
    setIsSubmitting(true);
    try {
      const fullDescription = evidenceUrl.trim()
        ? `${description.trim()}\n\nSupporting Evidence Link: ${evidenceUrl.trim()}`
        : description.trim();

      const validation = createDisputeSchema.safeParse({
        dealId,
        reason: fullDescription,
      });

      if (!validation.success) {
        showToast("error", validation.error.issues[0]?.message || "Invalid input.");
        setIsSubmitting(false);
        return;
      }

      await apiClient.settings.createDispute({
        dealId,
        reason: fullDescription,
      });

      setShowConfirmSheet(false);
      haptic.success();
      showToast("success", "Dispute opened. Escrow funds locked under mediation.");
      setTimeout(() => {
        router.push("/dashboard/disputes");
      }, 1500);
    } catch (err: unknown) {
      logger.error("Failed to raise dispute", { error: err, dealId });
      showToast(
        "error",
        formatUserError(err, "Failed to submit dispute. Please try again.")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardShell user={session?.user || undefined}>
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <PageContainer maxWidth="4xl" className="space-y-6 pb-20 animate-fade-in py-4 sm:py-6">
        {/* Ineligibility Alert Banner (Single-Implementation Rule) */}
        {!isDealLoading && deal && !disputeEligibility.allowed && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-destructive" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold">Dispute Ineligible</h3>
              <p className="text-xs text-destructive/90">{disputeEligibility.reason}</p>
            </div>
          </div>
        )}

        {/* Navigation Breadcrumb & Header */}
        <PageHeader
          backHref={`/dashboard/deals/${dealId}`}
          backLabel="Back to Deal Room"
          title="Raise Dispute & Mediation"
          subtitle="Escrow-backed conflict arbitration, evidence examination, and neutral platform mediation."
          badge={
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-escrow-muted text-escrow border border-escrow-border shadow-xs">
              <Zap className="w-3.5 h-3.5 shrink-0" />
              <span>Resolution ETA: 24–48 Hours</span>
            </div>
          }
          border={false}
        />

        {/* ── 3-STEP WIZARD PROGRESS STEPPER BAR ────────── */}
        <div className="bg-card border border-border rounded-2xl p-3 sm:p-4 shadow-xs">
          <div className="grid grid-cols-3 gap-1.5 sm:gap-4">
            {/* Step 1 Pill */}
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className={`flex items-center gap-2 p-2 sm:p-2.5 rounded-xl transition-all text-left cursor-pointer min-h-[44px] ${
                currentStep === 1
                  ? "bg-primary/10 border border-primary/20"
                  : "bg-muted/40 hover:bg-muted"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                  currentStep > 1
                    ? "bg-verified text-primary-foreground"
                    : currentStep === 1
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {currentStep > 1 ? <Check className="w-3.5 h-3.5" /> : "1"}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-foreground truncate">
                  1. Issue Type
                </div>
                <div className="text-[11px] text-muted-foreground truncate hidden sm:block">
                  {selectedOption.title}
                </div>
              </div>
            </button>

            {/* Step 2 Pill */}
            <button
              type="button"
              onClick={() => {
                if (currentStep === 3) setCurrentStep(2);
                else handleNextStep();
              }}
              className={`flex items-center gap-2 p-2 sm:p-2.5 rounded-xl transition-all text-left cursor-pointer min-h-[44px] ${
                currentStep === 2
                  ? "bg-primary/10 border border-primary/20"
                  : "bg-muted/40 hover:bg-muted"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                  currentStep > 2
                    ? "bg-verified text-primary-foreground"
                    : currentStep === 2
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {currentStep > 2 ? <Check className="w-3.5 h-3.5" /> : "2"}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-foreground truncate">
                  2. Evidence
                </div>
                <div className="text-[11px] text-muted-foreground truncate hidden sm:block">
                  Statement &amp; URLs
                </div>
              </div>
            </button>

            {/* Step 3 Pill */}
            <button
              type="button"
              onClick={() => {
                if (isDescriptionValid) setCurrentStep(3);
              }}
              disabled={!isDescriptionValid}
              className={`flex items-center gap-2 p-2 sm:p-2.5 rounded-xl transition-all text-left min-h-[44px] ${
                isDescriptionValid ? "cursor-pointer" : "opacity-60 cursor-not-allowed"
              } ${
                currentStep === 3
                  ? "bg-primary/10 border border-primary/20"
                  : "bg-muted/40 hover:bg-muted"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                  currentStep === 3
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                3
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-foreground truncate">
                  3. Confirm
                </div>
                <div className="text-[11px] text-muted-foreground truncate hidden sm:block">
                  Freeze Escrow
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Deal Context Preview Card */}
        <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-border/60">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Protected Contract Context
            </span>
            {deal?.amount ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-extrabold bg-escrow-muted text-escrow border border-escrow-border tabular-nums font-mono">
                <Lock className="w-3.5 h-3.5" />
                {formatCurrency(deal.amount)} in Neutral Escrow
              </span>
            ) : null}
          </div>

          {isDealLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-5 w-3/5 rounded-md" />
              <Skeleton className="h-4 w-2/5 rounded-md" />
            </div>
          ) : deal ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-heading font-bold text-foreground">
                  {deal.campaign?.title || "Campaign Collaboration"}
                </h3>
                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mt-1">
                  {deal.brand && (
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5" />
                      Brand: {deal.brand.companyName || deal.brand.name}
                    </span>
                  )}
                  {deal.influencer && (
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      Creator: {deal.influencer.displayName || deal.influencer.name}
                    </span>
                  )}
                  <span className="font-mono text-[11px]">
                    Deal #{deal.id.slice(-6).toUpperCase()}
                  </span>
                </div>
              </div>

              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground self-start sm:self-center">
                Status: {deal.status.replaceAll("_", " ")}
              </span>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              Deal #{dealId.slice(-6).toUpperCase()}
            </div>
          )}
        </div>

        {/* ── STEP 1: SELECT ISSUE CATEGORY ───────────────────────────────── */}
        {currentStep === 1 && (
          <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4 animate-fade-in">
            <div>
              <h2 className="text-base font-heading font-bold text-foreground flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-black">
                  1
                </span>
                Select Issue Category
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Choose the category that best captures the conflict. This enables the automated mediator to pull the relevant contract clauses.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {DISPUTE_OPTIONS.map((option) => {
                const IconComponent = option.icon;
                const isSelected = issueType === option.type;

                return (
                  <button
                    key={option.type}
                    type="button"
                    onClick={() => setIssueType(option.type)}
                    className={`text-left p-4 rounded-xl border transition-all flex items-start gap-3 relative cursor-pointer ${
                      isSelected
                        ? "bg-primary/5 border-primary shadow-xs"
                        : "bg-background border-border hover:border-border/80"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <IconComponent className="w-4 h-4" />
                    </div>

                    <div className="flex-1 min-w-0 pr-4">
                      <div className="text-xs font-bold text-foreground">
                        {option.title}
                      </div>
                      <div className="text-[11px] text-muted-foreground leading-normal mt-0.5">
                        {option.description}
                      </div>
                    </div>

                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-primary absolute right-3 top-3.5 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Step 1 Footer Action */}
            <div className="flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-2.5 pt-4 border-t border-border">
              <Link
                href={`/dashboard/deals/${dealId}`}
                className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground border border-border transition-colors text-center"
              >
                Cancel &amp; Return
              </Link>

              <Button
                type="button"
                variant="primary"
                onClick={handleNextStep}
                disabled={!disputeEligibility.allowed}
                title={disputeEligibility.reason}
                className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-1.5 px-5 py-2.5 text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue to Evidence (Step 2)
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 2: STATEMENT & EVIDENCE ────────────────────────────────── */}
        {currentStep === 2 && (
          <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4 animate-fade-in">
            {/* Category Confirmation Chip */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                  <selectedOption.icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-foreground">
                    Selected Issue: {selectedOption.title}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {selectedOption.description}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handlePrevStep}
                className="text-xs font-semibold text-primary hover:underline px-3 py-2 min-h-[44px] inline-flex items-center cursor-pointer"
              >
                Change
              </button>
            </div>

            <div>
              <h2 className="text-base font-heading font-bold text-foreground flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-black">
                  2
                </span>
                Provide Statement &amp; Evidence
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Provide an objective, detailed account of the issue, dates, deliverables affected, and any reference URLs.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="description-textarea" className="block text-xs font-bold text-foreground">
                  Detailed Statement &amp; Requested Remedy *
                </label>
                <Textarea
                  id="description-textarea"
                  rows={5}
                  placeholder="Detail what went wrong, which deliverables were affected, dates of communication, and what remedy you seek..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  fullWidth
                />
                <div className="flex justify-between items-center text-xs pt-1">
                  <span
                    className={`font-semibold tabular-nums font-mono ${
                      isDescriptionValid ? "text-verified" : "text-disputed"
                    }`}
                  >
                    {charCount} / 50 minimum characters required
                  </span>
                  {isDescriptionValid && (
                    <span className="text-verified flex items-center gap-1 text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Requirement satisfied
                    </span>
                  )}
                </div>
              </div>

              {/* Supporting Evidence URL Input */}
              <div className="space-y-1.5">
                <label htmlFor="evidence-url" className="block text-xs font-bold text-foreground">
                  Supporting Evidence Link (Optional)
                </label>
                <div className="relative">
                  <Paperclip className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <Input
                    id="evidence-url"
                    type="url"
                    placeholder="https://drive.google.com/... or cloud screenshot link"
                    value={evidenceUrl}
                    onChange={(e) => setEvidenceUrl(e.target.value)}
                    className="pl-10 text-xs min-h-[44px] h-11 rounded-xl"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Attach Google Drive, Dropbox, or public media links documenting unresponsiveness or guideline mismatches.
                </p>
              </div>
            </div>

            {/* Action CTAs */}
            <div className="flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-2.5 pt-4 border-t border-border">
              <Button
                type="button"
                variant="secondary"
                onClick={handlePrevStep}
                className="w-full sm:w-auto min-h-[44px] flex items-center justify-center px-4 py-2.5 text-xs font-semibold cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Back to Category
              </Button>

              <Button
                type="button"
                variant="primary"
                onClick={handleNextStep}
                disabled={!isDescriptionValid}
                className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-1.5 px-5 py-2.5 text-xs font-bold rounded-xl cursor-pointer"
              >
                Review &amp; Confirm (Step 3)
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: REVIEW & CONFIRM SUBMISSION ──────────────────────────── */}
        {currentStep === 3 && (
          <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
              <div>
                <h2 className="text-base font-heading font-bold text-foreground flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-black">
                    3
                  </span>
                  Review &amp; Confirm Dispute Room
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Review your claim summary. Submitting this dispute will lock the escrow balance into neutral arbitration.
                </p>
              </div>

              {/* Summary Card */}
              <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-3 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <span className="text-muted-foreground font-semibold">Issue Type:</span>
                  <span className="font-bold text-foreground">{selectedOption.title}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground font-semibold block">Your Statement:</span>
                  <p className="p-3 rounded-lg bg-card border border-border text-foreground leading-relaxed whitespace-pre-wrap">
                    {description}
                  </p>
                </div>
                {evidenceUrl && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-muted-foreground font-semibold">Evidence Link:</span>
                    <a
                      href={evidenceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline truncate max-w-[280px]"
                    >
                      {evidenceUrl}
                    </a>
                  </div>
                )}
              </div>

              {/* Arbitration Policy Warning */}
              <div className="bg-pending-muted/40 border border-pending-border rounded-xl p-3.5 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-pending shrink-0 mt-0.5" />
                <div className="text-xs text-foreground/90 space-y-1">
                  <strong className="font-bold text-foreground">
                    Escrow Freezing &amp; Conciliation Procedure
                  </strong>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Upon submission, deal milestone progression is immediately paused and funds are locked under platform holding. Tier 1 automated analysis will review both parties&apos; submissions and propose a binding settlement within 24–48 hours.
                  </p>
                </div>
              </div>

              {/* Terms Acknowledgment Checkbox */}
              <label className="flex items-start gap-3 cursor-pointer pt-2 select-none">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-primary/20 accent-primary"
                />
                <span className="text-xs text-muted-foreground leading-relaxed">
                  I confirm that I have attempted to resolve this directly with the other party and acknowledge that filing a dispute initiates formal escrow mediation under VyaparMedia terms.
                </span>
              </label>

              {!disputeEligibility.allowed && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-medium">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>{disputeEligibility.reason}</span>
                  </div>
                  {disputeEligibility.ctaText && disputeEligibility.ctaHref && (
                    <Link
                      href={disputeEligibility.ctaHref}
                      className="font-bold underline text-primary text-xs whitespace-nowrap"
                    >
                      {disputeEligibility.ctaText} →
                    </Link>
                  )}
                </div>
              )}

              {/* Action CTAs */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handlePrevStep}
                  className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer flex items-center justify-center"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                  Back to Evidence
                </Button>

                <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                  <Link
                    href={`/dashboard/deals/${dealId}`}
                    className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-semibold text-center bg-muted hover:bg-muted/80 text-foreground border border-border transition-colors cursor-pointer inline-flex items-center justify-center"
                  >
                    Cancel
                  </Link>

                  <Button
                    type="submit"
                    variant="danger"
                    disabled={isSubmitting || !isDescriptionValid || !acceptedTerms || !disputeEligibility.allowed}
                    title={disputeEligibility.reason}
                    className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? "Filing Dispute..." : "Submit Dispute & Freeze Escrow"}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        )}
      </PageContainer>

      {/* Dispute Raise Confirmation BottomSheet */}
      <BottomSheet
        open={showConfirmSheet}
        onClose={() => setShowConfirmSheet(false)}
        title="Confirm Formal Dispute Filing"
        description="Filing a dispute immediately freezes escrow funds and initiates platform mediation."
        maxWidth="520px"
      >
        <div className="space-y-4 pt-2">
          <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-xl p-3.5 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold">Deal Milestones Paused Immediately</p>
              <p className="text-destructive/90 leading-relaxed">
                Escrow payouts for this deal will be locked. Platform mediators will review both parties&apos; submissions within 24–48 hours.
              </p>
            </div>
          </div>

          <div className="bg-muted/50 rounded-xl p-3 border border-border space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Issue Category:</span>
              <span className="font-semibold text-foreground">{selectedOption.title}</span>
            </div>
            {deal?.amount && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Escrow Amount:</span>
                <span className="font-semibold text-foreground">{formatCurrency(deal.amount)}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowConfirmSheet(false)}
              disabled={isSubmitting}
              className="w-full sm:w-auto min-h-[44px] px-4 py-2 text-xs font-semibold rounded-xl"
            >
              Go Back
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleConfirmedSubmit}
              disabled={isSubmitting || !disputeEligibility.allowed}
              title={disputeEligibility.reason}
              className="w-full sm:w-auto min-h-[44px] px-5 py-2 text-xs font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Filing Dispute..." : "Yes, Freeze Escrow & Submit"}
            </Button>
          </div>
        </div>
      </BottomSheet>
    </DashboardShell>
  );
}
