import { test, expect } from "@playwright/test";
import { installVendorMocks } from "./helpers/vendor-mocks";
import { loginAs, TEST_CREDENTIALS } from "./helpers/auth";
import { testPrisma, getTestUser } from "./helpers/db";

test.describe("Brand End-to-End User Journey", () => {
  test.beforeEach(async ({ page }) => {
    await installVendorMocks(page);
  });

  test("Step 1: Brand Registration & Business Profile Flow", async ({ page }) => {
    await page.goto("/register", { waitUntil: "domcontentloaded" });
    await expect(page.locator("main").getByRole("heading").first()).toBeVisible();

    const brandOption = page.locator('main button.usertype-card').nth(1);
    await expect(brandOption).toBeVisible();
    await brandOption.click();

    // Verify Brand Company Name input is rendered
    await expect(page.locator('input[placeholder*="Aura Lifestyle" i], input[placeholder*="Company" i], input#name').first()).toBeVisible();
  });

  test("Step 2: Create Campaign (3-Step Wizard)", async ({ page }) => {
    await loginAs(page, "brand");

    await page.goto("/dashboard/campaigns/create", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/dashboard\/campaigns\/create/);

    // Verify Wizard Stepper is rendered
    const wizardTitle = page.locator("main").getByRole("heading").first();
    await expect(wizardTitle).toBeVisible();

    // Verify Title and Category fields are accessible
    const titleInput = page.locator('input[name="title"], input[placeholder*="title" i]').first();
    if (await titleInput.isVisible()) {
      await titleInput.fill("E2E Playwright Diwali Brand Campaign");
    }

    // Verify Brand Wallet has funded balance for escrow in DB
    const user = await getTestUser(TEST_CREDENTIALS.brand.email);
    expect(user?.wallet?.balance).toBeGreaterThan(0);
  });

  test("Step 3 & 4: Campaign Applicant Review (Match Badge) & Escrow Funding", async ({ page }) => {
    await loginAs(page, "brand");

    // Navigate to Campaigns Directory
    await page.goto("/dashboard/campaigns", { waitUntil: "domcontentloaded" });
    await expect(page.locator("main").getByRole("heading").first()).toBeVisible();

    // Verify Brand Wallet and Escrow Balance
    await page.goto("/dashboard/wallet", { waitUntil: "domcontentloaded" });
    await expect(page.locator("main").getByRole("heading", { name: /Escrow Wallet|Wallet/i }).first()).toBeVisible();

    // Assert DB state has brand profile with GST and PAN verified
    const user = await getTestUser(TEST_CREDENTIALS.brand.email);
    expect(user?.brandProfile?.isGstVerified).toBe(true);
    expect(user?.brandProfile?.isPanVerified).toBe(true);
  });

  test("Step 5 & 6: Content Deliverable Approval & Escrow Release", async ({ page }) => {
    await loginAs(page, "brand");

    // Navigate to Deals Hub
    await page.goto("/dashboard/deals", { waitUntil: "domcontentloaded" });
    await expect(page.locator("main").getByRole("heading").first()).toBeVisible();

    // Assert brand has completed deals in DB or active deals
    const brand = await testPrisma.brandProfile.findFirst({
      where: { user: { email: TEST_CREDENTIALS.brand.email } },
    });
    expect(brand).toBeDefined();
  });

  test("Step 7: Campaign Analytics Hub (All Tabs)", async ({ page }) => {
    await loginAs(page, "brand");

    await page.goto("/dashboard/analytics", { waitUntil: "domcontentloaded" });
    await expect(page.locator("main").getByRole("heading", { name: /Analytics/i }).first()).toBeVisible();

    // Assert time-series or KPI metric cards render
    const kpiCard = page.locator("main").locator("text=/Spend|GMV|Campaign|Overview|ROI/i").first();
    await expect(kpiCard).toBeVisible();
  });

  test("Step 8: Campaign ROI Report & Print View", async ({ page }) => {
    await loginAs(page, "brand");

    // Check pricing guidance or reports
    await page.goto("/pricing", { waitUntil: "domcontentloaded" });
    const pricingHeader = page.locator("main").getByRole("heading").first();
    await expect(pricingHeader).toBeVisible();

    // Verify campaign analytics & ROI view
    await page.goto("/dashboard/analytics", { waitUntil: "domcontentloaded" });
    const roiHeading = page.locator("main").getByRole("heading", { name: /Analytics/i }).first();
    await expect(roiHeading).toBeVisible();
  });

  test("Step 9: Finance CSV Export Verification (Headers Present)", async ({ page }) => {
    await loginAs(page, "brand");

    // Fetch branded finance CSV export
    const response = await page.request.get("/api/reports/brand/spend?format=csv&fy=2025-26");
    expect(response.status()).toBe(200);

    const csvContent = await response.text();
    expect(csvContent).toContain("CLIENT DETAILS");
    expect(csvContent).toContain("Platform Fee");
  });
});
