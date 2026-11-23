/**
 * Test Matrix AST Auditor
 * Maps every lib/service module, route, component, and page to the test files that import or exercise it.
 * Uses TypeScript AST import parsing and route path references (not naive name matching).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { generateRouteManifest } from "./route-manifest";

export type ModuleCategory = "lib" | "service" | "route" | "component" | "page";
export type TestLayer = "unit" | "integration" | "contract" | "e2e" | "other";

export interface TestReference {
  testFile: string;
  layer: TestLayer;
  referenceType: "import" | "route-string";
}

export interface ModuleCoverage {
  modulePath: string; // e.g. "src/lib/fair-price-engine.ts" or "/api/campaigns"
  category: ModuleCategory;
  covered: boolean;
  tests: TestReference[];
}

export interface CategorySummary {
  total: number;
  covered: number;
  uncovered: number;
  coveragePercent: number;
}

export interface TestMatrixResult {
  generatedAt: string;
  totalModules: number;
  totalCovered: number;
  totalUncovered: number;
  overallCoveragePercent: number;
  summaries: Record<ModuleCategory, CategorySummary>;
  gapList: {
    category: ModuleCategory;
    modulePath: string;
  }[];
  modules: ModuleCoverage[];
}

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

function determineTestLayer(testFilePath: string): TestLayer {
  const norm = normalizePath(testFilePath);
  if (/(^|\/)tests\/unit\//.test(norm)) return "unit";
  if (/(^|\/)tests\/integration\//.test(norm)) return "integration";
  if (/(^|\/)tests\/contracts\//.test(norm)) return "contract";
  if (/(^|\/)tests\/e2e\//.test(norm)) return "e2e";
  return "other";
}

interface ParsedTestFile {
  filePath: string;
  relativeFile: string;
  layer: TestLayer;
  importedModules: Set<string>; // resolved module paths
  stringLiterals: Set<string>; // string literals in test (e.g. "/api/...")
}

function parseTestFile(filePath: string, projectRoot: string): ParsedTestFile {
  const code = fs.readFileSync(filePath, "utf-8");
  const sourceFile = ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true);
  const relativeFile = normalizePath(path.relative(projectRoot, filePath));
  const layer = determineTestLayer(relativeFile);

  const importedModules = new Set<string>();
  const stringLiterals = new Set<string>();

  function resolveImportPath(importStr: string): string | null {
    if (importStr.startsWith("@/")) {
      const sub = importStr.slice(2);
      return `src/${sub}`;
    }
    if (importStr.startsWith("./") || importStr.startsWith("../")) {
      const dir = path.dirname(relativeFile);
      const resolved = path.normalize(path.join(dir, importStr));
      return normalizePath(resolved);
    }
    return null;
  }

  ts.forEachChild(sourceFile, function visit(node: ts.Node) {
    // Check import declaration: import { ... } from "..."
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const spec = node.moduleSpecifier.text;
      const resolved = resolveImportPath(spec);
      if (resolved) {
        importedModules.add(resolved);
      }
    }

    // Check dynamic import: import("...")
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const arg = node.arguments[0];
      if (arg && ts.isStringLiteral(arg)) {
        const resolved = resolveImportPath(arg.text);
        if (resolved) importedModules.add(resolved);
      }
    }

    // Check string literals and template literals for route references
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const text = node.text;
      if (text.startsWith("/api/") || text.startsWith("/")) {
        stringLiterals.add(text.split("?")[0]!);
      }
    }

    ts.forEachChild(node, visit);
  });

  return {
    filePath,
    relativeFile,
    layer,
    importedModules,
    stringLiterals,
  };
}

export function generateTestMatrix(rootDir?: string): TestMatrixResult {
  const projectRoot = rootDir || process.cwd();

  // 1. Collect all target modules in src
  const libFiles = findFiles(path.join(projectRoot, "src/lib"), /\.(ts|tsx)$/);
  const serviceFiles = findFiles(path.join(projectRoot, "src/services"), /\.(ts|tsx)$/);
  const componentFiles = findFiles(path.join(projectRoot, "src/components"), /\.(tsx|ts)$/);

  const manifest = generateRouteManifest(projectRoot);

  // 2. Collect all test files
  const testFiles = findFiles(path.join(projectRoot, "tests"), /\.(test|spec)\.(ts|tsx|js|mjs)$/);
  const parsedTests = testFiles.map((tf) => parseTestFile(tf, projectRoot));

  const allModules: ModuleCoverage[] = [];

  // Helper to match an import against a module path
  function isImportMatch(targetPath: string, importPath: string): boolean {
    const cleanTarget = targetPath.replace(/\.(ts|tsx|js|jsx)$/, "");
    const cleanImport = importPath.replace(/\.(ts|tsx|js|jsx)$/, "");
    return cleanTarget === cleanImport || cleanTarget.endsWith(cleanImport) || cleanTarget.startsWith(cleanImport);
  }

  // A. Lib modules
  for (const file of libFiles) {
    const rel = normalizePath(path.relative(projectRoot, file));
    const matchingTests: TestReference[] = [];

    for (const test of parsedTests) {
      for (const imp of test.importedModules) {
        if (isImportMatch(rel, imp)) {
          matchingTests.push({
            testFile: test.relativeFile,
            layer: test.layer,
            referenceType: "import",
          });
          break;
        }
      }
    }

    allModules.push({
      modulePath: rel,
      category: "lib",
      covered: matchingTests.length > 0,
      tests: matchingTests,
    });
  }

  // B. Service modules
  for (const file of serviceFiles) {
    const rel = normalizePath(path.relative(projectRoot, file));
    const matchingTests: TestReference[] = [];

    for (const test of parsedTests) {
      for (const imp of test.importedModules) {
        if (isImportMatch(rel, imp)) {
          matchingTests.push({
            testFile: test.relativeFile,
            layer: test.layer,
            referenceType: "import",
          });
          break;
        }
      }
    }

    allModules.push({
      modulePath: rel,
      category: "service",
      covered: matchingTests.length > 0,
      tests: matchingTests,
    });
  }

  // C. Components
  for (const file of componentFiles) {
    const rel = normalizePath(path.relative(projectRoot, file));
    const matchingTests: TestReference[] = [];

    for (const test of parsedTests) {
      for (const imp of test.importedModules) {
        if (isImportMatch(rel, imp)) {
          matchingTests.push({
            testFile: test.relativeFile,
            layer: test.layer,
            referenceType: "import",
          });
          break;
        }
      }
    }

    allModules.push({
      modulePath: rel,
      category: "component",
      covered: matchingTests.length > 0,
      tests: matchingTests,
    });
  }

  // D. Routes (API)
  for (const route of manifest.apiRoutes) {
    const matchingTests: TestReference[] = [];

    for (const test of parsedTests) {
      // 1. Direct route file import
      let foundImport = false;
      for (const imp of test.importedModules) {
        if (isImportMatch(route.file, imp)) {
          matchingTests.push({
            testFile: test.relativeFile,
            layer: test.layer,
            referenceType: "import",
          });
          foundImport = true;
          break;
        }
      }

      // 2. Or string literal matching route path (e.g. in supertest / contract test)
      if (!foundImport) {
        const routeWildcard = route.path.replace(/\[\w+\]/g, "");
        for (const str of test.stringLiterals) {
          if (str === route.path || (routeWildcard.length > 5 && str.startsWith(routeWildcard))) {
            matchingTests.push({
              testFile: test.relativeFile,
              layer: test.layer,
              referenceType: "route-string",
            });
            break;
          }
        }
      }
    }

    allModules.push({
      modulePath: route.path,
      category: "route",
      covered: matchingTests.length > 0,
      tests: matchingTests,
    });
  }

  // E. Pages
  for (const page of manifest.pageRoutes) {
    const matchingTests: TestReference[] = [];

    for (const test of parsedTests) {
      for (const imp of test.importedModules) {
        if (isImportMatch(page.file, imp)) {
          matchingTests.push({
            testFile: test.relativeFile,
            layer: test.layer,
            referenceType: "import",
          });
          break;
        }
      }

      if (test.stringLiterals.has(page.path)) {
        matchingTests.push({
          testFile: test.relativeFile,
          layer: test.layer,
          referenceType: "route-string",
        });
      }
    }

    allModules.push({
      modulePath: page.path,
      category: "page",
      covered: matchingTests.length > 0,
      tests: matchingTests,
    });
  }

  // 3. Summaries & Gap List
  const categories: ModuleCategory[] = ["lib", "service", "route", "component", "page"];
  const summaries: Record<ModuleCategory, CategorySummary> = {
    lib: { total: 0, covered: 0, uncovered: 0, coveragePercent: 0 },
    service: { total: 0, covered: 0, uncovered: 0, coveragePercent: 0 },
    route: { total: 0, covered: 0, uncovered: 0, coveragePercent: 0 },
    component: { total: 0, covered: 0, uncovered: 0, coveragePercent: 0 },
    page: { total: 0, covered: 0, uncovered: 0, coveragePercent: 0 },
  };
  const gapList: { category: ModuleCategory; modulePath: string }[] = [];

  for (const cat of categories) {
    const mods = allModules.filter((m) => m.category === cat);
    const covered = mods.filter((m) => m.covered).length;
    const uncovered = mods.length - covered;
    const coveragePercent = mods.length > 0 ? Number(((covered / mods.length) * 100).toFixed(1)) : 100;

    summaries[cat] = {
      total: mods.length,
      covered,
      uncovered,
      coveragePercent,
    };

    for (const m of mods) {
      if (!m.covered) {
        gapList.push({
          category: cat,
          modulePath: m.modulePath,
        });
      }
    }
  }

  const totalModules = allModules.length;
  const totalCovered = allModules.filter((m) => m.covered).length;
  const totalUncovered = totalModules - totalCovered;
  const overallCoveragePercent = totalModules > 0 ? Number(((totalCovered / totalModules) * 100).toFixed(1)) : 100;

  return {
    generatedAt: new Date().toISOString(),
    totalModules,
    totalCovered,
    totalUncovered,
    overallCoveragePercent,
    summaries,
    gapList,
    modules: allModules,
  };
}

// Standalone execution
const isMain = process.argv[1] && (
  process.argv[1] === fileURLToPath(import.meta.url) ||
  process.argv[1].endsWith("test-matrix.ts")
);

if (isMain) {
  const result = generateTestMatrix();
  const outDir = path.join(process.cwd(), "docs/audit");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const outFile = path.join(outDir, "tests.json");
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2), "utf-8");
  console.log(`[test-matrix] Audited ${result.totalModules} modules across ${result.modules.length} targets.`);
  console.log(`  - Overall coverage: ${result.overallCoveragePercent}% (${result.totalCovered}/${result.totalModules})`);
  console.log(`  - Lib coverage: ${result.summaries.lib.coveragePercent}% (${result.summaries.lib.covered}/${result.summaries.lib.total})`);
  console.log(`  - Service coverage: ${result.summaries.service.coveragePercent}% (${result.summaries.service.covered}/${result.summaries.service.total})`);
  console.log(`  - Route coverage: ${result.summaries.route.coveragePercent}% (${result.summaries.route.covered}/${result.summaries.route.total})`);
  console.log(`  - Component coverage: ${result.summaries.component.coveragePercent}% (${result.summaries.component.covered}/${result.summaries.component.total})`);
  console.log(`  - Page coverage: ${result.summaries.page.coveragePercent}% (${result.summaries.page.covered}/${result.summaries.page.total})`);
  console.log(`  - Gaps: ${result.gapList.length}`);
  console.log(`  - Output: ${outFile}`);
}
