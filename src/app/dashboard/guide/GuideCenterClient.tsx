"use client";

import React, { useState, useMemo, useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Search,
  BookOpen,
  Languages,
  Printer,
  ChevronRight,
  ExternalLink,
  AlertTriangle,
  Share2,
  Check,
} from "lucide-react";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { ALL_GUIDES } from "@/content/guides";
import { GuideFeedback } from "@/components/guides/GuideFeedback";
import { GuidePrintModal } from "@/components/guides/GuidePrintModal";
import type { GuideUserType } from "@/lib/guides/schema";

const LANGUAGE_STORAGE_KEY = "vm_guide_language_pref";

const AREA_LABELS: Record<string, { en: string; hinglish: string }> = {
  all: { en: "All Guides", hinglish: "Sabhi Guides" },
  deals: { en: "Deals & Contracts", hinglish: "Deals aur Contracts" },
  wallet: { en: "Wallet & Taxes", hinglish: "Wallet aur Taxes" },
  campaigns: { en: "Campaigns", hinglish: "Campaigns" },
  disputes: { en: "Disputes & Mediation", hinglish: "Disputes aur Faisle" },
  kyc: { en: "KYC & Identity", hinglish: "KYC aur Documents" },
  analytics: { en: "Analytics & ROI", hinglish: "Analytics aur Reports" },
  security: { en: "Security & 2FA", hinglish: "Security aur 2FA" },
  messages: { en: "Messaging Rules", hinglish: "Chat aur Messages" },
  scout: { en: "Campus Scouts", hinglish: "Campus Scouts" },
  admin: { en: "Admin Ops", hinglish: "Admin Operations" },
  system: { en: "System Controls", hinglish: "System Controls" },
  compliance: { en: "Compliance", hinglish: "Compliance" },
  general: { en: "General", hinglish: "General" },
};

interface GuideCenterClientProps {
  readonly userRole: GuideUserType;
  readonly isAdminView?: boolean;
  readonly disabledFeatureFlags?: string[];
}

