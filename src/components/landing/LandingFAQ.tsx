"use client";

import { useState } from "react";
import Link from "next/link";
import { DEFAULT_BRAND_PLATFORM_FEE_PERCENT } from "@/constants";

interface FAQItem {
  question: string;
  answer: string;
  category: "Escrow & Safety" | "Creators" | "Brands" | "Taxes & Legals";
}

const FAQS: FAQItem[] = [
  {
    category: "Escrow & Safety",
    question: "How does VyaparMedia ensure 100% upfront escrow protection?",
    answer:
      "When a brand hires a creator or creates a milestone deal, the full agreed campaign budget is deposited upfront into an RBI-compliant Razorpay Escrow account. Neither the brand can cancel without reason nor can the creator demand unearned funds. Payouts are released systematically upon milestone review and live post verification.",
  },
  {
    category: "Escrow & Safety",
    question: "What happens if a creator fails to post or delivers substandard content?",
    answer:
      "VyaparMedia has a built-in Dispute Resolution Center. If a creator fails to meet agreed deliverables within the contract deadline, or delivers content violating the creative brief, the brand can trigger a dispute review. If unrectified, the escrow funds are refunded to the brand according to our transparent Refund Policy.",
  },
  {
    category: "Creators",
    question: "Do creators have to pay any platform commission or withdrawal fees?",
    answer:
      "No! Joining VyaparMedia, applying to brand campaigns, and receiving payouts is 100% free for creators. The agreed fee you see on the campaign brief is the exact gross amount you earn upon approval. Zero hidden agency cuts.",
  },
  {
    category: "Creators",
    question: "How quickly do creator payouts hit my bank account?",
    answer:
      "Once your live post is verified by our automated system or approved by the brand, funds from escrow are initiated immediately via RazorpayX (IMPS / UPI) and typically settle into your linked Indian bank account within 24 hours.",
  },
  {
    category: "Brands",
    question: `How does the ${DEFAULT_BRAND_PLATFORM_FEE_PERCENT}% platform fee work for brands?`,
    answer:
      `VyaparMedia charges a flat, transparent ${DEFAULT_BRAND_PLATFORM_FEE_PERCENT}% escrow processing and mediation fee on the funded campaign budget. This covers digital smart contracts, KYC verification, live post crawling, dispute arbitration, and GST compliance. There are no monthly retainer fees or setup costs.`,
  },
  {
    category: "Taxes & Legals",
    question: "How are GST and TDS (Section 194-O / 194J) handled?",
    answer:
      "VyaparMedia provides automated B2B GST tax invoices for all campaign transactions. For compliance under Section 194-O and Section 194J, our system generates automated quarterly TDS credit schedules and tax reports.",
  },
];

const CATEGORIES = ["All", "Escrow & Safety", "Creators", "Brands", "Taxes & Legals"] as const;

export function LandingFAQ() {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const filtered = selectedCategory === "All"
    ? FAQS
    : FAQS.filter((f) => f.category === selectedCategory);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq" className="py-20 relative">
      {/* Schema.org FAQPage Structured Data for Google Accordion Rich Snippets */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": FAQS.map((faq) => ({
              "@type": "Question",
              "name": faq.question,
              "acceptedAnswer": {
                "@type": "Answer",
                "text": faq.answer,
              },
            })),
          }),
        }}
      />
      <div className="container max-w-4xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 mb-3 shrink-0 whitespace-nowrap">
            Got Questions?
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">
            Everything you need to know about VyaparMedia&apos;s escrow safety, digital contracts, and payouts.
          </p>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setSelectedCategory(cat);
                setOpenIndex(0);
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                selectedCategory === cat
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Accordion Items */}
        <div className="space-y-4">
          {filtered.map((item, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={item.question}
                className="rounded-xl border border-border bg-card overflow-hidden transition-all shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => toggle(idx)}
                  aria-expanded={isOpen}
                  className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 font-bold text-sm sm:text-base text-foreground hover:text-primary transition-colors cursor-pointer"
                >
                  <span>{item.question}</span>
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center bg-muted text-muted-foreground flex-shrink-0 transition-transform duration-200 ${
                      isOpen ? "rotate-180 bg-primary/10 text-primary" : ""
                    }`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </span>
                </button>
                {isOpen && (
                  <div className="px-5 sm:px-6 pb-5 sm:pb-6 text-xs sm:text-sm text-muted-foreground leading-relaxed pt-1 border-t border-border/50 animate-fade-in">
                    {item.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Support Link */}
        <div className="mt-10 text-center text-xs sm:text-sm text-muted-foreground">
          Have another question?{" "}
          <Link href="/help" className="font-semibold text-primary hover:underline">
            Visit our 24/7 Help Center &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
}
