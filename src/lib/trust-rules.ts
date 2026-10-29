import prisma from "./db";
import { redis } from "./redis";
import { logger } from "./logger";

export const DEFAULT_TRUST_RULE_WEIGHTS: Record<string, { weight: number; category: string; description: string }> = {
  // Influencer DRS Bonuses
  DEAL_EXPERIENCE_WEIGHT: { weight: 15, category: "INFLUENCER", description: "Bonus points per qualified completed deal" },
  FIVE_STAR_REVIEW_WEIGHT: { weight: 30, category: "INFLUENCER", description: "Bonus points per 5-star review received" },
  ON_TIME_DELIVERY_WEIGHT: { weight: 18, category: "INFLUENCER", description: "Bonus points per on-time delivery" },
  IDENTITY_VERIFIED_WEIGHT: { weight: 60, category: "GENERAL", description: "Bonus points for completed identity verification" },
  ACCOUNT_AGE_BONUS: { weight: 30, category: "GENERAL", description: "Bonus points for account age over 365 days" },
  PROFILE_COMPLETENESS_WEIGHT: { weight: 25, category: "GENERAL", description: "Bonus points for 100% complete profile" },

  // Influencer Penalties
  DISPUTE_LOST_PENALTY: { weight: -40, category: "INFLUENCER", description: "Penalty points per dispute lost" },
  DISPUTE_WON_BONUS: { weight: 20, category: "INFLUENCER", description: "Bonus points per dispute won" },
  TERMS_VIOLATION_PENALTY: { weight: -50, category: "GENERAL", description: "Penalty points per platform terms violation" },
  CONTENT_REJECTION_PENALTY: { weight: -15, category: "INFLUENCER", description: "Penalty points per content rejection" },
  LATE_DELIVERY_PENALTY: { weight: -12, category: "INFLUENCER", description: "Penalty points per late content delivery" },
  POOR_REVIEW_PENALTY: { weight: -25, category: "INFLUENCER", description: "Penalty points per review under 3 stars" },
  FAKE_FOLLOWERS_PENALTY: { weight: -100, category: "INFLUENCER", description: "Penalty points if fake followers are detected" },

  // Brand DRS Factors
  BRAND_SPEND_WEIGHT: { weight: 20, category: "BRAND", description: "Bonus points per 10,000 INR spend milestone" },
  BRAND_PROMPT_PAYMENT_WEIGHT: { weight: 25, category: "BRAND", description: "Bonus points for prompt contract completion" },
  BRAND_CAMPAIGN_WEIGHT: { weight: 18, category: "BRAND", description: "Bonus points per completed campaign" },
  BRAND_FAST_APPROVAL_WEIGHT: { weight: 12, category: "BRAND", description: "Bonus points per quick approval" },
  BRAND_PAYMENT_RELIABILITY_WEIGHT: { weight: 60, category: "BRAND", description: "Bonus points for high payment success rate" },
  BRAND_VERIFIED_WEIGHT: { weight: 90, category: "BRAND", description: "Bonus points for verified company registration" },
  BRAND_PARTNERSHIP_WEIGHT: { weight: 30, category: "BRAND", description: "Bonus points per long-term repeat partnership" },
  BRAND_FAIR_REVIEW_WEIGHT: { weight: 30, category: "BRAND", description: "Bonus points per fair review given" },
  BRAND_LATE_APPROVAL_PENALTY: { weight: -30, category: "BRAND", description: "Penalty points per late approval" },
  BRAND_UNFAIR_REJECTION_PENALTY: { weight: -120, category: "BRAND", description: "Penalty points per unfair rejection" },
  BRAND_DISPUTE_PENALTY: { weight: -45, category: "BRAND", description: "Penalty points per dispute lost by brand" },
  BRAND_DISPUTE_LOST_PENALTY: { weight: -240, category: "BRAND", description: "Penalty points per payment dispute lost" },
  BRAND_COMPLAINT_PENALTY: { weight: -150, category: "BRAND", description: "Penalty points per influencer complaint" },
  BRAND_TERMS_VIOLATION_PENALTY: { weight: -600, category: "BRAND", description: "Penalty points per terms of service violation" },

  // Fraud Risk Weights
  RAPID_WITHDRAWAL_RISK: { weight: 40, category: "FRAUD", description: "Risk score addition for multiple withdrawals in 10 minutes" },
  FRAUD_RAPID_FIRE_WITHDRAWAL: { weight: 40, category: "FRAUD", description: "Risk score addition for multiple withdrawals in 10 minutes" },
  DEVICE_CLUSTERING_RISK: { weight: 50, category: "FRAUD", description: "Risk score addition for multiple accounts on same device fingerprint" },
  FRAUD_DEVICE_FINGERPRINT_CLUSTERING: { weight: 50, category: "FRAUD", description: "Risk score addition for multiple accounts on same device fingerprint" },
  BANK_NAME_KYC_MISMATCH_RISK: { weight: 45, category: "FRAUD", description: "Risk score addition when bank beneficiary name differs from KYC name" },
  FRAUD_BANK_NAME_KYC_MISMATCH: { weight: 45, category: "FRAUD", description: "Risk score addition when bank beneficiary name differs from KYC name" },
  LARGE_WITHDRAWAL_NEW_ACCOUNT_RISK: { weight: 55, category: "FRAUD", description: "Risk score addition for large withdrawal from new account (<30 days)" },
  FRAUD_LARGE_WITHDRAWAL_NEW_ACCOUNT: { weight: 55, category: "FRAUD", description: "Risk score addition for large withdrawal from new account (<30 days)" },
  DUPLICATE_PAYOUT_ACCOUNT_RISK: { weight: 100, category: "FRAUD", description: "Risk score addition for payout account reuse across users" },
  FRAUD_LOW_TRUST_SCORE_WITHDRAWAL: { weight: 50, category: "FRAUD", description: "Risk score addition for withdrawal with low trust score" },
  FRAUD_REVIEW_THRESHOLD: { weight: 40, category: "FRAUD", description: "Risk score threshold to route withdrawal to manual review" },
  FRAUD_BLOCK_THRESHOLD: { weight: 70, category: "FRAUD", description: "Risk score threshold to block withdrawal immediately" },
};

