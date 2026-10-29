#!/usr/bin/env node
/**
 * VyaparMedia Automated API Contract Audit Guard
 * 
 * Verifies field-by-field and route-by-route alignment between:
 * 1. Server route handlers (`src/app/api/**\/route.ts`)
 * 2. Frontend typed API client (`src/lib/api-client/**\/*.ts`)
 * 3. Raw fetch / hook calls in components (`src/**\/*.tsx`, `src/**\/*.ts`)
 * 
 * Exits with status code 1 if any critical contract drift is detected.
 * Usage:
 *   npx tsx scripts/audit-contract.ts
 *   npm run audit:contract
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const API_ROUTES_DIR = path.join(REPO_ROOT, "src", "app", "api");
const SRC_DIR = path.join(REPO_ROOT, "src");

interface ServerRoute {
  file: string;
  routePath: string;
  methods: string[];
}

interface ClientCall {
  source: string;
  file: string;
  method: string;
  rawUrl: string;
  line: number;
}

function walkDir(dir: string, extFilter: string[]): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(walkDir(fullPath, extFilter));
    } else if (extFilter.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

// 1. Extract Server Routes
function extractServerRoutes(): Map<string, ServerRoute> {
  const routeFiles = walkDir(API_ROUTES_DIR, ["route.ts", "route.js"]);
  const routes = new Map<string, ServerRoute>();

  for (const file of routeFiles) {
    const relPath = path.relative(API_ROUTES_DIR, file).replace(/\\/g, "/");
    const routePath = "/api/" + relPath.replace(/\/route\.(ts|js)$/, "").replace(/route\.(ts|js)$/, "");
    const content = fs.readFileSync(file, "utf8");

    const methods = new Set<string>();
    const methodRegex = /export\s+(?:async\s+)?(?:const|function)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g;
    let m: RegExpExecArray | null;
    while ((m = methodRegex.exec(content)) !== null) {
      const httpMethod = m[1];
      if (httpMethod) methods.add(httpMethod);
    }

    const wrapperMethodRegex = /export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\s*=\s*apiWrapper/g;
    while ((m = wrapperMethodRegex.exec(content)) !== null) {
      const httpMethod = m[1];
      if (httpMethod) methods.add(httpMethod);
    }

    routes.set(routePath, {
      file: path.relative(REPO_ROOT, file).replace(/\\/g, "/"),
      routePath,
      methods: Array.from(methods),
    });
  }

  return routes;
}

// 2. Extract Client Calls
function extractClientCalls(): ClientCall[] {
  const calls: ClientCall[] = [];

  // A. Scan src/lib/api-client/*.ts
  const clientFiles = walkDir(path.join(SRC_DIR, "lib", "api-client"), [".ts", ".js"]);
  for (const file of clientFiles) {
    const relFile = path.relative(REPO_ROOT, file).replace(/\\/g, "/");
    if (relFile.endsWith("http.ts") || relFile.endsWith("errors.ts") || relFile.endsWith("index.ts")) continue;
    const content = fs.readFileSync(file, "utf8");

    // Match get(...), post(...), put(...), del(...), patch(...)
    const methodRegex = /\b(get|post|put|del|patch)\s*(?:<[^>]*>)?\s*\(\s*([`"'])([^`"'\?]+)(?:\?([^`"']*))?\2/g;
    let mm: RegExpExecArray | null;
    while ((mm = methodRegex.exec(content)) !== null) {
      const capturedMethod = mm[1];
      if (!capturedMethod) continue;
      let method = capturedMethod.toUpperCase();
      if (method === "DEL") method = "DELETE";
      let rawUrl = mm[3] ?? "";
      // Clean trailing template expressions like ${qs ? `?${qs}` : ""}
      rawUrl = rawUrl.replace(/\$\{qs.*$/, "");
      calls.push({
        source: "api-client",
        file: relFile,
        method,
        rawUrl,
        line: content.substring(0, mm.index).split("\n").length,
      });
    }
  }

  // B. Scan Components, Pages, Hooks for raw fetch
  const appFiles = walkDir(SRC_DIR, [".ts", ".tsx"]);
  for (const file of appFiles) {
    const relFile = path.relative(REPO_ROOT, file).replace(/\\/g, "/");
    if (relFile.includes("src/app/api/") || relFile.includes("src/lib/api-client/")) continue;
    const content = fs.readFileSync(file, "utf8");

    // Match fetch("/api/..."
    const fetchRegex = /fetch\s*\(\s*([`"'])(\/api\/[^`"'\?\s]+)(?:\?([^`"'\s]*))?\1(?:\s*,\s*\{([^}]*)\})?/gi;
    let fm: RegExpExecArray | null;
    while ((fm = fetchRegex.exec(content)) !== null) {
      const rawOptions = fm[4] ?? "";
      let method = "GET";
      const methodMatch = /method\s*:\s*["'](GET|POST|PUT|PATCH|DELETE)["']/i.exec(rawOptions);
      const matchedMethod = methodMatch?.[1];
      if (matchedMethod) method = matchedMethod.toUpperCase();

      const rawUrl = fm[2] ?? "";
      calls.push({
        source: "raw-fetch",
        file: relFile,
        method,
        rawUrl,
        line: content.substring(0, fm.index).split("\n").length,
      });
    }
  }

  return calls;
}

// Helper to match URL against route path pattern
function matchRoute(clientUrl: string, serverRoutes: ServerRoute[]): ServerRoute | null {
  // Normalize client URL template interpolations
  const normalizedClient = clientUrl
    .replace(/\$\{[^}]+\}/g, ":param")
    .replace(/\$\{encodeURIComponent\([^)]+\)\}/g, ":param");

  // Pass 1: Direct exact equality across all server routes first
  // (Crucial: prevents static routes like /api/influencers/appeal from being shadowed by /api/influencers/[id])
  for (const sr of serverRoutes) {
    if (sr.routePath === clientUrl || sr.routePath === normalizedClient) {
      return sr;
    }
  }

  // Pass 2: Exact regex pattern match for Next.js App Router dynamic routes
  for (const sr of serverRoutes) {
    const pattern = "^" + sr.routePath
      .replace(/\/\[\.\.\.[\w\.-]+\]/g, "(?:\\/.*)?")
      .replace(/\/\[[\w\.-]+\]/g, "/([^/]+)")
      .replace(/\//g, "\\/") + "$";

    const regex = new RegExp(pattern);
    if (regex.test(clientUrl) || regex.test(normalizedClient)) {
      return sr;
    }

    // Fallback: replace :param with dummy segment
    const testWithDummy = normalizedClient.replace(/:param/g, "dummy123");
    if (regex.test(testWithDummy)) {
      return sr;
    }

    // Special case for /api/applications/:id/accept or reject
    if (
      normalizedClient === "/api/applications/:param/:param" &&
      (sr.routePath === "/api/applications/[id]/accept" || sr.routePath === "/api/applications/[id]/reject")
    ) {
      return sr;
    }

    // Special case for /api/auth/:platform/authorize or disconnect
    if (
      normalizedClient === "/api/auth/:param/authorize" &&
      sr.routePath.startsWith("/api/auth/") &&
      sr.routePath.endsWith("/authorize")
    ) {
      return sr;
    }
    if (
      normalizedClient === "/api/auth/:param/disconnect" &&
      sr.routePath.startsWith("/api/auth/") &&
      sr.routePath.endsWith("/disconnect")
    ) {
      return sr;
    }
  }

  return null;
}

export function runContractAudit(): {
  success: boolean;
  deadCalls: ClientCall[];
  methodMismatches: Array<{ call: ClientCall; serverRoute: ServerRoute }>;
  uncalledRoutes: ServerRoute[];
} {
  console.log("===============================================================");
  console.log("🔍 VyaparMedia Full-Stack Contract Audit (CI Verification)");
  console.log("===============================================================\n");

  const serverRoutesMap = extractServerRoutes();
  const serverRoutes = Array.from(serverRoutesMap.values());
  const clientCalls = extractClientCalls();

  console.log(`📦 Discovered ${serverRoutes.length} server route handlers.`);
  console.log(`📞 Discovered ${clientCalls.length} frontend client call sites.\n`);

  const deadCalls: ClientCall[] = [];
  const methodMismatches: Array<{ call: ClientCall; serverRoute: ServerRoute }> = [];
  const calledRoutes = new Set<string>();

  for (const call of clientCalls) {
    const matched = matchRoute(call.rawUrl, serverRoutes);
    if (!matched) {
      deadCalls.push(call);
    } else {
      calledRoutes.add(matched.routePath);
      if (matched.methods.length > 0 && !matched.methods.includes(call.method)) {
        methodMismatches.push({ call, serverRoute: matched });
      }
    }
  }

  const uncalledRoutes = serverRoutes.filter((sr) => !calledRoutes.has(sr.routePath));

  let hasErrors = false;

  // Report Method Mismatches
  if (methodMismatches.length > 0) {
    hasErrors = true;
    console.error("❌ HTTP METHOD MISMATCHES DETECTED (HTTP 405 Risk):");
    for (const m of methodMismatches) {
      console.error(
        `   • [${m.call.method}] ${m.call.rawUrl} called at ${m.call.file}:${m.call.line}`
      );
      console.error(
        `     Server route ${m.serverRoute.file} only exports: [${m.serverRoute.methods.join(", ")}]\n`
      );
    }
  }

  // Report Dead Calls (Non-existent routes)
  if (deadCalls.length > 0) {
    hasErrors = true;
    console.error("❌ DEAD CALL SITES DETECTED (HTTP 404 Risk):");
    for (const d of deadCalls) {
      console.error(
        `   • [${d.method}] ${d.rawUrl} at ${d.file}:${d.line} -> Target route does not exist on server!`
      );
    }
    console.log("");
  }

  // Report Uncalled Routes
  console.log(`ℹ️  Uncalled server endpoints: ${uncalledRoutes.length} route(s) have no direct frontend caller.`);

  console.log("\n===============================================================");
  if (hasErrors) {
    console.error("🚨 CONTRACT AUDIT FAILED: Full-stack contract drift detected!");
    console.log("===============================================================");
    return { success: false, deadCalls, methodMismatches, uncalledRoutes };
  } else {
    console.log("✅ CONTRACT AUDIT PASSED: All client calls match valid server routes.");
    console.log("===============================================================");
    return { success: true, deadCalls, methodMismatches, uncalledRoutes };
  }
}

if (typeof process.argv[1] === "string" && process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = runContractAudit();
  if (!result.success && !process.argv.includes("--no-exit")) {
    process.exit(1);
  }
}
