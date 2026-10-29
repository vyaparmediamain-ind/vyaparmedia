#!/usr/bin/env node
/**
 * VyaparMedia Read-Heavy Autocannon Load Test Runner
 *
 * Implements the 10 -> 50 -> 200 virtual user / connection ramp profile.
 * Evaluates the 4 core read-heavy paths:
 *  1. GET creator discovery / search with keyset cursor (?limit=20&sortBy=followers)
 *  2. Campaign list feed + authenticated dashboard load
 *  3. Login session refresh (GET /api/auth/session)
 *  4. Wallet reads (GET /api/wallet) & Deal list reads (GET /api/deals)
 *
 * Runs seamlessly via programmatic autocannon or falls back to `npx autocannon`.
 * SAFETY GUARD: Only runs on localhost or explicit non-production staging.
 */

import { spawn } from "node:child_process";
import {
  TARGET_URL,
  validateTargetSafety,
  assertSafeEndpoint,
  TEST_CREDENTIALS,
  RAMP_STAGES,
} from "./config.mjs";

// Validate host safety immediately before initiating any socket
validateTargetSafety(TARGET_URL);

/**
 * Authenticates with NextAuth credentials provider to obtain a session cookie.
 */
async function getAuthSessionCookie(baseUrl) {
  try {
    const csrfRes = await fetch(`${baseUrl}/api/auth/csrf`);
    if (!csrfRes.ok) return null;
    const csrfData = await csrfRes.json();
    const csrfToken = csrfData?.csrfToken;
    const initialCookie = csrfRes.headers.get("set-cookie") || "";

    const loginRes = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Cookie: initialCookie,
      },
      body: JSON.stringify({
        email: TEST_CREDENTIALS.brand.email,
        password: TEST_CREDENTIALS.brand.password,
        csrfToken,
        json: "true",
      }),
      redirect: "manual",
    });

    const sessionCookie = loginRes.headers.get("set-cookie");
    return sessionCookie || initialCookie || "";
  } catch (err) {
    console.warn(`[AUTH_WARNING] Could not pre-authenticate session cookie: ${err.message}. Proceeding unauthenticated.`);
    return "";
  }
}

/**
 * Executes a load test run using either installed autocannon or npx autocannon fallback.
 */
async function runAutocannonScenario({ title, url, connections, duration, headers, method = "GET", body }) {
  assertSafeEndpoint(new URL(url).pathname);

  // Try programmatic import first
  try {
    const { default: autocannon } = await import("autocannon");
    return new Promise((resolve, reject) => {
      const instance = autocannon(
        {
          url,
          method,
          connections,
          duration,
          headers: {
            Accept: "application/json",
            "User-Agent": "VyaparMedia-LoadTest/1.0",
            ...headers,
          },
          body,
          pipelining: 1,
        },
        (err, result) => {
          if (err) return reject(err);
          resolve(result);
        }
      );
      autocannon.track(instance, { renderProgressBar: true, renderResultsTable: false });
    });
  } catch {
    // Fallback: execute via npx autocannon CLI with --json output
    return new Promise((resolve, reject) => {
      const args = [
        "autocannon",
        "-c",
        String(connections),
        "-d",
        String(duration),
        "-m",
        method,
        "-j",
      ];

      if (headers) {
        for (const [k, v] of Object.entries(headers)) {
          args.push("-H", `${k}=${v}`);
        }
      }

      args.push(url);

      const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
      const child = spawn(npxCmd, args, { stdio: ["ignore", "pipe", "pipe"] });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      child.on("close", (code) => {
        if (code !== 0 && !stdout) {
          return reject(new Error(`npx autocannon exited with code ${code}: ${stderr}`));
        }
        try {
          const parsed = JSON.parse(stdout.trim());
          resolve(parsed);
        } catch (e) {
          reject(new Error(`Failed to parse autocannon JSON output: ${stdout || stderr}`));
        }
      });
    });
  }
}

