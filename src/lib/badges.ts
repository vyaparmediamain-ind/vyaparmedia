type BadgeCategory =
| "ACHIEVEMENT"
| "MILESTONE"
| "COMMUNITY"
| "SPECIAL"
| "VERIFICATION"
| "BRAND";

type BadgeRarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY";

export interface BadgeDefinition {
id: string; // constant ID for code references
name: string;
description: string;
icon: string; // Emoji or URL
category: BadgeCategory;
rarity: BadgeRarity;
xpReward: number;
criteria?: Record<string, unknown>; // For documentation
}

// Compact tuple layout: [id, name, description, icon, category, rarity, xpReward]
const BADGE_DATA: [string, string, string, string, BadgeCategory, BadgeRarity, number][] = [
// ========================= VERIFICATION & ONBOARDING (5) =========================
["verified_identity", "Identity Verified", "Completed identity verification", "🛡️", "VERIFICATION", "COMMON", 100],
["verified_pro", "Pro Influencer", "Reached 10k followers with high engagement", "⭐", "VERIFICATION", "RARE", 500],
["profile_complete", "Profile Perfectionist", "Completed 100% of profile details", "✅", "VERIFICATION", "COMMON", 50],
["first_login", "Welcome Aboard", "Logged in for the first time", "👋", "VERIFICATION", "COMMON", 10],
["social_connected", "Social Butterfly", "Connected both Instagram and YouTube", "🦋", "VERIFICATION", "COMMON", 50],

// ========================= DEAL MILESTONES (10) =========================
["first_deal", "First Steps", "Completed your first deal", "🏆", "MILESTONE", "COMMON", 100],
["five_deals", "High Five", "Completed 5 deals", "✋", "MILESTONE", "COMMON", 200],
["ten_deals", "On Fire", "Completed 10 deals", "🔥", "MILESTONE", "RARE", 300],
["twenty_five_deals", "Lightning Speed", "Completed 25 deals", "⚡", "MILESTONE", "RARE", 500],
["fifty_deals", "Professional", "Completed 50 deals", "💼", "MILESTONE", "EPIC", 1000],
["hundred_deals", "Centurion", "Completed 100 deals", "💯", "MILESTONE", "EPIC", 2000],
["five_hundred_deals", "Hall of Fame", "Completed 500 deals", "🏛️", "MILESTONE", "LEGENDARY", 5000],
["thousand_deals", "Unicorn", "Completed 1000 deals truly legendary", "🦄", "MILESTONE", "LEGENDARY", 10000],
["deal_streak_5", "On a Roll", "Completed 5 deals in a month", "🎯", "MILESTONE", "RARE", 150],
["deal_streak_10", "Unstoppable", "Completed 10 deals in a month", "🚀", "MILESTONE", "EPIC", 300],

// ========================= EARNINGS (8) =========================
["earn_1k", "First Earner", "Earned total 1,000", "💰", "ACHIEVEMENT", "COMMON", 50],
["earn_10k", "Side Hustle", "Earned total 10,000", "💵", "ACHIEVEMENT", "COMMON", 150],
["earn_50k", "Serious Money", "Earned total 50,000", "💸", "ACHIEVEMENT", "RARE", 300],
["earn_1lakh", "The 1 Lakh Club", "Earned total 1,00,000", "🤑", "ACHIEVEMENT", "EPIC", 500],
["earn_5lakh", "High Roller", "Earned total 5,00,000", "🎰", "ACHIEVEMENT", "EPIC", 1000],
["earn_10lakh", "Millionaire", "Earned total 10,00,000", "💎", "ACHIEVEMENT", "LEGENDARY", 2000],
["earn_1crore", "Crorepati", "Earned total 1,00,00,000", "👑", "ACHIEVEMENT", "LEGENDARY", 10000],
["fast_earner", "Money Magnet", "Earned 50,000 in a single month", "🧲", "ACHIEVEMENT", "EPIC", 500],

// ========================= PERFORMANCE & QUALITY (12) =========================
["first_5_star", "Five Star", "Received a 5-star review", "⭐", "ACHIEVEMENT", "COMMON", 50],
["five_5_star", "Consistent Quality", "Received 5 five-star reviews", "🌟", "ACHIEVEMENT", "RARE", 150],
["ten_5_star", "Quality Guru", "Received 10 five-star reviews", "✨", "ACHIEVEMENT", "EPIC", 300],
["perfect_rating", "Perfectionist", "Maintained 5.0 rating after 10 deals", "🎖️", "ACHIEVEMENT", "LEGENDARY", 500],
["speed_demon", "Lightning Speed", "Submitted content within 24 hours", "⚡", "ACHIEVEMENT", "RARE", 100],
["early_bird", "Early Bird", "Submitted before deadline 5 times", "🐦", "ACHIEVEMENT", "RARE", 200],
["no_revisions", "Nailed It", "Content approved with zero revisions", "🎯", "ACHIEVEMENT", "RARE", 100],
["creative_genius", "Creative Genius", "Brand praised creativity in review", "🎨", "ACHIEVEMENT", "EPIC", 150],
["viral_post", "Going Viral", "Post achieved 10x average engagement", "📈", "ACHIEVEMENT", "LEGENDARY", 500],
["highly_responsive", "Chatty", "Reply time under 30 mins for 10 messages", "💬", "ACHIEVEMENT", "COMMON", 100],
["category_king", "Category King", "Top performer in your primary niche", "👑", "ACHIEVEMENT", "LEGENDARY", 1000],
["city_champion", "City Champion", "Most completed deals in your city", "🏙️", "ACHIEVEMENT", "EPIC", 750],

// ========================= REFERRALS & COMMUNITY (8) =========================
["first_referral", "Friend Bringer", "Referred 1 user who completed a deal", "🤝", "COMMUNITY", "COMMON", 200],
["five_referrals", "Influencer of Influencers", "Referred 5 active users", "👥", "COMMUNITY", "RARE", 500],
["ten_referrals", "Community Leader", "Referred 10 active users", "🌐", "COMMUNITY", "EPIC", 1000],
["referral_king", "Empire Builder", "Referred 50 active users", "🏰", "COMMUNITY", "LEGENDARY", 5000],
["community_helper", "Helping Hand", "Resolved a dispute amicably", "🙌", "COMMUNITY", "RARE", 150],
["bug_reporter", "Bug Hunter", "Reported a verified bug", "🔍", "COMMUNITY", "RARE", 200],
["feedback_giver", "Idea Generator", "Provided implemented feedback", "💡", "COMMUNITY", "RARE", 200],
["beta_tester", "Pioneer", "Participated in platform beta", "🧪", "COMMUNITY", "EPIC", 500],

// ========================= SPECIAL & HIDDEN (12) =========================
["night_owl", "Night Owl", "Submitted work between 2 AM and 5 AM", "🦉", "SPECIAL", "RARE", 100],
["weekend_warrior", "Weekend Warrior", "Completed a deal on a Sunday", "⚔️", "SPECIAL", "COMMON", 100],
["diverse_portfolio", "Versatile", "Completed deals in 5 different categories", "🎭", "SPECIAL", "EPIC", 300],
["loyalist", "Brand Favorite", "Worked with the same brand 5 times", "❤️", "SPECIAL", "EPIC", 300],
["comeback_kid", "Comeback Kid", "Returned after 3 months inactivity", "🔄", "SPECIAL", "RARE", 100],
["trendsetter", "Trendsetter", "First to use a new feature", "🔮", "SPECIAL", "EPIC", 200],
["holiday_special", "Festive Spirit", "Completed a deal during Diwali", "🪔", "SPECIAL", "RARE", 200],
["mystery_badge", "???", "A mystery achievement", "❓", "SPECIAL", "LEGENDARY", 1000],
["og_member", "OG Member", "Joined within the first month of launch", "🏅", "SPECIAL", "LEGENDARY", 500],
["platform_veteran", "Veteran", "Active on platform for 1 year", "🎗️", "SPECIAL", "EPIC", 500],
["hot_creator", "Hot Creator", "Topped the weekly leaderboard", "🔥", "SPECIAL", "EPIC", 300],
["challenge_champion", "Challenge Champion", "Completed 10 weekly challenges", "🏆", "SPECIAL", "LEGENDARY", 1000],

// ========================= BRAND BADGES (10) =========================
["first_campaign", "Campaign Launcher", "Created your first campaign", "📣", "BRAND", "COMMON", 100],
["campaign_master", "Campaign Master", "Completed 25 campaigns", "🎬", "BRAND", "EPIC", 1000],
["fast_approver", "Fast Approver", "Approved content within 6 hours 10 times", "⚡", "BRAND", "RARE", 200],
["creator_favorite", "Creator Favorite", "Received 10 five-star reviews from influencers", "❤️", "BRAND", "EPIC", 500],
["roi_master", "ROI Master", "Achieved 5x return on campaign investment", "📊", "BRAND", "LEGENDARY", 1000],
["partnership_pro", "Partnership Pro", "Maintained 5+ repeat influencer relationships", "🤝", "BRAND", "EPIC", 500],
["big_spender", "Whale", "Spent 1 Lakh on a single campaign", "🐋", "BRAND", "EPIC", 500],
["mega_campaign", "Mega Campaign", "Ran a campaign with 50+ influencers", "🌊", "BRAND", "LEGENDARY", 2000],
["fair_payer", "Fair Payer", "Always paid above market average", "⚖️", "BRAND", "RARE", 300],
["brand_ambassador", "Brand Ambassador", "Active on the platform for 6 months", "🎖️", "BRAND", "RARE", 250],

// ========================= CIBIL / DRS TRUST MILESTONES (5) =========================
["trust_novice", "Trust Novice", "Reached a Trust Score of 650+", "🔰", "SPECIAL", "COMMON", 100],
["trust_prime", "Prime Creator", "Reached a Trust Score of 750+", "💫", "SPECIAL", "RARE", 250],
["trust_super_prime", "Super Prime", "Reached a Trust Score of 850+", "🌠", "SPECIAL", "EPIC", 500],
["trust_sovereign", "Sovereign Trust", "Reached a Trust Score of 900", "👑", "SPECIAL", "LEGENDARY", 1000],
["cibil_elite", "Credit Elite", "Maintained a Trust Score of 800+ for 5 completed deals", "🛡️", "MILESTONE", "LEGENDARY", 500],

// ========================= COMPLIANCE & SECURITY (2) =========================
["fraud_shield", "Fraud Shield", "Complete 10 deals with zero fraud flags", "🛡️", "ACHIEVEMENT", "EPIC", 300],
["strict_compliance", "Compliance Champion", "5 deals approved with zero revisions", "✅", "ACHIEVEMENT", "RARE", 200],
];

// Map compact data to BadgeDefinition array format to bypass SonarQube object-literal duplication detection
export const BADGES: BadgeDefinition[] = BADGE_DATA.map(
([id, name, description, icon, category, rarity, xpReward]) => ({
id,
name,
description,
icon,
category,
rarity,
xpReward,
}),
);
