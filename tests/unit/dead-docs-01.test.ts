import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("DEAD-DOCS-01: Elimination of Redundant Alias Documentation Files", () => {
  const rootDir = process.cwd();

  it("ensures redundant 11-byte CLAUDE.md is removed from project root", () => {
    const claudeMdPath = path.join(rootDir, "CLAUDE.md");
    expect(fs.existsSync(claudeMdPath)).toBe(false);
  });

  it("ensures canonical AGENTS.md exists as primary assistant operating standard", () => {
    const agentsMdPath = path.join(rootDir, "AGENTS.md");
    expect(fs.existsSync(agentsMdPath)).toBe(true);
  });
});
