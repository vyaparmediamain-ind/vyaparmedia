"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useState } from "react";
import { Button, Input } from "@/components/ui";
import { z } from "zod";

interface BlogPost {
id: string;
category: string;
title: string;
description: string;
readTime: string;
date: string;
contentJSX: () => React.JSX.Element;
}

const BLOG_POSTS: BlogPost[] = [
{
    id: "tds-compliance-194o",
    category: "Compliance",
    title: "TDS Compliance under Section 194-O for Creators",
    description: "An operational deep-dive into the 0.1% TDS deduction rule on e-commerce platform payouts for Indian influencers.",
    readTime: "6 min read",
    date: "July 28, 2026",
    contentJSX: () => (
      <div className="text-left space-y-6 text-secondary">
        <p className="text-base leading-relaxed">
          Under the Indian Income Tax Act, Section 194-O mandates that e-commerce operators deduct Tax Deducted at Source (TDS) at the rate of 0.1% on the gross amount of sales or services facilitated through their digital platforms.
        </p>

        <h3 className="text-xl font-bold text-white mt-8">Key Highlights for Influencers</h3>
        <ol className="list-decimal pl-6 space-y-3">
          <li>
            <strong>Who is an E-commerce Operator?</strong>: Platforms (like VyaparMedia) that facilitate transactions between brands and creators are classified as e-commerce operators.
          </li>
          <li>
            <strong>The 0.1% TDS Rate</strong>: The platform is legally required to deduct 0.1% TDS on the total payment due to the creator before releasing the payout (once the financial year threshold is crossed).
          </li>
          <li>
            <strong>PAN Requirement</strong>: Ensure your PAN is correctly updated in your VyaparMedia Wallet. If a PAN is not provided, the TDS deduction rate rises to a hefty 20% under Section 206AA.
          </li>
          <li>
            <strong>Threshold Limits</strong>: If you are an individual creator and your gross sales/services via the platform do not exceed ₹5,00,000 in a financial year, no TDS is deducted (provided you have furnished your PAN).
          </li>
        </ol>

        <h3 className="text-xl font-bold text-white mt-8">How to File and Claim Refund</h3>
        <p className="text-base leading-relaxed">
          All TDS deductions will be reported in your Form 26AS. You can claim credits or refunds for these deductions when filing your annual Income Tax Return (ITR) under Form ITR-3 or ITR-4.
        </p>
      </div>
    )
},
{
id: "gst-invoicing-creators",
category: "GST & Tax",
title: "GST Invoicing Rules for Indian Creator Economy",
description: "Learn when you need a GSTIN, how to file interstate invoices, and how to structure your invoices for brands.",
readTime: "5 min read",
date: "June 15, 2026",
contentJSX: () => (
<div className="text-left space-y-6 text-secondary">
<p className="text-base leading-relaxed">
As influencer marketing scales in India, the Goods and Services Tax (GST) department is actively monitoring promotional services. Here is what every professional creator needs to know.
</p>

<h3 className="text-xl font-bold text-white mt-8">When is GST Registration Mandatory?</h3>
<ul className="list-disc pl-6 space-y-3">
<li>
<strong>Turnover Threshold</strong>: If your aggregate turnover from brand collaborations exceeds 20 Lakhs in a financial year (10 Lakhs for special category northeastern states), you must register for GST.
</li>
<li>
<strong>Interstate Supply</strong>: If you are based in Karnataka and collaborate with a brand registered in Maharashtra, it constitutes an interstate service. Under Section 24 of the CGST Act, compulsory registration is required for interstate services, subject to current exemption notifications.
</li>
</ul>

<h3 className="text-xl font-bold text-white mt-8">How to Structure Your Invoice</h3>
<p className="text-base leading-relaxed">
Your invoice must contain:
</p>
<ol className="list-decimal pl-6 space-y-3">
<li>Name, address, and GSTIN of the creator (supplier).</li>
<li>Name, address, and GSTIN of the brand (recipient).</li>
<li>A unique sequential invoice number.</li>
<li>
<strong>HSN/SAC Code</strong>: For promotional/creative services, use SAC Code <strong>998313</strong> (Information technology design and development services) or <strong>998369</strong> (Other professional/technical services).
</li>
<li>
<strong>Tax rate</strong>: Standard GST on influencer services is <strong>18%</strong> (CGST 9% + SGST 9% for intrastate, or IGST 18% for interstate).
</li>
</ol>
</div>
)
},
{
id: "fake-engagement-audit",
category: "Operations",
title: "Fake Engagement Audit: Brand Vetting Checklist",
description: "A practical guide for brands and compliance officers to vet creator profiles, spot bot comments, and analyze engagement rates.",
readTime: "8 min read",
date: "May 10, 2026",
contentJSX: () => (
<div className="text-left space-y-6 text-secondary">
<p className="text-base leading-relaxed">
Fake followers and artificial engagement cost brands millions annually. This checklist helps you audit creator authenticity before launching campaigns.
</p>

<h3 className="text-xl font-bold text-white mt-8">The Auditing Metrics</h3>
<ul className="list-disc pl-6 space-y-3">
<li>
<strong>Engagement Rate vs. Follower Count</strong>:
<ul className="list-circle pl-6 mt-2 space-y-1">
<li>&lt; 10K followers: ~4-5% engagement rate is healthy.</li>
<li>10K - 100K followers: ~2-3% engagement rate.</li>
<li>&gt; 100K followers: ~1.5-2% engagement rate.</li>
</ul>
Extremely high (&gt;15%) or extremely low (&lt;0.2%) engagement rates are red flags.
</li>
<li>
<strong>Comment-to-Like Ratio</strong>: A healthy comment-to-like ratio is typically 1:100 to 5:100. If a post has 10,000 likes but only 2 comments, the likes are likely purchased.
</li>
<li>
<strong>Quality of Comments</strong>:
Bots generate generic comments like "Nice picture!", "Amazing!", "", or "Cool". Real audiences write contextual comments referencing specific details from the post.
</li>
<li>
<strong>Follower Growth Graph</strong>: Steady, organic growth is normal. Sudden spikes (e.g., gaining 10k followers in a single day without a viral post) indicate purchased followers.
</li>
</ul>
</div>
)
}
];

