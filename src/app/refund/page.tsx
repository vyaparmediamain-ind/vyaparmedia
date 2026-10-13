import type { Metadata } from "next";
import { LegalLayout, LegalSection } from "@/components/legal/LegalLayout";
import Link from "next/link";
import { Clock, AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui";
import { PLATFORM_CONFIG } from "@/lib/platform-config";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy — VyaparMedia",
  description:
    "Comprehensive refund eligibility, cancellation protocols, and escrow return timelines for brand campaigns on VyaparMedia.",
};

const SECTIONS = [
  { id: "overview", heading: "1. Escrow Protection Overview" },
  { id: "brand-cancellations", heading: "2. Brand-Initiated Cancellations" },
  { id: "creator-cancellations", heading: "3. Creator-Initiated Cancellations" },
  { id: "non-refundable", heading: "4. Non-Refundable Fee Components" },
  { id: "timelines", heading: "5. Processing Timelines & Methods" },
  { id: "disputes", heading: "6. Dispute Adjudication Outcomes" },
  { id: "how-to-initiate", heading: "7. How to File a Refund Request" },
  { id: "corporate-entity", heading: "8. Billing Entity & Statutory Office" },
];

export default function RefundPage() {
  return (
    <LegalLayout
      title="Refund & Cancellation Policy"
      lastUpdated="June 20, 2026"
      description="This policy defines the circumstances under which locked escrow funds, campaign deposits, and platform payments can be cancelled or refunded."
      sections={SECTIONS}
    >
      {/* 1 */}
      <LegalSection id="overview" heading="1. Escrow Protection Overview">
        <p>
          VyaparMedia operates an automated milestone escrow architecture designed to safeguard both brand investments and creator compensation. When a brand funds a campaign, the capital is locked in an RBI-regulated escrow account and is only disbursed to the creator once contractual milestones are fulfilled and verified.
        </p>
        <p>
          Refund eligibility is determined strictly by the deal progression stage, submission timestamps, and verified deliverable compliance against the agreed Statement of Work (SOW).
        </p>
      </LegalSection>

      {/* 2 */}
      <LegalSection id="brand-cancellations" heading="2. Brand-Initiated Cancellations" highlight>
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 font-bold text-foreground text-sm mb-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Prior to Creator Offer Acceptance (100% Refundable)</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              If a campaign brief has not yet been accepted by selected creators, the brand may cancel immediately. 100% of the locked escrow capital is credited back to the Brand Wallet instantly.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 font-bold text-foreground text-sm mb-1">
              <Clock className="w-4 h-4 text-amber-500" />
              <span>Active Workroom Phase (Mutual Consent Required)</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Once a creator accepts the deal and creative production begins, brand cancellation requires either creator consent or an administrative dispute claim detailing non-responsiveness or missed deadlines.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 font-bold text-foreground text-sm mb-1">
              <AlertCircle className="w-4 h-4 text-primary" />
              <span>Post-Submission Phase (Revision Flow)</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Brands cannot cancel a deal unilaterally after draft deliverables have been submitted. Brands must review the assets and use their contractual revision requests or escalate to the Dispute Center with evidence of non-compliance.
            </p>
          </div>
        </div>
      </LegalSection>

      {/* 3 */}
      <LegalSection id="creator-cancellations" heading="3. Creator-Initiated Cancellations">
        <p>
          Creators are expected to complete all accepted collaborations. In the event of documented emergencies, equipment failure, or brand contract breaches:
        </p>
        <ul className="list-disc pl-6 space-y-2 my-3">
          <li>If the creator cancels prior to submitting deliverables, 100% of the locked escrow funds are returned to the brand immediately.</li>
          <li>Unjustified creator cancellations or missed deadlines will incur DRS™ trust score penalties and may restrict participation in high-value campaigns.</li>
          <li>If partial milestones were already submitted and approved by the brand, the creator is entitled to compensation for those approved milestones.</li>
        </ul>
      </LegalSection>

      {/* 4 */}
      <LegalSection id="non-refundable" heading="4. Non-Refundable Fee Components">
        <p>The following items are strictly non-refundable:</p>
        <ul className="list-disc pl-6 space-y-2 my-3">
          <li>Third-party payment gateway transaction processing charges (Razorpay fees incurred on credit cards/net-banking).</li>
          <li>Statutory taxes (such as GST or TDS) already deposited with the respective tax authorities for completed transactions.</li>
          <li>Milestones where content was officially approved and payment was authorized to the creator&apos;s wallet.</li>
          <li>Physical product samples shipped by brands directly to creators for gifting or review campaigns.</li>
        </ul>
      </LegalSection>

      {/* 5 */}
      <LegalSection id="timelines" heading="5. Processing Timelines &amp; Methods">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-bold text-foreground text-sm mb-1">VyaparMedia Wallet Credit</h4>
            <span className="text-xs font-mono font-bold text-emerald-500 block mb-2">Instant (0–5 Minutes)</span>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Approved refunds are credited to your platform wallet balance immediately, ready to be deployed on future creator campaigns.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-bold text-foreground text-sm mb-1">Original Bank Account / Card</h4>
            <span className="text-xs font-mono font-bold text-primary block mb-2">5–7 Business Days</span>
            <p className="text-xs text-muted-foreground leading-relaxed">
              If an original payment source reversal is requested, banking networks (UPI, IMPS, Visa, Mastercard) process the credit within standard settlement cycles.
            </p>
          </div>
        </div>
      </LegalSection>

      {/* 6 */}
      <LegalSection id="disputes" heading="6. Dispute Adjudication Outcomes">
        <p>When an administrative dispute is adjudicated by platform mediators:</p>
        <ul className="list-disc pl-6 space-y-2 my-3">
          <li><strong className="text-foreground">Full Brand Refund:</strong> Issued when a creator fails to deliver within agreed deadlines, submits plagiarized content, or provides false analytics.</li>
          <li><strong className="text-foreground">Full Creator Payout:</strong> Issued when deliverables satisfy the approved brief and the brand fails to provide valid objective grounds for rejection.</li>
          <li><strong className="text-foreground">Split Compromise:</strong> Issued when work was partially completed and can be utilized with minor adjustments by the brand.</li>
          <li><strong className="text-foreground">Post-Deletion Clawback:</strong> If a creator deletes a sponsored post before the agreed 30-day retention window, funds may be reclaimed from the creator&apos;s pending wallet balance.</li>
        </ul>
      </LegalSection>

      {/* 7 */}
      <LegalSection id="how-to-initiate" heading="7. How to File a Refund Request" highlight>
        <p className="mb-4">
          To initiate a refund or dispute a milestone deliverable, navigate to your active deal room or access the Resolution Center:
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/dashboard/disputes">
            <Button variant="primary" className="cursor-pointer inline-flex items-center gap-2">
              <span>Open Dispute Center</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <a
            href="mailto:support@vyaparmedia.in"
            className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
          >
            Contact Billing Support →
          </a>
        </div>
      </LegalSection>

      {/* 8 */}
      <LegalSection id="corporate-entity" heading="8. Billing Entity &amp; Statutory Office">
        <p>
          All commercial refunds, credit notes, and escrow disbursements are issued by our corporate entity:
        </p>
        <div className="rounded-xl border border-border bg-card p-5 mt-4 space-y-2 text-sm not-prose">
          <p><strong className="text-foreground">Billing Entity:</strong> {PLATFORM_CONFIG.legalName}</p>
          <p><strong className="text-foreground">Corporate Identity Number (CIN):</strong> <span className="font-mono">{PLATFORM_CONFIG.cin}</span></p>
          <p><strong className="text-foreground">GSTIN:</strong> <span className="font-mono">{PLATFORM_CONFIG.gstin}</span></p>
          <p><strong className="text-foreground">Registered Office:</strong> {PLATFORM_CONFIG.address}</p>
          <p className="pt-1">
            <strong className="text-foreground">Billing Escalations:</strong>{" "}
            <a href={`mailto:${PLATFORM_CONFIG.billingEmail}`} className="text-primary font-bold hover:underline">
              {PLATFORM_CONFIG.billingEmail}
            </a>
          </p>
        </div>
      </LegalSection>
    </LegalLayout>
  );
}
