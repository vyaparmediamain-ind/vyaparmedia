/**
* Social Proof Calculator Rule-Based Follower Authenticity & Content Quality Scoring
*
* Calculates followerAuthenticityScore and contentQualityScore for influencers.
* Runs on profile creation and periodically via weekly cron.
*
* STRICT RULE-BASED LOGIC ONLY NO ML.
*/

import prisma from "./db";
import { logger } from "./logger";
import { getYouTubeChannel, calculateYouTubeEngagement } from "./youtube";
import { getInstagramProfile, calculateEngagement } from "./instagram";
import { decrypt } from "./encryption";

// ==================== TYPES ====================

interface SocialProofResult {
followerAuthenticityScore: number; // 0-100
contentQualityScore: number; // 0-100
breakdown: SocialProofBreakdown;
}

interface SocialProofBreakdown {
// Authenticity factors
engagementRateScore: number;
followingRatioScore: number;
accountAgeScore: number;
commentDiversityScore: number;
growthConsistencyScore: number;
// Quality factors
avgEngagementScore: number;
postingConsistencyScore: number;
contentVarietyScore: number;
completionRateScore: number;
}

// ==================== MAIN CALCULATORS ====================

/**
* Calculate follower authenticity score based on engagement patterns.
* Higher score = more likely real followers.
*/
function scoreFollowingRatio(followers: number, following: number): number {
if (followers <= 0) return 0;
const ratio = following / followers;
if (ratio < 0.3) return 15;
if (ratio < 0.5) return 10;
if (ratio < 1.0) return 5;
return -10;
}

function scoreAccountGrowthRate(followers: number, accountAgeDays: number): number {
if (accountAgeDays <= 0) return 0;
const followersPerDay = followers / accountAgeDays;
if (followersPerDay < 50) return 10;
if (followersPerDay < 200) return 5;
return -10;
}

/**
* Calculate follower authenticity score based on engagement patterns.
* Higher score = more likely real followers.
*/
function calculateFollowerAuthenticity(params: {
followers: number;
following: number;
engagementRate: number; // Average engagement rate %
accountAgeDays: number;
avgCommentsPerPost: number;
avgLikesPerPost: number;
uniqueCommentersRatio: number; // 0-1 (unique commenters / total comments sampled)
followerGrowthMonthly: number; // % monthly growth
}): number {
let score = 50; // Base score

score += calculateEngagementScore(params.followers, params.engagementRate);
score += scoreFollowingRatio(params.followers, params.following);
score += scoreAccountGrowthRate(params.followers, params.accountAgeDays);

// Factor 4: Comment Diversity (10 points)
if (params.uniqueCommentersRatio > 0.8) score += 10;
else if (params.uniqueCommentersRatio > 0.5) score += 5;
else if (params.uniqueCommentersRatio < 0.3) score -= 5;

// Factor 5: Growth Consistency (10 points)
if (params.followerGrowthMonthly >= 0 && params.followerGrowthMonthly < 10)
score += 10;
else if (params.followerGrowthMonthly < 20) score += 5;
else if (params.followerGrowthMonthly > 50) score -= 10; // Spike

return Math.max(0, Math.min(100, score));
}

function scoreAvgEngagement(rate: number): number {
if (rate > 3) return 20;
if (rate > 2) return 15;
if (rate > 1) return 10;
if (rate > 0.5) return 5;
return -5;
}

function scorePostingFrequency(freq: number): number {
if (freq >= 2 && freq <= 5) return 10;
if (freq >= 1 && freq <= 7) return 5;
if (freq > 10) return -5;
return 0;
}

function scoreDealCompletion(completedDeals: number, totalDeals: number): number {
if (totalDeals <= 0) return 0;
const rate = completedDeals / totalDeals;
if (rate >= 0.9) return 10;
if (rate >= 0.7) return 5;
if (rate < 0.5) return -5;
return 0;
}

function scoreRating(averageRating: number, _totalDeals: number): number {
  const rating = averageRating > 5 ? averageRating / 100 : averageRating;
  if (rating >= 4.5) return 10;
  if (rating >= 4.0) return 7;
  if (rating >= 3.5) return 4;
  if (rating < 3.0 && rating > 0) return -5;
  return 0;
}

