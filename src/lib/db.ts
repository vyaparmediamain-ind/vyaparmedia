import { AppError } from "@/lib/errors";
import "server-only";

import { PrismaClient, Prisma } from "@prisma/client";
import { encrypt, decrypt } from "./encryption";
import { randomBytes } from "node:crypto";

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
// Log encryption/decryption failures silent failures hide data security issues
logger.warn(
`[DB Security] Failed to process encrypted field "${key}". Data may be stored unprocessed.`,
{ field: key, error: e instanceof Error ? e.message : String(e) },
);
// Retain original value to avoid data corruption, but the warning is raised
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
if (duration > 500) {
// Log slow queries (potential DoS/performance issue) without dumping raw PII data
logger.warn(
`[DB SECURITY] SLOW QUERY DETECTED: ${model}.${operation} took ${duration.toFixed(2)}ms`,
);
}

// --- 5. Enterprise Audit Trail (CDC simulation for sensitive financial models) ---
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
const isProd = process.env.NODE_ENV === "production";

// Connection Pool Configuration
// Enterprise scaling requires a pooler (PgBouncer or Prisma Accelerate)
const poolUrl = process.env.PRISMA_ACCELERATE_URL || process.env.PGBOUNCER_URL;
const datasourceUrl = poolUrl || process.env.DATABASE_URL;

const baseClient = new PrismaClient({
log: !isProd ? ["error", "warn"] : ["error"],
errorFormat: "minimal",
...(poolUrl && datasourceUrl ? { datasourceUrl } : {}),
});

const usesManagedPrismaTransport = Boolean(process.env.PRISMA_ACCELERATE_URL);
const allowInsecureDatabase =
process.env.ALLOW_INSECURE_DATABASE === "true" ||
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

// Warm up database connection pool asynchronously to avoid cold starts
if (!isBuildTime()) {
baseClient.$connect().catch((err) => {
logger.warn("[DB Connection] Failed to pre-connect to database", err);
});
}

return baseClient.$extends({
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
let result = await query(finalArgs);

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
}

export const prisma =
globalForPrisma.prisma ??
(createPrismaClient() as unknown as PrismaClient);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
* Module-level flag: DDL (CREATE OR REPLACE FUNCTION / CREATE TRIGGER) runs at most
* once per Node.js process. This prevents catalog-level lock contention when many
* deal-settlement transactions run concurrently each would otherwise issue 4 raw
* DDL statements inside a FOR-UPDATE-locked transaction, risking deadlocks at scale.
*/
let platformTreasuryDdlInstalled = false;

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

// Install database-level triggers once per process skip if already installed.
// Running DDL inside every deal-settlement transaction takes catalog-level locks;
// with concurrent deal completions this can cause deadlocks. The triggers are
// permanent Postgres objects that only need to be created once.
if (!platformTreasuryDdlInstalled) {
try {
// Use the bare prisma client (not tx) so DDL never participates in the
// business transaction and its locks stay outside the critical path.
await prisma.$executeRawUnsafe(`
CREATE OR REPLACE FUNCTION protect_platform_treasury() RETURNS TRIGGER AS $$
BEGIN
IF OLD.id = 'PLATFORM_TREASURY' THEN
RAISE EXCEPTION 'TREASURY SECURITY: Deletion of the virtual user PLATFORM_TREASURY is prohibited.';
END IF;
RETURN OLD;
END;
$$ LANGUAGE plpgsql;
`);

await prisma.$executeRawUnsafe(`
CREATE OR REPLACE FUNCTION protect_platform_treasury_wallet() RETURNS TRIGGER AS $$
BEGIN
IF OLD."userId" = 'PLATFORM_TREASURY' THEN
RAISE EXCEPTION 'TREASURY SECURITY: Deletion of the PLATFORM_TREASURY wallet is prohibited.';
END IF;
RETURN OLD;
END;
$$ LANGUAGE plpgsql;
`);

await prisma.$executeRawUnsafe(`
DO $$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_protect_treasury') THEN
CREATE TRIGGER trg_protect_treasury
BEFORE DELETE ON "User"
FOR EACH ROW EXECUTE FUNCTION protect_platform_treasury();
END IF;
END $$;
`);

await prisma.$executeRawUnsafe(`
DO $$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_protect_treasury_wallet') THEN
CREATE TRIGGER trg_protect_treasury_wallet
BEFORE DELETE ON "Wallet"
FOR EACH ROW EXECUTE FUNCTION protect_platform_treasury_wallet();
END IF;
END $$;
`);

platformTreasuryDdlInstalled = true;
} catch (triggerError) {
logger.warn("Failed to ensure PLATFORM_TREASURY DB-level delete protection triggers", { error: triggerError });
}
}

return wallet;
}

export default prisma;
