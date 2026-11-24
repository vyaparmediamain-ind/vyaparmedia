/**
 * Universal Authorization & Actor Resolution Layer (authz)
 *
 * Implements authoritative actor resolution backed by the 60s Redis cache
 * and authoritative database verification in requireActiveAdmin.
 *
 * Guarantees that demoted, suspended, or banned admins NEVER retain
 * cross-tenant administrative access through stale JWT claims.
 */

import { requireActiveAdmin } from "@/lib/admin-auth";
import { AppError } from "@/lib/errors";

export interface Actor {
  id: string;
  role: string;
  userType?: string | undefined;
  name?: string | null | undefined;
  email?: string | null | undefined;
  isActiveAdmin: boolean;
}

export interface SessionUserLike {
  id?: string | null | undefined;
  name?: string | null | undefined;
  email?: string | null | undefined;
  userType?: string | null | undefined;
  role?: string | null | undefined;
}

export interface SessionLike {
  user?: SessionUserLike | null | undefined;
}

/**
 * Type guard to check if an object satisfies the Actor interface.
 */
export function isActor(val: unknown): val is Actor {
  return (
    typeof val === "object" &&
    val !== null &&
    "id" in val &&
    typeof (val as Record<string, unknown>).id === "string" &&
    "role" in val &&
    typeof (val as Record<string, unknown>).role === "string" &&
    "isActiveAdmin" in val &&
    typeof (val as Record<string, unknown>).isActiveAdmin === "boolean"
  );
}

/**
 * Normalizes an Actor or legacy (callerUserId, isAdmin) tuple into a consistent Actor object.
 * Used by services during the transition to accept either an Actor object or legacy parameters.
 */
export function normalizeActor(
  actorOrUserId:
    | Actor
    | string
    | {
        id: string;
        role?: string | undefined;
        userType?: string | undefined;
        isActiveAdmin?: boolean | undefined;
        email?: string | null | undefined;
        name?: string | null | undefined;
      },
  legacyIsAdmin = false
): Actor {
  if (typeof actorOrUserId === "string") {
    return {
      id: actorOrUserId,
      role: legacyIsAdmin ? "ADMIN" : "USER",
      isActiveAdmin: legacyIsAdmin,
    };
  }

  if (isActor(actorOrUserId)) {
    return actorOrUserId;
  }

  const role = actorOrUserId.role || actorOrUserId.userType || "USER";
  // Security Hardening: Never infer isActiveAdmin from raw JWT/session role alone.
  // Active administrative authority must be verified via requireActiveAdmin or an explicit active admin boolean.
  const activeAdmin =
    actorOrUserId.isActiveAdmin !== undefined
      ? Boolean(actorOrUserId.isActiveAdmin)
      : legacyIsAdmin;

  return {
    id: actorOrUserId.id,
    role,
    userType: actorOrUserId.userType ?? role,
    name: actorOrUserId.name ?? null,
    email: actorOrUserId.email ?? null,
    isActiveAdmin: Boolean(activeAdmin),
  };
}

/**
 * Authoritatively resolves an authenticated session into a validated Actor.
 * If the session claims ADMIN privileges (via userType or role), this performs
 * an authoritative DB/Redis check using requireActiveAdmin.
 *
 * If the admin has been banned, demoted, suspended, or soft-deleted,
 * isActiveAdmin resolves to `false`, stripping all elevated privileges.
 */
export async function resolveActor(session: SessionLike | null | undefined): Promise<Actor> {
  const user = session?.user;
  if (!user || !user.id) {
    throw AppError.unauthorized("Authentication required");
  }

  const role = (user.userType || user.role || "USER").toUpperCase();
  let isActiveAdmin = false;

  if (role === "ADMIN") {
    try {
      await requireActiveAdmin({
        id: user.id,
        email: user.email ?? null,
        userType: "ADMIN",
      });
      isActiveAdmin = true;
    } catch {
      // Failed admin verification: user is suspended, demoted, or deleted
      isActiveAdmin = false;
    }
  }

  return {
    id: user.id,
    role,
    userType: role,
    name: user.name ?? null,
    email: user.email ?? null,
    isActiveAdmin,
  };
}

