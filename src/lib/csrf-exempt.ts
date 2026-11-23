/**
 * CSRF Exemption Rules
 * Pure configuration and matcher for middleware CSRF checks.
 */

export const CSRF_EXEMPT_EXACT = [
  "/api/telemetry/track",
] as const;

export const CSRF_EXEMPT_PREFIXES = [
  "/api/payments/webhook",
  "/api/webhooks/",
  "/api/jobs/",
  "/api/cron/",
  // Public NextAuth internal handlers (have their own anti-CSRF token verification)
  "/api/auth/callback",
  "/api/auth/signin",
  "/api/auth/signout",
  "/api/auth/session",
  "/api/auth/csrf",
  "/api/auth/providers",
  // External OAuth redirect callbacks
  "/api/auth/digilocker/callback",
  "/api/auth/instagram/callback",
  "/api/auth/youtube/callback",
] as const;

export function isCsrfExempt(pathname: string): boolean {
  if (!pathname || typeof pathname !== "string") return false;

  const normalizedPath = pathname.split(/[?#]/)[0] ?? pathname;

  // Exact path check (e.g. telemetry sendBeacon endpoints)
  if ((CSRF_EXEMPT_EXACT as readonly string[]).includes(normalizedPath)) {
    return true;
  }

  // Prefix path checks
  return CSRF_EXEMPT_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix));
}