export default function BlogPage() {
const [email, setEmail] = useState("");
const [loading, setLoading] = useState(false);
const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

const handleSubmit = async (e: React.FormEvent) => {
e.preventDefault();
setStatus(null);

const validation = z.string().email("Please enter a valid email address").safeParse(email.trim());
if (!validation.success) {
setStatus({
type: "error",
message: validation.error.issues[0]?.message || "Invalid email address",
});
return;
}

setLoading(true);

try {
const res = await fetch("/api/blog/subscribe", {
method: "POST",
headers: {
"Content-Type": "application/json",
},
body: JSON.stringify({ email }),
});

const data = await res.json();
if (!res.ok) {
throw new Error(data.message || data.error || "Failed to subscribe.");
}

setStatus({
type: "success",
message: "Thank you! Please check your inbox to verify your subscription.",
});
setEmail("");
} catch (err: unknown) {
setStatus({
type: "error",
message: (err instanceof Error ? err.message : String(err)) || "Failed to subscribe. Please try again.",
});
} finally {
setLoading(false);
}
};

const selectedPost = BLOG_POSTS.find(p => p.id === selectedPostId);

return (
<div className="flex flex-col min-h-screen bg-primary">
<Navbar />

<main className="flex-1 pt-30 pb-20">
<section className="section w-full relative">
<div className="blog-glow absolute pointer-events-none z-0" />

<div className="container relative z-1 max-w-1000 mx-auto px-6">
{!selectedPost ? (
// Blog Home
<>
<div className="text-center max-w-640 mx-auto mb-16">
<div className="badge badge-primary animate-fade-in mb-6 text-xs font-extrabold uppercase px-4 py-2 tracking-wider">
Knowledge Base
</div>
<h1 className="blog-title section-title animate-fade-in mb-5 font-extrabold text-4xl">
Practical Guides & Compliance
</h1>
<p className="blog-subtitle section-subtitle animate-fade-in text-secondary text-base">
Operational playbooks and regulatory compliance guides for the Indian influencer marketing ecosystem.
</p>
</div>

<div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
{BLOG_POSTS.map(post => (
<article
key={post.id}
className="card glass border-card p-6 flex flex-col justify-between hover:scale-102 transition-transform duration-300"
>
<div>
<span className="text-2xs font-extrabold text-gradient uppercase tracking-widest block mb-2">
{post.category}
</span>
<h2 className="text-lg font-bold mb-3 text-white">
{post.title}
</h2>
<p className="text-secondary text-xs leading-relaxed mb-4">
{post.description}
</p>
</div>
<div className="flex items-center justify-between border-t border-card-border pt-4 mt-2">
<span className="text-2xs text-secondary">{post.date}</span>
<Button
variant="ghost"
size="sm"
onClick={() => setSelectedPostId(post.id)}
className="text-xs text-gradient cursor-pointer font-bold"
>
Read Guide
</Button>
</div>
</article>
))}
</div>
</>
) : (
// Article Reader
<div className="max-w-720 mx-auto mb-16 animate-fade-in">
<Button
variant="ghost"
onClick={() => setSelectedPostId(null)}
className="mb-8 text-sm cursor-pointer inline-flex items-center gap-2"
>
<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
<polyline points="15 18 9 12 15 6" />
</svg>
Back to Guides
</Button>

<div className="mb-8 pb-6 border-b border-card-border">
<span className="badge badge-primary text-2xs font-extrabold uppercase px-3 py-1 tracking-wider mb-4 inline-block">
{selectedPost.category}
</span>
<h1 className="text-3xl font-extrabold text-white mb-4 leading-tight">
{selectedPost.title}
</h1>
<div className="flex items-center gap-3 text-xs text-secondary">
<span>{selectedPost.date}</span>
<span aria-hidden="true">•</span>
<span>{selectedPost.readTime}</span>
</div>
</div>

<div className="mb-16">
{selectedPost.contentJSX()}
</div>
</div>
)}

{/* Newsletter Subscription Footer Card */}
<div className="blog-subscribe-card card glass max-w-640 mx-auto animate-fade-in p-6 border-card">
<h3 className="text-base font-bold mb-2 text-center">
Get Notified of New Content
</h3>
<p className="text-muted text-sm mb-4 text-center">
We'll send you occasional updates when we publish new compliance playbooks and resources. Unsubscribe anytime.
</p>

{status && (
<div
className="blog-status p-3 mb-4 text-sm font-medium text-center"
data-status={status.type}
>
{status.message}
</div>
)}

<form
onSubmit={handleSubmit}
className="flex flex-wrap justify-center gap-2.5"
>
<Input
type="email"
placeholder="Enter your work email"
required
value={email}
onChange={(e) => setEmail(e.target.value)}
disabled={loading}
className="flex-1 min-w-200"
/>
<Button type="submit" variant="primary" disabled={loading}>
{loading ? "Subscribing..." : "Notify Me"}
</Button>
</form>
</div>
</div>
</section>
</main>

<Footer />
</div>
);
}
