/**
 * Client-Route Connection AST Auditor
 * Scans src/ for all client call sites (fetch, useSWR, api-client, sendBeacon)
 * Resolves each call to a route and method, detecting broken calls, dead routes, and method mismatches.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { generateRouteManifest } from "./route-manifest";

export interface CallSite {
  file: string;
  line: number;
  rawExpression: string;
  normalizedRoute: string | null;
  method: string;
  sourceType: "fetch" | "swr" | "api-client" | "beacon" | "server-action";
  matchedRoute: boolean;
  notes?: string;
}

export interface MethodMismatch {
  file: string;
  line: number;
  route: string;
  calledMethod: string;
  availableMethods: string[];
}

export interface CandidateDeadRoute {
  route: string;
  file: string;
  methods: string[];
  reason: string;
}

export interface EndpointInvestigation {
  endpoint: string;
  status: "VIRTUAL_SWR_KEY" | "UNREFERENCED_ROUTE" | "UNRESOLVED_CALL" | "VERIFIED";
  description: string;
  details: Record<string, unknown>;
}

export interface ConnectionsResult {
  generatedAt: string;
  totalCallSites: number;
  brokenCallSitesCount: number;
  candidateDeadRoutesCount: number;
  methodMismatchesCount: number;
  callSites: CallSite[];
  brokenCallSites: CallSite[];
  candidateDeadRoutes: CandidateDeadRoute[];
  methodMismatches: MethodMismatch[];
  investigations: Record<string, EndpointInvestigation>;
}

// Explicit allow-list for routes expected to be invoked by cron, webhooks, auth redirects, QStash jobs, or external/admin links
export const EXPLICIT_ROUTE_ALLOW_LIST: Record<string, string> = {
  "/api/health": "Automated infrastructure liveness and readiness probe",
  "/api/metrics": "Prometheus/internal performance metric scraper endpoint",
  "/api/upload/confirm": "Post-upload magic byte & SVG sanitization verification hook for S3/R2 direct uploads",
  "/api/verify-report/[id]": "Public QR-code verification link for immutable campaign audit certificates",
  "/api/reports/creator/[id]/market-range": "Direct creator/brand market range report endpoint",
  "/api/campaigns/[id]/reports/performance": "Direct PDF/CSV download link for brand campaign performance",
  "/api/campaigns/[id]/finance/export": "Brand campaign escrow ledger and financial transactions CSV export",
  "/api/admin/campaigns/[id]/reports/governance": "Admin governance compliance report download endpoint",
  "/api/admin/campaigns/[id]": "Administrative detailed campaign audit and risk inspection API",
  "/api/admin/financial": "Admin aggregated financial overview and ledger inspection",
  "/api/admin/reports/gst-tcs": "Admin statutory GST TCS tax compliance filing export",
  "/api/admin/reports/revenue": "Admin monthly revenue ledger report export",
  "/api/admin/reports/tds": "Admin Section 194J/194M TDS filing tax report export",
  "/api/admin/users/[id]": "Administrative user detail, KYC override, and status modification API",
  "/api/analytics/brand/visibility": "Server-side aggregated brand visibility rollup endpoint",
  "/api/analytics/creator/visibility": "Server-side aggregated creator visibility rollup endpoint",
  "/api/blog/subscribe": "Public newsletter subscription link endpoint",
  "/api/blog/unsubscribe": "Public newsletter unsubscription link endpoint",
  "/api/blog/verify": "Public newsletter verification token endpoint",
  "/api/disputes/[id]": "Administrative dispute mediation and evidence inspection API",
  "/api/messages/stream": "Server-Sent Events (SSE) persistent streaming endpoint for realtime chat",
  "/api/reports/brand/spend": "Brand annual statutory spend and GST tax reconciliation export",
  "/api/reports/influencer/income": "Influencer annual statutory income and Section 194-O TDS tax reconciliation export",
};

export const ALLOW_LIST_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /^\/api\/cron\//, reason: "Scheduled background job triggered by QStash cron scheduler" },
  { pattern: /^\/api\/webhooks\//, reason: "Incoming third-party webhook from payment/carrier/messaging gateway" },
  { pattern: /^\/api\/payments\/webhook/, reason: "Incoming Razorpay payment webhook endpoint" },
  { pattern: /^\/api\/auth\//, reason: "Authentication provider callback, OAuth handshake, or session verification" },
  { pattern: /^\/api\/jobs\//, reason: "Asynchronous worker queue processor endpoint" },
  { pattern: /^\/api\/admin\/jobs\//, reason: "Administrative background job dispatcher and DLQ queue management" },
  { pattern: /^\/api\/compliance\//, reason: "Statutory India tax and compliance verification endpoint" },
];

export function getAllowListReason(routePath: string): string | null {
  if (EXPLICIT_ROUTE_ALLOW_LIST[routePath]) {
    return EXPLICIT_ROUTE_ALLOW_LIST[routePath];
  }
  for (const { pattern, reason } of ALLOW_LIST_PATTERNS) {
    if (pattern.test(routePath)) {
      return reason;
    }
  }
  return null;
}

export function isAllowListed(routePath: string): boolean {
  return getAllowListReason(routePath) !== null;
}

function normalizePath(p: string): string {
  return p.split(path.sep).join("/");
}

const EXCLUDED_SCAN_FILES = [
  /src\/app\/robots\./,
  /src\/app\/sitemap\./,
  /src\/lib\/csrf-exempt\./,
  /scripts\//,
];

function isScanExcluded(filePath: string): boolean {
  const norm = normalizePath(filePath);
  return EXCLUDED_SCAN_FILES.some((re) => re.test(norm));
}

function findSourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];

  function walk(current: string) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules" && entry.name !== ".next" && entry.name !== "tests") {
          walk(fullPath);
        }
      } else if (entry.isFile() && /\.(tsx|ts|jsx|js)$/.test(entry.name)) {
        // Skip route.ts files themselves from being treated as client callers
        if (!entry.name.startsWith("route.") && !isScanExcluded(fullPath)) {
          results.push(fullPath);
        }
      }
    }
  }

  walk(dir);
  return results;
}

/**
 * Normalizes template strings and string literals to route patterns.
 * e.g. `/api/campaigns/${id}` -> `/api/campaigns/[id]`
 * `/api/campaigns?${params}` -> `/api/campaigns`
 */
