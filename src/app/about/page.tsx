import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import {
  ShieldCheck,
  Lock,
  FileCheck,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Building2,
  Users2,
  Scale,
} from "lucide-react";

export const metadata: Metadata = {
  title: "About VyaparMedia — India's Trusted Influencer Marketplace",
  description:
    "Learn how VyaparMedia is building India's most trusted creator economy with guaranteed escrow, verified KYC, smart contracts, and zero-fraud payouts.",
};

const stats = [
  { value: "₹0", label: "Advance Fraud Risk", sub: "100% escrow protected" },
  { value: "KYC", label: "DigiLocker Verified", sub: "PAN + GSTIN + bank checks" },
  { value: "TDS", label: "Auto-Compliant", sub: "Section 194-O & 206AA" },
  { value: "Live", label: "Delivery Tracking", sub: "Real-time proof verification" },
];

const values = [
  {
    icon: Lock,
    label: "Escrow Safety",
    title: "Protected Capital, Guaranteed Payouts",
    description:
      "Campaign budgets are secured upfront in RBI-compliant escrow holds and released only upon verified milestone approval — zero non-payment or advance fraud.",
    color: "text-escrow",
    bg: "bg-escrow/10",
    border: "border-escrow-border",
  },
  {
    icon: ShieldCheck,
    label: "Institutional Trust",
    title: "100% Verified Businesses & Creators",
    description:
      "Government DigiLocker KYC, PAN/GSTIN verification, and live social API metrics ensure transparent, high-ROI business relationships.",
    color: "text-verified",
    bg: "bg-verified/10",
    border: "border-verified-border",
  },
  {
    icon: FileCheck,
    label: "Operational Precision",
    title: "Smart Contracts & Tax Compliance",
    description:
      "Legally binding digital agreements with clear briefs, commercial rights, revision limits, and automated TDS/GST reporting built in.",
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
  },
  {
    icon: Scale,
    label: "Fair Mediation",
    title: "Neutral Dispute Resolution",
    description:
      "When creative differences arise, our dedicated resolution team audits deal contracts, drafts, and evidence to deliver fair, binding settlements.",
    color: "text-disputed",
    bg: "bg-disputed/10",
    border: "border-disputed-border",
  },
  {
    icon: TrendingUp,
    label: "Growth Velocity",
    title: "Performance & Audience Truth",
    description:
      "Digital Reputation Score (DRS™ 0–900) algorithm evaluates on-time delivery rates, verified review sentiment, and audience authenticity.",
    color: "text-warning",
    bg: "bg-warning/10",
    border: "border-warning-border",
  },
  {
    icon: Users2,
    label: "Bharat First",
    title: "Empowering Regional Creators",
    description:
      "Built for India's multilingual creator ecosystem — bridging tier-2 & tier-3 micro-influencers with national direct-to-consumer powerhouses.",
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
  },
];

const timeline = [
  {
    year: "2024",
    title: "Founding Vision",
    body: "VyaparMedia was conceptualized to eliminate the widespread trust deficit, unpaid invoices, and ghosting in India's creator economy.",
  },
  {
    year: "2025",
    title: "First INR Escrow Engine",
    body: "Launched India's first INR-native creator escrow architecture integrated with double-entry ledgers and Razorpay.",
  },
  {
    year: "2025",
    title: "Deep KYC & Tax Integration",
    body: "Integrated DigiLocker, PAN/GST validation, and automated Section 194-O TDS reporting for seamless enterprise compliance.",
  },
  {
    year: "2026",
    title: "National Scale & DRS™",
    body: "Surpassed 2,400+ verified creators and brands, rolling out DRS™ reputation scoring, anti-disintermediation shields, and mobile PWA.",
  },
];

