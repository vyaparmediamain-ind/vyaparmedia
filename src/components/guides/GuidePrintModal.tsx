"use client";

import React from "react";
import type { Guide } from "@/lib/guides/schema";
import { ReportShell } from "@/components/reports/ReportShell";
import { ReportLetterhead } from "@/components/reports/ReportLetterhead";
import { ReportFooter } from "@/components/reports/ReportFooter";
import type { GuideLanguage } from "./GuideDrawerContext";

export interface GuidePrintModalProps {
  readonly guide: Guide | null;
  readonly language?: GuideLanguage;
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export function GuidePrintModal({
  guide,
  language = "en",
  isOpen,
  onClose,
}: Readonly<GuidePrintModalProps>) {
  if (!isOpen || !guide) return null;

  const title = guide.title[language] || guide.title.en;
  const summary = guide.summary[language] || guide.summary.en;
  const whenToUse = guide.whenToUse[language] || guide.whenToUse.en;

  return (
    <ReportShell
      title={`Print Guide - ${title}`}
      onClose={onClose}
      className="max-w-4xl w-full mx-auto"
    >
      <div className="bg-card text-foreground p-6 sm:p-10 rounded-2xl border border-border shadow-md print:border-none print:shadow-none print:p-0">
        {/* Official Letterhead */}
        <ReportLetterhead
          title={title}
          subtitle={summary}
          categoryLabel="OFFICIAL STANDARD OPERATING PROCEDURE & USER MANUAL"
          referenceId={`SOP-${guide.id.toUpperCase()}-V${guide.version}`}
          generatedDate={new Date().toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        />

        {/* Guide Meta Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-muted/40 border border-border/60 mb-8 text-xs">
          <div>
            <span className="text-muted-foreground block">Guide ID:</span>
            <span className="font-mono font-bold text-foreground">{guide.id}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">Target Roles:</span>
            <span className="font-semibold text-foreground">{guide.roles.join(", ")}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">Version:</span>
            <span className="font-mono font-semibold text-foreground">v{guide.version}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">Last Reviewed:</span>
            <span className="font-semibold text-foreground">{guide.lastReviewedAt}</span>
          </div>
        </div>

        {/* When to Use */}
        <section className="mb-8">
          <h2 className="text-sm uppercase tracking-wider font-bold text-primary mb-2">
            {language === "hinglish" ? "Kab Use Karein (When to Use)" : "When to Use This Guide"}
          </h2>
          <p className="text-sm text-foreground/90 bg-primary/5 p-4 rounded-xl border border-primary/20">
            {whenToUse}
          </p>
        </section>

        {/* Step-by-Step Procedure */}
        <section className="mb-8">
          <h2 className="text-sm uppercase tracking-wider font-bold text-primary mb-4">
            {language === "hinglish" ? "Step-by-Step Procedure" : "Step-by-Step Walkthrough"}
          </h2>
          <div className="space-y-4">
            {guide.steps.map((step, idx) => (
              <div
                key={`step-${idx + 1}`}
                id={`step-${idx + 1}`}
                className="p-4 rounded-xl border border-border/80 bg-card"
              >
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <div className="space-y-1 flex-1">
                    <h3 className="font-bold text-sm text-foreground">
                      {step.title[language] || step.title.en}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {step.body[language] || step.body.en}
                    </p>
                    {step.uiRef && (
                      <span className="inline-block mt-1 font-mono text-[11px] bg-muted px-2 py-0.5 rounded text-muted-foreground">
                        UI Element: {step.uiRef}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Platform Rules */}
        {guide.rules.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm uppercase tracking-wider font-bold text-amber-600 dark:text-amber-400 mb-3">
              {language === "hinglish" ? "Zaroori Niyam (Rules & Policy)" : "Key Rules & Policies"}
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-sm text-foreground/90">
              {guide.rules.map((rule, idx) => (
                <li key={`rule-${idx}`} className="leading-relaxed">
                  {rule[language] || rule.en}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Numbers & Thresholds Explained */}
        {guide.numbersExplained.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm uppercase tracking-wider font-bold text-primary mb-3">
              {language === "hinglish" ? "Calculations aur Numbers Explained" : "Platform Numbers & Thresholds"}
            </h2>
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted text-muted-foreground uppercase font-semibold">
                  <tr>
                    <th className="py-2.5 px-4">Metric / Threshold</th>
                    <th className="py-2.5 px-4">Explanation & Canonical Formula</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {guide.numbersExplained.map((num, idx) => (
                    <tr key={`num-${idx}`} className="hover:bg-muted/40">
                      <td className="py-2.5 px-4 font-semibold text-foreground whitespace-nowrap align-top">
                        {num.label[language] || num.label.en}
                      </td>
                      <td className="py-2.5 px-4 text-muted-foreground leading-relaxed">
                        {num.description[language] || num.description.en}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Common Errors & Fixes */}
        {guide.commonErrors.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm uppercase tracking-wider font-bold text-destructive mb-3">
              {language === "hinglish" ? "Common Errors aur Solution" : "Troubleshooting & Common Errors"}
            </h2>
            <div className="space-y-3">
              {guide.commonErrors.map((err, idx) => (
                <div key={`err-${idx}`} className="p-3.5 rounded-xl border border-destructive/20 bg-destructive/5 text-xs">
                  <div className="font-bold text-destructive mb-1">
                    Issue: {err.symptom[language] || err.symptom.en}
                  </div>
                  <div className="text-muted-foreground mb-1">
                    Cause: {err.cause[language] || err.cause.en}
                  </div>
                  <div className="font-semibold text-foreground">
                    Fix: {err.fix[language] || err.fix.en}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* FAQs */}
        {guide.faqs.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm uppercase tracking-wider font-bold text-primary mb-3">
              {language === "hinglish" ? "Aksar Pooche Jaane Wale Sawaal (FAQs)" : "Frequently Asked Questions"}
            </h2>
            <div className="space-y-3">
              {guide.faqs.map((faq, idx) => (
                <div key={`faq-${idx}`} className="p-3.5 rounded-xl border border-border bg-muted/20 text-xs">
                  <div className="font-bold text-foreground mb-1">
                    Q: {faq.question[language] || faq.question.en}
                  </div>
                  <div className="text-muted-foreground leading-relaxed">
                    A: {faq.answer[language] || faq.answer.en}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Official Footer */}
        <ReportFooter
          disclaimer="This document contains official standard operating procedures of VyaparMedia. Rates and statutory tax thresholds reflect canonical system constants."
          integrityCode={`SOP-${guide.id.toUpperCase()}-V${guide.version}`}
          showQrCode={false}
        />
      </div>
    </ReportShell>
  );
}