/**
* Calculate content quality score based on posting patterns and engagement.
*/
function calculateContentQuality(params: {
avgEngagementRate: number; // Average across last 10 posts
postingFrequencyPerWeek: number; // Posts per week
contentTypeVariety: number; // Number of different content types used (1-5)
completedDeals: number;
totalDeals: number;
averageRating: number; // 0-5
onTimeDeliveryRate: number; // 0-1
}): number {
let score = 50; // Base score

score += scoreAvgEngagement(params.avgEngagementRate);
score += scorePostingFrequency(params.postingFrequencyPerWeek);

// Factor 3: Content Variety (5 points)
if (params.contentTypeVariety >= 3) score += 5;
else if (params.contentTypeVariety >= 2) score += 3;

score += scoreDealCompletion(params.completedDeals, params.totalDeals);
score += scoreRating(params.averageRating, params.totalDeals);

// Factor 6: On-time delivery (5 points)
if (params.onTimeDeliveryRate >= 0.9) score += 5;
else if (params.onTimeDeliveryRate >= 0.7) score += 3;
else if (params.onTimeDeliveryRate < 0.5 && params.totalDeals > 0) score -= 3;

return Math.max(0, Math.min(100, score));
}

interface SyncedStats {
youtubeSubscribers: number | null;
youtubeEngagementRate: number | null;
instagramFollowers: number | null;
instagramEngagementRate: number | null;
}

async function syncYoutubeProfileStats(
handle: string,
currentSubs: number | null,
currentRate: number | null
): Promise<{ subscribers: number | null; engagementRate: number | null }> {
let subscribers = currentSubs;
let engagementRate = currentRate;

try {
const channel = await getYouTubeChannel(handle);
if (channel) {
subscribers = channel.subscriberCount;
const insights = await calculateYouTubeEngagement(channel.id);
if (insights) {
engagementRate = insights.engagementRate;
}
}
} catch (err) {
logger.error("Error syncing YouTube stats in cron", err);
}

return { subscribers, engagementRate };
}

async function syncInstagramProfileStats(
handle: string,
userId: string,
currentFollowers: number | null,
currentRate: number | null
): Promise<{ followers: number | null; engagementRate: number | null }> {
let followers = currentFollowers;
let engagementRate = currentRate;

try {
const oauth = await prisma.oAuthAccount.findFirst({
where: { userId, provider: "instagram" },
select: { accessToken: true },
});

const decryptedAccessToken = oauth?.accessToken ? decrypt(oauth.accessToken) : null;

if (decryptedAccessToken) {
const instaProfile = await getInstagramProfile(decryptedAccessToken);
if (instaProfile?.username.toLowerCase() === handle.toLowerCase()) {
followers = instaProfile.followersCount;
const insights = await calculateEngagement(decryptedAccessToken);
if (insights) {
engagementRate = insights.engagementRate;
}
}
} else {
logger.warn("Skipping Instagram social proof sync without OAuth token", {
userId,
});
}
} catch (err) {
logger.error("Error syncing Instagram stats in cron", err);
}

return { followers, engagementRate };
}

async function saveSyncedProfileStatsIfChanged(
profile: { youtubeSubscribers: number | null; youtubeEngagementRate: number | null; instagramFollowers: number | null; instagramEngagementRate: number | null },
userId: string,
updates: SyncedStats
): Promise<void> {
if (
updates.youtubeSubscribers !== profile.youtubeSubscribers ||
updates.youtubeEngagementRate !== profile.youtubeEngagementRate ||
updates.instagramFollowers !== profile.instagramFollowers ||
updates.instagramEngagementRate !== profile.instagramEngagementRate
) {
await prisma.influencerProfile.update({
where: { userId },
data: {
youtubeSubscribers: updates.youtubeSubscribers,
youtubeEngagementRate: updates.youtubeEngagementRate,
instagramFollowers: updates.instagramFollowers,
instagramEngagementRate: updates.instagramEngagementRate,
},
});

profile.youtubeSubscribers = updates.youtubeSubscribers;
profile.youtubeEngagementRate = updates.youtubeEngagementRate;
profile.instagramFollowers = updates.instagramFollowers;
profile.instagramEngagementRate = updates.instagramEngagementRate;
}
}

