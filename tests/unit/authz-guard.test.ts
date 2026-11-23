/**
 * AST Guard Test: Active Admin Authorization Guard
 *
 * Scans the entire `src/` codebase to ensure that raw JWT checks like `userType === "ADMIN"`
 * or `role === "ADMIN"` are never used for authorization decisions in API routes or backend services.
 *
 * All administrative authorization must flow through `requireActiveAdmin` or `resolveActor(session)`
 * backed by authoritative database validation and 60-second Redis caching.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

describe("AST Guard: Raw Admin Authorization Ban", () => {
  const srcDir = path.resolve(process.cwd(), "src");

  // Documented allow-list of files permitted to inspect raw "ADMIN" string literals
  const ALLOW_LIST = new Set([
    // Core auth / RBAC / middleware implementation files
    "src/lib/auth.ts",
    "src/lib/admin-auth.ts",
    "src/lib/authz.ts",
    "src/lib/rbac.ts",
    "src/middleware.ts",
    // Telemetry noise suppression (dropping admin events to avoid polluting analytics)
    "src/app/api/telemetry/track/route.ts",
    "src/services/telemetry.service.ts",
    // Analytics presentation formatting
    "src/lib/traffic-analytics.ts",
    // Navigation config & UI presentation
    "src/config/navigation.ts",
    "src/components/navigation/DesktopSidebar.tsx",
    "src/components/navigation/MobileSidebar.tsx",
    "src/components/analytics/PageViewTracker.tsx",
    "src/app/admin/users/page.tsx",
    "src/app/dashboard/influencers/page.tsx",
    // Non-auth business rules (tax exemptions & preventing admin account role downgrades)
    "src/lib/india-compliance.ts",
    "src/services/scout.service.ts",
    // Deal shipping fulfillment verification (checks userType === "ADMIN" with DB status: ACTIVE)
    "src/services/deal/product.ts",
  ]);

  function collectTsFiles(dir: string): string[] {
    const results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...collectTsFiles(fullPath));
      } else if (
        (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) &&
        !entry.name.endsWith(".d.ts")
      ) {
        results.push(fullPath);
      }
    }

    return results;
  }

  interface Violation {
    file: string;
    line: number;
    snippet: string;
  }

  function findRawAdminChecks(filePath: string): Violation[] {
    const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, "/");
    if (ALLOW_LIST.has(relativePath)) {
      return [];
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true
    );

    const violations: Violation[] = [];

    function isOperandAdmin(node: ts.Node): boolean {
      if (ts.isStringLiteral(node) && node.text === "ADMIN") {
        return true;
      }
      return false;
    }

    function isOperandUserProperty(node: ts.Node): boolean {
      const text = node.getText(sourceFile);
      return (
        text.includes("userType") ||
        text.includes("role") ||
        text.includes(".type")
      );
    }

    function visit(node: ts.Node) {
      if (ts.isBinaryExpression(node)) {
        const op = node.operatorToken.kind;
        const isEquality =
          op === ts.SyntaxKind.EqualsEqualsEqualsToken ||
          op === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
          op === ts.SyntaxKind.EqualsEqualsToken ||
          op === ts.SyntaxKind.ExclamationEqualsToken;

        if (isEquality) {
          const leftIsAdmin = isOperandAdmin(node.left);
          const rightIsAdmin = isOperandAdmin(node.right);

          if (
            (leftIsAdmin && isOperandUserProperty(node.right)) ||
            (rightIsAdmin && isOperandUserProperty(node.left))
          ) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            violations.push({
              file: relativePath,
              line: line + 1,
              snippet: node.getText(sourceFile),
            });
          }
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return violations;
  }

  it("verifies no unauthorized raw admin equality checks exist in src/", () => {
    const allFiles = collectTsFiles(srcDir);
    const allViolations: Violation[] = [];

    for (const file of allFiles) {
      const violations = findRawAdminChecks(file);
      allViolations.push(...violations);
    }

    if (allViolations.length > 0) {
      const formatted = allViolations
        .map((v) => `  - ${v.file}:${v.line} -> \`${v.snippet}\``)
        .join("\n");
      expect.fail(
        `Found ${allViolations.length} raw admin check(s) outside allow-list:\n${formatted}\nUse resolveActor(session) or requireActiveAdmin instead.`
      );
    }

    expect(allViolations).toHaveLength(0);
  });

  it("specifically guards all hardened endpoints and services from raw admin checks", () => {
    const guardedFiles = [
      "src/app/api/campaigns/[id]/analytics/route.ts",
      "src/app/api/campaigns/[id]/finance/export/route.ts",
      "src/app/api/pricing/evaluate/route.ts",
      "src/app/api/campaigns/[id]/reports/performance/route.ts",
      "src/app/api/reports/creator/[id]/market-range/route.ts",
      "src/services/fair-price.service.ts",
      "src/services/market-range-report.service.ts",
      "src/services/campaign-metrics.service.ts",
      "src/services/campaign-finance.service.ts",
      "src/services/campaign-roi.service.ts",
      "src/services/campaign-performance-report.service.ts",
      "src/app/dashboard/campaigns/[id]/analytics/page.tsx",
      "src/app/dashboard/campaigns/[id]/roi/page.tsx",
    ];

    for (const relativePath of guardedFiles) {
      const absPath = path.resolve(process.cwd(), relativePath);
      expect(fs.existsSync(absPath)).toBe(true);
      const violations = findRawAdminChecks(absPath);
      expect(violations).toHaveLength(0);
    }
  });
});
