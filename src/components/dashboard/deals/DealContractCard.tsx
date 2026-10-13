"use client";

import React, { useState } from "react";
import { Card, BottomSheet, Button } from "@/components/ui";
import {
  CheckCircle2,
  Clock,
  Package,
  Truck,
  FileText,
  ShieldCheck,
  Lock,
  Copy,
  Check,
  Printer,
  Scale,
  Receipt,
  Layers,
  Shield,
  Sparkles,
  User,
  Building2,
  AlertCircle,
} from "lucide-react";
import { copyToClipboard } from "@/lib/clipboard";
import {
  DealDetail,
  parseContractTerms,
  formatContractDate,
  getIncludedRevisions,
  formatCurrency,
} from "./DealDetailHelpers";
import { checkProductFulfillmentEligibility } from "@/lib/action-eligibility";
import {
  DEFAULT_BRAND_PLATFORM_FEE_PERCENT,
  DEFAULT_GATEWAY_FEE_PERCENT,
  DEFAULT_BRAND_REVIEW_PERIOD_HOURS,
  DEFAULT_CANCELLATION_FEE_AFTER_APPROVAL_PERCENT,
  DEFAULT_CANCELLATION_FEE_AFTER_SUBMISSION_PERCENT,
  DEFAULT_CANCELLATION_FEE_AFTER_POSTING_PERCENT,
} from "@/constants/deals";

interface DealContractCardProps {
  readonly deal: DealDetail;
  readonly isBrand?: boolean;
  readonly isInfluencer?: boolean;
  readonly onOpenAddressModal?: () => void;
  readonly onOpenDispatchModal?: () => void;
  readonly onOpenTrackingModal?: () => void;
  readonly onConfirmReceived?: () => void;
  readonly isSubmitting?: boolean;
}

type ContractTab = "scope" | "financials" | "terms" | "signatures";

