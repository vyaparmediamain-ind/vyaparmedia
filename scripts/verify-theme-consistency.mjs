#!/usr/bin/env node
/**
 * VyaparMedia Theme Consistency Regression Guard (Prompt 5)
 *
 * Scans all source files under `src/` to catch regressions where developers
 * accidentally introduce hardcoded Tailwind color classes (e.g. `bg-white`,
 * `bg-black`, `bg-slate-*`, `bg-gray-*`) instead of using semantic design tokens
 * (`bg-background`, `bg-card`, `bg-muted`, `border-border`, etc.) from DESIGN_TOKENS.md.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.resolve(__dirname, "../src");

// Forbidden utility pattern: bg-white, bg-black, bg-slate-*, bg-gray-* (including opacity like /20, /50, etc.)
const FORBIDDEN_PATTERN = /\bbg-(?:white|black|slate-\w+|gray-\w+)(?:\/\d+)?\b/g;

// Files/extensions to inspect
const EXTENSIONS = new Set([".tsx", ".ts", ".jsx", ".js"]);

function walkDir(dir) {
  let fileList = [];
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

function checkThemeConsistency() {
  console.log("🛡️  Theme Consistency Regression Guard (Prompt 5)");
  console.log("   Scanning `src/` for forbidden hardcoded classes: bg-white, bg-black, bg-slate-*, bg-gray-*\n");

  const files = walkDir(SRC_DIR);
  let totalViolations = 0;
  const violationsByFile = [];

  for (const filePath of files) {
    const relativePath = path.relative(path.resolve(__dirname, ".."), filePath).replace(/\\/g, "/");
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");

    const fileViolations = [];
    lines.forEach((line, index) => {
      // Check for inline bypass comment if ever legitimately required
      if (line.includes("theme-token-ignore")) {
        return;
      }

      const matches = line.match(FORBIDDEN_PATTERN);
      if (matches) {
        fileViolations.push({
          lineNumber: index + 1,
          matches: [...new Set(matches)],
          lineSnippet: line.trim(),
        });
        totalViolations += matches.length;
      }
    });

    if (fileViolations.length > 0) {
      violationsByFile.push({
        file: relativePath,
        violations: fileViolations,
      });
    }
  }

  if (totalViolations > 0) {
    console.error(`❌ REGRESSION DETECTED: Found ${totalViolations} hardcoded color class violations across ${violationsByFile.length} files!\n`);
    for (const item of violationsByFile) {
      console.error(`📄 ${item.file}`);
      for (const v of item.violations) {
        console.error(`   Line ${v.lineNumber} [${v.matches.join(", ")}]:`);
        console.error(`     "${v.lineSnippet}"`);
      }
      console.error("");
    }
    console.error("💡 Remediation Guide:");
    console.error("   - Replace `bg-white` / `bg-black` with `bg-card` or `bg-background`");
    console.error("   - Replace `bg-slate-*` / `bg-gray-*` with `bg-muted` or `bg-secondary`");
    console.error("   - Consult DESIGN_TOKENS.md for the full design token contract.\n");
    process.exit(1);
  }

  console.log(`✅ Passed! 0 theme regressions found across ${files.length} source files.`);
  console.log("   All components correctly consume semantic design tokens from DESIGN_TOKENS.md.\n");
}

checkThemeConsistency();
