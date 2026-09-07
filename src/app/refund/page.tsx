"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";

export default function RefundPage() {
const lastUpdated = "June 20, 2026";

return (
<div className="flex flex-col min-h-screen">
<Navbar />

<main className="flex-1 pt-20">
<section className="section">
<div className="container max-w-880">
<h1 className="section-title gradient-text mb-3 text-3xl font-extrabold">
Refund and Cancellation Policy
</h1>
<p className="text-secondary font-semibold mb-10">
Last updated: {lastUpdated}
</p>

<div className="text-secondary grid gap-8 leading-relaxed text-sm">
<section>
<h2 className="text-xl font-extrabold mb-14px text-primary">1. How protected payments work</h2>
<p>
VyaparMedia uses funded campaign budgets, payment holds, wallet ledgers, and
deal status checks to protect both brands and influencers. Refund eligibility
depends on the deal stage, evidence, platform fees, tax treatment, and whether
work has already been approved or auto-approved.
</p>
<p>
This policy covers platform-managed campaign payments. It does not override a
signed deal, statutory rights, payment gateway rules, bank timelines, or an
admin dispute decision.
</p>
</section>

<section className="card refund-panel-rose">
<h2 className="text-xl font-extrabold mb-14px text-primary">2. Brand cancellations</h2>
<ul className="list-disc pl-6 space-y-3">
<li>
<strong>Before influencer selection:</strong> Uncommitted campaign funds may
be returned to the brand wallet or original payment method, subject to gateway
and statutory adjustments.
</li>
<li>
<strong>After selection but before work starts:</strong> Cancellation may
require creator consent or admin review if the creator has already accepted
the deal.
</li>
<li>
<strong>After content submission:</strong> Refunds are handled through the
content review or dispute flow. Brands should request revisions or raise a
dispute before approving content.
</li>
<li>
<strong>After approval or auto-approval:</strong> Payments are generally final
unless fraud, post deletion, contract breach, or a continuing obligation is
proven.
</li>
<li>
<strong>After payout release:</strong> Refunds may require clawback, wallet
debt recovery, or manual review and may not be immediately recoverable from
the influencer.
</li>
</ul>
</section>

<section>
<h2 className="text-xl font-extrabold mb-14px text-primary">3. Influencer cancellations</h2>
<p>
Influencers should decline unsuitable work before signing. After signing, missed
deadlines, non-delivery, copied content, misleading metrics, or unapproved
substitutions may result in cancellation, partial payment, refund, strikes, or
account restrictions.
</p>
<p>
If a creator has already performed approved work, cancellation by the creator
may still lead to partial payment where the brand received usable deliverables
or licensed rights.
</p>
</section>

<section>
<h2 className="text-xl font-extrabold mb-14px text-primary">4. Non-refundable amounts</h2>
<ul className="list-disc pl-6 space-y-2">
<li>Gateway charges, bank charges, payout charges, or taxes already incurred.</li>
<li>Platform service fees for completed or substantially performed work.</li>
<li>Approved content, unless fraud or a material contract breach is established.</li>
<li>Product samples, shipping, or third-party costs unless the deal terms state otherwise.</li>
<li>TDS, GST, invoice adjustments, or statutory amounts already reported, unless reversal is legally and operationally possible.</li>
</ul>
</section>

<section>
<h2 className="text-xl font-extrabold mb-14px text-primary">5. Refund timing</h2>
<p>
Approved refunds are usually credited to the VyaparMedia wallet first. If a
refund to the original payment method is supported, Razorpay or the banking
partner may take 5 to 10 business days after processing. Timelines can vary
based on bank holidays, payment method, KYC status, disputes, and compliance
review.
</p>
<p>
Wallet refunds are generally faster because they remain inside VyaparMedia.
Original-source refunds and released pre-authorizations depend on Razorpay,
card networks, UPI, banks, and settlement cut-offs.
</p>
</section>

<section>
<h2 className="text-xl font-extrabold mb-14px text-primary">6. Dispute outcomes and evidence</h2>
<ul className="list-disc pl-6 space-y-2">
<li>Full brand refund: usually applies to non-delivery, verified fraud, or major breach before accepted work.</li>
<li>Partial split: may apply where some deliverables were usable, late, incomplete, or disputed in good faith.</li>
<li>Full creator payout: usually applies where the brand missed the review window, approved content, or failed to show breach.</li>
<li>Post-removal clawback: may apply if a live post is deleted, made private, materially edited, or loses required disclosures during the monitoring window.</li>
</ul>
</section>

<section>
<h2 className="text-xl font-extrabold mb-14px text-primary">7. How to request a refund</h2>
<p>
Use the deal or Dispute Center flow and include the campaign ID, deal ID,
relevant screenshots, post URLs, chat evidence, deadline evidence, and the
specific refund reason. Off-platform evidence may be considered but cannot be
guaranteed if authenticity is unclear.
</p>
</section>

<section className="text-center bg-secondary rounded-lg border-card p-6">
<p className="text-sm text-muted">
Need a refund review or dispute?
<Link href="/dashboard/disputes" className="text-primary font-bold no-underline ml-1">
Open Dispute Center
</Link>
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




