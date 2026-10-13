"use client";

import Link from "next/link";

export function BentoFeatures() {
  return (
    <section id="features" className="py-20 relative">
      <div className="container max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 mb-3 shrink-0 whitespace-nowrap">
            Platform Infrastructure
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
            Built on Trust. Engineered for Commerce.
          </h2>
          <p className="text-muted-foreground mt-3 text-base sm:text-lg">
            Every feature on VyaparMedia is engineered to eliminate payment friction, unverified accounts, and creator ghosting.
          </p>
        </div>

        {/* Row 1: 2 hero cards — 7 + 5 cols */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-6">
          {/* Card 1: Upfront Escrow */}
          <div className="md:col-span-7 rounded-2xl border border-border bg-card p-6 sm:p-8 flex flex-col justify-between hover:border-primary/50 transition-all shadow-sm hover:shadow-md relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-60 h-60 bg-escrow/10 rounded-full blur-3xl group-hover:bg-escrow/20 transition-all pointer-events-none" />
            <div>
              <div className="w-12 h-12 rounded-xl bg-escrow-muted text-escrow border border-escrow-border flex items-center justify-center mb-5">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-escrow">Core Security</span>
              <h3 className="text-xl sm:text-2xl font-bold text-foreground mt-1 mb-3">
                100% Upfront Escrow Protection
              </h3>
              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
                No creator starts work on a promise, and no brand pays for unapproved content. Brand funds are locked into RBI-compliant escrow before work begins and released stage-by-stage.
              </p>
            </div>
            <div className="mt-8 pt-5 border-t border-border flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <span className="w-2 h-2 rounded-full bg-verified flex-shrink-0" />
                Zero Default Risk
              </span>
              <Link href="/pricing" className="text-primary font-semibold hover:underline whitespace-nowrap">
                Explore Escrow Mechanics &rarr;
              </Link>
            </div>
          </div>

          {/* Card 2: DRS Trust Score & KYC */}
          <div className="md:col-span-5 rounded-2xl border border-border bg-card p-6 sm:p-8 flex flex-col justify-between hover:border-verified/50 transition-all shadow-sm hover:shadow-md relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-60 h-60 bg-verified/10 rounded-full blur-3xl group-hover:bg-verified/20 transition-all pointer-events-none" />
            <div>
              <div className="w-12 h-12 rounded-xl bg-verified-muted text-verified border border-verified-border flex items-center justify-center mb-5">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-verified">Anti-Fraud</span>
              <h3 className="text-xl sm:text-2xl font-bold text-foreground mt-1 mb-3">
                Dynamic DRS™ &amp; KYC
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Every creator profile features a verified Delivery Reliability Score (DRS), Aadhaar/PAN verification, and live engagement metrics to weed out bot accounts.
              </p>
            </div>
            <div className="mt-8 pt-5 border-t border-border flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-md font-semibold bg-verified-muted text-verified whitespace-nowrap">
                98% Avg Trust Rating
              </span>
              <span className="text-muted-foreground font-medium whitespace-nowrap">Govt ID Checked</span>
            </div>
          </div>
        </div>

        {/* Row 2: 3 equal feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
          {/* Card 3: Anti-Leak Deal Room */}
          <div className="rounded-2xl border border-border bg-card p-6 flex flex-col justify-between hover:border-primary/50 transition-all shadow-sm hover:shadow-md overflow-hidden">
            <div>
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">
                Anti-Leak Deal Room
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                In-app encrypted communication prevents off-platform disintermediation, preserves evidence, and keeps contracts binding.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-border text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <span>🛡️ Automatic leak detection</span>
            </div>
          </div>

          {/* Card 4: Smart Digital Contracts */}
          <div className="rounded-2xl border border-border bg-card p-6 flex flex-col justify-between hover:border-primary/50 transition-all shadow-sm hover:shadow-md overflow-hidden">
            <div>
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">
                Smart Digital Contracts
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Enforceable agreements generated automatically under the Indian Contract Act 1872 with clear usage rights, revision limits, and TDS/GST terms.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-border text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <span>⚖️ IT Act 2000 Compliant</span>
            </div>
          </div>

          {/* Card 5: Live Post Verification */}
          <div className="rounded-2xl border border-border bg-card p-6 flex flex-col justify-between hover:border-primary/50 transition-all shadow-sm hover:shadow-md overflow-hidden">
            <div>
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polygon points="10 8 16 12 10 16 10 8" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">
                Live Post Verification
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Automated API check validates Instagram Reels and YouTube links to confirm mandatory hashtags, brand mentions, and required duration.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-border text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <span>🤖 60-Second Auto Verification</span>
            </div>
          </div>
        </div>

        {/* Row 3: Full-width payout banner */}
        <div className="rounded-2xl border border-border bg-gradient-to-r from-card to-secondary/30 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 hover:border-primary/50 transition-all shadow-sm">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-verified-muted text-verified border border-verified-border flex items-center justify-center flex-shrink-0">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 19-7-7 7-7" />
                <path d="M19 12H5" />
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="text-lg sm:text-xl font-bold text-foreground">
                Instant UPI &amp; IMPS Bank Settlements
              </h3>
              <p className="text-muted-foreground text-sm mt-0.5">
                Once deliverables are approved, funds are transferred straight to creator bank accounts in under 24 hours. Zero 60-day delay nonsense.
              </p>
            </div>
          </div>
          <Link href="/register" className="flex-shrink-0">
            <button className="px-5 py-2.5 rounded-lg text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm whitespace-nowrap">
              Get Protected Today
            </button>
          </Link>
        </div>

      </div>
    </section>
  );
}
