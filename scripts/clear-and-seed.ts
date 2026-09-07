import { PrismaClient } from "@prisma/client";
import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const prisma = new PrismaClient();

async function main() {
  console.log(" Wiping database tables...");

  try {
    // Get all tables in public schema
    const tablenames = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname='public'
    `;

    const tables = tablenames
      .map(({ tablename }) => tablename)
      .filter((name) => name !== "_prisma_migrations")
      .map((name) => `"${name}"`)
      .join(", ");

    if (tables) {
      console.log(`Executing TRUNCATE on tables: ${tables}`);
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
      console.log("Database cleared successfully!");
    } else {
      console.log("No tables found to clear.");
    }
  } catch (error) {
    console.error("Failed to clear database:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }

  console.log("Database clear complete. Running seed script...");

  try {
    const nodeDir = path.dirname(process.execPath);
    const npxBin = process.platform === "win32" ? "npx.cmd" : "npx";
    let npxPath = path.join(nodeDir, npxBin);

    if (!fs.existsSync(npxPath)) {
      npxPath = "npx";
    }

    // Ensure PATH only contains the node directory and system directories to prevent hijacking
    const systemDirs = process.platform === "win32"
      ? [String.raw`C:\Windows\system32`, String.raw`C:\Windows`]
      : ["/usr/bin", "/bin"];
    const safePath = [nodeDir, ...systemDirs].join(process.platform === "win32" ? ";" : ":");

    execSync(`"${npxPath}" tsx -r ./scripts/mock-server-only.js scripts/seed-test-accounts.ts`, {
      stdio: "inherit",
      env: {
        ...process.env,
        PATH: safePath,
      },
    });
    console.log("Seeding complete successfully!");
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }
}

main();
