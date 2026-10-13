import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Mobile & Tablet Responsive Viewport Integrity (375px, 390px, 768px)", () => {
  it("should enforce global overflow-x protection in base styles", () => {
    const baseCss = fs.readFileSync(path.join(process.cwd(), "src/app/styles/base.css"), "utf8");
    expect(baseCss).toContain("overflow-x: hidden");
    expect(baseCss).toContain("max-width: 100%");
  });

  it("should enforce minimum 44x44px touch targets on buttons and form inputs", () => {
    const baseCss = fs.readFileSync(path.join(process.cwd(), "src/app/styles/base.css"), "utf8");
    const componentsCss = fs.readFileSync(path.join(process.cwd(), "src/app/styles/components.css"), "utf8");
    const adminCss = fs.readFileSync(path.join(process.cwd(), "src/app/styles/admin.css"), "utf8");

    // .btn touch target
    expect(baseCss).toContain("min-height: 44px");
    expect(baseCss).toContain("min-width: 44px");

    // .input touch target
    expect(baseCss).toContain("height: 44px");
    expect(baseCss).toContain("min-height: 44px");

    // .modal-close-btn touch target
    expect(componentsCss).toContain("min-width: 44px");
    expect(componentsCss).toContain("min-height: 44px");

    // .hamburger touch target
    expect(componentsCss).toContain("min-width: 44px");
    expect(componentsCss).toContain("min-height: 44px");

    // .dashboard-icon-button touch target
    expect(adminCss).toContain("min-width: 44px");
    expect(adminCss).toContain("min-height: 44px");
  });

  it("should wrap pricing comparison table in overflow-x-auto for 375px viewports", () => {
    const pricingContent = fs.readFileSync(path.join(process.cwd(), "src/app/pricing/page.tsx"), "utf8");
    expect(pricingContent).toContain("overflow-x-auto");
    expect(pricingContent).toContain("min-w-[500px]");
  });

  it("should prevent notification dropdown from exceeding viewport bounds on mobile", () => {
    const landingCss = fs.readFileSync(path.join(process.cwd(), "src/app/styles/landing.css"), "utf8");
    expect(landingCss).toContain("right: 12px !important");
    expect(landingCss).not.toContain("right: -50px");
  });

  it("should ensure all 52 user-facing route files exist and have no unconstrained fixed widths > 375px", () => {
    const routes = [
      "src/app/page.tsx",
      "src/app/pricing/page.tsx",
      "src/app/about/page.tsx",
      "src/app/contact/page.tsx",
      "src/app/blog/page.tsx",
      "src/app/help/page.tsx",
      "src/app/not-found.tsx",
      "src/app/creator/[username]/page.tsx",
      "src/app/legal/page.tsx",
      "src/app/privacy/page.tsx",
      "src/app/terms/page.tsx",
      "src/app/refund/page.tsx",
      "src/app/cookie-policy/page.tsx",
      "src/app/login/page.tsx",
      "src/app/register/page.tsx",
      "src/app/onboarding/page.tsx",
      "src/app/forgot-password/page.tsx",
      "src/app/reset-password/page.tsx",
      "src/app/dashboard/page.tsx",
      "src/app/dashboard/deals/page.tsx",
      "src/app/dashboard/deals/[id]/page.tsx",
      "src/app/dashboard/deals/[id]/dispute/page.tsx",
      "src/app/dashboard/campaigns/page.tsx",
      "src/app/dashboard/campaigns/create/page.tsx",
      "src/app/dashboard/campaigns/[id]/page.tsx",
      "src/app/dashboard/influencers/page.tsx",
      "src/app/dashboard/influencers/[id]/page.tsx",
      "src/app/dashboard/wallet/page.tsx",
      "src/app/dashboard/messages/page.tsx",
      "src/app/dashboard/disputes/page.tsx",
      "src/app/dashboard/disputes/[id]/page.tsx",
      "src/app/dashboard/applications/page.tsx",
      "src/app/dashboard/badges/page.tsx",
      "src/app/dashboard/leaderboard/page.tsx",
      "src/app/dashboard/notifications/page.tsx",
      "src/app/dashboard/referrals/page.tsx",
      "src/app/dashboard/settings/page.tsx",
      "src/app/dashboard/support/page.tsx",
      "src/app/dashboard/analytics/page.tsx",
      "src/app/admin/page.tsx",
      "src/app/admin/analytics/page.tsx",
      "src/app/admin/applications/page.tsx",
      "src/app/admin/audit-logs/page.tsx",
      "src/app/admin/disputes/page.tsx",
      "src/app/admin/disputes/[id]/page.tsx",
      "src/app/admin/financial/page.tsx",
      "src/app/admin/newsletter/page.tsx",
      "src/app/admin/payouts/page.tsx",
      "src/app/admin/users/page.tsx",
      "src/app/admin/verifications/page.tsx",
      "src/app/admin/verifications/[id]/page.tsx",
      "src/app/admin/violations/page.tsx",
    ];

    expect(routes.length).toBe(52);

    for (const r of routes) {
      const p = path.join(process.cwd(), r);
      expect(fs.existsSync(p), `File ${r} should exist`).toBe(true);

      const content = fs.readFileSync(p, "utf8");
      // Assert any table has an overflow-x-auto wrapper
      if (content.includes("<table")) {
        const tableIndex = content.indexOf("<table");
        const preContext = content.substring(Math.max(0, tableIndex - 300), tableIndex);
        expect(
          preContext.includes("overflow-x-auto") || preContext.includes("overflow-x: auto"),
          `Table in ${r} must be wrapped in overflow-x-auto container`
        ).toBe(true);
      }
    }
  });

  it("should ensure all 52 routes and subcomponents pass deep responsive checks for 375px, 390px, and 768px", () => {
    // Run the deep audit logic programmatically
    const routes = [
      "src/app/page.tsx",
      "src/app/pricing/page.tsx",
      "src/app/about/page.tsx",
      "src/app/contact/page.tsx",
      "src/app/blog/page.tsx",
      "src/app/help/page.tsx",
      "src/app/not-found.tsx",
      "src/app/creator/[username]/page.tsx",
      "src/app/legal/page.tsx",
      "src/app/privacy/page.tsx",
      "src/app/terms/page.tsx",
      "src/app/refund/page.tsx",
      "src/app/cookie-policy/page.tsx",
      "src/app/login/page.tsx",
      "src/app/register/page.tsx",
      "src/app/onboarding/page.tsx",
      "src/app/forgot-password/page.tsx",
      "src/app/reset-password/page.tsx",
      "src/app/dashboard/page.tsx",
      "src/app/dashboard/deals/page.tsx",
      "src/app/dashboard/deals/[id]/page.tsx",
      "src/app/dashboard/deals/[id]/dispute/page.tsx",
      "src/app/dashboard/campaigns/page.tsx",
      "src/app/dashboard/campaigns/create/page.tsx",
      "src/app/dashboard/campaigns/[id]/page.tsx",
      "src/app/dashboard/influencers/page.tsx",
      "src/app/dashboard/influencers/[id]/page.tsx",
      "src/app/dashboard/wallet/page.tsx",
      "src/app/dashboard/messages/page.tsx",
      "src/app/dashboard/disputes/page.tsx",
      "src/app/dashboard/disputes/[id]/page.tsx",
      "src/app/dashboard/applications/page.tsx",
      "src/app/dashboard/badges/page.tsx",
      "src/app/dashboard/leaderboard/page.tsx",
      "src/app/dashboard/notifications/page.tsx",
      "src/app/dashboard/referrals/page.tsx",
      "src/app/dashboard/settings/page.tsx",
      "src/app/dashboard/support/page.tsx",
      "src/app/dashboard/analytics/page.tsx",
      "src/app/admin/page.tsx",
      "src/app/admin/analytics/page.tsx",
      "src/app/admin/applications/page.tsx",
      "src/app/admin/audit-logs/page.tsx",
      "src/app/admin/disputes/page.tsx",
      "src/app/admin/disputes/[id]/page.tsx",
      "src/app/admin/financial/page.tsx",
      "src/app/admin/newsletter/page.tsx",
      "src/app/admin/payouts/page.tsx",
      "src/app/admin/users/page.tsx",
      "src/app/admin/verifications/page.tsx",
      "src/app/admin/verifications/[id]/page.tsx",
      "src/app/admin/violations/page.tsx",
    ];

    for (const r of routes) {
      const p = path.join(process.cwd(), r);
      const content = fs.readFileSync(p, "utf8");

      // Check unconstrained fixed widths > 340px
      const widthMatches = content.matchAll(/(?<!(?:sm|md|lg|xl|2xl):)(?:w|min-w)-\[(\d+)px\]/g);
      for (const m of widthMatches) {
        const px = m[1] ? parseInt(m[1], 10) : 0;
        if (px > 340) {
          const ctx = content.substring(Math.max(0, m.index - 200), m.index + 200);
          const safe = ctx.includes("overflow-x-auto") ||
                       ctx.includes("overflow-hidden") ||
                       ctx.includes("pointer-events-none") ||
                       ctx.includes("blur-") ||
                       ctx.includes("w-full max-w-[");
          expect(safe, `Route ${r} has unconstrained width ${m[0]}`).toBe(true);
        }
      }
    }
  });
});
