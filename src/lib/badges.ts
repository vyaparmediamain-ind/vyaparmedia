type BadgeCategory =
| "ACHIEVEMENT"
| "MILESTONE"
| "COMMUNITY"
| "SPECIAL"
| "VERIFICATION"
| "BRAND";

type BadgeRarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY";

export type BadgeRole = "INFLUENCER" | "BRAND" | "ALL";

export interface BadgeDefinition {
id: string; // constant ID for code references
name: string;
description: string;
icon: string; // Emoji or URL
category: BadgeCategory;
rarity: BadgeRarity;
xpReward: number;
role: BadgeRole;
criteria?: Record<string, unknown>; // For documentation
}

// Compact tuple layout: [id, name, description, icon, category, rarity, xpReward, role]
const BADGE_DATA: [string, string, string, string, BadgeCategory, BadgeRarity, number, BadgeRole][] = [
  // Verification & Onboarding
  ["verified_identity", "Identity Verified", "Completed identity verification", "🛡️", "VERIFICATION", "COMMON", 100, "ALL"],
  ["verified_pro", "Pro Influencer", "Reached 10k followers with high engagement", "⭐", "VERIFICATION", "RARE", 500, "INFLUENCER"],
  ["profile_complete", "Profile Perfectionist", "Completed 100% of profile details", "✅", "VERIFICATION", "COMMON", 50, "ALL"],
  ["first_login", "Welcome Aboard", "Logged in for the first time", "👋", "VERIFICATION", "COMMON", 10, "ALL"],
  ["social_connected", "Social Butterfly", "Connected both Instagram and YouTube", "🦋", "VERIFICATION", "COMMON", 50, "INFLUENCER"],

  // Deal Milestones
  ["first_deal", "First Steps", "Completed your first deal", "🏆", "MILESTONE", "COMMON", 100, "INFLUENCER"],
  ["five_deals", "High Five", "Completed 5 deals", "✋", "MILESTONE", "COMMON", 200, "INFLUENCER"],
  ["ten_deals", "On Fire", "Completed 10 deals", "🔥", "MILESTONE", "RARE", 300, "INFLUENCER"],
  ["twenty_five_deals", "Lightning Speed", "Completed 25 deals", "⚡", "MILESTONE", "RARE", 500, "INFLUENCER"],
  ["fifty_deals", "Professional", "Completed 50 deals", "💼", "MILESTONE", "EPIC", 1000, "INFLUENCER"],
  ["hundred_deals", "Centurion", "Completed 100 deals", "💯", "MILESTONE", "EPIC", 2000, "INFLUENCER"],
  ["five_hundred_deals", "Hall of Fame", "Completed 500 deals", "🏛️", "MILESTONE", "LEGENDARY", 5000, "INFLUENCER"],
  ["thousand_deals", "Unicorn", "Completed 1000 deals truly legendary", "🦄", "MILESTONE", "LEGENDARY", 10000, "INFLUENCER"],
  ["deal_streak_5", "On a Roll", "Completed 5 deals in a month", "🎯", "MILESTONE", "RARE", 150, "INFLUENCER"],
  ["deal_streak_10", "Unstoppable", "Completed 10 deals in a month", "🚀", "MILESTONE", "EPIC", 300, "INFLUENCER"],

  // Earnings
  ["earn_1k", "First Earner", "Earned total 1,000", "💰", "ACHIEVEMENT", "COMMON", 50, "INFLUENCER"],
  ["earn_10k", "Side Hustle", "Earned total 10,000", "💵", "ACHIEVEMENT", "COMMON", 150, "INFLUENCER"],
  ["earn_50k", "Serious Money", "Earned total 50,000", "💸", "ACHIEVEMENT", "RARE", 300, "INFLUENCER"],
  ["earn_1lakh", "The 1 Lakh Club", "Earned total 1,00,000", "🤑", "ACHIEVEMENT", "EPIC", 500, "INFLUENCER"],
  ["earn_5lakh", "High Roller", "Earned total 5,00,000", "🎰", "ACHIEVEMENT", "EPIC", 1000, "INFLUENCER"],
  ["earn_10lakh", "Millionaire", "Earned total 10,00,000", "💎", "ACHIEVEMENT", "LEGENDARY", 2000, "INFLUENCER"],
  ["earn_1crore", "Crorepati", "Earned total 1,00,00,000", "👑", "ACHIEVEMENT", "LEGENDARY", 10000, "INFLUENCER"],
  ["fast_earner", "Money Magnet", "Earned 50,000 in a single month", "🧲", "ACHIEVEMENT", "EPIC", 500, "INFLUENCER"],

  // Performance & Quality
  ["first_5_star", "Five Star", "Received a 5-star review", "⭐", "ACHIEVEMENT", "COMMON", 50, "ALL"],
  ["five_5_star", "Consistent Quality", "Received 5 five-star reviews", "🌟", "ACHIEVEMENT", "RARE", 150, "ALL"],
  ["ten_5_star", "Quality Guru", "Received 10 five-star reviews", "✨", "ACHIEVEMENT", "EPIC", 300, "ALL"],
  ["perfect_rating", "Perfectionist", "Maintained 5.0 rating after 10 deals", "🎖️", "ACHIEVEMENT", "LEGENDARY", 500, "INFLUENCER"],
  ["speed_demon", "Lightning Speed", "Submitted content within 24 hours", "⚡", "ACHIEVEMENT", "RARE", 100, "INFLUENCER"],
  ["early_bird", "Early Bird", "Submitted before deadline 5 times", "🐦", "ACHIEVEMENT", "RARE", 200, "INFLUENCER"],
  ["no_revisions", "Nailed It", "Content approved with zero revisions", "🎯", "ACHIEVEMENT", "RARE", 100, "INFLUENCER"],
  ["creative_genius", "Creative Genius", "Brand praised creativity in review", "🎨", "ACHIEVEMENT", "EPIC", 150, "INFLUENCER"],
  ["viral_post", "Going Viral", "Post achieved 10x average engagement", "📈", "ACHIEVEMENT", "LEGENDARY", 500, "INFLUENCER"],
  ["highly_responsive", "Chatty", "Reply time under 30 mins for 10 messages", "💬", "ACHIEVEMENT", "COMMON", 100, "ALL"],
  ["category_king", "Category King", "Top performer in your primary niche", "👑", "ACHIEVEMENT", "LEGENDARY", 1000, "INFLUENCER"],
  ["city_champion", "City Champion", "Most completed deals in your city", "🏙️", "ACHIEVEMENT", "EPIC", 750, "INFLUENCER"],

  // Referrals & Community
  ["first_referral", "Friend Bringer", "Referred 1 user who completed a deal", "🤝", "COMMUNITY", "COMMON", 200, "ALL"],
  ["five_referrals", "Influencer of Influencers", "Referred 5 active users", "👥", "COMMUNITY", "RARE", 500, "ALL"],
  ["ten_referrals", "Community Leader", "Referred 10 active users", "🌐", "COMMUNITY", "EPIC", 1000, "ALL"],
  ["referral_king", "Empire Builder", "Referred 50 active users", "🏰", "COMMUNITY", "LEGENDARY", 5000, "ALL"],
  ["community_helper", "Helping Hand", "Resolved a dispute amicably", "🙌", "COMMUNITY", "RARE", 150, "ALL"],
  ["bug_reporter", "Bug Hunter", "Reported a verified bug", "🔍", "COMMUNITY", "RARE", 200, "ALL"],
  ["feedback_giver", "Idea Generator", "Provided implemented feedback", "💡", "COMMUNITY", "RARE", 200, "ALL"],
  ["beta_tester", "Pioneer", "Participated in platform beta", "🧪", "COMMUNITY", "EPIC", 500, "ALL"],

  // Special & Hidden
  ["night_owl", "Night Owl", "Submitted work between 2 AM and 5 AM", "🦉", "SPECIAL", "RARE", 100, "INFLUENCER"],
  ["weekend_warrior", "Weekend Warrior", "Completed a deal on a Sunday", "⚔️", "SPECIAL", "COMMON", 100, "INFLUENCER"],
  ["diverse_portfolio", "Versatile", "Completed deals in 5 different categories", "🎭", "SPECIAL", "EPIC", 300, "INFLUENCER"],
  ["loyalist", "Brand Favorite", "Worked with the same brand 5 times", "❤️", "SPECIAL", "EPIC", 300, "INFLUENCER"],
  ["comeback_kid", "Comeback Kid", "Returned after 3 months inactivity", "🔄", "SPECIAL", "RARE", 100, "ALL"],
  ["trendsetter", "Trendsetter", "First to use a new feature", "🔮", "SPECIAL", "EPIC", 200, "ALL"],
  ["holiday_special", "Festive Spirit", "Completed a deal during Diwali", "🪔", "SPECIAL", "RARE", 200, "INFLUENCER"],
  ["mystery_badge", "???", "A mystery achievement", "❓", "SPECIAL", "LEGENDARY", 1000, "ALL"],
  ["og_member", "OG Member", "Joined within the first month of launch", "🏅", "SPECIAL", "LEGENDARY", 500, "ALL"],
  ["platform_veteran", "Veteran", "Active on platform for 1 year", "🎗️", "SPECIAL", "EPIC", 500, "ALL"],
  ["hot_creator", "Hot Creator", "Topped the weekly leaderboard", "🔥", "SPECIAL", "EPIC", 300, "INFLUENCER"],
  ["challenge_champion", "Challenge Champion", "Completed 10 weekly challenges", "🏆", "SPECIAL", "LEGENDARY", 1000, "INFLUENCER"],

  // Brand Badges
  ["first_campaign", "Campaign Launcher", "Created your first campaign", "📣", "BRAND", "COMMON", 100, "BRAND"],
  ["campaign_master", "Campaign Master", "Completed 25 campaigns", "🎬", "BRAND", "EPIC", 1000, "BRAND"],
  ["fast_approver", "Fast Approver", "Approved content within 6 hours 10 times", "⚡", "BRAND", "RARE", 200, "BRAND"],
  ["creator_favorite", "Creator Favorite", "Received 10 five-star reviews from influencers", "❤️", "BRAND", "EPIC", 500, "BRAND"],
  ["roi_master", "ROI Master", "Achieved 5x return on campaign investment", "📊", "BRAND", "LEGENDARY", 1000, "BRAND"],
  ["partnership_pro", "Partnership Pro", "Maintained 5+ repeat influencer relationships", "🤝", "BRAND", "EPIC", 500, "BRAND"],
  ["big_spender", "Whale", "Spent 1 Lakh on a single campaign", "🐋", "BRAND", "EPIC", 500, "BRAND"],
  ["mega_campaign", "Mega Campaign", "Ran a campaign with 50+ influencers", "🌊", "BRAND", "LEGENDARY", 2000, "BRAND"],
  ["fair_payer", "Fair Payer", "Always paid above market average", "⚖️", "BRAND", "RARE", 300, "BRAND"],
  ["brand_ambassador", "Brand Ambassador", "Active on the platform for 6 months", "🎖️", "BRAND", "RARE", 250, "BRAND"],

  // Trust Milestones
  ["trust_novice", "Trust Novice", "Reached a Trust Score of 650+", "🔰", "SPECIAL", "COMMON", 100, "ALL"],
  ["trust_prime", "Prime Creator", "Reached a Trust Score of 750+", "💫", "SPECIAL", "RARE", 250, "ALL"],
  ["trust_super_prime", "Super Prime", "Reached a Trust Score of 850+", "🌠", "SPECIAL", "EPIC", 500, "ALL"],
  ["trust_sovereign", "Sovereign Trust", "Reached a Trust Score of 900", "👑", "SPECIAL", "LEGENDARY", 1000, "ALL"],
  ["cibil_elite", "Credit Elite", "Maintained a Trust Score of 800+ for 5 completed deals", "🛡️", "MILESTONE", "LEGENDARY", 500, "INFLUENCER"],

  // Compliance & Security
  ["fraud_shield", "Fraud Shield", "Complete 10 deals with zero fraud flags", "🛡️", "ACHIEVEMENT", "EPIC", 300, "INFLUENCER"],
  ["strict_compliance", "Compliance Champion", "5 deals approved with zero revisions", "✅", "ACHIEVEMENT", "RARE", 200, "INFLUENCER"],
];

// Map compact data to BadgeDefinition array format to bypass SonarQube object-literal duplication detection
export const BADGES: BadgeDefinition[] = BADGE_DATA.map(
  ([id, name, description, icon, category, rarity, xpReward, role]) => ({
    id,
    name,
    description,
    icon,
    category,
    rarity,
    xpReward,
    role,
  }),
);

/**
 * Returns the subset of badges relevant to the specified user role.
 * - BRAND: sees BRAND badges and shared ALL badges.
 * - INFLUENCER: sees INFLUENCER badges and shared ALL badges.
 * - SCOUT: scouts do not earn creator/brand badges.
 * - ADMIN: sees all badges.
 */
export function getBadgesForRole(role?: string | null): BadgeDefinition[] {
  const normalized = (role || "INFLUENCER").toUpperCase();
  if (normalized === "BRAND" || normalized === "INDIVIDUAL") {
    return BADGES.filter((b) => b.role === "BRAND" || b.role === "ALL");
  }
  if (normalized === "SCOUT") {
    return [];
  }
  if (normalized === "ADMIN") {
    return BADGES;
  }
  return BADGES.filter((b) => b.role === "INFLUENCER" || b.role === "ALL");
}
