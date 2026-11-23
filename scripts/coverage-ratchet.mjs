#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const SUMMARY_FILE = path.resolve(process.cwd(), "coverage/coverage-summary.json");
const BASELINE_FILE = path.resolve(process.cwd(), "coverage-baseline.json");

if (!fs.existsSync(SUMMARY_FILE)) {
  console.error("❌ Coverage summary not found at " + SUMMARY_FILE);
  console.error("Please run coverage generation first (e.g. npm run test:coverage)");
  process.exit(1);
}

if (!fs.existsSync(BASELINE_FILE)) {
  console.error("❌ Coverage baseline not found at " + BASELINE_FILE);
  process.exit(1);
}

const summary = JSON.parse(fs.readFileSync(SUMMARY_FILE, "utf-8"));
const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, "utf-8"));

let hasRegression = false;
const regressions = [];
const improvements = [];

function checkMetrics(scopeName, currentMetrics, baselineMetrics) {
  const keys = ["lines", "statements", "functions", "branches"];
  for (const key of keys) {
    const curVal = currentMetrics?.[key]?.pct ?? 0;
    const baseVal = baselineMetrics?.[key] ?? 0;

    // Allow tiny epsilon for float inaccuracies
    if (curVal < baseVal - 0.05) {
      hasRegression = true;
      regressions.push(
        `[REGRESSION] ${scopeName} ${key}: current ${curVal.toFixed(2)}% < baseline ${baseVal.toFixed(2)}%`
      );
    } else if (curVal > baseVal + 0.5) {
      improvements.push(
        `[IMPROVEMENT] ${scopeName} ${key}: ${baseVal.toFixed(2)}% -> ${curVal.toFixed(2)}%`
      );
    }
  }
}

// 1. Check global total
if (baseline.total) {
  checkMetrics("total", summary.total, baseline.total);
}

// 2. Check per-folder baselines
if (baseline.folders) {
  for (const [folderPath, expectedFolderMetrics] of Object.entries(baseline.folders)) {
    // Calculate folder aggregated metrics from summary entries
    const normalizedTarget = folderPath.replace(/\\/g, "/");
    let totalLines = 0;
    let coveredLines = 0;
    let totalStatements = 0;
    let coveredStatements = 0;
    let totalFunctions = 0;
    let coveredFunctions = 0;
    let totalBranches = 0;
    let coveredBranches = 0;
    let fileCount = 0;

    for (const [filePath, fileStats] of Object.entries(summary)) {
      if (filePath === "total") continue;
      const normalizedFile = filePath.replace(/\\/g, "/");
      if (normalizedFile.includes(normalizedTarget)) {
        fileCount++;
        totalLines += fileStats.lines.total;
        coveredLines += fileStats.lines.covered;
        totalStatements += fileStats.statements.total;
        coveredStatements += fileStats.statements.covered;
        totalFunctions += fileStats.functions.total;
        coveredFunctions += fileStats.functions.covered;
        totalBranches += fileStats.branches.total;
        coveredBranches += fileStats.branches.covered;
      }
    }

    if (fileCount === 0) {
      console.warn(`⚠️ Warning: No coverage files matched folder filter "${folderPath}"`);
      continue;
    }

    const aggregated = {
      lines: { pct: totalLines ? (coveredLines / totalLines) * 100 : 100 },
      statements: { pct: totalStatements ? (coveredStatements / totalStatements) * 100 : 100 },
      functions: { pct: totalFunctions ? (coveredFunctions / totalFunctions) * 100 : 100 },
      branches: { pct: totalBranches ? (coveredBranches / totalBranches) * 100 : 100 },
    };

    checkMetrics(folderPath, aggregated, expectedFolderMetrics);
  }
}

console.log("\n=================== COVERAGE RATCHET REPORT ===================");
if (improvements.length > 0) {
  console.log("\n📈 Improvements Detected:");
  improvements.forEach((imp) => console.log("  " + imp));
}

if (hasRegression) {
  console.error("\n❌ Code coverage regression detected against baseline:");
  regressions.forEach((reg) => console.error("  " + reg));
  console.error("\nCoverage thresholds must NOT regress. Increase test coverage or update baseline deliberately.");
  process.exit(1);
} else {
  console.log("\n✅ Coverage ratchet check passed! All metrics meet or exceed baseline.");
  console.log("===============================================================\n");
  process.exit(0);
}
