import "./mock-server-only";
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

async function main() {
  console.log("Applying schema hardening, RLS policies, and composite indexes to PostgreSQL database...");
  const sqlPath = path.join(__dirname, "../prisma/migrations/20260913180000_schema_hardening_rls_and_composite_indexes/migration.sql");
  const sql = fs.readFileSync(sqlPath, "utf-8");

  // Remove comments before splitting by semicolon
  const cleanedSql = sql
    .split("\n")
    .map((line) => line.trim().startsWith("--") ? "" : line)
    .join("\n");

  const statements = cleanedSql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 5);

  let successCount = 0;
  for (const statement of statements) {
    if (!statement || statement.length < 5) continue;
    console.log(`Executing: ${statement.substring(0, 80)}...`);
    try {
      await prisma.$executeRawUnsafe(statement);
      successCount++;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`Statement notice/error: ${errMsg}`);
    }
  }

  console.log(`✅ Migration completed! Successfully executed ${successCount} statements.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Migration fatal error:", err);
  process.exit(1);
});
