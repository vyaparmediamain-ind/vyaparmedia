import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { FileText, Shield, ArrowRight, Clock, Mail, ChevronRight, Building2 } from "lucide-react";
import { PLATFORM_CONFIG } from "@/lib/platform-config";

interface LegalSection {
  id: string;
  heading: string;
}

interface LegalLayoutProps {
  title: string;
  lastUpdated: string;
  description: string;
  sections: LegalSection[];
  children: React.ReactNode;
}

const LEGAL_DOCUMENTS = [
  { title: "Terms of Service", href: "/terms" },
  { title: "Privacy Policy", href: "/privacy" },
  { title: "Refund & Cancellation", href: "/refund" },
  { title: "Cookie Policy", href: "/cookie-policy" },
  { title: "Legal Center Hub", href: "/legal" },
];

export function LegalLayout({ title, lastUpdated, description, sections, children }: LegalLayoutProps) {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />

      <main className="flex-1 pt-24 pb-16">
        {/* ── Document Hero ─────────────────────────────────── */}
        <section className="border-b border-border/40 pb-12 mb-12">
          <div className="container max-w-5xl mx-auto px-4 sm:px-6">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-6">
              <Link href="/" className="hover:text-foreground transition-colors">
                Home
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
              <Link href="/legal" className="hover:text-foreground transition-colors">
                Legal Center
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
              <span className="text-foreground font-medium">{title}</span>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-wider mb-4 shrink-0 whitespace-nowrap">
              <Shield className="w-3.5 h-3.5" />
              <span>Official Regulatory Document</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-foreground tracking-tight mb-4">
              {title}
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-3xl leading-relaxed mb-4">
              {description}
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              <span>Last updated: <strong className="text-foreground font-semibold">{lastUpdated}</strong></span>
            </div>
          </div>
        </section>

        {/* ── Document Body & Sidebar ──────────────────────── */}
        <section>
          <div className="container max-w-5xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-10 items-start">
              {/* Content */}
              <article className="min-w-0 prose prose-neutral dark:prose-invert max-w-none text-muted-foreground text-sm sm:text-base leading-relaxed">
                {children}

                {/* Statutory Corporate Identification Disclosure (Companies Act, 2013) */}
                <div className="not-prose mt-12 pt-6 border-t border-border/80">
                  <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
                      <Building2 className="w-4 h-4 text-primary" />
                      <span>Statutory Corporate Disclosure</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-2xs uppercase tracking-wider font-semibold text-muted-foreground block mb-0.5">
                          Corporate Name
                        </span>
                        <span className="font-bold text-foreground block">
                          {PLATFORM_CONFIG.legalName}
                        </span>
                      </div>
                      <div>
                        <span className="text-2xs uppercase tracking-wider font-semibold text-muted-foreground block mb-0.5">
                          Corporate Identity Number (CIN)
                        </span>
                        <span className="font-mono font-bold text-foreground block">
                          {PLATFORM_CONFIG.cin}
                        </span>
                      </div>
                      <div>
                        <span className="text-2xs uppercase tracking-wider font-semibold text-muted-foreground block mb-0.5">
                          Registered Office Address
                        </span>
                        <span className="text-muted-foreground block leading-relaxed">
                          {PLATFORM_CONFIG.address}
                        </span>
                      </div>
                      <div>
                        <span className="text-2xs uppercase tracking-wider font-semibold text-muted-foreground block mb-0.5">
                          Tax &amp; Service Classification
                        </span>
                        <span className="font-mono text-muted-foreground block">
                          GSTIN: {PLATFORM_CONFIG.gstin} | SAC: 998365
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </article>

              {/* Sidebar TOC */}
              <aside className="space-y-6 lg:sticky lg:top-28">
                {/* Table of contents */}
                {sections.length > 0 && (
                  <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-primary" />
                      <span>On This Page</span>
                    </p>
                    <nav className="space-y-1">
                      {sections.map((s) => (
                        <a
                          key={s.id}
                          href={`#${s.id}`}
                          className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center py-2 min-h-[44px] line-clamp-1"
                        >
                          {s.heading}
                        </a>
                      ))}
                    </nav>
                  </div>
                )}

                {/* All Legal Documents Quick Switcher */}
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                    All Legal Policies
                  </p>
                  <ul className="space-y-1">
                    {LEGAL_DOCUMENTS.map((doc) => (
                      <li key={doc.href}>
                        <Link
                          href={doc.href}
                          className={`text-xs py-2 min-h-[44px] transition-colors flex items-center justify-between ${
                            doc.title === title
                              ? "text-primary font-bold"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <span>{doc.title}</span>
                          {doc.title === title && (
                            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Corporate Identity & CIN */}
                <div className="rounded-2xl border border-border bg-card p-5 text-xs text-muted-foreground space-y-2.5 shadow-sm">
                  <div className="flex items-center gap-1.5 font-bold text-foreground">
                    <Building2 className="w-4 h-4 text-primary" />
                    <span>Corporate Identity</span>
                  </div>
                  <div>
                    <span className="font-bold text-foreground block">{PLATFORM_CONFIG.legalName}</span>
                    <span className="font-mono text-2xs text-muted-foreground block">CIN: {PLATFORM_CONFIG.cin}</span>
                  </div>
                  <p className="text-2xs text-muted-foreground leading-normal border-t border-border/60 pt-2">
                    Registered Office: {PLATFORM_CONFIG.address}
                  </p>
                </div>

                {/* Grievance & Questions */}
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 text-xs text-muted-foreground space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-foreground">
                    <Mail className="w-4 h-4 text-primary" />
                    <span>Legal Grievance</span>
                  </div>
                  <p>
                    For regulatory notices, DPDP compliance, or formal disputes:
                  </p>
                  <a
                    href="mailto:legal@vyaparmedia.in"
                    className="inline-flex items-center gap-1 min-h-[44px] font-bold text-primary hover:underline"
                  >
                    legal@vyaparmedia.in <ArrowRight className="w-3 h-3" />
                  </a>
                </div>
              </aside>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

/* ── Reusable Section Block ──────────────────────────────── */
export function LegalSection({
  id,
  heading,
  children,
  highlight,
}: {
  id: string;
  heading: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-28 mb-10 ${
        highlight
          ? "rounded-2xl border border-primary/20 bg-primary/5 p-6"
          : ""
      }`}
    >
      <h2 className="text-xl font-bold text-foreground mb-4">
        {heading}
      </h2>
      <div className="space-y-3">
        {children}
      </div>
    </section>
  );
}
