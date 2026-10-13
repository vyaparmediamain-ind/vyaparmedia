"use client";

import React, { useState, use, useCallback, useMemo } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { fetcher } from "@/lib/fetcher";
import { logger } from "@/lib/logger-client";
import { apiClient } from "@/lib/api-client";
import { formatUserError } from "@/lib/user-messages";
import { haptic } from "@/lib/haptics";
import { Button, Textarea, ToastContainer, type ToastItem, type ToastType, Skeleton, PageContainer, PageHeader } from "@/components/ui";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils-client";
import {
  DisputeDetail,
  MediatorAnalysis,
  disputeEvidenceSchema,
  disputeEscalationSchema,
} from "@/components/dashboard/disputes/DisputeHelpers";
import { DisputeTimeline } from "@/components/dashboard/disputes/DisputeTimeline";
import { DisputeEvidence } from "@/components/dashboard/disputes/DisputeEvidence";
import { DisputeAnalysisCard } from "@/components/dashboard/disputes/DisputeAnalysisCard";
import { ThreePartyArbitrationFeed } from "@/components/dashboard/disputes/ThreePartyArbitrationFeed";
import {
  Scale,
  ArrowLeft,
  Lock,
  ShieldCheck,
  Clock,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Undo2,
  FileQuestion,
  Handshake,
} from "lucide-react";

interface DisputeDetailPageProps {
  readonly params: Promise<{ readonly id: string }>;
}

