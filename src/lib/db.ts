import { AppError } from "@/lib/errors";
import "server-only";

import { PrismaClient, Prisma } from "@prisma/client";
import { encrypt, decrypt } from "./encryption";
import { randomBytes } from "node:crypto";
import { env } from "@/env";

const globalForPrisma = globalThis as unknown as {
prisma: PrismaClient | undefined;
};

const ENCRYPTED_FIELDS = new Set([
"panNumber",
"gstNumber",
"cinNumber",
"bankAccountNumber",
"accountNumber", // BankAccount model field
"upiId",
"twoFactorSecret",
"twoFactorRecoveryCodes", // encrypted at rest contains hashed recovery codes
"gstin",
"itrAcknowledgementNumber",
]);

function isLikelyEncrypted(val: string): boolean {
// Check if it matches our vN:iv:authTag:ciphertext (4 parts) or iv:authTag:ciphertext (3 parts) format
if (typeof val !== "string" || !val.includes(":")) return false;
const parts = val.split(":").length;
return parts === 3 || parts === 4;
}

function processData(
data: Record<string, unknown>,
processFn: (val: string) => string,
_depth: number = 0,
): void {
// Guard: prevent infinite recursion via deeply nested objects (DoS prevention)
if (!data || typeof data !== "object" || _depth > 10) return;

for (const key of Object.keys(data)) {
const value = data[key];
if (ENCRYPTED_FIELDS.has(key) && typeof value === "string") {
try {
data[key] = processFn(value);
} catch (e) {
// Log encryption/decryption failures
logger.error(
`[DB Security] Failed to process encrypted field "${key}".`,
{ field: key, error: e instanceof Error ? e.message : String(e) },
);
// In production, fail closed on encryption writes to prevent writing plaintext PAN or bank accounts to the database
if (env.NODE_ENV === "production" && processFn === encrypt) {
throw AppError.internal(`Failed to encrypt sensitive field "${key}". Operation halted for data protection.`);
}
// Retain original value for decryption or local dev environments
}
} else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
processData(value as Record<string, unknown>, processFn, _depth + 1);
}
}
}

import { logger } from "./logger";

function isBuildTime(): boolean {
return (
process.env.NEXT_PHASE === "phase-production-build" ||
process.env.npm_lifecycle_event === "build" ||
process.argv.join(" ").includes("next build")
);
}

function isLocalDatabaseUrl(url?: string): boolean {
if (!url) return false;

try {
const parsed = new URL(url);
return ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
} catch {
return false;
}
}

function hasDatabaseSsl(url?: string): boolean {
if (!url) return false;
return url.includes("sslmode=require") || url.includes("ssl=true");
}

function isSoftDeletedRecord(item: unknown): boolean {
if (!item || typeof item !== "object") return false;
const record = item as Record<string, unknown>;
return record.deletedAt !== null && record.deletedAt !== undefined;
}

function processRecordField(val: unknown): unknown {
if (Array.isArray(val)) {
return val
.filter((item) => !isSoftDeletedRecord(item))
.map((item) => stripSoftDeletedRecords(item));
}
if (isSoftDeletedRecord(val)) {
return null;
}
return stripSoftDeletedRecords(val);
}

function stripSoftDeletedRecords<T>(data: T): T {
if (!data || typeof data !== "object") return data;

if (Array.isArray(data)) {
return data
.filter((item) => !isSoftDeletedRecord(item))
.map((item) => stripSoftDeletedRecords(item)) as T;
}

const record = data as Record<string, unknown>;
if (isSoftDeletedRecord(record)) {
return null as T;
}

for (const key of Object.keys(record)) {
const val = record[key];
if (val && typeof val === "object") {
record[key] = processRecordField(val);
}
}
return data;
}

const MODELS_WITH_SOFT_DELETE = new Set([
  "User",
  "Campaign",
  "Application",
  "Deal",
  "BankAccount",
  "Transaction",
  "Dispute",
  "DisputeEvidence",
  "Review",
  "Message",
  // InfluencerProfile and BrandProfile have deletedAt columns in the schema.
  // Adding them here ensures the Prisma middleware soft-deletes them consistently
  // instead of relying on manual deletedAt = new Date() calls scattered in routes.
  "InfluencerProfile",
  "BrandProfile",
]);

