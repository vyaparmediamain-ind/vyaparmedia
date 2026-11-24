import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ALL_GUIDES, getGuideById } from "@/content/guides";
import {
  generateGuideCoverageReport,
  scanHelpTips,
  type GuideCoverageReport,
} from "../../scripts/audit/guide-coverage";

describe("Guide Coverage & In-Product Contextual Help Guards (Prompt G05)", () => {
  const coverageJsonPath = path.resolve(process.cwd(), "docs/audit/guide-coverage.json");
  const routesJsonPath = path.resolve(process.cwd(), "docs/audit/routes.json");

  it("verifies committed docs/audit/guide-coverage.json exists and is valid JSON", () => {
    expect(fs.existsSync(coverageJsonPath), "docs/audit/guide-coverage.json must exist").toBe(true);
    const data: GuideCoverageReport = JSON.parse(fs.readFileSync(coverageJsonPath, "utf8"));
    expect(data.summary.pageCoveragePercent).toBe(100);
    expect(data.summary.coverageStatus).toBe("COMPLETE");
    expect(data.pages.length).toBeGreaterThanOrEqual(60);
    expect(data.primaryActions.length).toBeGreaterThanOrEqual(15);
    expect(data.forms.length).toBeGreaterThanOrEqual(10);
    expect(data.widgets.length).toBeGreaterThanOrEqual(10);
    expect(data.destructiveButtons.length).toBeGreaterThanOrEqual(5);
  });

  it("regenerates the guide coverage report in-memory without drift from committed guide-coverage.json", () => {
    const committed: GuideCoverageReport = JSON.parse(fs.readFileSync(coverageJsonPath, "utf8"));
    const inMemory = generateGuideCoverageReport();

    expect(inMemory.summary.totalPages).toBe(committed.summary.totalPages);
    expect(inMemory.summary.mappedPages).toBe(committed.summary.mappedPages);
    expect(inMemory.summary.pageCoveragePercent).toBe(100);
    expect(inMemory.pages.length).toBe(committed.pages.length);
    expect(inMemory.primaryActions.length).toBe(committed.primaryActions.length);
    expect(inMemory.forms.length).toBe(committed.forms.length);
    expect(inMemory.widgets.length).toBe(committed.widgets.length);
    expect(inMemory.destructiveButtons.length).toBe(committed.destructiveButtons.length);
  });

  it("fails if any page route in routes.json lacks a valid guide mapping", () => {
    const routesData = JSON.parse(fs.readFileSync(routesJsonPath, "utf8"));
    const pageRoutes: Array<{ path: string }> = routesData.pageRoutes;
    const coverage: GuideCoverageReport = JSON.parse(fs.readFileSync(coverageJsonPath, "utf8"));

    const mappedPaths = new Set(coverage.pages.map((p) => p.path));

    for (const pr of pageRoutes) {
      expect(
        mappedPaths.has(pr.path),
        `Page route "${pr.path}" is missing from docs/audit/guide-coverage.json. Every page must map to a guide id.`
      ).toBe(true);
    }
  });

  it("ensures every guideId referenced in guide-coverage.json exists in ALL_GUIDES registry", () => {
    const coverage: GuideCoverageReport = JSON.parse(fs.readFileSync(coverageJsonPath, "utf8"));

    // 1. Pages
    for (const p of coverage.pages) {
      const guide = getGuideById(p.guideId);
      expect(guide, `Page "${p.path}" references non-existent guideId: "${p.guideId}"`).toBeDefined();
    }

    // 2. Primary actions
    for (const act of coverage.primaryActions) {
      const guide = getGuideById(act.guideId);
      expect(guide, `Action "${act.actionId}" references non-existent guideId: "${act.guideId}"`).toBeDefined();
    }

    // 3. Forms
    for (const f of coverage.forms) {
      const guide = getGuideById(f.guideId);
      expect(guide, `Form "${f.formId}" references non-existent guideId: "${f.guideId}"`).toBeDefined();
    }

    // 4. Widgets
    for (const w of coverage.widgets) {
      const guide = getGuideById(w.guideId);
      expect(guide, `Widget "${w.widgetId}" references non-existent guideId: "${w.guideId}"`).toBeDefined();
    }

    // 5. Destructive buttons
    for (const d of coverage.destructiveButtons) {
      const guide = getGuideById(d.guideId);
      expect(guide, `Destructive button "${d.actionId}" references non-existent guideId: "${d.guideId}"`).toBeDefined();
    }
  });

  it("fails if any <HelpTip> in the codebase references a missing or invalid guideId", () => {
    const srcDir = path.resolve(process.cwd(), "src");
    const detectedTips = scanHelpTips(srcDir);
    expect(detectedTips.length).toBeGreaterThanOrEqual(5);

    for (const tip of detectedTips) {
      const guide = getGuideById(tip.guideId);
      expect(
        guide,
        `HelpTip in "${tip.file}" references non-existent guideId: "${tip.guideId}"`
      ).toBeDefined();
    }
  });

  it("ensures all EmptyState guideId references across the codebase exist in ALL_GUIDES", () => {
    const srcDir = path.resolve(process.cwd(), "src");
    const emptyStateGuideRegex = /<EmptyState[^>]*guideId=["']([^"']+)["']/g;
    const foundGuideIds: Array<{ file: string; guideId: string }> = [];

    function scanDir(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (/\.(tsx|ts)$/.test(entry.name)) {
          const content = fs.readFileSync(fullPath, "utf8");
          let match;
          while ((match = emptyStateGuideRegex.exec(content)) !== null) {
            if (match[1]) {
              foundGuideIds.push({
                file: path.relative(process.cwd(), fullPath).replace(/\\/g, "/"),
                guideId: match[1],
              });
            }
          }
        }
      }
    }

    scanDir(srcDir);
    expect(foundGuideIds.length).toBeGreaterThanOrEqual(5);

    for (const item of foundGuideIds) {
      const guide = getGuideById(item.guideId);
      expect(
        guide,
        `EmptyState in "${item.file}" references non-existent guideId: "${item.guideId}"`
      ).toBeDefined();
    }
  });

  it("verifies FirstRunChecklist covers all 4 roles and all items map to registered guides", () => {
    const checklistPath = path.resolve(process.cwd(), "src/components/guides/FirstRunChecklist.tsx");
    expect(fs.existsSync(checklistPath), "FirstRunChecklist component must exist").toBe(true);

    const content = fs.readFileSync(checklistPath, "utf8");
    const guideIdRegex = /guideId:\s*["']([^"']+)["']/g;
    const checklistGuideIds: string[] = [];

    let match;
    while ((match = guideIdRegex.exec(content)) !== null) {
      if (match[1]) checklistGuideIds.push(match[1]);
    }

    expect(checklistGuideIds.length).toBeGreaterThanOrEqual(15);

    for (const gid of checklistGuideIds) {
      const guide = getGuideById(gid);
      expect(guide, `FirstRunChecklist references non-existent guideId: "${gid}"`).toBeDefined();
    }
  });

  it("verifies all destructive actions map to safety runbooks that physically exist on disk", () => {
    const coverage: GuideCoverageReport = JSON.parse(fs.readFileSync(coverageJsonPath, "utf8"));
    const destructive = coverage.destructiveButtons;
    expect(destructive.length).toBeGreaterThanOrEqual(5);

    for (const action of destructive) {
      expect(
        action.safetyRunbook,
        `Destructive action "${action.actionId}" must have an associated safetyRunbook.`
      ).toBeDefined();

      const runbookFullPath = path.resolve(process.cwd(), action.safetyRunbook!);
      expect(
        fs.existsSync(runbookFullPath),
        `Safety runbook "${action.safetyRunbook}" for action "${action.actionId}" does not exist on disk.`
      ).toBe(true);
    }
  });

  it("small bundle guard: ensures HelpTip does NOT import full guide content or ALL_GUIDES (imports only IDs and context)", () => {
    const helpTipFilePath = path.resolve(process.cwd(), "src/components/guides/HelpTip.tsx");
    const content = fs.readFileSync(helpTipFilePath, "utf8");

    // HelpTip must NOT import ALL_GUIDES, INFLUENCER_GUIDES, BRAND_GUIDES, etc.
    expect(content).not.toContain("ALL_GUIDES");
    expect(content).not.toContain("INFLUENCER_GUIDES");
    expect(content).not.toContain("BRAND_GUIDES");
    expect(content).not.toContain("ADMIN_GUIDES");
    expect(content).not.toContain("SCOUT_GUIDES");
    expect(content).toContain("useGuideDrawer");
  });
});
