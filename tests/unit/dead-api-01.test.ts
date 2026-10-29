import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("DEAD-API-01: Elimination of Unused Attack-Surface API Routes", () => {
  const rootDir = process.cwd();

  it("ensures orphan route /api/admin/benchmarks is eliminated", () => {
    const benchmarksRoute = path.join(rootDir, "src/app/api/admin/benchmarks/route.ts");
    expect(fs.existsSync(benchmarksRoute), "/api/admin/benchmarks/route.ts should be deleted").toBe(false);
  });

  it("ensures orphan route /api/user/reputation is eliminated", () => {
    const reputationRoute = path.join(rootDir, "src/app/api/user/reputation/route.ts");
    expect(fs.existsSync(reputationRoute), "/api/user/reputation/route.ts should be deleted").toBe(false);
  });

  it("verifies /api/admin/ip-blacklist is preserved for ops/curl management", () => {
    const ipBlacklistRoute = path.join(rootDir, "src/app/api/admin/ip-blacklist/route.ts");
    expect(fs.existsSync(ipBlacklistRoute), "/api/admin/ip-blacklist/route.ts must be kept").toBe(true);
  });
});
