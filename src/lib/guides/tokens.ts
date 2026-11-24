import { ABSOLUTE_MIN_PLATFORM_FEE } from "@/constants/platform-fees";
import {
  TDS_194O_RATE_PERCENT_STRING,
  TDS_393_1_THRESHOLD_RUPEES,
  TDS_206AA_PENAL_RATE_PERCENT_STRING,
  TDS_194J_RATE_PERCENT_STRING,
  GST_STANDARD_RATE_PERCENT_STRING,
  GST_DEAL_EXEMPT_THRESHOLD_RUPEES,
} from "@/constants/tax";
import {
  DEFAULT_BRAND_REVIEW_PERIOD_HOURS,
  DEAL_SIGNING_WINDOW_HOURS,
  POST_MONITORING_WINDOW_DAYS,
  DEFAULT_INCLUDED_REVISIONS,
  DEFAULT_COST_PER_EXTRA_REVISION_PAISE,
  DEFAULT_BRAND_PLATFORM_FEE_PERCENT,
  DEFAULT_GATEWAY_FEE_PERCENT,
  MIN_INFLUENCER_FOLLOWERS_TO_APPLY,
} from "@/constants/deals";
import {
  MIN_WALLET_TOPUP_RUPEES,
  MAX_WALLET_TOPUP_RUPEES,
  MIN_WITHDRAWAL_AMOUNT_RUPEES,
  MAX_WITHDRAWAL_AMOUNT_RUPEES,
} from "@/constants/wallet";
import {
  MIN_TRUST_SCORE,
  MAX_TRUST_SCORE,
  DEFAULT_TRUST_SCORE,
  DRS_TIER_FLAGGED_MAX,
  DRS_TIER_LIMITED_MAX,
  DRS_TIER_NORMAL_MAX,
  DRS_TIER_TRUSTED_MAX,
  DRS_QUALIFIED_DEAL_VALUE_PAISE,
} from "@/constants/drs";
import type { Guide, BilingualText } from "./schema";

export const GUIDE_TOKENS: Record<string, string> = {
  // Platform fees
  "fee.min": `${ABSOLUTE_MIN_PLATFORM_FEE}%`,
  "fee.brand_default": `${DEFAULT_BRAND_PLATFORM_FEE_PERCENT}%`,
  "fee.gateway": `${DEFAULT_GATEWAY_FEE_PERCENT}%`,
  "fee.extra_revision": `₹${Math.round(DEFAULT_COST_PER_EXTRA_REVISION_PAISE / 100)}`,

  // Tax rates & thresholds
  "tax.tds_194o": TDS_194O_RATE_PERCENT_STRING,
  "tax.tds_threshold": `₹${(TDS_393_1_THRESHOLD_RUPEES / 100000).toFixed(0)} Lakh`,
  "tax.tds_threshold_full": `₹${TDS_393_1_THRESHOLD_RUPEES.toLocaleString("en-IN")}`,
  "tax.tds_206aa": TDS_206AA_PENAL_RATE_PERCENT_STRING,
  "tax.tds_194j": TDS_194J_RATE_PERCENT_STRING,
  "tax.gst_standard": GST_STANDARD_RATE_PERCENT_STRING,
  "tax.gst_exempt_threshold": `₹${GST_DEAL_EXEMPT_THRESHOLD_RUPEES.toLocaleString("en-IN")}`,

  // Deal lifecycle & deadlines
  "deals.review_hours": `${DEFAULT_BRAND_REVIEW_PERIOD_HOURS} hours`,
  "deals.auto_approve_hours": `${DEFAULT_BRAND_REVIEW_PERIOD_HOURS} hours`,
  "deals.signing_hours": `${DEAL_SIGNING_WINDOW_HOURS} hours`,
  "deals.post_monitoring_days": `${POST_MONITORING_WINDOW_DAYS} days`,
  "deals.included_revisions": `${DEFAULT_INCLUDED_REVISIONS}`,
  "deals.min_followers": `${MIN_INFLUENCER_FOLLOWERS_TO_APPLY.toLocaleString("en-IN")}`,

  // Wallet thresholds
  "wallet.min_topup": `₹${MIN_WALLET_TOPUP_RUPEES}`,
  "wallet.max_topup": `₹${(MAX_WALLET_TOPUP_RUPEES / 100000).toFixed(0)} Lakh`,
  "wallet.min_withdrawal": `₹${MIN_WITHDRAWAL_AMOUNT_RUPEES}`,
  "wallet.max_withdrawal": `₹${(MAX_WITHDRAWAL_AMOUNT_RUPEES / 100000).toFixed(0)} Lakh`,

  // DRS trust score constants
  "drs.min": `${MIN_TRUST_SCORE}`,
  "drs.max": `${MAX_TRUST_SCORE}`,
  "drs.default": `${DEFAULT_TRUST_SCORE}`,
  "drs.tier_flagged": `${DRS_TIER_FLAGGED_MAX}`,
  "drs.tier_limited": `${DRS_TIER_LIMITED_MAX}`,
  "drs.tier_normal": `${DRS_TIER_NORMAL_MAX}`,
  "drs.tier_trusted": `${DRS_TIER_TRUSTED_MAX}`,
  "drs.qualified_deal": `₹${Math.round(DRS_QUALIFIED_DEAL_VALUE_PAISE / 100).toLocaleString("en-IN")}`,

  // Privacy and analytics
  "analytics.small_number_threshold": "5",
  "analytics.retention_days": "365 days",
};

/**
 * Resolves all {{token}} templates in a given string using the canonical constants.
 */
export function resolveGuideTokens(text: string): string {
  if (!text || typeof text !== "string") return text;
  return text.replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g, (match, tokenKey) => {
    return GUIDE_TOKENS[tokenKey] ?? match;
  });
}

/**
 * Resolves all tokens in a bilingual text block.
 */
export function resolveBilingualText(bilingual: BilingualText): BilingualText {
  return {
    en: resolveGuideTokens(bilingual.en),
    hinglish: resolveGuideTokens(bilingual.hinglish),
  };
}

/**
 * Deep-resolves all token placeholders inside a Guide record.
 */
export function resolveGuide(guide: Guide): Guide {
  return {
    ...guide,
    title: resolveBilingualText(guide.title),
    summary: resolveBilingualText(guide.summary),
    whenToUse: resolveBilingualText(guide.whenToUse),
    steps: guide.steps.map((step) => ({
      ...step,
      title: resolveBilingualText(step.title),
      body: resolveBilingualText(step.body),
    })),
    rules: guide.rules.map(resolveBilingualText),
    numbersExplained: guide.numbersExplained.map((item) => ({
      label: resolveBilingualText(item.label),
      description: resolveBilingualText(item.description),
    })),
    commonErrors: guide.commonErrors.map((err) => ({
      symptom: resolveBilingualText(err.symptom),
      cause: resolveBilingualText(err.cause),
      fix: resolveBilingualText(err.fix),
    })),
    faqs: guide.faqs.map((faq) => ({
      question: resolveBilingualText(faq.question),
      answer: resolveBilingualText(faq.answer),
    })),
    supportCta: guide.supportCta
      ? {
        label: resolveBilingualText(guide.supportCta.label),
        href: guide.supportCta.href,
      }
      : undefined,
  };
}

