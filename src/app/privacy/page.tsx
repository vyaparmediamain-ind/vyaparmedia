"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function PrivacyPage() {
const lastUpdated = "June 20, 2026";

return (
<div className="flex flex-col min-h-screen">
<Navbar />

<main className="flex-1 pt-20">
<section className="section">
<div className="container max-w-900">
<h1
className="section-title gradient-text mb-3 text-3xl font-extrabold"
>
Privacy Policy
</h1>
<p className="text-secondary font-semibold mb-10">
Last updated: {lastUpdated}
</p>

<div className="text-secondary grid gap-8 leading-relaxed text-sm">
<section>
<h2 className="terms-heading">1. Who we are</h2>
<p>
VyaparMedia operates an India-focused influencer collaboration marketplace
for brands, creators, and platform administrators. This Privacy Policy
explains how we collect, use, disclose, retain, and protect personal data
when you use our website, installable PWA, dashboards, APIs, support
channels, payments, verification, messaging, content monitoring, and dispute
tools.
</p>
</section>

<section className="card terms-panel">
<h2 className="terms-heading">2. Information we collect</h2>
<ul className="list-disc pl-6 space-y-3">
<li>
<strong>Account data:</strong> name, email, phone number, password hash,
role, login history, device details, IP address, session identifiers, and
security events.
</li>
<li>
<strong>Profile data:</strong> creator bio, city, languages, categories,
rates, social handles, audience metrics, brand profile details, website,
business identifiers, and profile media.
</li>
<li>
<strong>Verification data:</strong> PAN, Aadhaar-related verification
evidence, GSTIN, CIN, bank account proof, cancelled cheque or statement
metadata, selfies or liveness evidence where enabled, ITR acknowledgement
details, business address, beneficial-owner details where required, and KYC
review status. Sensitive identifiers are encrypted, masked, or tokenized
where the platform only needs reference data.
</li>
<li>
<strong>Transaction data:</strong> wallet balances, payment holds, Razorpay
order/payment IDs, payouts, refunds, disputes, ledger entries, invoices, tax
metadata, and withdrawal details.
</li>
<li>
<strong>Collaboration data:</strong> campaign briefs, proposals, contracts,
deliverables, submitted content, live post URLs, approvals, reviews, chat
messages, typing/read status, notifications, and support requests.
</li>
<li>
<strong>Usage data:</strong> pages viewed, button clicks, feature usage,
error logs, service worker state, device/browser type, and performance
diagnostics.
</li>
<li>
<strong>Third-party verification data:</strong> verification outcomes,
provider reference IDs, social account authorization status, content API
responses, payment gateway event IDs, and fraud/risk signals returned by
service providers.
</li>
</ul>
</section>

<section>
<h2 className="terms-heading">3. Why we use your data</h2>
<ul className="list-disc pl-6 space-y-2">
<li>To create accounts, authenticate users, prevent account takeover, and provide role-based access.</li>
<li>To verify creators and brands, calculate trust scores, enforce tier limits, and reduce fraud.</li>
<li>To run campaigns, applications, deals, contracts, payments, refunds, withdrawals, and disputes.</li>
<li>To support GST, ITR, TDS, payout, invoice, audit, accounting, and legal record requirements.</li>
<li>To comply with KYC, fraud-prevention, anti-abuse, taxation, payment, and lawful request obligations.</li>
<li>To send OTPs, security alerts, payment notifications, deal updates, and support responses.</li>
<li>To improve matching, analytics, PWA reliability, content verification, and platform safety.</li>
</ul>
</section>

<section>
<h2 className="terms-heading">4. Consent, lawful use, and user rights</h2>
<p>
We process personal data for account performance, consent-based actions,
security, legal compliance, and other lawful platform purposes. Where consent
is required, you can withdraw it through account settings or by contacting us.
You may request access, correction, deletion, grievance redressal, or nomination
support as available under applicable Indian data protection law.
</p>
<p>
Some requests may be limited where we must retain payment, tax, KYC, dispute,
fraud-prevention, audit, or legal records. If account deletion is approved, we
may anonymize operational profile data while retaining statutory financial and
security records.
</p>
</section>

<section>
<h2 className="terms-heading">5. Sharing with service providers</h2>
<p>
We do not sell personal data. We share limited data with providers who help us
operate the service, including Supabase/Postgres hosting, Upstash Redis,
Cloudflare R2 or S3 storage, Vercel hosting, Razorpay payments, email delivery,
WhatsApp/SMS OTP delivery, KYC providers, analytics/observability tools, social
platform APIs, legal/accounting advisors, and law enforcement or regulators
when required.
</p>
<p>
Providers are expected to process data only for authorized service purposes.
Cross-border processing may occur where hosting, analytics, support, payment,
or verification providers operate outside India, subject to applicable law and
contractual safeguards.
</p>
</section>

<section>
<h2 className="terms-heading">6. Security and retention</h2>
<p>
We use access controls, encryption, token revocation, rate limits, audit logs,
fraud checks, and least-privilege workflows. We retain records only for as long
as needed for platform operations, dispute handling, statutory retention, tax,
accounting, fraud prevention, and legal obligations. Financial, tax, and audit
records may be retained even after account deletion where the law requires it.
</p>
<p>
No online system is risk-free. Users must keep passwords, OTPs, devices, and
linked email or phone accounts secure and must report suspected unauthorized
access promptly.
</p>
</section>

<section>
<h2 className="terms-heading">7. Automated checks and trust scoring</h2>
<p>
VyaparMedia may use rule-based and automated checks for fraud prevention,
content verification, trust scoring, limits, dispute triage, payout review,
and account security. These systems may use account history, verification
status, delivery timelines, complaint patterns, payment events, and social
platform signals. You can contact support if you believe an automated action
is incorrect.
</p>
</section>

<section>
<h2 className="terms-heading">8. Children and prohibited use</h2>
<p>
VyaparMedia is intended for users who can enter into binding commercial
relationships. Users under 18 may not create creator, brand, or admin accounts.
If we learn that a minor has created an account, we may suspend the account and
delete non-essential data.
</p>
</section>

<section>
<h2 className="terms-heading">9. Contact and grievance redressal</h2>
<p>
For privacy requests, account deletion, correction, consent withdrawal, or
grievance escalation, contact us at{" "}
<a href="mailto:privacy@VyaparMedia.in" className="terms-link">privacy@VyaparMedia.in</a>.
For legal notices, contact{" "}
<a href="mailto:legal@VyaparMedia.in" className="terms-link">legal@VyaparMedia.in</a>.
</p>
</section>
</div>
</div>
</section>
</main>

<Footer />
</div>
);
}
