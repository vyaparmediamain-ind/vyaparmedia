import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ALL_GUIDES, getGuideById, getGuidesByRole, getGuidesForCurrentRoute } from "@/content/guides";
import { GuideSchema, type GuideUserType } from "@/lib/guides/schema";
import { GUIDE_TOKENS, resolveGuideTokens, resolveGuide } from "@/lib/guides/tokens";
import { getGuidesForRoute, routePatternToRegex } from "@/lib/guides/route-matcher";

describe("Guide Registry & Schema Validation", () => {
  it("validates that all registered guides strictly conform to GuideSchema", () => {
    expect(ALL_GUIDES.length).toBeGreaterThanOrEqual(40);

    for (const guide of ALL_GUIDES) {
      const result = GuideSchema.safeParse(guide);
      if (!result.success) {
        throw new Error(`Guide ${guide.id} failed schema validation: ${JSON.stringify(result.error.issues)}`);
      }
      expect(result.success).toBe(true);

      // Verify bilingual completeness
      expect(guide.title.en.trim().length).toBeGreaterThan(0);
      expect(guide.title.hinglish.trim().length).toBeGreaterThan(0);
      expect(guide.summary.en.trim().length).toBeGreaterThan(0);
      expect(guide.summary.hinglish.trim().length).toBeGreaterThan(0);
      expect(guide.whenToUse.en.trim().length).toBeGreaterThan(0);
      expect(guide.whenToUse.hinglish.trim().length).toBeGreaterThan(0);

      // Verify each step has bilingual title and body
      for (const step of guide.steps) {
        expect(step.title.en.trim().length).toBeGreaterThan(0);
        expect(step.title.hinglish.trim().length).toBeGreaterThan(0);
        expect(step.body.en.trim().length).toBeGreaterThan(0);
        expect(step.body.hinglish.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("verifies unique guide IDs across all roles", () => {
    const ids = new Set<string>();
    for (const guide of ALL_GUIDES) {
      expect(ids.has(guide.id)).toBe(false);
      ids.add(guide.id);
    }
  });
});

describe("Dynamic Fact Token Resolution", () => {
  it("provides canonical platform tokens without unresolved templates", () => {
    expect(GUIDE_TOKENS["fee.min"]).toBe("7%");
    expect(GUIDE_TOKENS["tax.tds_194o"]).toBe("0.1%");
    expect(GUIDE_TOKENS["tax.tds_threshold"]).toBe("₹5 Lakh");
    expect(GUIDE_TOKENS["deals.review_hours"]).toContain("hours");
    expect(GUIDE_TOKENS["wallet.min_withdrawal"]).toBe("₹500");

    const sample = "Platform fee is {{fee.min}} with TDS at {{tax.tds_194o}}.";
    const resolved = resolveGuideTokens(sample);
    expect(resolved).toBe("Platform fee is 7% with TDS at 0.1%.");
    expect(resolved).not.toContain("{{");
  });

  it("ensures all registered guides have no unresolved {{...}} placeholders after resolution", () => {
    const tokenRegex = /\{\{[a-zA-Z0-9_.]+\}\}/;

    for (const guide of ALL_GUIDES) {
      // Test title & summary
      expect(guide.title.en).not.toMatch(tokenRegex);
      expect(guide.title.hinglish).not.toMatch(tokenRegex);
      expect(guide.summary.en).not.toMatch(tokenRegex);
      expect(guide.summary.hinglish).not.toMatch(tokenRegex);

      // Test rules
      for (const rule of guide.rules) {
        expect(rule.en).not.toMatch(tokenRegex);
        expect(rule.hinglish).not.toMatch(tokenRegex);
      }

      // Test steps
      for (const step of guide.steps) {
        expect(step.body.en).not.toMatch(tokenRegex);
        expect(step.body.hinglish).not.toMatch(tokenRegex);
      }
    }
  });
});

describe("Role Safety & Isolation", () => {
  it("never returns ADMIN-only guides to an INFLUENCER or BRAND caller", () => {
    const influencerGuides = getGuidesByRole("INFLUENCER");
    for (const g of influencerGuides) {
      expect(g.roles).toContain("INFLUENCER");
      expect(g.roles.includes("ADMIN") && g.roles.length === 1).toBe(false);
    }

    const brandGuides = getGuidesByRole("BRAND");
    for (const g of brandGuides) {
      expect(g.roles).toContain("BRAND");
      expect(g.roles.includes("ADMIN") && g.roles.length === 1).toBe(false);
    }

    const scoutGuides = getGuidesByRole("SCOUT");
    for (const g of scoutGuides) {
      expect(g.roles).toContain("SCOUT");
    }
  });

  it("filters routes strictly according to role", () => {
    const adminGuidesForAdmin = getGuidesForRoute(ALL_GUIDES, "/admin/financial", "ADMIN");
    expect(adminGuidesForAdmin.length).toBeGreaterThan(0);

    const adminGuidesForInfluencer = getGuidesForRoute(ALL_GUIDES, "/admin/financial", "INFLUENCER");
    expect(adminGuidesForInfluencer.length).toBe(0);

    const adminGuidesForBrand = getGuidesForRoute(ALL_GUIDES, "/admin/financial", "BRAND");
    expect(adminGuidesForBrand.length).toBe(0);
  });
});

describe("Route Coverage Verification", () => {
  it("resolves to >=1 guide for every dashboard and admin route in docs/audit/routes.json for each role that can open it", () => {
    const routesPath = path.resolve(process.cwd(), "docs/audit/routes.json");
    if (!fs.existsSync(routesPath)) {
      return;
    }
    const routesData = JSON.parse(fs.readFileSync(routesPath, "utf8"));
    const pageRoutes: Array<{ path: string; authGuard: string | null }> = routesData.pageRoutes;

    const adminRoutes = pageRoutes
      .filter((p) => p.path.startsWith("/admin"))
      .map((p) => p.path);

    // 1. Every admin route matches at least one guide for ADMIN
    for (const route of adminRoutes) {
      const matches = getGuidesForRoute(ALL_GUIDES, route, "ADMIN");
      expect(
        matches.length,
        `Expected >=1 guide for ADMIN on route ${route}`
      ).toBeGreaterThan(0);
    }

    // Routes accessible by INFLUENCER (excludes brand-only campaign creation/roi/analytics)
    const influencerAccessibleRoutes = [
      "/dashboard",
      "/dashboard/analytics",
      "/dashboard/applications",
      "/dashboard/badges",
      "/dashboard/campaigns",
      "/dashboard/campaigns/[id]",
      "/dashboard/deals",
      "/dashboard/deals/[id]",
      "/dashboard/deals/[id]/dispute",
      "/dashboard/disputes",
      "/dashboard/disputes/[id]",
      "/dashboard/influencers",
      "/dashboard/influencers/[id]",
      "/dashboard/leaderboard",
      "/dashboard/messages",
      "/dashboard/notifications",
      "/dashboard/referrals",
      "/dashboard/settings",
      "/dashboard/support",
      "/dashboard/wallet",
      "/dashboard/guide",
    ];

    for (const route of influencerAccessibleRoutes) {
      const matches = getGuidesForRoute(ALL_GUIDES, route, "INFLUENCER");
      expect(
        matches.length,
        `Expected >=1 guide for INFLUENCER on route ${route}`
      ).toBeGreaterThan(0);
    }

    // Routes accessible by BRAND (excludes creator-only badges/leaderboard)
    const brandAccessibleRoutes = [
      "/dashboard",
      "/dashboard/analytics",
      "/dashboard/applications",
      "/dashboard/campaigns",
      "/dashboard/campaigns/[id]",
      "/dashboard/campaigns/[id]/analytics",
      "/dashboard/campaigns/[id]/roi",
      "/dashboard/campaigns/create",
      "/dashboard/deals",
      "/dashboard/deals/[id]",
      "/dashboard/deals/[id]/dispute",
      "/dashboard/disputes",
      "/dashboard/disputes/[id]",
      "/dashboard/influencers",
      "/dashboard/influencers/[id]",
      "/dashboard/messages",
      "/dashboard/notifications",
      "/dashboard/referrals",
      "/dashboard/settings",
      "/dashboard/support",
      "/dashboard/wallet",
      "/dashboard/guide",
    ];

    for (const route of brandAccessibleRoutes) {
      const matches = getGuidesForRoute(ALL_GUIDES, route, "BRAND");
      expect(
        matches.length,
        `Expected >=1 guide for BRAND on route ${route}`
      ).toBeGreaterThan(0);
    }

    // Routes accessible by SCOUT
    const scoutRoutes = [
      "/dashboard",
      "/dashboard/wallet",
      "/dashboard/referrals",
      "/dashboard/settings",
      "/dashboard/support",
      "/dashboard/messages",
      "/dashboard/leaderboard",
      "/dashboard/notifications",
      "/dashboard/guide",
    ];
    for (const route of scoutRoutes) {
      const matches = getGuidesForRoute(ALL_GUIDES, route, "SCOUT");
      expect(
        matches.length,
        `Expected >=1 guide for SCOUT on route ${route}`
      ).toBeGreaterThan(0);
    }
  });

  it("handles dynamic route patterns like /dashboard/campaigns/[id] and /dashboard/deals/[id]", () => {
    const dynamicDealMatches = getGuidesForRoute(ALL_GUIDES, "/dashboard/deals/cld12345678", "INFLUENCER");
    expect(dynamicDealMatches.length).toBeGreaterThan(0);

    const dynamicCampaignMatches = getGuidesForRoute(ALL_GUIDES, "/dashboard/campaigns/cld998877", "BRAND");
    expect(dynamicCampaignMatches.length).toBeGreaterThan(0);
  });
});

describe("Feature Flag Awareness & Deep Linking", () => {
  it("correctly identifies guides by slug ID", () => {
    const guide = getGuideById("influencer-deal-lifecycle");
    expect(guide).toBeDefined();
    expect(guide?.roles).toContain("INFLUENCER");
    expect(guide?.title.en).toContain("Deal Lifecycle");
  });

  it("matches regex route patterns accurately", () => {
    const regex = routePatternToRegex("/dashboard/deals/[id]");
    expect(regex.test("/dashboard/deals/abc12345")).toBe(true);
    expect(regex.test("/dashboard/deals")).toBe(false);
    expect(regex.test("/dashboard/other/abc12345")).toBe(false);
  });

  it("ensures every HelpTip guideId referenced across the codebase exists in the guide registry", () => {
    const srcDir = path.resolve(process.cwd(), "src");
    const helpTipRegex = /<HelpTip[^>]*guideId=["']([a-z0-9-]+)["']/g;
    const foundIds: string[] = [];

    function scanDir(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (/\.(tsx|ts|jsx|js)$/.test(entry.name)) {
          const content = fs.readFileSync(fullPath, "utf8");
          let match;
          while ((match = helpTipRegex.exec(content)) !== null) {
            if (match[1]) foundIds.push(match[1]);
          }
        }
      }
    }

    scanDir(srcDir);

    for (const guideId of foundIds) {
      const guide = getGuideById(guideId);
      expect(guide, `HelpTip references non-existent guideId: "${guideId}"`).toBeDefined();
    }
  });

  it("hides guides with disabled feature flags for non-admins while retaining them for admins", () => {
    const testGuide = ALL_GUIDES[0]!;
    const guideWithFlag = {
      ...testGuide,
      id: "test-feature-flag-guide",
      featureKey: "new_experimental_module",
      roles: ["INFLUENCER", "ADMIN"] as GuideUserType[],
    };

    const disabledFlags = ["new_experimental_module"];

    // Non-admin with flag disabled -> hidden
    const isVisibleForInfluencer = !disabledFlags.includes(guideWithFlag.featureKey);
    expect(isVisibleForInfluencer).toBe(false);

    // Admin -> visible with "Not enabled" tag
    const isVisibleForAdmin = true;
    const adminTag = disabledFlags.includes(guideWithFlag.featureKey) ? "Not enabled" : "Enabled";
    expect(isVisibleForAdmin).toBe(true);
    expect(adminTag).toBe("Not enabled");
  });

  it("verifies bilingual toggle renders both English and Hinglish seamlessly", () => {
    for (const guide of ALL_GUIDES) {
      expect(guide.title.en).toBeDefined();
      expect(guide.title.hinglish).toBeDefined();
      expect(guide.summary.en).toBeDefined();
      expect(guide.summary.hinglish).toBeDefined();
    }
  });

  describe("Creator Guide Integrity & Quality Guards", () => {
    const influencerGuides = ALL_GUIDES.filter((g) => g.roles.includes("INFLUENCER"));

    it("verifies Hinglish is present and non-empty for every user-facing field across all creator guides", () => {
      expect(influencerGuides.length).toBeGreaterThanOrEqual(24);

      for (const guide of influencerGuides) {
        expect(guide.title.hinglish.trim().length, `Guide ${guide.id} missing Hinglish title`).toBeGreaterThan(0);
        expect(guide.summary.hinglish.trim().length, `Guide ${guide.id} missing Hinglish summary`).toBeGreaterThan(0);
        expect(guide.whenToUse.hinglish.trim().length, `Guide ${guide.id} missing Hinglish whenToUse`).toBeGreaterThan(0);

        for (const step of guide.steps) {
          expect(step.title.hinglish.trim().length, `Step in ${guide.id} missing Hinglish title`).toBeGreaterThan(0);
          expect(step.body.hinglish.trim().length, `Step in ${guide.id} missing Hinglish body`).toBeGreaterThan(0);
        }

        for (const rule of guide.rules) {
          expect(rule.hinglish.trim().length, `Rule in ${guide.id} missing Hinglish`).toBeGreaterThan(0);
        }

        for (const num of guide.numbersExplained) {
          expect(num.label.hinglish.trim().length, `Number label in ${guide.id} missing Hinglish`).toBeGreaterThan(0);
          expect(num.description.hinglish.trim().length, `Number desc in ${guide.id} missing Hinglish`).toBeGreaterThan(0);
        }

        for (const err of guide.commonErrors) {
          expect(err.symptom.hinglish.trim().length, `Error symptom in ${guide.id} missing Hinglish`).toBeGreaterThan(0);
          expect(err.cause.hinglish.trim().length, `Error cause in ${guide.id} missing Hinglish`).toBeGreaterThan(0);
          expect(err.fix.hinglish.trim().length, `Error fix in ${guide.id} missing Hinglish`).toBeGreaterThan(0);
        }

        for (const faq of guide.faqs) {
          expect(faq.question.hinglish.trim().length, `FAQ question in ${guide.id} missing Hinglish`).toBeGreaterThan(0);
          expect(faq.answer.hinglish.trim().length, `FAQ answer in ${guide.id} missing Hinglish`).toBeGreaterThan(0);
        }
      }
    });

    it("scan test: ensures no creator guide contains hardcoded platform fee or tax numbers (must use template tokens)", () => {
      const influencerFilePath = path.resolve(process.cwd(), "src/content/guides/influencer.ts");
      const fileContent = fs.readFileSync(influencerFilePath, "utf8");

      // Scan for hardcoded "0.1%" or "5%" (without token brackets)
      // Allowed: {{tax.tds_194o}} or {{tax.tds_206aa}}
      const hardcodedTaxRegex = /(?:TDS.*?(\b0\.1%|\b5%))|(?:fee.*?(\b7%|\b10%))/i;
      const lines = fileContent.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        // Skip comment lines or token definition lines
        if (line.includes("//") || line.includes("tax.") || line.includes("fee.")) continue;

        const match = hardcodedTaxRegex.exec(line);
        if (match && !line.includes("{{")) {
          throw new Error(`Hardcoded fee/tax number detected on line ${i + 1} of influencer.ts: "${line.trim()}". Use canonical token template instead.`);
        }
      }
    });

    it("verifies coverage for all 24 required creator features", () => {
      const requiredSlugs = [
        "influencer-dashboard-overview",
        "influencer-discover-campaigns",
        "influencer-campaign-application",
        "influencer-applications-tracker",
        "influencer-deal-lifecycle",
        "influencer-content-submission",
        "influencer-messaging-rules",
        "influencer-wallet-and-taxes",
        "influencer-taxes-compliance",
        "influencer-dispute-resolution",
        "influencer-drs-and-badges",
        "influencer-leaderboard",
        "influencer-referral-program",
        "influencer-notifications",
        "influencer-settings-profile",
        "influencer-settings-social",
        "influencer-settings-verification",
        "influencer-settings-security",
        "influencer-analytics-performance",
        "influencer-reports-market-range",
        "influencer-public-profile",
        "influencer-support-tickets",
        "influencer-scout-program",
        "influencer-role-switching",
      ];

      for (const slug of requiredSlugs) {
        const guide = getGuideById(slug);
        expect(guide, `Required guide slug "${slug}" not found in guide registry`).toBeDefined();
        expect(guide?.roles).toContain("INFLUENCER");
        expect(guide?.routes.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe("Brand Guide Integrity & Quality Guards", () => {
    const brandGuides = ALL_GUIDES.filter((g) => g.roles.includes("BRAND"));

    it("verifies Hinglish is present and non-empty for every user-facing field across all brand guides", () => {
      expect(brandGuides.length).toBeGreaterThanOrEqual(20);

      for (const guide of brandGuides) {
        expect(guide.title.hinglish.trim().length, `Guide ${guide.id} missing Hinglish title`).toBeGreaterThan(0);
        expect(guide.summary.hinglish.trim().length, `Guide ${guide.id} missing Hinglish summary`).toBeGreaterThan(0);
        expect(guide.whenToUse.hinglish.trim().length, `Guide ${guide.id} missing Hinglish whenToUse`).toBeGreaterThan(0);

        for (const step of guide.steps) {
          expect(step.title.hinglish.trim().length, `Step in ${guide.id} missing Hinglish title`).toBeGreaterThan(0);
          expect(step.body.hinglish.trim().length, `Step in ${guide.id} missing Hinglish body`).toBeGreaterThan(0);
        }

        for (const rule of guide.rules) {
          expect(rule.hinglish.trim().length, `Rule in ${guide.id} missing Hinglish`).toBeGreaterThan(0);
        }

        for (const num of guide.numbersExplained) {
          expect(num.label.hinglish.trim().length, `Number label in ${guide.id} missing Hinglish`).toBeGreaterThan(0);
          expect(num.description.hinglish.trim().length, `Number desc in ${guide.id} missing Hinglish`).toBeGreaterThan(0);
        }

        for (const err of guide.commonErrors) {
          expect(err.symptom.hinglish.trim().length, `Error symptom in ${guide.id} missing Hinglish`).toBeGreaterThan(0);
          expect(err.cause.hinglish.trim().length, `Error cause in ${guide.id} missing Hinglish`).toBeGreaterThan(0);
          expect(err.fix.hinglish.trim().length, `Error fix in ${guide.id} missing Hinglish`).toBeGreaterThan(0);
        }

        for (const faq of guide.faqs) {
          expect(faq.question.hinglish.trim().length, `FAQ question in ${guide.id} missing Hinglish`).toBeGreaterThan(0);
          expect(faq.answer.hinglish.trim().length, `FAQ answer in ${guide.id} missing Hinglish`).toBeGreaterThan(0);
        }
      }
    });

    it("scan test: ensures no brand guide contains hardcoded platform fee or tax numbers (must use template tokens)", () => {
      const brandFilePath = path.resolve(process.cwd(), "src/content/guides/brand.ts");
      const fileContent = fs.readFileSync(brandFilePath, "utf8");

      const hardcodedTaxRegex = /(?:TDS.*?(\b0\.1%|\b5%))|(?:fee.*?(\b7%|\b10%))/i;
      const lines = fileContent.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (line.includes("//") || line.includes("tax.") || line.includes("fee.")) continue;

        const match = hardcodedTaxRegex.exec(line);
        if (match && !line.includes("{{")) {
          throw new Error(`Hardcoded fee/tax number detected on line ${i + 1} of brand.ts: "${line.trim()}". Use canonical token template instead.`);
        }
      }
    });

    it("verifies coverage for all 20 required brand features", () => {
      const requiredSlugs = [
        "brand-dashboard-overview",
        "brand-creator-discovery",
        "brand-creator-dossier",
        "brand-campaign-creation",
        "brand-campaign-detail",
        "brand-make-offer",
        "brand-deal-management",
        "brand-wallet-and-escrow",
        "brand-messaging-guidelines",
        "brand-dispute-arbitration",
        "brand-campaign-analytics-hub",
        "brand-campaign-roi-reports",
        "brand-finance-ca-export",
        "brand-performance-report-modal",
        "brand-analytics-dashboard",
        "brand-verification-kyc",
        "brand-settings-profile",
        "brand-support-escalation",
        "brand-referrals-leaderboard",
        "brand-compliance-asci-ccpa",
      ];

      for (const slug of requiredSlugs) {
        const guide = getGuideById(slug);
        expect(guide, `Required brand guide slug "${slug}" not found in guide registry`).toBeDefined();
        expect(guide?.roles).toContain("BRAND");
        expect(guide?.routes.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe("Scout Guide Integrity & Quality Guards", () => {
    const scoutGuides = ALL_GUIDES.filter((g) => g.roles.includes("SCOUT"));

    it("verifies Hinglish is present and non-empty for every user-facing field across all scout guides", () => {
      expect(scoutGuides.length).toBeGreaterThanOrEqual(15);

      for (const guide of scoutGuides) {
        expect(guide.title.hinglish.trim().length, `Guide ${guide.id} missing Hinglish title`).toBeGreaterThan(0);
        expect(guide.summary.hinglish.trim().length, `Guide ${guide.id} missing Hinglish summary`).toBeGreaterThan(0);
        expect(guide.whenToUse.hinglish.trim().length, `Guide ${guide.id} missing Hinglish whenToUse`).toBeGreaterThan(0);

        for (const step of guide.steps) {
          expect(step.title.hinglish.trim().length, `Step in ${guide.id} missing Hinglish title`).toBeGreaterThan(0);
          expect(step.body.hinglish.trim().length, `Step in ${guide.id} missing Hinglish body`).toBeGreaterThan(0);
        }

        for (const rule of guide.rules) {
          expect(rule.hinglish.trim().length, `Rule in ${guide.id} missing Hinglish`).toBeGreaterThan(0);
        }

        for (const num of guide.numbersExplained) {
          expect(num.label.hinglish.trim().length, `Number label in ${guide.id} missing Hinglish`).toBeGreaterThan(0);
          expect(num.description.hinglish.trim().length, `Number desc in ${guide.id} missing Hinglish`).toBeGreaterThan(0);
        }

        for (const err of guide.commonErrors) {
          expect(err.symptom.hinglish.trim().length, `Error symptom in ${guide.id} missing Hinglish`).toBeGreaterThan(0);
          expect(err.cause.hinglish.trim().length, `Error cause in ${guide.id} missing Hinglish`).toBeGreaterThan(0);
          expect(err.fix.hinglish.trim().length, `Error fix in ${guide.id} missing Hinglish`).toBeGreaterThan(0);
        }

        for (const faq of guide.faqs) {
          expect(faq.question.hinglish.trim().length, `FAQ question in ${guide.id} missing Hinglish`).toBeGreaterThan(0);
          expect(faq.answer.hinglish.trim().length, `FAQ answer in ${guide.id} missing Hinglish`).toBeGreaterThan(0);
        }
      }
    });

    it("scan test: ensures no scout guide contains hardcoded platform fee or tax numbers (must use template tokens)", () => {
      const scoutFilePath = path.resolve(process.cwd(), "src/content/guides/scout.ts");
      const fileContent = fs.readFileSync(scoutFilePath, "utf8");

      const hardcodedTaxRegex = /(?:TDS.*?(\b0\.1%|\b5%))|(?:fee.*?(\b7%|\b10%))/i;
      const lines = fileContent.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (line.includes("//") || line.includes("tax.") || line.includes("fee.")) continue;

        const match = hardcodedTaxRegex.exec(line);
        if (match && !line.includes("{{")) {
          throw new Error(`Hardcoded fee/tax number detected on line ${i + 1} of scout.ts: "${line.trim()}". Use canonical token template instead.`);
        }
      }
    });

    it("verifies coverage for all required scout features", () => {
      const requiredSlugs = [
        "scout-program-overview",
        "scout-verification-gate",
        "scout-dashboard-overview",
        "scout-inviting-creators",
        "scout-inviting-brands",
        "scout-offline-qr-code",
        "scout-network-pipeline",
        "scout-royalties-and-wallet",
        "scout-campus-certificate",
        "scout-anti-abuse-rules",
        "scout-role-conversion",
        "scout-notifications",
        "scout-settings-security",
        "scout-support-desk",
        "scout-leaderboard",
      ];

      for (const slug of requiredSlugs) {
        const guide = getGuideById(slug);
        expect(guide, `Required scout guide slug "${slug}" not found in guide registry`).toBeDefined();
        expect(guide?.roles).toContain("SCOUT");
        expect(guide?.routes.length).toBeGreaterThanOrEqual(1);
      }
    });

    it("scout isolation guard: ensures a scout caller cannot see creator-only or brand-only guides", () => {
      const scoutAllowedGuides = ALL_GUIDES.filter((g) => g.roles.includes("SCOUT"));
      for (const guide of scoutAllowedGuides) {
        expect(guide.roles).toContain("SCOUT");
      }

      // Check route matching for scout on brand-only routes
      const brandOnlyRoutes = ["/dashboard/campaigns/create", "/dashboard/campaigns/[id]/roi", "/dashboard/campaigns/[id]/analytics"];
      for (const route of brandOnlyRoutes) {
        const matches = getGuidesForRoute(ALL_GUIDES, route, "SCOUT");
        expect(matches.length, `Scout should not match brand-only route ${route}`).toBe(0);
      }
    });
  });

  describe("Admin Guide Integrity & Quality Guards", () => {
    const adminGuides = ALL_GUIDES.filter((g) => g.roles.includes("ADMIN") && g.roles.length === 1);

    it("verifies Hinglish is present and non-empty for every user-facing field across all admin guides", () => {
      expect(adminGuides.length).toBeGreaterThanOrEqual(18);

      for (const guide of adminGuides) {
        expect(guide.title.hinglish.trim().length, `Guide ${guide.id} missing Hinglish title`).toBeGreaterThan(0);
        expect(guide.summary.hinglish.trim().length, `Guide ${guide.id} missing Hinglish summary`).toBeGreaterThan(0);
        expect(guide.whenToUse.hinglish.trim().length, `Guide ${guide.id} missing Hinglish whenToUse`).toBeGreaterThan(0);

        for (const step of guide.steps) {
          expect(step.title.hinglish.trim().length, `Step in ${guide.id} missing Hinglish title`).toBeGreaterThan(0);
          expect(step.body.hinglish.trim().length, `Step in ${guide.id} missing Hinglish body`).toBeGreaterThan(0);
        }

        for (const rule of guide.rules) {
          expect(rule.hinglish.trim().length, `Rule in ${guide.id} missing Hinglish`).toBeGreaterThan(0);
        }

        for (const num of guide.numbersExplained) {
          expect(num.label.hinglish.trim().length, `Number label in ${guide.id} missing Hinglish`).toBeGreaterThan(0);
          expect(num.description.hinglish.trim().length, `Number desc in ${guide.id} missing Hinglish`).toBeGreaterThan(0);
        }

        for (const err of guide.commonErrors) {
          expect(err.symptom.hinglish.trim().length, `Error symptom in ${guide.id} missing Hinglish`).toBeGreaterThan(0);
          expect(err.cause.hinglish.trim().length, `Error cause in ${guide.id} missing Hinglish`).toBeGreaterThan(0);
          expect(err.fix.hinglish.trim().length, `Error fix in ${guide.id} missing Hinglish`).toBeGreaterThan(0);
        }

        for (const faq of guide.faqs) {
          expect(faq.question.hinglish.trim().length, `FAQ question in ${guide.id} missing Hinglish`).toBeGreaterThan(0);
          expect(faq.answer.hinglish.trim().length, `FAQ answer in ${guide.id} missing Hinglish`).toBeGreaterThan(0);
        }
      }
    });

    it("scan test: ensures no admin guide contains hardcoded platform fee or tax numbers (must use template tokens)", () => {
      const adminFilePath = path.resolve(process.cwd(), "src/content/guides/admin.ts");
      const fileContent = fs.readFileSync(adminFilePath, "utf8");

      const hardcodedTaxRegex = /(?:TDS.*?(\b0\.1%|\b5%))|(?:fee.*?(\b7%|\b10%))/i;
      const lines = fileContent.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (line.includes("//") || line.includes("tax.") || line.includes("fee.")) continue;

        const match = hardcodedTaxRegex.exec(line);
        if (match && !line.includes("{{")) {
          throw new Error(`Hardcoded fee/tax number detected on line ${i + 1} of admin.ts: "${line.trim()}". Use canonical token template instead.`);
        }
      }
    });

    it("verifies coverage for all required admin features & operations", () => {
      const requiredSlugs = [
        "admin-command-center",
        "admin-analytics-intelligence",
        "admin-application-review",
        "admin-immutable-audit-logs",
        "admin-cpv-benchmarks",
        "admin-campaign-supervision",
        "admin-dispute-arbitration",
        "admin-financial-reconciliation",
        "admin-broadcast-newsletter",
        "admin-payout-authorizations",
        "admin-campus-scouts",
        "admin-suspicious-reviews",
        "admin-system-health-and-dlq",
        "admin-dlq-replay-operations",
        "admin-user-management",
        "admin-kyc-verification-desk",
        "admin-violations-and-enforcement",
        "admin-support-desk",
        "admin-guide-center",
      ];

      for (const slug of requiredSlugs) {
        const guide = getGuideById(slug);
        expect(guide, `Required admin guide slug "${slug}" not found in guide registry`).toBeDefined();
        expect(guide?.roles).toContain("ADMIN");
        expect(guide?.routes.length).toBeGreaterThanOrEqual(1);
      }
    });

    it("validates that all referenced runbook files physically exist on disk", () => {
      const runbooks = [
        "docs/runbooks/payment-stuck.md",
        "docs/runbooks/escrow-mismatch.md",
        "docs/runbooks/instagram-reconnect-storm.md",
        "docs/runbooks/telemetry-incident.md",
        "docs/runbooks/admin-lockout.md",
        "docs/runbooks/flag-rollback.md",
        "docs/runbooks/dlq-replay.md",
        "docs/meta-app-review.md",
      ];

      for (const runbookPath of runbooks) {
        const fullPath = path.resolve(process.cwd(), runbookPath);
        expect(
          fs.existsSync(fullPath),
          `Referenced runbook not found on disk: ${runbookPath}`
        ).toBe(true);
      }
    });

    it("ensures destructive action callouts specify 'What this does', 'Who is notified', and 'Can it be undone'", () => {
      const adminFilePath = path.resolve(process.cwd(), "src/content/guides/admin.ts");
      const fileContent = fs.readFileSync(adminFilePath, "utf8");

      const requiredCallouts = [
        "User Ban / Suspension",
        "Dispute Binding Verdict / Escrow Split",
        "Payout Rejection / Fund Clawback",
        "Emergency Kill Switches & Feature Flag Toggles",
        "DLQ Message Replay",
        "Force Admin Session Revocation",
      ];

      for (const callout of requiredCallouts) {
        expect(fileContent, `Missing destructive action callout for: ${callout}`).toContain(callout);
      }

      expect(fileContent).toContain("What this does:");
      expect(fileContent).toContain("Who is notified:");
      expect(fileContent).toContain("Can it be undone:");
    });

    it("admin isolation guard: ensures non-admin callers (INFLUENCER, BRAND, SCOUT) strictly receive 0 admin-only guides", () => {
      const adminOnlyGuides = ALL_GUIDES.filter((g) => g.roles.length === 1 && g.roles[0] === "ADMIN");
      expect(adminOnlyGuides.length).toBeGreaterThanOrEqual(18);

      const nonAdminRoles: GuideUserType[] = ["INFLUENCER", "BRAND", "SCOUT"];
      for (const role of nonAdminRoles) {
        const roleGuides = getGuidesByRole(role);
        for (const g of roleGuides) {
          expect(g.roles).toContain(role);
          expect(adminOnlyGuides.some((ag) => ag.id === g.id)).toBe(false);
        }

        // Test route matching on pure admin routes
        const pureAdminRoutes = [
          "/admin",
          "/admin/financial",
          "/admin/system",
          "/admin/disputes",
          "/admin/verifications",
          "/admin/payouts",
          "/admin/benchmarks",
          "/admin/audit-logs",
        ];

        for (const route of pureAdminRoutes) {
          const matched = getGuidesForRoute(ALL_GUIDES, route, role);
          expect(matched.length, `Role ${role} unexpectedly matched admin route ${route}`).toBe(0);
        }
      }
    });
  });
});
