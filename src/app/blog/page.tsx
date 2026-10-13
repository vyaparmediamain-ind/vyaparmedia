"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button, Input } from "@/components/ui";
import { z } from "zod";
import { apiClient } from "@/lib/api-client";
import { formatUserError } from "@/lib/user-messages";
import { GST_STANDARD_RATE, GST_STANDARD_RATE_PERCENT_STRING } from "@/constants";
import { safeJsonLd } from "@/lib/json-ld";
import {
  BookOpen,
  Clock,
  ArrowRight,
  Mail,
  CheckCircle2,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  Receipt,
  SearchCheck,
} from "lucide-react";

interface BlogPost {
  id: string;
  category: "Compliance" | "GST & Tax" | "Operations";
  badgeVariant: "purple" | "emerald" | "amber";
  title: string;
  description: string;
  readTime: string;
  date: string;
  icon: typeof ShieldCheck;
  contentJSX: () => React.JSX.Element;
}

const BLOG_POSTS: BlogPost[] = [
  {
    id: "tds-compliance-194o",
    category: "Compliance",
    badgeVariant: "purple",
    icon: ShieldCheck,
    title: "TDS Compliance under Section 194-O for Creators",
    description:
      "An operational deep-dive into the 0.1% TDS deduction rule on e-commerce platform payouts for Indian influencers and how to claim tax credit.",
    readTime: "6 min read",
    date: "July 28, 2026",
    contentJSX: () => (
      <div className="space-y-6 text-muted-foreground leading-relaxed text-base">
        <p>
          Under the Indian Income Tax Act, <strong className="text-foreground">Section 194-O</strong> mandates that e-commerce operators deduct Tax Deducted at Source (TDS) at the rate of <strong className="text-foreground">0.1%</strong> on the gross amount of sales or services facilitated through their digital platforms.
        </p>

        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 space-y-3">
          <div className="flex items-center gap-2 font-bold text-foreground">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <span>Key Regulatory Highlights for Influencers</span>
          </div>
          <p className="text-sm">
            VyaparMedia automatically calculates, withholds, and deposits Section 194-O TDS to the Income Tax Department under your PAN, generating downloadable Form 16A quarterly certificates.
          </p>
        </div>

        <h3 className="text-xl font-bold text-foreground pt-4">1. Who is Classified as an E-commerce Operator?</h3>
        <p>
          Platforms (like VyaparMedia) that facilitate transactions and milestone payouts between brands and creators are classified as e-commerce operators. This statutory classification requires the platform to maintain automated tax deduction ledgers.
        </p>

        <h3 className="text-xl font-bold text-foreground pt-2">2. The 0.1% TDS Deduction Rule</h3>
        <p>
          The platform is legally required to deduct 0.1% TDS on the total gross remuneration due to the creator before releasing the escrow payout (once the annual threshold is reached).
        </p>

        <h3 className="text-xl font-bold text-foreground pt-2">3. Mandatory PAN Validation</h3>
        <p>
          Ensure your 10-digit PAN is verified in your VyaparMedia Wallet. If a PAN is not linked or is classified as inoperative under CBDT Aadhaar-linking rules, the statutory withholding rate jumps to a punitive <strong className="text-destructive font-semibold">20% under Section 206AA</strong>.
        </p>

        <h3 className="text-xl font-bold text-foreground pt-2">4. Exemption Threshold Limit</h3>
        <p>
          For individual creators, if your gross collaboration volume via the platform does not exceed <strong className="text-foreground">₹5,00,000</strong> within a financial year, no Section 194-O TDS is deducted, provided your verified PAN is recorded on file.
        </p>

        <h3 className="text-xl font-bold text-foreground pt-2">5. How to Reconcile and Claim Refunds</h3>
        <p>
          All TDS credits reflect in your <strong className="text-foreground">Form 26AS</strong> and Annual Information Statement (AIS) under your PAN. When filing your annual Income Tax Return (ITR-3 or ITR-4 Sugam under Section 44ADA presumptive taxation), you can offset these deductions directly against your net tax liability or claim an automated tax refund to your bank account.
        </p>
      </div>
    ),
  },
  {
    id: "gst-invoicing-creators",
    category: "GST & Tax",
    badgeVariant: "emerald",
    icon: Receipt,
    title: "GST Invoicing Rules for the Indian Creator Economy",
    description:
      "Understand when you need a GSTIN, how to file interstate invoices, and how to structure compliant SAC 998369 tax invoices for brand campaigns.",
    readTime: "5 min read",
    date: "June 15, 2026",
    contentJSX: () => (
      <div className="space-y-6 text-muted-foreground leading-relaxed text-base">
        <p>
          As influencer marketing scales into an institutional industry across India, the Goods and Services Tax (GST) department monitors commercial brand endorsements. Here is the operational checklist every creator and talent manager must follow.
        </p>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 space-y-3">
          <div className="flex items-center gap-2 font-bold text-foreground">
            <Receipt className="w-5 h-5 text-emerald-500" />
            <span>Thresholds &amp; Registration Mandates</span>
          </div>
          <p className="text-sm">
            Creators with turnover exceeding ₹20 Lakhs (₹10 Lakhs for special category states) must obtain a 15-digit GSTIN and file GSTR-1 &amp; GSTR-3B monthly or quarterly.
          </p>
        </div>

        <h3 className="text-xl font-bold text-foreground pt-4">1. Aggregate Turnover vs. Interstate Supply</h3>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong className="text-foreground">Turnover Threshold:</strong> If your total revenue across all brand deals, YouTube AdSense, affiliate commissions, and merchandise exceeds ₹20 Lakhs in a financial year, GST registration is mandatory.
          </li>
          <li>
            <strong className="text-foreground">Interstate Collaboration:</strong> If you are based in Karnataka and partner with a brand registered in Maharashtra, it constitutes an interstate service. Section 24 of the CGST Act prescribes mandatory registration for interstate suppliers, subject to current MSME small supplier exemption notifications.
          </li>
        </ul>

        <h3 className="text-xl font-bold text-foreground pt-2">2. Standard SAC Codes for Creator Services</h3>
        <p>When issuing digital invoices, use the standardized Services Accounting Code (SAC):</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-2">
          <div className="rounded-xl border border-border bg-card p-4">
            <span className="text-xs font-mono font-bold text-primary block mb-1">SAC 998369</span>
            <span className="text-sm font-semibold text-foreground block">Other Professional &amp; Technical Services</span>
            <span className="text-xs text-muted-foreground">Standard for brand sponsorships, video integration, and social shoutouts.</span>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <span className="text-xs font-mono font-bold text-primary block mb-1">SAC 998313</span>
            <span className="text-sm font-semibold text-foreground block">IT Design &amp; Digital Content Creation</span>
            <span className="text-xs text-muted-foreground">Used for commercial digital asset production and whitelisting rights.</span>
          </div>
        </div>

        <h3 className="text-xl font-bold text-foreground pt-2">3. Applicable Tax Rates</h3>
        <p>
          Influencer creative services are taxed at a standard <strong className="text-foreground">{GST_STANDARD_RATE_PERCENT_STRING} GST</strong>.
          For intrastate deals, split as {Math.round((GST_STANDARD_RATE * 100) / 2)}% CGST + {Math.round((GST_STANDARD_RATE * 100) / 2)}% SGST. For interstate deals across state borders, apply {GST_STANDARD_RATE_PERCENT_STRING} IGST.
        </p>
      </div>
    ),
  },
  {
    id: "fake-engagement-audit",
    category: "Operations",
    badgeVariant: "amber",
    icon: SearchCheck,
    title: "Fake Engagement Audit: Brand Vetting Checklist",
    description:
      "A battle-tested playbook for brands and compliance officers to vet creator profiles, spot bot networks, and compute genuine reach.",
    readTime: "8 min read",
    date: "May 10, 2026",
    contentJSX: () => (
      <div className="space-y-6 text-muted-foreground leading-relaxed text-base">
        <p>
          Artificial engagement and purchased bot followings cost Indian marketers over ₹2,000 Crores in wasted ad spend annually. This audit checklist breaks down how VyaparMedia evaluates creator integrity before admitting them to verified campaigns.
        </p>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 space-y-3">
          <div className="flex items-center gap-2 font-bold text-foreground">
            <SearchCheck className="w-5 h-5 text-amber-500" />
            <span>The DRS™ Dynamic Trust Standard</span>
          </div>
          <p className="text-sm">
            VyaparMedia&apos;s proprietary DRS™ (Dynamic Reliability Score) continuously inspects comment semantics, follower velocity, and audience geo-dispersion to guarantee real human impressions.
          </p>
        </div>

        <h3 className="text-xl font-bold text-foreground pt-4">1. Benchmark Engagement Rate Distributions</h3>
        <p>
          Healthy creator profiles naturally experience diminishing engagement percentages as gross follower volume scales:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong className="text-foreground">Nano Creators (&lt; 10K):</strong> 4.0% – 6.5% typical engagement.</li>
          <li><strong className="text-foreground">Micro Creators (10K – 100K):</strong> 2.0% – 3.5% typical engagement.</li>
          <li><strong className="text-foreground">Macro Creators (100K – 1M):</strong> 1.5% – 2.2% typical engagement.</li>
          <li><strong className="text-foreground">Celebrity (&gt; 1M):</strong> 1.0% – 1.8% typical engagement.</li>
        </ul>
        <p className="text-sm text-amber-500 font-medium">
          Warning: Profiles displaying &gt; 15% or &lt; 0.2% engagement rates are flagged for manual bot-network auditing.
        </p>

        <h3 className="text-xl font-bold text-foreground pt-2">2. Comment-to-Like Ratio &amp; Semantic Quality</h3>
        <p>
          A natural organic post demonstrates a comment-to-like ratio between 1:100 to 5:100. If an Instagram reel displays 40,000 likes with only 8 comments, automated like-farming is almost certainly active.
        </p>
        <p>
          Additionally, examine comment semantic depth: generic repetitive strings like &ldquo;Nice pic&rdquo;, &ldquo;🔥&rdquo;, or &ldquo;DM to promote&rdquo; originate from automated engagement pods. Authentic audiences debate product features, ask pricing questions, and mention personal experiences.
        </p>

        <h3 className="text-xl font-bold text-foreground pt-2">3. Follower Acquisition Velocity Graphs</h3>
        <p>
          Organic audience growth follows a smooth, continuous curve punctuated by discrete viral content spikes. Sudden overnight cliffs (e.g. +25,000 followers gained in 4 hours on an unpromoted day) indicate purchased bulk follower packages that will fail to deliver conversions.
        </p>
      </div>
    ),
  },
];

