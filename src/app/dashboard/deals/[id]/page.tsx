"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Building2,
  User,
  Lock,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Zap,
  Calendar,
  Layers,
  Star,
  FileText,
  AlertTriangle,
  ShieldAlert,
} from "lucide-react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { useTokenRefreshGuard } from "@/hooks/useTokenRefreshGuard";
import { useDealDetail, computeDealDisplay } from "@/components/dashboard/deals/useDealDetail";
import { parseContractTerms } from "@/components/dashboard/deals/DealDetailHelpers";
import { DealProgressStepper } from "@/components/dashboard/deals/DealProgressStepper";
import { EscrowTrustCard } from "@/components/dashboard/deals/EscrowTrustCard";
import { DealContextualActions } from "@/components/dashboard/deals/DealContextualActions";
import { DealDisputeSection } from "@/components/dashboard/deals/DealDisputeSection";
import { useDealRealtime } from "@/components/dashboard/deals/useDealRealtime";
import { DealContractCard } from "@/components/dashboard/deals/DealContractCard";
import { EngagementCard } from "@/components/dashboard/deals/EngagementCard";
import { ContentSubmissionsCard } from "@/components/dashboard/deals/ContentSubmissionsCard";
import { ContentSubmissionModal } from "@/components/dashboard/deals/ContentSubmissionModal";
import { DealModals } from "@/components/dashboard/deals/DealModals";
import { ContractPrintView } from "@/components/dashboard/deals/ContractPrintView";
import { Button, Skeleton, Textarea, ToastContainer, PageContainer, PageHeader } from "@/components/ui";
import { apiClient } from "@/lib/api-client";
import { formatCurrency, formatDate, formatUserError } from "@/lib/utils-client";
import { haptic } from "@/lib/haptics";
import { checkDisputeEligibility, checkReviewSubmissionEligibility } from "@/lib/action-eligibility";

// ─── Status Helpers ────────────────────────────────────────────────────────────

function DealStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    PENDING_SIGNATURE: {
      label: "Awaiting Signature",
      className: "bg-pending-muted text-pending border-pending-border",
      icon: <AlertCircle className="w-3.5 h-3.5" />,
    },
    PAYMENT_HELD: {
      label: "Escrow Locked",
      className: "bg-escrow-muted text-escrow border-escrow-border",
      icon: <Lock className="w-3.5 h-3.5" />,
    },
    ACTIVE: {
      label: "Active Deal",
      className: "bg-escrow-muted text-escrow border-escrow-border",
      icon: <Zap className="w-3.5 h-3.5" />,
    },
    CONTENT_SUBMITTED: {
      label: "Under Review",
      className: "bg-pending-muted text-pending border-pending-border",
      icon: <AlertCircle className="w-3.5 h-3.5" />,
    },
    REVISION_REQUESTED: {
      label: "Revision Requested",
      className: "bg-pending-muted text-pending border-pending-border",
      icon: <AlertCircle className="w-3.5 h-3.5" />,
    },
    CONTENT_APPROVED: {
      label: "Content Approved",
      className: "bg-verified-muted text-verified border-verified-border",
      icon: <ShieldCheck className="w-3.5 h-3.5" />,
    },
    POSTED: {
      label: "Live on Socials",
      className: "bg-verified-muted text-verified border-verified-border",
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    },
    VERIFICATION_PENDING: {
      label: "Verifying Post",
      className: "bg-pending-muted text-pending border-pending-border",
      icon: <AlertCircle className="w-3.5 h-3.5" />,
    },
    VERIFIED: {
      label: "Post Verified",
      className: "bg-verified-muted text-verified border-verified-border",
      icon: <ShieldCheck className="w-3.5 h-3.5" />,
    },
    COMPLETED: {
      label: "Completed & Settled",
      className: "bg-verified-muted text-verified border-verified-border",
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    },
    DISPUTED: {
      label: "In Arbitration",
      className: "bg-disputed-muted text-disputed border-disputed-border animate-pulse",
      icon: <AlertCircle className="w-3.5 h-3.5" />,
    },
    CANCELLED: {
      label: "Cancelled",
      className: "bg-muted text-muted-foreground border-border",
      icon: <XCircle className="w-3.5 h-3.5" />,
    },
  };

  const config = map[status] ?? {
    label: status.replace(/_/g, " "),
    className: "bg-muted text-muted-foreground border-border",
    icon: null,
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${config.className}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
}

