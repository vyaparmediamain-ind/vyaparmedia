import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("DEAD-HOOK-01: Remove unused useChartWidth hook", () => {
  it("ensures src/hooks/useChartWidth.ts has been removed", () => {
    const hookPath = path.join(process.cwd(), "src/hooks/useChartWidth.ts");
    expect(fs.existsSync(hookPath)).toBe(false);
  });
});
