/**
 * Seed Badges Script
 * 
 * This script seeds the badges table with badge definitions from @/lib/badges.
 * Run this script locally to initialize or update badges in the database.
 * 
 * Usage: npx tsx scripts/seed-badges.ts
 */

import prisma from "../src/lib/db";
import { BADGES } from "../src/lib/badges";

export async function seedBadges() {
  console.log("Starting badge seed...");

  let created = 0;
  let updated = 0;

  for (const badge of BADGES) {
    const existing = await prisma.badge.findUnique({
      where: { name: badge.name },
    });

    if (existing) {
      await prisma.badge.update({
        where: { id: existing.id },
        data: {
          description: badge.description,
          icon: badge.icon,
          category: badge.category,
          xpReward: badge.xpReward,
        },
      });
      console.log(`Updated badge: ${badge.name}`);
      updated++;
    } else {
      await prisma.badge.create({
        data: {
          name: badge.name,
          description: badge.description,
          icon: badge.icon,
          category: badge.category,
          xpReward: badge.xpReward,
          criteria: {},
        },
      });
      console.log(`Created badge: ${badge.name}`);
      created++;
    }
  }

  console.log(`\nBadge seed complete: ${created} created, ${updated} updated`);
}

if (require.main === module) {
  seedBadges()
    .then(() => {
      console.log("Done!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Error seeding badges:", error);
      process.exit(1);
    });
}
