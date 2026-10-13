"use client";

import { useState } from "react";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { Button } from "@/components/ui";
import {
  DEFAULT_BRAND_PLATFORM_FEE_PERCENT,
  GST_STANDARD_RATE_PERCENT_STRING,
} from "@/constants";

/* ── Data ──────────────────────────────────────────────────────────── */

const CREATOR_FEATURES = [
  { label: "Verified creator profile & social analytics", included: true },
  { label: "Unlimited campaign discovery & applications", included: true },
  { label: "100% upfront escrow payment protection", included: true },
  { label: "Legally binding smart contracts", included: true },
  { label: "Instant bank settlement on verified delivery", included: true },
  { label: "Gamified DRS trust badges & tier progression", included: true },
  { label: "Automated TDS certificate (Section 194-O)", included: true },
  { label: "GST-ready invoice generation", included: true },
];

const BRAND_FEATURES = [
  { label: "Unlimited campaign creation & briefs", included: true },
  { label: "Government KYC & social fraud verification", included: true },
  { label: "Automated smart contracts & revision limits", included: true },
  { label: "Secure milestone escrow (UPI / Card / NetBanking)", included: true },
  { label: "Live post link tracking & engagement metrics", included: true },
  { label: "GST-compliant automated invoicing & TDS summaries", included: true },
  { label: "Multi-creator campaign management", included: true },
  { label: "Dispute resolution with audit trail", included: true },
];

const COMPARISON = [
  { feature: "Platform fee", creator: "Free forever", brand: `${DEFAULT_BRAND_PLATFORM_FEE_PERCENT}% per deal` },
  { feature: "Escrow protection", creator: "✓", brand: "✓" },
  { feature: "KYC verification", creator: "✓", brand: "✓" },
  { feature: "Smart contracts", creator: "✓", brand: "✓" },
  { feature: "TDS / GST compliance", creator: "✓", brand: "✓" },
  { feature: "Live post monitoring", creator: "View only", brand: "Full control" },
  { feature: "Dispute resolution", creator: "✓", brand: "✓" },
  { feature: "Bank payout", creator: "Instant on approval", brand: "N/A" },
];

const TRUST_STATS = [
  { value: "₹0", label: "Advance fraud risk", desc: "Escrow-first always" },
  { value: `${DEFAULT_BRAND_PLATFORM_FEE_PERCENT}%`, label: "Flat brand fee", desc: "No hidden charges" },
  { value: "0%", label: "Creator join fee", desc: "Free forever" },
  { value: "194-O", label: "Section", desc: "TDS auto-deducted" },
];

const FAQS = [
  {
    q: "Are there any monthly subscription or upfront listing fees?",
    a: "No. Both brands and creators can join and create profiles completely free. There are no recurring monthly charges — fees only apply when an active collaboration is successfully run through VyaparMedia's protected escrow workflow.",
  },
  {
    q: "How does Escrow Payment Protection work?",
    a: "When a brand hires a creator, the agreed campaign budget is deposited into a secure escrow vault. The funds are held safely during content production and are only released to the creator once the brand reviews and approves the deliverable.",
  },
  {
    q: "How are Indian taxes (GST & TDS) handled on VyaparMedia?",
    a: `VyaparMedia is built for Indian business compliance. The platform automatically calculates and separates GST (${GST_STANDARD_RATE_PERCENT_STRING}) and Section 194-O TDS deductions on deal settlement, providing downloadable tax invoices and TDS statements for your chartered accountant.`,
  },
  {
    q: "What happens if a creator fails to deliver or misses the deadline?",
    a: "If a creator fails to submit the agreed content within the contract deadline, or if deliverables do not match the signed brief, the dispute resolution protocol activates. If unfulfilled, escrow funds are safely refunded back to the brand's wallet.",
  },
  {
    q: "When do creators receive their payouts?",
    a: "As soon as the brand approves the final post and automated link verification confirms it is live, escrow funds are instantly credited to the creator's platform wallet and can be withdrawn directly to any verified Indian bank account via IMPS/NEFT.",
  },
  {
    q: `Is the ${DEFAULT_BRAND_PLATFORM_FEE_PERCENT}% brand fee inclusive or exclusive of GST?`,
    a: `The platform service fee is subject to GST at ${GST_STANDARD_RATE_PERCENT_STRING} as per applicable Indian tax law. The fee is charged only on successful deal completion — not on campaign creation, applications, or contract signing.`,
  },
];

/* ── Component ─────────────────────────────────────────────────────── */

