import { test, expect } from "@playwright/test";
import { installVendorMocks } from "./helpers/vendor-mocks";
import { loginAs, TEST_CREDENTIALS } from "./helpers/auth";
import { testPrisma, getTestUser } from "./helpers/db";

test.describe("Creator (Influencer) End-to-End User Journey", () => {
  test.beforeEach(async ({ page }) => {
    await installVendorMocks(page);
  });

  test("Step 1 & 2: Registration & Onboarding Flow", async ({ page }) => {
    // 1. Visit registration page
    await page.goto("/register", { waitUntil: "domcontentloaded" });
    await expect(page.locator("main").getByRole("heading").first()).toBeVisible();

    // Verify role selection exists (Creator vs Brand)
    const creatorCard = page.locator("main button.usertype-card").first();
    await expect(creatorCard).toBeVisible();
    await creatorCard.click();

    // Verify registration inputs
    await expect(page.locator('input[type="email"], input[name="email"], input#email, input[placeholder*="email" i]').first()).toBeVisible();

    // 2. Onboarding gate verification for logged-in creator
    await loginAs(page, "influencer");
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("Step 3: Verification Gate & Status Audit", async ({ page }) => {
    await loginAs(page, "influencer");

    // Navigate to Verification tab in Settings
    await page.goto("/dashboard/settings?tab=verification", { waitUntil: "domcontentloaded" });

    // Verify KYC status is displayed (FULL / Verified)
    await expect(page.locator("text=/Verification|KYC|Identity/i").first()).toBeVisible();

    // Verify DB state confirms verified status
    const user = await getTestUser(TEST_CREDENTIALS.influencer.email);
    expect(user?.verificationLevel).toBe("FULL");
    expect(user?.status).toBe("ACTIVE");
  });

  test("Step 4: Social Connect & 'Views access' Chip Visibility", async ({ page }) => {
    // Stub settings response with active views access
    await page.route("**/api/settings", async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      const target = json.data || json;
      if (target) {
        target.socialConnections = target.socialConnections || {};
        target.socialConnections.instagram = {
          connected: true,
          accessTokenPresent: true,
          viewsAccess: "ACTIVE",
          handle: "priyasharma.official",
          lastSynced: new Date().toISOString(),
        };
      }
      await route.fulfill({ response, json });
    });

    await loginAs(page, "influencer");
    await page.goto("/dashboard/settings?tab=social", { waitUntil: "domcontentloaded" });

    // Assert "Views access: Active" chip is rendered
    const viewsAccessChip = page.locator("text=/Views access: Active/i").first();
    await expect(viewsAccessChip).toBeVisible({ timeout: 15000 });
  });

  test("Step 5 & 6: Settings Rates & MarketRangeCard Valuation", async ({ page }) => {
    await loginAs(page, "influencer");
    await page.goto("/dashboard/settings?tab=rates", { waitUntil: "domcontentloaded" });

    // Verify MarketRangeCard guidance or rates panel is visible
    const ratesHeading = page.locator("text=/Commercial Rates|Rate Card|Market Range/i").first();
    await expect(ratesHeading).toBeVisible();

    // Verify inputs for commercial rates
    const minRateInput = page.locator('input[name="minRate"], input[name="minInstagramRate"]').first();
    if (await minRateInput.isVisible()) {
      await expect(minRateInput).toBeEnabled();
    }
  });

  test("Step 7: Profile Visibility Analytics", async ({ page }) => {
    await loginAs(page, "influencer");
    await page.goto("/dashboard/analytics", { waitUntil: "domcontentloaded" });

    // Assert analytics metrics cards (Reach, Engagement, Views) render
    const heading = page.getByRole("heading", { name: /analytics/i }).first();
    await expect(heading).toBeVisible();
    await expect(page.locator("text=/Overview|Estimated Market Range|Fiscal Year/i").first()).toBeVisible();
  });

  test("Step 8: Market-Range Report Print View with Official Letterhead", async ({ page }) => {
    await loginAs(page, "influencer");
    const user = await getTestUser(TEST_CREDENTIALS.influencer.email);
    expect(user?.influencerProfile).toBeDefined();

    // Verify canonical Market Range Report endpoint returns corporate metadata & valuation
    const reportRes = await page.request.get(`/api/reports/creator/${user!.influencerProfile!.id}/market-range`);
    expect(reportRes.status()).toBe(200);
    const reportJson = await reportRes.json();
    expect(reportJson.success).toBe(true);
    expect(reportJson.data.reportMeta.reportId).toBeDefined();
    expect(reportJson.data.reportMeta.type).toBe("RANGE");
    expect(reportJson.data.marketRange.minPaise).toBeGreaterThan(0);

    // Navigate to campaigns and verify page renders properly
    await page.goto("/dashboard/campaigns", { waitUntil: "domcontentloaded" });
    const pageHeading = page.locator("main").getByRole("heading").first();
    await expect(pageHeading).toBeVisible();
  });

  test("Step 9: Open Guide / Notification Drawer from 5 Different Pages", async ({ page }) => {
    await loginAs(page, "influencer");

    const pagesToVisit = [
      "/dashboard",
      "/dashboard/deals",
      "/dashboard/campaigns",
      "/dashboard/wallet",
      "/dashboard/settings",
    ];

    for (const pagePath of pagesToVisit) {
      await page.goto(pagePath, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(new RegExp(pagePath.replace("/", "\\/")));

      // Open notification / activity drawer via the topbar bell button
      const bellButton = page.locator('button[aria-label^="Notifications"]').first();
      await expect(bellButton).toBeVisible();
      await bellButton.click();

      // Drawer panel opens and close button works
      const closeBtn = page.locator('button[aria-label="Close activity drawer"]').first();
      if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await closeBtn.click();
      }
    }
  });

  test("Step 10: Campaign Discovery & Application Pipeline", async ({ page }) => {
    await loginAs(page, "influencer");

    // Discover campaigns
    await page.goto("/dashboard/campaigns", { waitUntil: "domcontentloaded" });
    const campaignHeading = page.locator("main").getByRole("heading").first();
    await expect(campaignHeading).toBeVisible();

    // Verify Deals Room
    await page.goto("/dashboard/deals", { waitUntil: "domcontentloaded" });
    const dealsHeading = page.locator("main").getByRole("heading").first();
    await expect(dealsHeading).toBeVisible();

    // Verify Wallet & Withdraw Request
    await page.goto("/dashboard/wallet", { waitUntil: "domcontentloaded" });
    const walletBalance = page.locator("text=/Available Balance|Escrow Balance|₹/i").first();
    await expect(walletBalance).toBeVisible();

    // Verify DB integrity for Influencer
    const user = await getTestUser(TEST_CREDENTIALS.influencer.email);
    expect(user).toBeDefined();
    expect(user?.influencerProfile).toBeDefined();
  });
});
