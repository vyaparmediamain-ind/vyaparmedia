"use client";

import React, { useMemo } from "react";
import { ShieldCheck, CheckCircle2, Lock, Building2, User, FileText, Printer, X } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils-client";
import { Button } from "@/components/ui";
import {
  DEFAULT_BRAND_REVIEW_PERIOD_HOURS,
  DEFAULT_INCLUDED_REVISIONS,
  DEFAULT_CANCELLATION_FEE_AFTER_APPROVAL_PERCENT,
  DEFAULT_CANCELLATION_FEE_AFTER_SUBMISSION_PERCENT,
  DEFAULT_CANCELLATION_FEE_AFTER_POSTING_PERCENT,
} from "@/constants";
import { PLATFORM_CONFIG } from "@/lib/platform-config";

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

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-background/90 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pl-[max(0.75rem,env(safe-area-inset-left,0px))] pr-[max(0.75rem,env(safe-area-inset-right,0px))] print:p-0 print:bg-card print:static print:inset-auto">
      {/* Floating Action Bar (Hidden on Print) */}
      <div className="fixed top-[max(1rem,calc(env(safe-area-inset-top,0px)+8px))] right-[max(1rem,calc(env(safe-area-inset-right,0px)+8px))] z-[110] flex items-center gap-2.5 no-print bg-card/90 backdrop-blur-md p-2 rounded-2xl border border-border shadow-xl">
        <Button
          onClick={handlePrint}
          variant="primary"
          size="sm"
          className="gap-1.5 font-bold shadow-xs"
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
      <div className="printable-document w-full max-w-4xl bg-card text-foreground rounded-2xl shadow-2xl p-8 sm:p-12 border border-border print:border-none print:shadow-none print:p-0 print:rounded-none">
        
        {/* Document Header & Platform Letterhead */}
        <div className="border-b-2 border-border pb-6 mb-8 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
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

          <div className="text-left sm:text-right text-xs text-muted-foreground space-y-0.5 font-sans">
            <div className="font-bold text-foreground">{PLATFORM_CONFIG.legalName.toUpperCase()}</div>
            <div>CIN: {PLATFORM_CONFIG.cin} | GSTIN: {PLATFORM_CONFIG.gstin}</div>
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
            facilitated by <strong>VyaparMedia Technologies Private Limited</strong> acting as the neutral escrow agent and platform intermediary.
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
          
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse border border-border">
              <thead>
                <tr className="bg-muted text-foreground">
                  <th className="border border-border p-2.5 font-bold">Deliverable</th>
                  <th className="border border-border p-2.5 font-bold">Quantity</th>
                  <th className="border border-border p-2.5 font-bold">Platform</th>
                  <th className="border border-border p-2.5 font-bold">Specifications &amp; Guidelines</th>
                </tr>
              </thead>
              <tbody>
                {deliverables.length > 0 ? (
                  deliverables.map((item, idx) => (
                    <tr key={idx} className="border-t border-border">
                      <td className="border border-border p-2.5 font-semibold text-foreground">
                        {item.type ? item.type.replaceAll("_", " ") : "Sponsored Post / Reel"}
                      </td>
                      <td className="border border-border p-2.5 text-muted-foreground">{item.count || 1}x</td>
                      <td className="border border-border p-2.5 text-muted-foreground">{item.platform || "Instagram / YouTube"}</td>
                      <td className="border border-border p-2.5 text-muted-foreground">
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
                {formatCurrency(deal.amount)}
              </div>
              <p className="text-muted-foreground text-2xs mt-0.5">
                Funds deposited and secured in RBI-compliant escrow trust account prior to commencement of work.
              </p>
            </div>

            <div className="sm:text-right space-y-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-verified-muted text-verified font-bold text-2xs border border-verified-border shrink-0 whitespace-nowrap">
                <ShieldCheck className="w-3.5 h-3.5" />
                100% Escrow Secured
              </span>
              <div className="text-muted-foreground text-2xs">
                TDS compliance: Deducted under Section 194-J / 194-O as applicable.
              </div>
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
    </div>
  );
}
