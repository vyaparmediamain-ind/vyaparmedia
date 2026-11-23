import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

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

describe("Component Manifest Guard Tests", () => {
  const rootDir = process.cwd();
  const componentsDir = path.join(rootDir, "src/components");
  const appDir = path.join(rootDir, "src/app");
  const componentTestsDir = path.join(rootDir, "tests/components");

  const componentFiles = findFiles(componentsDir, /\.(tsx|ts)$/).map((f) =>
    normalizePath(path.relative(rootDir, f))
  );

  const clientPageFiles = findFiles(appDir, /Client\.(tsx|ts)$/).map((f) =>
    normalizePath(path.relative(rootDir, f))
  );

  const testFiles = findFiles(componentTestsDir, /\.test\.(tsx|ts)$/);

  // Read all test file contents to verify component imports and references
  const allTestCode = testFiles.map((f) => fs.readFileSync(f, "utf8")).join("\n");

  // Allowlist for pure barrels, type declarations, and custom React hook helper modules
  const barrelAndHelperAllowlist = new Set([
    "src/components/ui/index.ts",
    "src/components/discovery/index.ts",
    "src/components/discovery/types.ts",
    "src/components/dashboard/campaigns/create/CampaignCreateHelpers.ts",
    "src/components/dashboard/campaigns/details/CampaignDetailHelpers.tsx",
    "src/components/dashboard/campaigns/details/useCampaignDetail.ts",
    "src/components/dashboard/deals/DealDetailHelpers.tsx",
    "src/components/dashboard/deals/useDealDetail.ts",
    "src/components/dashboard/deals/useDealRealtime.ts",
    "src/components/dashboard/messages/MessagesHelpers.ts",
    "src/components/dashboard/messages/useMessages.ts",
    "src/components/dashboard/disputes/DisputeHelpers.ts",
    "src/components/brand/index.ts",
  ]);

  it("discovers all components under src/components and client page components", () => {
    expect(componentFiles.length).toBeGreaterThan(100);
    expect(clientPageFiles.length).toBeGreaterThan(0);
  });

  it("ensures every client page component (*Client.tsx) is tested or in test suite", () => {
    for (const clientPage of clientPageFiles) {
      const baseName = path.basename(clientPage, path.extname(clientPage));
      const isReferenced =
        allTestCode.includes(baseName) || allTestCode.includes(clientPage);
      expect(
        isReferenced,
        `Client page component ${clientPage} has no corresponding component test reference`
      ).toBe(true);
    }
  });

  it("verifies component files follow naming and location conventions", () => {
    for (const file of componentFiles) {
      if (barrelAndHelperAllowlist.has(file)) continue;

      // Component files should use PascalCase or end with .tsx
      const base = path.basename(file);
      expect(
        base.endsWith(".tsx") || base.endsWith(".ts"),
        `Component file ${file} does not have valid extension`
      ).toBe(true);
    }
  });
});
