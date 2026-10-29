/**
 * Digital Reputation Score (DRS) & Trust Engine Constants
 */

// Global Timezone Offset
export const IST_OFFSET_HOURS = 5.5;
export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 19,800,000 ms (UTC+5:30)

// DRS Score Bounds (CIBIL Credit Scale Standard: 300 to 900)
export const MIN_TRUST_SCORE = 300;
export const MAX_TRUST_SCORE = 900;
export const DEFAULT_TRUST_SCORE = 600;
export const TRUST_SCORE_INITIAL_NEW_USER = 600;
export const MIN_TRUST_SCORE_THRESHOLD = 600;
export const TRUST_SCORE_REVIEW_THRESHOLD = 600;

// DRS Reputation Tier Thresholds
export const DRS_TIER_FLAGGED_MAX = 450;
export const DRS_TIER_LIMITED_MAX = 550;
export const DRS_TIER_NORMAL_MAX = 750;
export const DRS_TIER_TRUSTED_MAX = 850;

// DRS Tier Maximum Deal Amount Caps (in Paise)
export const DRS_DEAL_CAP_FLAGGED_PAISE = 0; // ₹0 (Account locked)
export const DRS_DEAL_CAP_LIMITED_PAISE = 500_000; // ₹5,000 max single deal
export const DRS_DEAL_CAP_NORMAL_PAISE = 2_500_000; // ₹25,000 max single deal
export const DRS_DEAL_CAP_TRUSTED_PAISE = 10_000_000; // ₹1,00,000 max single deal
export const DRS_DEAL_CAP_ELITE_PAISE = -1; // Unlimited

// Deal Value Qualification for Bonus Points
export const DRS_QUALIFIED_DEAL_VALUE_PAISE = 500_000; // ₹5,000 minimum deal size for DRS points bonus
