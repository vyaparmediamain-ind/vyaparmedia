import { GuideSchema, type Guide, type GuideUserType } from "@/lib/guides/schema";
import { resolveGuide } from "@/lib/guides/tokens";
import { getGuidesForRoute as matchGuidesForRoute } from "@/lib/guides/route-matcher";

import { INFLUENCER_GUIDES } from "./influencer";
import { BRAND_GUIDES } from "./brand";
import { SCOUT_GUIDES } from "./scout";
import { ADMIN_GUIDES } from "./admin";
import { SHARED_GUIDES } from "./shared";

// Combine raw guides
const RAW_GUIDES: Guide[] = [
  ...INFLUENCER_GUIDES,
  ...BRAND_GUIDES,
  ...SCOUT_GUIDES,
  ...ADMIN_GUIDES,
  ...SHARED_GUIDES,
];

// Validate all guides against Zod schema and resolve dynamic tokens
export const ALL_GUIDES: Guide[] = RAW_GUIDES.map((guide) => {
  const parsed = GuideSchema.parse(guide);
  return resolveGuide(parsed);
});

const GUIDE_MAP = new Map<string, Guide>(ALL_GUIDES.map((g) => [g.id, g]));

/**
 * Find a guide by its unique slug ID
 */
export function getGuideById(id: string): Guide | undefined {
  return GUIDE_MAP.get(id);
}

/**
 * Get all guides accessible by a specific user role.
 * If user is not ADMIN, guides with feature flags that are disabled could be filtered in client/service.
 */
export function getGuidesByRole(role: GuideUserType): Guide[] {
  return ALL_GUIDES.filter((guide) => guide.roles.includes(role));
}

/**
 * Get all guides matching a specific URL route and role.
 */
export function getGuidesForCurrentRoute(pathname: string, role?: GuideUserType): Guide[] {
  return matchGuidesForRoute(ALL_GUIDES, pathname, role);
}

export {
  INFLUENCER_GUIDES,
  BRAND_GUIDES,
  SCOUT_GUIDES,
  ADMIN_GUIDES,
  SHARED_GUIDES,
};

export {
  GLOSSARY_TERMS,
  getAllGlossaryTerms,
  getGlossaryTerm,
  getGlossaryTermsByCategory,
  searchGlossary,
} from "./glossary";

