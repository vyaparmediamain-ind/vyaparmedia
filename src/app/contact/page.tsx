"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import { useState } from "react";
import {
  Mail,
  Scale,
  ShieldAlert,
  ArrowUpRight,
  ChevronDown,
  Clock,
  Sparkles,
  Headphones,
  Building2,
} from "lucide-react";
import { PLATFORM_CONFIG } from "@/lib/platform-config";

const contactChannels = [
  {
    icon: Headphones,
    title: "Creator & Brand Support",
    body: "Assistance with campaigns, deliverables, escrow withdrawals, verification, and dashboard tools.",
    href: "mailto:support@vyaparmedia.in",
    label: "support@vyaparmedia.in",
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
  },
  {
    icon: Sparkles,
    title: "Agency & Brand Partnerships",
    body: "Enterprise campaign management, D2C brand onboarding, talent agency rosters, and custom escrow SLAs.",
    href: "mailto:partnerships@vyaparmedia.in",
    label: "partnerships@vyaparmedia.in",
    color: "text-verified",
    bg: "bg-verified/10",
    border: "border-verified-border",
  },
  {
    icon: Scale,
    title: "Legal, Tax & Compliance",
    body: "GST invoicing queries, Section 194-O TDS certificate requests, contracts, and regulatory filings.",
    href: "mailto:legal@vyaparmedia.in",
    label: "legal@vyaparmedia.in",
    color: "text-accent-purple",
    bg: "bg-accent-purple/10",
    border: "border-accent-purple/20",
  },
  {
    icon: ShieldAlert,
    title: "Privacy & Data Grievance",
    body: "Account deletion, personal data audit, consent withdrawal, and DPDP Act grievance escalation.",
    href: "mailto:privacy@vyaparmedia.in",
    label: "privacy@vyaparmedia.in",
    color: "text-warning",
    bg: "bg-warning/10",
    border: "border-warning-border",
  },
];

const faqs = [
  {
    q: "How long does platform support take to respond?",
    a: "Support tickets are typically addressed within 1–2 business days. Critical payment or security escalations are prioritized and reviewed in under 4 hours.",
  },
  {
    q: "What is the fastest way to get help on an active deal?",
    a: "If you have an active deal, use the in-app deal room chat or the Dispute Center. It automatically attaches contract terms, escrow ledger history, and deliverable hashes.",
  },
  {
    q: "Where do I send legal notices or compliance summons?",
    a: "Please dispatch formal notices to legal@vyaparmedia.in with registered user emails, deal reference numbers, and full corporate signatory details.",
  },
];

