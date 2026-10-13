import { NextRequest } from "next/server";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export interface CsrfValidationResult {
  valid: boolean;
  reason?: string;
}

function extractHostname(urlStr?: string | null): string | null {
  if (!urlStr) return null;
  try {
    return new URL(urlStr).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Validates Origin, Referer, and Sec-Fetch-Site headers on state-changing requests (CSRF Defense).
 * Acts as an additional defense-in-depth layer on top of SameSite cookies.
 */
export function validateCsrfProtection(req: NextRequest): CsrfValidationResult {
  const method = req.method.toUpperCase();

  // Safe read-only methods do not require CSRF check
  if (!MUTATING_METHODS.has(method)) {
    return { valid: true };
  }

  // 1. Sec-Fetch-Site check: Browser-native signal for cross-site requests
  const secFetchSite = req.headers.get("sec-fetch-site");
  if (secFetchSite === "cross-site") {
    return {
      valid: false,
      reason: "Cross-site request rejected (sec-fetch-site: cross-site)",
    };
  }

  // Determine allowed hosts from request and configured app URLs
  const host = req.headers.get("host");
  const forwardedHost = req.headers.get("x-forwarded-host");
  const allowedHosts = new Set<string>();

  if (host) allowedHosts.add(host.toLowerCase());
  if (forwardedHost) allowedHosts.add(forwardedHost.toLowerCase());

  const configuredHosts = [
    extractHostname(process.env.NEXTAUTH_URL),
    extractHostname(process.env.NEXT_PUBLIC_APP_URL),
    extractHostname(process.env.APP_BASE_URL),
  ].filter((h): h is string => Boolean(h));

  for (const h of configuredHosts) {
    allowedHosts.add(h);
  }

  // 2. Origin header validation
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      const originHost = new URL(origin).host.toLowerCase();
      if (!allowedHosts.has(originHost)) {
        return {
          valid: false,
          reason: `Invalid origin: ${originHost} is not an allowed origin`,
        };
      }
      return { valid: true };
    } catch {
      return {
        valid: false,
        reason: "Malformed Origin header",
      };
    }
  }

  // 3. Fallback to Referer header if Origin is omitted
  const referer = req.headers.get("referer");
  if (referer) {
    try {
      const refererHost = new URL(referer).host.toLowerCase();
      if (!allowedHosts.has(refererHost)) {
        return {
          valid: false,
          reason: `Invalid referer: ${refererHost} is not an allowed host`,
        };
      }
      return { valid: true };
    } catch {
      return {
        valid: false,
        reason: "Malformed Referer header",
      };
    }
  }

  // If both Origin and Referer are omitted, allow (e.g. server-to-server or direct curl without browser origin)
  return { valid: true };
}
