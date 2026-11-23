import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export const TEST_CREDENTIALS = {
  admin: {
    email: "admin@test.vyaparmedia.in",
    password: process.env.TEST_ACCOUNT_PASSWORD ?? "Test@1234",
    role: "ADMIN",
    defaultPath: "/admin",
  },
  brand: {
    email: "brand@test.vyaparmedia.in",
    password: process.env.TEST_ACCOUNT_PASSWORD ?? "Test@1234",
    role: "BRAND",
    defaultPath: "/dashboard",
  },
  influencer: {
    email: "influencer@test.vyaparmedia.in",
    password: process.env.TEST_ACCOUNT_PASSWORD ?? "Test@1234",
    role: "INFLUENCER",
    defaultPath: "/dashboard",
  },
  scout: {
    email: "scout@test.vyaparmedia.in",
    password: process.env.TEST_ACCOUNT_PASSWORD ?? "Test@1234",
    role: "SCOUT",
    defaultPath: "/dashboard",
  },
} as const;

export type TestRole = keyof typeof TEST_CREDENTIALS;

/**
 * Robust UI login helper for Playwright journeys.
 * Types credentials and submits the login form.
 */
export async function loginAs(page: Page, role: TestRole): Promise<void> {
  const creds = TEST_CREDENTIALS[role];

  // Dismiss telemetry consent banner by default in tests
  await page.addInitScript(() => {
    try {
      localStorage.setItem("vm_telemetry_banner_dismissed_v1", "true");
    } catch {}
  });

  const loginUrl = `/login?callbackUrl=${encodeURIComponent(creds.defaultPath)}`;
  await page.goto(loginUrl, { waitUntil: "load" });

  // Dismiss banner if already rendered in DOM
  const bannerBtn = page.locator('button:has-text("Anonymous Only"), button:has-text("Accept Identified Analytics")').first();
  if (await bannerBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await bannerBtn.click().catch(() => {});
  }

  // Fill credentials with wait to ensure React state captures inputs
  const emailInput = page.locator('input[type="email"]');
  await emailInput.waitFor({ state: "visible", timeout: 10000 });
  await emailInput.fill(creds.email);

  const passwordInput = page.locator('input[type="password"]');
  await passwordInput.waitFor({ state: "visible", timeout: 10000 });
  await passwordInput.fill(creds.password);

  // Submit button
  const submitButton = page.locator('button[type="submit"]');
  await submitButton.waitFor({ state: "visible", timeout: 10000 });
  await submitButton.click({ force: true });
  await passwordInput.press("Enter").catch(() => {});

  // Wait for redirect away from login
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 60000 });
}

export async function logout(page: Page): Promise<void> {
  await page.goto("/dashboard/settings");
  const logoutBtn = page.locator('button:has-text("Sign Out"), button:has-text("Logout")');
  if (await logoutBtn.isVisible()) {
    await logoutBtn.click();
  }
}
