"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui";
import {
  Search,
  HelpCircle,
  ShieldCheck,
  Lock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Sparkles,
  ArrowRight,
  LifeBuoy,
  X,
} from "lucide-react";
import {
  DEFAULT_BRAND_PLATFORM_FEE_PERCENT,
  DEFAULT_INCLUDED_REVISIONS,
  DEFAULT_BRAND_REVIEW_PERIOD_HOURS,
  TDS_194O_RATE_PERCENT_STRING,
  TDS_206AA_PENAL_RATE_PERCENT_STRING,
} from "@/constants";

export type FaqCategory =
  | "ALL"
  | "GETTING_STARTED"
  | "PAYMENTS_ESCROW"
  | "DISPUTES_REVISIONS"
  | "KYC_SECURITY";

export interface FaqItem {
  id: string;
  category: FaqCategory;
  question: string;
  answer: string;
  badgeText?: string;
}

export const FAQ_DATA: FaqItem[] = [
  // 1. Getting Started
  {
    id: "gs-1",
    category: "GETTING_STARTED",
    question: "What is VyaparMedia and how does the marketplace work?",
    answer:
      "VyaparMedia is India's leading escrow-secured influencer marketing platform. Brands can discover verified creators across Instagram and YouTube, agree on structured deliverables (Reels, Stories, Dedicated Videos), and deposit funds into RBI-compliant escrow. Funds are released to creators only after deliverables are submitted, reviewed, and approved.",
    badgeText: "Platform Overview",
  },
  {
    id: "gs-2",
    category: "GETTING_STARTED",
    question: "Can I use VyaparMedia as both a Creator and a Brand?",
    answer:
      "Yes. During registration, you select your primary role (Creator or Brand). However, our flexible account management allows switching roles from Dashboard Settings if your agency also produces creator collaborations.",
    badgeText: "Account Roles",
  },
  {
    id: "gs-3",
    category: "GETTING_STARTED",
    question: "How do brands send offers to creators?",
    answer:
      "Brands can explore creator rate cards via the public creator profile or discovery feed, and click 'Send Collab Offer' or 'Invite to Campaign'. Deliverables, deadlines, and milestones are transparently specified before any funds are committed.",
    badgeText: "Collaborations",
  },

  // 2. Payments & Escrow
  {
    id: "pe-1",
    category: "PAYMENTS_ESCROW",
    question: "How does 100% Escrow Protection work?",
    answer:
      "When a brand hires a creator, the agreed commercial fee is deposited into a safe escrow holding account. The creator starts production knowing payment is 100% guaranteed, and the brand is protected knowing funds are released only when content meets guidelines and is approved.",
    badgeText: "Escrow Safety",
  },
  {
    id: "pe-2",
    category: "PAYMENTS_ESCROW",
    question: "What are the TDS (Tax Deducted at Source) deduction rates?",
    answer:
      `In compliance with Section 194-O and 194C of the Indian Income Tax Act, TDS is automatically calculated: ${TDS_194O_RATE_PERCENT_STRING} for PAN-verified creators earning above annual thresholds (or ${TDS_206AA_PENAL_RATE_PERCENT_STRING} if PAN is unverified). TDS certificates (Form 16A) are downloadable directly from your Wallet Statement tab quarterly.`,
    badgeText: "Tax & Compliance",
  },
  {
    id: "pe-3",
    category: "PAYMENTS_ESCROW",
    question: "How fast are creator wallet payouts processed?",
    answer:
      "Once escrow is released upon milestone approval, earnings reflect immediately in your VyaparMedia Wallet. Withdrawals to verified Indian bank accounts via IMPS / NEFT or UPI are initiated within 30 minutes with zero hidden transfer charges.",
    badgeText: "Instant Withdrawals",
  },
  {
    id: "pe-4",
    category: "PAYMENTS_ESCROW",
    question: "What platform fees does VyaparMedia charge?",
    answer:
      `VyaparMedia charges a transparent ${DEFAULT_BRAND_PLATFORM_FEE_PERCENT}% platform escrow protection fee to brands upon deal funding. Creators receive 100% of their quoted rate minus applicable statutory TDS. There are zero subscription or listing fees.`,
    badgeText: "Fee Transparency",
  },

  // 3. Disputes & Revisions
  {
    id: "dr-1",
    category: "DISPUTES_REVISIONS",
    question: "How many revisions can a brand request on submitted content?",
    answer:
      `The standard contract includes up to ${DEFAULT_INCLUDED_REVISIONS} revisions by default (unless customized in the deal terms). Brands must provide specific timestamped feedback within ${DEFAULT_BRAND_REVIEW_PERIOD_HOURS} hours of content submission. Creators have ${DEFAULT_BRAND_REVIEW_PERIOD_HOURS} hours to upload the revised draft.`,
    badgeText: "Revisions Policy",
  },
  {
    id: "dr-2",
    category: "DISPUTES_REVISIONS",
    question: "What happens if a creator fails to submit content before the deadline?",
    answer:
      "If the submission deadline lapses without delivery or mutual extension, the brand can trigger an automatic cancellation. Escrowed funds are returned 100% to the brand's wallet or original payment method without penalty.",
    badgeText: "Missed Deadlines",
  },
  {
    id: "dr-3",
    category: "DISPUTES_REVISIONS",
    question: "How does the Dispute & Arbitration process work?",
    answer:
      "If a brand and creator cannot agree on revisions or delivery standards, either party can open a formal Dispute from the Deal Room. Funds remain locked in escrow while a 48-hour mutual resolution window opens. If unresolved, a VyaparMedia senior arbitrator reviews creative briefs, raw drafts, and chat records to issue a binding settlement or split payout.",
    badgeText: "Arbitration",
  },

  // 4. KYC & Security
  {
    id: "kyc-1",
    category: "KYC_SECURITY",
    question: "Why is Aadhaar & PAN KYC mandatory for creators?",
    answer:
      "To prevent fraud, impersonation, and sybil attacks, VyaparMedia requires government identity verification (Aadhaar OTP + PAN verification) before wallet withdrawals can be unlocked. Identity data is encrypted and verified against government databases without storing raw biometric data.",
    badgeText: "Identity Verification",
  },
  {
    id: "kyc-2",
    category: "KYC_SECURITY",
    question: "What is the Creator DRS (Dynamic Reliability Score)?",
    answer:
      "The DRS is a 0–900 trust index calculated from on-time delivery rates, revision compliance, brand ratings, and dispute-free history. Creators with 800+ DRS earn the 'Elite Creator' badge and receive priority placement in brand discovery feeds.",
    badgeText: "DRS Trust Score",
  },
  {
    id: "kyc-3",
    category: "KYC_SECURITY",
    question: "How does VyaparMedia protect user contact information?",
    answer:
      "To safeguard users from off-platform advance fraud and fee-avoidance scams, in-app chat features automated contact-leak detection that flags phone numbers, personal UPI IDs, and WhatsApp links until a deal contract is officially escrow-funded.",
    badgeText: "Safety & Privacy",
  },
];