export function normalizeApiUrl(raw: string, knownRoutes: string[]): string | null {
  let cleaned = raw.trim();

  // Strip wrapping quotes or backticks if any
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
      (cleaned.startsWith("'") && cleaned.endsWith("'")) ||
      (cleaned.startsWith("`") && cleaned.endsWith("`"))) {
    cleaned = cleaned.slice(1, -1);
  }

  // If it's not starting with /api, return null unless relative api/
  if (cleaned.startsWith("api/")) {
    cleaned = "/" + cleaned;
  }
  if (!cleaned.startsWith("/api")) {
    return null;
  }

  // NextAuth catch-all routes mapping: /api/auth/session, /api/auth/csrf, etc.
  if (
    cleaned.startsWith("/api/auth/session") ||
    cleaned.startsWith("/api/auth/csrf") ||
    cleaned.startsWith("/api/auth/providers") ||
    cleaned.startsWith("/api/auth/signin") ||
    cleaned.startsWith("/api/auth/signout") ||
    cleaned.startsWith("/api/auth/callback/")
  ) {
    if (knownRoutes.includes("/api/auth/[...nextauth]")) {
      return "/api/auth/[...nextauth]";
    }
  }

  // Remove template query strings: ${qs ? ...}, ${queryParams...}, ${searchParams...}, ?${...}
  const qsIndex = cleaned.indexOf("${qs");
  if (qsIndex !== -1) cleaned = cleaned.substring(0, qsIndex);

  const qpIndex = cleaned.indexOf("${queryParams");
  if (qpIndex !== -1) cleaned = cleaned.substring(0, qpIndex);

  const spIndex = cleaned.indexOf("${searchParams");
  if (spIndex !== -1) cleaned = cleaned.substring(0, spIndex);

  const qbIndex = cleaned.indexOf("?${");
  if (qbIndex !== -1) cleaned = cleaned.substring(0, qbIndex);

  // Remove query string portion (?...)
  const queryIndex = cleaned.indexOf("?");
  if (queryIndex !== -1) {
    cleaned = cleaned.substring(0, queryIndex);
  }

  // Replace ${...} template placeholders with [id] or parameter placeholder
  // Handle /api/creator/${username} -> /api/creator/[username] or /api/creator/[id]
  let templatePattern = cleaned.replace(/\$\{.*?\}/g, "[id]");
  // Also clean up any accidental trailing slash unless root /api
  if (templatePattern.length > 4 && templatePattern.endsWith("/")) {
    templatePattern = templatePattern.slice(0, -1);
  }

  // Exact match first
  if (knownRoutes.includes(templatePattern)) {
    return templatePattern;
  }

  // Check fuzzy param matches: e.g. /api/campaigns/[id] matching /api/campaigns/[campaignId] or /api/campaigns/[id]
  // Normalize all dynamic segments in both to [param]
  const toWildcard = (r: string) => r.replace(/\[\w+\]/g, "[param]").replace(/\[\.\.\.\w+\]/g, "[...param]");
  const wildcardPattern = toWildcard(templatePattern);

  for (const known of knownRoutes) {
    if (toWildcard(known) === wildcardPattern) {
      return known;
    }
  }

  return templatePattern;
}

