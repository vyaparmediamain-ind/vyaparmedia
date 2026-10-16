import type { Metadata } from "next";
import { LegalLayout, LegalSection } from "@/components/legal/LegalLayout";
import { PLATFORM_CONFIG } from "@/lib/platform-config";

export const metadata: Metadata = {
  title: "Privacy Policy — VyaparMedia",
  description:
    "How VyaparMedia collects, uses, tokenizes, and protects your personal data under the DPDP Act 2023 and Indian IT regulations. Last updated June 20, 2026.",
};

const SECTIONS = [
  { id: "who-we-are", heading: "1. Who We Are & Scope" },
  { id: "information-we-collect", heading: "2. Information We Collect" },
  { id: "why-we-use", heading: "3. Purposes of Data Processing" },
  { id: "consent-rights", heading: "4. User Rights & DPDP Consent" },
  { id: "sharing", heading: "5. Authorized Service Providers" },
  { id: "security-retention", heading: "6. Security & Statutory Retention" },
  { id: "automated", heading: "7. Automated Checks & DRS™ Scoring" },
  { id: "children", heading: "8. Age Eligibility & Minor Protection" },
  { id: "contact", heading: "9. Grievance Redressal & Contact" },
];

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      lastUpdated="June 20, 2026"
      description="This Privacy Policy explains how VyaparMedia collects, processes, stores, and safeguards personal data and KYC records under the Digital Personal Data Protection (DPDP) Act, 2023."
      sections={SECTIONS}
    >
      {/* 1 */}
      <LegalSection id="who-we-are" heading="1. Who We Are &amp; Scope">
        <p>
          VyaparMedia operates an India-focused influencer collaboration marketplace connecting verified brands, digital creators, and platform mediators. This policy applies to all interactions across our web application, installable Progressive Web App (PWA), REST APIs, escrow payment ledgers, dispute rooms, and customer support channels.
        </p>
      </LegalSection>

      {/* 2 */}
      <LegalSection id="information-we-collect" heading="2. Information We Collect" highlight>
        <p className="mb-4">
          To facilitate legally enforceable brand contracts and statutory tax reporting, we collect the following categories of data:
        </p>
        <ul className="list-disc pl-6 space-y-2.5">
          <li>
            <strong className="text-foreground">Identity &amp; Account Data:</strong> Full legal name, email address, mobile number, hashed credentials, user role (Brand, Creator, Admin), and device authentication logs.
          </li>
          <li>
            <strong className="text-foreground">Creator Portfolio &amp; Media Kit:</strong> Public bio, city, content niches, rate cards, connected Instagram/YouTube handles, historical post metrics, and audience demographics.
          </li>
          <li>
            <strong className="text-foreground">KYC &amp; Statutory Identifiers:</strong> Permanent Account Number (PAN), masked Aadhaar reference tokens (via authorized UIDAI-compliant DigiLocker/OCR providers), GSTIN certificate metadata, bank account numbers, IFSC codes, and cancelled cheque images for direct bank payout routing.
          </li>
          <li>
            <strong className="text-foreground">Financial &amp; Ledger Records:</strong> Escrow deposits, milestone releases, Razorpay transaction references, TDS deductions under Section 194-O, GST tax invoices, and withdrawal logs.
          </li>
          <li>
            <strong className="text-foreground">Collaboration Artifacts:</strong> Campaign briefs, milestone deliverables, draft content previews, live promotional URLs, performance metrics, deal room messages, and dispute evidence.
          </li>
        </ul>
      </LegalSection>

      {/* 3 */}
      <LegalSection id="why-we-use" heading="3. Purposes of Data Processing">
        <ul className="list-disc pl-6 space-y-2">
          <li>To establish your account identity, enforce two-factor authentication, and prevent account takeover.</li>
          <li>To calculate our proprietary DRS™ (Dynamic Reliability Score) and protect brands from artificial bot traffic.</li>
          <li>To operate milestone escrow contracts, process bank transfers, and generate GST-compliant invoices.</li>
          <li>To fulfill mandatory CBDT tax compliance, including quarterly Form 26AS TDS credit reporting.</li>
          <li>To mediate deliverable disputes through our objective Evidence Vault arbitration workflow.</li>
          <li>To dispatch critical transactional notifications regarding deal milestones, approvals, and escrow lock status.</li>
        </ul>
      </LegalSection>

      {/* 4 */}
      <LegalSection id="consent-rights" heading="4. User Rights &amp; DPDP Consent">
        <p>
          In accordance with the <strong className="text-foreground">Digital Personal Data Protection (DPDP) Act, 2023</strong>, you hold unconditional rights to:
        </p>
        <ul className="list-disc pl-6 space-y-2 my-3">
          <li><strong className="text-foreground">Right of Access:</strong> Request a comprehensive copy of all personal data, activity logs, and KYC documents stored under your profile.</li>
          <li><strong className="text-foreground">Right to Rectification:</strong> Update inaccurate bank details, addresses, or tax credentials directly from your Settings dashboard.</li>
          <li><strong className="text-foreground">Right to Erasure:</strong> Request permanent deletion of non-statutory account data upon settlement of all open escrow deals and financial balances.</li>
          <li><strong className="text-foreground">Right to Grievance Redressal:</strong> Nominate an authorized representative or file a grievance directly with our designated Data Protection Officer.</li>
        </ul>
        <p className="text-xs text-muted-foreground italic">
          *Note: Statutory financial records, GST invoices, and Section 194-O TDS logs must be retained for 7 years as mandated by Indian tax and anti-money-laundering regulations.
        </p>
      </LegalSection>

      {/* 5 */}
      <LegalSection id="sharing" heading="5. Authorized Service Providers">
        <p>
          We do not sell, rent, or monetize your personal data. We disclose strictly scoped data to authorized infrastructure partners under confidentiality and data protection agreements:
        </p>
        <ul className="list-disc pl-6 space-y-2 my-3">
          <li><strong className="text-foreground">Payment Gateways:</strong> Razorpay (for PCI-DSS compliant card, UPI, and IMPS escrow processing).</li>
          <li><strong className="text-foreground">Cloud Infrastructure:</strong> Supabase (PostgreSQL), Cloudflare R2 (encrypted media assets), and Upstash (high-speed Redis cache).</li>
          <li><strong className="text-foreground">Communications:</strong> Resend (transactional email) and Twilio / MSG91 (two-factor authentication OTPs).</li>
          <li><strong className="text-foreground">Automated Safety &amp; Content Moderation:</strong> Google Cloud Vision API (transient in-memory optical character recognition on deal chat attachments to detect off-platform commercial leakage and contact leaks; image data is never retained, logged, or utilized for AI training).</li>
          <li><strong className="text-foreground">Fraud Telemetry &amp; Geo-Intelligence:</strong> IP geolocation intelligence providers to compute risk scores, identify impossible travel velocity, and detect proxy/VPN syndicates during registration.</li>
          <li><strong className="text-foreground">Law Enforcement:</strong> Government agencies or tax authorities only when presented with a valid statutory order or court decree under applicable Indian laws.</li>
        </ul>
      </LegalSection>

      {/* 6 */}
      <LegalSection id="security-retention" heading="6. Security &amp; Statutory Retention">
        <p>
          All sensitive identifiers (such as bank details and PANs) are encrypted at rest using AES-256 and transmitted exclusively via TLS 1.3. We implement strict role-based access control (RBAC), multi-factor session authentication, rate-limiting, and real-time security event auditing.
        </p>
        <p>
          To protect account integrity under DPDP legitimate use exemptions, user IP addresses, login timestamps, and device hardware fingerprints are retained for a rolling window of 90 days in security audit logs before automated purging.
        </p>
        <p>
          Users must safeguard their passwords and OTPs. VyaparMedia employees will never solicit your password, two-factor OTP, or UPI PIN via call, WhatsApp, or direct message.
        </p>
      </LegalSection>

      {/* 7 */}
      <LegalSection id="automated" heading="7. Automated Checks &amp; DRS™ Scoring">
        <p>
          VyaparMedia applies automated algorithmic checks to compute creator reliability and detect fraud. Our system evaluates engagement consistency, comment semantic health, follower velocity, and past deal fulfillment rates. If you believe your DRS™ trust tier has been impacted by an algorithmic anomaly, you may request a manual human review via the Help Center.
        </p>
      </LegalSection>

      {/* 8 */}
      <LegalSection id="children" heading="8. Age Eligibility &amp; Minor Protection">
        <p>
          VyaparMedia is strictly an enterprise commercial marketplace. Users must be at least 18 years of age to open an account, accept brand contracts, or receive financial disbursements. If we identify that an account belongs to a minor without parental/guardian guardianship contracts, the account will be immediately paused.
        </p>
      </LegalSection>

      {/* 9 */}
      <LegalSection id="contact" heading="9. Grievance Redressal &amp; Contact" highlight>
        <p>
          For privacy inquiries, data rectification, or formal grievances under Indian Information Technology regulations, contact our Data Protection and Grievance Cell:
        </p>
        <div className="rounded-xl border border-border bg-card p-5 mt-4 space-y-2 text-sm not-prose">
          <p><strong className="text-foreground">Corporate Entity:</strong> {PLATFORM_CONFIG.legalName}</p>
          <p><strong className="text-foreground">Corporate Identity Number (CIN):</strong> <span className="font-mono">{PLATFORM_CONFIG.cin}</span></p>
          <p><strong className="text-foreground">Registered Office Address:</strong> {PLATFORM_CONFIG.address}</p>
          <p><strong className="text-foreground">Designated Officer:</strong> Grievance Redressal &amp; Data Protection Officer</p>
          <p>
            <strong className="text-foreground">Direct Email:</strong>{" "}
            <a href={`mailto:${PLATFORM_CONFIG.privacyEmail}`} className="text-primary font-bold hover:underline">
              {PLATFORM_CONFIG.privacyEmail}
            </a>
          </p>
          <p className="text-xs text-muted-foreground pt-1 border-t border-border/60">
            DPDP Act &amp; IT Rules Grievance SLA: Acknowledged within 24 hours and addressed within 15 working days.
          </p>
        </div>
      </LegalSection>
    </LegalLayout>
  );
}
