import { test, expect } from "@playwright/test";
import { installVendorMocks } from "./helpers/vendor-mocks";

test.describe("Playwright Infrastructure Smoke Test", () => {
  test.beforeEach(async ({ page }) => {
    await installVendorMocks(page);
  });

  test("loads login page and renders authentication form without network errors", async ({ page }) => {
    const response = await page.goto("/login", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBeLessThan(400);

    // Verify page title contains branding
    await expect(page).toHaveTitle(/VyaparMedia|Login/i);

    // Verify main login element exists
    const loginForm = page.locator("form");
    await expect(loginForm.first()).toBeVisible();
  });
});