export function GuideCenterClient({
  userRole,
  isAdminView = false,
  disabledFeatureFlags = [],
}: Readonly<GuideCenterClientProps>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [activeLanguage, setActiveLanguageState] = useState<"en" | "hinglish">("en");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArea, setSelectedArea] = useState<string>("all");
  const [copiedLink, setCopiedLink] = useState(false);
  const [isPrintOpen, setIsPrintOpen] = useState(false);

  // Load language preference
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (stored === "en" || stored === "hinglish") {
        setActiveLanguageState(stored);
      }
    } catch {
      // ignore
    }
  }, []);

  const setLanguage = (lang: "en" | "hinglish") => {
    setActiveLanguageState(lang);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {
      // ignore
    }
  };

  // 1. Role Filtering & Feature Flag filtering
  const availableGuides = useMemo(() => {
    return ALL_GUIDES.filter((guide) => {
      // Role safety:
      if (!isAdminView && !guide.roles.includes(userRole)) {
        return false;
      }
      // Feature flag safety:
      if (!isAdminView && guide.featureKey && disabledFeatureFlags.includes(guide.featureKey)) {
        return false;
      }
      return true;
    });
  }, [userRole, isAdminView, disabledFeatureFlags]);

  // Read deep link ?g=<id>
  const guideParam = searchParams.get("g");

  // Selected guide state
  const selectedGuide = useMemo(() => {
    if (!guideParam) return availableGuides[0] ?? null;
    const match = availableGuides.find((g) => g.id === guideParam);
    return match ?? availableGuides[0] ?? null;
  }, [guideParam, availableGuides]);

  // Available area pills
  const availableAreas = useMemo(() => {
    const areas = new Set<string>();
    areas.add("all");
    availableGuides.forEach((g) => areas.add(g.area));
    return Array.from(areas);
  }, [availableGuides]);

  // Filtered guides by Area & Search
  const filteredGuides = useMemo(() => {
    let result = availableGuides;
    if (selectedArea !== "all") {
      result = result.filter((g) => g.area === selectedArea);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((g) => {
        const titleMatch =
          g.title.en.toLowerCase().includes(q) ||
          g.title.hinglish.toLowerCase().includes(q);
        const summaryMatch =
          g.summary.en.toLowerCase().includes(q) ||
          g.summary.hinglish.toLowerCase().includes(q);
        const stepMatch = g.steps.some(
          (s) =>
            s.title.en.toLowerCase().includes(q) ||
            s.title.hinglish.toLowerCase().includes(q) ||
            s.body.en.toLowerCase().includes(q) ||
            s.body.hinglish.toLowerCase().includes(q)
        );
        return titleMatch || summaryMatch || stepMatch;
      });
    }
    return result;
  }, [availableGuides, selectedArea, searchQuery]);

  const selectGuide = (guideId: string) => {
    startTransition(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("g", guideId);
      router.replace(url.pathname + url.search);
    });
  };

  const handleCopyLink = () => {
    if (!selectedGuide) return;
    const url = new URL(window.location.href);
    url.searchParams.set("g", selectedGuide.id);
    navigator.clipboard.writeText(url.toString());
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const isHinglish = activeLanguage === "hinglish";

  return (
    <PageContainer>
      {/* Header with Title and Language Toggle */}
      <PageHeader
        title={
          isAdminView
            ? isHinglish
              ? "Platform Admin Standard Operating Procedures"
              : "Platform Admin Operating Procedures"
            : isHinglish
            ? "VyaparMedia Jankari & Guide Kendra"
            : "Interactive Product Guide Center"
        }
        subtitle={
          isHinglish
            ? "Platform ke rules, statutory taxes, escrow limits aur step-by-step procedures samjhein."
            : "Step-by-step procedures, statutory tax rules, escrow thresholds, and verified answers."
        }
        actions={
          <div className="flex items-center gap-3">
            {/* Language Toggle Button */}
            <button
              type="button"
              onClick={() => setLanguage(isHinglish ? "en" : "hinglish")}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card hover:bg-muted font-semibold text-xs text-foreground transition-colors cursor-pointer shadow-xs"
              title="Toggle English / Hinglish"
            >
              <Languages className="w-4 h-4 text-primary" />
              <span>{isHinglish ? "हिन्दी / Hinglish" : "English"}</span>
            </button>

            {/* Public FAQ link */}
            <Link
              href="/help"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-muted/40 hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>Public FAQ</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        }
      />

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Search, Area Pills & Guide Directory */}
        <div className="lg:col-span-5 space-y-4">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isHinglish
                  ? "Guides, escrow, TDS, limits khojein..."
                  : "Search guides, escrow, taxes, limits..."
              }
              className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder:text-muted-foreground shadow-xs"
            />
          </div>

          {/* Area Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
            {availableAreas.map((areaKey) => {
              const active = selectedArea === areaKey;
              const label = AREA_LABELS[areaKey]?.[activeLanguage] || areaKey;
              return (
                <button
                  key={areaKey}
                  type="button"
                  onClick={() => setSelectedArea(areaKey)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                    active
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Guide Cards List */}
          <div className="space-y-2.5 max-h-[70vh] overflow-y-auto pr-1">
            {filteredGuides.length === 0 ? (
              <div className="text-center py-12 rounded-xl border border-dashed border-border p-6 text-xs text-muted-foreground">
                {isHinglish
                  ? "Koi matching guide nahi mila. Kripya doosre keywords try karein."
                  : "No matching guides found for this search filter."}
              </div>
            ) : (
              filteredGuides.map((guide) => {
                const isSelected = selectedGuide?.id === guide.id;
                const isFlagDisabled =
                  guide.featureKey && disabledFeatureFlags.includes(guide.featureKey);

                return (
                  <button
                    key={guide.id}
                    type="button"
                    onClick={() => selectGuide(guide.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between gap-3 group cursor-pointer ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-xs"
                        : "border-border/80 bg-card hover:border-primary/40 hover:bg-muted/30"
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-foreground group-hover:text-primary transition-colors">
                          {guide.title[activeLanguage] || guide.title.en}
                        </span>
                        {/* Admin "Not enabled" indicator */}
                        {isAdminView && isFlagDisabled && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                            Not enabled
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                        {guide.summary[activeLanguage] || guide.summary.en}
                      </p>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 shrink-0 transition-transform ${
                        isSelected
                          ? "text-primary translate-x-0.5"
                          : "text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5"
                      }`}
                    />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Active Guide Details & Walkthrough */}
        <div className="lg:col-span-7">
          {selectedGuide ? (
            <div className="p-6 sm:p-8 rounded-2xl border border-border bg-card shadow-xs space-y-8">
              {/* Top Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-border">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                    <BookOpen className="w-4 h-4" />
                    <span className="uppercase tracking-wider">
                      {AREA_LABELS[selectedGuide.area]?.[activeLanguage] || selectedGuide.area}
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground font-mono">v{selectedGuide.version}</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                    {selectedGuide.title[activeLanguage] || selectedGuide.title.en}
                  </h1>
                </div>

                <div className="flex items-center gap-2">
                  {/* Share Deep Link */}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleCopyLink}
                    className="gap-1.5 text-xs font-semibold"
                    title="Copy deep link to this guide"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? (isHinglish ? "Copied!" : "Copied!") : isHinglish ? "Link Copy Karein" : "Share"}</span>
                  </Button>

                  {/* Print CTA */}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsPrintOpen(true)}
                    className="gap-1.5 text-xs font-bold"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>{isHinglish ? "Print / Save PDF" : "Print Guide"}</span>
                  </Button>
                </div>
              </div>

              {/* Summary Block */}
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                <span className="text-[11px] uppercase tracking-wider font-bold text-primary block">
                  {isHinglish ? "Overview" : "Summary"}
                </span>
                <p className="text-sm text-foreground/90 leading-relaxed">
                  {selectedGuide.summary[activeLanguage] || selectedGuide.summary.en}
                </p>
              </div>

              {/* When to Use */}
              <div className="space-y-1.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {isHinglish ? "Kab Istemal Karein (When to Use)" : "When to Use This Guide"}
                </h3>
                <p className="text-sm text-foreground/80 leading-relaxed bg-muted/30 p-3.5 rounded-xl border border-border/60">
                  {selectedGuide.whenToUse[activeLanguage] || selectedGuide.whenToUse.en}
                </p>
              </div>

              {/* Step-by-Step Procedure */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {isHinglish ? "Step-by-Step Walkthrough" : "Step-by-Step Walkthrough"}
                </h3>
                <div className="space-y-3">
                  {selectedGuide.steps.map((step, idx) => (
                    <div
                      key={`step-${idx + 1}`}
                      id={`step-${idx + 1}`}
                      className="p-4 rounded-xl border border-border bg-card space-y-2"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <h4 className="font-bold text-sm text-foreground">
                          {step.title[activeLanguage] || step.title.en}
                        </h4>
                      </div>
                      <p className="text-xs text-muted-foreground pl-8 leading-relaxed">
                        {step.body[activeLanguage] || step.body.en}
                      </p>
                      {step.uiRef && (
                        <div className="pl-8 pt-1">
                          <span className="font-mono text-[11px] bg-muted px-2 py-0.5 rounded text-muted-foreground border border-border/60">
                            UI Element: {step.uiRef}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Rules & Policies */}
              {selectedGuide.rules.length > 0 && (
                <div className="p-5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{isHinglish ? "Zaroori Niyam (Platform Rules)" : "Key Platform Rules"}</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-1.5 text-xs text-foreground/90">
                    {selectedGuide.rules.map((rule, idx) => (
                      <li key={`rule-${idx}`} className="leading-relaxed">
                        {rule[activeLanguage] || rule.en}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Numbers & Thresholds Explained */}
              {selectedGuide.numbersExplained.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {isHinglish ? "Numbers aur Calculations" : "Platform Numbers & Thresholds"}
                  </h3>
                  <div className="border border-border rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted text-muted-foreground uppercase font-semibold">
                        <tr>
                          <th className="py-2.5 px-4">Metric / Parameter</th>
                          <th className="py-2.5 px-4">Formula & Explanation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {selectedGuide.numbersExplained.map((num, idx) => (
                          <tr key={`num-${idx}`} className="hover:bg-muted/30">
                            <td className="py-3 px-4 font-semibold text-foreground whitespace-nowrap align-top">
                              {num.label[activeLanguage] || num.label.en}
                            </td>
                            <td className="py-3 px-4 text-muted-foreground leading-relaxed">
                              {num.description[activeLanguage] || num.description.en}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Common Errors & Troubleshooting */}
              {selectedGuide.commonErrors.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {isHinglish ? "Troubleshooting aur Fixes" : "Troubleshooting & Common Errors"}
                  </h3>
                  <div className="space-y-3">
                    {selectedGuide.commonErrors.map((err, idx) => (
                      <div
                        key={`err-${idx}`}
                        className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 text-xs space-y-1.5"
                      >
                        <div className="font-bold text-destructive">
                          Issue: {err.symptom[activeLanguage] || err.symptom.en}
                        </div>
                        <div className="text-muted-foreground">
                          Cause: {err.cause[activeLanguage] || err.cause.en}
                        </div>
                        <div className="font-semibold text-foreground pt-1">
                          Fix: {err.fix[activeLanguage] || err.fix.en}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Frequently Asked Questions */}
              {selectedGuide.faqs.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {isHinglish ? "Aksar Pooche Jaane Wale Sawaal (FAQs)" : "Frequently Asked Questions"}
                  </h3>
                  <div className="space-y-3">
                    {selectedGuide.faqs.map((faq, idx) => (
                      <div
                        key={`faq-${idx}`}
                        className="p-4 rounded-xl border border-border bg-muted/20 text-xs space-y-1.5"
                      >
                        <div className="font-bold text-foreground">
                          Q: {faq.question[activeLanguage] || faq.question.en}
                        </div>
                        <div className="text-muted-foreground leading-relaxed">
                          A: {faq.answer[activeLanguage] || faq.answer.en}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Anonymous Helpful Feedback */}
              <GuideFeedback guideId={selectedGuide.id} />
            </div>
          ) : (
            <div className="text-center py-20 rounded-2xl border border-dashed border-border p-8 text-sm text-muted-foreground">
              {isHinglish
                ? "Dekhne ke liye left side se koi guide select karein."
                : "Select a guide from the list to view instructions."}
            </div>
          )}
        </div>
      </div>

      {/* Printable Modal */}
      <GuidePrintModal
        guide={selectedGuide}
        language={activeLanguage}
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
      />
    </PageContainer>
  );
}

export default GuideCenterClient;
