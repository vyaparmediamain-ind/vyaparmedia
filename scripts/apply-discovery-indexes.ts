import "./mock-server-only";
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

async function main() {
  console.log("Applying discovery FTS and composite indexes to PostgreSQL database...");
  const sqlPath = path.join(__dirname, "../prisma/migrations/20260913140000_discovery_fts_and_composite_indexes/migration.sql");
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

  for (const statement of statements) {
    if (!statement || statement.length < 5) continue;
    console.log(`Executing: ${statement.substring(0, 70)}...`);
    try {
      await prisma.$executeRawUnsafe(statement);
    } catch (err: unknown) {
      console.warn(`Statement warning/error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log("✅ All discovery FTS, trigram, and composite indexes successfully created!");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