// ─── Loading Skeleton ──────────────────────────────────────────────────────────

function DealRoomSkeleton({ user }: { user?: unknown }) {
  return (
    <DashboardShell user={user as Parameters<typeof DashboardShell>[0]["user"]}>
      <PageContainer maxWidth="6xl" className="space-y-6 pb-16 animate-pulse py-4 sm:py-6">
        {/* Header skeleton */}
        <div className="space-y-3">
          <Skeleton className="h-4 w-28 rounded-lg" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-9 w-72 sm:w-96 rounded-lg" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-32 rounded-full" />
              </div>
            </div>
            <Skeleton className="h-12 w-48 rounded-xl" />
          </div>
        </div>

        {/* Stepper skeleton */}
        <Skeleton className="h-20 w-full rounded-2xl" />

        {/* 2-column layout skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-5">
            <Skeleton className="h-64 w-full rounded-2xl" />
            <Skeleton className="h-56 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
          <div className="lg:col-span-5 space-y-5">
            <Skeleton className="h-56 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
            <Skeleton className="h-36 w-full rounded-2xl" />
          </div>
        </div>
      </PageContainer>
    </DashboardShell>
  );
}

// ─── Workroom Page Component ─────────────────────────────────

export default function DealDetailPage() {
  const { id } = useParams() as { id: string };
  const { data: session } = useSession();
  const { requireFreshSession } = useTokenRefreshGuard();
  const dealState = useDealDetail(id, session, requireFreshSession);

  const {
    deal,
    fetchDeal,
    isLoading: loading,
    error,
    isSubmitting,
    reviewRating,
    setReviewRating,
    hoverRating,
    setHoverRating,
    reviewComment,
    setReviewComment,
    reviewSubmitted,
    setReviewSubmitted,
    showAddressModal,
    setShowAddressModal,
    showReviewModal,
    setShowReviewModal,
    showSubmitModal,
    setShowSubmitModal,
    showVerifyModal,
    setShowVerifyModal,
    showDispatchModal,
    setShowDispatchModal,
    dispatchForm,
    setDispatchForm,
    handleProductAction,
    shippingAddress: shippingForm,
    setShippingAddress: setShippingForm,
    itemizedUrls: _itemizedUrls,
    setItemizedUrls,
    contentForm: _contentForm,
    setContentForm,
    postUrl,
    setPostUrl,
    itemizedReviews,
    setItemizedReviews,
    handleAction,
    handleReviewContent,
    showToast,
    setIsSubmitting,
    toasts,
    removeToast,
    engagement,
    engagementDisclaimer,
  } = dealState;

  // Supabase Realtime Subscription + Adaptive Heartbeat
  const { justUpdated } = useDealRealtime({
    dealId: id,
    currentStatus: deal?.status,
    onRefresh: () => {
      fetchDeal();
    },
    showToast,
  });

  const ratingLabelMap: Record<number, string> = {
    1: "Poor — Disappointed",
    2: "Fair — Needs improvement",
    3: "Good — Satisfactory",
    4: "Very Good — Great work",
    5: "Excellent — Outstanding!",
  };

  const isClient = session?.user?.userType === "BRAND";
  const isInfluencer = session?.user?.userType === "INFLUENCER";
  const [showContractPrint, setShowContractPrint] = React.useState(false);
  const [showTrackingModal, setShowTrackingModal] = React.useState(false);

  const disputeEligibility = React.useMemo(() => {
    if (!deal) return { allowed: false };
    return checkDisputeEligibility(deal, session?.user?.id, {
      influencerUserId: deal.influencer?.userId,
      brandUserId: deal.brand?.userId,
    });
  }, [deal, session?.user?.id]);

  const reviewEligibility = React.useMemo(() => {
    return checkReviewSubmissionEligibility(deal, reviewRating, reviewComment);
  }, [deal, reviewRating, reviewComment]);

  // ── Loading State ──────────────────────────────────────────────────────────
  if (loading) return <DealRoomSkeleton user={session?.user} />;

  // ── Error / Not Found State ────────────────────────────────────────────────
  if (error || !deal) {
    return (
      <DashboardShell user={session?.user || undefined}>
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
          <div className="max-w-md w-full p-8 rounded-2xl border border-disputed-border bg-card shadow-sm text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-disputed-muted text-disputed flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-heading font-bold text-foreground">Collaboration Deal Not Found</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {String(error || "This deal workspace could not be located or your account doesn't have authorization.")}
            </p>
            <Button href="/dashboard/deals" variant="secondary" className="w-full">
              Return to Deals Pipeline
            </Button>
          </div>
        </div>
      </DashboardShell>
    );
  }

  const terms = parseContractTerms(deal.contractTerms);
  const { canSubmitContent } = computeDealDisplay(deal, terms);

  const isEscrowLocked = [
    "PAYMENT_HELD",
    "ACTIVE",
    "CONTENT_SUBMITTED",
    "REVISION_REQUESTED",
    "CONTENT_APPROVED",
    "POSTED",
    "VERIFICATION_PENDING",
    "VERIFIED",
  ].includes(deal.status);

  const counterpartyName = isClient
    ? deal.influencer?.displayName || "Creator"
    : deal.brand?.companyName || "Brand Partner";

  return (
    <DashboardShell user={session?.user || undefined}>
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <PageContainer maxWidth="6xl" className="space-y-6 pb-20 animate-fade-in py-4 sm:py-6">

        {/* ── 1. WORKROOM HERO HEADER ─────────── */}
        <PageHeader
          backHref="/dashboard/deals"
          backLabel="All Deals Pipeline"
          title={deal.campaign?.title || "Campaign Collaboration"}
          badge={
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-md bg-muted text-foreground border border-border">
                #{deal.id.slice(-6).toUpperCase()}
              </span>
              <DealStatusBadge status={deal.status} />
            </div>
          }
          subtitle={
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mt-0.5">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-escrow" />
                <span>Escrow: <strong>{formatCurrency(deal.amount)}</strong></span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <span>Created {formatDate(deal.createdAt, undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
              </span>
            </div>
          }
          actions={
            <div className="flex items-center flex-wrap gap-2.5 sm:gap-3 shrink-0">
              <Link
                href={
                  isClient
                    ? `/dashboard/influencers/${deal.influencer?.id || ""}`
                    : `/brand/${deal.brand?.id || deal.brand?.userId || encodeURIComponent(deal.brand?.companyName || "")}`
                }
                className="flex items-center gap-3 p-2.5 px-3.5 rounded-2xl bg-card border border-border text-xs shadow-xs hover:border-primary/50 hover:bg-muted/40 transition-all cursor-pointer group w-full sm:w-auto"
                title={isClient ? "View Creator Profile" : `View ${counterpartyName} Public Profile`}
              >
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0 group-hover:scale-105 transition-transform">
                  {isClient ? <User className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <span>{isClient ? "Counterparty Creator" : "Counterparty Brand"}</span>
                    <span className="text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">↗</span>
                  </span>
                  <span className="font-bold text-foreground group-hover:text-primary transition-colors text-sm truncate block max-w-[160px]">
                    {counterpartyName}
                  </span>
                </div>
              </Link>

              {/* Contract Summary PDF CTA */}
              <button
                type="button"
                onClick={() => setShowContractPrint(true)}
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 min-h-[44px] rounded-xl bg-card border border-border text-xs font-semibold text-foreground hover:bg-muted transition-all cursor-pointer shadow-xs"
                title="View, print, or download official digital contract agreement"
              >
                <FileText className="w-3.5 h-3.5 text-primary" />
                <span>Contract PDF</span>
              </button>

              {/* Live Sync Beacon */}
              <div
                className="flex items-center gap-1.5 px-3 min-h-[44px] rounded-xl bg-muted/80 text-[11px] font-bold text-muted-foreground border border-border"
                title="Live Supabase deal synchronization active"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-verified opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-verified" />
                </span>
                <span className="hidden sm:inline">Live Sync</span>
              </div>
            </div>
          }
        />

        {/* ── 2. ESCROW TRUST BANNER ────────── */}
        <div className="p-3.5 px-4 rounded-2xl bg-escrow-muted/40 border border-escrow-border/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-escrow">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 shrink-0 text-escrow" />
            <span>
              <strong>100% Escrow Protection:</strong> Funds for this contract are securely locked in an RBI-compliant escrow account. Payout is released only upon milestone delivery and signoff.
            </span>
          </div>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-card border border-escrow-border shrink-0">
            Indian Contract Act 1872
          </span>
        </div>

        {/* ── 3. MILESTONE PROGRESS STEPPER ───────── */}
        <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-sm">
          <h2 className="text-sm font-heading font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            Milestone Delivery Pipeline
          </h2>
          <DealProgressStepper status={deal.status} justUpdated={justUpdated} />
        </div>

        {/* ── 4. TWO-COLUMN SPLIT WORKROOM (7 COLS WORKSPACE / 5 COLS SIDEBAR) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* ── LEFT COLUMN (7 COLS): WORKSPACE & SUBMISSIONS ───────────────── */}
          <div className="lg:col-span-7 flex flex-col gap-6">

            {/* Contract & Deliverables Card */}
            <DealContractCard
              deal={deal}
              isBrand={isClient}
              isInfluencer={isInfluencer}
              onOpenAddressModal={() => setShowAddressModal(true)}
              onOpenDispatchModal={() => setShowDispatchModal(true)}
              onOpenTrackingModal={() => setShowTrackingModal(true)}
              onConfirmReceived={() => handleProductAction({ action: "confirm_received" })}
              isSubmitting={isSubmitting}
            />

            {/* Submissions & Draft Vault */}
            <ContentSubmissionsCard submissions={deal.contentSubmissions} />

            {/* Engagement & Live Socials Verification */}
            <EngagementCard
              engagement={engagement}
              disclaimer={engagementDisclaimer}
              isClient={isClient}
            />

            {/* Post-Deal Feedback & Review (Shown on COMPLETED deals before review) */}
            {deal.status === "COMPLETED" && !reviewSubmitted && (
              <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4">
                <div>
                  <h3 className="font-heading font-bold text-base sm:text-lg text-foreground flex items-center gap-2">
                    <Star className="w-4 h-4 text-pending fill-pending" />
                    Rate Collaboration Performance
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    Your feedback updates the counterparty&apos;s Dynamic Reliability Score (DRS™) on VyaparMedia.
                  </p>
                </div>

                {/* 5-Star Interactive Selector */}
                <div className="flex items-center gap-1.5 py-1 flex-wrap">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                      aria-pressed={(hoverRating || reviewRating) >= star ? "true" : "false"}
                      className={`w-11 h-11 flex items-center justify-center text-3xl rounded-xl transition-transform hover:scale-110 cursor-pointer ${
                        (hoverRating || reviewRating) >= star
                          ? "text-pending fill-pending"
                          : "text-muted-foreground/30"
                      }`}
                    >
                      ★
                    </button>
                  ))}
                  {reviewRating > 0 && (
                    <span className="text-xs font-bold text-primary ml-2 px-2.5 py-1 rounded-md bg-primary/10">
                      {ratingLabelMap[reviewRating] ?? "Excellent"}
                    </span>
                  )}
                </div>

                <Textarea
                  placeholder="Share details on promptness, communication clarity, and deliverable quality..."
                  aria-label="Share your feedback"
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  rows={3}
                  className="text-sm rounded-xl"
                />

                {!reviewEligibility.allowed && reviewRating > 0 && reviewEligibility.reason && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-500 bg-amber-500/10 px-3 py-1.5 rounded-lg font-medium">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{reviewEligibility.reason}</span>
                  </div>
                )}

                <Button
                  variant="primary"
                  disabled={!reviewEligibility.allowed || isSubmitting}
                  onClick={async () => {
                    if (!reviewEligibility.allowed) return;
                    setIsSubmitting(true);
                    try {
                      await apiClient.settings.submitReview({
                        dealId: id,
                        rating: reviewRating,
                        ...(reviewComment.trim() ? { comment: reviewComment.trim() } : {}),
                      });
                      haptic.success();
                      showToast("success", "Review submitted! Trust score updated.");
                      setReviewSubmitted(true);
                    } catch (err: unknown) {
                      showToast(
                        "error",
                        formatUserError(err, "Failed to submit review. Please try again.")
                      );
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  className="font-bold disabled:opacity-50"
                >
                  {isSubmitting ? "Submitting Review..." : "Submit Official Review"}
                </Button>
              </div>
            )}

            {/* Review Submitted Confirmation */}
            {deal.status === "COMPLETED" && reviewSubmitted && (
              <div className="flex items-center gap-3.5 p-4 rounded-2xl border border-verified-border bg-verified-muted text-verified">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <div>
                  <strong className="block text-sm font-semibold">Review Confirmed</strong>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {"★".repeat(Math.max(0, reviewRating))} Feedback recorded. Thank you for fostering trust in Bharat&apos;s creator commerce ecosystem.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN (5 COLS): FINANCIAL ESCROW & ACTIONS ───────────── */}
          <div className="lg:col-span-5 flex flex-col gap-6 lg:sticky lg:top-6">

            {/* Escrow Financial Source of Truth */}
            <EscrowTrustCard
              amountInPaise={deal.amount}
              totalAmountInPaise={deal.totalAmount}
              platformFeeInPaise={deal.platformFee}
              gatewayFeeInPaise={deal.gatewayFee}
              creatorPayoutInPaise={
                typeof terms?.influencerPayout === "number"
                  ? terms.influencerPayout
                  : deal.influencerPayout || undefined
              }
              isEscrowLocked={isEscrowLocked}
              isCompleted={deal.status === "COMPLETED"}
              isDisputed={deal.status === "DISPUTED"}
              isCancelled={deal.status === "CANCELLED"}
              brandCompanyName={deal.brand?.companyName || "Brand"}
              creatorName={deal.influencer?.displayName || "Creator"}
              isBrand={isClient}
            />

            {/* Contextual Action Engine */}
            <DealContextualActions
              dealStatus={deal.status}
              dealId={deal.id}
              isInfluencer={isInfluencer}
              isBrand={isClient}
              isSubmitting={isSubmitting}
              canSubmitContent={canSubmitContent}
              deal={deal}
              handleSignContract={() => dealState.handleSignContract()}
              handleRejectInvite={() => dealState.handleRejectInvite()}
              handleCancelDeal={() => dealState.handleCancelDeal()}
              handleFundRouteEscrow={() => dealState.handleFundRouteEscrow()}
              handleAction={dealState.handleAction}
              setItemizedUrls={setItemizedUrls}
              setContentForm={setContentForm}
              setShowSubmitModal={setShowSubmitModal}
              setShowVerifyModal={setShowVerifyModal}
              setItemizedReviews={setItemizedReviews}
              setShowReviewModal={setShowReviewModal}
            />

            {/* Collabr Anti-Leak Safety Chip */}
            <div className="p-4 rounded-2xl bg-muted/40 border border-border text-xs text-muted-foreground space-y-1.5">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-verified" />
                Anti-Leak Deal Protection
              </span>
              <p className="text-[11px] leading-relaxed">
                Never accept or make off-platform payments (UPI / cash). Off-platform payments void all escrow guarantees and legal dispute coverage.
              </p>
            </div>

            {/* Dispute Resolution Center Gateway */}
            <DealDisputeSection
              dealId={deal.id}
              status={deal.status}
              isBrand={isClient}
            />
          </div>
        </div>
      </PageContainer>

      {/* ── Modals & Dialogs (Preserved 100% Contract Integrity) ─────────── */}
      <DealModals
        showAddressModal={showAddressModal}
        setShowAddressModal={setShowAddressModal}
        showReviewModal={showReviewModal}
        setShowReviewModal={setShowReviewModal}
        showVerifyModal={showVerifyModal}
        setShowVerifyModal={setShowVerifyModal}
        showDispatchModal={showDispatchModal}
        setShowDispatchModal={setShowDispatchModal}
        showTrackingModal={showTrackingModal}
        setShowTrackingModal={setShowTrackingModal}
        isBrand={isClient}
        isInfluencer={isInfluencer}
        onConfirmReceived={() => handleProductAction({ action: "confirm_received" })}
        onStatusUpdated={() => fetchDeal()}
        deal={deal}
        shippingForm={shippingForm}
        setShippingForm={setShippingForm}
        dispatchForm={dispatchForm}
        setDispatchForm={setDispatchForm}
        postUrl={postUrl}
        setPostUrl={setPostUrl}
        isSubmitting={isSubmitting}
        handleAction={handleAction}
        handleProductAction={handleProductAction}
        showToast={showToast}
        handleReviewContent={handleReviewContent}
        itemizedReviews={itemizedReviews}
        setItemizedReviews={setItemizedReviews}
      />

      {deal && (
        <ContentSubmissionModal
          isOpen={showSubmitModal}
          onClose={() => setShowSubmitModal(false)}
          deal={deal}
          onSuccess={() => {
            fetchDeal();
            showToast("success", "Content submitted for review!");
          }}
        />
      )}

      {/* Official Printable Contract Agreement Modal */}
      {showContractPrint && deal && (
        <ContractPrintView
          deal={deal}
          onClose={() => setShowContractPrint(false)}
        />
      )}

      {/* ── Persistent Raise Dispute & Mediation Footer Bar ── */}
      {deal && (
        <aside
          aria-label="Dispute Support"
          className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] md:bottom-0 left-0 right-0 z-30 bg-card/95 backdrop-blur-md border-t border-border px-4 py-3 md:pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] shadow-lg"
        >
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertTriangle className="w-4 h-4 text-pending shrink-0" />
              <span className="hidden sm:inline">
                Facing deliverable delays, quality issues, or unresponsive counterparty?
              </span>
              <span className="sm:hidden">Dispute support:</span>
            </div>
            <div className="flex items-center gap-2">
              {disputeEligibility.allowed ? (
                <Link
                  href={`/dashboard/deals/${deal.id}/dispute`}
                  className="inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-xl bg-card border border-disputed-border text-disputed font-bold hover:bg-disputed-muted/30 transition-all cursor-pointer shadow-xs"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Raise Dispute</span>
                </Link>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground hidden sm:inline max-w-xs truncate" title={disputeEligibility.reason}>
                    {disputeEligibility.reason}
                  </span>
                  {disputeEligibility.ctaText && disputeEligibility.ctaHref && (
                    <Link
                      href={disputeEligibility.ctaHref}
                      className="text-primary font-bold underline text-xs whitespace-nowrap"
                    >
                      {disputeEligibility.ctaText} →
                    </Link>
                  )}
                  <button
                    type="button"
                    disabled
                    title={disputeEligibility.reason}
                    className="inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-xl bg-muted/40 border border-border text-muted-foreground font-semibold cursor-not-allowed opacity-60 shadow-xs"
                  >
                    <ShieldAlert className="w-3.5 h-3.5 opacity-50" />
                    <span>Raise Dispute</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>
      )}
    </DashboardShell>
  );
}
