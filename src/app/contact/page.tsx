"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";

const contactRows = [
  {
    title: "Creator & Brand Support",
    body: "Assistance with campaigns, deliverables, escrow withdrawals, verification, and dashboard tools.",
    href: "mailto:support@vyaparmedia.in",
    label: "support@vyaparmedia.in",
  },
  {
    title: "Business & Agency Partnerships",
    body: "Enterprise campaign management, D2C brand onboarding, talent agency rosters, and API integrations.",
    href: "mailto:partnerships@vyaparmedia.in",
    label: "partnerships@vyaparmedia.in",
  },
  {
    title: "Legal, Tax & Compliance",
    body: "GST invoicing queries, TDS certificate requests, contracts, and regulatory compliance.",
    href: "mailto:legal@vyaparmedia.in",
    label: "legal@vyaparmedia.in",
  },
];

export default function ContactPage() {
return (
<div className="flex flex-col min-h-screen">
<Navbar />

<main className="flex-1 pt-20">
<section className="section">
<div className="container max-w-1040">
<div className="text-center mb-10">
<h1 className="section-title">
Contact <span className="gradient-text">VyaparMedia</span>
</h1>
<p className="section-subtitle">
Reach the right team for support, partnerships, privacy, or legal requests.
</p>
</div>

<div className="grid-2 gap-8 items-start">
<div className="grid gap-18px">
{contactRows.map((row) => (
<article key={row.title} className="card">
<h2 className="text-xl font-extrabold mb-2">
{row.title}
</h2>
<p className="text-secondary mb-3 leading-relaxed">
{row.body}
</p>
<a href={row.href} className="text-primary font-bold">
{row.label}
</a>
</article>
))}
</div>

<div className="card">
<h2 className="text-2xl font-extrabold mb-4">
Fastest support path
</h2>
<p className="text-secondary mb-5 leading-relaxed">
Logged-in users should use the dashboard so we can attach the right account,
campaign, deal, payout, or dispute record to the request.
</p>
<div className="grid gap-3">
<Link href="/dashboard/messages" className="btn btn-primary justify-center">
Open Dashboard Messages
</Link>
<Link href="/dashboard/disputes" className="btn btn-secondary justify-center">
Open Dispute Center
</Link>
</div>
<div className="mt-6 border-t border-card pt-5">
<h3 className="text-base font-extrabold mb-2">
Response windows
</h3>
<p className="text-secondary leading-relaxed">
Support: 1 to 2 business days. Payment or security escalations are prioritized.
Legal notices should be sent by email and include account identifiers where relevant.
</p>
</div>
</div>
</div>
</div>
</section>
</main>

<Footer />
</div>
);
}

