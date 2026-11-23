/**
 * Route Key Normalization & Cardinality Bounding
 *
 * Maps dynamic application URL paths to a bounded set of canonical route keys.
 * Conforms to strict cardinality limits to protect telemetry databases and indexes.
 *
 * Pure logic: no prisma, no fetch, no Date.now, clock injected if needed.
 */

export const CANONICAL_ROUTE_KEYS = [
  "/",
  "/creator/[username]",
  "/brand/[id]",
  "/dashboard",
  "/dashboard/campaigns",
  "/dashboard/campaigns/create",
  "/dashboard/campaigns/[id]",
  "/dashboard/campaigns/[id]/analytics",
  "/dashboard/deals",
  "/dashboard/deals/[id]",
  "/dashboard/wallet",
  "/dashboard/settings",
  "/dashboard/influencers",
  "/pricing",
  "/privacy",
  "/cookie-policy",
  "/admin",
  "/auth",
  "/other",
] as const;

export type CanonicalRouteKey = (typeof CANONICAL_ROUTE_KEYS)[number];

export interface ExtractedRouteIdentifiers {
  username?: string | undefined;
  campaignId?: string | undefined;
  brandId?: string | undefined;
  dealId?: string | undefined;
}

/**
 * Normalizes an arbitrary pathname into a bounded canonical route key.
 * Any unrecognized or unbound path resolves to "/other".
 */
export function normalizeRouteKey(pathname: string | null | undefined): CanonicalRouteKey {
  if (!pathname || typeof pathname !== "string") {
    return "/other";
  }

  // Strip query strings, hash fragments, and normalize slashes
  const cleanPath = pathname
    .split(/[?#]/)[0]
    ?.trim()
    .replace(/\/+$/, "") || "/";

  if (cleanPath === "") return "/";
  if (cleanPath === "/") return "/";

  // Static top-level pages
  if (cleanPath === "/privacy") return "/privacy";
  if (cleanPath === "/cookie-policy") return "/cookie-policy";
  if (cleanPath === "/pricing") return "/pricing";
  if (cleanPath === "/dashboard") return "/dashboard";
  if (cleanPath === "/dashboard/campaigns") return "/dashboard/campaigns";
  if (cleanPath === "/dashboard/campaigns/create") return "/dashboard/campaigns/create";
  if (cleanPath === "/dashboard/deals") return "/dashboard/deals";
  if (cleanPath === "/dashboard/wallet") return "/dashboard/wallet";
  if (cleanPath === "/dashboard/influencers") return "/dashboard/influencers";

  // Settings and its tabs
  if (cleanPath === "/dashboard/settings" || cleanPath.startsWith("/dashboard/settings/")) {
    return "/dashboard/settings";
  }

  // Admin routes (bounded to /admin)
  if (cleanPath === "/admin" || cleanPath.startsWith("/admin/")) {
    return "/admin";
  }

  // Auth routes (login, register, signin, etc.)
  if (
    cleanPath === "/login" ||
    cleanPath === "/register" ||
    cleanPath.startsWith("/auth/") ||
    cleanPath.startsWith("/api/auth/")
  ) {
    return "/auth";
  }

  // Dynamic route: /creator/[username]
  const creatorMatch = /^\/creator\/([^/]+)$/.exec(cleanPath);
  if (creatorMatch?.[1]) {
    return "/creator/[username]";
  }

  // Dynamic route: /brand/[id]
  const brandMatch = /^\/brand\/([^/]+)$/.exec(cleanPath);
  if (brandMatch?.[1]) {
    return "/brand/[id]";
  }

  // Dynamic route: /dashboard/campaigns/[id]/analytics
  const campaignAnalyticsMatch = /^\/dashboard\/campaigns\/([^/]+)\/analytics$/.exec(cleanPath);
  if (campaignAnalyticsMatch?.[1]) {
    return "/dashboard/campaigns/[id]/analytics";
  }

  // Dynamic route: /dashboard/campaigns/[id]
  const campaignDetailMatch = /^\/dashboard\/campaigns\/([^/]+)$/.exec(cleanPath);
  if (campaignDetailMatch?.[1]) {
    return "/dashboard/campaigns/[id]";
  }

  // Dynamic route: /dashboard/deals/[id]
  const dealDetailMatch = /^\/dashboard\/deals\/([^/]+)$/.exec(cleanPath);
  if (dealDetailMatch?.[1]) {
    return "/dashboard/deals/[id]";
  }

  // Strict cardinality bounding fallback
  return "/other";
}

/**
 * Extracts entity identifiers from known dynamic paths for cached DB lookups.
 */
export function extractRouteIdentifiers(pathname: string | null | undefined): ExtractedRouteIdentifiers {
  if (!pathname || typeof pathname !== "string") {
    return {};
  }

  const cleanPath = pathname
    .split(/[?#]/)[0]
    ?.trim()
    .replace(/\/+$/, "") || "/";

  // /creator/[username]
  const creatorMatch = /^\/creator\/([^/]+)$/.exec(cleanPath);
  if (creatorMatch?.[1]) {
    return {
      username: decodeURIComponent(creatorMatch[1]).replace(/^@/, "").trim(),
    };
  }

  // /brand/[id]
  const brandMatch = /^\/brand\/([^/]+)$/.exec(cleanPath);
  if (brandMatch?.[1]) {
    return {
      brandId: decodeURIComponent(brandMatch[1]).trim(),
    };
  }

  // /dashboard/campaigns/[id]/analytics
  const campaignAnalyticsMatch = /^\/dashboard\/campaigns\/([^/]+)\/analytics$/.exec(cleanPath);
  if (campaignAnalyticsMatch?.[1]) {
    return {
      campaignId: decodeURIComponent(campaignAnalyticsMatch[1]).trim(),
    };
  }

  // /dashboard/campaigns/[id]
  const campaignDetailMatch = /^\/dashboard\/campaigns\/([^/]+)$/.exec(cleanPath);
  if (campaignDetailMatch?.[1]) {
    return {
      campaignId: decodeURIComponent(campaignDetailMatch[1]).trim(),
    };
  }

  // /dashboard/deals/[id]
  const dealMatch = /^\/dashboard\/deals\/([^/]+)$/.exec(cleanPath);
  if (dealMatch?.[1]) {
    return {
      dealId: decodeURIComponent(dealMatch[1]).trim(),
    };
  }

  return {};
}
