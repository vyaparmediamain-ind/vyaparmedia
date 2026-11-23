import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || "http://localhost:3000";

// Strictly forbid executing Playwright against production environments
if (baseURL.includes("vyaparmedia.in") && !baseURL.includes("test")) {
  throw new Error(
    `[SECURITY GUARD] Playwright test runner aborted. Target URL "${baseURL}" resolves to production. ` +
    `Playwright must NEVER be executed against production!`
  );
}

export default defineConfig({
  testDir: "./tests/e2e-pw",
  timeout: 90000,
  expect: {
    timeout: 20000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  globalSetup: "./tests/e2e-pw/global-setup.ts",
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  webServer: {
    command: process.env.CI ? "npm run start" : "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      PLAYWRIGHT_TEST: "1",
    },
  },
});
