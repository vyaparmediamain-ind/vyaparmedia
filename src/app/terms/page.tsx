"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function TermsPage() {
const lastUpdated = "June 20, 2026";

return (
<div className="flex flex-col min-h-screen">
<Navbar />

<main className="flex-1 pt-20">
<section className="section">
<div className="container max-w-920">
<h1
className="section-title gradient-text mb-3 text-3xl font-extrabold"
>
Terms of Service
</h1>
<p className="text-secondary font-semibold mb-10">
Last updated: {lastUpdated}
</p>

<div className="text-secondary grid gap-8 leading-relaxed text-sm">
<section>
<h2 className="terms-heading">1. Agreement</h2>
<p>
These Terms govern your use of VyaparMedia. By using the website, PWA,
dashboard, APIs, messaging, payments, verification, campaign, or dispute
tools, you agree to these Terms and our linked policies. If you do not agree,
do not use the platform.
</p>
<p>
VyaparMedia provides marketplace, workflow, ledger, verification, and dispute
tooling. We are not a law firm, tax advisor, advertising regulator, payment
bank, or talent agent. Users remain responsible for independent legal, tax,
advertising, and accounting advice for their campaigns.
</p>
</section>

<section className="card terms-panel">
<h2 className="terms-heading">2. Roles and eligibility</h2>
<div className="grid gap-4 grid-auto-240">
<div className="terms-mini-panel">
<h3 className="terms-subheading">Brands</h3>
<p>Brands create briefs, fund campaign budgets, review work, approve content, and follow applicable advertising, tax, and platform rules.</p>
</div>
<div className="terms-mini-panel">
<h3 className="terms-subheading">Influencers</h3>
<p>Influencers apply to campaigns, deliver original content, disclose sponsored work, maintain linked social accounts, and meet agreed deadlines.</p>
</div>
<div className="terms-mini-panel">
<h3 className="terms-subheading">Admins</h3>
<p>Admins review verification, disputes, payouts, safety signals, and platform compliance. Admin access is granted only through secure sessions.</p>
</div>
</div>
<p className="mt-4">
You must be at least 18 years old and legally able to enter commercial
agreements. You are responsible for keeping your account secure and accurate.
You must not allow another person to use your account, and businesses must
ensure that employees or contractors using the account are authorized.
</p>
</section>

<section>
<h2 className="terms-heading">3. Verification, KYC, and trust systems</h2>
<p>
VyaparMedia may require email, phone, PAN, Aadhaar-related verification, bank,
GSTIN, CIN, ITR, social account, business, or content ownership checks before
allowing higher-value campaigns, withdrawals, payouts, or admin-sensitive
actions. We may limit, pause, or reject activity when verification is missing,
inconsistent, expired, fraudulent, or risky.
</p>
<p>
Verification does not guarantee that a user is safe, solvent, lawful, or
suitable for every campaign. It only means that VyaparMedia has completed the
checks available to it at that point in time.
</p>
</section>

<section>
<h2 className="terms-heading">4. Campaigns, contracts, and deliverables</h2>
<ul className="list-disc pl-6 space-y-2">
<li>Campaign briefs must be lawful, clear, complete, and not misleading.</li>
<li>Creators must submit original content that matches agreed deliverables, deadlines, mandatory tags, and disclosure requirements.</li>
<li>Contracts may be generated and signed electronically. A deal becomes active only when required parties complete signing and payment checks.</li>
<li>Brands must review submitted content within the platform review window or the system may auto-approve eligible submissions.</li>
<li>Influencers must keep campaign posts live for the agreed monitoring period unless the contract allows removal.</li>
<li>Health, finance, gaming, alcohol, political, children-facing, and regulated category campaigns may require additional disclosures or may be refused.</li>
</ul>
</section>

<section>
<h2 className="terms-heading">5. Payments, escrow, fees, tax, and payouts</h2>
<p>
Campaign funds may be collected upfront and held through Razorpay and our
internal ledger until release, refund, dispute resolution, or expiry. Platform
fees, gateway fees, taxes, TDS, GST, withholding, invoices, and bank charges
may apply based on role, transaction type, location, verification status, and
applicable law. Users are responsible for their own tax filings and declarations.
</p>
<ul className="list-disc pl-6 space-y-2 mt-3">
<li>Payouts may be blocked until PAN, bank, KYC, and tax readiness checks are complete.</li>
<li>Where VyaparMedia is required to deduct or report tax, payout records may include TDS, GST, invoice, and Form 26AS/AIS-supporting metadata.</li>
<li>GST registration, e-invoicing, reverse charge, place-of-supply, and input-tax-credit treatment can depend on the user, campaign, invoice, and current law.</li>
<li>Chargebacks, gateway reversals, duplicate credits, fraud, or post-removal events may lead to wallet holds, clawbacks, debt recovery, or payout suspension.</li>
</ul>
</section>

<section>
<h2 className="terms-heading">6. Prohibited conduct</h2>
<ul className="list-disc pl-6 space-y-2">
<li>Fake followers, engagement pods, bot traffic, fake screenshots, fake invoices, or manipulated post analytics.</li>
<li>Bypassing platform payments, sharing private contact details to avoid fees, or soliciting off-platform settlements.</li>
<li>Fraudulent KYC, impersonation, unauthorized brand use, misleading health or financial claims, or unlawful promotional content.</li>
<li>Harassment, hate, explicit abuse, spam, malware, scraping, account resale, or attempts to access another user's account.</li>
<li>Uploading another person's PAN, GSTIN, bank proof, address, social account, or content without authority.</li>
<li>Campaigns or content that violate ASCI guidance, platform policies, intellectual-property rights, privacy rights, or applicable Indian law.</li>
</ul>
</section>

<section>
<h2 className="terms-heading">7. Content rights</h2>
<p>
Unless a deal states otherwise, creators keep ownership of their underlying
content, while brands receive the usage rights described in the approved brief,
contract, or deal terms after payment release. VyaparMedia may use limited
platform metadata, screenshots, or excerpts for safety, audit, support, dispute,
and product improvement purposes.
</p>
<p>
Brands must not use creator content beyond the agreed scope, duration, media,
territory, paid-ad rights, whitelisting rights, exclusivity, or sublicensing
terms. Creators must not reuse confidential brand briefs, unreleased products,
coupon codes, or campaign data except as allowed by the deal.
</p>
</section>

<section>
<h2 className="terms-heading">8. Disputes and enforcement</h2>
<p>
Disputes must be raised before final approval or payout release unless the issue
relates to fraud, post deletion, or a continuing obligation. We may review
briefs, chat logs, submissions, live post URLs, payment records, and verification
evidence. We may issue refunds, partial releases, clawbacks, warnings, strikes,
suspensions, or account bans where required.
</p>
<p>
Party-triggered acceptance of a suggested resolution is final for normal
marketplace purposes unless VyaparMedia later discovers fraud, duplicate payment,
system error, legal compulsion, or materially false evidence.
</p>
</section>

<section>
<h2 className="terms-heading">9. India tax and compliance responsibilities</h2>
<ul className="list-disc pl-6 space-y-2">
<li>Creators and brands must provide accurate PAN, GSTIN, legal name, address, bank, and invoice information where requested.</li>
<li>Users must file their own income-tax, GST, ITR, professional tax, and other statutory returns where applicable.</li>
<li>Influencer marketing content must include required sponsorship disclosures such as clear ad, paid partnership, or brand-collaboration labels where applicable.</li>
<li>VyaparMedia may update compliance rules when tax, KYC, advertising, platform, or payment regulations change.</li>
</ul>
</section>

<section>
<h2 className="terms-heading">10. Service availability and liability</h2>
<p>
We work to keep VyaparMedia reliable, but we do not guarantee uninterrupted
access, campaign outcomes, social platform API availability, creator performance,
or brand sales results. To the maximum extent allowed by law, VyaparMedia is not
liable for indirect, consequential, speculative, or lost-profit damages.
</p>
<p>
Nothing in these Terms excludes liability that cannot be excluded under
applicable law. Any platform liability is limited to the amount of platform
fees actually received by VyaparMedia from the affected transaction in the
three months before the claim, unless a different mandatory rule applies.
</p>
</section>

<section className="bg-secondary rounded-lg border-card p-6">
<h2 className="terms-heading">11. Contact</h2>
<p>
For Terms questions, legal notices, or compliance escalation, email{" "}
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