export default function AboutPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />

      <main className="flex-1 pt-24 pb-20 space-y-20">
        {/* ── Hero ─────────────────────────────────────────── */}
        <section className="relative px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center space-y-6 pt-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Our Mission &amp; Purpose</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-foreground tracking-tight leading-[1.1] text-balance">
            Where Indian Brands &amp; Creators Build{" "}
            <span className="bg-gradient-to-r from-primary to-accent-purple bg-clip-text text-transparent">
              Trusted Business.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            VyaparMedia is India&apos;s premier influencer marketplace and escrow infrastructure — engineered to turn viral reach into secure, verifiable, and tax-compliant commercial collaborations.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/register?type=brand"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-md hover:bg-primary/90 transition-all"
            >
              Launch a Campaign
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/register?type=influencer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-card border border-border text-foreground font-bold text-sm hover:bg-muted transition-all"
            >
              Join as a Creator
            </Link>
          </div>
        </section>

        {/* ── Stats Strip ───────────────────────────────────── */}
        <section className="border-y border-border bg-card/60 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-border">
              {stats.map((s, idx) => (
                <div key={s.label} className={`text-center px-4 py-4 md:py-0 ${idx > 1 ? "pt-4 md:pt-0" : ""}`}>
                  <div className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
                    {s.value}
                  </div>
                  <div className="text-sm font-bold text-foreground mt-1">{s.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Why We Exist ──────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-5">
              <span className="text-xs font-black text-primary uppercase tracking-widest block">
                The Problem We Solved
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight leading-tight">
                India&apos;s Creator Economy Deserved Financial Dignity &amp; Institutional Rigor.
              </h2>
              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
                In India&apos;s fast-growing creator economy, collaborations historically collapsed due to broken trust: ghosting brands, delayed payments, ambiguous briefs, unvetted audience data, and tax complications.
              </p>
              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
                VyaparMedia bridges this divide by introducing institutional escrow guarantees. Brands deposit funds securely before work begins; creators upload verified deliverables and receive instant, TDS-deducted bank payouts the moment work is approved.
              </p>
            </div>

            {/* The 4-Step Standard Card */}
            <div className="p-8 rounded-3xl bg-card border border-border shadow-xl space-y-6">
              <div>
                <span className="text-xs font-black text-primary uppercase tracking-widest block mb-1">
                  The VyaparMedia Protocol
                </span>
                <h3 className="text-xl font-black text-foreground">
                  Brief. Escrow. Verify. Settle.
                </h3>
              </div>

              <div className="space-y-4">
                {[
                  { step: "01", label: "Brief", desc: "Brand creates an itemized brief with legal deliverable terms & commercial usage rights." },
                  { step: "02", label: "Escrow", desc: "Budget is locked into double-entry escrow holds before creators begin production." },
                  { step: "03", label: "Verify", desc: "Deliverables and live post engagement are verified directly via social APIs." },
                  { step: "04", label: "Settle", desc: "Escrow releases instantly to creator's bank account with Section 194-O TDS certified." },
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-3.5">
                    <span className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-black flex items-center justify-center shrink-0">
                      {item.step}
                    </span>
                    <div>
                      <span className="font-bold text-sm text-foreground">{item.label} &bull; </span>
                      <span className="text-xs text-muted-foreground leading-relaxed">{item.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Values Grid ───────────────────────────────────── */}
        <section className="bg-card/40 border-y border-border py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <h2 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
                Our Operating Principles
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Six core commitments that guide our platform architecture, mediation standards, and community contracts.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {values.map((item) => {
                const Icon = item.icon;
                return (
                  <article
                    key={item.title}
                    className="p-6 rounded-2xl bg-card border border-border hover:border-primary/40 hover:shadow-md transition-all space-y-3"
                  >
                    <div className={`w-11 h-11 rounded-xl ${item.bg} border ${item.border} flex items-center justify-center ${item.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <span className={`text-[10px] font-black uppercase tracking-wider block mb-1 ${item.color}`}>
                        {item.label}
                      </span>
                      <h3 className="text-base font-bold text-foreground">
                        {item.title}
                      </h3>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {item.description}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Timeline ──────────────────────────────────────── */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h2 className="text-3xl font-black text-foreground tracking-tight">
              Our Journey
            </h2>
            <p className="text-sm text-muted-foreground">
              From an ambitious idea to India&apos;s most trusted creator commerce engine.
            </p>
          </div>

          <div className="relative pl-6 sm:pl-8 space-y-8 border-l border-border ml-4 sm:ml-6">
            {timeline.map((item) => (
              <div key={item.year} className="relative group">
                {/* Dot */}
                <div className="absolute -left-[35px] sm:-left-[43px] top-1.5 w-6 h-6 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                </div>

                <div className="p-5 rounded-2xl bg-card border border-border group-hover:border-primary/40 transition-colors space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-black">
                      {item.year}
                    </span>
                    <h3 className="font-bold text-sm text-foreground">{item.title}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {item.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Bottom CTA Banner ─────────────────────────────── */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-8 sm:p-12 rounded-3xl bg-card border border-border shadow-xl text-center space-y-6 relative overflow-hidden">
            <div className="space-y-3 max-w-xl mx-auto">
              <h2 className="text-3xl font-black text-foreground tracking-tight">
                Ready for Zero-Risk Collaborations?
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Join thousands of verified brands and creators operating with guaranteed escrow, instant TDS settlements, and legally enforceable contracts.
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/register?type=brand"
                className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-md hover:bg-primary/90 transition-all inline-flex items-center gap-2"
              >
                <Building2 className="w-4 h-4" />
                Start as a Brand
              </Link>
              <Link
                href="/register?type=influencer"
                className="px-6 py-3 rounded-xl bg-card border border-border text-foreground font-bold text-sm hover:bg-muted transition-all inline-flex items-center gap-2"
              >
                <Users2 className="w-4 h-4" />
                Join as a Creator
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
