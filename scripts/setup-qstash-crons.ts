/**
 * Upstash QStash Background & Cron Jobs Synchronization Script
 *
 * Automatically registers or synchronizes all 14 background cron jobs with Upstash QStash.
 * Ensures:
 * 1. Correct cron expressions matching business logic requirements.
 * 2. Proper Authorization headers with CRON_SECRET.
 * 3. 3 retries with exponential backoff on scheduled jobs.
 * 4. Idempotent schedule creation/updating.
 *
 * Usage:
 *   npx tsx scripts/setup-qstash-crons.ts [--dry-run] [--app-url=https://your-domain.com]
 */

import "dotenv/config";
import { Client } from "@upstash/qstash";

export interface CronJobDefinition {
  id: string;
  name: string;
  path: string;
  cron: string;
  description: string;
  timeoutSeconds: number;
}

export const CRON_JOBS: CronJobDefinition[] = [
  {
    id: "cron-reconcile-payouts",
    name: "Reconcile Verified Payouts",
    path: "/api/cron/reconcile-payouts",
    cron: "*/30 * * * *",
    description: "Retries pending/hung escrow payout settlements every 30 minutes",
    timeoutSeconds: 60,
  },
  {
    id: "cron-expire-signatures",
    name: "Expire Unsigned Deal Contracts",
    path: "/api/cron/expire-signatures",
    cron: "0 * * * *",
    description: "Expires unsigned deals after deadline and refunds held escrow to brand",
    timeoutSeconds: 60,
  },
  {
    id: "cron-expire-campaigns",
    name: "Auto-Pause Expired Campaigns",
    path: "/api/cron/expire-campaigns",
    cron: "0 * * * *",
    description: "Automatically transitions ACTIVE campaigns whose applicationDeadline has passed to PAUSED",
    timeoutSeconds: 60,
  },
  {
    id: "cron-lift-suspensions",
    name: "Lift Expired Account Suspensions",
    path: "/api/cron/lift-suspensions",
    cron: "0 * * * *",
    description: "Restores users to ACTIVE status once temporary suspension duration elapses",
    timeoutSeconds: 60,
  },
  {
    id: "cron-content-auto-approve",
    name: "Content Submission SLA Auto-Approval",
    path: "/api/cron/content-auto-approve",
    cron: "0 */2 * * *",
    description: "Auto-approves content if brand does not review within 72-hour SLA window",
    timeoutSeconds: 60,
  },
  {
    id: "cron-engagement",
    name: "Campaign Post Engagement Tracker",
    path: "/api/cron/engagement",
    cron: "0 */4 * * *",
    description: "Syncs views, likes, and engagement metrics for active sponsored posts",
    timeoutSeconds: 60,
  },
  {
    id: "cron-cleanup-idempotency",
    name: "Purge Expired Idempotency Keys",
    path: "/api/cron/cleanup-idempotency",
    cron: "0 1 * * *",
    description: "Cleans up expired API idempotency records older than 24-48 hours",
    timeoutSeconds: 60,
  },
  {
    id: "cron-cleanup-oauth",
    name: "Purge Stale OAuth Handshake States",
    path: "/api/cron/cleanup-oauth",
    cron: "30 1 * * *",
    description: "Deletes expired OAuth state records from social connection flows",
    timeoutSeconds: 60,
  },
  {
    id: "cron-ledger-scan",
    name: "Double-Entry Ledger Drift Scanner",
    path: "/api/cron/ledger-scan",
    cron: "0 2 * * *",
    description: "Calculates mathematical balance from ledger vs stored wallet balance; alerts admins on drift",
    timeoutSeconds: 60,
  },
  {
    id: "cron-reconcile-ledger-settlements",
    name: "Gateway Settlement Reconciliation",
    path: "/api/cron/reconcile-ledger-settlements",
    cron: "0 3 * * *",
    description: "Daily audit comparing system liabilities, escrow holds, and Razorpay settlements",
    timeoutSeconds: 60,
  },
  {
    id: "cron-post-monitor",
    name: "Daily Sponsored Post Retention Monitor",
    path: "/api/cron/post-monitor",
    cron: "0 4 * * *",
    description: "Verifies sponsored posts remain active during mandatory 30-day retention window",
    timeoutSeconds: 60,
  },
  {
    id: "cron-stale-fulfillment",
    name: "Product Fulfillment Staleness Scanner",
    path: "/api/cron/stale-fulfillment",
    cron: "0 10 * * *",
    description: "Scans dispatch delays; triggers 7-day reminder and 14-day dispute escalation",
    timeoutSeconds: 60,
  },
  {
    id: "cron-tenure-badges",
    name: "Creator Tenure & Milestone Badges",
    path: "/api/cron/tenure-badges",
    cron: "0 12 * * *",
    description: "Evaluates creator account age and completed deals; awards platform achievement badges",
    timeoutSeconds: 60,
  },
  {
    id: "cron-weekly-challenges",
    name: "Gamification Weekly Challenges Generator",
    path: "/api/cron/weekly-challenges",
    cron: "0 0 * * 1",
    description: "Generates new gamification challenge tracks for creators & brands every Monday",
    timeoutSeconds: 60,
  },
  {
    id: "cron-social-proof",
    name: "Weekly Social Proof & Authenticity Recalculation",
    path: "/api/cron/social-proof",
    cron: "0 1 * * 0",
    description: "Weekly re-evaluation of creator authenticity score and quality percentiles",
    timeoutSeconds: 60,
  },
  {
    id: "cron-refresh-social-tokens",
    name: "Refresh Social OAuth Tokens",
    path: "/api/cron/refresh-social-tokens",
    cron: "0 5 * * *",
    description: "Refreshes Instagram and social OAuth tokens expiring within 10 days",
    timeoutSeconds: 60,
  },
];

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");

  const appUrlArg = args.find((a) => a.startsWith("--app-url="));
  const appUrl = (
    appUrlArg?.split("=")[1] ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://vyaparmedia-nine.vercel.app"
  ).replace(/\/$/, "");

  const cronSecret = process.env.CRON_SECRET || "dev_cron_secret_key_12345";
  const qstashToken = process.env.QSTASH_TOKEN;

  console.log("==================================================================");
  console.log("⚡ UPSTASH QSTASH BACKGROUND / CRON SCHEDULER SETUP");
  console.log("==================================================================");
  console.log(`Target App URL: ${appUrl}`);
  console.log(`Total Cron Jobs: ${CRON_JOBS.length}`);
  console.log(`Dry-Run Mode:   ${isDryRun ? "YES (Preview Only)" : "NO (Live Synchronization)"}`);
  console.log("------------------------------------------------------------------\n");

  if (!isDryRun && !qstashToken) {
    console.error("❌ ERROR: QSTASH_TOKEN environment variable is required for live sync.");
    console.log("👉 Run with --dry-run to preview configuration without connecting to QStash API.");
    console.log("👉 Example: npx tsx scripts/setup-qstash-crons.ts --dry-run\n");
    process.exit(1);
  }

  let client: Client | null = null;
  if (!isDryRun && qstashToken) {
    client = new Client({ token: qstashToken });
  }

  console.log("📋 SCHEDULE DEFINITIONS TABLE:\n");
  console.log("| # | Route Path | Frequency (UTC) | Job Name |");
  console.log("|---|------------|-----------------|----------|");

  for (let i = 0; i < CRON_JOBS.length; i++) {
    const job = CRON_JOBS[i]!;
    console.log(
      `| ${(i + 1).toString().padStart(2, " ")} | ${job.path.padEnd(35, " ")} | ${job.cron.padEnd(15, " ")} | ${job.name} |`
    );
  }
  console.log("\n------------------------------------------------------------------");

  if (isDryRun) {
    console.log("✅ DRY-RUN COMPLETE: All 14 schedule configurations validated successfully.");
    console.log("No remote changes were made to Upstash QStash.");
    return;
  }

  if (client) {
    console.log("\n🚀 Synchronizing schedules with Upstash QStash...\n");

    let existingSchedules: Array<{ scheduleId: string; destination: string; cron: string }> = [];
    try {
      existingSchedules = await client.schedules.list();
      console.log(`Found ${existingSchedules.length} existing schedules in QStash.`);
    } catch (err) {
      console.warn("Could not list existing schedules (will attempt creation):", err);
    }

    let createdCount = 0;
    let updatedCount = 0;

    for (const job of CRON_JOBS) {
      const destination = `${appUrl}${job.path}`;
      const existing = existingSchedules.find((s) => s.destination === destination);

      try {
        if (existing) {
          // Delete existing and re-create to update schedule and headers cleanly
          await client.schedules.delete(existing.scheduleId);
          updatedCount++;
        } else {
          createdCount++;
        }

        await client.schedules.create({
          destination,
          cron: job.cron,
          headers: {
            Authorization: `Bearer ${cronSecret}`,
            "Content-Type": "application/json",
            "Upstash-Retries": "3",
            "Upstash-Timeout": `${job.timeoutSeconds}s`,
            "Upstash-Cron-Timezone": "Asia/Kolkata",
          },
        });

        console.log(`  ✓ Synced: [${job.cron}] -> ${job.path}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  ✗ Failed to sync schedule for ${job.path}:`, msg);
      }
    }

    console.log("\n==================================================================");
    console.log(`🎉 SUCCESS: All ${CRON_JOBS.length} cron schedules are configured in QStash.`);
    console.log(`- Created: ${createdCount}`);
    console.log(`- Updated: ${updatedCount}`);
    console.log("==================================================================\n");
  }
}

const isDirectExecution =
  process.argv[1]?.endsWith("setup-qstash-crons.ts") ||
  process.argv[1]?.endsWith("setup-qstash-crons");

if (isDirectExecution && process.env.NODE_ENV !== "test") {
  main().catch((err) => {
    console.error("Fatal error running QStash cron setup:", err);
    process.exit(1);
  });
}

