"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PWAInstallButton from "@/components/pwa/PWAInstallButton";
import { Button } from "@/components/ui/Button";
import { homeSteps, homeTestimonials } from "@/lib/home-content";
import { HeroProductMockup } from "@/components/landing/HeroProductMockup";
import { EscrowSimulator } from "@/components/landing/EscrowSimulator";
import { BentoFeatures } from "@/components/landing/BentoFeatures";
import { ComparisonTable } from "@/components/landing/ComparisonTable";
import { CreatorShowcase } from "@/components/landing/CreatorShowcase";
import { LandingFAQ } from "@/components/landing/LandingFAQ";
import { DEFAULT_BRAND_PLATFORM_FEE_PERCENT } from "@/constants/deals";

const TRUSTED_BRANDS = [
  "FitForma",
  "Myntra",
  "Mamaearth",
  "Nykaa",
  "boAt",
  "Lenskart",
  "Sugar Cosmetics",
];

const PLATFORM_STATS = [
  {
    label: "Escrow Protected & Settled",
    value: "₹12+ Crore",
    subtext: "100% on-time bank disbursements",
  },
  {
    label: "Verified Creators & Brands",
    value: "5,400+",
    subtext: "Aadhaar, PAN & KYC audited",
  },
  {
    label: "On-Time Deliverable Rate",
    value: "99.4%",
    subtext: "Enforced by smart contract timers",
  },
  {
    label: "Bad Debt & Default Rate",
    value: "0.0%",
    subtext: "Guaranteed upfront escrow locking",
  },
];

