import type { Metadata } from "next";
import { LegalLayout, LegalSection } from "@/components/legal/LegalLayout";
import { AlertTriangle } from "lucide-react";
import {
  DEFAULT_BRAND_REVIEW_PERIOD_HOURS,
  TDS_194O_RATE_PERCENT_STRING,
  GST_STANDARD_RATE_PERCENT_STRING,
} from "@/constants";
import { PLATFORM_CONFIG } from "@/lib/platform-config";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The legally binding Terms of Service governing brand campaigns, creator deliverables, automated escrow, and dispute arbitration on VyaparMedia.",
  alternates: {
    canonical: "/terms",
  },
  openGraph: {
    title: "Terms of Service | VyaparMedia",
    description:
      "Legally binding terms governing escrow contracts, creator milestones, TDS deductions, and dispute resolution.",
    url: "/terms",
    type: "website",
  },
};

const SECTIONS = [
  { id: "agreement", heading: "1. Agreement & Platform Role" },
  { id: "roles", heading: "2. Participant Roles & Eligibility" },
  { id: "verification", heading: "3. Verification & KYC Requirements" },
  { id: "campaigns", heading: "4. Campaigns, Deliverables & SOW" },
  { id: "payments", heading: "5. Escrow Mechanism, Payouts & Fees" },
  { id: "prohibited", heading: "6. Prohibited Conduct & Violations" },
  { id: "content-rights", heading: "7. Intellectual Property & Licensing" },
  { id: "disputes", heading: "8. Dispute Arbitration & Enforcement" },
  { id: "tax-compliance", heading: "9. Indian Tax Compliance & Invoicing" },
  { id: "liability", heading: "10. Warranties & Limitation of Liability" },
  { id: "contact", heading: "11. Corporate Disclosure & Legal Inquiries" },
];