// ==================== ORCHESTRATOR ====================

/**
* Recalculate and save social proof scores for a specific influencer.
*/
async function recalculateSocialProof(
userId: string,
): Promise<SocialProofResult | null> {
try {
const profile = await prisma.influencerProfile.findUnique({
where: { userId },
select: {
id: true,
instagramHandle: true,
instagramFollowers: true,
instagramEngagementRate: true,
youtubeHandle: true,
youtubeSubscribers: true,
youtubeEngagementRate: true,
totalDeals: true,
completedDeals: true,
averageRating: true,
accountAge: true,
user: {
select: { createdAt: true },
},
},
});

if (profile) {
// Sync YouTube stats
let updatedYoutubeSubscribers = profile.youtubeSubscribers;
let updatedYoutubeEngagementRate = profile.youtubeEngagementRate;

if (profile.youtubeHandle) {
const yt = await syncYoutubeProfileStats(
profile.youtubeHandle,
profile.youtubeSubscribers,
profile.youtubeEngagementRate
);
updatedYoutubeSubscribers = yt.subscribers;
updatedYoutubeEngagementRate = yt.engagementRate;
}

// Sync Instagram stats
let updatedInstagramFollowers = profile.instagramFollowers;
let updatedInstagramEngagementRate = profile.instagramEngagementRate;

if (profile.instagramHandle) {
const insta = await syncInstagramProfileStats(
profile.instagramHandle,
userId,
profile.instagramFollowers,
profile.instagramEngagementRate
);
updatedInstagramFollowers = insta.followers;
updatedInstagramEngagementRate = insta.engagementRate;
}

// Save updated stats if they changed
await saveSyncedProfileStatsIfChanged(profile, userId, {
youtubeSubscribers: updatedYoutubeSubscribers,
youtubeEngagementRate: updatedYoutubeEngagementRate,
instagramFollowers: updatedInstagramFollowers,
instagramEngagementRate: updatedInstagramEngagementRate,
});
}

if (!profile) {
logger.warn("recalculateSocialProof: Profile not found", { userId });
return null;
}

// Fetch deal stats for quality calculation
const deals = await prisma.deal.findMany({
where: {
influencer: { userId },
status: { in: ["VERIFIED", "COMPLETED"] },
},
select: {
submittedAt: true,
postingDeadline: true,
},
});

const onTimeDeals = deals.filter(
(d: { postingDeadline: Date | null; submittedAt: Date | null }) =>
d.postingDeadline &&
d.submittedAt &&
new Date(d.submittedAt) <= new Date(d.postingDeadline),
).length;
const onTimeRate = deals.length > 0 ? onTimeDeals / deals.length : 1;

const followers =
profile.instagramFollowers ?? profile.youtubeSubscribers ?? 0;
const engagementRate =
profile.instagramEngagementRate ?? profile.youtubeEngagementRate ?? 0;
const accountAgeDays = Math.floor(
(Date.now() -
new Date(profile.accountAge || profile.user.createdAt).getTime()) /
(86400 * 1000),
);

// Calculate scores
const followerAuthenticityScore = calculateFollowerAuthenticity({
followers,
following: 0, // Would need API data in production
engagementRate,
accountAgeDays,
avgCommentsPerPost: 0, // Would need API data
avgLikesPerPost: 0, // Would need API data
uniqueCommentersRatio: 0.7, // Default assumption
followerGrowthMonthly: 5, // Default assumption (steady growth)
});

const contentQualityScore = calculateContentQuality({
avgEngagementRate: engagementRate,
postingFrequencyPerWeek: 3, // Default assumption
contentTypeVariety: 2, // Default assumption
completedDeals: profile.completedDeals,
totalDeals: profile.totalDeals,
averageRating: profile.averageRating,
onTimeDeliveryRate: onTimeRate,
});

// Save to profile
await prisma.influencerProfile.update({
where: { userId },
data: {
followerAuthenticityScore,
contentQualityScore,
},
});

const result: SocialProofResult = {
followerAuthenticityScore,
contentQualityScore,
breakdown: {
engagementRateScore: calculateEngagementScore(
followers,
engagementRate,
),
followingRatioScore: 10, // Default without API data
accountAgeScore: accountAgeDays > 180 ? 10 : 5,
commentDiversityScore: 7, // Default
growthConsistencyScore: 10, // Default
avgEngagementScore: engagementRate > 2 ? 15 : 10,
postingConsistencyScore: 5,
contentVarietyScore: 3,
completionRateScore:
profile.totalDeals > 0
? Math.round((profile.completedDeals / profile.totalDeals) * 10)
: 5,
},
};

logger.info("Social proof recalculated", {
userId,
followerAuthenticityScore,
contentQualityScore,
});

return result;
} catch (error) {
logger.error("recalculateSocialProof failed", error, { userId });
return null;
}
}