const CATEGORY_TABS: Array<{ id: FaqCategory; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "ALL", label: "All Topics", icon: HelpCircle },
  { id: "GETTING_STARTED", label: "Getting Started", icon: Sparkles },
  { id: "PAYMENTS_ESCROW", label: "Payments & Escrow", icon: Lock },
  { id: "DISPUTES_REVISIONS", label: "Disputes & Revisions", icon: AlertCircle },
  { id: "KYC_SECURITY", label: "KYC & Security", icon: ShieldCheck },
];

export function filterFaqs(
  faqs: FaqItem[],
  category: FaqCategory,
  searchQuery: string
): FaqItem[] {
  const q = searchQuery.toLowerCase().trim();
  return faqs.filter((faq) => {
    const matchesCategory = category === "ALL" || faq.category === category;
    const matchesQuery =
      !q ||
      faq.question.toLowerCase().includes(q) ||
      faq.answer.toLowerCase().includes(q) ||
      (faq.badgeText && faq.badgeText.toLowerCase().includes(q));
    return matchesCategory && matchesQuery;
  });
}

export default function HelpCenterClient() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<FaqCategory>("ALL");
  const [openItems, setOpenItems] = useState<Set<string>>(new Set(["pe-1", "gs-1"]));

  const toggleAccordion = (id: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filteredFaqs = useMemo(() => {
    return filterFaqs(FAQ_DATA, activeCategory, searchQuery);
  }, [activeCategory, searchQuery]);

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8 sm:py-12 space-y-10">
      {/* ==================== 1. HERO & SEARCH ==================== */}
      <section className="text-center space-y-4 max-w-2xl mx-auto">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/25 shrink-0 whitespace-nowrap">
          <LifeBuoy className="w-3.5 h-3.5" />
          <span>VyaparMedia Knowledge Base</span>
        </span>

        <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
          How can we help you today?
        </h1>

        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Everything you need to know about milestone escrow, transparent creator rate cards, dispute mediation, and verified payouts.
        </p>

        {/* Live Interactive Search Bar */}
        <div className="relative max-w-lg mx-auto pt-2">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by keyword (e.g., escrow, TDS, dispute, KYC)..."
              className="w-full pl-10 pr-10 py-3 rounded-2xl border border-border bg-card text-foreground placeholder:text-muted-foreground text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-xs transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search query"
                className="absolute right-3.5 p-1 rounded-full hover:bg-muted text-muted-foreground transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ==================== 2. CATEGORY FILTER TABS ==================== */}
      <nav aria-label="FAQ Categories" className="flex items-center justify-center">
        <div className="flex flex-wrap items-center justify-center gap-2 p-1.5 rounded-2xl bg-card border border-border shadow-xs">
          {CATEGORY_TABS.map((tab) => {
            const active = activeCategory === tab.id;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCategory(tab.id)}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  active
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ==================== 3. FAQ ACCORDION LIST ==================== */}
      <section aria-label="Frequently Asked Questions" className="space-y-3">
        {filteredFaqs.length === 0 ? (
          <div className="p-12 rounded-3xl border border-border bg-card text-center space-y-3">
            <HelpCircle className="w-8 h-8 text-muted-foreground mx-auto" />
            <h4 className="text-sm font-bold text-foreground">No matching questions found</h4>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              We couldn&apos;t find any articles matching &ldquo;{searchQuery}&rdquo;. Try another search term or raise a support ticket below.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setActiveCategory("ALL");
              }}
              className="text-xs font-bold"
            >
              Reset Filters
            </Button>
          </div>
        ) : (
          filteredFaqs.map((faq) => {
            const isOpen = openItems.has(faq.id);

            return (
              <div
                key={faq.id}
                className="rounded-2xl border border-border bg-card shadow-xs transition-all overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleAccordion(faq.id)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between gap-4 p-4 sm:p-5 text-left focus:outline-none hover:bg-muted/40 transition-colors"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    {faq.badgeText && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                        {faq.badgeText}
                      </span>
                    )}
                    <h3 className="text-sm sm:text-base font-bold text-foreground leading-snug">
                      {faq.question}
                    </h3>
                  </div>

                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-4 sm:px-5 pb-5 pt-1 border-t border-border/60 text-xs sm:text-sm text-muted-foreground leading-relaxed animate-in fade-in-50 duration-200">
                    <p>{faq.answer}</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>

      {/* ==================== 4. STILL NEED HELP? RAISE A TICKET ==================== */}
      <section aria-label="Support Escalation" className="p-6 sm:p-8 rounded-3xl border border-border bg-gradient-to-tr from-card via-card to-primary/5 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 text-center sm:text-left">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-foreground">
                Still have questions or need assistance?
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Our support team and escrow arbitration desk are active Monday through Saturday, 9 AM – 8 PM IST.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto">
            <Button
              href="/dashboard/support"
              variant="primary"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-xs font-bold shadow-md shadow-primary/25"
            >
              <span>Raise Support Ticket</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
