import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("DEAD-SCRIPT-01: Elimination of Redundant Ad-Hoc Test Scripts", () => {
  const rootDir = process.cwd();
  const scriptsDir = path.join(rootDir, "scripts");

  const prohibitedScripts = [
    "test-api-client-errors.ts",
    "test-creator-campaign-search.ts",
    "test-deal-state-machine.ts",
    "test-kyc-fraud-system.ts",
    "test-qstash-architecture.ts",
    "test-rate-limit-abuse-prevention.ts",
    "test-wallet-concurrency.ts",
    "test-webhook-hardening.ts",
  ];

  it.each(prohibitedScripts)("ensures %s is eliminated from scripts/", (scriptName) => {
    const scriptPath = path.join(scriptsDir, scriptName);
    expect(fs.existsSync(scriptPath)).toBe(false);
  });

  it("ensures package.json contains 0 references to ad-hoc test-*.ts scripts", () => {
    const pkgContent = fs.readFileSync(path.join(rootDir, "package.json"), "utf8");
    expect(pkgContent).not.toMatch(/scripts\/test-/);
  });
});
