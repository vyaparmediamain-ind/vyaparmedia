import type { Guide, GuideUserType } from "./schema";

/**
 * Normalizes a URL path by removing trailing slashes and query strings.
 */
export function normalizePath(path: string): string {
  if (!path) return "/";
  const withoutQuery = path.split("?")[0]?.split("#")[0] || "/";
  if (withoutQuery.length > 1 && withoutQuery.endsWith("/")) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery || "/";
}

/**
 * Converts a Next.js route pattern like `/dashboard/deals/[id]` into a RegExp.
 */
export function routePatternToRegex(pattern: string): RegExp {
  const normalized = normalizePath(pattern);
  const regexStr = normalized
    .replace(/\[\.\.\.[a-zA-Z0-9_]+\]/g, ".+")
    .replace(/\[[a-zA-Z0-9_]+\]/g, "[^/]+");

  return new RegExp(`^${regexStr}$`);
}

/**
 * Checks whether a current pathname matches any of the guide's declared route patterns.
 */
export function matchGuideRoute(guideRoutes: string[], currentPath: string): boolean {
  const normalizedCurrent = normalizePath(currentPath);

  return guideRoutes.some((pattern) => {
    const normalizedPattern = normalizePath(pattern);
    if (normalizedPattern === normalizedCurrent) return true;

    // Pattern with dynamic segments
    if (normalizedPattern.includes("[")) {
      const regex = routePatternToRegex(normalizedPattern);
      if (regex.test(normalizedCurrent)) return true;
    }

    return false;
  });
}

/**
 * Filters a list of guides for a specific user role, route, and active feature flags.
 */
export function getGuidesForRoute(
  guides: Guide[],
  currentPath: string,
  userRole?: GuideUserType | null,
  activeFeatureFlags?: Record<string, boolean>
): Guide[] {
  return guides.filter((guide) => {
    // 1. Role filtering: Guide must support the user's role (or allow if no role specified e.g. public view)
    if (userRole && !guide.roles.includes(userRole)) {
      return false;
    }

    // 2. Feature flag check: If guide is attached to a feature flag that is OFF, hide for non-admins
    if (guide.featureKey && activeFeatureFlags) {
      const isFeatureActive = activeFeatureFlags[guide.featureKey] ?? false;
      const isAdmin = userRole === "ADMIN";
      if (!isFeatureActive && !isAdmin) {
        return false;
      }
    }

    // 3. Route matching
    return matchGuideRoute(guide.routes, currentPath);
  });
}

/**
 * Filters guides for a given user role and active feature flags (for Guide Center view).
 */
export function getGuidesForRole(
  guides: Guide[],
  userRole: GuideUserType,
  activeFeatureFlags?: Record<string, boolean>
): Guide[] {
  return guides.filter((guide) => {
    // Role check
    if (!guide.roles.includes(userRole)) {
      return false;
    }

    // Feature flag check: non-admins do not see guides for disabled flags
    if (guide.featureKey && activeFeatureFlags) {
      const isFeatureActive = activeFeatureFlags[guide.featureKey] ?? false;
      if (!isFeatureActive && userRole !== "ADMIN") {
        return false;
      }
    }

    return true;
  });
}

