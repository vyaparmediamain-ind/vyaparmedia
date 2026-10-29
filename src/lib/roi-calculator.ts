/**
 * Pure, isomorphic ROI and CPV Calculation Utilities
 * Safe for both Client Components and Server-side Services.
 */

export const CATEGORY_BASELINE_CPV_PAISE: Record<string, number> = {
  // High-value / Niche Conversion (High Ticket)
  finance: 120, // ₹1.20 CPV baseline
  business: 100, // ₹1.00 CPV baseline
  "real estate": 150, // ₹1.50 CPV baseline
  automotive: 110, // ₹1.10 CPV baseline
  auto: 110,
  technology: 65, // ₹0.65 CPV baseline
  tech: 65,
  education: 60, // ₹0.60 CPV baseline
  health: 55, // ₹0.55 CPV baseline

  // Mid-Market / Targeted Lifestyle & Creator Niches
  parenting: 45, // ₹0.45 CPV baseline
  fitness: 40, // ₹0.40 CPV baseline
  travel: 35, // ₹0.35 CPV baseline
  sports: 35, // ₹0.35 CPV baseline
  food: 30, // ₹0.30 CPV baseline
  beauty: 30, // ₹0.30 CPV baseline
  pets: 30, // ₹0.30 CPV baseline
  lifestyle: 28, // ₹0.28 CPV baseline
  fashion: 25, // ₹0.25 CPV baseline
  art: 25, // ₹0.25 CPV baseline

  // High-Volume / Viral Mass Categories
  gaming: 18, // ₹0.18 CPV baseline
  music: 18, // ₹0.18 CPV baseline
  entertainment: 15, // ₹0.15 CPV baseline
};

export const DEFAULT_BASELINE_CPV_PAISE = 35; // Global platform baseline: ₹0.35 CPV

/**
 * Synchronous in-memory lookup for category baseline CPV based on industry seeded benchmarks.
 */
export function getCategoryBaselineCpvSync(targetCategories: string[]): number {
  if (!targetCategories || targetCategories.length === 0) {
    return DEFAULT_BASELINE_CPV_PAISE;
  }

  const matchedBaselines: number[] = [];
  for (const cat of targetCategories) {
    const normalized = cat.trim().toLowerCase();
    if (CATEGORY_BASELINE_CPV_PAISE[normalized] !== undefined) {
      matchedBaselines.push(CATEGORY_BASELINE_CPV_PAISE[normalized]!);
    } else {
      const foundKey = Object.keys(CATEGORY_BASELINE_CPV_PAISE).find(
        (k) => normalized.includes(k) || k.includes(normalized)
      );
      if (foundKey && CATEGORY_BASELINE_CPV_PAISE[foundKey] !== undefined) {
        matchedBaselines.push(CATEGORY_BASELINE_CPV_PAISE[foundKey]!);
      }
    }
  }

  if (matchedBaselines.length === 0) {
    return DEFAULT_BASELINE_CPV_PAISE;
  }

  const sum = matchedBaselines.reduce((a, b) => a + b, 0);
  return Math.round(sum / matchedBaselines.length);
}

/**
 * Relative ROI-Scoring Algorithm benchmarked against top enterprise influencer platforms.
 * Compares the influencer's estimated CPV against the category's market baseline.
 * Produces a relative score (10-100) with smooth linear interpolation.
 */
export function calculateRoiScore(
  cpvPaise: number,
  categoryOrBaseline?: number | string | string[]
): number {
  if (cpvPaise <= 0) return 100;

  let baseline = DEFAULT_BASELINE_CPV_PAISE;

  if (typeof categoryOrBaseline === "number") {
    baseline = Math.max(1, categoryOrBaseline);
  } else if (typeof categoryOrBaseline === "string") {
    baseline = getCategoryBaselineCpvSync([categoryOrBaseline]);
  } else if (Array.isArray(categoryOrBaseline) && categoryOrBaseline.length > 0) {
    baseline = getCategoryBaselineCpvSync(categoryOrBaseline);
  }

  const efficiencyRatio = cpvPaise / baseline;

  // 1. Highly Efficient (CPV <= 40% of category baseline): Score 95 - 100
  if (efficiencyRatio <= 0.4) {
    const fraction = (0.4 - efficiencyRatio) / 0.4;
    return Math.min(100, Math.round(95 + fraction * 5));
  }
  // 2. Superior ROI (40% < CPV <= 80% of category baseline): Score 85 - 95
  if (efficiencyRatio <= 0.8) {
    const fraction = (0.8 - efficiencyRatio) / 0.4;
    return Math.round(85 + fraction * 10);
  }
  // 3. Competitive / Fair Market (80% < CPV <= 120% of category baseline): Score 70 - 85
  if (efficiencyRatio <= 1.2) {
    const fraction = (1.2 - efficiencyRatio) / 0.4;
    return Math.round(70 + fraction * 15);
  }
  // 4. Moderate / Premium Pricing (120% < CPV <= 200% of category baseline): Score 50 - 70
  if (efficiencyRatio <= 2.0) {
    const fraction = (2.0 - efficiencyRatio) / 0.8;
    return Math.round(50 + fraction * 20);
  }
  // 5. Expensive relative to delivery (200% < CPV <= 350% of category baseline): Score 30 - 50
  if (efficiencyRatio <= 3.5) {
    const fraction = (3.5 - efficiencyRatio) / 1.5;
    return Math.round(30 + fraction * 20);
  }
  // 6. Substantially Overpriced (CPV > 350% of category baseline): Score 10 - 30
  return Math.max(10, Math.round(30 - (efficiencyRatio - 3.5) * 5));
}