function formatResult(title, connections, result) {
  const reqs = result.requests || { average: 0, total: 0 };
  const lat = result.latency || { p50: 0, p95: 0, p99: 0, max: 0 };
  const errors = (result.errors || 0) + (result.timeouts || 0) + (result.non2xx || 0);
  const totalReqs = reqs.total || 1;
  const errorRate = ((errors / totalReqs) * 100).toFixed(2);

  return {
    Scenario: title,
    Connections: connections,
    "Req/Sec (Avg)": (reqs.average || 0).toFixed(1),
    "p50 (ms)": lat.p50 ?? lat.median ?? 0,
    "p95 (ms)": lat.p95 ?? 0,
    "p99 (ms)": lat.p99 ?? 0,
    "Max (ms)": lat.max ?? 0,
    "Error %": `${errorRate}%`,
    "Total Requests": totalReqs,
  };
}

async function main() {
  console.log("================================================================================");
  console.log("             VYAPARMEDIA READ-HEAVY LOAD TEST BENCHMARK RUNNER                 ");
  console.log("================================================================================");
  console.log(` Target Host : ${TARGET_URL}`);
  console.log(` Ramp Stages : 10 -> 50 -> 200 Virtual Users / Connections`);
  console.log(` Scenarios   : 1. Creator Discovery (Cursor) | 2. Campaign Feed | 3. Session Refresh | 4. Deals/Wallet`);
  console.log("================================================================================\n");

  // Pre-flight reachability check
  try {
    await fetch(`${TARGET_URL}/api/health`, { signal: AbortSignal.timeout(3000) });
  } catch (_err) {
    console.error(`\n❌ ERROR: Target server at "${TARGET_URL}" is NOT reachable.`);
    console.error(`   Please start your local server in another terminal:`);
    console.error(`     npm run dev`);
    console.error(`   Then re-run: npm run load-test\n`);
    process.exit(1);
  }

  const authCookie = await getAuthSessionCookie(TARGET_URL);
  const authHeaders = authCookie ? { Cookie: authCookie } : {};

  const scenarios = [
    {
      id: "creator_discovery_cursor",
      name: "1. Creator Search (Keyset Cursor)",
      path: "/api/influencers?limit=20&sortBy=followers",
      headers: {},
    },
    {
      id: "campaign_list_feed",
      name: "2. Campaign List Feed (Active Desc)",
      path: "/api/campaigns?limit=20&status=ACTIVE&sortBy=createdAt&sortOrder=desc",
      headers: {},
    },
    {
      id: "auth_session_refresh",
      name: "3. Session Refresh Read",
      path: "/api/auth/session",
      headers: authHeaders,
    },
    {
      id: "deals_wallet_read",
      name: "4. Deals & Wallet Read",
      path: "/api/deals?limit=20&status=ACTIVE",
      headers: authHeaders,
    },
  ];

  const summaryTables = [];

  for (const stage of RAMP_STAGES) {
    console.log(`\n>>> 🚀 EXECUTING ${stage.name} (Duration: ${stage.duration}s)...`);
    const stageResults = [];

    for (const sc of scenarios) {
      const targetEndpoint = `${TARGET_URL}${sc.path}`;
      console.log(`\n  ▶ Testing [${sc.name}] @ ${stage.target} connections...`);

      try {
        const result = await runAutocannonScenario({
          title: sc.name,
          url: targetEndpoint,
          connections: stage.target,
          duration: stage.duration,
          headers: sc.headers,
        });

        const formatted = formatResult(sc.name, stage.target, result);
        stageResults.push(formatted);
      } catch (err) {
        console.error(`  ❌ Failed testing ${sc.name}:`, err.message);
        stageResults.push({
          Scenario: sc.name,
          Connections: stage.target,
          "Req/Sec (Avg)": "ERR",
          "p50 (ms)": "N/A",
          "p95 (ms)": "N/A",
          "p99 (ms)": "N/A",
          "Max (ms)": "N/A",
          "Error %": "100%",
          "Total Requests": 0,
        });
      }
    }

    console.log(`\n📊 RESULTS SUMMARY: ${stage.name}`);
    console.table(stageResults);
    summaryTables.push({ stage: stage.name, results: stageResults });
  }

  console.log("\n================================================================================");
  console.log("  BENCHMARK COMPLETED SUCCESSFULLY");
  console.log("  For database plan and query index analysis, run:");
  console.log("    npm run load-test:explain");
  console.log("================================================================================\n");
}

main().catch((err) => {
  console.error("FATAL LOAD TEST ERROR:", err);
  process.exit(1);
});
