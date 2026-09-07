import { AppError } from "@/lib/errors";
import prisma from "@/lib/db";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";

export type AdminSessionUser = {
id?: string | null;
email?: string | null;
userType?: string | null;
};

export type ActiveAdminIdentity = {
id: string;
email: string;
};

/** Cache TTL in seconds short enough to propagate demotions quickly. */
const ADMIN_CACHE_TTL = 60;

/**
* Verify the session user is an ACTIVE, non-deleted ADMIN.
*
* Security model:
* 1. JWT claims are checked first (fast, no I/O).
* 2. A Redis cache is consulted to skip the DB call on repeated requests
* within the same 60-second window.
* 3. On cache-miss the DB is queried and the result is cached.
* 4. Ban / demotion via AdminService.updateUserStatus() deletes the cache
* key immediately (call `invalidateAdminCache(userId)` there), so the
* worst-case propagation delay is 60 seconds, not "until JWT expires".
*/
export async function requireActiveAdmin(
input: AdminSessionUser | null | undefined,
): Promise<ActiveAdminIdentity> {
const email = input?.email?.trim().toLowerCase();

if (input?.userType !== "ADMIN" || !input?.id || !email) {
logger.warn("Unauthorized admin token rejected", { email });
throw AppError.forbidden("Unauthorized: Admin access required");
}

const cacheKey = `admin_verified:${input.id}`;

// --- Redis cache-hit path (~0 ms) ---
try {
const cached = await redis.get(cacheKey);
if (cached === "1") {
// Still valid inside the TTL window skip the DB query.
return { id: input.id, email };
}
} catch (redisErr) {
// Redis is non-critical for auth correctness; fall through to DB check.
logger.warn("[admin-auth] Redis unavailable, falling back to DB check", {
error: String(redisErr),
});
}

// --- DB authoritative check ---
const dbAdmin = await prisma.user.findUnique({
where: { id: input.id },
select: {
id: true,
email: true,
userType: true,
status: true,
deletedAt: true,
},
});

if (
!dbAdmin ||
dbAdmin.deletedAt ||
dbAdmin.userType !== "ADMIN" ||
dbAdmin.status !== "ACTIVE" ||
dbAdmin.email.toLowerCase() !== email
) {
logger.warn("Unauthorized admin database check rejected", {
sessionUserId: input.id,
sessionEmail: email,
dbUserType: dbAdmin?.userType,
dbStatus: dbAdmin?.status,
});
throw AppError.forbidden("Unauthorized: Admin access required");
}

// Populate the cache so subsequent requests skip the DB for 60 seconds.
try {
await redis.set(cacheKey, "1", "EX", ADMIN_CACHE_TTL);
} catch {
// Non-fatal the DB check already succeeded.
}

return { id: dbAdmin.id, email: dbAdmin.email };
}

/**
* Immediately invalidate a user's admin-verification cache entry.
* Call this whenever an admin is demoted, banned, or suspended so that
* the 60-second propagation window is collapsed to near-zero.
*/
export async function invalidateAdminCache(userId: string): Promise<void> {
try {
await redis.del(`admin_verified:${userId}`);
} catch {
// Non-fatal.
}
}
