import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("DEAD-DEP-02: Remove clsx and tailwind-merge", () => {
  const rootDir = process.cwd();

  it("does not include clsx in package.json dependencies", () => {
    const pkgJson = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
    expect(pkgJson.dependencies["clsx"]).toBeUndefined();
  });

  it("does not include tailwind-merge in package.json dependencies", () => {
    const pkgJson = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
    expect(pkgJson.dependencies["tailwind-merge"]).toBeUndefined();
  });
});