export default function BlogPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("All");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    const validation = z.string().email("Please enter a valid email address").safeParse(email.trim());
    if (!validation.success) {
      setStatus({ type: "error", message: validation.error.issues[0]?.message || "Invalid email address" });
      return;
    }
    setLoading(true);
    try {
      await apiClient.settings.blogSubscribe({ email });
      setStatus({ type: "success", message: "Thank you! Please check your inbox to verify your subscription." });
      setEmail("");
    } catch (err: unknown) {
      setStatus({ type: "error", message: formatUserError(err, "Failed to subscribe. Please try again.") });
    } finally {
      setLoading(false);
    }
  };

  const selectedPost = BLOG_POSTS.find((p) => p.id === selectedPostId);

  const filteredPosts =
    activeCategory === "All"
      ? BLOG_POSTS
      : BLOG_POSTS.filter((p) => p.category === activeCategory);

  const categories = ["All", "Compliance", "GST & Tax", "Operations"];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />

      <main className="flex-1 pt-24 pb-16">
        {/* Schema.org Blog / BlogPosting Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: safeJsonLd(
              selectedPost
                ? {
                    "@context": "https://schema.org",
                    "@type": "BlogPosting",
                    "headline": selectedPost.title,
                    "description": selectedPost.description,
                    "datePublished": "2026-06-15T00:00:00Z",
                    "dateModified": "2026-07-28T00:00:00Z",
                    "author": {
                      "@type": "Organization",
                      "name": "VyaparMedia Legal & Compliance Editorial",
                      "url": "https://vyaparmedia-nine.vercel.app",
                    },
                    "publisher": {
                      "@type": "Organization",
                      "name": "VyaparMedia",
                      "logo": {
                        "@type": "ImageObject",
                        "url": "https://vyaparmedia-nine.vercel.app/icon-512.png",
                      },
                    },
                    "mainEntityOfPage": `https://vyaparmedia-nine.vercel.app/blog?post=${selectedPost.id}`,
                  }
                : {
                    "@context": "https://schema.org",
                    "@type": "Blog",
                    "name": "VyaparMedia Creator Economy & Compliance Blog",
                    "url": "https://vyaparmedia-nine.vercel.app/blog",
                    "description":
                      "Legal, tax, and strategy guides for Indian influencers and brand partnerships.",
                    "blogPost": BLOG_POSTS.map((post) => ({
                      "@type": "BlogPosting",
                      "headline": post.title,
                      "description": post.description,
                      "url": `https://vyaparmedia-nine.vercel.app/blog?post=${post.id}`,
                    })),
                  }
            ),
          }}
        />

        {!selectedPost ? (
          <>
            {/* ── Hero ────────────────────────────────────────── */}
            <section className="relative overflow-hidden border-b border-border/40 pb-16">
              <div className="container max-w-5xl mx-auto px-4 sm:px-6 relative z-10 text-center">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-wider mb-6">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Knowledge Base &amp; Regulatory Playbooks</span>
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-foreground tracking-tight max-w-3xl mx-auto mb-6 leading-tight">
                  Practical Guides &amp; Regulatory Compliance
                </h1>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                  Operational playbooks, tax-readiness frameworks, and anti-fraud best practices for the modern Indian creator economy.
                </p>

                {/* Category Filter Pills */}
                <div className="flex flex-wrap items-center justify-center gap-2 mt-10">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`px-4 py-2 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer ${
                        activeCategory === cat
                          ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                          : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* ── Posts Grid ─────────────────────────────────── */}
            <section className="py-12">
              <div className="container max-w-6xl mx-auto px-4 sm:px-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
                  {filteredPosts.map((post) => {
                    const IconComponent = post.icon;
                    return (
                      <article
                        key={post.id}
                        onClick={() => setSelectedPostId(post.id)}
                        className="group flex flex-col bg-card border border-border/60 hover:border-primary/40 rounded-2xl p-6 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 cursor-pointer relative"
                      >
                        <div className="flex items-center justify-between gap-2 mb-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                              post.badgeVariant === "purple"
                                ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                                : post.badgeVariant === "emerald"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                            }`}
                          >
                            <IconComponent className="w-3.5 h-3.5" />
                            {post.category}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {post.readTime}
                          </span>
                        </div>

                        <h2 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors leading-snug mb-3">
                          {post.title}
                        </h2>

                        <p className="text-sm text-muted-foreground leading-relaxed flex-1 mb-6">
                          {post.description}
                        </p>

                        <div className="flex items-center justify-between pt-4 border-t border-border/40 text-xs text-muted-foreground">
                          <span>{post.date}</span>
                          <span className="inline-flex items-center gap-1 font-semibold text-primary group-hover:translate-x-0.5 transition-transform">
                            Read Guide <ArrowRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {/* ── Newsletter Subscription Box ────────────── */}
                <div className="relative rounded-3xl bg-gradient-to-br from-card via-card to-primary/5 border border-primary/20 p-8 sm:p-12 max-w-3xl mx-auto text-center overflow-hidden shadow-sm">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mx-auto mb-5 shadow-sm">
                    <Mail className="w-6 h-6" />
                  </div>

                  <h3 className="text-2xl font-bold text-foreground mb-3">
                    Stay Ahead of Indian Creator Regulations
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-lg mx-auto mb-8 leading-relaxed">
                    Receive timely updates on CBDT TDS circulars, GST advisory notices, and ASCI disclosure updates directly in your inbox. No spam, ever.
                  </p>

                  {status && (
                    <div
                      className={`p-4 mb-6 text-sm font-medium text-center rounded-xl max-w-md mx-auto flex items-center justify-center gap-2 ${
                        status.type === "success"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          : "bg-destructive/10 text-destructive border border-destructive/20"
                      }`}
                    >
                      {status.type === "success" && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                      <span>{status.message}</span>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
                    <Input
                      type="email"
                      placeholder="Enter your professional email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      className="w-full bg-background border-border text-sm h-11"
                    />
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={loading}
                      className="w-full sm:w-auto h-11 px-6 whitespace-nowrap cursor-pointer"
                    >
                      {loading ? "Subscribing…" : "Subscribe Free"}
                    </Button>
                  </form>
                </div>
              </div>
            </section>
          </>
        ) : (
          /* ── Full Article Reading View ─────────────────────── */
          <section className="py-8">
            <div className="container max-w-3xl mx-auto px-4 sm:px-6">
              {/* Breadcrumb / Back Button */}
              <button
                onClick={() => setSelectedPostId(null)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground mb-8 transition-colors cursor-pointer group"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                Back to All Playbooks
              </button>

              {/* Article Header */}
              <div className="pb-8 border-b border-border mb-10">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      selectedPost.badgeVariant === "purple"
                        ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                        : selectedPost.badgeVariant === "emerald"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                    }`}
                  >
                    <selectedPost.icon className="w-3.5 h-3.5" />
                    {selectedPost.category}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {selectedPost.readTime}
                  </span>
                  <span className="text-muted-foreground/40">•</span>
                  <span className="text-xs text-muted-foreground">{selectedPost.date}</span>
                </div>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-tight leading-tight mb-6">
                  {selectedPost.title}
                </h1>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  {selectedPost.description}
                </p>
              </div>

              {/* Article Content */}
              <div className="prose prose-neutral dark:prose-invert max-w-none mb-12">
                {selectedPost.contentJSX()}
              </div>

              {/* Footer CTA */}
              <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-4">
                <div className="inline-flex p-3 rounded-full bg-primary/10 text-primary">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h4 className="text-lg font-bold text-foreground">
                  Ready to run verified, tax-compliant collaborations?
                </h4>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  VyaparMedia handles escrow locking, automated Section 194-O TDS deductions, and GST-ready invoices out of the box.
                </p>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <Button variant="primary" onClick={() => setSelectedPostId(null)} className="cursor-pointer">
                    Browse All Guides
                  </Button>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
