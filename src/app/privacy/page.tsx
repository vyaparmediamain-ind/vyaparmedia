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
      <LegalSection id="sharing" heading="5. Authorized Service Providers &amp; Cross-Border Transfers">
        <p className="mb-4">
          We do not sell, rent, or trade your personal data. We disclose strictly scoped data to authorized infrastructure partners and sub-processors under strict confidentiality and Data Processing Agreements (DPAs) in compliance with the Digital Personal Data Protection (DPDP) Act, 2023:
        </p>

        <div className="overflow-x-auto not-prose my-4">
          <table className="w-full text-xs text-left border border-border rounded-lg overflow-hidden">
            <thead className="bg-muted text-foreground font-semibold">
              <tr className="border-b border-border">
                <th className="p-2.5">Sub-Processor</th>
                <th className="p-2.5">Purpose</th>
                <th className="p-2.5">Data Shared</th>
                <th className="p-2.5">Location &amp; Cross-Border</th>
                <th className="p-2.5">Account Erasure Policy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-muted-foreground">
              <tr>
                <td className="p-2.5 font-medium text-foreground">Razorpay</td>
                <td className="p-2.5">Payment gateway, milestone escrow, bank penny-drop</td>
                <td className="p-2.5">Name, Bank Account, IFSC, Transaction Amount</td>
                <td className="p-2.5">India</td>
                <td className="p-2.5">Retained 7 yrs (PMLA &amp; RBI compliance)</td>
              </tr>
              <tr>
                <td className="p-2.5 font-medium text-foreground">Shiprocket</td>
                <td className="p-2.5">Product sample shipping &amp; automated dispatch labels</td>
                <td className="p-2.5">Recipient Name, Shipping Address, Phone</td>
                <td className="p-2.5">India</td>
                <td className="p-2.5">Purged after shipment settlement</td>
              </tr>
              <tr>
                <td className="p-2.5 font-medium text-foreground">Surepass &amp; DigiLocker</td>
                <td className="p-2.5">Statutory identity verification (PAN, Aadhaar)</td>
                <td className="p-2.5">PAN / Aadhaar token, Legal Name, DOB</td>
                <td className="p-2.5">India</td>
                <td className="p-2.5">Ephemeral verification; zero raw image retention</td>
              </tr>
              <tr>
                <td className="p-2.5 font-medium text-foreground">MSG91</td>
                <td className="p-2.5">DLT-registered transactional SMS &amp; OTPs</td>
                <td className="p-2.5">Phone Number, 6-digit OTP</td>
                <td className="p-2.5">India</td>
                <td className="p-2.5">Delivery reports purged after 30 days</td>
              </tr>
              <tr>
                <td className="p-2.5 font-medium text-foreground">Twilio &amp; Meta</td>
                <td className="p-2.5">WhatsApp / SMS notifications &amp; authentication</td>
                <td className="p-2.5">Phone Number, Transactional Template data</td>
                <td className="p-2.5">USA / Ireland (Standard Contractual Clauses)</td>
                <td className="p-2.5">Purged from message logs within 30 days</td>
              </tr>
              <tr>
                <td className="p-2.5 font-medium text-foreground">Resend</td>
                <td className="p-2.5">Transactional emails &amp; system alerts</td>
                <td className="p-2.5">Email address, First Name, Notification Body</td>
                <td className="p-2.5">USA (Adequacy / DPA safeguards)</td>
                <td className="p-2.5">Suppression record maintained upon unsubscribe</td>
              </tr>
              <tr>
                <td className="p-2.5 font-medium text-foreground">Upstash Redis &amp; QStash</td>
                <td className="p-2.5">Distributed rate-limiting, idempotency &amp; cron scheduling</td>
                <td className="p-2.5">Hashed IPs, Session IDs, Scoped Job Payloads</td>
                <td className="p-2.5">USA / Germany (Encrypted in transit)</td>
                <td className="p-2.5">Automatic TTL expiry (1 hr to 30 days)</td>
              </tr>
              <tr>
                <td className="p-2.5 font-medium text-foreground">Supabase</td>
                <td className="p-2.5">Relational database storage &amp; real-time messaging</td>
                <td className="p-2.5">Encrypted User records, Deals, Invoices</td>
                <td className="p-2.5">India (AWS Mumbai ap-south-1)</td>
                <td className="p-2.5">Soft-delete with cryptographic anonymization</td>
              </tr>
              <tr>
                <td className="p-2.5 font-medium text-foreground">Cloudflare R2 / AWS S3</td>
                <td className="p-2.5">Encrypted document storage (Tax invoices, media)</td>
                <td className="p-2.5">Contract PDFs, Invoices, Delivery Previews</td>
                <td className="p-2.5">India &amp; Global Edge CDN (AES-256)</td>
                <td className="p-2.5">Permanent bucket purge upon approved erasure</td>
              </tr>
              <tr>
                <td className="p-2.5 font-medium text-foreground">Sentry</td>
                <td className="p-2.5">Error monitoring &amp; platform stability telemetry</td>
                <td className="p-2.5">Stack traces (PII scrubbed at client &amp; edge)</td>
                <td className="p-2.5">USA (Zero-PII Data Scrubbing DPA)</td>
                <td className="p-2.5">Rolling 30-day retention window</td>
              </tr>
              <tr>
                <td className="p-2.5 font-medium text-foreground">Google Cloud Vision</td>
                <td className="p-2.5">Automated attachment safety &amp; contact leak detection</td>
                <td className="p-2.5">Transient base64 image data (in-memory only)</td>
                <td className="p-2.5">USA (Encrypted TLS 1.3)</td>
                <td className="p-2.5">Zero retention; strictly ephemeral memory analysis</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-xs text-muted-foreground mt-2">
          Cross-border data transfers to jurisdictions outside India are executed strictly with vendors that provide comparable data protection standards pursuant to Section 16 of the DPDP Act, 2023 and under binding Data Processing Agreements.
        </p>
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
