/**
 * Feature Flags Client-Safe Metadata and Type Definitions
 *
 * This module is strictly decoupled from server-side dependencies (db, redis, logger, crypto).
 * Safe to import in both Client Components ("use client") and Server Components.
 */

export const FEATURE_FLAGS = {
  CREATOR_METRICS: "creator_metrics",
  FAIR_PRICE: "fair_price",
  FAIR_PRICE_PUBLIC_BADGE: "fair_price_public_badge",
  INSTAGRAM_INSIGHTS: "instagram_insights",
  TELEMETRY_ANONYMOUS: "telemetry_anonymous",
  TELEMETRY_IDENTIFIED: "telemetry_identified",
  CAMPAIGN_HUB: "campaign_hub",
  BRANDED_REPORTS: "branded_reports",
  REPORT_VERIFICATION: "report_verification",
} as const;

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

export interface FeatureFlagMetadata {
  title: string;
  simpleDescription: string;
  intendedRoles: Array<"ADMIN" | "BRAND" | "INFLUENCER" | "SCOUT">;
  audienceLabel: string;
  category: "Reports & Valuation" | "Campaigns & Marketplace" | "Integrations & Tracking";
}

/**
 * Human-readable plain-English metadata, intended audience roles, and clear summaries
 * for all canonical platform feature flags.
 */
export const FEATURE_METADATA: Record<FeatureFlagKey, FeatureFlagMetadata> = {
  branded_reports: {
    title: "Executive Branded PDF Reports",
    simpleDescription:
      "Generates official downloadable PDF and CSV valuation & ROI reports with company letterhead, statutory disclaimers, and tax compliance details.",
    intendedRoles: ["ADMIN", "BRAND", "INFLUENCER"],
    audienceLabel: "Admins, Brands & Creators",
    category: "Reports & Valuation",
  },
  campaign_hub: {
    title: "Campaign Operations Hub",
    simpleDescription:
      "Unified workspace where brands manage live campaigns and creators accept deals, upload content drafts, and track deliverable milestones.",
    intendedRoles: ["ADMIN", "BRAND", "INFLUENCER"],
    audienceLabel: "Brands & Creators",
    category: "Campaigns & Marketplace",
  },
  creator_metrics: {
    title: "Creator Audience & Delivery Analytics",
    simpleDescription:
      "Displays in-depth audience demographics, 12-week historical delivery trends, and engagement rate benchmarks on creator profiles.",
    intendedRoles: ["ADMIN", "BRAND", "INFLUENCER"],
    audienceLabel: "Creators & Brands",
    category: "Reports & Valuation",
  },
  fair_price: {
    title: "AI Fair-Price Valuation Engine",
    simpleDescription:
      "Calculates recommended fair compensation ranges (in INR) based on creator followers, past delivery, and category benchmark CPVs.",
    intendedRoles: ["ADMIN", "BRAND", "INFLUENCER"],
    audienceLabel: "All Marketplace Users",
    category: "Reports & Valuation",
  },
  fair_price_public_badge: {
    title: "Public Fair-Pricing Trust Badge",
    simpleDescription:
      "Shows a verified 'Fair Price Assured' badge on creator discovery cards so brands and scouts can identify trusted creators.",
    intendedRoles: ["ADMIN", "BRAND", "INFLUENCER", "SCOUT"],
    audienceLabel: "Public / All Roles",
    category: "Campaigns & Marketplace",
  },
  instagram_insights: {
    title: "Instagram Graph API Insights Sync",
    simpleDescription:
      "Automatically synchronizes live Instagram reel views, story impressions, and post engagement rates via Meta's Graph API.",
    intendedRoles: ["ADMIN", "INFLUENCER"],
    audienceLabel: "Creators & Admins",
    category: "Integrations & Tracking",
  },
  report_verification: {
    title: "Digital Report Authenticity Verification",
    simpleDescription:
      "Enables tamper-proof verification via cryptographic QR codes and public audit links (/verify-report/[id]) to prove report integrity.",
    intendedRoles: ["ADMIN", "BRAND", "INFLUENCER", "SCOUT"],
    audienceLabel: "Public / All Roles",
    category: "Reports & Valuation",
  },
  telemetry_anonymous: {
    title: "Public Deal View Telemetry",
    simpleDescription:
      "Measures anonymous deal and page impression traffic across the platform without cookies or capturing personal identifiable data.",
    intendedRoles: ["ADMIN", "BRAND", "INFLUENCER", "SCOUT"],
    audienceLabel: "System / Anonymous",
    category: "Integrations & Tracking",
  },
  telemetry_identified: {
    title: "Creator Deliverable & Milestone Tracking",
    simpleDescription:
      "Records verified creator interactions when they submit deliverables, receive brand approvals, and complete contract milestones.",
    intendedRoles: ["ADMIN", "BRAND", "INFLUENCER"],
    audienceLabel: "Creators & Brands",
    category: "Integrations & Tracking",
  },
};

export interface FeatureFlagRecord {
  key: string;
  enabled: boolean;
  rolloutPercent: number;
  allowRoles: string[];
  description: string;
  updatedById?: string | null;
  updatedAt?: Date | string;
}

export interface FeatureFlagContext {
  userId?: string | null | undefined;
  role?: string | null | undefined;
}