function applySoftDeleteBeforeQuery<T>(model: string, operation: string, args: T): { operation: string; args: T } {
let finalOperation = operation;
let finalArgs = args;

if (MODELS_WITH_SOFT_DELETE.has(model)) {
// Prevent hard deletes for compliance
if (operation === "delete") {
finalOperation = "update";
const typedArgs = (args || {}) as Record<string, unknown>;
typedArgs["data"] = { deletedAt: new Date() };
finalArgs = typedArgs as unknown as T;
} else if (operation === "deleteMany") {
finalOperation = "updateMany";
const typedArgs = (args || {}) as Record<string, unknown>;
typedArgs["data"] = { deletedAt: new Date() };
finalArgs = typedArgs as unknown as T;
}

// Prevent reading soft-deleted rows implicitly
if (
[
"findFirst",
"findMany",
"count",
"aggregate",
"groupBy",
].includes(operation)
) {
const typedArgs = (args || {}) as Record<string, unknown>;
typedArgs["where"] = { ...(typedArgs["where"] as object), deletedAt: null };
finalArgs = typedArgs as unknown as T;
}
}

return { operation: finalOperation, args: finalArgs };
}

function applyEncryptionBeforeQuery<T>(operation: string, args: T): T {
let finalArgs = args;
if (
["create", "update", "upsert", "createMany", "updateMany"].includes(
operation,
)
) {
const typedArgs = (args || {}) as Record<string, unknown>;
if (typedArgs["data"]) {
processData(typedArgs["data"] as Record<string, unknown>, (val) => {
// Only encrypt if not already encrypted
return isLikelyEncrypted(val) ? val : encrypt(val);
});
}
finalArgs = typedArgs as unknown as T;
}
return finalArgs;
}

function applySoftDeleteAfterQuery<T>(model: string, operation: string, result: T): T {
let finalResult = result;
if (
MODELS_WITH_SOFT_DELETE.has(model) &&
(operation === "findUnique" || operation === "findUniqueOrThrow") &&
finalResult
) {
if (
finalResult &&
typeof finalResult === "object" &&
"deletedAt" in finalResult &&
(finalResult as Record<string, unknown>).deletedAt
) {
if (operation === "findUniqueOrThrow") {
throw AppError.notFound(`${model} not found (soft deleted)`);
}
finalResult = null as unknown as T;
}
}
return finalResult;
}

function applyDecryptionAfterQuery<T>(result: T): void {
if (result && typeof result === "object") {
if (Array.isArray(result)) {
result.forEach((row: unknown) => {
if (row && typeof row === "object") {
processData(row as Record<string, unknown>, (val) => {
return isLikelyEncrypted(val) ? decrypt(val) : val;
});
}
});
} else {
processData(result as Record<string, unknown>, (val) => {
return isLikelyEncrypted(val) ? decrypt(val) : val;
});
}
}
}

function logSlowQueriesAndAudit(model: string, operation: string, duration: number) {
  // During Next.js production build phase (e.g. sitemap / static SSG generation on Vercel),
  // initial cross-region remote database connection establishment / SSL handshake naturally
  // takes 1-3 seconds. We relax the threshold to 5000ms during build phase to avoid false alarms.
  const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
  const defaultThreshold = isBuildPhase ? 5000 : (env.NODE_ENV === "production" ? 1000 : 2000);
  const slowThreshold =
    Number(env.DB_SLOW_QUERY_THRESHOLD_MS || env.SLOW_QUERY_THRESHOLD_MS) ||
    defaultThreshold;

  if (duration > slowThreshold) {
    // Log slow queries (potential DoS/performance issue) without dumping raw PII data
    logger.warn(
      `[DB SECURITY] SLOW QUERY DETECTED: ${model}.${operation} took ${duration.toFixed(2)}ms (threshold: ${slowThreshold}ms)`,
    );
  }

  // Enterprise audit trail for sensitive financial models
  if (
    model &&
["Wallet", "Deal", "Withdrawal", "BankAccount"].includes(model) &&
["create", "update", "delete", "upsert", "updateMany", "deleteMany"].includes(operation)
) {
const auditMessage = `[ENTERPRISE DB AUDIT] Operation: ${operation.toUpperCase()} on Entity: ${model} executed at ${new Date().toISOString()}`;
logger.info(auditMessage, {
// We omit raw args since they might contain plaintext fields right before encryption,
// but we record the event for tracing data lifecycle changes.
duration_ms: duration.toFixed(2)
});
}
}

