import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("SMELL-SQL-01: Runtime DDL Elimination & Migration Canonicalization", () => {
  const rootDir = process.cwd();

  it("ensures src/lib/db.ts does not execute runtime DDL triggers via $executeRawUnsafe", () => {
    const dbSource = fs.readFileSync(path.join(rootDir, "src/lib/db.ts"), "utf-8");
    expect(dbSource).not.toContain("CREATE OR REPLACE FUNCTION protect_platform_treasury");
    expect(dbSource).not.toContain("trg_protect_treasury");
    expect(dbSource).not.toContain("platformTreasuryDdlInstalled");
  });

  it("ensures canonical migration 20261011010000_protect_platform_treasury_triggers exists with trigger DDL", () => {
    const migrationPath = path.join(
      rootDir,
      "prisma/migrations/20261011010000_protect_platform_treasury_triggers/migration.sql",
    );
    expect(fs.existsSync(migrationPath)).toBe(true);

    const migrationContent = fs.readFileSync(migrationPath, "utf-8");
    expect(migrationContent).toContain("protect_platform_treasury()");
    expect(migrationContent).toContain("protect_platform_treasury_wallet()");
    expect(migrationContent).toContain("trg_protect_treasury");
    expect(migrationContent).toContain("trg_protect_treasury_wallet");
  });
});