export default function PricingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [billingCycle, setBillingCycle] = useState<"standard" | "volume">("standard");

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />

      <main className="flex-1 pt-20">

        {/* ── Hero ──────────────────────────────────────────── */}
        <section className="pricing-hero section relative overflow-hidden">
          <div className="pricing-hero-glow" aria-hidden="true" />
          <div className="container text-center max-w-3xl mx-auto relative z-10">
            <span className="badge badge-primary inline-flex items-center gap-1.5 mb-6 text-xs font-bold uppercase tracking-wider px-4 py-2">
              Transparent Pricing
            </span>
            <h1 className="section-title mb-5">
              Join Free.{" "}
              <span className="gradient-text">We Only Win When You Do.</span>
            </h1>
            <p className="section-subtitle mb-0">
              No subscriptions, no listing fees, no surprises. VyaparMedia earns only when a protected collaboration is successfully completed, verified, and paid out.
            </p>
          </div>
        </section>

        {/* ── Trust Strip ───────────────────────────────────── */}
        <div className="border-y border-border bg-card/60">
          <div className="container">
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border">
              {TRUST_STATS.map((s) => (
                <div key={s.label} className="text-center py-7 px-4">
                  <div className="text-2xl font-extrabold gradient-text mb-0.5">{s.value}</div>
                  <div className="text-sm font-semibold text-foreground">{s.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Pricing Cards ─────────────────────────────────── */}
        <section className="section">
          <div className="container">
            {/* Standard vs Enterprise Volume Toggle */}
            <div className="flex flex-col items-center justify-center mb-10 space-y-3">
              <div className="inline-flex items-center p-1 rounded-2xl bg-muted border border-border shadow-xs">
                <button
                  type="button"
                  onClick={() => setBillingCycle("standard")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    billingCycle === "standard"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Pay-As-You-Go (Standard)
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle("volume")}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    billingCycle === "volume"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span>Agency & Volume Plan</span>
                  <span className="text-[10px] bg-verified text-white px-1.5 py-0.2 rounded-full font-black uppercase tracking-wider shrink-0 whitespace-nowrap">
                    Save 25%
                  </span>
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {billingCycle === "volume"
                  ? "For agencies & brands managing > ₹10L annual escrow volume. 7.5% reduced fee + dedicated account manager."
                  : `Zero upfront commitment. Standard ${DEFAULT_BRAND_PLATFORM_FEE_PERCENT}% escrow fee charged solely upon successful deliverable sign-off.`}
              </p>
            </div>

            <div className="pricing-cards-grid grid gap-6 max-w-4xl mx-auto">

              {/* Creator Card */}
              <article className="pricing-card pricing-card--creator card rounded-2xl p-8 flex flex-col border border-border">
                <div className="pricing-card-icon pricing-card-icon--creator w-12 h-12 rounded-2xl flex items-center justify-center mb-5 bg-primary/10 text-primary">
                  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <div className="text-xs font-extrabold text-primary uppercase tracking-widest mb-2">For Creators & Influencers</div>
                <h2 className="text-2xl font-extrabold text-foreground mb-2">Creator Plan</h2>
                <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                  Build your verified portfolio, discover brand deals, sign smart contracts, and get 100% guaranteed escrow payouts — completely free.
                </p>

                <div className="pricing-price-block rounded-xl p-5 mb-7 text-center bg-muted/40 border border-border">
                  <div className="text-5xl font-extrabold text-foreground mb-1">₹0</div>
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Free forever to join & apply</div>
                </div>

                <ul className="flex-1 space-y-3 mb-8">
                  {CREATOR_FEATURES.map((f) => (
                    <li key={f.label} className="flex items-start gap-3 text-sm text-muted-foreground">
                      <svg className="flex-shrink-0 mt-0.5 text-primary" width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{f.label}</span>
                    </li>
                  ))}
                </ul>

                <Link href="/register?type=influencer" className="w-full">
                  <Button variant="secondary" className="w-full py-3 font-bold cursor-pointer">
                    Join as a Creator →
                  </Button>
                </Link>
              </article>

              {/* Brand Card */}
              <article className="pricing-card pricing-card--brand card rounded-2xl p-8 flex flex-col relative border-2 border-primary shadow-lg bg-card">
                <div className="absolute -top-3.5 right-6 px-3 py-1 rounded-full bg-primary text-primary-foreground text-[11px] font-black uppercase tracking-wider shadow-md shrink-0 whitespace-nowrap">
                  Most Popular
                </div>

                <div className="pricing-card-icon pricing-card-icon--brand w-12 h-12 rounded-2xl flex items-center justify-center mb-5 bg-primary/10 text-primary">
                  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                </div>
                <div className="text-xs font-extrabold text-primary uppercase tracking-widest mb-2">For Brands & Businesses</div>
                <h2 className="text-2xl font-extrabold text-foreground mb-2">Brand Plan</h2>
                <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                  Run high-ROI influencer marketing with zero risk. Connect with verified creators, lock escrow securely, and approve content with confidence.
                </p>

                <div className="pricing-price-block pricing-price-block--brand rounded-xl p-5 mb-7 text-center bg-primary/5 border border-primary/20">
                  <div className="text-5xl font-extrabold text-foreground mb-1">
                    {billingCycle === "volume" ? "7.5%" : `${DEFAULT_BRAND_PLATFORM_FEE_PERCENT}%`}
                  </div>
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    {billingCycle === "volume" ? "Discounted volume escrow fee" : "Flat fee per completed deal"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1.5">
                    {billingCycle === "volume"
                      ? "Dedicated CA tax support · Dedicated account executive"
                      : "Only charged on success · No upfront cost"}
                  </div>
                </div>

                <ul className="flex-1 space-y-3 mb-8">
                  {BRAND_FEATURES.map((f) => (
                    <li key={f.label} className="flex items-start gap-3 text-sm text-muted-foreground">
                      <svg className="flex-shrink-0 mt-0.5 text-primary" width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{f.label}</span>
                    </li>
                  ))}
                </ul>

                <Link href="/register?type=brand" className="w-full">
                  <Button variant="primary" className="w-full py-3 font-bold cursor-pointer">
                    Start Brand Campaign →
                  </Button>
                </Link>
              </article>
            </div>
          </div>
        </section>

        {/* ── Comparison Table ──────────────────────────────── */}
        <section className="section bg-secondary/40">
          <div className="container max-w-3xl mx-auto">
            <h2 className="section-title mb-2">Side-by-Side Comparison</h2>
            <p className="section-subtitle">Everything included, no upsells.</p>

            <div className="card rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="pricing-table w-full text-sm min-w-[500px]">
                  <thead>
                    <tr className="pricing-table-head border-b border-border">
                      <th className="text-left px-6 py-4 font-extrabold text-foreground">Feature</th>
                      <th className="text-center px-6 py-4 font-extrabold text-primary">Creator</th>
                      <th className="text-center px-6 py-4 font-extrabold text-primary">Brand</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARISON.map((row, i) => (
                      <tr
                        key={row.feature}
                        className={`border-b border-border last:border-0 ${i % 2 === 0 ? "bg-transparent" : "bg-secondary/30"}`}
                      >
                        <td className="px-6 py-3.5 text-foreground font-medium">{row.feature}</td>
                        <td className="px-6 py-3.5 text-center text-muted-foreground">{row.creator}</td>
                        <td className="px-6 py-3.5 text-center text-muted-foreground">{row.brand}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ───────────────────────────────────────────── */}
        <section className="section">
          <div className="container max-w-2xl mx-auto">
            <h2 className="section-title mb-2">Frequently Asked Questions</h2>
            <p className="section-subtitle">Everything you need to know about fees, escrow, and compliance.</p>

            <div className="space-y-3">
              {FAQS.map((faq, i) => (
                <div key={i} className="card rounded-xl overflow-hidden border border-border">
                  <button
                    className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 text-sm font-semibold text-foreground hover:bg-muted/40 transition-colors cursor-pointer"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    aria-expanded={openFaq === i}
                  >
                    <span>{faq.q}</span>
                    <svg
                      width={16}
                      height={16}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      style={{ transform: openFaq === i ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.25s", flexShrink: 0 }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  {openFaq === i && (
                    <div className="px-5 pb-5 pt-2 text-sm text-muted-foreground leading-relaxed border-t border-border">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Bottom CTA ────────────────────────────────────── */}
        <section className="section">
          <div className="container max-w-2xl mx-auto">
            <div className="pricing-cta-card card rounded-3xl p-10 text-center border border-primary/20" style={{ background: "var(--gradient-card)" }}>
              <h2 className="text-2xl font-extrabold mb-3 text-foreground">Ready to get started?</h2>
              <p className="text-muted-foreground text-sm mb-6">
                Free to join. Free to apply. Free to discover. Fees apply only when deals complete successfully.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link href="/register?type=brand" className="btn btn-primary">
                  Launch a Campaign
                </Link>
                <Link href="/register?type=influencer" className="btn btn-secondary">
                  Join as Creator
                </Link>
              </div>
              <p className="mt-5 text-xs text-muted-foreground">
                Need enterprise controls or a custom workflow?{" "}
                <Link href="/contact" className="text-primary font-bold hover:underline">
                  Contact support →
                </Link>
              </p>
            </div>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
