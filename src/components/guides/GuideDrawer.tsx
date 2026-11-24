"use client";

import React, { useState, useMemo, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Search,
  BookOpen,
  Languages,
  Printer,
  ChevronRight,
  ArrowLeft,
  ExternalLink,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { useGuideDrawer } from "./GuideDrawerContext";
import { ALL_GUIDES, getGuideById } from "@/content/guides";
import { getGuidesForRoute } from "@/lib/guides/route-matcher";
import { GuideFeedback } from "./GuideFeedback";
import { GuidePrintModal } from "./GuidePrintModal";
import type { Guide } from "@/lib/guides/schema";

export function GuideDrawer() {
  const pathname = usePathname();
  const {
    isOpen,
    closeGuideDrawer,
    activeLanguage,
    toggleLanguage,
    selectedGuideId,
    userRole,
  } = useGuideDrawer();

  const [searchQuery, setSearchQuery] = useState("");
  const [currentGuideId, setCurrentGuideId] = useState<string | null>(selectedGuideId);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Sync selectedGuideId from context
  useEffect(() => {
    if (selectedGuideId) {
      setCurrentGuideId(selectedGuideId);
    }
  }, [selectedGuideId]);

  // When drawer closes, reset search
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
    }
  }, [isOpen]);

  // Resolve active guide object
  const activeGuide: Guide | undefined = useMemo(() => {
    if (!currentGuideId) return undefined;
    return getGuideById(currentGuideId);
  }, [currentGuideId]);

  // Guides available to current user role
  const roleFilteredGuides = useMemo(() => {
    if (!userRole) return ALL_GUIDES;
    if (userRole === "ADMIN") return ALL_GUIDES;
    return ALL_GUIDES.filter((g) => g.roles.includes(userRole));
  }, [userRole]);

  // Guides matching current route
  const routeSuggestedGuides = useMemo(() => {
    if (!pathname) return [];
    return getGuidesForRoute(roleFilteredGuides, pathname, userRole ?? undefined);
  }, [roleFilteredGuides, pathname, userRole]);

  // Search filtered guides
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];

    return roleFilteredGuides.filter((g) => {
      const matchTitle =
        g.title.en.toLowerCase().includes(q) ||
        g.title.hinglish.toLowerCase().includes(q);
      const matchSummary =
        g.summary.en.toLowerCase().includes(q) ||
        g.summary.hinglish.toLowerCase().includes(q);
      const matchSteps = g.steps.some(
        (s) =>
          s.title.en.toLowerCase().includes(q) ||
          s.title.hinglish.toLowerCase().includes(q) ||
          s.body.en.toLowerCase().includes(q) ||
          s.body.hinglish.toLowerCase().includes(q)
      );
      return matchTitle || matchSummary || matchSteps;
    });
  }, [roleFilteredGuides, searchQuery]);

  const isHinglish = activeLanguage === "hinglish";
  const guideCenterHref = userRole === "ADMIN" ? "/admin/guide" : "/dashboard/guide";

  return (
    <>
      <Drawer
        open={isOpen}
        onClose={closeGuideDrawer}
        side="right"
        className="w-full sm:max-w-md md:max-w-lg p-0 flex flex-col h-full bg-card text-foreground"
        aria-label="Interactive Guide Drawer"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between gap-3 bg-muted/30">
          <div className="flex items-center gap-2.5 min-w-0">
            {activeGuide ? (
              <button
                type="button"
                onClick={() => setCurrentGuideId(null)}
                className="p-1.5 -ml-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Back to all guides"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : (
              <BookOpen className="w-5 h-5 text-primary shrink-0" />
            )}
            <h2 className="font-bold text-base tracking-tight truncate">
              {activeGuide
                ? activeGuide.title[activeLanguage] || activeGuide.title.en
                : isHinglish
                ? "VyaparMedia Guide"
                : "Help & Guide Center"}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Language Toggle Button */}
            <button
              type="button"
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-colors cursor-pointer"
              title="Toggle English / Hinglish"
            >
              <Languages className="w-3.5 h-3.5 text-primary" />
              <span>{isHinglish ? "हिन्दी / Hinglish" : "English"}</span>
            </button>

            {activeGuide && (
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(true)}
                className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Print Guide / Save PDF"
              >
                <Printer className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
          {activeGuide ? (
            /* Active Guide Detail View */
            <div className="space-y-6">
              {/* Summary */}
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                <span className="text-[11px] uppercase tracking-wider font-bold text-primary">
                  {isHinglish ? "Overview" : "Summary"}
                </span>
                <p className="text-sm text-foreground/90 leading-relaxed">
                  {activeGuide.summary[activeLanguage] || activeGuide.summary.en}
                </p>
              </div>

              {/* When to use */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {isHinglish ? "Kab Istemal Karein" : "When to Use"}
                </h4>
                <p className="text-xs text-foreground/80 leading-relaxed">
                  {activeGuide.whenToUse[activeLanguage] || activeGuide.whenToUse.en}
                </p>
              </div>

              {/* Steps */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {isHinglish ? "Step-by-Step Kaam Karein" : "Procedure Steps"}
                </h4>
                <div className="space-y-3">
                  {activeGuide.steps.map((step, idx) => (
                    <div
                      key={`step-${idx + 1}`}
                      id={`step-${idx + 1}`}
                      className="p-3.5 rounded-xl border border-border/80 bg-muted/20 space-y-1.5"
                    >
                      <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
                        <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span>{step.title[activeLanguage] || step.title.en}</span>
                      </div>
                      <p className="text-xs text-muted-foreground pl-7 leading-relaxed">
                        {step.body[activeLanguage] || step.body.en}
                      </p>
                      {step.uiRef && (
                        <div className="pl-7 pt-1">
                          <span className="font-mono text-[10px] bg-muted px-2 py-0.5 rounded text-muted-foreground border border-border/60">
                            UI: {step.uiRef}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Rules & Policies */}
              {activeGuide.rules.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{isHinglish ? "Zaroori Niyam (Rules)" : "Key Platform Rules"}</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-1 text-xs text-foreground/90">
                    {activeGuide.rules.map((rule, idx) => (
                      <li key={`rule-${idx}`} className="leading-relaxed">
                        {rule[activeLanguage] || rule.en}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Numbers Explained */}
              {activeGuide.numbersExplained.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {isHinglish ? "Numbers & Fees Explained" : "Numbers & Thresholds"}
                  </h4>
                  <div className="space-y-2">
                    {activeGuide.numbersExplained.map((num, idx) => (
                      <div
                        key={`num-${idx}`}
                        className="p-3 rounded-lg border border-border bg-card text-xs space-y-1"
                      >
                        <div className="font-semibold text-foreground">
                          {num.label[activeLanguage] || num.label.en}
                        </div>
                        <div className="text-muted-foreground leading-relaxed">
                          {num.description[activeLanguage] || num.description.en}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Common Errors & Fixes */}
              {activeGuide.commonErrors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {isHinglish ? "Troubleshooting" : "Troubleshooting & Fixes"}
                  </h4>
                  <div className="space-y-2">
                    {activeGuide.commonErrors.map((err, idx) => (
                      <div
                        key={`err-${idx}`}
                        className="p-3 rounded-lg border border-destructive/20 bg-destructive/5 text-xs space-y-1"
                      >
                        <div className="font-bold text-destructive">
                          {err.symptom[activeLanguage] || err.symptom.en}
                        </div>
                        <div className="text-muted-foreground">
                          {err.cause[activeLanguage] || err.cause.en}
                        </div>
                        <div className="font-semibold text-foreground pt-0.5">
                          Fix: {err.fix[activeLanguage] || err.fix.en}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* FAQs */}
              {activeGuide.faqs.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {isHinglish ? "Aksar Pooche Gaye Sawaal (FAQs)" : "Frequently Asked Questions"}
                  </h4>
                  <div className="space-y-2">
                    {activeGuide.faqs.map((faq, idx) => (
                      <div
                        key={`faq-${idx}`}
                        className="p-3 rounded-lg border border-border bg-card text-xs space-y-1"
                      >
                        <div className="font-bold text-foreground">
                          {faq.question[activeLanguage] || faq.question.en}
                        </div>
                        <div className="text-muted-foreground leading-relaxed">
                          {faq.answer[activeLanguage] || faq.answer.en}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Was this helpful? feedback */}
              <GuideFeedback guideId={activeGuide.id} />
            </div>
          ) : (
            /* Guide Catalog & Search View */
            <div className="space-y-6">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    isHinglish
                      ? "Search guides, escrow, fees, taxes..."
                      : "Search guides, escrow, fees, taxes..."
                  }
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder:text-muted-foreground"
                />
              </div>

              {/* Search Results */}
              {searchQuery.trim().length > 0 ? (
                <div className="space-y-3">
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    {isHinglish
                      ? `Matching Guides (${searchResults.length})`
                      : `Search Results (${searchResults.length})`}
                  </div>
                  {searchResults.length === 0 ? (
                    <div className="text-center py-8 text-xs text-muted-foreground">
                      {isHinglish
                        ? "Koi matching guide nahi mila. Kripya doosre keywords try karein."
                        : "No matching guides found. Try searching with different keywords."}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {searchResults.map((guide) => (
                        <button
                          key={guide.id}
                          type="button"
                          onClick={() => setCurrentGuideId(guide.id)}
                          className="w-full text-left p-3 rounded-xl border border-border hover:border-primary/50 bg-card hover:bg-muted/30 transition-all flex items-center justify-between gap-3 group cursor-pointer"
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <h4 className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors truncate">
                              {guide.title[activeLanguage] || guide.title.en}
                            </h4>
                            <p className="text-[11px] text-muted-foreground line-clamp-1">
                              {guide.summary[activeLanguage] || guide.summary.en}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Contextual Suggestions for Current Screen */
                <>
                  {routeSuggestedGuides.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-wider">
                        <HelpCircle className="w-4 h-4" />
                        <span>
                          {isHinglish
                            ? "Current Page ke Guides"
                            : "Recommended for This Screen"}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {routeSuggestedGuides.map((guide) => (
                          <button
                            key={guide.id}
                            type="button"
                            onClick={() => setCurrentGuideId(guide.id)}
                            className="w-full text-left p-3.5 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-all flex items-center justify-between gap-3 group cursor-pointer"
                          >
                            <div className="min-w-0 flex-1 space-y-1">
                              <h4 className="font-bold text-xs text-foreground group-hover:text-primary transition-colors">
                                {guide.title[activeLanguage] || guide.title.en}
                              </h4>
                              <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                                {guide.summary[activeLanguage] || guide.summary.en}
                              </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* All Role Guides */}
                  <div className="space-y-3 pt-2">
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      {isHinglish ? "Sabhi Topic Guides" : "Browse All Guides"}
                    </div>
                    <div className="space-y-2">
                      {roleFilteredGuides.map((guide) => (
                        <button
                          key={guide.id}
                          type="button"
                          onClick={() => setCurrentGuideId(guide.id)}
                          className="w-full text-left p-3 rounded-xl border border-border hover:border-primary/50 bg-card hover:bg-muted/30 transition-all flex items-center justify-between gap-3 group cursor-pointer"
                        >
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <h4 className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors truncate">
                              {guide.title[activeLanguage] || guide.title.en}
                            </h4>
                            <p className="text-[11px] text-muted-foreground line-clamp-1">
                              {guide.summary[activeLanguage] || guide.summary.en}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
          <Link
            href={guideCenterHref}
            onClick={closeGuideDrawer}
            className="flex items-center gap-1.5 font-semibold text-primary hover:underline"
          >
            <span>{isHinglish ? "Poora Guide Center Dekhein" : "Open Full Guide Center"}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>

          <Link
            href="/help"
            onClick={closeGuideDrawer}
            className="hover:underline text-muted-foreground hover:text-foreground"
          >
            {isHinglish ? "Public FAQ" : "Public FAQ"}
          </Link>
        </div>
      </Drawer>

      {/* Printable Letterhead Modal */}
      <GuidePrintModal
        guide={activeGuide ?? null}
        language={activeLanguage}
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
      />
    </>
  );
}
