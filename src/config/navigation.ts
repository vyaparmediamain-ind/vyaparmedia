export type NavRoleId = "INFLUENCER" | "BRAND" | "ADMIN";

export type NavIconType =
  | "home"
  | "discover"
  | "creators"
  | "deals"
  | "campaigns"
  | "messages"
  | "profile"
  | "admin";

export interface NavItemConfig {
  id: string;
  label: string;
  href: string;
  icon: NavIconType;
  badgeKey?: "unreadMessages" | "activeDeals" | "pendingReviews";
  allowedRoles: NavRoleId[];
  ariaLabel: string;
}

export interface CreateActionConfig {
  label: string;
  shortLabel: string;
  href: string;
  ariaLabel: string;
  actionType: "create-campaign" | "submit-content";
}

/**
 * Influencer Navigation (Max 5 items)
 * Home (feed) / Discover (campaigns) / Deals / Messages / Profile
 */
export const INFLUENCER_NAV_ITEMS: NavItemConfig[] = [
  {
    id: "influencer-home",
    label: "Home",
    href: "/dashboard",
    icon: "home",
    allowedRoles: ["INFLUENCER"],
    ariaLabel: "Navigate to Influencer Home Feed",
  },
  {
    id: "influencer-discover",
    label: "Discover",
    href: "/dashboard/campaigns",
    icon: "discover",
    allowedRoles: ["INFLUENCER"],
    ariaLabel: "Discover Brand Campaigns",
  },
  {
    id: "influencer-deals",
    label: "Deals",
    href: "/dashboard/deals",
    icon: "deals",
    badgeKey: "activeDeals",
    allowedRoles: ["INFLUENCER"],
    ariaLabel: "View My Escrow Deals & Submissions",
  },
  {
    id: "influencer-messages",
    label: "Messages",
    href: "/dashboard/messages",
    icon: "messages",
    badgeKey: "unreadMessages",
    allowedRoles: ["INFLUENCER"],
    ariaLabel: "View Brand Messages and Chats",
  },
  {
    id: "influencer-profile",
    label: "Profile",
    href: "/dashboard/settings",
    icon: "profile",
    allowedRoles: ["INFLUENCER"],
    ariaLabel: "View Profile and Wallet Settings",
  },
];

/**
 * Brand Navigation (Max 5 items)
 * Home (dashboard) / Creators (discover) / Campaigns / Messages / Profile
 */
export const BRAND_NAV_ITEMS: NavItemConfig[] = [
  {
    id: "brand-home",
    label: "Home",
    href: "/dashboard",
    icon: "home",
    allowedRoles: ["BRAND"],
    ariaLabel: "Navigate to Brand Dashboard",
  },
  {
    id: "brand-creators",
    label: "Creators",
    href: "/dashboard/influencers",
    icon: "creators",
    allowedRoles: ["BRAND"],
    ariaLabel: "Discover Influencer & Creator Profiles",
  },
  {
    id: "brand-campaigns",
    label: "Campaigns",
    href: "/dashboard/campaigns",
    icon: "campaigns",
    allowedRoles: ["BRAND"],
    ariaLabel: "Manage Brand Campaigns & Briefs",
  },
  {
    id: "brand-messages",
    label: "Messages",
    href: "/dashboard/messages",
    icon: "messages",
    badgeKey: "unreadMessages",
    allowedRoles: ["BRAND"],
    ariaLabel: "View Creator Messages and Chats",
  },
  {
    id: "brand-profile",
    label: "Profile",
    href: "/dashboard/settings",
    icon: "profile",
    allowedRoles: ["BRAND"],
    ariaLabel: "View Brand Profile and Billing Settings",
  },
];

/**
 * Admin Navigation fallback
 */
export const ADMIN_NAV_ITEMS: NavItemConfig[] = [
  {
    id: "admin-home",
    label: "Dashboard",
    href: "/dashboard",
    icon: "home",
    allowedRoles: ["ADMIN"],
    ariaLabel: "System Overview",
  },
  {
    id: "admin-campaigns",
    label: "Campaigns",
    href: "/dashboard/campaigns",
    icon: "campaigns",
    allowedRoles: ["ADMIN"],
    ariaLabel: "Manage All Campaigns",
  },
  {
    id: "admin-deals",
    label: "Deals",
    href: "/dashboard/deals",
    icon: "deals",
    allowedRoles: ["ADMIN"],
    ariaLabel: "Manage Escrow Deals",
  },
  {
    id: "admin-messages",
    label: "Messages",
    href: "/dashboard/messages",
    icon: "messages",
    allowedRoles: ["ADMIN"],
    ariaLabel: "Support & Messaging",
  },
  {
    id: "admin-panel",
    label: "Admin Panel",
    href: "/admin",
    icon: "admin",
    allowedRoles: ["ADMIN"],
    ariaLabel: "Full Platform Admin Control Panel",
  },
];

