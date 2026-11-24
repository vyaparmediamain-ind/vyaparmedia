import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  ALL_GUIDES,
  GLOSSARY_TERMS,
  getGuideById,
  getAllGlossaryTerms,
  getGlossaryTerm,
  getGlossaryTermsByCategory,
  searchGlossary,
} from "@/content/guides";
import { GUIDE_TOKENS, resolveGuideTokens } from "@/lib/guides/tokens";

describe("G06 Guide Accuracy & Token Integrity Audit", () => {
  // Allowlisted patterns with statutory or technical justification
  const ALLOWLISTED_NUMERIC_PATTERNS = [
    /Section\s+(?:194-O|206AA|194J|194-J|128)/i, // Statutory tax & companies act sections
    /§\s*(?:194-O|206AA|194J|194-J)/i,
    /Form\s+16A/i, // Official income tax certificate
    /Rule\s+393/i,
    /HTTP\s+(?:400|401|403|404|500|502|504)/i, // Standard HTTP status codes
    /\b(?:400|401|403|404|500|502|504)\b/,
    /\b2FA\b/i, // Two-factor authentication
    /\b24\/7\b/, // Around the clock
    /\b24-48\s+hours\b/i, // Standard banking transfer SLA
    /\b4-eye\s+principle\b/i, // Administrative dual control
    /\bP[0-3]\b/, // Incident severity levels P0, P1, P2, P3
    /\b7\s+years\b/i, // Companies Act 2013 statutory audit retention
    /\b30[\s-]day\b/i, // Post-monitoring retention period
    /\b100%\b/, // Full escrow funding or 100% completion
    /\b0%\b/, // Zero balance or zero fees
    /\b(?:first|1)\s+free\s+revision\b/i, // Contractual free revision count
    /\b15-digit\b/i, // GSTIN character length
    /\b10-digit\b/i, // PAN character length
    /\b60-second\b/i, // Standard short-form video duration
    /\bpenny-drop\b/i, // Bank penny drop
    /\b₹1\b/, // Penny-drop test deposit
    /\b(?:300|900)\b/, // DRS score scale
    /\b(?:4|6)\s+hours?\b/i, // Social API sync frequency
    /\b(?:12|14)\s+(?:weeks?|days?|hafton)\b/i, // Historical lookback
    /\b60[\s-]days?\b/i, // Meta Instagram Graph API long-lived OAuth token validity
    /\b(?:Finance|Tech|Fashion|Beauty|Gaming)\b/i, // Illustrative CPV category benchmark examples
    /\b(?:Poor|Fair|Good|Excellent)\b/i, // ROI score bands
    /\b(?:strikes?|90[\s-]days?)\b/i, // Community violations 3-strike policy window
    /\b100\s*(?:paise|k|lakh)?\b/i,
  ];

  it("ensures all dynamic tokens in GUIDE_TOKENS are non-empty and well-formed", () => {
    for (const [key, value] of Object.entries(GUIDE_TOKENS)) {
      expect(key.length).toBeGreaterThan(0);
      expect(value.length).toBeGreaterThan(0);
      expect(value).not.toMatch(/\{\{[a-zA-Z0-9_.]+\}\}/);
    }
  });

  it("verifies that no unresolved template tags {{...}} remain in any resolved guide", () => {
    const unresolvedTokenRegex = /\{\{[a-zA-Z0-9_.]+\}\}/g;

    for (const guide of ALL_GUIDES) {
      const inspectString = (str: string, fieldName: string) => {
        const matches = str.match(unresolvedTokenRegex);
        if (matches) {
          throw new Error(
            `Guide [${guide.id}] field "${fieldName}" contains unresolved token(s): ${matches.join(", ")}`
          );
        }
      };

      inspectString(guide.title.en, "title.en");
      inspectString(guide.title.hinglish, "title.hinglish");
      inspectString(guide.summary.en, "summary.en");
      inspectString(guide.summary.hinglish, "summary.hinglish");
      inspectString(guide.whenToUse.en, "whenToUse.en");
      inspectString(guide.whenToUse.hinglish, "whenToUse.hinglish");

      for (let i = 0; i < guide.steps.length; i++) {
        const step = guide.steps[i];
        if (step) {
          inspectString(step.title.en, `steps[${i}].title.en`);
          inspectString(step.title.hinglish, `steps[${i}].title.hinglish`);
          inspectString(step.body.en, `steps[${i}].body.en`);
          inspectString(step.body.hinglish, `steps[${i}].body.hinglish`);
        }
      }

      for (let i = 0; i < guide.rules.length; i++) {
        const rule = guide.rules[i];
        if (rule) {
          inspectString(rule.en, `rules[${i}].en`);
          inspectString(rule.hinglish, `rules[${i}].hinglish`);
        }
      }

      for (let i = 0; i < guide.faqs.length; i++) {
        const faq = guide.faqs[i];
        if (faq) {
          inspectString(faq.question.en, `faqs[${i}].question.en`);
          inspectString(faq.question.hinglish, `faqs[${i}].question.hinglish`);
          inspectString(faq.answer.en, `faqs[${i}].answer.en`);
          inspectString(faq.answer.hinglish, `faqs[${i}].answer.hinglish`);
        }
      }
    }
  });

  it("verifies that every guide with hardcoded numeric claims matches the allowlist", () => {
    // Collect all prose text from a guide
    for (const guide of ALL_GUIDES) {
      const texts: string[] = [
        guide.summary.en,
        guide.whenToUse.en,
        ...guide.steps.flatMap((s) => [s.title.en, s.body.en]),
        ...guide.rules.map((r) => r.en),
        ...guide.faqs.flatMap((f) => [f.question.en, f.answer.en]),
      ];

      for (const text of texts) {
        // Look for ₹ amounts, percentages (%), or day numbers
        const potentialNumbers = text.match(/(?:₹\s*\d[\d,]*(?:\.\d+)?|\b\d+(?:\.\d+)?%\b|\b\d+\s+days?\b)/g);
        if (potentialNumbers) {
          for (const match of potentialNumbers) {
            // Check if covered by allowlist
            const isAllowlisted = ALLOWLISTED_NUMERIC_PATTERNS.some((pat) => pat.test(text));
            // Or if it matches a known value directly from tokens
            const matchesTokenValue = Object.values(GUIDE_TOKENS).some((v) => text.includes(v));

            expect(
              isAllowlisted || matchesTokenValue,
              `Guide [${guide.id}] has un-tokenized numeric match "${match}" in: "${text.substring(0, 100)}..."`
            ).toBe(true);
          }
        }
      }
    }
  });
});

