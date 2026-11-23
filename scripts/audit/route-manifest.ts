/**
 * Route Manifest AST Generator
 * Scans src/app for all route.ts (API endpoints) and page.tsx (Pages).
 * Uses TypeScript AST to extract HTTP methods, apiWrapper options, and auth enforcement.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

export interface ApiAuthOptions {
  requireAuth: boolean;
  requireAdmin: boolean;
  requireBrand: boolean;
  requireInfluencer: boolean;
  requirePermission: string | null;
  rateBucket: string | null;
  validateSchemas: {
    body?: string;
    query?: string;
    params?: string;
  };
  skipCsrf: boolean;
  maxBodySize?: number | undefined;
}

export interface ApiRouteInfo {
  path: string;
  file: string;
  type: "api";
  methods: string[];
  authOptions: Record<string, ApiAuthOptions>; // method -> options
  serverActions: string[];
}

export interface PageRouteInfo {
  path: string;
  file: string;
  type: "page";
  isClientComponent: boolean;
  authGuard: string | null;
  serverActions: string[];
}

export interface RouteManifestResult {
  generatedAt: string;
  totalApiRoutes: number;
  totalPageRoutes: number;
  apiRoutes: ApiRouteInfo[];
  pageRoutes: PageRouteInfo[];
}

const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]);

function normalizePath(p: string): string {
  return p.split(path.sep).join("/");
}

function findFiles(dir: string, pattern: RegExp): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];

  function walk(current: string) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules" && entry.name !== ".next") {
          walk(fullPath);
        }
      } else if (entry.isFile() && pattern.test(entry.name)) {
        results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results;
}

function extractObjectLiteralProperties(objNode: ts.ObjectLiteralExpression): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const prop of objNode.properties) {
    if (ts.isPropertyAssignment(prop)) {
      const name = prop.name.getText();
      const init = prop.initializer;

      if (init.kind === ts.SyntaxKind.TrueKeyword) {
        result[name] = true;
      } else if (init.kind === ts.SyntaxKind.FalseKeyword) {
        result[name] = false;
      } else if (ts.isNumericLiteral(init)) {
        result[name] = Number(init.text);
      } else if (ts.isStringLiteral(init)) {
        result[name] = init.text;
      } else if (ts.isObjectLiteralExpression(init)) {
        result[name] = extractObjectLiteralProperties(init);
      } else if (ts.isPropertyAccessExpression(init)) {
        result[name] = init.getText();
      } else if (ts.isIdentifier(init)) {
        result[name] = init.text;
      } else {
        result[name] = init.getText();
      }
    }
  }

  return result;
}

interface RawOptions {
  requireAuth?: boolean;
  requireAdmin?: boolean;
  requireBrand?: boolean;
  requireInfluencer?: boolean;
  requirePermission?: string;
  userRateLimit?: { bucket?: string };
  rateLimit?: string | { limit?: number; window?: number };
  validate?: { body?: string; query?: string; params?: string };
  skipCsrf?: boolean;
  maxBodySize?: number;
}

function parseApiAuthOptions(raw?: Record<string, unknown>): ApiAuthOptions {
  const optionsObj = (raw || {}) as RawOptions;
  if (!raw) {
    return {
      requireAuth: false,
      requireAdmin: false,
      requireBrand: false,
      requireInfluencer: false,
      requirePermission: null,
      rateBucket: null,
      validateSchemas: {},
      skipCsrf: false,
    };
  }

  let rateBucket: string | null = null;
  if (optionsObj.userRateLimit?.bucket) {
    rateBucket = String(optionsObj.userRateLimit.bucket);
  } else if (optionsObj.rateLimit) {
    rateBucket = typeof optionsObj.rateLimit === "string" ? optionsObj.rateLimit : "CUSTOM";
  }

  const validateSchemas: { body?: string; query?: string; params?: string } = {};
  if (optionsObj.validate && typeof optionsObj.validate === "object") {
    if (optionsObj.validate.body) validateSchemas.body = String(optionsObj.validate.body);
    if (optionsObj.validate.query) validateSchemas.query = String(optionsObj.validate.query);
    if (optionsObj.validate.params) validateSchemas.params = String(optionsObj.validate.params);
  }

  return {
    requireAuth: Boolean(optionsObj.requireAuth || optionsObj.requireAdmin || optionsObj.requireBrand || optionsObj.requireInfluencer),
    requireAdmin: Boolean(optionsObj.requireAdmin),
    requireBrand: Boolean(optionsObj.requireBrand),
    requireInfluencer: Boolean(optionsObj.requireInfluencer),
    requirePermission: optionsObj.requirePermission ? String(optionsObj.requirePermission) : null,
    rateBucket,
    validateSchemas,
    skipCsrf: Boolean(optionsObj.skipCsrf),
    maxBodySize: typeof optionsObj.maxBodySize === "number" ? optionsObj.maxBodySize : undefined,
  };
}

export function analyzeApiRoute(filePath: string, projectRoot: string): ApiRouteInfo {
  const code = fs.readFileSync(filePath, "utf-8");
  const sourceFile = ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true);

  const relativeFile = normalizePath(path.relative(projectRoot, filePath));
  // Convert src/app/api/.../route.ts to /api/...
  const apiIndex = relativeFile.indexOf("src/app/api");
  let routePath = "/api";
  if (apiIndex !== -1) {
    const sub = relativeFile.slice(apiIndex + "src/app".length);
    routePath = sub.replace(/\/route\.(ts|js|tsx)$/, "");
  }

  const methods: string[] = [];
  const authOptions: Record<string, ApiAuthOptions> = {};
  const serverActions: string[] = [];

  // Look for exported HTTP methods and apiWrapper calls
  ts.forEachChild(sourceFile, (node) => {
    // Check for 'export const GET = apiWrapper(...)'
    if (ts.isVariableStatement(node) && node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          const name = decl.name.text;
          if (HTTP_METHODS.has(name)) {
            methods.push(name);
            let opts: ApiAuthOptions = parseApiAuthOptions();

            if (decl.initializer && ts.isCallExpression(decl.initializer)) {
              const callText = decl.initializer.expression.getText();
              if (callText.includes("apiWrapper")) {
                const args = decl.initializer.arguments;
                // apiWrapper(handler, options)
                if (args.length >= 2 && ts.isObjectLiteralExpression(args[1]!)) {
                  opts = parseApiAuthOptions(extractObjectLiteralProperties(args[1]!));
                }
              }
            }
            authOptions[name] = opts;
          }
        }
      }
    }

    // Check for 'export async function GET(...) { ... }'
    if (ts.isFunctionDeclaration(node) && node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
      const name = node.name?.text;
      if (name && HTTP_METHODS.has(name)) {
        methods.push(name);
        authOptions[name] = parseApiAuthOptions();
      }
    }

    // Check for server actions ('use server' inside function or at top)
    if (ts.isFunctionDeclaration(node) && node.name?.text) {
      const fnBody = node.body?.getText() || "";
      if (fnBody.includes('"use server"') || fnBody.includes("'use server'")) {
        serverActions.push(node.name.text);
      }
    }
  });

  return {
    path: routePath,
    file: relativeFile,
    type: "api",
    methods: Array.from(new Set(methods)).sort(),
    authOptions,
    serverActions,
  };
}

export function analyzePageRoute(filePath: string, projectRoot: string): PageRouteInfo {
  const code = fs.readFileSync(filePath, "utf-8");
  const sourceFile = ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true);

  const relativeFile = normalizePath(path.relative(projectRoot, filePath));
  const appIndex = relativeFile.indexOf("src/app");
  let pagePath = "/";
  if (appIndex !== -1) {
    const sub = relativeFile.slice(appIndex + "src/app".length);
    pagePath = sub.replace(/\/page\.(tsx|jsx|js|ts)$/, "");
    if (!pagePath || pagePath === "") pagePath = "/";
  }

  const isClientComponent = code.includes('"use client"') || code.includes("'use client'");

  let authGuard: string | null = null;
  if (code.includes("requireActiveAdmin") || code.includes("requireAdmin")) {
    authGuard = "requireActiveAdmin";
  } else if (code.includes("requireBrand")) {
    authGuard = "requireBrand";
  } else if (code.includes("requireInfluencer")) {
    authGuard = "requireInfluencer";
  } else if (code.includes("auth()") || code.includes("getServerSession")) {
    authGuard = "auth()";
  } else if (pagePath.startsWith("/admin")) {
    authGuard = "admin-layout";
  } else if (pagePath.startsWith("/dashboard")) {
    authGuard = "dashboard-layout";
  }

  const serverActions: string[] = [];
  ts.forEachChild(sourceFile, (node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text) {
      const body = node.body?.getText() || "";
      if (body.includes('"use server"') || body.includes("'use server'")) {
        serverActions.push(node.name.text);
      }
    }
  });

  return {
    path: pagePath,
    file: relativeFile,
    type: "page",
    isClientComponent,
    authGuard,
    serverActions,
  };
}

export function generateRouteManifest(rootDir?: string): RouteManifestResult {
  const projectRoot = rootDir || process.cwd();
  const apiRouteFiles = findFiles(path.join(projectRoot, "src/app/api"), /^route\.(ts|js|tsx)$/);
  const pageRouteFiles = findFiles(path.join(projectRoot, "src/app"), /^page\.(tsx|jsx|js|ts)$/);

  const apiRoutes = apiRouteFiles.map((file) => analyzeApiRoute(file, projectRoot)).sort((a, b) => a.path.localeCompare(b.path));
  const pageRoutes = pageRouteFiles.map((file) => analyzePageRoute(file, projectRoot)).sort((a, b) => a.path.localeCompare(b.path));

  return {
    generatedAt: new Date().toISOString(),
    totalApiRoutes: apiRoutes.length,
    totalPageRoutes: pageRoutes.length,
    apiRoutes,
    pageRoutes,
  };
}

// Standalone execution
const isMain = process.argv[1] && (
  process.argv[1] === fileURLToPath(import.meta.url) ||
  process.argv[1].endsWith("route-manifest.ts")
);

if (isMain) {
  const manifest = generateRouteManifest();
  const outDir = path.join(process.cwd(), "docs/audit");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const outFile = path.join(outDir, "routes.json");
  fs.writeFileSync(outFile, JSON.stringify(manifest, null, 2), "utf-8");
  console.log(`[route-manifest] Wrote ${manifest.totalApiRoutes} API routes and ${manifest.totalPageRoutes} Page routes to ${outFile}`);
}
