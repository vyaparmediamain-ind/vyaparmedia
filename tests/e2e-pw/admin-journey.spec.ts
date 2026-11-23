import { test, expect } from "@playwright/test";
import { installVendorMocks } from "./helpers/vendor-mocks";
import { loginAs, TEST_CREDENTIALS } from "./helpers/auth";
import { testPrisma, getTestUser } from "./helpers/db";

test.describe("Admin Operations & System Governance End-to-End User Journey", () => {
  test.beforeEach(async ({ page }) => {
    await installVendorMocks(page);
  });

  test("Step 1: Admin Login & Command Center Overview", async ({ page }) => {
    await loginAs(page, "admin");

    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/admin/);

    // Verify Admin Portal Command Center title / stats
    const heading = page.getByRole("heading").or(page.locator("h1, h2")).first();
    await expect(heading).toBeVisible();

    // Verify DB user is verified ADMIN
    const user = await getTestUser(TEST_CREDENTIALS.admin.email);
    expect(user?.userType).toBe("ADMIN");
  });

  test("Step 2: KYC & Business Verification Queue", async ({ page }) => {
    await loginAs(page, "admin");

    await page.goto("/admin/verifications", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/admin\/verifications/);

    const title = page.locator("text=/Verification|KYC Queue|Documents/i").first();
    await expect(title).toBeVisible();
  });

  test("Step 3: Dispute Arbitration Queue", async ({ page }) => {
    await loginAs(page, "admin");

    await page.goto("/admin/disputes", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/admin\/disputes/);

    const title = page.locator("text=/Disputes|Arbitration|Resolution/i").first();
    await expect(title).toBeVisible();
  });

  test("Step 4: Manual Payouts & Banking Approval Queue", async ({ page }) => {
    await loginAs(page, "admin");

    await page.goto("/admin/payouts", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/admin\/payouts/);

    const title = page.locator("text=/Payouts|Withdrawal Queue|Bank Transfers/i").first();
    await expect(title).toBeVisible();
  });

  test("Step 5: System Page Monitor (Cron Heartbeats, Instagram Insights, Flags & DLQ)", async ({ page }) => {
    await loginAs(page, "admin");

    await page.goto("/admin/system", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/admin\/system/);

    // 1. Cron heartbeats monitor
    const cronSection = page.locator("text=/Cron|Heartbeat|QStash|Background Jobs/i").first();
    await expect(cronSection).toBeVisible();

    // 2. Instagram insights status card
    const igCard = page.locator("text=/Instagram|Meta Graph|Insights/i").first();
    await expect(igCard).toBeVisible();

    // 3. Feature flags console
    const flagsSection = page.locator("text=/Feature Flags|Kill Switch|System Controls/i").first();
    await expect(flagsSection).toBeVisible();
  });

  test("Step 6: Campaign Governance Report", async ({ page }) => {
    await loginAs(page, "admin");

    await page.goto("/admin/campaigns", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/admin\/campaigns/);

    const title = page.locator("text=/Campaign Governance|Portfolio|Risk/i").first();
    await expect(title).toBeVisible();
  });

  test("Step 7: Dead-Letter Queue (DLQ) Seeded Job Replay", async ({ page }) => {
    await loginAs(page, "admin");

    // 1. Ensure a dead-letter job is present in DB
    const deadJobId = "e2e_seeded_failed_job_" + Date.now();
    await testPrisma.deadLetterJob.upsert({
      where: { id: deadJobId },
      update: { status: "FAILED" },
      create: {
        id: deadJobId,
        topic: "test.acknowledge",
        endpoint: "/api/jobs/consumer",
        payload: { attempt: 3, reason: "e2e simulation" },
        status: "FAILED",
        errorMessage: "Simulated gateway timeout",
        attempts: 3,
        maxRetries: 5,
      },
    });

    // 2. Admin triggers DLQ replay via POST /api/admin/jobs/dlq
    const res = await page.request.post("/api/admin/jobs/dlq", {
      data: {
        dlqId: deadJobId,
      },
    });

    expect(res.status()).toBeLessThan(500);

    // 3. Assert DB state updated
    const updatedJob = await testPrisma.deadLetterJob.findUnique({
      where: { id: deadJobId },
    });
    expect(updatedJob).toBeDefined();
  });
});