const REDIS_CACHE_KEY = "trust_rules:weights_map";
const CACHE_TTL_SECONDS = 300; // 5 minutes

/**
 * Fetch all trust score and fraud risk weights.
 * Table-driven: reads from TrustRuleConfig table in DB, cached in Redis.
 * If table is uninitialized, automatically seeds the defaults into DB.
 */
export async function getTrustRuleWeights(): Promise<Record<string, number>> {
  // 1. Try Redis cache
  try {
    const cached = await redis.get(REDIS_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached) as Record<string, number>;
    }
  } catch (err) {
    logger.debug("Trust rule cache read failed, querying database", { error: err });
  }

  // 2. Query Database
  let dbRules = await prisma.trustRuleConfig.findMany({
    where: { isActive: true },
  });

  // 3. Seed defaults if empty
  if (dbRules.length === 0) {
    logger.info("Initializing default TrustRuleConfig entries in database");
    for (const [key, meta] of Object.entries(DEFAULT_TRUST_RULE_WEIGHTS)) {
      await prisma.trustRuleConfig.upsert({
        where: { ruleKey: key },
        create: {
          ruleKey: key,
          category: meta.category,
          weight: meta.weight,
          description: meta.description,
          isActive: true,
        },
        update: {},
      });
    }
    dbRules = await prisma.trustRuleConfig.findMany({ where: { isActive: true } });
  }

  // 4. Construct weight dictionary
  const weights: Record<string, number> = {};
  for (const [key, meta] of Object.entries(DEFAULT_TRUST_RULE_WEIGHTS)) {
    weights[key] = meta.weight;
  }
  for (const r of dbRules) {
    weights[r.ruleKey] = r.weight;
  }

  // 5. Cache in Redis
  try {
    await redis.setex(REDIS_CACHE_KEY, CACHE_TTL_SECONDS, JSON.stringify(weights));
  } catch (err) {
    logger.debug("Failed to cache trust rules in Redis", { error: err });
  }

  return weights;
}

/**
 * Dynamically update a rule's weight in the database without requiring code redeployment.
 * Purges the Redis cache immediately so changes take effect across all workers.
 */
export async function updateTrustRuleWeight(
  ruleKey: string,
  newWeight: number,
  adminUserId?: string,
): Promise<{ success: boolean; ruleKey: string; weight: number }> {
  const meta = DEFAULT_TRUST_RULE_WEIGHTS[ruleKey];
  const updated = await prisma.trustRuleConfig.upsert({
    where: { ruleKey },
    create: {
      ruleKey,
      category: meta?.category || "GENERAL",
      weight: newWeight,
      description: meta?.description || `Dynamically configured rule for ${ruleKey}`,
      isActive: true,
    },
    update: {
      weight: newWeight,
      isActive: true,
    },
  });

  // Purge cache
  try {
    await redis.del(REDIS_CACHE_KEY);
  } catch (err) {
    logger.warn("Failed to invalidate trust rules Redis cache", { error: err });
  }

  logger.info("Trust rule weight updated dynamically in DB", {
    ruleKey,
    weight: newWeight,
    updatedBy: adminUserId || "SYSTEM",
  });

  return { success: true, ruleKey: updated.ruleKey, weight: updated.weight };
}

/**
 * Clear Redis trust rules cache
 */
export async function invalidateTrustRuleCache(): Promise<void> {
  try {
    await redis.del(REDIS_CACHE_KEY);
  } catch (err) {
    logger.warn("Failed to invalidate trust rules cache in Redis", { error: err });
  }
}
