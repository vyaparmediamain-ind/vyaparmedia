/**
 * Sync Feature Flags Defaults Script
 *
 * Populates or updates the FeatureFlag database table with human-friendly
 * plain-English descriptions and pre-configured sensible target roles.
 */

import prisma from "@/lib/db";
import { FEATURE_METADATA, type FeatureFlagKey } from "@/lib/feature-flags-metadata";
import { redis } from "@/lib/redis";

async function main() {
  console.log("Synchronizing platform feature flags with plain-English definitions & pre-configured roles...\n");

  for (const [rawKey, meta] of Object.entries(FEATURE_METADATA)) {
    const key = rawKey as FeatureFlagKey;

    await prisma.featureFlag.upsert({
      where: { key },
      create: {
        key,
        enabled: true,
        rolloutPercent: 100,
        allowRoles: [...meta.intendedRoles],
        description: meta.simpleDescription,
        updatedAt: new Date(),
      },
      update: {
        description: meta.simpleDescription,
        allowRoles: [...meta.intendedRoles],
        updatedAt: new Date(),
      },
    });

    try {
      await redis.del(`feature_flag:${key}`);
    } catch {
      // Non-fatal if redis offline
    }

    console.log(`  ✓ [${key}]`);
    console.log(`    Title:       ${meta.title}`);
    console.log(`    Audience:    ${meta.audienceLabel} (${meta.intendedRoles.join(", ")})`);
    console.log(`    Description: ${meta.simpleDescription}\n`);
  }

  console.log("✅ Successfully synchronized all 9 feature flags in database.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error syncing feature flags:", err);
  process.exit(1);
});