export default function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      lastUpdated="June 20, 2026"
      description="These Terms govern your use of the VyaparMedia collaboration platform, escrow payment contracts, and creator verification systems."
      sections={SECTIONS}
    >
      {/* 1 */}
      <LegalSection id="agreement" heading="1. Agreement &amp; Platform Role">
        <p>
          By creating an account, browsing campaigns, submitting proposals, or depositing funds on VyaparMedia, you enter into a legally binding contract governed by these Terms of Service.
        </p>
        <p>
          VyaparMedia operates as a technology intermediary providing workflow automation, identity verification, milestone escrow ledgers, and dispute mediation tools. We do not act as an advertising agency, employer, tax advisor, or commercial bank. Brands and creators contract directly with one another through structured Statements of Work (SOW) executed on the platform.
        </p>
      </LegalSection>

      {/* 2 */}
      <LegalSection id="roles" heading="2. Participant Roles &amp; Eligibility" highlight>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h4 className="font-bold text-foreground text-sm mb-1">Brands &amp; Agencies</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Post detailed campaign briefs, pre-fund escrow budgets, review creative submissions against criteria, and approve milestone payouts.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <h4 className="font-bold text-foreground text-sm mb-1">Creators &amp; Influencers</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Submit genuine proposals, execute original deliverables, comply with ASCI disclosure rules, and maintain verified social channels.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <h4 className="font-bold text-foreground text-sm mb-1">Platform Mediators</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Impartial administrators who adjudicate formal disputes using milestone evidence, chat logs, and delivery timestamps.
            </p>
          </div>
        </div>
        <p className="text-sm">
          All users must be at least 18 years of age and possess full legal capacity under the Indian Contract Act, 1872. Business entities must ensure authorized corporate representation.
        </p>
      </LegalSection>

      {/* 3 */}
      <LegalSection id="verification" heading="3. Verification &amp; KYC Requirements">
        <p>
          To maintain an ecosystem free of fraud and bot manipulation, VyaparMedia implements tiered identity verification:
        </p>
        <ul className="list-disc pl-6 space-y-2 my-3">
          <li><strong className="text-foreground">Creator Verification:</strong> Mobile OTP verification, PAN record matching, and social handle authentication. High-value tiers require bank account verification via IMPS penny drop.</li>
          <li><strong className="text-foreground">Brand Verification:</strong> Official corporate email domain, GSTIN certificate validation, and registered company address matching.</li>
        </ul>
        <p>
          Any attempt to forge KYC documents or submit synthetic identity credentials will lead to immediate account termination, forfeiture of unlawful gains, and reporting to financial authorities.
        </p>
      </LegalSection>

      {/* 4 */}
      <LegalSection id="campaigns" heading="4. Campaigns, Deliverables &amp; SOW">
        <ul className="list-disc pl-6 space-y-2">
          <li>Campaign briefs must contain explicit creative requirements, deliverable formats (e.g. 60s Reel, 3-frame Story), brand tags, and mandatory talking points.</li>
          <li>Creators must deliver original, non-infringing creative assets by the contractual milestone deadlines.</li>
          <li>Brands are allotted a standard review window (typically {DEFAULT_BRAND_REVIEW_PERIOD_HOURS} hours) upon submission. If no revision or dispute is initiated within this window, the platform may trigger automated approval.</li>
          <li>Promotional posts must remain live on the creator&apos;s authenticated profile for the contractual retention period (standard 30–60 days).</li>
        </ul>
      </LegalSection>

      {/* 5 */}
      <LegalSection id="payments" heading="5. Escrow Mechanism, Payouts &amp; Fees">
        <p>
          To guarantee fulfillment for both parties, VyaparMedia utilizes a secured milestone escrow model:
        </p>
        <ul className="list-disc pl-6 space-y-2 my-3">
          <li><strong className="text-foreground">Upfront Escrow Lock:</strong> Brands fund 100% of the agreed milestone budget prior to creator commencement. Funds remain safeguarded in an RBI-compliant escrow account.</li>
          <li><strong className="text-foreground">Milestone Release:</strong> Funds are disbursed to the creator&apos;s platform wallet immediately upon brand approval of the verified deliverable.</li>
          <li><strong className="text-foreground">Instant Withdrawals:</strong> Creators can withdraw wallet balances to their verified Indian bank accounts via IMPS/NEFT 24/7.</li>
          <li><strong className="text-foreground">Transparent Platform Fees:</strong> VyaparMedia deducts a nominal platform facilitation fee clearly disclosed during campaign creation.</li>
        </ul>
      </LegalSection>

      {/* 6 */}
      <LegalSection id="prohibited" heading="6. Prohibited Conduct &amp; Violations" highlight>
        <div className="flex items-start gap-3 text-destructive mb-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <span className="font-bold text-sm">Zero-Tolerance Marketplace Violations</span>
        </div>
        <ul className="list-disc pl-6 space-y-2 text-sm">
          <li>Purchased followers, engagement pods, artificial comment bots, or simulated impression farming.</li>
          <li>Off-platform circumvention: soliciting or arranging direct payment outside VyaparMedia to bypass escrow protection and fees.</li>
          <li>Plagiarized content, unauthorized music licensing, or intellectual property infringement.</li>
          <li>Misleading medical claims, unlawful financial advice, deceptive promotions, or violations of ASCI advertising guidelines.</li>
          <li>Harassment, abusive communication, or defamation in workroom chats.</li>
        </ul>
      </LegalSection>

      {/* 7 */}
      <LegalSection id="content-rights" heading="7. Intellectual Property &amp; Licensing">
        <p>
          Unless explicitly altered in the customized campaign Statement of Work:
        </p>
        <ul className="list-disc pl-6 space-y-2 my-3">
          <li>Creators retain underlying authorship and moral rights in their original creative content.</li>
          <li>Upon full escrow payment release, the brand receives a worldwide, royalty-free, non-exclusive commercial license to re-share, repost, and feature the approved deliverable across their official digital channels for the agreed campaign duration.</li>
          <li>Whitelisting, paid media ad amplification, or indefinite dark-posting rights require explicit contractual addendums and supplementary talent fees.</li>
        </ul>
      </LegalSection>

      {/* 8 */}
      <LegalSection id="disputes" heading="8. Dispute Arbitration &amp; Enforcement">
        <p>
          In the event of an unresolvable disagreement regarding creative quality, deadline failure, or brief deviations:
        </p>
        <ul className="list-disc pl-6 space-y-2 my-3">
          <li>Either party may open a formal ticket in the <strong className="text-foreground">VyaparMedia Dispute Center</strong> prior to milestone release.</li>
          <li>Both parties submit supporting evidence (chat logs, drafts, analytics screenshots) into the immutable Evidence Vault.</li>
          <li>An impartial platform mediator audits the campaign brief against the submitted assets and renders a binding determination: full brand refund, full creator release, or proportional partial payout.</li>
        </ul>
      </LegalSection>

      {/* 9 */}
      <LegalSection id="tax-compliance" heading="9. Indian Tax Compliance &amp; Invoicing">
        <p>
          Users must maintain compliance with Indian taxation laws:
        </p>
        <ul className="list-disc pl-6 space-y-2 my-3">
          <li><strong className="text-foreground">Section 194-O TDS:</strong> As an e-commerce marketplace, VyaparMedia withholds {TDS_194O_RATE_PERCENT_STRING} TDS on creator disbursements where statutory turnover thresholds apply and deposits credits directly against the creator&apos;s PAN.</li>
          <li><strong className="text-foreground">GST Invoicing:</strong> Registered creators must issue {GST_STANDARD_RATE_PERCENT_STRING} GST tax invoices under SAC Code 998369. VyaparMedia provides automated invoice generation for all completed deals.</li>
        </ul>
      </LegalSection>

      {/* 10 */}
      <LegalSection id="liability" heading="10. Warranties &amp; Limitation of Liability">
        <p>
          VyaparMedia provides its platform and escrow infrastructure on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. We do not warrant specific viral engagement rates, brand sales conversions, or third-party social media platform uptime.
        </p>
        <p>
          To the maximum extent permitted by applicable Indian law, VyaparMedia&apos;s total aggregate liability arising out of any transaction shall not exceed the total platform fees collected by VyaparMedia from the specific disputed campaign.
        </p>
      </LegalSection>

      {/* 11 */}
      <LegalSection id="contact" heading="11. Corporate Disclosure, Legal Inquiries &amp; Jurisdiction">
        <p>
          These Terms of Service are governed by and construed under the laws of the Republic of India. Any legal proceedings or dispute claims shall be subject to the exclusive jurisdiction of the competent courts in Bengaluru, Karnataka, India.
        </p>
        <div className="rounded-xl border border-border bg-card p-5 mt-4 space-y-2 text-sm not-prose">
          <p><strong className="text-foreground">Corporate Entity:</strong> {PLATFORM_CONFIG.legalName}</p>
          <p><strong className="text-foreground">Corporate Identity Number (CIN):</strong> <span className="font-mono">{PLATFORM_CONFIG.cin}</span></p>
          <p><strong className="text-foreground">GSTIN:</strong> <span className="font-mono">{PLATFORM_CONFIG.gstin}</span> (SAC Code: 998365)</p>
          <p><strong className="text-foreground">Registered Office:</strong> {PLATFORM_CONFIG.address}</p>
          <p className="pt-1">
            <strong className="text-foreground">Formal Legal Notices:</strong>{" "}
            <a href={`mailto:${PLATFORM_CONFIG.legalEmail}`} className="text-primary font-bold hover:underline">
              {PLATFORM_CONFIG.legalEmail}
            </a>
          </p>
        </div>
      </LegalSection>
    </LegalLayout>
  );
}