/**
* Batch recalculate social proof for all active influencers.
* Used by the weekly cron job.
*/
export async function recalculateAllSocialProof(): Promise<{
processed: number;
failed: number;
}> {
let processed = 0;
let failed = 0;
let skip = 0;
const take = 50;
const concurrency = 5;

while (true) {
const influencers = await prisma.influencerProfile.findMany({
where: {
user: { status: "ACTIVE" },
},
select: { userId: true },
skip,
take,
});

if (influencers.length === 0) {
break;
}

// Process the batch in parallel chunks of concurrency 5
for (let i = 0; i < influencers.length; i += concurrency) {
const chunk = influencers.slice(i, i + concurrency);
await Promise.all(
chunk.map(async (inf: { userId: string }) => {
try {
const result = await recalculateSocialProof(inf.userId);
if (result) {
processed++;
} else {
failed++;
}
} catch (error) {
logger.error("Batch social proof failed for user", error, {
userId: inf.userId,
});
failed++;
}
}),
);

// Introduce a batch delay of 1.5 seconds between concurrent chunks to respect external API rate limits
if (i + concurrency < influencers.length) {
await new Promise((resolve) => setTimeout(resolve, 1500));
}
}

skip += take;
}

return { processed, failed };
}

// ==================== HELPERS ====================

function calculateEngagementScore(
  followers: number,
  engagementRate: number,
): number {
  type Bracket = { maxFollowers: number; rules: { minRate: number; maxRate: number; score: number }[] };
  const brackets: Bracket[] = [
    {
      maxFollowers: 10_000,
      rules: [
        { minRate: 4, maxRate: 10, score: 25 },
        { minRate: 2, maxRate: 4, score: 15 },
        { minRate: 10, maxRate: 20, score: 10 },
        { minRate: 1, maxRate: 2, score: 5 },
        { minRate: 20, maxRate: Infinity, score: -10 },
      ],
    },
    {
      maxFollowers: 50_000,
      rules: [
        { minRate: 2, maxRate: 6, score: 20 },
        { minRate: 6, maxRate: 12, score: 15 },
        { minRate: 1, maxRate: 2, score: 10 },
        { minRate: 0.5, maxRate: 1, score: 5 },
        { minRate: 12, maxRate: Infinity, score: -5 },
      ],
    },
    {
      maxFollowers: 500_000,
      rules: [
        { minRate: 1.5, maxRate: 5, score: 15 },
        { minRate: 5, maxRate: 10, score: 12 },
        { minRate: 0.5, maxRate: 1.5, score: 8 },
        { minRate: 0.2, maxRate: 0.5, score: 3 },
        { minRate: 10, maxRate: Infinity, score: -5 },
      ],
    },
    {
      maxFollowers: Infinity,
      rules: [
        { minRate: 0.8, maxRate: 3, score: 10 },
        { minRate: 3, maxRate: 6, score: 8 },
        { minRate: 0.2, maxRate: 0.8, score: 5 },
        { minRate: 0, maxRate: 0.2, score: 2 },
        { minRate: 6, maxRate: Infinity, score: -5 },
      ],
    },
  ];
  const defaults = [5, 5, 3, 2];
  const bracketIdx = brackets.findIndex((b) => followers < b.maxFollowers);
  const bracket = (bracketIdx >= 0 ? brackets[bracketIdx] : brackets.at(-1))!;
  const defaultScore = (bracketIdx >= 0 ? defaults[bracketIdx] : defaults.at(-1)) ?? 2;
  const rule = bracket.rules.find((r) => engagementRate >= r.minRate && engagementRate <= r.maxRate);
  return rule ? rule.score : defaultScore;
}
