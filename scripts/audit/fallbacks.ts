/**
 * Fallbacks & Code Smells AST Auditor
 * Scans src/ for:
 * 1. Catch blocks (classified: empty, comment-only, log-only, rethrow, error-response, fallback-value)
 * 2. Metric defaults (|| <number> and ?? <number> on metric-like identifiers)
 * 3. Math.random usage
 * 4. Non-null assertions (!)
 * 5. Explicit 'any' keyword usage
 * 6. eslint-disable, ts-ignore, ts-expect-error comments
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

export type CatchClassification =
  | "empty"
  | "comment_only"
  | "log_only"
  | "rethrow"
  | "error_response"
  | "fallback_value"
  | "other";

export interface CatchBlockInfo {
  file: string;
  line: number;
  column: number;
  classification: CatchClassification;
  f06ClassificationReview?: string; // Placeholder for F06 review
  snippet: string;
}

export interface MetricDefaultInfo {
  file: string;
  line: number;
  column: number;
  operator: "||" | "??";
  identifier: string;
  defaultValue: number;
  snippet: string;
}

export interface CodeSmellInfo {
  file: string;
  line: number;
  column: number;
  type: "math_random" | "non_null_assertion" | "any_keyword" | "compiler_ignore";
  detail: string;
  snippet: string;
}

export interface FallbacksResult {
  generatedAt: string;
  totalFilesAudited: number;
  summary: {
    totalCatchBlocks: number;
    catchByClassification: Record<CatchClassification, number>;
    totalMetricDefaults: number;
    totalMathRandom: number;
    totalNonNullAssertions: number;
    totalAnyKeywords: number;
    totalCompilerIgnores: number;
  };
  catchBlocks: CatchBlockInfo[];
  metricDefaults: MetricDefaultInfo[];
  smells: CodeSmellInfo[];
}

const METRIC_IDENTIFIER_PATTERN = /(reach|view|views|follower|followers|engagement|budget|price|rate|amount|score|count|total|balance|paise|earning|earnings|roi|impression|impressions|cpm|cpc|subscriber|subscribers|pct|ratio|percentage)/i;

function normalizePath(p: string): string {
  return p.split(path.sep).join("/");
}

function findSourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];

  function walk(current: string) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules" && entry.name !== ".next" && entry.name !== "tests") {
          walk(fullPath);
        }
      } else if (entry.isFile() && /\.(tsx|ts|jsx|js)$/.test(entry.name)) {
        if (!fullPath.includes("scripts/audit")) {
          results.push(fullPath);
        }
      }
    }
  }

  walk(dir);
  return results;
}

function classifyCatchClause(catchNode: ts.CatchClause, _code: string): CatchClassification {
  const block = catchNode.block;
  const statements = block.statements;

  if (statements.length === 0) {
    const blockText = block.getText().trim();
    // Check if comments exist inside block
    const innerText = blockText.slice(1, -1).trim();
    if (innerText.length > 0) {
      return "comment_only";
    }
    return "empty";
  }

  const blockText = block.getText();

  // Check for rethrow
  if (statements.some((s) => ts.isThrowStatement(s))) {
    return "rethrow";
  }

  // Check for error response (NextResponse.json, ApiResponse.error, res.status)
  if (
    blockText.includes("NextResponse.json") ||
    blockText.includes("ApiResponse.") ||
    blockText.includes("res.status")
  ) {
    return "error_response";
  }

  // Check for log-only (all statements are calls to logger.* or console.*)
  const isAllLogging = statements.every((stmt) => {
    if (ts.isExpressionStatement(stmt) && ts.isCallExpression(stmt.expression)) {
      const expr = stmt.expression.expression.getText();
      return (
        expr.startsWith("logger.") ||
        expr.startsWith("console.") ||
        expr.startsWith("log.")
      );
    }
    return false;
  });

  if (isAllLogging) {
    return "log_only";
  }

  // Check for fallback value / return / assignment
  if (
    statements.some((s) => ts.isReturnStatement(s)) ||
    blockText.includes("return ") ||
    blockText.includes(" = ")
  ) {
    return "fallback_value";
  }

  return "other";
}

export function analyzeFallbacks(rootDir?: string): FallbacksResult {
  const projectRoot = rootDir || process.cwd();
  const sourceFiles = findSourceFiles(path.join(projectRoot, "src"));

  const catchBlocks: CatchBlockInfo[] = [];
  const metricDefaults: MetricDefaultInfo[] = [];
  const smells: CodeSmellInfo[] = [];

  for (const filePath of sourceFiles) {
    const code = fs.readFileSync(filePath, "utf-8");
    const sourceFile = ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true);
    const relativeFile = normalizePath(path.relative(projectRoot, filePath));

    function getPosition(pos: number) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
      return { line: line + 1, column: character + 1 };
    }

    function visit(node: ts.Node) {
      // 1. Catch blocks
      if (ts.isCatchClause(node)) {
        const { line, column } = getPosition(node.getStart());
        const classification = classifyCatchClause(node, code);
        const rawSnippet = node.getText().split("\n").slice(0, 4).join("\n");

        catchBlocks.push({
          file: relativeFile,
          line,
          column,
          classification,
          snippet: rawSnippet,
        });
      }

      // 2. Metric defaults: left || <number> or left ?? <number>
      if (ts.isBinaryExpression(node)) {
        const op = node.operatorToken.kind;
        if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) {
          if (ts.isNumericLiteral(node.right)) {
            const leftText = node.left.getText();
            if (METRIC_IDENTIFIER_PATTERN.test(leftText)) {
              const { line, column } = getPosition(node.getStart());
              metricDefaults.push({
                file: relativeFile,
                line,
                column,
                operator: op === ts.SyntaxKind.BarBarToken ? "||" : "??",
                identifier: leftText,
                defaultValue: Number(node.right.text),
                snippet: node.getText(),
              });
            }
          }
        }
      }

      // 3. Math.random() calls
      if (ts.isCallExpression(node)) {
        const expr = node.expression;
        if (ts.isPropertyAccessExpression(expr)) {
          if (expr.expression.getText() === "Math" && expr.name.text === "random") {
            const { line, column } = getPosition(node.getStart());
            smells.push({
              file: relativeFile,
              line,
              column,
              type: "math_random",
              detail: "Math.random() call in source code",
              snippet: node.getText(),
            });
          }
        }
      }

      // 4. Non-null assertions (!)
      if (ts.isNonNullExpression(node)) {
        const { line, column } = getPosition(node.getStart());
        smells.push({
          file: relativeFile,
          line,
          column,
          type: "non_null_assertion",
          detail: `Non-null assertion on '${node.expression.getText()}'`,
          snippet: node.getText(),
        });
      }

      // 5. any keyword in type declarations
      if (node.kind === ts.SyntaxKind.AnyKeyword) {
        const { line, column } = getPosition(node.getStart());
        smells.push({
          file: relativeFile,
          line,
          column,
          type: "any_keyword",
          detail: "Explicit 'any' type keyword usage",
          snippet: node.parent?.getText()?.slice(0, 100) || "any",
        });
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    // 6. Comments: scan for eslint-disable, ts-ignore, ts-expect-error
    const lines = code.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i]!;
      if (
        lineText.includes("eslint-disable") ||
        lineText.includes("@ts-ignore") ||
        lineText.includes("@ts-expect-error")
      ) {
        smells.push({
          file: relativeFile,
          line: i + 1,
          column: 1,
          type: "compiler_ignore",
          detail: lineText.trim(),
          snippet: lineText.trim(),
        });
      }
    }
  }

  // Summary counts
  const catchByClassification: Record<CatchClassification, number> = {
    empty: 0,
    comment_only: 0,
    log_only: 0,
    rethrow: 0,
    error_response: 0,
    fallback_value: 0,
    other: 0,
  };

  for (const cb of catchBlocks) {
    catchByClassification[cb.classification] = (catchByClassification[cb.classification] || 0) + 1;
  }

  const totalMathRandom = smells.filter((s) => s.type === "math_random").length;
  const totalNonNullAssertions = smells.filter((s) => s.type === "non_null_assertion").length;
  const totalAnyKeywords = smells.filter((s) => s.type === "any_keyword").length;
  const totalCompilerIgnores = smells.filter((s) => s.type === "compiler_ignore").length;

  return {
    generatedAt: new Date().toISOString(),
    totalFilesAudited: sourceFiles.length,
    summary: {
      totalCatchBlocks: catchBlocks.length,
      catchByClassification,
      totalMetricDefaults: metricDefaults.length,
      totalMathRandom,
      totalNonNullAssertions,
      totalAnyKeywords,
      totalCompilerIgnores,
    },
    catchBlocks,
    metricDefaults,
    smells,
  };
}

// Standalone execution
const isMain = process.argv[1] && (
  process.argv[1] === fileURLToPath(import.meta.url) ||
  process.argv[1].endsWith("fallbacks.ts")
);

if (isMain) {
  const result = analyzeFallbacks();
  const outDir = path.join(process.cwd(), "docs/audit");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const outFile = path.join(outDir, "fallbacks.json");
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2), "utf-8");
  console.log(`[fallbacks] Audited ${result.totalFilesAudited} source files.`);
  console.log(`  - Catch blocks: ${result.summary.totalCatchBlocks} (empty: ${result.summary.catchByClassification.empty}, log-only: ${result.summary.catchByClassification.log_only}, fallback: ${result.summary.catchByClassification.fallback_value})`);
  console.log(`  - Metric defaults (|| / ?? <number>): ${result.summary.totalMetricDefaults}`);
  console.log(`  - Math.random usages: ${result.summary.totalMathRandom}`);
  console.log(`  - Non-null assertions (!): ${result.summary.totalNonNullAssertions}`);
  console.log(`  - Explicit 'any' types: ${result.summary.totalAnyKeywords}`);
  console.log(`  - Compiler ignores (@ts-ignore / eslint-disable): ${result.summary.totalCompilerIgnores}`);
  console.log(`  - Output: ${outFile}`);
}
