import { CreatorRankFactors, CampaignRankFactors } from "./types";

/**
 * Composite Ranking Engine for 1M-scale Creator Discovery & Campaign Search
 * 
 * Replaces naive recency sorting with a multi-factor ranking model:
 * 1. Text Relevance (35%): Full-text search ts_rank_cd + trigram similarity
 * 2. Trust Score (25%): DRS reputation (0-900 normalized)
 * 3. Engagement & Reliability (20%): Engagement rate & on-time delivery
 * 4. Experience & Reviews (10%): Completed deals and star rating
 * 5. Platform Activity (10%): Recency and account age
 * 
 * Featured creators receive a 25% priority multiplier.
 */

export function computeCreatorRankingScore(factors: CreatorRankFactors): number {
  const normRelevance = Math.max(0, Math.min(1, factors.textRelevance));
  // CIBIL range normalization: (score - 300) / (900 - 300)
  const normTrust = Math.max(0, Math.min(1, (factors.trustScore - 300) / 600));
  const normEngagement = Math.max(0, Math.min(1, factors.engagementRate / 10)); // 10% engagement = 1.0
  const normRating = Math.max(0, Math.min(1, factors.averageRating / 500));     // 500 = 5.00 stars
  const normDeals = Math.max(0, Math.min(1, factors.completedDeals / 30));     // 30+ deals = 1.0

  let baseScore =
    0.35 * normRelevance +
    0.25 * normTrust +
    0.20 * normEngagement +
    0.10 * normRating +
    0.10 * normDeals;

  if (factors.isFeatured) {
    baseScore *= 1.25; // 25% boost for featured creators
  }

  return Math.round(baseScore * 10000) / 100; // Returns 0.00 to 125.00
}

export function computeCampaignRankingScore(factors: CampaignRankFactors): number {
  const normRelevance = Math.max(0, Math.min(1, factors.textRelevance));
  // CIBIL range normalization: (score - 300) / 600
  const normTrust = Math.max(0, Math.min(1, (factors.brandTrustScore - 300) / 600));
  
  // Budget appeal: 10,000 INR (1000000 paise) = 1.0
  const normBudget = Math.max(0, Math.min(1, factors.perInfluencerBudgetPaise / 1000000));
  
  // Recency decay: within 30 days
  const ageDays = (Date.now() - factors.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  const normRecency = Math.max(0, 1 - ageDays / 60);

  const score =
    0.35 * normRelevance +
    0.30 * normBudget +
    0.20 * normTrust +
    0.15 * normRecency;

  return Math.round(score * 10000) / 100;
}

/**
 * Generates the PostgreSQL SQL expression for composite ranking on InfluencerProfile
 */
export function buildCreatorSqlRankingExpression(hasSearchTerm: boolean): string {
  const relevanceExpr = hasSearchTerm
    ? `(COALESCE(ts_rank_cd(to_tsvector('english', coalesce(ip."displayName", '') || ' ' || coalesce(ip.bio, '') || ' ' || coalesce(ip.categories, '') || ' ' || coalesce(ip.city, '')), query), 0) * 0.7 + COALESCE(similarity(ip."displayName", $1), 0) * 0.3)`
    : `1.0`;

  return `
    (
      (
        0.35 * ${relevanceExpr} +
        0.25 * (LEAST(1.0, GREATEST(0.0, (COALESCE(u."trustScore", 600.0) - 300.0) / 600.0))) +
        0.20 * (LEAST(1.0, GREATEST(0.0, COALESCE(ip."instagramEngagementRate", 0.0) / 1000.0))) +
        0.10 * (LEAST(1.0, GREATEST(0.0, COALESCE(ip."averageRating", 0.0) / 500.0))) +
        0.10 * (LEAST(1.0, GREATEST(0.0, COALESCE(ip."completedDeals", 0)::float / 30.0)))
      ) * (CASE WHEN ip."isFeatured" = true AND (ip."featuredUntil" IS NULL OR ip."featuredUntil" > NOW()) THEN 1.25 ELSE 1.0 END)
    )
  `;
}
