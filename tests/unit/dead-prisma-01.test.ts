import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("DEAD-PRISMA-01: Elimination of Redundant and Dangerous Root SQL Files", () => {
  const rootDir = process.cwd();
  const prismaDir = path.join(rootDir, "prisma");

  const prohibitedSqlFiles = [
    "add_doc_types.sql",
    "add_transaction_razorpay_order_id.sql",
    "enable-supabase-rls.sql",
    "enterprise_scale_rollback.sql",
    "security-hardening.sql",
    "supabase_defense_in_depth_rls.sql",
  ];

  it.each(prohibitedSqlFiles)("ensures %s is removed from prisma/ root", (fileName) => {
    const filePath = path.join(prismaDir, fileName);
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it("ensures no loose .sql files exist directly in prisma root directory", () => {
    const files = fs.readdirSync(prismaDir);
    const looseSqlFiles = files.filter((f) => f.endsWith(".sql"));
    expect(looseSqlFiles).toEqual([]);
  });
});