export function extractCallSitesFromFile(
  filePath: string,
  projectRoot: string,
  knownRoutes: string[]
): CallSite[] {
  const code = fs.readFileSync(filePath, "utf-8");
  const sourceFile = ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true);
  const relativeFile = normalizePath(path.relative(projectRoot, filePath));
  const sites: CallSite[] = [];

  function getLineNumber(pos: number): number {
    return sourceFile.getLineAndCharacterOfPosition(pos).line + 1;
  }

  function visit(node: ts.Node) {
    // 1. fetch(...) calls
    if (ts.isCallExpression(node)) {
      const exprText = node.expression.getText();

      // fetch("/api/...") or window.fetch(...)
      if (exprText === "fetch" || exprText === "window.fetch") {
        const firstArg = node.arguments[0];
        if (firstArg) {
          const rawUrl = firstArg.getText();
          let method = "GET";

          // Check options object (second arg)
          const secondArg = node.arguments[1];
          if (secondArg && ts.isObjectLiteralExpression(secondArg)) {
            for (const prop of secondArg.properties) {
              if (ts.isPropertyAssignment(prop) && prop.name.getText() === "method") {
                const methodText = prop.initializer.getText().replace(/['"`]/g, "").toUpperCase();
                if (methodText) method = methodText;
              }
            }
          }

          const normalized = normalizeApiUrl(rawUrl, knownRoutes);
          if (normalized) {
            sites.push({
              file: relativeFile,
              line: getLineNumber(node.getStart()),
              rawExpression: rawUrl,
              normalizedRoute: normalized,
              method,
              sourceType: "fetch",
              matchedRoute: knownRoutes.includes(normalized),
            });
          }
        }
      }

      // 2. navigator.sendBeacon("/api/...", data)
      if (exprText.includes("sendBeacon")) {
        const firstArg = node.arguments[0];
        if (firstArg) {
          const rawUrl = firstArg.getText();
          const normalized = normalizeApiUrl(rawUrl, knownRoutes);
          if (normalized) {
            sites.push({
              file: relativeFile,
              line: getLineNumber(node.getStart()),
              rawExpression: rawUrl,
              normalizedRoute: normalized,
              method: "POST",
              sourceType: "beacon",
              matchedRoute: knownRoutes.includes(normalized),
            });
          }
        }
      }

      // 3. SWR calls: useSWR("/api/...", ...), useSWRInfinite(getKey, ...)
      if (exprText === "useSWR" || exprText === "useSWRInfinite") {
        const firstArg = node.arguments[0];
        if (firstArg) {
          const rawArg = firstArg.getText();
          const normalized = normalizeApiUrl(rawArg, knownRoutes);
          if (normalized) {
            sites.push({
              file: relativeFile,
              line: getLineNumber(node.getStart()),
              rawExpression: rawArg,
              normalizedRoute: normalized,
              method: "GET",
              sourceType: "swr",
              matchedRoute: knownRoutes.includes(normalized),
            });
          }
        }
      }

      // 4. api-client calls: http.get("/api/..."), http.post, apiClient.get, fetcherWithSchema, or direct get/post/put/patch/del in api-client
      if (
        /^(http|apiClient|api)\.(get|post|put|patch|delete)$/.test(exprText) ||
        exprText === "fetcherWithSchema" ||
        /^(get|post|put|patch|del)$/.test(exprText)
      ) {
        let method = "GET";
        if (exprText.includes(".")) {
          const parts = exprText.split(".");
          if (parts.length === 2 && parts[1]) {
            method = parts[1].toUpperCase();
          }
        } else if (exprText === "del") {
          method = "DELETE";
        } else if (exprText === "post") {
          method = "POST";
        } else if (exprText === "put") {
          method = "PUT";
        } else if (exprText === "patch") {
          method = "PATCH";
        } else if (exprText === "get") {
          method = "GET";
        }

        const firstArg = node.arguments[0];
        if (firstArg) {
          const rawUrl = firstArg.getText();
          const normalized = normalizeApiUrl(rawUrl, knownRoutes);
          if (normalized) {
            sites.push({
              file: relativeFile,
              line: getLineNumber(node.getStart()),
              rawExpression: rawUrl,
              normalizedRoute: normalized,
              method,
              sourceType: "api-client",
              matchedRoute: knownRoutes.includes(normalized),
            });
          }
        }
      }
    }

    // 5. EventSource calls: new EventSource("/api/...")
    if (ts.isNewExpression(node)) {
      const exprText = node.expression.getText();
      if (exprText === "EventSource" || exprText.includes("EventSource")) {
        const firstArg = node.arguments?.[0];
        if (firstArg) {
          const rawUrl = firstArg.getText();
          const normalized = normalizeApiUrl(rawUrl, knownRoutes);
          if (normalized) {
            sites.push({
              file: relativeFile,
              line: getLineNumber(node.getStart()),
              rawExpression: rawUrl,
              normalizedRoute: normalized,
              method: "GET",
              sourceType: "fetch",
              matchedRoute: knownRoutes.includes(normalized),
            });
          }
        }
      }
    }

    // Check for string array SWR key returning `/api/discovery-feed`
    if (ts.isArrayLiteralExpression(node)) {
      const firstEl = node.elements[0];
      if (firstEl && (ts.isStringLiteral(firstEl) || ts.isNoSubstitutionTemplateLiteral(firstEl))) {
        const text = firstEl.text;
        if (text.startsWith("/api/")) {
          const normalized = normalizeApiUrl(text, knownRoutes);
          if (normalized) {
            // Check if inside SWR key or fetch
            sites.push({
              file: relativeFile,
              line: getLineNumber(node.getStart()),
              rawExpression: text,
              normalizedRoute: normalized,
              method: "GET",
              sourceType: "swr",
              matchedRoute: knownRoutes.includes(normalized),
              notes: "Array literal SWR key",
            });
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return sites;
}

export function analyzeConnections(rootDir?: string): ConnectionsResult {
  const projectRoot = rootDir || process.cwd();
  const manifest = generateRouteManifest(projectRoot);

  const knownRoutes = manifest.apiRoutes.map((r) => r.path);
  const routeMethodsMap = new Map<string, string[]>();
  for (const r of manifest.apiRoutes) {
    routeMethodsMap.set(r.path, r.methods);
  }

  const srcFiles = findSourceFiles(path.join(projectRoot, "src"));
  const allCallSites: CallSite[] = [];

  for (const file of srcFiles) {
    const sites = extractCallSitesFromFile(file, projectRoot, knownRoutes);
    allCallSites.push(...sites);
  }

  // Deduplicate identical call sites
  const uniqueCallSites: CallSite[] = [];
  const seenSites = new Set<string>();
  for (const site of allCallSites) {
    const key = `${site.file}:${site.line}:${site.method}:${site.normalizedRoute}`;
    if (!seenSites.has(key)) {
      seenSites.add(key);
      uniqueCallSites.push(site);
    }
  }

  // Identify broken call sites (calls with NO matching route)
  const brokenCallSites = uniqueCallSites.filter((site) => !site.matchedRoute);

  // Identify candidate dead routes (routes in routes.json with NO caller, excluding allow-list)
  const calledRoutePaths = new Set(uniqueCallSites.filter((s) => s.matchedRoute).map((s) => s.normalizedRoute));

  const candidateDeadRoutes: CandidateDeadRoute[] = [];
  for (const r of manifest.apiRoutes) {
    if (!calledRoutePaths.has(r.path)) {
      if (!isAllowListed(r.path)) {
        candidateDeadRoutes.push({
          route: r.path,
          file: r.file,
          methods: r.methods,
          reason: "Zero client call sites detected in src/ (not on allow-list)",
        });
      }
    }
  }

  // Method mismatches: route exists, but doesn't support the requested method
  const methodMismatches: MethodMismatch[] = [];
  for (const site of uniqueCallSites) {
    if (site.matchedRoute && site.normalizedRoute) {
      const supportedMethods = routeMethodsMap.get(site.normalizedRoute) || [];
      if (supportedMethods.length > 0 && !supportedMethods.includes(site.method)) {
        methodMismatches.push({
          file: site.file,
          line: site.line,
          route: site.normalizedRoute,
          calledMethod: site.method,
          availableMethods: supportedMethods,
        });
      }
    }
  }

  // Explicit investigations requested:
  // 1. /api/discovery-feed (DiscoveryFeed.tsx ~L150)
  // 2. /api/telemetry/event
  // 3. /api/upload/confirm
  const investigations: Record<string, EndpointInvestigation> = {
    "/api/discovery-feed": {
      endpoint: "/api/discovery-feed",
      status: "VIRTUAL_SWR_KEY",
      description:
        "Used as an SWR Infinite cache key in DiscoveryFeed.tsx (~L150). The custom fetcher (`fetchDiscoveryPage`) actually calls `/api/campaigns` or `/api/influencers` under the hood. No standalone `/api/discovery-feed` route exists or is required.",
      details: {
        file: "src/components/discovery/DiscoveryFeed.tsx",
        underlyingEndpoints: ["/api/campaigns", "/api/influencers"],
        fetcherFunction: "fetchDiscoveryPage",
        actionableRecommendation: "Harmless virtual cache key. Document in route matrix to prevent false-positive alarms.",
      },
    },
    "/api/telemetry/event": {
      endpoint: "/api/telemetry/event",
      status: "UNREFERENCED_ROUTE",
      description:
        "Unhardened duplicate endpoint removed. Telemetry ingestion consolidated into hardened `/api/telemetry/track` with 2KB stream cap and strict origin verification.",
      details: {
        routeFile: "src/app/api/telemetry/event/route.ts",
        actualClientEndpoint: "/api/telemetry/track",
        clientCaller: "src/components/analytics/PageViewTracker.tsx",
        actionableRecommendation: "Ingest strictly via hardened /api/telemetry/track.",
      },
    },
    "/api/upload/confirm": {
      endpoint: "/api/upload/confirm",
      status: "UNREFERENCED_ROUTE",
      description:
        "Route exists at `src/app/api/upload/confirm/route.ts` to perform post-upload magic-byte security scans on presigned S3/R2 uploads. Current frontend upload flow in ProfileTab.tsx uses direct `/api/upload` multipart stream.",
      details: {
        routeFile: "src/app/api/upload/confirm/route.ts",
        directUploadEndpoint: "/api/upload",
        presignEndpoint: "/api/upload/presign",
        actionableRecommendation: "Keep route intact as security post-verification hook for presigned uploads.",
      },
    },
  };

  return {
    generatedAt: new Date().toISOString(),
    totalCallSites: uniqueCallSites.length,
    brokenCallSitesCount: brokenCallSites.length,
    candidateDeadRoutesCount: candidateDeadRoutes.length,
    methodMismatchesCount: methodMismatches.length,
    callSites: uniqueCallSites,
    brokenCallSites,
    candidateDeadRoutes,
    methodMismatches,
    investigations,
  };
}

// Standalone execution
const isMain = process.argv[1] && (
  process.argv[1] === fileURLToPath(import.meta.url) ||
  process.argv[1].endsWith("connections.ts")
);

if (isMain) {
  const result = analyzeConnections();
  const outDir = path.join(process.cwd(), "docs/audit");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const outFile = path.join(outDir, "connections.json");
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2), "utf-8");
  console.log(`[connections] Audited ${result.totalCallSites} client call sites.`);
  console.log(`  - Broken calls: ${result.brokenCallSitesCount}`);
  console.log(`  - Candidate dead routes (excluding allow-list): ${result.candidateDeadRoutesCount}`);
  console.log(`  - Method mismatches: ${result.methodMismatchesCount}`);
  console.log(`  - Output: ${outFile}`);
}
