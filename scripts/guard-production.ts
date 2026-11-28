/**
 * Production Database Guard for Seed and Destructive Scripts
 *
 * Prevents accidental execution of data wipe or test account seeding
 * against production environments, production databases, or unconfirmed remote hosts.
 */

export function assertNotProduction(
  scriptName: string,
  options?: { allowRemoteWithFlag?: boolean; requireWipeConfirmation?: boolean }
) {
  const nodeEnv = process.env.NODE_ENV?.toLowerCase() || "";
  const vercelEnv = process.env.VERCEL_ENV?.toLowerCase() || "";
  const isVercel = process.env.VERCEL === "1";

  // 1. Strict Environment Guard
  if (nodeEnv === "production" || vercelEnv === "production" || (isVercel && vercelEnv !== "development")) {
    console.error(`\n🚨 FATAL ERROR: Refusing to run '${scriptName}' in PRODUCTION environment!`);
    console.error(`   NODE_ENV=${process.env.NODE_ENV}, VERCEL_ENV=${process.env.VERCEL_ENV}`);
    process.exit(1);
  }

  // 2. Database URL parsing & Host check
  const dbUrl = process.env.DATABASE_URL || "";
  if (!dbUrl) {
    console.error(`\n🚨 FATAL ERROR: DATABASE_URL environment variable is not defined.`);
    process.exit(1);
  }

  let dbHost = "";
  try {
    const parsed = new URL(dbUrl);
    dbHost = parsed.hostname.toLowerCase();
  } catch {
    console.error(`\n🚨 FATAL ERROR: Could not parse DATABASE_URL hostname.`);
    process.exit(1);
  }

  const isLocalHost = [
    "localhost",
    "127.0.0.1",
    "::1",
    "postgres",
    "host.docker.internal",
  ].includes(dbHost);

  const hasExplicitFlag =
    process.argv.includes("--i-know-this-is-not-prod") ||
    process.env.ALLOW_REMOTE_DEV_SEED === "true";

  // 3. Unconditional refusal for explicit production indicators in database URL
  const isExplicitProdHost =
    dbHost.includes("prod") ||
    dbUrl.toLowerCase().includes("production") ||
    dbUrl.toLowerCase().includes("vyapar_prod");

  if (isExplicitProdHost) {
    console.error(`\n🚨 FATAL ERROR: Refusing to run '${scriptName}' against a production database (${dbHost})!`);
    process.exit(1);
  }

  // 4. Remote database confirmation
  if (!isLocalHost) {
    if (!options?.allowRemoteWithFlag || !hasExplicitFlag) {
      console.error(`\n🚨 FATAL ERROR: Remote database detected for '${scriptName}': ${dbHost}`);
      console.error(`   To run against a remote dev/staging database, you must explicitly pass:`);
      console.error(`   --i-know-this-is-not-prod`);
      process.exit(1);
    }
    console.warn(`\n⚠️  WARNING: Running '${scriptName}' against remote host '${dbHost}' with explicit confirmation.`);
  }

  // 5. Destructive wipe confirmation
  if (options?.requireWipeConfirmation) {
    const hasWipeConfirm =
      process.argv.includes("--confirm-wipe-database") ||
      process.argv.includes("--i-know-this-is-not-prod");

    if (!hasWipeConfirm) {
      console.error(`\n🚨 FATAL ERROR: '${scriptName}' will TRUNCATE ALL DATABASE TABLES.`);
      console.error(`   To proceed, you must pass: --confirm-wipe-database or --i-know-this-is-not-prod`);
      process.exit(1);
    }
  }
}
