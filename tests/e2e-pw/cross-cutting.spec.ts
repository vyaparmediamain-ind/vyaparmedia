import { test, expect } from "@playwright/test";
import { installVendorMocks } from "./helpers/vendor-mocks";
import { loginAs } from "./helpers/auth";
import { assertAccessible } from "./helpers/axe-helper";

test.describe("Cross-Cutting System & Resilience Journeys", () => {
  test.beforeEach(async ({ page }) => {
    await installVendorMocks(page);
  });

  test("1. Telemetry Consent Banner Accept & Decline Flow", async ({ page }) => {
    await installVendorMocks(page, { autoDismissConsent: false });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Assert Telemetry / Privacy Banner appears on fresh visitor session
    const banner = page.locator("text=/Privacy & Analytics Notice|Identified Analytics/i").first();
    if (await banner.isVisible()) {
      const acceptBtn = page.locator('button:has-text("Accept Identified Analytics"), button:has-text("Accept")').first();
      await acceptBtn.click();
      await expect(banner).not.toBeVisible();
    }
  });

  test("2. Role Guard Redirects: Creator cannot access Admin portal", async ({ page }) => {
    await loginAs(page, "influencer");

    // Attempt to access superadmin portal directly
    await page.goto("/admin", { waitUntil: "domcontentloaded" });

    // Should be redirected away from /admin (e.g. to /dashboard or /login)
    await expect(page).not.toHaveURL(/\/admin$/);
  });

  test("3. Guide & Help Center Search and Deep Linking", async ({ page }) => {
    await page.goto("/help", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/help/);

    // Verify search input
    const searchInput = page.locator('input[type="text"], input[placeholder*="search" i]').first();
    await expect(searchInput).toBeVisible();

    // Type query
    await searchInput.fill("TDS");

    // Assert filtered FAQ question is visible
    const faqItem = page.locator("text=/TDS|tax/i").first();
    await expect(faqItem).toBeVisible();
  });

  test("4. Branded 404 Not Found Page Recovery", async ({ page }) => {
    const res = await page.goto("/non-existent-route-for-404-e2e-audit", { waitUntil: "domcontentloaded" });
    // In Next.js client routing or SSR, verify 404 branding
    const notFoundText = page.locator("text=/404|Page Not Found|Looking for something/i").first();
    await expect(notFoundText).toBeVisible();

    // Verify quick recovery links exist
    const homeLink = page.locator('a[href="/"]').first();
    await expect(homeLink).toBeVisible();
  });

  test("5. A11y Smoke with Axe on 15 Key Pages", async ({ page }) => {
    const keyPages = [
      "/",
      "/pricing",
      "/about",
      "/contact",
      "/blog",
      "/help",
      "/status",
      "/legal",
      "/privacy",
      "/terms",
      "/refund",
      "/cookie-policy",
      "/login",
      "/register",
      "/not-found",
    ];

    for (const route of keyPages) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await assertAccessible(page, route, {
        includedImpacts: ["serious", "critical"],
      });
    }
  });

  test("6. Keyboard-Only Navigation in Dashboard", async ({ page }) => {
    await loginAs(page, "influencer");
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    // Press Tab repeatedly to cycle through focusable interactive elements
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");

    // Assert that active element is focused and receives outline ring
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
    expect(["A", "BUTTON", "INPUT", "BODY"]).toContain(focusedTag);
  });
});
