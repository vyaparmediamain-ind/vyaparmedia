"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  ShieldCheck,
  FileText,
  Lock,
  RotateCcw,
  Cookie,
  ArrowRight,
  Scale,
  Building2,
} from "lucide-react";
import { TDS_194O_RATE_PERCENT_STRING } from "@/constants/tax";
import { PLATFORM_CONFIG } from "@/lib/platform-config";

const legalPages = [
  {
    title: "Privacy Policy",
    href: "/privacy",
    icon: Lock,
    badge: "DPDP Act Compliant",
    badgeVariant: "emerald",
    summary:
      "Details how we collect, store, tokenize, and protect personal data, KYC documents (PAN/Aadhaar references), payment records, and user privacy rights.",
  },
  {
    title: "Terms of Service",
    href: "/terms",
    icon: FileText,
    badge: "Commercial Framework",
    badgeVariant: "purple",
    summary:
      "Binding marketplace rules governing brand contracts, creator deliverables, automated escrow locking, content licensing, and dispute mediation.",
  },
  {
    title: "Refund & Cancellation",
    href: "/refund",
    icon: RotateCcw,
    badge: "Escrow Protection",
    badgeVariant: "amber",
    summary:
      "Deal-stage cancellation protocols, non-delivery remediation, milestone refund eligibility, chargeback handling, and dispute resolution timeframes.",
  },
  {
    title: "Cookie Policy",
    href: "/cookie-policy",
    icon: Cookie,
    badge: "Zero-Tracking Guarantee",
    badgeVariant: "cyan",
    summary:
      "Transparent disclosure of essential session cookies, Razorpay security tokens, PWA offline caching, and zero cross-site advertising profiling.",
  },
];

const statutoryFrameworks = [
  {
    title: "DPDP Act 2023",
    subtitle: "Digital Personal Data Protection",
    desc: "Strict purpose limitation, enterprise encryption, and user-initiated data rectification protocols.",
  },
  {
    title: "IT Act 2000 & 2021 Rules",
    subtitle: "Intermediary Guidelines",
    desc: "Expedited grievance redressal desk with 24h acknowledgement and 15-day maximum dispute resolution.",
  },
  {
    title: "Income Tax Section 194-O",
    subtitle: "E-Commerce TDS Withholding",
    desc: `Automated ${TDS_194O_RATE_PERCENT_STRING} TDS withholding on gross creator disbursements with automated Form 16A quarterly generation.`,
  },
  {
    title: "ASCI Disclosure Standards",
    subtitle: "Consumer Transparency",
    desc: "Automated verification of #Ad and #Sponsored promotional tags across all submitted social links.",
  },
];

