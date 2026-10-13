import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("DEAD-TWIN-02: Remove legacy src/lib/constants.ts shim", () => {
  it("ensures src/lib/constants.ts has been deleted", () => {
    const shimPath = path.join(process.cwd(), "src/lib/constants.ts");
    expect(fs.existsSync(shimPath)).toBe(false);
  });

  it("ensures src/lib/enterprise-trust-guard.ts imports directly from @/constants", () => {
    const guardPath = path.join(process.cwd(), "src/lib/enterprise-trust-guard.ts");
    const content = fs.readFileSync(guardPath, "utf8");
    expect(content).not.toContain('from "./constants"');
    expect(content).toContain('from "@/constants"');
  });
});
