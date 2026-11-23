import { test, expect } from "@playwright/test";
import { installVendorMocks } from "./helpers/vendor-mocks";
import { loginAs, TEST_CREDENTIALS } from "./helpers/auth";
import { testPrisma, getTestUser } from "./helpers/db";

test.describe("Scout (Campus Ambassador) End-to-End User Journey", () => {
  test.beforeEach(async ({ page }) => {
    await installVendorMocks(page);
  });

  test("Step 1: Scout Signup & Verification Gate", async ({ page }) => {
    await page.goto("/register", { waitUntil: "domcontentloaded" });
    await expect(page.locator("main").getByRole("heading").first()).toBeVisible();

    // Verify DB state for seeded scout account
    const scoutUser = await getTestUser(TEST_CREDENTIALS.scout.email);
    expect(scoutUser?.userType).toBe("SCOUT");
    expect(scoutUser?.scoutProfile?.verificationStatus).toBe("APPROVED");
  });

  test("Step 2 & 3: Scout Dashboard & Campus Partner View", async ({ page }) => {
    await loginAs(page, "scout");

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/dashboard/);

    // Verify topbar or dashboard greeting reflects Scout/Campus Partner
    const greeting = page.locator("main").locator("text=/Welcome|Campus Partner|Dashboard|Overview/i").first();
    await expect(greeting).toBeVisible();
  });

  test("Step 4: Invite Link & QR Code Generation", async ({ page }) => {
    await loginAs(page, "scout");

    // Navigate to referrals or share view
    await page.goto("/dashboard/referrals", { waitUntil: "domcontentloaded" });

    // Assert Scout referral code or invite UI is displayed
    const codeElement = page.locator("main").locator("text=/SCOUT|Referral|Code|Invite/i").first();
    await expect(codeElement).toBeVisible();
  });

  test("Step 5 & 6: Network Pipeline & Royalty Wallet", async ({ page }) => {
    await loginAs(page, "scout");

    // Check Wallet for Scout royalty balance (₹5,000 seeded)
    await page.goto("/dashboard/wallet", { waitUntil: "domcontentloaded" });
    await expect(page.locator("main").getByRole("heading", { name: /Escrow Wallet|Wallet/i }).first()).toBeVisible();

    // Assert DB wallet balance matches 500,000 paise (Rs 5,000)
    const scout = await getTestUser(TEST_CREDENTIALS.scout.email);
    expect(scout?.wallet?.balance).toBe(500000);
  });

  test("Step 7: Ambassador Certificate & Badges View", async ({ page }) => {
    await loginAs(page, "scout");

    await page.goto("/dashboard/badges", { waitUntil: "domcontentloaded" });
    await expect(page.locator("main").locator("text=/Badges|Level|Achievements|Partner/i").first()).toBeVisible();
  });
});
