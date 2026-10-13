"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { DEFAULT_BRAND_PLATFORM_FEE_PERCENT } from "@/constants";

const COMPARISON_ROWS = [
  {
    feature: "Payment Protection",
    traditional: "60-90 Days Net, rampant payment ghosting",
    vyapar: "100% Upfront Escrow Locked before work begins",
    highlight: true,
  },
  {
    feature: "Pricing Transparency",
    traditional: "30% - 50% hidden markup & agency cuts",
    vyapar: `Flat ${DEFAULT_BRAND_PLATFORM_FEE_PERCENT}% platform fee, 0% creator deductions`,
    highlight: false,
  },
  {
    feature: "Contract Enforceability",
    traditional: "Informal WhatsApp chats & DMs",
    vyapar: "Smart contracts compliant with Indian Contract Act 1872",
    highlight: false,
  },
  {
    feature: "Milestone Workflow",
    traditional: "Endless unpaid revisions without timeline limits",
    vyapar: "Structured 3-stage milestone approval stepper",
    highlight: false,
  },
  {
    feature: "Post Verification",
    traditional: "Manual screenshot checks, fake engagement bots",
    vyapar: "Automated crawler verifies live Reels & YouTube tags in 60s",
    highlight: false,
  },
  {
    feature: "Dispute Redressal",
    traditional: "Unregulated, zero mediation, bad debts written off",
    vyapar: "In-App Evidence Room with neutral mediation & arbitration",
    highlight: true,
  },
  {
    feature: "Tax & Compliance",
    traditional: "Messy manual TDS tracking & missing GST invoices",
    vyapar: "Automated GST B2B invoices & Sec 194-O / 194J TDS compliance",
    highlight: false,
  },
];

export function ComparisonTable() {
  return (
    <section className="py-20 bg-secondary/30 relative">
      <div className="container max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-verified-muted text-verified border border-verified-border mb-3 shrink-0 whitespace-nowrap">
            Why Creators & Brands Switch
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
            VyaparMedia vs Traditional Agencies
          </h2>
          <p className="text-muted-foreground mt-3 text-sm sm:text-base">
            See why high-growth brands and India&apos;s top creators have abandoned messy WhatsApp deals for secure escrow infrastructure.
          </p>
        </div>

        {/* Comparison Table Card */}
        <div className="rounded-2xl border border-border bg-card shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="p-4 sm:p-5 text-xs font-bold uppercase tracking-wider text-muted-foreground w-1/3">
                    Feature & Workflow
                  </th>
                  <th className="p-4 sm:p-5 text-xs font-bold uppercase tracking-wider text-muted-foreground w-1/3">
                    Traditional Agencies / DMs
                  </th>
                  <th className="p-4 sm:p-5 text-xs font-bold uppercase tracking-wider text-primary w-1/3 bg-primary/5">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-primary" />
                      VyaparMedia Escrow
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {COMPARISON_ROWS.map((row) => (
                  <tr
                    key={row.feature}
                    className={`hover:bg-muted/20 transition-colors ${row.highlight ? "bg-card font-medium" : ""}`}
                  >
                    <td className="p-4 sm:p-5 font-semibold text-foreground">
                      {row.feature}
                    </td>
                    <td className="p-4 sm:p-5 text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm">
                        <span className="text-destructive flex-shrink-0 font-bold">✕</span>
                        {row.traditional}
                      </span>
                    </td>
                    <td className="p-4 sm:p-5 text-foreground bg-primary/5">
                      <span className="inline-flex items-center gap-1.5 font-medium text-xs sm:text-sm">
                        <span className="text-verified flex-shrink-0 font-bold">✓</span>
                        {row.vyapar}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-6 bg-muted/20 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <p className="font-bold text-foreground text-sm">
                Ready to eliminate agency markups and payment anxiety?
              </p>
              <p className="text-xs text-muted-foreground">
                Join 5,400+ verified creators and brands transacting securely.
              </p>
            </div>
            <Link href="/register">
              <Button size="sm" className="font-bold">
                Start Free Trial
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
