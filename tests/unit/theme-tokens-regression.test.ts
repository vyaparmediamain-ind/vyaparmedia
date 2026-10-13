import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SRC_DIR = path.resolve(__dirname, "../../src");
const FORBIDDEN_PATTERN = /\bbg-(?:white|black|slate-\w+|gray-\w+)(?:\/\d+)?\b/g;
const EXTENSIONS = new Set([".tsx", ".ts", ".jsx", ".js"]);

function walkDir(dir: string): string[] {
  let fileList: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      fileList = fileList.concat(walkDir(fullPath));
    } else if (EXTENSIONS.has(path.extname(entry.name))) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

describe("Theme Consistency Regression Guard (Prompt 5)", () => {
  const allSourceFiles = walkDir(SRC_DIR);

  it("should have scanned source files in src/", () => {
    expect(allSourceFiles.length).toBeGreaterThan(50);
  });

  it("should not contain hardcoded bg-white, bg-black, bg-slate-*, or bg-gray-* classes in any component", () => {
    const violations: { file: string; line: number; match: string }[] = [];

    for (const filePath of allSourceFiles) {
      const content = fs.readFileSync(filePath, "utf8");
      const lines = content.split("\n");

      lines.forEach((line, index) => {
        if (line.includes("theme-token-ignore")) {
          return;
        }

        const matches = line.match(FORBIDDEN_PATTERN);
        if (matches) {
          const relative = path.relative(SRC_DIR, filePath).replace(/\\/g, "/");
          matches.forEach((m) => {
            violations.push({
              file: relative,
              line: index + 1,
              match: m,
            });
          });
        }
      });
    }

    expect(
      violations,
      `Detected hardcoded theme color classes in src/. Please replace with semantic tokens:\n${JSON.stringify(violations, null, 2)}`
    ).toEqual([]);
  });

  it("specifically guards the 4 target files resolved in Prompt 5", () => {
    const targetFiles = [
      "components/discovery/CreatorDiscoveryCard.tsx",
      "components/dashboard/messages/ChatPanel.tsx",
      "app/admin/disputes/page.tsx",
      "app/dashboard/leaderboard/page.tsx",
    ];

    for (const relPath of targetFiles) {
      const fullPath = path.join(SRC_DIR, relPath);
      expect(fs.existsSync(fullPath)).toBe(true);

      const content = fs.readFileSync(fullPath, "utf8");
      const matches = content.match(FORBIDDEN_PATTERN);
      expect(
        matches,
        `Target file ${relPath} contains forbidden classes: ${matches?.join(", ")}`
      ).toBeNull();
    }
  });
});
