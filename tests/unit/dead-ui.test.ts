import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

function getJsxFiles(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (!file.startsWith(".") && file !== "node_modules") {
        results = results.concat(getJsxFiles(fullPath));
      }
    } else if (file.endsWith(".tsx") || file.endsWith(".jsx")) {
      results.push(fullPath);
    }
  }
  return results;
}

describe("Dead UI & Noop Interaction Invariants", () => {
  const srcFiles = getJsxFiles(path.resolve(process.cwd(), "src"));

  it("should have zero noop onClick handlers across all JSX/TSX files", () => {
    const violations: string[] = [];

    for (const file of srcFiles) {
      const content = fs.readFileSync(file, "utf8");
      const lines = content.split("\n");
      lines.forEach((line, idx) => {
        if (
          /onClick\s*=\s*\{\s*\(\s*\)\s*=>\s*\{\s*\}\s*\}/.test(line) ||
          /onClick\s*=\s*\{\s*\(\s*_\s*\)\s*=>\s*\{\s*\}\s*\}/.test(line)
        ) {
          violations.push(`${path.relative(process.cwd(), file)}:${idx + 1}: ${line.trim()}`);
        }
      });
    }

    expect(
      violations,
      `Detected empty noop onClick handler(s):\n${violations.join("\n")}`
    ).toEqual([]);
  });

  it("should have zero placeholder href='#' links across all JSX/TSX files", () => {
    const violations: string[] = [];

    for (const file of srcFiles) {
      const content = fs.readFileSync(file, "utf8");
      const lines = content.split("\n");
      lines.forEach((line, idx) => {
        if (/href\s*=\s*["']#["']/.test(line)) {
          violations.push(`${path.relative(process.cwd(), file)}:${idx + 1}: ${line.trim()}`);
        }
      });
    }

    expect(
      violations,
      `Detected placeholder href='#' links:\n${violations.join("\n")}`
    ).toEqual([]);
  });
});