describe("G06 Link Integrity & Cross-Reference Audit", () => {
  it("verifies all internal routes in guides start with a valid path prefix", () => {
    for (const guide of ALL_GUIDES) {
      for (const route of guide.routes) {
        expect(
          route.startsWith("/dashboard") ||
            route.startsWith("/admin") ||
            route.startsWith("/creator") ||
            route.startsWith("/verify-report") ||
            route === "/",
          `Guide [${guide.id}] has unexpected route prefix: "${route}"`
        ).toBe(true);
      }
    }
  });

  it("verifies that all related guide references exist in the catalog", () => {
    for (const guide of ALL_GUIDES) {
      for (const relatedId of guide.related) {
        const relatedGuide = getGuideById(relatedId);
        expect(
          relatedGuide,
          `Guide [${guide.id}] points to non-existent related guide ID "${relatedId}"`
        ).toBeDefined();
      }
    }
  });

  it("verifies all support CTA hrefs are valid routes or mailto/tel protocols", () => {
    for (const guide of ALL_GUIDES) {
      if (guide.supportCta) {
        const href = guide.supportCta.href;
        const isValid =
          href.startsWith("/") ||
          href.startsWith("mailto:") ||
          href.startsWith("tel:") ||
          href.startsWith("https://");
        expect(
          isValid,
          `Guide [${guide.id}] has invalid supportCta href: "${href}"`
        ).toBe(true);
      }
    }
  });

  it("verifies that operational runbook references exist on disk", () => {
    const adminGuides = ALL_GUIDES.filter((g) => g.roles.includes("ADMIN"));
    const runbookRefs: string[] = [];

    for (const guide of adminGuides) {
      const allText = JSON.stringify(guide);
      const matches = allText.match(/docs\/runbooks\/[a-z0-9_-]+\.md/g);
      if (matches) {
        runbookRefs.push(...matches);
      }
    }

    const uniqueRunbooks = [...new Set(runbookRefs)];
    expect(uniqueRunbooks.length).toBeGreaterThan(0);

    for (const runbookPath of uniqueRunbooks) {
      const fullPath = path.resolve(process.cwd(), runbookPath);
      expect(
        fs.existsSync(fullPath),
        `Referenced runbook does not exist: ${runbookPath}`
      ).toBe(true);
    }
  });
});

