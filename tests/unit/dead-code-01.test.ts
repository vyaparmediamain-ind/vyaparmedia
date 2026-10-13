import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("DEAD-CODE-01: Remove uncalled filter helpers from campaign list service", () => {
  it("ensures getPlatformCompatibilityCondition and getBudgetCondition are removed from src/services/campaign/list.ts", () => {
    const filePath = path.join(process.cwd(), "src/services/campaign/list.ts");
    const content = fs.readFileSync(filePath, "utf8");
    expect(content).not.toContain("getPlatformCompatibilityCondition");
    expect(content).not.toContain("getBudgetCondition");
  });
});
