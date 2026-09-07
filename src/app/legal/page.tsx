"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const legalPages = [
{
title: "Privacy Policy",
href: "/privacy",
body: "Personal data, KYC, payment records, messaging, retention, user rights, and grievance contact details.",
},
{
title: "Terms of Service",
href: "/terms",
body: "Marketplace rules for brands, influencers, admins, contracts, payments, disputes, usage rights, and enforcement.",
},
{
title: "Refund and Cancellation Policy",
href: "/refund",
body: "Deal-stage refund rules, dispute outcomes, wallet refunds, original-source timelines, and evidence requirements.",
},
{
title: "Cookie Policy",
href: "/cookie-policy",
body: "Cookies, local storage, service worker cache, PWA storage, provider cookies, and browser controls.",
},
];

export default function LegalPage() {
return (
<div className="flex flex-col min-h-screen">
<Navbar />

<main className="flex-1 pt-20">
<section className="section">
<div className="container max-w-980">
<h1
className="section-title gradient-text mb-3 text-3xl font-extrabold"
>
Legal Center
</h1>
<p className="text-secondary font-semibold max-w-720 mb-8">
Core policies for VyaparMedia users, including India-focused marketplace,
payment, privacy, tax-readiness, and dispute workflows.
</p>

<div className="grid grid-auto-240 gap-18px">
{legalPages.map((page) => (
<Link
key={page.href}
href={page.href}
className="card grid border-card text-inherit no-underline gap-2.5 bg-glass legal-card"
>
<h2 className="text-lg text-primary font-black-850">
{page.title}
</h2>
<p className="text-secondary text-sm leading-relaxed-1-65">
{page.body}
</p>
<span className="text-primary font-extrabold text-sm">
Open policy
</span>
</Link>
))}
</div>
</div>
</section>
</main>

<Footer />
</div>
);
}