export default function DisputeDetailPage({ params }: Readonly<DisputeDetailPageProps>) {
  const { id } = use(params);
  const { data: session } = useSession();
  const {
    data: disputeData,
    isLoading,
    mutate: fetchDispute,
  } = useSWR<{ dispute?: DisputeDetail; analysis?: MediatorAnalysis }>(
    id ? `/api/disputes/${id}` : null,
    fetcher
  );

  const dispute: DisputeDetail | null = disputeData?.dispute || null;

  const analysis: MediatorAnalysis | null = useMemo(() => {
    if (!disputeData) return null;
    if (disputeData.analysis) return disputeData.analysis;
    if (disputeData.dispute?.influencerOutcome || disputeData.dispute?.brandOutcome) {
      try {
        const iOutcome = JSON.parse(disputeData.dispute.influencerOutcome || "{}");
        const bOutcome = JSON.parse(disputeData.dispute.brandOutcome || "{}");
        return {
          disputeId: disputeData.dispute.id,
          tier: disputeData.dispute.tier,
          verdict: disputeData.dispute.status === "RESOLVED" ? "RESOLVED" : "PENDING",
          confidence: iOutcome.confidence || bOutcome.confidence || "HIGH",
          refundPercentage: bOutcome.refund_percentage || 0,
          influencerPayoutPercentage: iOutcome.payment_percentage || 0,
          trustScoreChanges: {
            influencer: iOutcome.trust_score_change || 0,
            brand: bOutcome.trust_score_change || 0,
          },
          explanation: disputeData.dispute.resolution || "Analysis pending",
          findings: [],
          suggestedAction: "",
          autoResolvable: false,
        };
      } catch {
        return null;
      }
    }
    return null;
  }, [disputeData]);

  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceDesc, setEvidenceDesc] = useState("");
  const [evidenceType, setEvidenceType] = useState("CONTRACT");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEvidenceForm, setShowEvidenceForm] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [escalateReason, setEscalateReason] = useState("");
  const [showEscalateForm, setShowEscalateForm] = useState(false);
  const [showSettlementForm, setShowSettlementForm] = useState(false);
  const [settlementOffer, setSettlementOffer] = useState("50");
  const [settlementNote, setSettlementNote] = useState("");
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = (toastId: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== toastId));
  };

  const showToast = useCallback((type: ToastType, message: string) => {
    const toastId = String(Date.now());
    setToasts((prev) => [...prev, { id: toastId, type, message }]);
    setTimeout(() => removeToast(toastId), 5000);
  }, []);

  const handleAddEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispute) return;

    const validation = disputeEvidenceSchema.safeParse({
      type: evidenceType,
      url: evidenceUrl,
      description: evidenceDesc,
    });

    if (!validation.success) {
      showToast("error", validation.error.issues[0]?.message || "Invalid evidence details");
      return;
    }

    setIsSubmitting(true);
    try {
      const data = (await apiClient.settings.createDispute({
        action: "add_evidence",
        disputeId: dispute.id,
        type: evidenceType,
        url: evidenceUrl,
        description: evidenceDesc,
      })) as { success?: boolean; error?: string };

      if (data?.success) {
        haptic.success();
        showToast("success", "Evidence file registered in audit vault successfully.");
        setShowEvidenceForm(false);
        setEvidenceUrl("");
        setEvidenceDesc("");
        fetchDispute();
      } else {
        showToast("error", formatUserError(data?.error, "Failed to add evidence. Please try again."));
      }
    } catch (error) {
      logger.error("[dispute-detail] Failed to add evidence:", error);
      showToast("error", formatUserError(error, "Failed to add evidence. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisputeAction = async (action: string) => {
    if (!dispute) return;
    if (action === "escalate") {
      const validation = disputeEscalationSchema.safeParse({ reason: escalateReason });
      if (!validation.success) {
        showToast("error", validation.error.issues[0]?.message || "Invalid escalation reason");
        return;
      }
    }
    setActionLoading(action);
    try {
      const data = (await apiClient.settings.patchDispute({
        disputeId: dispute.id,
        action,
        reason: action === "escalate" ? escalateReason : undefined,
      })) as { success?: boolean; message?: string; error?: string };

      if (data?.success) {
        haptic.success();
        showToast("success", data?.message || "Dispute action processed successfully.");
        setShowEscalateForm(false);
        setEscalateReason("");
        fetchDispute();
      } else {
        showToast("error", formatUserError(data?.error, "Failed to process dispute action."));
      }
    } catch (error) {
      logger.error("[dispute-detail] Failed to perform dispute action:", error);
      showToast("error", formatUserError(error, "Failed to process dispute action."));
    } finally {
      setActionLoading(null);
    }
  };

  const handleProposeSettlement = async () => {
    if (!dispute) return;
    setIsSubmitting(true);
    try {
      const statement = `[MUTUAL SETTLEMENT PROPOSAL]: Offered ${settlementOffer}% payout to creator / ${100 - Number(settlementOffer)}% refund to brand.${settlementNote.trim() ? ` Note: "${settlementNote.trim()}"` : ""}`;
      await apiClient.settings.createDispute({
        action: "add_evidence",
        disputeId: dispute.id,
        type: "CHAT_LOG",
        url: `/dashboard/disputes/${dispute.id}`,
        description: statement,
      });
      haptic.success();
      showToast("success", "Settlement proposal registered in case ledger.");
      setShowSettlementForm(false);
      setSettlementNote("");
      fetchDispute();
    } catch (err) {
      showToast("error", formatUserError(err, "Failed to submit settlement offer."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "OPEN":
      case "TIER1_AUTO":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-pending-muted text-pending border border-pending-border shrink-0 whitespace-nowrap">
            <Clock className="w-3.5 h-3.5" />
            Tier 1: Mutual Negotiation
          </span>
        );
      case "TIER2_MEDIATION":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-disputed-muted text-disputed border border-disputed-border animate-pulse shrink-0 whitespace-nowrap">
            <AlertCircle className="w-3.5 h-3.5" />
            Tier 2: Escrow Admin Mediation
          </span>
        );
      case "TIER3_ARBITRATION":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-disputed-muted text-disputed border border-disputed-border shrink-0 whitespace-nowrap">
            <Scale className="w-3.5 h-3.5" />
            Tier 3: Platform Arbitration
          </span>
        );
      case "RESOLVED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-verified-muted text-verified border border-verified-border shrink-0 whitespace-nowrap">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Resolved
          </span>
        );
      case "CLOSED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-muted text-muted-foreground border border-border shrink-0 whitespace-nowrap">
            Closed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-muted text-muted-foreground border border-border shrink-0 whitespace-nowrap">
            {status.replaceAll("_", " ")}
          </span>
        );
    }
  };

  const canTakeAction = Boolean(dispute && ["TIER1_AUTO", "OPEN"].includes(dispute.status));
  const canEscalate = Boolean(dispute && ["TIER1_AUTO", "TIER2_MEDIATION"].includes(dispute.status));
  const canWithdraw = Boolean(
    dispute &&
      dispute.status === "OPEN" &&
      dispute.raisedByUserId === (session?.user as { id?: string } | undefined)?.id
  );

  return (
    <DashboardShell user={session?.user}>
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <PageContainer maxWidth="6xl" className="space-y-6 animate-fade-in pb-16 py-4 sm:py-6">
        {/* Navigation Breadcrumb & Header */}
        <PageHeader
          title={`Dispute Room #${id ? id.slice(-6).toUpperCase() : ""}`}
          icon={<Scale className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />}
          subtitle="Formal resolution proceeding, evidence submissions, and AI mediation analysis."
          backHref="/dashboard/disputes"
          backLabel="Back to Resolution Center"
          badge={
            <div className="flex items-center gap-1.5 flex-wrap">
              {dispute && getStatusBadge(dispute.status)}
              {dispute && dispute.tier > 1 && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-muted text-foreground border border-border">
                  Tier {dispute.tier}
                </span>
              )}
            </div>
          }
          actions={
            dispute?.deal ? (
              <Button
                href={`/dashboard/deals/${dispute.deal.id}`}
                variant="secondary"
                size="sm"
                className="text-xs font-semibold gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                Open Deal Room
              </Button>
            ) : undefined
          }
        />

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <Skeleton width="40%" height={24} borderRadius={6} />
              <Skeleton width="100%" height={80} borderRadius={8} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 space-y-4">
                <Skeleton width="100%" height={220} borderRadius={16} />
              </div>
              <div className="lg:col-span-5 space-y-4">
                <Skeleton width="100%" height={220} borderRadius={16} />
              </div>
            </div>
          </div>
        )}

        {/* Dispute Not Found State */}
        {!isLoading && !dispute && (
          <div className="bg-card border border-border rounded-2xl p-12 text-center space-y-4">
            <FileQuestion className="w-12 h-12 text-muted-foreground/60 mx-auto" />
            <h2 className="text-lg font-bold text-foreground">Dispute Case Not Found</h2>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              The requested dispute case does not exist or you may not have permission to view it.
            </p>
            <Link
              href="/dashboard/disputes"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-white"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Return to Disputes Center
            </Link>
          </div>
        )}

        {/* Main Content */}
        {!isLoading && dispute && (
          <>
            {/* Neutral Escrow Protection Banner */}
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-foreground">
                    Neutral Escrow Protection Active
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {formatCurrency(dispute.deal.amount)} remains safely locked in escrow holding. No funds will be disbursed without mutual agreement or mediator order.
                  </p>
                </div>
              </div>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-extrabold bg-primary/10 text-primary border border-primary/20 tabular-nums">
                <Lock className="w-3 h-3" />
                {formatCurrency(dispute.deal.amount)} Protected
              </span>
            </div>

            {/* AI Mediator Analysis Card */}
            <DisputeAnalysisCard
              analysis={analysis}
              dispute={dispute}
              canTakeAction={canTakeAction}
              actionLoading={actionLoading}
              handleDisputeAction={handleDisputeAction}
            />

            {/* 2-Column Resolution Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column (7 cols): Case Details, Resolution & Escalations */}
              <div className="lg:col-span-7 space-y-6">
                {/* Issue Details Card */}
                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border/60">
                    <h2 className="text-base font-bold text-foreground">Issue Details</h2>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-muted text-foreground border border-border">
                      {dispute.type} Issue
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                        Campaign & Deal Contract
                      </span>
                      <Link
                        href={`/dashboard/deals/${dispute.deal.id}`}
                        className="text-sm font-bold text-primary hover:underline flex items-center gap-1.5"
                      >
                        {dispute.deal.campaign.title} ({formatCurrency(dispute.deal.amount)})
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>

                    <div>
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                        Dispute Description & Statement
                      </span>
                      <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed bg-muted/30 p-3.5 rounded-xl border border-border/60 italic">
                        "{dispute.description}"
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-muted-foreground border-t border-border/50">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        Filed on {formatDateTime(dispute.createdAt)}
                      </span>
                      <span className="font-mono text-[11px]">
                        Deal ID: #{dispute.deal.id.slice(-6).toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3-Party Arbitration Feed & Decision Timeline */}
                <ThreePartyArbitrationFeed
                  dispute={dispute}
                  analysis={analysis}
                  currentUserId={session?.user?.id}
                  onAddStatement={async (statement: string) => {
                    await apiClient.settings.createDispute({
                      action: "add_evidence",
                      disputeId: dispute.id,
                      type: "CHAT_LOG",
                      url: `/dashboard/disputes/${dispute.id}`,
                      description: statement,
                    });
                    haptic.success();
                    showToast("success", "Statement added to arbitration feed.");
                    fetchDispute();
                  }}
                />

                {/* Final Resolution Card (If Resolved) */}
                {dispute.resolution && (
                  <div className="bg-verified-muted/30 border border-verified-border rounded-2xl p-5 shadow-sm space-y-2">
                    <div className="flex items-center gap-2 text-verified">
                      <ShieldCheck className="w-5 h-5" />
                      <h2 className="text-base font-bold">Settlement Resolution Terms</h2>
                    </div>
                    <p className="text-xs sm:text-sm text-foreground leading-relaxed">
                      {dispute.resolution}
                    </p>
                    {dispute.resolvedAt && (
                      <div className="text-[11px] text-muted-foreground pt-1">
                        Finalized on {formatDate(dispute.resolvedAt)}
                      </div>
                    )}
                  </div>
                )}

                {/* Withdraw Dispute Action Card */}
                {canWithdraw && (
                  <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-3">
                    <div className="flex items-center gap-2">
                      <Undo2 className="w-4 h-4 text-disputed" />
                      <h3 className="text-sm font-bold text-foreground">Withdraw Dispute</h3>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Have you resolved the issue directly with the other party? You can withdraw this dispute. This will close the case and restore the deal to its previous milestone state.
                    </p>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        if (
                          !confirm(
                            "Withdraw this dispute? The case will be closed and escrow released back to the normal milestone schedule."
                          )
                        )
                          return;
                        handleDisputeAction("withdraw");
                      }}
                      disabled={!!actionLoading}
                      className="w-full sm:w-auto"
                    >
                      {actionLoading === "withdraw" ? "Withdrawing..." : "Withdraw Dispute Case"}
                    </Button>
                  </div>
                )}

                {/* Propose Mutual Settlement Card */}
                {dispute.status !== "RESOLVED" && dispute.status !== "CLOSED" && (
                  <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-3">
                    <div className="flex items-center gap-2">
                      <Handshake className="w-4 h-4 text-primary" />
                      <h3 className="text-sm font-bold text-foreground">
                        Propose Mutual Settlement
                      </h3>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Prefer a fast mutual compromise without waiting for formal escalation? Offer an agreed escrow split directly to the counterparty.
                    </p>

                    {showSettlementForm ? (
                      <div className="space-y-3 pt-2">
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { label: "50% / 50% Split", value: "50" },
                            { label: "75% to Creator", value: "75" },
                            { label: "100% Full Refund", value: "0" },
                          ].map((preset) => (
                            <button
                              key={preset.value}
                              type="button"
                              onClick={() => setSettlementOffer(preset.value)}
                              className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                                settlementOffer === preset.value
                                  ? "bg-primary text-primary-foreground border-primary shadow-xs font-bold"
                                  : "bg-muted text-foreground border-border hover:bg-muted/80"
                              }`}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                        <Textarea
                          rows={2}
                          placeholder="Add a settlement proposal note..."
                          value={settlementNote}
                          onChange={(e) => setSettlementNote(e.target.value)}
                          fullWidth
                        />
                        <div className="flex gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={handleProposeSettlement}
                            disabled={!settlementOffer || isSubmitting}
                            className="flex-1 cursor-pointer font-bold"
                          >
                            {isSubmitting ? "Sending Offer..." : "Send Settlement Offer"}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setShowSettlementForm(false)}
                            className="cursor-pointer"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setShowSettlementForm(true)}
                        className="w-full sm:w-auto border border-border cursor-pointer font-semibold"
                      >
                        Propose Settlement Offer
                      </Button>
                    )}
                  </div>
                )}

                {/* Escalate to Human Mediation Card */}
                {canEscalate && dispute.status !== "RESOLVED" && (
                  <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-3">
                    <div className="flex items-center gap-2">
                      <Scale className="w-4 h-4 text-pending" />
                      <h3 className="text-sm font-bold text-foreground">
                        Escalate to Human Mediation
                      </h3>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Not satisfied with the AI recommendation or unable to reach a compromise? Escalate this case to{" "}
                      <strong className="text-foreground">
                        {dispute.tier === 1 ? "Human Mediation (Tier 2)" : "Arbitration (Tier 3)"}
                      </strong>
                      . A neutral platform adjudicator will step in to inspect all evidence files.
                    </p>

                    {showEscalateForm ? (
                      <div className="space-y-3 pt-2">
                        <Textarea
                          rows={3}
                          placeholder="State why you are requesting escalation and what specific outcome you seek..."
                          value={escalateReason}
                          onChange={(e) => setEscalateReason(e.target.value)}
                          fullWidth
                        />
                        <div className="flex gap-2">
                          <Button
                            variant="warning"
                            size="sm"
                            onClick={() => handleDisputeAction("escalate")}
                            disabled={!escalateReason.trim() || !!actionLoading}
                            className="flex-1"
                          >
                            {actionLoading === "escalate"
                              ? "Escalating..."
                              : `Submit Escalation (Tier ${dispute.tier + 1})`}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setShowEscalateForm(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setShowEscalateForm(true)}
                        className="w-full sm:w-auto border border-border"
                      >
                        Request Case Escalation
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Right Column (5 cols): Timeline & Evidence Vault */}
              <div className="lg:col-span-5 space-y-6">
                <DisputeTimeline dispute={dispute} />
                <DisputeEvidence
                  dispute={dispute}
                  showEvidenceForm={showEvidenceForm}
                  setShowEvidenceForm={setShowEvidenceForm}
                  evidenceType={evidenceType}
                  setEvidenceType={setEvidenceType}
                  evidenceUrl={evidenceUrl}
                  setEvidenceUrl={setEvidenceUrl}
                  evidenceDesc={evidenceDesc}
                  setEvidenceDesc={setEvidenceDesc}
                  onSubmit={handleAddEvidence}
                  isSubmitting={isSubmitting}
                />
              </div>
            </div>
          </>
        )}
      </PageContainer>
    </DashboardShell>
  );
}