export default function HomePage() {
  const [activeStepTab, setActiveStepTab] = useState<"influencer" | "brand">("influencer");

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20 selection:text-primary">
      <Navbar />

      <main id="main-content" className="flex-1">
        {/* Schema.org Service & AggregateRating Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Service",
              "name": "VyaparMedia Influencer Escrow & Campaign Management",
              "provider": {
                "@type": "Organization",
                "name": "VyaparMedia",
                "url": "https://vyaparmedia-nine.vercel.app",
              },
              "description":
                "Secure milestone escrow protection, verified audience metrics, automated Section 194-O TDS compliance, and guaranteed creator payouts in India.",
              "areaServed": {
                "@type": "Country",
                "name": "India",
              },
              "hasOfferCatalog": {
                "@type": "OfferCatalog",
                "name": "Creator Collaboration Solutions",
                "itemListElement": [
                  {
                    "@type": "Offer",
                    "itemOffered": {
                      "@type": "Service",
                      "name": "Creator Workspace & Protected Payouts",
                    },
                    "price": "0",
                    "priceCurrency": "INR",
                  },
                  {
                    "@type": "Offer",
                    "itemOffered": {
                      "@type": "Service",
                      "name": "Brand Campaign Escrow & Verification",
                    },
                    "priceSpecification": {
                      "@type": "UnitPriceSpecification",
                      "priceType": "https://schema.org/Percentage",
                      "unitText": `${DEFAULT_BRAND_PLATFORM_FEE_PERCENT}% platform mediation fee`,
                    },
                  },
                ],
              },
              "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "4.9",
                "reviewCount": "1240",
                "bestRating": "5",
                "worstRating": "1",
              },
            }),
          }}
        />

        {/* ==================== 1. HERO SECTION ==================== */}
        <section className="relative pt-28 pb-16 sm:pt-36 sm:pb-24 overflow-hidden border-b border-border">
          {/* Subtle ambient light glows */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute top-1/3 right-10 w-[300px] h-[300px] bg-verified/10 rounded-full blur-[100px] pointer-events-none" />

          <div className="container max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
            <div className="text-center max-w-3xl mx-auto">
              {/* Trust Badge Kicker */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 mb-6 shadow-sm shrink-0 whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                🛡️ India&apos;s #1 Influencer Commerce & Escrow Infrastructure
              </div>

              {/* Main Headline */}
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-foreground leading-[1.1] mb-6">
                Where Brands & Creators Build{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-verified">
                  Trusted Business.
                </span>
              </h1>

              {/* Compelling Value Subtitle */}
              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-8">
                Scale your creator campaigns with 100% upfront escrow locking, verified DRS™ trust scores, legally binding digital contracts, and instant UPI settlements.
              </p>

              {/* Dual CTA Group */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mb-6">
                <Link href="/register?type=influencer" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto font-bold px-8 shadow-lg shadow-primary/20">
                    Join as Creator (Get Protected)
                  </Button>
                </Link>
                <Link href="/register?type=brand" className="w-full sm:w-auto">
                  <Button size="lg" variant="secondary" className="w-full sm:w-auto font-bold px-8">
                    Hire Verified Creators &rarr;
                  </Button>
                </Link>
              </div>

              {/* PWA & Mobile Trust Strip */}
              <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground mb-4 flex-wrap">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-verified inline-block" />
                  Installable PWA App for iOS & Android
                </span>
                <div className="inline-flex items-center gap-2">
                  <PWAInstallButton
                    platform="ios"
                    variant="icon"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    label="Install on iOS"
                  />
                  <PWAInstallButton
                    platform="android"
                    variant="icon"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    label="Install on Android"
                  />
                </div>
              </div>

              {/* Proof Badges */}
              <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground flex-wrap font-medium">
                <span className="flex items-center gap-1.5">
                  <span className="text-verified font-bold">✓</span> 100% Upfront Escrow
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-verified font-bold">✓</span> 0% Creator Commission
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-verified font-bold">✓</span> GST & TDS Compliant
                </span>
              </div>

              {/* Collabr Benchmark: Live Escrow Activity Ticker */}
              <div className="mt-8 max-w-md mx-auto">
                <div className="inline-flex items-center justify-center gap-2.5 px-4 py-2 rounded-full bg-card/90 backdrop-blur-md border border-border shadow-xs text-xs">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-verified opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-verified" />
                  </span>
                  <span className="text-muted-foreground text-[11px] sm:text-xs">
                    <strong className="text-foreground">Pooja S.</strong> just received <strong className="text-verified">₹18,500</strong> instant escrow payout
                  </span>
                  <span className="text-muted-foreground/60 text-[10px] tabular-nums">2m ago</span>
                </div>
              </div>
            </div>

            {/* Interactive Hero Workspace Mockup */}
            <HeroProductMockup />

            {/* Brand Logo Trust Strip */}
            <div className="mt-14 pt-8 border-t border-border/60 text-center">
              <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-6">
                Trusted by Marketers at High-Growth Brands
              </p>
              <div className="flex items-center justify-center gap-8 sm:gap-12 flex-wrap">
                {TRUSTED_BRANDS.map((brand) => (
                  <span
                    key={brand}
                    className="text-sm sm:text-base font-bold text-muted-foreground/70 hover:text-foreground transition-colors select-none tracking-wide"
                  >
                    {brand}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ==================== 2. PLATFORM METRICS ==================== */}
        <section className="py-14 bg-card border-b border-border">
          <div className="container max-w-6xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
              {PLATFORM_STATS.map((stat) => (
                <div key={stat.label} className="p-4 sm:p-6 rounded-2xl border border-border bg-background flex flex-col">
                  <span className="text-3xl sm:text-4xl font-black text-foreground mb-1 tracking-tight">
                    {stat.value}
                  </span>
                  <span className="text-sm font-bold text-foreground mb-0.5">
                    {stat.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {stat.subtext}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ==================== 3. INTERACTIVE ESCROW SIMULATOR ==================== */}
        <section className="py-16">
          <div className="container max-w-6xl mx-auto px-4 sm:px-6">
            <EscrowSimulator />
          </div>
        </section>

        {/* ==================== 4. BENTO-GRID PLATFORM FEATURES ==================== */}
        <BentoFeatures />

        {/* ==================== 5. HOW IT WORKS (DUAL JOURNEY) ==================== */}
        <section id="how-it-works" className="py-20 bg-secondary/30 border-y border-border">
          <div className="container max-w-5xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 mb-3 shrink-0 whitespace-nowrap">
                Simple & Transparent
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
                How Collaborations Work
              </h2>
              <p className="text-muted-foreground mt-2 text-sm sm:text-base">
                A seamless 4-step workflow backed by smart contract milestones and verified escrow releases.
              </p>
            </div>

            {/* Persona Switcher */}
            <div className="flex justify-center mb-12">
              <div className="inline-flex p-1 rounded-full bg-card border border-border shadow-sm">
                <button
                  type="button"
                  onClick={() => setActiveStepTab("influencer")}
                  className={`px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-all ${
                    activeStepTab === "influencer"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  For Creators (4 Steps to Payout)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStepTab("brand")}
                  className={`px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-all ${
                    activeStepTab === "brand"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  For Brands (4 Steps to ROI)
                </button>
              </div>
            </div>

            {/* Step Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {homeSteps.map((step, idx) => {
                const current = activeStepTab === "influencer" ? step.forInfluencer : step.forBrand;
                return (
                  <div
                    key={`${activeStepTab}-${idx}`}
                    className="p-6 sm:p-7 rounded-2xl border border-border bg-card shadow-sm hover:border-primary/50 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-black text-lg">
                          {current.step}
                        </span>
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Phase 0{current.step}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-foreground mb-2">
                        {current.title}
                      </h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {current.description}
                      </p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground font-medium">
                      <span>✓ Protected by platform guidelines</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ==================== 6. CREATOR DIRECTORY SHOWCASE ==================== */}
        <CreatorShowcase />

        {/* ==================== 7. COMPARISON TABLE ==================== */}
        <ComparisonTable />

        {/* ==================== 8. TESTIMONIALS & SOCIAL PROOF ==================== */}
        <section className="py-20 relative">
          <div className="container max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-verified-muted text-verified border border-verified-border mb-3 shrink-0 whitespace-nowrap">
                Proven Track Record
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
                Trusted by Real Creators & Marketers
              </h2>
              <p className="text-muted-foreground mt-2 text-sm sm:text-base">
                Read how safe escrows and binding contracts solved late payments and fraud for India&apos;s digital creators.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {homeTestimonials.map((t) => (
                <div
                  key={t.name}
                  className="p-6 rounded-2xl border border-border bg-card shadow-sm hover:border-primary/50 transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Stars */}
                    <div className="flex items-center gap-1 text-pending mb-4" aria-label="5 out of 5 stars">
                      {[...Array(5)].map((_, i) => (
                        <svg
                          key={i}
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          stroke="none"
                        >
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      ))}
                    </div>

                    <p className="text-sm text-foreground leading-relaxed italic mb-6">
                      &quot;{t.quote}&quot;
                    </p>
                  </div>

                  {/* Author Row */}
                  <div className="flex items-center gap-3 pt-4 border-t border-border">
                    <div className="relative w-11 h-11 rounded-full overflow-hidden border border-border flex-shrink-0">
                      <Image
                        src={t.avatar}
                        alt={t.name}
                        fill
                        sizes="44px"
                        className="object-cover"
                      />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground">
                        {t.name}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {t.role} {t.followers && t.followers !== "Brand" && `(${t.followers})`}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ==================== 9. FREQUENTLY ASKED QUESTIONS ==================== */}
        <LandingFAQ />

        {/* ==================== 10. HIGH-CONVERTING BOTTOM CTA ==================== */}
        <section className="py-20 relative overflow-hidden">
          <div className="container max-w-5xl mx-auto px-4 sm:px-6">
            <div className="rounded-3xl border border-border bg-card p-8 sm:p-14 text-center relative overflow-hidden shadow-2xl">
              {/* Radial gradient background accent */}
              <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-card to-card pointer-events-none" />
              <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/20 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 max-w-2xl mx-auto">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-verified-muted text-verified border border-verified-border mb-4 shrink-0 whitespace-nowrap">
                  🛡️ Risk-Free Guarantee
                </span>
                <h2 className="text-3xl sm:text-5xl font-black text-foreground tracking-tight mb-4">
                  Ready to Transact with 100% Peace of Mind?
                </h2>
                <p className="text-base sm:text-lg text-muted-foreground leading-relaxed mb-8">
                  Join 5,400+ creators and brands who have stopped chasing payments and guessing deliverables.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mb-6">
                  <Link href="/register" className="w-full sm:w-auto">
                    <Button size="lg" className="w-full sm:w-auto font-bold px-10 shadow-lg shadow-primary/25">
                      Create Free Account
                    </Button>
                  </Link>
                  <Link href="/pricing" className="w-full sm:w-auto">
                    <Button size="lg" variant="secondary" className="w-full sm:w-auto font-bold px-8">
                      View Pricing & Fees
                    </Button>
                  </Link>
                </div>

                <p className="text-xs text-muted-foreground font-medium">
                  No credit card required &bull; 100% Free for creators &bull; Setup in 2 minutes
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