function createPrismaClient() {
const isProd = env.NODE_ENV === "production";

// Connection Pool Configuration
// Enterprise scaling requires a pooler (PgBouncer or Prisma Accelerate)
const poolUrl = env.PRISMA_ACCELERATE_URL || env.PGBOUNCER_URL;
let datasourceUrl = poolUrl || env.DATABASE_URL;

// In long-running Node.js processes (local dev, test runner, Docker containers),
// connection_limit=1 causes query serialization in Node memory (2s+ slow query queueing).
// Adapt connection_limit to 10 for true parallel multiplexing against Supavisor/PostgreSQL.
const isServerless = env.VERCEL === "1" || Boolean(env.AWS_LAMBDA_FUNCTION_NAME);
if (!isServerless && datasourceUrl && datasourceUrl.includes("connection_limit=1")) {
  datasourceUrl = datasourceUrl.replace(/([?&])connection_limit=1(&|$)/, "$1connection_limit=10$2");
}

const baseClient = new PrismaClient({
  log: !isProd ? ["error", "warn"] : ["error"],
  errorFormat: "minimal",
  ...(datasourceUrl ? { datasourceUrl } : {}),
});

const usesManagedPrismaTransport = Boolean(env.PRISMA_ACCELERATE_URL);
const allowInsecureDatabase =
env.ALLOW_INSECURE_DATABASE === "true" ||
isLocalDatabaseUrl(datasourceUrl);

if (
isProd &&
!usesManagedPrismaTransport &&
!hasDatabaseSsl(datasourceUrl) &&
!allowInsecureDatabase
) {
const message =
"DATABASE_URL must include sslmode=require for remote production databases.";
if (isBuildTime()) {
logger.warn(`[BUILD] ${message}`);
} else {
logger.error(`[SECURITY] ${message}`);
throw AppError.internal(message);
}
}

  // Supavisor / PgBouncer connection-pool validation
  // At 10L-user scale on serverless each cold-start lambda opens its own connection.
  // Without a pooler, Postgres hits its max_connections limit and crashes.
  if (isProd && !usesManagedPrismaTransport && !isBuildTime()) {
    const url = datasourceUrl ?? "";
    const hasSupavisor = url.includes(":6543") || url.includes("pgbouncer=true") || url.includes("pooler.supabase.com");
    const hasBouncer = Boolean(env.PGBOUNCER_URL);
    if (!hasSupavisor && !hasBouncer) {
      logger.warn(
        "[DB CONNECTION] DATABASE_URL does not appear to point to a connection pooler " +
        "(Supavisor port 6543 / pgbouncer=true not detected). " +
        "On serverless (Vercel), this WILL cause connection exhaustion at scale. " +
        "Set DATABASE_URL to the Supavisor pooler URL (port 6543, pgbouncer=true, connection_limit=1) " +
        "and DIRECT_URL to the direct connection (port 5432) for migrations.",
        { datasourceUrl: datasourceUrl?.replace(/:[^@]*@/, ":***@") },
      );
    }
  }

// Warm up database connection pool asynchronously to avoid cold starts
if (!isBuildTime()) {
baseClient.$connect().catch((err) => {
logger.warn("[DB Connection] Failed to pre-connect to database", err);
});
}

  const extendedClient = baseClient.$extends({
query: {
$allModels: {
async $allOperations({ model, operation, args, query }) {
const startTime = performance.now();

// 1. Soft Delete (Before Query)
const sdPre = applySoftDeleteBeforeQuery(model || "", operation, args);
const finalOperation = sdPre.operation;
let finalArgs = sdPre.args;

// 2. Encryption (Before Query)
finalArgs = applyEncryptionBeforeQuery(finalOperation, finalArgs);

      // Execute Query
      let result;
      const modelKey = model ? model.charAt(0).toLowerCase() + model.slice(1) : "";
      const baseRecord = baseClient as unknown as Record<string, { update: (args: unknown) => Promise<unknown>; updateMany: (args: unknown) => Promise<unknown> }>;
      if (MODELS_WITH_SOFT_DELETE.has(model || "") && operation === "delete" && baseRecord[modelKey]) {
        result = await baseRecord[modelKey].update(finalArgs);
      } else if (MODELS_WITH_SOFT_DELETE.has(model || "") && operation === "deleteMany" && baseRecord[modelKey]) {
        result = await baseRecord[modelKey].updateMany(finalArgs);
      } else {
        result = await query(finalArgs);
      }

// 3. Soft Delete (After Query)
result = applySoftDeleteAfterQuery(model || "", finalOperation, result);

// Clean soft deleted relation records recursively
if (result) {
result = stripSoftDeletedRecords(result);
}

// 4. Decryption (After Query)
applyDecryptionAfterQuery(result);

// 5. Query Profiling & Slow Query Alerting & Audit
const duration = performance.now() - startTime;
logSlowQueriesAndAudit(model || "", finalOperation, duration);

return result;
},
},
},
});

// Default interactive transaction options: extend default timeout from 5s to 15s
// and maxWait from 2s to 10s to prevent cloud database WAN latency timeouts.
const originalTx = extendedClient.$transaction.bind(extendedClient);
type TransactionOptions = { maxWait?: number; timeout?: number; [key: string]: unknown };
const extendedWithTx = extendedClient as unknown as {
  $transaction: (arg1: unknown, arg2?: TransactionOptions) => unknown;
};
extendedWithTx.$transaction = function (arg1: unknown, arg2?: TransactionOptions) {
  if (typeof arg1 === "function") {
    const options: TransactionOptions = {
      maxWait: 10000,
      timeout: 15000,
      ...(arg2 || {}),
    };
    return (originalTx as unknown as (fn: unknown, opts: unknown) => unknown)(arg1, options);
  }
  return (originalTx as unknown as (ops: unknown, opts?: unknown) => unknown)(arg1, arg2);
};

return extendedClient;
}