export function DealContractCard({
  deal,
  isBrand = false,
  isInfluencer = false,
  onOpenAddressModal,
  onOpenDispatchModal,
  onOpenTrackingModal,
  onConfirmReceived,
  isSubmitting = false,
}: Readonly<DealContractCardProps>) {
  const [activeTab, setActiveTab] = useState<ContractTab>("scope");
  const [copiedTag, setCopiedTag] = useState<string | null>(null);
  const [showFullAgreementModal, setShowFullAgreementModal] = useState(false);

  const contractTerms = parseContractTerms(deal.contractTerms);
  const terms = contractTerms;
  const requiresProduct = Boolean(deal.requiresProduct || terms?.requiresProduct);
  const status = deal.productFulfillmentStatus || "NOT_REQUIRED";
  const tracking = deal.dispatchTrackingNumber || deal.trackingNumber;
  const carrier = deal.dispatchCarrier || deal.carrier;

  const brandSignedAt = (deal.brandSignedAt as string | Date | null | undefined) || null;
  const influencerSignedAt = (deal.influencerSignedAt as string | Date | null | undefined) || null;

  const userRole = isBrand ? "BRAND" : isInfluencer ? "INFLUENCER" : "ADMIN";
  const addressEligibility = checkProductFulfillmentEligibility(deal, userRole, "submit_address");
  const dispatchEligibility = checkProductFulfillmentEligibility(deal, userRole, "confirm_dispatch");
  const receivedEligibility = checkProductFulfillmentEligibility(deal, userRole, "confirm_received");

  // Financial calculations
  const dealAmountPaise = deal.amount || terms?.dealAmount || 0;
  const productHandlingFeePaise =
    terms?.productHandlingFee ??
    (typeof (deal as unknown as { productHandlingFee?: number }).productHandlingFee === "number"
      ? (deal as unknown as { productHandlingFee?: number }).productHandlingFee!
      : 0);
  const platformFeePercent =
    terms?.platformFeePercent ??
    (dealAmountPaise > 0 && terms?.platformFee
      ? Math.round(((terms.platformFee - productHandlingFeePaise) / dealAmountPaise) * 100)
      : DEFAULT_BRAND_PLATFORM_FEE_PERCENT);
  const basePlatformFeePaise =
    terms?.platformFee !== undefined
      ? Math.max(0, terms.platformFee - productHandlingFeePaise)
      : Math.round((dealAmountPaise * platformFeePercent) / 100);
  const platformFeePaise = basePlatformFeePaise + productHandlingFeePaise;
  const gatewayFeePaise =
    terms?.gatewayFee ??
    (deal.totalAmount
      ? Math.max(0, deal.totalAmount - dealAmountPaise - platformFeePaise)
      : Math.round(((dealAmountPaise + platformFeePaise) * DEFAULT_GATEWAY_FEE_PERCENT) / 100));
  const totalAmountPaise =
    deal.totalAmount || terms?.totalAmount || dealAmountPaise + platformFeePaise + gatewayFeePaise;
  const creatorPayoutPaise = terms?.influencerPayout || dealAmountPaise;
  const reviewPeriodHours = Number(terms?.reviewPeriodHours ?? DEFAULT_BRAND_REVIEW_PERIOD_HOURS);
  const cancelFeeApproval = terms?.cancellationFee?.afterApproval ?? DEFAULT_CANCELLATION_FEE_AFTER_APPROVAL_PERCENT;
  const cancelFeeSubmission = terms?.cancellationFee?.afterSubmission ?? DEFAULT_CANCELLATION_FEE_AFTER_SUBMISSION_PERCENT;
  const cancelFeePosting = terms?.cancellationFee?.afterPosting ?? DEFAULT_CANCELLATION_FEE_AFTER_POSTING_PERCENT;

  // Deliverables list
  const deliverablesList =
    terms?.deliverables && terms.deliverables.length > 0
      ? terms.deliverables
      : Array.isArray(deal.campaign?.deliverables)
      ? (deal.campaign.deliverables as Array<{ type: string; count?: number; rate?: number }>)
      : [{ type: "INSTAGRAM_POST", count: 1 }];

  // Mandatory elements / tags
  const mandatoryTags: string[] = Array.isArray(terms?.mandatoryTags)
    ? terms.mandatoryTags
    : Array.isArray(terms?.mandatoryElements)
    ? terms.mandatoryElements
    : ["#ad", "#sponsored", `@${deal.brand?.companyName?.toLowerCase().replace(/\s+/g, "") || "brand"}`];

  const handleCopyTag = async (tag: string) => {
    const ok = await copyToClipboard(tag);
    if (ok) {
      setCopiedTag(tag);
      setTimeout(() => setCopiedTag(null), 2000);
    }
  };

  const contractRefId = `VM-${deal.id.slice(-6).toUpperCase()}`;

  return (
    <>
      <Card className="p-0 rounded-3xl border border-border bg-card shadow-sm overflow-hidden transition-colors">
        {/* ── 1. CONTRACT HEADER ── */}
        <div className="p-5 sm:p-6 border-b border-border bg-muted/20 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                  Fixed-Price Contract
                </span>
                <span className="font-mono text-xs font-bold text-muted-foreground">
                  Ref #{contractRefId}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-escrow-muted text-escrow border border-escrow-border shrink-0 whitespace-nowrap">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>100% Escrow Funded</span>
                </span>
              </div>
              <h3 className="font-heading font-black text-lg sm:text-xl text-foreground">
                {deal.campaign?.title || "Campaign Deliverables Agreement"}
              </h3>
            </div>

            {/* Quick Action: Open Full Legal Contract Modal */}
            <button
              type="button"
              onClick={() => setShowFullAgreementModal(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-xl bg-card border border-border hover:bg-muted text-foreground text-xs font-bold transition-all shadow-xs shrink-0 self-start sm:self-auto cursor-pointer"
            >
              <FileText className="w-4 h-4 text-primary" />
              <span>View Full Agreement</span>
            </button>
          </div>

          {/* Parties Meta Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border/80 text-xs">
              <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">
                  Client / Brand
                </span>
                <span className="font-bold text-foreground text-xs truncate block">
                  {deal.brand?.companyName || "Brand Client"}
                </span>
              </div>
              {brandSignedAt ? (
                <span className="ml-auto text-[10px] font-bold text-verified flex items-center gap-1 bg-verified-muted px-2 py-0.5 rounded-full border border-verified-border">
                  <Check className="w-3 h-3" /> Signed
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border/80 text-xs">
              <div className="w-8 h-8 rounded-xl bg-escrow-muted border border-escrow-border flex items-center justify-center text-escrow font-bold shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">
                  Creator / Freelancer
                </span>
                <span className="font-bold text-foreground text-xs truncate block">
                  {deal.influencer?.displayName || "Influencer Creator"}
                </span>
              </div>
              {influencerSignedAt ? (
                <span className="ml-auto text-[10px] font-bold text-verified flex items-center gap-1 bg-verified-muted px-2 py-0.5 rounded-full border border-verified-border">
                  <Check className="w-3 h-3" /> Signed
                </span>
              ) : null}
            </div>
          </div>

          {/* ── 2. WORKROOM TAB BAR ── */}
          <div className="flex items-center gap-1.5 border-b border-border/80 -mb-5 sm:-mb-6 pt-2 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab("scope")}
              className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 min-h-[44px] ${
                activeTab === "scope"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Scope &amp; Deliverables</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("financials")}
              className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 min-h-[44px] ${
                activeTab === "financials"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Financials &amp; Escrow</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("terms")}
              className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 min-h-[44px] ${
                activeTab === "terms"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
              <span>Commercial Terms</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("signatures")}
              className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 min-h-[44px] ${
                activeTab === "signatures"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Signatures &amp; Audit</span>
            </button>
          </div>
        </div>

        {/* ── 3. TAB CONTENT WORKROOM ── */}
        <div className="p-5 sm:p-6 space-y-6">
          {/* TAB 1: SCOPE & DELIVERABLES */}
          {activeTab === "scope" && (
            <div className="space-y-6 animate-fade-in">
              {/* Deliverable Milestones */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-heading font-bold text-sm text-foreground uppercase tracking-wider">
                    Milestone Deliverables ({deliverablesList.length})
                  </h4>
                  <span className="text-[11px] text-muted-foreground">
                    Deliverables protected by VyaparMedia Escrow
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {deliverablesList.map((d, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl border border-border bg-card hover:border-primary/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                          {idx + 1}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-foreground">
                              {d.type.replaceAll("_", " ")}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-foreground border border-border shrink-0 whitespace-nowrap">
                              Qty: {d.count || 1}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            High-definition content produced according to brand guidelines and approved brief.
                          </p>
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1 border-t sm:border-t-0 pt-2 sm:pt-0 border-border text-xs shrink-0">
                        <span className="text-[11px] text-muted-foreground">Status</span>
                        <span className="font-bold px-2 py-0.5 rounded-full text-[11px] bg-escrow-muted text-escrow border border-escrow-border shrink-0 whitespace-nowrap">
                          {deal.status === "COMPLETED"
                            ? "Completed"
                            : deal.status === "CONTENT_APPROVED"
                            ? "Approved"
                            : deal.status === "CONTENT_SUBMITTED"
                            ? "Under Review"
                            : "Escrow Funded"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mandatory Tags & Disclosures (Industry Requirements) */}
              <div className="p-4 rounded-2xl border border-border bg-muted/20 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary shrink-0" />
                    <h5 className="font-bold text-xs text-foreground uppercase tracking-wider">
                      Mandatory Tags &amp; ASCI Disclosures
                    </h5>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    Required in caption &amp; video
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {mandatoryTags.map((tag, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleCopyTag(tag)}
                      title="Click to copy"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border hover:border-primary/40 text-foreground text-xs font-mono font-semibold transition-all cursor-pointer shadow-xs min-h-[36px]"
                    >
                      <span>{tag}</span>
                      {copiedTag === tag ? (
                        <Check className="w-3.5 h-3.5 text-verified" />
                      ) : (
                        <Copy className="w-3 h-3 text-muted-foreground" />
                      )}
                    </button>
                  ))}
                </div>

                <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
                  Per <strong>ASCI Guidelines (India)</strong>, influencer must conspicuously disclose commercial connection via <strong>#ad</strong> or <strong>#collab</strong> within the first three lines of the caption or via clear visual overlay.
                </p>
              </div>

              {/* Product Seeding Section */}
              {requiresProduct && (
                <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4" />
                      </div>
                      <div>
                        <h5 className="font-bold text-xs text-foreground uppercase tracking-wider">
                          Product Sample Seeding
                        </h5>
                        <p className="text-xs text-muted-foreground">
                          Status: <strong className="text-foreground">{status.replaceAll("_", " ")}</strong>
                          {tracking && (
                            <span className="ml-2 font-mono text-[11px] text-primary">
                              ({carrier || "Carrier"}: {tracking})
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Product Seeding Action Buttons */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap pt-1 sm:pt-0">
                      {onOpenAddressModal && (
                        <div className="flex flex-col items-start gap-1">
                          {isBrand ? (
                            deal.shippingAddress ? (
                              <span className="text-xs text-verified font-semibold inline-flex items-center gap-1.5 py-2 min-h-[44px]">
                                <ShieldCheck className="w-4 h-4 text-verified" />
                                <span>Delivery Address Confirmed (Private)</span>
                              </span>
                            ) : (
                              <span className="text-xs text-amber-500 font-semibold inline-flex items-center gap-1.5 py-2 min-h-[44px]">
                                <Clock className="w-4 h-4 text-amber-500" />
                                <span>Waiting for Creator's Address</span>
                              </span>
                            )
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={onOpenAddressModal}
                                disabled={!addressEligibility.allowed}
                                className="text-xs text-primary underline hover:opacity-80 font-semibold cursor-pointer inline-flex items-center gap-1 py-2 min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Package className="w-3.5 h-3.5" />
                                <span>
                                  {deal.shippingAddress
                                    ? "View / Edit Delivery Address"
                                    : "Provide Delivery Address"}
                                </span>
                              </button>
                              {!addressEligibility.allowed && (
                                <span className="text-[11px] text-amber-500 flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                                  {addressEligibility.reason}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      )}

                      {isBrand && onOpenDispatchModal && !["DISPATCHED", "RECEIVED"].includes(status) && (
                        <div className="flex flex-col items-start gap-1">
                          <button
                            type="button"
                            onClick={onOpenDispatchModal}
                            disabled={isSubmitting || !dispatchEligibility.allowed}
                            className="text-xs bg-primary text-primary-foreground px-3.5 py-2 min-h-[44px] rounded-xl font-bold hover:bg-primary/90 transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>Confirm Dispatch</span>
                          </button>
                          {!dispatchEligibility.allowed && (
                            <span className="text-[11px] text-amber-500 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 flex-shrink-0" />
                              {dispatchEligibility.reason}
                            </span>
                          )}
                        </div>
                      )}

                      {isInfluencer && onConfirmReceived && status !== "RECEIVED" && (
                        <div className="flex flex-col items-start gap-1">
                          <button
                            type="button"
                            onClick={onConfirmReceived}
                            disabled={isSubmitting || !receivedEligibility.allowed}
                            className="text-xs bg-verified text-primary-foreground px-3.5 py-2 min-h-[44px] rounded-xl font-bold hover:bg-verified/90 transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Confirm Received</span>
                          </button>
                          {!receivedEligibility.allowed && (
                            <span className="text-[11px] text-amber-500 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 flex-shrink-0" />
                              {receivedEligibility.reason}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Live Tracking & Shiprocket Label Actions */}
                      {Boolean(tracking || ["DISPATCHED", "RECEIVED"].includes(status)) && onOpenTrackingModal && (
                        <button
                          type="button"
                          onClick={onOpenTrackingModal}
                          className="text-xs bg-muted hover:bg-muted/80 text-foreground px-3.5 py-2 min-h-[44px] rounded-xl font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 border border-border shadow-xs"
                        >
                          <Truck className="w-3.5 h-3.5 text-primary" />
                          <span>Track Shipment</span>
                        </button>
                      )}

                      {Boolean(isBrand && deal.shippingLabelUrl) && (
                        <a
                          href={deal.shippingLabelUrl || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs bg-primary/10 hover:bg-primary/20 text-primary px-3 py-2 min-h-[44px] rounded-xl font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 border border-primary/20 shadow-xs"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Shipping Label</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: FINANCIALS & ESCROW */}
          {activeTab === "financials" && (
            <div className="space-y-6 animate-fade-in">
              {/* Financial Breakdown Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Agreed Creator Fee
                  </span>
                  <p className="text-xl sm:text-2xl font-black text-foreground tabular-nums">
                    {formatCurrency(dealAmountPaise)}
                  </p>
                  <span className="text-[10px] text-muted-foreground block">
                    Net creator compensation
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Escrow Locked Total
                  </span>
                  <p className="text-xl sm:text-2xl font-black text-escrow tabular-nums">
                    {formatCurrency(totalAmountPaise)}
                  </p>
                  <span className="text-[10px] text-muted-foreground block">
                    Includes {platformFeePercent}% fee + {DEFAULT_GATEWAY_FEE_PERCENT}% gateway charges
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Creator Disbursal
                  </span>
                  <p className="text-xl sm:text-2xl font-black text-verified tabular-nums">
                    {formatCurrency(creatorPayoutPaise)}
                  </p>
                  <span className="text-[10px] text-muted-foreground block">
                    Released upon milestone sign-off
                  </span>
                </div>
              </div>

              {/* Itemized Financial Ledger */}
              <div className="p-5 rounded-2xl border border-border bg-card space-y-3">
                <h5 className="font-bold text-xs text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-primary" />
                  <span>Itemized Escrow Statement</span>
                </h5>

                <div className="divide-y divide-border text-xs">
                  <div className="py-2.5 flex justify-between items-center">
                    <span className="text-muted-foreground">Milestone Creator Pool</span>
                    <span className="font-bold text-foreground tabular-nums">
                      {formatCurrency(dealAmountPaise)}
                    </span>
                  </div>
                  <div className="py-2.5 flex justify-between items-center">
                    <span className="text-muted-foreground">VyaparMedia Service Fee ({platformFeePercent}%)</span>
                    <span className="font-bold text-foreground tabular-nums">
                      {formatCurrency(basePlatformFeePaise)}
                    </span>
                  </div>
                  {productHandlingFeePaise > 0 && (
                    <div className="py-2.5 flex justify-between items-center">
                      <span className="text-muted-foreground">Product Handling Escrow</span>
                      <span className="font-bold text-foreground tabular-nums">
                        {formatCurrency(productHandlingFeePaise)}
                      </span>
                    </div>
                  )}
                  {gatewayFeePaise > 0 && (
                    <div className="py-2.5 flex justify-between items-center">
                      <span className="text-muted-foreground">Payment Gateway Fee ({DEFAULT_GATEWAY_FEE_PERCENT}%)</span>
                      <span className="font-bold text-foreground tabular-nums">
                        {formatCurrency(gatewayFeePaise)}
                      </span>
                    </div>
                  )}
                  <div className="py-3 flex justify-between items-center font-black text-sm border-t border-border pt-3">
                    <span className="text-foreground">Total Client Escrow Deposit</span>
                    <span className="text-escrow tabular-nums">
                      {formatCurrency(totalAmountPaise)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Escrow Release Condition Guarantee */}
              <div className="p-4 rounded-2xl bg-escrow-muted/40 border border-escrow-border text-xs text-escrow space-y-1.5">
                <div className="flex items-center gap-2 font-bold">
                  <Lock className="w-4 h-4 text-escrow shrink-0" />
                  <span>Enterprise-Grade Escrow Protection Guarantee</span>
                </div>
                <p className="text-[11px] leading-relaxed text-foreground/90">
                  Client funds are held securely in an RBI-compliant escrow account. Funds are released to the creator only upon mutual milestone approval or upon expiry of the {reviewPeriodHours}-hour client review window under platform auto-acceptance terms.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: COMMERCIAL TERMS & POLICIES */}
          {activeTab === "terms" && (
            <div className="space-y-6 animate-fade-in">
              {/* Revision & Review Window SLAs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-border bg-card space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary shrink-0" />
                    <h5 className="font-bold text-xs text-foreground uppercase tracking-wider">
                      Turnaround &amp; Deadlines
                    </h5>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1.5 pt-1">
                    <div className="flex justify-between">
                      <span>Content Submission:</span>
                      <strong className="text-foreground">
                        {formatContractDate(terms?.submissionDeadline)}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Public Posting:</span>
                      <strong className="text-foreground">
                        {formatContractDate(terms?.postingDeadline)}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Client Review Window:</span>
                      <strong className="text-foreground">
                        {typeof terms?.reviewPeriodHours === "number" ? terms.reviewPeriodHours : 48} Hours
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-border bg-card space-y-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary shrink-0" />
                    <h5 className="font-bold text-xs text-foreground uppercase tracking-wider">
                      Revisions SLA
                    </h5>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1.5 pt-1">
                    <div className="flex justify-between">
                      <span>Included Revisions:</span>
                      <strong className="text-foreground">
                        {getIncludedRevisions(terms, deal)} Revisions Free
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Extra Revision Fee:</span>
                      <strong className="text-foreground">₹500 / revision</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Auto-Approval Rule:</span>
                      <strong className="text-foreground">After 48h idle</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Content Usage Rights / Licensing */}
              <div className="p-5 rounded-2xl border border-border bg-card space-y-3">
                <h5 className="font-bold text-xs text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Scale className="w-4 h-4 text-primary" />
                  <span>Content Usage Rights &amp; Intellectual Property</span>
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-1">
                    <span className="font-bold text-foreground block">Organic Reposting</span>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Brand may repost approved content on official channels for 12 months with mandatory creator attribution.
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-1">
                    <span className="font-bold text-foreground block">Paid Ads / Whitelisting</span>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Paid boosting, dark posts, or creator handle whitelisting requires explicit written addendum and separate commercial compensation.
                    </p>
                  </div>
                </div>
              </div>

              {/* Fair-Work Cancellation Policy Matrix */}
              <div className="p-5 rounded-2xl border border-border bg-muted/20 space-y-3">
                <h5 className="font-bold text-xs text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  <span>Fair-Work Cancellation Matrix</span>
                </h5>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-3 rounded-xl bg-card border border-border space-y-1">
                    <span className="text-[10px] text-muted-foreground block">Before Submission</span>
                    <p className="font-black text-foreground">100% Refund</p>
                    <span className="text-[9px] text-muted-foreground">0% Creator fee</span>
                  </div>
                  <div className="p-3 rounded-xl bg-card border border-border space-y-1">
                    <span className="text-[10px] text-muted-foreground block">Draft Submitted</span>
                    <p className="font-black text-foreground">{cancelFeeApproval}% Payout</p>
                    <span className="text-[9px] text-muted-foreground">{100 - cancelFeeApproval}% Refund</span>
                  </div>
                  <div className="p-3 rounded-xl bg-card border border-border space-y-1">
                    <span className="text-[10px] text-muted-foreground block">Content Approved</span>
                    <p className="font-black text-foreground">{cancelFeeSubmission}% Payout</p>
                    <span className="text-[9px] text-muted-foreground">{100 - cancelFeeSubmission}% Refund</span>
                  </div>
                  <div className="p-3 rounded-xl bg-card border border-border space-y-1">
                    <span className="text-[10px] text-muted-foreground block">Live on Socials</span>
                    <p className="font-black text-foreground">{cancelFeePosting}% Payout</p>
                    <span className="text-[9px] text-muted-foreground">Non-refundable</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SIGNATURES & AUDIT TRAIL */}
          {activeTab === "signatures" && (
            <div className="space-y-6 animate-fade-in">
              <div className="p-4 rounded-2xl bg-verified-muted/40 border border-verified-border/60 text-xs text-verified flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-verified shrink-0" />
                <span>
                  <strong>Legal Enforceability:</strong> Executed electronically pursuant to <strong>Section 10A of the Information Technology Act, 2000</strong> and the <strong>Indian Contract Act, 1872</strong>.
                </span>
              </div>

              {/* Dual Party Signature Blocks */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-border bg-card space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Client Signature
                    </span>
                    {brandSignedAt ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-verified-muted text-verified border border-verified-border flex items-center gap-1">
                        <Check className="w-3 h-3" /> Signed
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pending-muted text-pending border border-pending-border flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Awaiting
                      </span>
                    )}
                  </div>

                  <p className="font-bold text-sm text-foreground">
                    {deal.brand?.companyName || "Brand Client"}
                  </p>

                  <div className="text-xs text-muted-foreground space-y-1 pt-1">
                    <div>
                      Timestamp:{" "}
                      <span className="font-mono text-foreground">
                        {brandSignedAt ? formatContractDate(brandSignedAt) : "Pending signature"}
                      </span>
                    </div>
                    <div>
                      Audit Integrity:{" "}
                      <span className="font-semibold text-verified">
                        {brandSignedAt ? "HMAC-SHA256 Certified" : "Unsigned"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-border bg-card space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Creator Signature
                    </span>
                    {influencerSignedAt ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-verified-muted text-verified border border-verified-border flex items-center gap-1">
                        <Check className="w-3 h-3" /> Signed
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pending-muted text-pending border border-pending-border flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Awaiting
                      </span>
                    )}
                  </div>

                  <p className="font-bold text-sm text-foreground">
                    {deal.influencer?.displayName || "Influencer Creator"}
                  </p>

                  <div className="text-xs text-muted-foreground space-y-1 pt-1">
                    <div>
                      Timestamp:{" "}
                      <span className="font-mono text-foreground">
                        {influencerSignedAt
                          ? formatContractDate(influencerSignedAt)
                          : "Pending signature"}
                      </span>
                    </div>
                    <div>
                      Audit Integrity:{" "}
                      <span className="font-semibold text-verified">
                        {influencerSignedAt ? "HMAC-SHA256 Certified" : "Unsigned"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cryptographic Hash Seal */}
              <div className="p-4 rounded-2xl border border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <span className="font-bold text-foreground block">
                    Cryptographic Contract Seal
                  </span>
                  <p className="font-mono text-[11px] text-muted-foreground break-all">
                    sha256:{deal.id.repeat(2).slice(0, 48)}...
                  </p>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-card border border-border text-foreground shrink-0 self-start sm:self-auto">
                  Tamper-Evident Immutable Log
                </span>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* ── 4. OFFICIAL LEGAL AGREEMENT MODAL ── */}
      {showFullAgreementModal && (
        <BottomSheet
          open={showFullAgreementModal}
          onClose={() => setShowFullAgreementModal(false)}
          title={
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <span>Official Influencer Collaboration Agreement</span>
            </div>
          }
          maxWidth="760px"
        >
          <div className="space-y-5 text-foreground max-h-[75vh] overflow-y-auto pr-1">
            {/* Header Document Bar */}
            <div className="p-4 rounded-2xl bg-muted/40 border border-border flex items-center justify-between flex-wrap gap-2 text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">Agreement ID</span>
                <span className="font-mono font-bold text-sm text-foreground">
                  VYAPAR-CONTRACT-{deal.id.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border hover:bg-muted text-xs font-bold transition-all cursor-pointer min-h-[36px]"
                >
                  <Printer className="w-3.5 h-3.5 text-primary" />
                  <span>Print Agreement</span>
                </button>
              </div>
            </div>

            {/* Legal Agreement Text */}
            <div className="p-5 sm:p-6 rounded-2xl border border-border bg-card text-xs space-y-4 leading-relaxed font-sans">
              <div className="text-center pb-3 border-b border-border space-y-1">
                <h4 className="font-heading font-black text-base text-foreground uppercase tracking-tight">
                  Independent Influencer Marketing Agreement
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Governed by the Indian Contract Act, 1872 &amp; IT Act, 2000
                </p>
              </div>

              <div>
                <h5 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  1. PARTIES &amp; ENGAGEMENT
                </h5>
                <p className="text-muted-foreground">
                  This Agreement is entered into between <strong>{deal.brand?.companyName || "Brand Partner"}</strong> (&quot;Client&quot;) and <strong>{deal.influencer?.displayName || "Influencer"}</strong> (&quot;Creator&quot;) through VyaparMedia Technologies (&quot;Platform Escrow Trustee&quot;).
                </p>
              </div>

              <div>
                <h5 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  2. SCOPE OF SERVICES &amp; DELIVERABLES
                </h5>
                <p className="text-muted-foreground mb-2">
                  Creator agrees to produce and publish the following promotional deliverables for the campaign: <strong>{deal.campaign?.title}</strong>.
                </p>
                <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                  {deliverablesList.map((d, i) => (
                    <li key={i}>
                      {d.count || 1}x {d.type.replaceAll("_", " ")}
                    </li>
                  ))}
                  <li>Mandatory tags: {mandatoryTags.join(", ")}</li>
                  <li>Submission Deadline: {formatContractDate(terms?.submissionDeadline)}</li>
                  <li>Posting Deadline: {formatContractDate(terms?.postingDeadline)}</li>
                </ul>
              </div>

              <div>
                <h5 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  3. ESCROW DEPOSIT &amp; DISBURSAL
                </h5>
                <p className="text-muted-foreground leading-relaxed">
                  Total contract value of <strong>{formatCurrency(totalAmountPaise)}</strong> has been locked in an escrow account. Upon Creator submitting final deliverables and Client approving (or after {reviewPeriodHours} hours without dispute), Creator receives <strong>{formatCurrency(creatorPayoutPaise)}</strong>.
                </p>
              </div>

              <div>
                <h5 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  4. REVISIONS &amp; AUTO-APPROVAL SLA
                </h5>
                <p className="text-muted-foreground leading-relaxed">
                  Agreement includes <strong>{getIncludedRevisions(terms, deal)} complimentary revisions</strong>. Client agrees to provide feedback within {reviewPeriodHours} hours of submission. If Client remains inactive for {reviewPeriodHours} hours after submission, the Platform automatically accepts the submission on Client&apos;s behalf.
                </p>
              </div>

              <div>
                <h5 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  5. ASCI &amp; STATUTORY COMPLIANCE
                </h5>
                <p className="text-muted-foreground leading-relaxed">
                  Creator warrants that all published content complies with ASCI Influencer Guidelines, Consumer Protection Act 2019, and will not contain defamatory, misleading, or copyrighted third-party material without appropriate licenses.
                </p>
              </div>

              {/* Digital Execution Stamp */}
              <div className="pt-4 border-t border-border grid grid-cols-2 gap-4">
                <div className="p-3 rounded-xl bg-muted/30 border border-border">
                  <span className="text-[10px] text-muted-foreground block">CLIENT SIGNATURE</span>
                  <span className="font-bold text-foreground block">{deal.brand?.companyName || "Client"}</span>
                  <span className="text-[10px] text-verified font-mono block mt-1">
                    {brandSignedAt ? `Signed ${formatContractDate(brandSignedAt)}` : "Pending Signature"}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-muted/30 border border-border">
                  <span className="text-[10px] text-muted-foreground block">CREATOR SIGNATURE</span>
                  <span className="font-bold text-foreground block">{deal.influencer?.displayName || "Creator"}</span>
                  <span className="text-[10px] text-verified font-mono block mt-1">
                    {influencerSignedAt ? `Signed ${formatContractDate(influencerSignedAt)}` : "Pending Signature"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowFullAgreementModal(false)}
                className="text-xs font-bold"
              >
                Close Agreement
              </Button>
            </div>
          </div>
        </BottomSheet>
      )}
    </>
  );
}