/**
 * Resolves the primary 5-item navigation list for the user role
 */
export function getNavigationItems(userType: string | null | undefined): NavItemConfig[] {
  const normalized = (userType || "").toUpperCase();
  if (normalized === "ADMIN") {
    return ADMIN_NAV_ITEMS;
  }
  if (normalized === "BRAND" || normalized === "INDIVIDUAL") {
    return BRAND_NAV_ITEMS;
  }
  return INFLUENCER_NAV_ITEMS;
}

/**
 * Context-aware "Create" action configuration
 * Brand -> New Campaign
 * Influencer -> Submit Content
 */
export function getCreateActionConfig(userType: string | null | undefined): CreateActionConfig {
  const normalized = (userType || "").toUpperCase();
  if (normalized === "BRAND" || normalized === "INDIVIDUAL") {
    return {
      label: "New Campaign",
      shortLabel: "Create",
      href: "/dashboard/campaigns/create",
      ariaLabel: "Create a new influencer marketing campaign",
      actionType: "create-campaign",
    };
  }
  return {
    label: "Submit Content",
    shortLabel: "Submit",
    href: "/dashboard/deals?action=submit",
    ariaLabel: "Submit completed deliverables for review",
    actionType: "submit-content",
  };
}

/**
 * Role-based route guard definition:
 * Maps routes that are strictly restricted to specific roles.
 */
export const RESTRICTED_ROUTES: Record<string, NavRoleId[]> = {
  "/dashboard/campaigns/create": ["BRAND", "ADMIN"],
  "/dashboard/influencers": ["BRAND", "ADMIN"],
  "/dashboard/applications": ["INFLUENCER", "ADMIN"],
  "/admin": ["ADMIN"],
};

/**
 * Checks if a user role can access a given pathname
 */
export function isRouteAllowedForRole(
  pathname: string,
  userType: string | null | undefined
): boolean {
  const normalized = (userType || "INFLUENCER").toUpperCase() as NavRoleId;

  for (const [restrictedPrefix, allowedRoles] of Object.entries(RESTRICTED_ROUTES)) {
    if (pathname === restrictedPrefix || pathname.startsWith(`${restrictedPrefix}/`)) {
      return allowedRoles.includes(normalized);
    }
  }

  return true;
}

/**
 * Escrow Deal Progress Calculator for Stories Bar
 */
export interface DealProgressMeta {
  percentage: number;
  stageName: string;
  ringColorClass: string; // Tailwind color token
  strokeHex: string;
  isDisputed: boolean;
}

export function calculateDealProgress(state: string): DealProgressMeta {
  const normalized = state.toUpperCase();

  switch (normalized) {
    case "DRAFT":
      return {
        percentage: 10,
        stageName: "Draft",
        ringColorClass: "text-muted-foreground",
        strokeHex: "#9497A7",
        isDisputed: false,
      };
    case "APPLIED":
      return {
        percentage: 25,
        stageName: "Applied",
        ringColorClass: "text-primary",
        strokeHex: "#2563EB",
        isDisputed: false,
      };
    case "ACCEPTED":
      return {
        percentage: 40,
        stageName: "Accepted",
        ringColorClass: "text-primary",
        strokeHex: "#2563EB",
        isDisputed: false,
      };
    case "PAYMENT_HELD":
      return {
        percentage: 55,
        stageName: "Escrow Locked",
        ringColorClass: "text-escrow",
        strokeHex: "#1168E3",
        isDisputed: false,
      };
    case "CONTENT_SUBMITTED":
      return {
        percentage: 75,
        stageName: "In Review",
        ringColorClass: "text-pending",
        strokeHex: "#C47D08",
        isDisputed: false,
      };
    case "CONTENT_APPROVED":
      return {
        percentage: 90,
        stageName: "Approved",
        ringColorClass: "text-verified",
        strokeHex: "#159359",
        isDisputed: false,
      };
    case "PAYOUT_INITIATED":
    case "COMPLETED":
      return {
        percentage: 100,
        stageName: "Completed",
        ringColorClass: "text-verified",
        strokeHex: "#159359",
        isDisputed: false,
      };
    case "DISPUTED":
      return {
        percentage: 60,
        stageName: "Disputed",
        ringColorClass: "text-disputed",
        strokeHex: "#DE2134",
        isDisputed: true,
      };
    case "CANCELLED":
    default:
      return {
        percentage: 0,
        stageName: "Inactive",
        ringColorClass: "text-muted-foreground",
        strokeHex: "#6E7180",
        isDisputed: false,
      };
  }
}