export default function LegalPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />

      <main className="flex-1 pt-24 pb-16">
        {/* ── Hero ────────────────────────────────────────── */}
        <section className="relative overflow-hidden border-b border-border/40 pb-16">
          <div className="container max-w-5xl mx-auto px-4 sm:px-6 relative z-10 text-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-wider mb-6 shrink-0 whitespace-nowrap">
              <Scale className="w-3.5 h-3.5" />
              <span>Governance &amp; Regulatory Compliance</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-foreground tracking-tight max-w-3xl mx-auto mb-6 leading-tight">
              VyaparMedia Legal Center
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Transparent commercial contracts, escrow guarantees, and statutory tax-compliance frameworks tailored for the Indian creator economy.
            </p>
          </div>
        </section>

        {/* ── Core Policy Cards ───────────────────────────── */}
        <section className="py-12">
          <div className="container max-w-5xl mx-auto px-4 sm:px-6">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-2">Primary Policies &amp; Agreements</h2>
              <p className="text-sm text-muted-foreground">
                Review the legally binding terms and disclosures that protect both creators and enterprise brands.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
              {legalPages.map((page) => {
                const IconComponent = page.icon;
                return (
                  <Link
                    key={page.href}
                    href={page.href}
                    className="group bg-card border border-border/60 hover:border-primary/40 rounded-2xl p-6 sm:p-8 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
                          <IconComponent className="w-5 h-5" />
                        </div>
                        <span
                          className={`text-2xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border ${
                            page.badgeVariant === "emerald"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                              : page.badgeVariant === "purple"
                              ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                              : page.badgeVariant === "amber"
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                              : "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20"
                          }`}
                        >
                          {page.badge}
                        </span>
                      </div>

                      <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors mb-2">
                        {page.title}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                        {page.summary}
                      </p>
                    </div>

                    <div className="inline-flex items-center gap-1.5 text-xs font-bold text-primary group-hover:translate-x-1 transition-transform pt-4 border-t border-border/40">
                      <span>View Full Policy</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* ── Statutory Alignment Strip ─────────────────── */}
            <div className="rounded-3xl border border-border bg-card p-8 sm:p-10 mb-16 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary mb-3">
                <ShieldCheck className="w-4 h-4" />
                <span>Statutory &amp; Regulatory Alignment</span>
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-3">
                Built to Comply with Indian Federal Regulations
              </h3>
              <p className="text-sm text-muted-foreground max-w-2xl mb-8 leading-relaxed">
                VyaparMedia architecture is engineered from the ground up to respect Indian fiscal laws, consumer privacy mandates, and advertising honesty guidelines.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {statutoryFrameworks.map((framework) => (
                  <div key={framework.title} className="rounded-xl border border-border/60 bg-background/50 p-4">
                    <span className="text-xs font-bold text-primary block mb-1">{framework.title}</span>
                    <span className="text-sm font-semibold text-foreground block mb-1">{framework.subtitle}</span>
                    <p className="text-xs text-muted-foreground leading-relaxed">{framework.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Grievance Redressal Officer Desk ───────────── */}
            <div className="rounded-3xl border border-primary/20 bg-primary/5 p-8 sm:p-10">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider mb-3 shrink-0 whitespace-nowrap">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Statutory Grievance Officer</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
                    Grievance &amp; Compliance Redressal Desk
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
                    Under the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, any user may file a grievance regarding content violations, data privacy concerns, or platform disputes.
                  </p>
                </div>

                <div className="bg-card border border-border rounded-2xl p-6 min-w-full md:min-w-[320px] shadow-sm space-y-3.5">
                  <div>
                    <span className="text-2xs font-extrabold uppercase tracking-wider text-muted-foreground block mb-0.5">
                      Corporate Entity
                    </span>
                    <span className="text-sm font-bold text-foreground block">
                      {PLATFORM_CONFIG.legalName}
                    </span>
                    <span className="text-xs font-mono text-muted-foreground block">
                      CIN: {PLATFORM_CONFIG.cin}
                    </span>
                  </div>

                  <div>
                    <span className="text-2xs font-extrabold uppercase tracking-wider text-muted-foreground block mb-0.5">
                      Registered Office Address
                    </span>
                    <span className="text-xs text-muted-foreground block leading-relaxed">
                      {PLATFORM_CONFIG.address}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-border/60">
                    <span className="text-2xs font-extrabold uppercase tracking-wider text-muted-foreground block mb-0.5">
                      Designated Officer
                    </span>
                    <span className="text-sm font-bold text-foreground block">{PLATFORM_CONFIG.grievanceOfficer}</span>
                    <span className="text-2xs text-muted-foreground block">Designated Officer (IT Rules, 2021 &amp; DPDPA, 2023)</span>
                  </div>

                  <div>
                    <span className="text-2xs font-extrabold uppercase tracking-wider text-muted-foreground block mb-0.5">
                      Direct Email
                    </span>
                    <a
                      href={`mailto:${PLATFORM_CONFIG.grievanceEmail}`}
                      className="text-sm font-bold text-primary hover:underline block"
                    >
                      {PLATFORM_CONFIG.grievanceEmail}
                    </a>
                  </div>

                  <div>
                    <span className="text-2xs font-extrabold uppercase tracking-wider text-muted-foreground block mb-0.5">
                      Statutory SLA
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Acknowledged within 24h • Resolved within 15 days
                    </span>
                  </div>
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
