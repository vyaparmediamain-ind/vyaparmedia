/**
 * Seed Treasury Script
 *
 * Creates the PLATFORM_TREASURY user and wallet if they do not exist.
 *
 * Run:  npx tsx scripts/seed-treasury.ts
 */

import prisma from "../src/lib/db";
import { randomBytes } from "node:crypto";

export async function seedTreasury() {
  console.log("Seeding PLATFORM_TREASURY user and wallet...");

  const treasuryUser = await prisma.user.upsert({
    where: { id: "PLATFORM_TREASURY" },
    update: {
      status: "ACTIVE",
      verificationLevel: "FULL",
      emailVerified: true,
      phoneVerified: true,
    },
    create: {
      id: "PLATFORM_TREASURY",
      email: "treasury@platform.local",
      phone: "+919999999999",
      // Cryptographically random — not a valid bcrypt hash, so this account can never be logged into.
      passwordHash: `sys:${randomBytes(32).toString("hex")}`,
      userType: "BRAND",
      status: "ACTIVE",
      verificationLevel: "FULL",
      emailVerified: true,
      phoneVerified: true,
    },
  });

  console.log(`+ PLATFORM_TREASURY user seeded (id: ${treasuryUser.id})`);

  const treasuryWallet = await prisma.wallet.upsert({
    where: { userId: "PLATFORM_TREASURY" },
    update: {},
    create: {
      userId: "PLATFORM_TREASURY",
      balance: 0,
      pendingBalance: 0,
    },
  });

  console.log(`+ PLATFORM_TREASURY wallet seeded (id: ${treasuryWallet.id})`);
}

if (require.main === module) {
  seedTreasury()
    .catch((err) => {
      console.error("Failed to seed treasury:", err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
