import { GuideSchema, type Guide, type GuideUserType } from "@/lib/guides/schema";
import { resolveGuide } from "@/lib/guides/tokens";
import { getGuidesForRoute as matchGuidesForRoute } from "@/lib/guides/route-matcher";

import { INFLUENCER_GUIDES } from "./influencer";
import { BRAND_GUIDES } from "./brand";
import { SCOUT_GUIDES } from "./scout";
import { SHARED_GUIDES } from "./shared";

// Combine public raw guides only - ADMIN_GUIDES are strictly excluded from client bundle
const RAW_PUBLIC_GUIDES: Guide[] = [
  ...INFLUENCER_GUIDES,
  ...BRAND_GUIDES,
  ...SCOUT_GUIDES,
  ...SHARED_GUIDES,
];

// Validate public guides against Zod schema and resolve dynamic tokens
export const PUBLIC_GUIDES: Guide[] = RAW_PUBLIC_GUIDES.map((guide) => {
  const parsed = GuideSchema.parse(guide);
  return resolveGuide(parsed);
});

const PUBLIC_GUIDE_MAP = new Map<string, Guide>(PUBLIC_GUIDES.map((g) => [g.id, g]));

/**
 * Find a public guide by its unique slug ID
 */
export function getPublicGuideById(id: string): Guide | undefined {
  return PUBLIC_GUIDE_MAP.get(id);
}

/**
 * Get all public guides accessible by a specific user role.
 */
export function getPublicGuidesByRole(role: GuideUserType): Guide[] {
  return PUBLIC_GUIDES.filter((guide) => guide.roles.includes(role));
}

/**
 * Get all public guides matching a specific URL route and role.
 */
export function getPublicGuidesForRoute(pathname: string, role?: GuideUserType): Guide[] {
  return matchGuidesForRoute(PUBLIC_GUIDES, pathname, role);
}

export {
  INFLUENCER_GUIDES,
  BRAND_GUIDES,
  SCOUT_GUIDES,
  SHARED_GUIDES,
};