export const prisma =
globalForPrisma.prisma ??
(createPrismaClient() as unknown as PrismaClient);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
* PLATFORM_TREASURY delete-protection triggers are managed canonically
* via Prisma migration `20261011010000_protect_platform_treasury_triggers`.
* No runtime DDL ($executeRawUnsafe) is executed during cold starts.
*/

/**
* Ensures that the PLATFORM_TREASURY user and wallet exist in the database.
* If not, they are created dynamically to prevent transaction failures.
*/
export async function ensurePlatformTreasury(tx?: Prisma.TransactionClient) {
const client = tx || prisma;

const user = await client.user.findUnique({
where: { id: "PLATFORM_TREASURY" },
});

if (!user) {
await client.user.create({
data: {
id: "PLATFORM_TREASURY",
email: "treasury@platform.local",
phone: "+919999999999",
// Cryptographically random not a valid bcrypt hash, so this account can never be logged into.
passwordHash: `sys:${randomBytes(32).toString("hex")}`,
userType: "BRAND",
status: "ACTIVE",
verificationLevel: "FULL",
emailVerified: true,
phoneVerified: true,
},
});
}

let wallet = await client.wallet.findUnique({
where: { userId: "PLATFORM_TREASURY" },
});

if (!wallet) {
wallet = await client.wallet.create({
data: {
userId: "PLATFORM_TREASURY",
balance: 0,
pendingBalance: 0,
},
});
}

// Platform treasury delete-protection triggers are installed via migration 20261011010000_protect_platform_treasury_triggers

return wallet;
}

/**
 * Ensures that the TDS_WITHHOLDING_TREASURY user and wallet exist in the database.
 * Used for strict double-entry tracking of tax liabilities (TDS withheld under Section 194-O / 194J).
 */
export async function ensureTdsTreasury(tx?: Prisma.TransactionClient) {
  const client = tx || prisma;

  const user = await client.user.findUnique({
    where: { id: "TDS_WITHHOLDING_TREASURY" },
  });

  if (!user) {
    await client.user.create({
      data: {
        id: "TDS_WITHHOLDING_TREASURY",
        email: "tds-treasury@platform.local",
        phone: "+919999999998",
        passwordHash: `sys:${randomBytes(32).toString("hex")}`,
        userType: "BRAND",
        status: "ACTIVE",
        verificationLevel: "FULL",
        emailVerified: true,
        phoneVerified: true,
      },
    });
  }

  let wallet = await client.wallet.findUnique({
    where: { userId: "TDS_WITHHOLDING_TREASURY" },
  });

  if (!wallet) {
    wallet = await client.wallet.create({
      data: {
        userId: "TDS_WITHHOLDING_TREASURY",
        balance: 0,
        pendingBalance: 0,
      },
    });
  }

  return wallet;
}

export default prisma;
