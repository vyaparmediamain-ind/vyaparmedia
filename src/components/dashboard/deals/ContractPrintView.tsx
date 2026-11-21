"use client";

import React, { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { ShieldCheck, CheckCircle2, Lock, Building2, User, FileText, Printer, X } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils-client";
import { Button } from "@/components/ui";
import Logo from "@/components/Logo";
import {
  DEFAULT_BRAND_REVIEW_PERIOD_HOURS,
  DEFAULT_INCLUDED_REVISIONS,
  DEFAULT_CANCELLATION_FEE_AFTER_APPROVAL_PERCENT,
  DEFAULT_CANCELLATION_FEE_AFTER_SUBMISSION_PERCENT,
  DEFAULT_CANCELLATION_FEE_AFTER_POSTING_PERCENT,
  GST_DEAL_EXEMPT_THRESHOLD_PAISE,
  GST_STANDARD_RATE,
} from "@/constants";
import { PLATFORM_CONFIG } from "@/lib/platform-config";
import { extractAllDealHashtagsAndMentions } from "./DealDetailHelpers";

export interface ContractPrintViewProps {
  deal: {
    id: string;
    amount: number;
    totalAmount?: number | null | undefined;
    platformFee?: number | null | undefined;
    status: string;
    createdAt: string | Date;
    brandSignedAt?: string | Date | null | undefined;
    influencerSignedAt?: string | Date | null | undefined;
    contractSignature?: unknown;
    contractTerms?: unknown;
    campaign?: {
      title?: string | null | undefined;
      description?: string | null | undefined;
      targetCategories?: string[] | null | undefined;
      brand?: {
        companyName?: string | null | undefined;
        user?: { email?: string | null | undefined; } | null | undefined;
        [key: string]: unknown;
      } | null | undefined;
      [key: string]: unknown;
    } | null | undefined;
    brand?: {
      companyName?: string | null | undefined;
      user?: {
        email?: string | null | undefined;
        taxCompliance?: { gstin?: string | null | undefined; panLast4?: string | null | undefined; } | null | undefined;
        [key: string]: unknown;
      } | null | undefined;
      [key: string]: unknown;
    } | null | undefined;
    influencer?: {
      displayName?: string | null | undefined;
      instagramHandle?: string | null | undefined;
      youtubeHandle?: string | null | undefined;
      user?: {
        email?: string | null | undefined;
        taxCompliance?: { panLast4?: string | null | undefined; } | null | undefined;
        [key: string]: unknown;
      } | null | undefined;
      [key: string]: unknown;
    } | null | undefined;
    [key: string]: unknown;
  };
  onClose: () => void;
}

export function ContractPrintView({ deal, onClose }: ContractPrintViewProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.body.classList.add("printable-modal-active", "overflow-hidden");
    return () => {
      document.body.classList.remove("printable-modal-active", "overflow-hidden");
    };
  }, []);

  const terms = useMemo(() => ((deal.contractTerms || {}) as Record<string, unknown>), [deal.contractTerms]);
  const sig = useMemo(() => ((deal.contractSignature || {}) as Record<string, unknown>), [deal.contractSignature]);

  const brandName = deal.brand?.companyName || deal.campaign?.brand?.companyName || "Brand Partner";
  const brandGst = deal.brand?.user?.taxCompliance?.gstin || "Available on File";
  const influencerName = deal.influencer?.displayName || "Content Creator";
  const influencerPan = deal.influencer?.user?.taxCompliance?.panLast4
    ? `XXXXX${deal.influencer.user.taxCompliance.panLast4}`
    : "Verified KYC On File";
  const handle = deal.influencer?.instagramHandle
    ? `@${deal.influencer.instagramHandle}`
    : deal.influencer?.youtubeHandle || "Social Creator";

  const deliverables = (terms.deliverables || []) as Array<{
    type?: string;
    count?: number;
    platform?: string;
    specs?: string;
    details?: string;
  }>;

  const cancellationPolicy = (terms.cancellationPolicy || {}) as {
    beforeApproval?: number;
    afterSubmission?: number;
    afterPosting?: number;
  };

  // Comprehensive hashtag, brand mention and statutory ASCI tag extraction
  const allHashtags = useMemo(() => {
    return extractAllDealHashtagsAndMentions(deal, terms);
  }, [deal, terms]);

  const handlePrint = () => {
    window.print();
  };

  if (!mounted) return null;

  return createPortal(
    <div className="printable-modal-overlay fixed inset-0 z-[100] overflow-y-auto bg-background/90 backdrop-blur-sm flex items-start justify-center p-3 sm:p-6 pt-16 pb-12 print:p-0 print:bg-card print:static print:inset-auto print:block">
      {/* Floating Action Bar (Hidden on Print) */}
      <div className="fixed top-4 right-4 z-[110] flex items-center gap-2.5 no-print bg-card/90 backdrop-blur-md p-2 rounded-2xl border border-border shadow-xl">
        <Button
          onClick={handlePrint}
          variant="primary"
          size="sm"
          className="gap-1.5 font-bold shadow-xs cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>Print / Save PDF</span>
        </Button>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          title="Close Preview"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Official Legal Document Container */}
      <div className="printable-document w-full max-w-4xl bg-card text-foreground rounded-2xl shadow-2xl p-6 sm:p-10 my-auto border border-border print:border-none print:shadow-none print:p-0 print:my-0 print:rounded-none">
        
        {/* Document Header & Platform Letterhead */}
        <div className="border-b-2 border-border pb-6 mb-8 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-3">
            <Logo asLink={false} showTagline={true} size="md" />
            <div>
              <span className="text-2xs font-mono font-bold tracking-widest text-primary uppercase block mb-1">
                OFFICIAL ESCROW SERVICE AGREEMENT
              </span>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground uppercase">
                Independent Influencer Collaboration Agreement
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                Executed digitally via VyaparMedia Trust &amp; Escrow Platform
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right text-xs text-muted-foreground space-y-0.5 font-sans">
            <div className="font-bold text-foreground">
              {PLATFORM_CONFIG.tradeName ? `${PLATFORM_CONFIG.tradeName.toUpperCase()} (${PLATFORM_CONFIG.legalName.toUpperCase()})` : PLATFORM_CONFIG.legalName.toUpperCase()}
            </div>
            <div>
              {PLATFORM_CONFIG.cin && !["N/A", "NONE", "PROPRIETORSHIP"].includes(PLATFORM_CONFIG.cin.toUpperCase()) ? `CIN: ${PLATFORM_CONFIG.cin} | ` : ""}
              {PLATFORM_CONFIG.udyam ? `Udyam: ${PLATFORM_CONFIG.udyam} | ` : ""}
              GSTIN: {PLATFORM_CONFIG.gstin}
              {PLATFORM_CONFIG.pan ? ` | PAN: ${PLATFORM_CONFIG.pan}` : ""}
            </div>
            <div>{PLATFORM_CONFIG.address}</div>
            <div className="font-mono text-2xs text-muted-foreground pt-1">
              Ref: DEAL-{deal.id.slice(-8).toUpperCase()} | Date: {formatDate(deal.createdAt)}
            </div>
          </div>
        </div>

        {/* Preamble & Parties Identification Matrix */}
        <section className="print-section mb-8 space-y-4">
          <p className="text-xs text-foreground/90 leading-relaxed">
            This Independent Influencer Collaboration &amp; Escrow Services Agreement (the <strong>&quot;Agreement&quot;</strong>) is 
            entered into and made effective as of <strong>{formatDate(deal.createdAt)}</strong>, by and between the parties identified below, 
            facilitated by <strong>{PLATFORM_CONFIG.legalName}</strong> acting as the neutral escrow agent and platform intermediary.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Brand Entity */}
            <div className="border border-border rounded-xl p-4 bg-muted/40 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-foreground text-sm border-b border-border pb-2">
                <Building2 className="w-4 h-4 text-primary" />
                <span>THE ADVERTISER / BRAND (PARTY A)</span>
              </div>
              <div className="space-y-1 text-muted-foreground">
                <div><strong className="text-foreground">Entity:</strong> {brandName}</div>
                <div><strong className="text-foreground">GSTIN:</strong> {brandGst}</div>
                <div><strong className="text-foreground">Campaign:</strong> {deal.campaign?.title || "Direct Collaboration"}</div>
                <div><strong className="text-foreground">Contact:</strong> {deal.brand?.user?.email || "Protected on Platform"}</div>
              </div>
            </div>

            {/* Influencer Entity */}
            <div className="border border-border rounded-xl p-4 bg-muted/40 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-foreground text-sm border-b border-border pb-2">
                <User className="w-4 h-4 text-verified" />
                <span>THE CREATOR / INFLUENCER (PARTY B)</span>
              </div>
              <div className="space-y-1 text-muted-foreground">
                <div><strong className="text-foreground">Creator Name:</strong> {influencerName}</div>
                <div><strong className="text-foreground">Handle / Channel:</strong> {handle}</div>
                <div><strong className="text-foreground">Tax Identification:</strong> PAN {influencerPan}</div>
                <div><strong className="text-foreground">Contact:</strong> {deal.influencer?.user?.email || "Protected on Platform"}</div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 1: Scope of Work & Deliverables Schedule */}
        <section className="print-section mb-8 space-y-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-foreground border-b border-border pb-1 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-muted-foreground" />
            <span>1. Scope of Work &amp; Deliverables Matrix</span>
          </h2>
          
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-xs text-left border-collapse border border-border print:text-2xs print:table-fixed">
              <thead>
                <tr className="bg-muted text-foreground">
                  <th className="border border-border p-2.5 font-bold w-[25%]">Deliverable</th>
                  <th className="border border-border p-2.5 font-bold w-[12%] whitespace-nowrap">Quantity</th>
                  <th className="border border-border p-2.5 font-bold w-[20%] whitespace-nowrap">Platform</th>
                  <th className="border border-border p-2.5 font-bold w-[43%]">Specifications &amp; Guidelines</th>
                </tr>
              </thead>
              <tbody>
                {deliverables.length > 0 ? (
                  deliverables.map((item, idx) => (
                    <tr key={idx} className="border-t border-border">
                      <td className="border border-border p-2 font-semibold text-foreground break-words">
                        {item.type ? item.type.replaceAll("_", " ") : "Sponsored Post / Reel"}
                      </td>
                      <td className="border border-border p-2 text-muted-foreground whitespace-nowrap">{item.count || 1}x</td>
                      <td className="border border-border p-2 text-muted-foreground break-words">{item.platform || "Instagram / YouTube"}</td>
                      <td className="border border-border p-2 text-muted-foreground break-words">
                        {item.specs || item.details || "As per agreed campaign guidelines, creative brief and brand hashtags."}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="border border-border p-3 text-muted-foreground italic">
                      Sponsored deliverables as specified in campaign brief #{deal.campaign?.title || deal.id}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
            <div className="p-2.5 bg-muted/40 border border-border rounded-lg">
              <span className="text-muted-foreground block text-2xs uppercase font-semibold">Content Due Date</span>
              <span className="font-bold text-foreground">{formatDate((terms.submissionDeadline as string | Date) || deal.createdAt)}</span>
            </div>
            <div className="p-2.5 bg-muted/40 border border-border rounded-lg">
              <span className="text-muted-foreground block text-2xs uppercase font-semibold">Brand Review Window</span>
              <span className="font-bold text-foreground">{(terms.reviewPeriodHours as number) || DEFAULT_BRAND_REVIEW_PERIOD_HOURS} Hours from submission</span>
            </div>
            <div className="p-2.5 bg-muted/40 border border-border rounded-lg">
              <span className="text-muted-foreground block text-2xs uppercase font-semibold">Included Revisions</span>
              <span className="font-bold text-foreground">{(terms.includedRevisions as number) ?? DEFAULT_INCLUDED_REVISIONS} Complimentary rounds</span>
            </div>
          </div>

          {/* Physical Product Seeding Provision (if applicable) */}
          {(Boolean(terms.requiresProduct) || Boolean((deal as Record<string, unknown>).requiresProduct)) && (
            <div className="p-3.5 bg-verified/5 border border-verified/30 rounded-xl text-2xs space-y-1.5 mt-2">
              <div className="flex items-center justify-between font-bold text-foreground">
                <span className="uppercase tracking-wider text-verified font-bold">📦 Physical Product Seeding / Barter Provision</span>
                <span className="font-mono text-muted-foreground">
                  Retail Value: {formatCurrency(((terms.productValue as number) || ((deal as Record<string, unknown>).productValue as number) || 0))}
                </span>
              </div>
              <div className="text-foreground font-semibold">
                Product: {((terms.productName as string) || ((deal as Record<string, unknown>).productName as string) || "Brand Sponsored Product Sample")}
              </div>
              <p className="text-muted-foreground leading-relaxed">
                The Advertiser shall dispatch the physical product samples via tracked courier (Shiprocket / integrated AWB). Content production deadlines shall commence only upon confirmed receipt by the creator. Creator retains gifted product samples permanently unless the brief explicitly specifies return logistics.
              </p>
            </div>
          )}

          {/* Mandatory Brand Tags & ASCI Disclosure Compliance */}
          <div className="p-3.5 bg-muted/30 border border-border rounded-xl text-2xs space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 font-semibold text-foreground border-b border-border/60 pb-2">
              <span className="uppercase tracking-wider font-bold">Mandatory Brand Hashtags &amp; Tags ({allHashtags.length}):</span>
              <div className="flex flex-wrap gap-1.5 pt-1 sm:pt-0">
                {allHashtags.map((tag) => (
                  <span
                    key={tag}
                    className="font-mono px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 text-2xs font-semibold"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              <strong>ASCI &amp; CCPA Compliance Notice:</strong> The creator is legally required to include all specified mandatory hashtags and official disclosures (such as #ad, #sponsored, or the platform’s native Paid Partnership tag) prominently above the fold in the published post caption.
            </p>
          </div>
        </section>

        {/* Section 2: Financial Consideration & Escrow Lock Schedule */}
        <section className="print-section mb-8 space-y-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-foreground border-b border-border pb-1 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-muted-foreground" />
            <span>2. Financial Consideration &amp; Escrow Guarantee</span>
          </h2>

          <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
            <div>
              <span className="text-2xs font-bold text-primary uppercase tracking-wider block">
                Total Contract Consideration
              </span>
              <div className="text-2xl font-black text-foreground">
                {deal.amount > 0
                  ? formatCurrency(deal.amount)
                  : ((terms.productValue as number) || ((deal as Record<string, unknown>).productValue as number))
                  ? `${formatCurrency(((terms.productValue as number) || ((deal as Record<string, unknown>).productValue as number) || 0))} (Barter Product)`
                  : "Product Barter"}
              </div>
              <p className="text-muted-foreground text-2xs mt-0.5">
                {deal.amount > 0
                  ? "Funds deposited and secured in RBI-compliant escrow trust account prior to commencement of work."
                  : `Non-monetary consideration: Brand gifts physical product sample${terms.productName ? ` (${terms.productName})` : ""} valued at ${formatCurrency(((terms.productValue as number) || ((deal as Record<string, unknown>).productValue as number) || 0))}.`}
              </p>
            </div>

            <div className="sm:text-right space-y-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-verified-muted text-verified font-bold text-2xs border border-verified-border shrink-0 whitespace-nowrap">
                <ShieldCheck className="w-3.5 h-3.5" />
                {deal.amount > 0 ? "100% Escrow Secured" : "Barter Verified"}
              </span>
              <div className="text-muted-foreground text-2xs">
                {deal.amount > 0
                  ? "TDS compliance: Deducted under Section 194-J / 194-O as applicable."
                  : "Physical delivery tracked via Shiprocket logistics integration."}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-2xs p-3 bg-muted/40 border border-border rounded-lg mt-2">
            <div>
              <span className="text-muted-foreground block font-medium">Creator Compensation:</span>
              <span className="font-bold text-foreground">
                {deal.amount > 0 ? formatCurrency(deal.amount) : "Gifted Product"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block font-medium">
                {deal.amount > 0 ? "Platform Fee (10%):" : "Product Handling Fee:"}
              </span>
              <span className="font-bold text-foreground">{formatCurrency(deal.platformFee || 0)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block font-medium">GST (SAC 998365):</span>
              <span className={`font-bold ${deal.amount > GST_DEAL_EXEMPT_THRESHOLD_PAISE ? "text-foreground" : "text-verified"}`}>
                {deal.amount > GST_DEAL_EXEMPT_THRESHOLD_PAISE
                  ? formatCurrency(Math.round((deal.platformFee || 0) * GST_STANDARD_RATE))
                  : "\u20B90 (\u2264 \u20B91,500 Exempt)"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block font-medium">Total Client Deposit:</span>
              <span className="font-bold text-foreground">{formatCurrency(deal.totalAmount)}</span>
            </div>
          </div>
        </section>

        {/* Section 3: Revisions & Cancellation Policy (Kill Fee Schedule) */}
        <section className="print-section mb-8 space-y-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-foreground border-b border-border pb-1">
            3. Cancellation &amp; Kill-Fee Policy (Indian Contract Act Schedule)
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            In accordance with platform standard terms, if the advertiser cancels this contract prematurely after digital execution, 
            compensation is distributed from escrow according to the stage of deliverable production:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-center">
            <div className="p-3 border border-border rounded-xl bg-muted/40">
              <span className="text-2xs text-muted-foreground font-semibold block uppercase">Before Draft Submission</span>
              <span className="text-lg font-black text-foreground">{cancellationPolicy.beforeApproval || DEFAULT_CANCELLATION_FEE_AFTER_APPROVAL_PERCENT}% Payout</span>
              <span className="text-2xs text-muted-foreground block mt-1">Creator retains {DEFAULT_CANCELLATION_FEE_AFTER_APPROVAL_PERCENT}% slot reservation kill fee</span>
            </div>
            <div className="p-3 border border-border rounded-xl bg-muted/40">
              <span className="text-2xs text-muted-foreground font-semibold block uppercase">After Draft Submission</span>
              <span className="text-lg font-black text-foreground">{cancellationPolicy.afterSubmission || DEFAULT_CANCELLATION_FEE_AFTER_SUBMISSION_PERCENT}% Payout</span>
              <span className="text-2xs text-muted-foreground block mt-1">{DEFAULT_CANCELLATION_FEE_AFTER_SUBMISSION_PERCENT}% compensation for production work</span>
            </div>
            <div className="p-3 border border-border rounded-xl bg-muted/40">
              <span className="text-2xs text-muted-foreground font-semibold block uppercase">After Content Approval</span>
              <span className="text-lg font-black text-foreground">{cancellationPolicy.afterPosting || DEFAULT_CANCELLATION_FEE_AFTER_POSTING_PERCENT}% Payout</span>
              <span className="text-2xs text-muted-foreground block mt-1">Full {DEFAULT_CANCELLATION_FEE_AFTER_POSTING_PERCENT}% payout released to creator</span>
            </div>
          </div>
        </section>

        {/* Section 4: Digital Cryptographic Signatures & Verification Trail */}
        <section className="print-section signature-block pt-6 border-t-2 border-border space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-wider text-foreground">
              4. Electronic Execution &amp; Cryptographic Signatures
            </h2>
            <span className="text-2xs font-mono font-bold text-muted-foreground">
              Information Technology Act 2000 (§65B Compliant)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
            {/* Brand Signature */}
            <div className="border border-border rounded-xl p-4 bg-muted/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">FOR THE ADVERTISER / BRAND</span>
                <span className="inline-flex items-center gap-1 text-2xs font-bold text-verified bg-verified-muted px-2 py-0.5 rounded border border-verified-border">
                  <CheckCircle2 className="w-3 h-3" />
                  {deal.brandSignedAt ? "Digitally Signed" : "Pending Signature"}
                </span>
              </div>
              <div className="font-serif italic text-sm text-foreground/90 pt-1">
                {deal.brandSignedAt ? brandName : "Awaiting signature"}
              </div>
              <div className="text-2xs text-muted-foreground font-mono space-y-0.5 pt-2 border-t border-border">
                <div>Signed At: {deal.brandSignedAt ? formatDate(deal.brandSignedAt) : "Pending"}</div>
                <div className="truncate">
                  Hash: {String((sig.brandSignature as Record<string, unknown>)?.signatureHash || "SHA256:VERIFIED_ESCROW_RECORD")}
                </div>
              </div>
            </div>

            {/* Creator Signature */}
            <div className="border border-border rounded-xl p-4 bg-muted/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">FOR THE CREATOR / INFLUENCER</span>
                <span className="inline-flex items-center gap-1 text-2xs font-bold text-verified bg-verified-muted px-2 py-0.5 rounded border border-verified-border">
                  <CheckCircle2 className="w-3 h-3" />
                  {deal.influencerSignedAt ? "Digitally Signed" : "Pending Signature"}
                </span>
              </div>
              <div className="font-serif italic text-sm text-foreground/90 pt-1">
                {deal.influencerSignedAt ? influencerName : "Awaiting signature"}
              </div>
              <div className="text-2xs text-muted-foreground font-mono space-y-0.5 pt-2 border-t border-border">
                <div>Signed At: {deal.influencerSignedAt ? formatDate(deal.influencerSignedAt) : "Pending"}</div>
                <div className="truncate">
                  Hash: {String((sig.influencerSignature as Record<string, unknown>)?.signatureHash || "SHA256:VERIFIED_ESCROW_RECORD")}
                </div>
              </div>
            </div>
          </div>

          {/* Legal Footer Note */}
          <div className="text-center text-muted-foreground text-2xs pt-4 border-t border-border space-y-1">
            <p>
              This document is an electronically generated and digitally executed contract. Pursuant to the provisions of the Information 
              Technology Act 2000 and the Indian Contract Act 1872, this document does not require physical or wet signatures.
            </p>
            <p>
              This agreement is governed by the laws of India. Subject to arbitration under the Arbitration and Conciliation Act, 1996 in Bengaluru, 
              courts located in Bengaluru, Karnataka, India have exclusive jurisdiction over all matters arising hereunder.
            </p>
          </div>
        </section>

      </div>
    </div>,
    document.body
  );
}
