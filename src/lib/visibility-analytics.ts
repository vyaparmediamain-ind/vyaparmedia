/**
 * Visibility & Engagement Analytics (Pure Logic)
 *
 * Rules:
 * - Pure logic: zero prisma, zero fetch, zero Date.now inside (clock injected).
 * - Rates in basis points (100% = 10,000 bps). Round once at the end with Math.round.
 * - Privacy: small-number suppression for counts < 5.
 * - Consenting brands only: never expose unconsented users or creator PII.
 */

export const SMALL_NUMBER_SUPPRESSION_THRESHOLD = 5;

export interface VisibilityTrend {
  trendPercent: number;
  trendBps: number;
  direction: "up" | "down" | "flat";
}

export interface RawBrandViewer {
  userId: string;
  telemetryConsent: boolean;
  role: string | null;
  companyName: string | null;
  activeMs: number;
  createdAt: Date;
}

export interface IdentifiedBrandSummary {
  companyName: string;
  viewsCount: number;
  viewsDisplay: string;
  isSuppressed: boolean;
}

export interface CreatorVisibilityKpis {
  views: number;
  uniqueViewers: number;
  avgTimeOnProfileMs: number;
  avgTimeOnProfileSec: number;
  trendVsPrevious30d: VisibilityTrend;
  applicationsCount: number;
  conversionRatePercent: number;
  conversionRateBps: number;
  identifiedBrands: IdentifiedBrandSummary[];
  totalIdentifiedBrandsCount: number;
  isSmallNumberSuppressed: boolean;
  dataQuality: "VERIFIED" | "ESTIMATED";
}

export interface BrandCampaignVisibilityKpis {
  campaignBriefViews: number;
  uniqueViewers: number;
  avgReadTimeMs: number;
  avgReadTimeSec: number;
  totalApplications: number;
  applicationsPer100Views: number;
  applicationsRateBps: number;
  bestCategories: Array<{
    category: string;
    applicationsCount: number;
    percentShare: number;
  }>;
  dataQuality: "VERIFIED" | "ESTIMATED";
}

/**
 * Calculates percentage trend and basis points between current and previous 30-day windows.
 * Pure logic: handles zero, negative, and extreme values safely.
 */
export function calculateVisibilityTrend(current: number, previous: number): VisibilityTrend {
  if (previous <= 0) {
    if (current > 0) {
      return { trendPercent: 100, trendBps: 10_000, direction: "up" };
    }
    return { trendPercent: 0, trendBps: 0, direction: "flat" };
  }

  const diff = current - previous;
  const trendBps = Math.round((diff / previous) * 10_000);
  const trendPercent = Number(((trendBps / 10_000) * 100).toFixed(1));

  let direction: "up" | "down" | "flat" = "flat";
  if (trendBps > 0) direction = "up";
  else if (trendBps < 0) direction = "down";

  return { trendPercent, trendBps, direction };
}

/**
 * Formats a count with small-number suppression (< 5 -> "<5").
 */
export function applySmallNumberSuppression(
  count: number,
  threshold = SMALL_NUMBER_SUPPRESSION_THRESHOLD
): string {
  if (count < threshold) {
    return `<${threshold}`;
  }
  return String(count);
}

/**
 * Filters identified profile viewers:
 * 1. Must have consented to telemetry (`telemetryConsent === true`).
 * 2. Must be a brand user (`role === "BRAND"` with non-empty `companyName`).
 * 3. Applies small-number suppression ("<5") per brand views and total unique brands.
 */
export function filterAndFormatIdentifiedBrandViewers(
  rawViewers: readonly RawBrandViewer[],
  threshold = SMALL_NUMBER_SUPPRESSION_THRESHOLD
): {
  identifiedBrands: IdentifiedBrandSummary[];
  totalIdentifiedBrandsCount: number;
  isSmallNumberSuppressed: boolean;
} {
  // Filter for consenting brands only
  const brandViewMap = new Map<string, number>();

  for (const v of rawViewers) {
    if (!v.telemetryConsent) continue;
    if (v.role !== "BRAND" && v.role !== "brand") continue;
    const name = v.companyName?.trim();
    if (!name) continue;

    const count = brandViewMap.get(name) ?? 0;
    brandViewMap.set(name, count + 1);
  }

  const totalIdentifiedBrandsCount = brandViewMap.size;
  const isSmallNumberSuppressed = totalIdentifiedBrandsCount < threshold;

  const identifiedBrands: IdentifiedBrandSummary[] = [];

  for (const [companyName, viewsCount] of brandViewMap.entries()) {
    const isSuppressed = viewsCount < threshold;
    const viewsDisplay = isSuppressed ? `<${threshold}` : String(viewsCount);

    identifiedBrands.push({
      companyName,
      viewsCount,
      viewsDisplay,
      isSuppressed,
    });
  }

  // Sort descending by views count, then alphabetically
  identifiedBrands.sort((a, b) => b.viewsCount - a.viewsCount || a.companyName.localeCompare(b.companyName));

  return {
    identifiedBrands,
    totalIdentifiedBrandsCount,
    isSmallNumberSuppressed,
  };
}

/**
 * Calculates conversion efficiency from profile views to deal applications/invites.
 */
export function calculateViewsToConversionRate(
  views: number,
  conversions: number
): {
  conversionRatePercent: number;
  conversionRateBps: number;
} {
  if (views <= 0 || conversions <= 0) {
    return { conversionRatePercent: 0, conversionRateBps: 0 };
  }

  const conversionRateBps = Math.round((conversions / views) * 10_000);
  const conversionRatePercent = Number(((conversionRateBps / 10_000) * 100).toFixed(1));

  return {
    conversionRatePercent,
    conversionRateBps,
  };
}

/**
 * Calculates applications received per 100 campaign brief views.
 */
export function calculateApplicationsPer100Views(
  briefViews: number,
  applications: number
): {
  applicationsPer100Views: number;
  applicationsRateBps: number;
} {
  if (briefViews <= 0 || applications <= 0) {
    return { applicationsPer100Views: 0, applicationsRateBps: 0 };
  }

  const applicationsRateBps = Math.round((applications / briefViews) * 10_000);
  const applicationsPer100Views = Number(((applications / briefViews) * 100).toFixed(1));

  return {
    applicationsPer100Views,
    applicationsRateBps,
  };
}

/**
 * Computes ranked category distribution from campaign applications.
 */
export function rankBestCategories(
  categoriesList: Array<string | string[] | null | undefined>
): Array<{ category: string; applicationsCount: number; percentShare: number }> {
  const tally = new Map<string, number>();
  let totalCount = 0;

  for (const raw of categoriesList) {
    if (!raw) continue;
    const items = Array.isArray(raw) ? raw : String(raw).split(",");
    for (const item of items) {
      const clean = item.trim();
      if (!clean) continue;
      const cur = tally.get(clean) ?? 0;
      tally.set(clean, cur + 1);
      totalCount += 1;
    }
  }

  const results: Array<{ category: string; applicationsCount: number; percentShare: number }> = [];

  for (const [category, applicationsCount] of tally.entries()) {
    const percentShare = totalCount > 0 ? Number(((applicationsCount / totalCount) * 100).toFixed(1)) : 0;
    results.push({
      category,
      applicationsCount,
      percentShare,
    });
  }

  return results.sort((a, b) => b.applicationsCount - a.applicationsCount || a.category.localeCompare(b.category));
}
