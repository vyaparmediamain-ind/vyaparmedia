import { Prisma, PrismaClient } from "@prisma/client";

export type DbClient = PrismaClient | Prisma.TransactionClient;

export interface GamificationUser {
id: string;
userType: string;
trustScore: number;
verificationLevel?: string | null;
influencerProfile: {
id: string;
bio?: string | null;
categories?: string | null;
city?: string | null;
completedDeals: number;
averageRating?: number;
instagramFollowers?: number | null;
instagramEngagementRate?: number | null;
youtubeEngagementRate?: number | null;
} | null;
brandProfile: {
id: string;
description?: string | null;
industry?: string | null;
companyName?: string;
totalCampaigns: number;
} | null;
badges: { badgeId: string }[];
}

export interface BrandComplianceConfig {
badgeId: string;
userId: string;
user: GamificationUser;
db: DbClient;
brandProfile: GamificationUser["brandProfile"];
completedDealsCount: number;
fraudViolationsCount: number;
zeroRevisionDealsCount: number;
}

export const TRIGGER_TO_BADGES: Record<string, string[]> = {
CAMPAIGN_CREATED: [
"first_campaign",
"campaign_master",
"big_spender",
"mega_campaign",
"fast_approver",
"roi_master",
"partnership_pro",
"fair_payer",
],
DEAL_COMPLETED: [
"first_deal",
"five_deals",
"ten_deals",
"twenty_five_deals",
"fifty_deals",
"hundred_deals",
"five_hundred_deals",
"thousand_deals",
"earn_1k",
"earn_10k",
"earn_50k",
"earn_1lakh",
"earn_5lakh",
"earn_10lakh",
"earn_1crore",
"fraud_shield",
"strict_compliance",
"cibil_elite",
"deal_streak_5",
"deal_streak_10",
"fast_earner",
"speed_demon",
"early_bird",
"no_revisions",
"night_owl",
"weekend_warrior",
"diverse_portfolio",
"loyalist",
"perfect_rating",
"category_king",
"city_champion",
"holiday_special",
"trendsetter",
"viral_post",
],
VERIFICATION: ["verified_identity", "profile_complete", "social_connected", "verified_pro"],
LOGIN: [
"first_login",
"profile_complete",
"highly_responsive",
"comeback_kid",
"bug_reporter",
"feedback_giver",
"beta_tester",
"mystery_badge",
],
REFERRAL: ["first_referral", "five_referrals", "ten_referrals", "referral_king"],
FIRST_REVIEW: ["first_5_star", "five_5_star", "ten_5_star", "creative_genius"],
FIVE_STAR_RATING: ["first_5_star", "five_5_star", "ten_5_star", "creative_genius"],
REVIEW_RECEIVED: ["first_5_star", "five_5_star", "ten_5_star", "creative_genius"],
TRUST_UPDATED: ["trust_novice", "trust_prime", "trust_super_prime", "trust_sovereign", "cibil_elite"],
};
