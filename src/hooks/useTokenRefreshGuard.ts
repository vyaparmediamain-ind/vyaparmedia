"use client";


import { logger } from "@/lib/logger-client";
/**
* useTokenRefreshGuard - Enterprise Frontend Token Freshness Guard
*
* Monitors the NextAuth session token age and:
* 1. Detects sessions that are too old and forces re-authentication.
* 2. Detects clock-skew attacks (token issued "in the future").
* 3. Provides a `requireFreshSession` guard for high-value operations
* like wallet withdrawals and deal signing.
*
* Note: NextAuth does not expose `issuedAt` on the session object by default.
* We use `lastRefreshed` from the JWT token (populated in auth.ts jwt callback)
* and fall back to the session's built-in `expires` timestamp.
*/

import { useSession, signOut } from "next-auth/react";
import { useEffect, useCallback, useRef } from "react";

// Maximum session age before forced re-auth (30 minutes of inactivity)
const MAX_SESSION_AGE_MS = 30 * 60 * 1000;
// Warn threshold (25 minutes)
const WARN_SESSION_AGE_MS = 25 * 60 * 1000;
// Maximum age for a "fresh" session required by sensitive actions (10 minutes)
const SENSITIVE_ACTION_MAX_AGE_MS = 10 * 60 * 1000;
// Maximum clock skew we tolerate (1 minute)
const MAX_CLOCK_SKEW_MS = 60_000;

export function useTokenRefreshGuard() {
const { data: session } = useSession();
const hasSignedOut = useRef(false); // Prevent double-signout

useEffect(() => {
if (!session || hasSignedOut.current) return;

// Strategy: Use `lastRefreshed` from the JWT token if available (set in auth.ts jwt callback).
// Fall back to calculating age from the session `expires` field.
const lastRefreshed = session?.lastRefreshed as
| number
| undefined;
const sessionExpires = session?.expires
? new Date(session.expires).getTime()
: null;

const now = Date.now();

const forceSignOut = (reason: string) => {
  hasSignedOut.current = true;
  signOut({ redirect: false }).finally(() => {
    if (typeof window !== "undefined") {
      window.location.href = `/login?reason=${reason}`;
    }
  });
};

if (lastRefreshed !== undefined && lastRefreshed !== null) {
  // --- Primary path: use lastRefreshed timestamp ---

  // Clock Skew Detection: If token appears to be from the future
  if (lastRefreshed > now + MAX_CLOCK_SKEW_MS) {
    logger.error(
      "[SECURITY][TokenGuard] Clock skew detected. Token issued in the future. Possible manipulation.",
      { lastRefreshed, now, delta: lastRefreshed - now },
    );
    forceSignOut("token_manipulation");
    return;
  }

  const age = now - lastRefreshed;

  if (age > MAX_SESSION_AGE_MS) {
    logger.warn(
      "[SECURITY][TokenGuard] Session too old (lastRefreshed). Forcing sign-out.",
      { ageMinutes: Math.round(age / 60000) },
    );
    forceSignOut("session_expired");
    return;
  }

  if (age > WARN_SESSION_AGE_MS) {
    logger.warn(
      "[SECURITY][TokenGuard] Session nearing expiry. Please re-authenticate soon.",
      { ageMinutes: Math.round(age / 60000) },
    );
  }
} else if (sessionExpires !== null) {
  // --- Fallback path: estimate from session `expires` field ---
  // NextAuth default session maxAge is typically 7 days.
  // We warn/sign out if expires is within 6 hours to nudge re-auth.
  const timeUntilExpiry = sessionExpires - now;
  const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

  if (timeUntilExpiry < 0) {
    logger.warn("[SECURITY][TokenGuard] Session already expired by clock.");
    forceSignOut("session_expired");
    return;
  }

  if (timeUntilExpiry < SIX_HOURS_MS) {
    logger.warn(
      "[SECURITY][TokenGuard] Session expiring soon (via expires field).",
      { hoursRemaining: (timeUntilExpiry / 3600000).toFixed(1) },
    );
  }
}
}, [session]);

/**
* Call this before any high-value action (wallet withdraw, deal signing, etc.).
*
* Returns `true` if the session is fresh enough to proceed.
* Returns `false` (and triggers redirect to login) if re-auth is required.
*/
const requireFreshSession = useCallback(async (): Promise<boolean> => {
if (!session) {
signOut({ redirect: true, callbackUrl: "/login?reason=no_session" });
return false;
}

const lastRefreshed = session?.lastRefreshed as
| number
| undefined;
const now = Date.now();

if (lastRefreshed === undefined || lastRefreshed === null) {
// Cannot verify freshness without lastRefreshed, so deny for safety.
logger.warn(
"[SECURITY][TokenGuard] Cannot verify session freshness (no lastRefreshed). Denying sensitive action.",
);
// Do not force logout; let the user continue with a warning.
// The server-side will enforce the actual authorization
return false;
}

const age = now - lastRefreshed;

if (age > SENSITIVE_ACTION_MAX_AGE_MS) {
logger.warn(
"[SECURITY][TokenGuard] Session too old for sensitive action. Redirecting for re-auth.",
{ ageMinutes: Math.round(age / 60000) },
);
await signOut({
redirect: true,
callbackUrl: `/login?reason=fresh_auth_required&returnTo=${encodeURIComponent(
typeof window !== "undefined" ? window.location.pathname : "/",
)}`,
});
return false;
}

return true;
}, [session]);

return { requireFreshSession };
}