export default function ContactPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />

      <main className="flex-1 pt-24 pb-20 space-y-16">
        {/* ── Hero ──────────────────────────────────────────── */}
        <section className="px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-center space-y-4 pt-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider">
            <Mail className="w-3.5 h-3.5" />
            <span>Support &amp; Communications</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-black text-foreground tracking-tight">
            Contact <span className="bg-gradient-to-r from-primary to-accent-purple bg-clip-text text-transparent">VyaparMedia</span>
          </h1>

          <p className="text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Connect with our creator support team, business partnerships unit, or compliance desk.
          </p>
        </section>

        {/* ── Contact Channels Grid ─────────────────────────── */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {contactChannels.map((ch) => {
              const Icon = ch.icon;
              return (
                <article
                  key={ch.title}
                  className="p-6 rounded-2xl bg-card border border-border hover:border-primary/40 hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
                >
                  <div className="space-y-3">
                    <div className={`w-11 h-11 rounded-xl ${ch.bg} border ${ch.border} flex items-center justify-center ${ch.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <h2 className="text-base font-bold text-foreground">
                      {ch.title}
                    </h2>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {ch.body}
                    </p>
                  </div>

                  <a
                    href={ch.href}
                    className={`inline-flex items-center gap-1.5 text-xs font-bold ${ch.color} hover:underline pt-2`}
                  >
                    <span>{ch.label}</span>
                    <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </a>
                </article>
              );
            })}
          </div>
        </section>

        {/* ── Fastest Support Path & FAQ ────────────────────── */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Direct Escalation Card */}
            <div className="p-6 sm:p-7 rounded-2xl bg-card border border-border space-y-5 shadow-sm">
              <div className="space-y-2">
                <span className="text-xs font-black text-primary uppercase tracking-wider block">
                  Logged-in User Support
                </span>
                <h2 className="text-xl font-black text-foreground">
                  Fastest Support Path
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  For active deals, milestones, or pending payouts, opening a ticket inside the Dashboard guarantees priority handling with contract state pre-attached.
                </p>
              </div>

              <div className="flex flex-col gap-2.5">
                <Link
                  href="/dashboard/messages"
                  className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs text-center shadow-sm hover:bg-primary/90 transition-colors"
                >
                  Open Dashboard Messages
                </Link>
                <Link
                  href="/dashboard/disputes"
                  className="px-4 py-2.5 rounded-xl bg-card border border-border text-foreground font-bold text-xs text-center hover:bg-muted transition-colors"
                >
                  Open Dispute Resolution Desk
                </Link>
              </div>

              <div className="pt-4 border-t border-border space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Expected Response Windows</span>
                </div>
                <ul className="text-xs text-muted-foreground space-y-1 pl-5 list-disc">
                  <li>General queries: 1–2 business days</li>
                  <li>Payment / security inquiries: &lt; 4 hours</li>
                  <li>Formal legal notices: Include full contract IDs</li>
                </ul>
              </div>
            </div>

            {/* Quick FAQs */}
            <div className="p-6 sm:p-7 rounded-2xl bg-card border border-border space-y-4 shadow-sm">
              <div className="space-y-1">
                <h2 className="text-xl font-black text-foreground">
                  Common Questions
                </h2>
                <p className="text-xs text-muted-foreground">
                  Quick answers to immediate platform inquiries.
                </p>
              </div>

              <div className="space-y-2.5">
                {faqs.map((faq, i) => (
                  <div
                    key={faq.q}
                    className="border border-border rounded-xl overflow-hidden transition-colors"
                  >
                    <button
                      type="button"
                      className="w-full text-left px-4 py-3 flex items-center justify-between text-xs font-bold text-foreground hover:bg-muted/40 transition-colors cursor-pointer"
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      aria-expanded={openFaq === i}
                    >
                      <span className="pr-3">{faq.q}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 ${
                          openFaq === i ? "rotate-180 text-primary" : ""
                        }`}
                      />
                    </button>
                    {openFaq === i && (
                      <div className="px-4 pb-3.5 text-xs text-muted-foreground leading-relaxed border-t border-border/60 pt-2.5">
                        {faq.a}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Registered Corporate Office & Legal Disclosure ─── */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-border bg-card p-7 sm:p-9 shadow-sm space-y-5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
              <Building2 className="w-4 h-4 text-primary" />
              <span>Registered Corporate Office &amp; Statutory Identifiers</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 text-xs">
              <div>
                <span className="text-2xs uppercase tracking-wider font-semibold text-muted-foreground block mb-1">
                  Legal Entity Name
                </span>
                <span className="font-bold text-foreground block">
                  {PLATFORM_CONFIG.legalName}
                </span>
              </div>
              <div>
                <span className="text-2xs uppercase tracking-wider font-semibold text-muted-foreground block mb-1">
                  Corporate Identity Number (CIN)
                </span>
                <span className="font-mono font-bold text-foreground block">
                  {PLATFORM_CONFIG.cin}
                </span>
              </div>
              <div>
                <span className="text-2xs uppercase tracking-wider font-semibold text-muted-foreground block mb-1">
                  Registered Office Address
                </span>
                <span className="text-muted-foreground block leading-relaxed">
                  {PLATFORM_CONFIG.address}
                </span>
              </div>
              <div>
                <span className="text-2xs uppercase tracking-wider font-semibold text-muted-foreground block mb-1">
                  Tax Registrations
                </span>
                <span className="font-mono text-muted-foreground block">
                  GSTIN: {PLATFORM_CONFIG.gstin}
                </span>
                <span className="text-2xs text-muted-foreground block mt-0.5">
                  SAC: 998365 (Advertising &amp; Escrow Intermediary)
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
