#!/usr/bin/env node
/**
 * VyaparMedia Action-Button Eligibility Guard (Action-Button Rule)
 *
 * Scans React components under `src/` to catch regressions where developers
 * introduce new state-changing / API-triggering buttons without wiring
 * a `disabled` condition to pre-check backend rejection conditions.
 *
 * Standard (Prompt 2-3 & ARCHITECTURE_PATTERNS.md 6.6):
 * 1. Don't hide buttons that users need to discover.
 * 2. Disable buttons when prerequisite conditions fail.
 * 3. Provide inline "why" explanation and actionable fix-it CTA.
 * 4. Pre-check using shared predicates from `src/lib/action-eligibility.ts`.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.resolve(__dirname, "../src");

// Action verbs indicating a mutation or API trigger
const MUTATION_VERBS = [
  "submit",
  "withdraw",
  "release",
  "cancel",
  "dispute",
  "verify",
  "dispatch",
  "receive",
  "apply",
  "accept",
  "reject",
  "delete",
  "update",
  "create",
  "save",
  "sign",
  "send",
  "payout",
  "post",
];

const MUTATION_REGEX = new RegExp(
  `\\b(?:handle|on)?(?:${MUTATION_VERBS.join("|")})\\w*\\b`,
  "i"
);

function walkDir(dir) {
  let fileList = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      fileList = fileList.concat(walkDir(fullPath));
    } else if (entry.name.endsWith(".tsx")) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function checkActionButtons() {
  console.log("🛡️  Action-Button Eligibility Regression Guard");
  console.log("   Scanning `src/` for state-changing buttons missing disabled eligibility gating...\n");

  const files = walkDir(SRC_DIR);
  let totalButtons = 0;
  let gatedButtons = 0;
  let ungatedWarnings = 0;
  const warnings = [];

  for (const filePath of files) {
    const relativePath = path
      .relative(path.resolve(__dirname, ".."), filePath)
      .replace(/\\/g, "/");
    const content = fs.readFileSync(filePath, "utf8");

    // Match JSX Button/button tags across multiple lines
    // Heuristic regex to capture <Button ...> and <button ...>
    const buttonTagRegex = /<(Button|button)\b([^>]*?)(\/?>)/gs;
    let match;

    while ((match = buttonTagRegex.exec(content)) !== null) {
      const tagContent = match[2];
      const matchIndex = match.index;
      const lineNumber = content.substring(0, matchIndex).split("\n").length;

      // Check if bypass comment is present
      const lines = content.substring(0, matchIndex).split("\n");
      const precedingLine = lines[lines.length - 1] || "";
      if (
        tagContent.includes("action-button-ignore") ||
        precedingLine.includes("action-button-ignore")
      ) {
        continue;
      }

      // Check if button is a link navigation (href prop)
      const hasHref = /\bhref\s*=/i.test(tagContent);
      if (hasHref) {
        continue; // Pure navigation buttons don't require mutation eligibility gating
      }

      // Check for mutation indicators
      const isSubmit = /\btype\s*=\s*["']submit["']/i.test(tagContent);
      const onClickMatch = tagContent.match(/\bonClick\s*=\s*\{([^}]+)\}/);
      const onClickHandler = onClickMatch ? onClickMatch[1] : "";
      const isMutatingAction =
        isSubmit || MUTATION_REGEX.test(onClickHandler);

      if (!isMutatingAction) {
        continue;
      }

      totalButtons++;

      // Check if disabled prop is wired
      const hasDisabled = /\bdisabled(?:\s*=\s*\{|\s*(=|(?=[\s>]))|$)/i.test(
        tagContent
      );

      if (hasDisabled) {
        gatedButtons++;
      } else {
        ungatedWarnings++;
        warnings.push({
          file: relativePath,
          line: lineNumber,
          tag: match[1],
          snippet: `<${match[1]} ${tagContent.trim().replace(/\s+/g, " ").slice(0, 70)}...>`,
        });
      }
    }
  }

  if (warnings.length > 0) {
    console.log(`⚠️  Found ${warnings.length} mutating button(s) without an explicit \`disabled\` prop:\n`);
    for (const w of warnings.slice(0, 15)) {
      console.log(`   - ${w.file}:${w.line}`);
      console.log(`     Snippet: ${w.snippet}`);
      console.log(`     Rule: Ensure backend rejection conditions are pre-checked via src/lib/action-eligibility.ts\n`);
    }
    if (warnings.length > 15) {
      console.log(`   ... and ${warnings.length - 15} more warnings.\n`);
    }
    console.log(
      `💡 Note: This is an advisory dev-time check (Action-Button Rule). Add \`disabled={!eligibility.allowed}\` or \`// action-button-ignore\` if non-mutating.\n`
    );
  } else {
    console.log("✅ All detected state-changing buttons have disabled eligibility gating wired!\n");
  }

  console.log(`📊 Summary:`);
  console.log(`   - Total mutating buttons identified: ${totalButtons}`);
  console.log(`   - With disabled gating: ${gatedButtons}`);
  console.log(`   - Ungated advisories: ${ungatedWarnings}\n`);
}

checkActionButtons();