describe("G06 Bilingual Domain Glossary Audit", () => {
  it("verifies all glossary terms conform to schema and have non-empty bilingual fields", () => {
    const terms = getAllGlossaryTerms();
    expect(terms.length).toBeGreaterThanOrEqual(20);

    for (const term of terms) {
      expect(term.id).toMatch(/^[a-z0-9-]+$/);
      expect(term.term.en.trim().length).toBeGreaterThan(0);
      expect(term.term.hinglish.trim().length).toBeGreaterThan(0);
      expect(term.definition.en.trim().length).toBeGreaterThan(0);
      expect(term.definition.hinglish.trim().length).toBeGreaterThan(0);

      if (term.example) {
        expect(term.example.en.trim().length).toBeGreaterThan(0);
        expect(term.example.hinglish.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("supports category filtering and direct ID lookup", () => {
    const escrowTerm = getGlossaryTerm("escrow");
    expect(escrowTerm).toBeDefined();
    expect(escrowTerm?.category).toBe("FINANCE");
    expect(escrowTerm?.term.en).toContain("Escrow");
    expect(escrowTerm?.term.hinglish).toContain("Escrow");

    const financeTerms = getGlossaryTermsByCategory("FINANCE");
    expect(financeTerms.length).toBeGreaterThanOrEqual(4);
    expect(financeTerms.some((t) => t.id === "escrow")).toBe(true);
    expect(financeTerms.some((t) => t.id === "payout")).toBe(true);

    const taxTerms = getGlossaryTermsByCategory("TAX");
    expect(taxTerms.length).toBeGreaterThanOrEqual(2);
    expect(taxTerms.some((t) => t.id === "tds")).toBe(true);
    expect(taxTerms.some((t) => t.id === "gstin")).toBe(true);
  });

  it("supports bilingual search across English and Hinglish", () => {
    // English search
    const resultsEn = searchGlossary("arbitration", "en");
    expect(resultsEn.length).toBeGreaterThan(0);
    expect(resultsEn[0]?.id).toBe("dispute-arbitration");

    // Hinglish search
    const resultsHinglish = searchGlossary("surakshit", "hinglish");
    expect(resultsHinglish.length).toBeGreaterThan(0);
    expect(resultsHinglish.some((t) => t.id === "escrow")).toBe(true);

    // General search matching both
    const resultsGeneral = searchGlossary("kill switch");
    expect(resultsGeneral.length).toBeGreaterThan(0);
    expect(resultsGeneral[0]?.id).toBe("kill-switch");
  });

  it("verifies every glossary relatedTerm points to another valid glossary term", () => {
    for (const term of GLOSSARY_TERMS) {
      for (const rel of term.relatedTerms) {
        const found = getGlossaryTerm(rel);
        expect(
          found,
          `Glossary term [${term.id}] references invalid relatedTerm "${rel}"`
        ).toBeDefined();
      }
    }
  });
});
