import prisma from "../db";
import { logger } from "../logger";
import { decrypt } from "../encryption";
import { Prisma } from "@prisma/client";
import { FraudCheckResult, FraudFlag, PostVerificationParams, GrowthCheckParams, FakePostTimingParams, EngagementAnomalyParams, VerifiedPostData } from "./types";
import { fetchInstagramPostDataDetailed, fetchYouTubePostDataDetailed, runVerificationRules } from "./payment";
import { findPostByUrl } from "../instagram";
import { extractVideoId, getYouTubeVideo } from "../youtube";
import { resolveFraudAction } from "./utils";

export async function checkPostVerification(
params: PostVerificationParams,
): Promise<FraudCheckResult> {
const flags: FraudFlag[] = [];
let riskScore = 0;

// 1. Official platform API content retrieval
let verifiedPostData: VerifiedPostData | null = null;

// Deep Verification: If it's Instagram, try to use Official API if we have a token
if (params.postUrl.includes("instagram.com")) {
const igResult = await fetchInstagramPostDataDetailed(params.postUrl, params.influencerUserId);
if (igResult.status === "FOUND") {
verifiedPostData = igResult.data;
logger.info("Deep verification used for Instagram post", { dealId: params.dealId });
} else if (igResult.status === "CONFIRMED_DELETED") {
flags.push({
rule: "POST_NO_LONGER_ACCESSIBLE",
severity: "CRITICAL",
description: igResult.reason || "Instagram post not found in recent media (deleted or private)",
});
riskScore += 80;
} else {
// Transient check failure (API error, rate limit, token issue)
flags.push({
rule: "POST_VERIFICATION_CHECK_FAILED",
severity: "MEDIUM",
description: `Instagram verification check failed: ${igResult.reason}`,
});
riskScore += 10;
}
}

// Deep Verification: If it's YouTube
if (!verifiedPostData && (params.postUrl.includes("youtube.com") || params.postUrl.includes("youtu.be"))) {
const ytResult = await fetchYouTubePostDataDetailed(params.postUrl, params.influencerUserId);
if (ytResult.status === "FOUND") {
verifiedPostData = ytResult.data;
logger.info("Deep verification used for YouTube video", { dealId: params.dealId });
} else if (ytResult.status === "CONFIRMED_DELETED") {
flags.push({
rule: "POST_NO_LONGER_ACCESSIBLE",
severity: "CRITICAL",
description: ytResult.reason || "YouTube video not found (deleted or private)",
});
riskScore += 80;
} else {
// Transient check failure (API error, rate limit, quota issue)
flags.push({
rule: "POST_VERIFICATION_CHECK_FAILED",
severity: "MEDIUM",
description: `YouTube verification check failed: ${ytResult.reason}`,
});
riskScore += 10;
}
}

if (!verifiedPostData) {
const isNoLongerAccessible = flags.some((f) => f.rule === "POST_NO_LONGER_ACCESSIBLE");
if (isNoLongerAccessible) {
return {
passed: false,
flags,
riskScore,
action: "BLOCK",
};
}
const isCheckFailed = flags.some((f) => f.rule === "POST_VERIFICATION_CHECK_FAILED");
if (isCheckFailed) {
return {
passed: false,
flags,
riskScore,
action: "REVIEW",
};
}
return {
passed: true,
flags: [
{
rule: "OFFICIAL_VERIFICATION_UNAVAILABLE",
severity: "MEDIUM",
description:
"Could not verify the post through official platform APIs. Manual review recommended.",
},
],
riskScore: 20,
action: "FLAG",
};
}

riskScore += runVerificationRules(verifiedPostData, params, flags);

// Determine action
let action: FraudCheckResult["action"] = "ALLOW";
if (riskScore >= 80) action = "BLOCK";
else if (riskScore >= 40) action = "REVIEW";
else if (riskScore >= 15) action = "FLAG";

return {
passed: action === "ALLOW" || action === "FLAG",
flags,
riskScore,
action,
};
}

// ==================== HELPER FUNCTIONS ====================

/**
* Simple text similarity using Jaccard index
*/
export function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/).map((w) => w.trim()).filter(Boolean));
  const words2 = new Set(text2.toLowerCase().split(/\s+/).map((w) => w.trim()).filter(Boolean));

  if (words1.size === 0 && words2.size === 0) return 0;

  const intersection = new Set([...words1].filter((x) => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

// VPN/Proxy check is now handled by the standalone ipinfo.ts module
// See: src/lib/ipinfo.ts isVPNOrProxy()

// ==================== GROWTH & METRICS CHECKS ====================


export function checkGrowthFraud(params: GrowthCheckParams): FraudCheckResult {
const flags: FraudFlag[] = [];
let riskScore = 0;

// Rule: >20% growth in 48h is suspicious
if (
params.timeDeltaHours > 0 &&
params.timeDeltaHours <= 48 &&
params.previousFollowers > 0
) {
const growthRate =
(params.currentFollowers - params.previousFollowers) /
params.previousFollowers;

if (growthRate > 0.2) {
flags.push({
rule: "UNNATURAL_GROWTH_SPIKE",
severity: "HIGH",
description: `Suspicious growth of ${(growthRate * 100).toFixed(1)}% in ${params.timeDeltaHours}h`,
});
riskScore += 40;
}
}

let action: FraudCheckResult["action"] = "ALLOW";
if (riskScore >= 40) action = "FLAG";

return {
passed: action === "ALLOW",
flags,
riskScore,
action,
};
}

// ==================== ANTI-CHEAT: FAKE POST DETECTION ====================


/**
* Flag posts that appear too quickly after deal acceptance likely pre-made or recycled content.
* Also detects suspiciously small gaps between post creation and submission.
*/
export function checkFakePostTiming(
params: FakePostTimingParams,
): FraudCheckResult {
const flags: FraudFlag[] = [];
let riskScore = 0;

// Rule 1: Post created < 1 minute before submission (instant submission = suspicious)
const gapMinutes =
(params.submissionTimestamp.getTime() - params.postTimestamp.getTime()) /
(1000 * 60);
if (gapMinutes < 1 && gapMinutes >= 0) {
flags.push({
rule: "INSTANT_POST_SUBMISSION",
severity: "HIGH",
description: `Post was created less than 1 minute before submission (${gapMinutes.toFixed(1)}m gap)`,
});
riskScore += 40;
}

// Rule 2: Post was created before deal was accepted (recycled content)
if (params.postTimestamp < params.dealAcceptedAt) {
const hoursBefore =
(params.dealAcceptedAt.getTime() - params.postTimestamp.getTime()) /
(3600 * 1000);
flags.push({
rule: "PRE_DEAL_CONTENT",
severity: "CRITICAL",
description: `Post was created ${Math.round(hoursBefore)}h BEFORE deal acceptance likely recycled content`,
});
riskScore += 80;
}

// Rule 3: Post was created within 30 minutes of deal acceptance (too fast for quality content)
const hoursAfterAcceptance =
(params.postTimestamp.getTime() - params.dealAcceptedAt.getTime()) /
(3600 * 1000);
if (hoursAfterAcceptance > 0 && hoursAfterAcceptance < 0.5) {
flags.push({
rule: "SUSPICIOUSLY_FAST_CREATION",
severity: "MEDIUM",
description: `Content created within 30 minutes of deal acceptance`,
});
riskScore += 25;
}

let action: FraudCheckResult["action"] = "ALLOW";
if (riskScore >= 80) action = "BLOCK";
else if (riskScore >= 40) action = "REVIEW";
else if (riskScore >= 25) action = "FLAG";

return {
passed: action === "ALLOW" || action === "FLAG",
flags,
riskScore,
action,
};
}

// ==================== ENGAGEMENT ANOMALY DETECTION ====================


function checkLikeViewAnomaly(
likes: number,
views: number,
flags: FraudFlag[]
): number {
let riskScore = 0;
if (views > 0) {
const likeViewRatio = (likes / views) * 100;
if (likeViewRatio > 30) {
flags.push({
rule: "ABNORMAL_LIKE_VIEW_RATIO",
severity: "HIGH",
description: `Like/view ratio ${likeViewRatio.toFixed(1)}% is abnormally high (industry: 3-15%)`,
});
riskScore += 35;
}
if (likeViewRatio < 0.5 && views > 1000) {
flags.push({
rule: "LOW_LIKE_VIEW_RATIO",
severity: "MEDIUM",
description: `Like/view ratio ${likeViewRatio.toFixed(1)}% is abnormally low possible bot views`,
});
riskScore += 20;
}
}
return riskScore;
}

/**
* Check for engagement anomalies that suggest bought engagement or bot activity.
* Uses industry benchmarks for engagement rates by follower tier.
*/
export function checkEngagementAnomaly(
params: EngagementAnomalyParams,
): FraudCheckResult {
const flags: FraudFlag[] = [];
let riskScore = 0;

// Benchmark engagement rates by follower tier (industry median)
const engagementRate =
params.followers > 0
? ((params.likes + params.comments) / params.followers) * 100
: 0;

// Rule 1: Like/View ratio anomaly
// Normal ratio: 3-15% for reels/videos
riskScore += checkLikeViewAnomaly(params.likes, params.views, flags);

// Rule 2: Engagement rate vs follower count benchmark
// Nano (1K-10K): 4-6% avg | Micro (10K-50K): 2-4% | Mid (50K-500K): 1-3% | Macro (500K+): 0.5-2%
if (params.followers >= 10000 && engagementRate > 15) {
flags.push({
rule: "SUSPICIOUSLY_HIGH_ENGAGEMENT",
severity: "HIGH",
description: `Engagement rate ${engagementRate.toFixed(1)}% is unrealistically high for ${params.followers.toLocaleString()} followers`,
});
riskScore += 30;
}

// Rule 3: Zero comments but high likes (bot liking pattern)
if (params.likes > 100 && params.comments === 0) {
flags.push({
rule: "ZERO_COMMENTS_HIGH_LIKES",
severity: "MEDIUM",
description: `${params.likes} likes but zero comments typical bot pattern`,
});
riskScore += 25;
}

// Rule 4: Comment/like ratio anomaly
// Normal: 1-5% of likes should be comments
if (params.likes > 50) {
const commentLikeRatio = (params.comments / params.likes) * 100;
if (commentLikeRatio > 50) {
flags.push({
rule: "ABNORMAL_COMMENT_LIKE_RATIO",
severity: "MEDIUM",
description: `Comment/like ratio ${commentLikeRatio.toFixed(1)}% is abnormally high possible comment bots`,
});
riskScore += 20;
}
}

const action = resolveFraudAction(riskScore);

return {
passed: action === "ALLOW" || action === "FLAG",
flags,
riskScore,
action,
};
}

// ==================== COMMENT QUALITY (BOT DETECTION) ====================

/**
* Analyze comment quality to detect bot-generated comments.
* Uses regex patterns for common bot signatures.
*/
export function checkCommentQuality(comments: string[]): FraudCheckResult {
const flags: FraudFlag[] = [];
let riskScore = 0;

if (comments.length === 0) {
return { passed: true, flags: [], riskScore: 0, action: "ALLOW" };
}

  // Bot patterns
  const botPatterns = [
    /^(nice|great|wow|amazing|beautiful|love it|cool|awesome|fire|\u{1F525}|\u{2764}\u{FE0F}|\u{1F44D}|\u{1F4AF}|\u{1F60D}|\u{1F44F}){1,3}$/ui,
    /^follow me/i,
    /^check (my|out)/i,
    /^dm me for/i,
    /^(earn|make) \$?\d+ (per|a) (day|hour)/i,
    /^interested\?? (dm|message|text)/i,
  ];

const uniqueComments = new Set(comments.map((c) => c.trim().toLowerCase()));
const duplicateRatio = 1 - uniqueComments.size / comments.length;

// Rule 1: High duplicate comment ratio
if (comments.length >= 10 && duplicateRatio > 0.5) {
flags.push({
rule: "HIGH_DUPLICATE_COMMENTS",
severity: "HIGH",
description: `${(duplicateRatio * 100).toFixed(0)}% of comments are duplicates`,
});
riskScore += 35;
}

// Rule 2: Bot pattern matching
const botCommentCount = comments.filter((c) =>
botPatterns.some((pattern) => pattern.test(c.trim())),
).length;

const botRatio = botCommentCount / comments.length;
if (botRatio > 0.3) {
flags.push({
rule: "BOT_COMMENT_PATTERN",
severity: "HIGH",
description: `${(botRatio * 100).toFixed(0)}% of comments match bot patterns`,
});
riskScore += 40;
}

// Rule 3: Very short comments (all <5 chars)
const shortComments = comments.filter((c) => c.trim().length < 5).length;
const shortRatio = shortComments / comments.length;
if (shortRatio > 0.7 && comments.length >= 10) {
flags.push({
rule: "MOSTLY_SHORT_COMMENTS",
severity: "MEDIUM",
description: `${(shortRatio * 100).toFixed(0)}% of comments are under 5 characters`,
});
riskScore += 20;
}

// Rule 4: Low unique commenter ratio (need unique commenters vs total)
// This would require commenter IDs - here we just check comment diversity
const uniqueWords = new Set(
comments.flatMap((c) => c.toLowerCase().split(/\s+/)),
);
if (uniqueWords.size < 10 && comments.length >= 20) {
flags.push({
rule: "LOW_VOCABULARY_DIVERSITY",
severity: "MEDIUM",
description: `Only ${uniqueWords.size} unique words across ${comments.length} comments`,
});
riskScore += 15;
}

const action = resolveFraudAction(riskScore);

return {
passed: action === "ALLOW" || action === "FLAG",
flags,
riskScore,
action,
};
}

// ==================== ACCOUNT PRIVACY FLIP DETECTION ====================

/**
* Check if an influencer's account has been toggled to private after posting deal content.
* This is a common tactic to hide fake engagement or remove content from public view.
*/
export async function checkAccountPrivacyFlip(
userId: string,
postUrl: string,
): Promise<FraudCheckResult> {
const flags: FraudFlag[] = [];
let riskScore = 0;

let verifiedLive: boolean | null = null;

if (postUrl.includes("instagram.com")) {
const oauth = await prisma.oAuthAccount.findFirst({
where: { userId, provider: "instagram" },
select: { accessToken: true },
});

const decryptedAccessToken = oauth?.accessToken ? decrypt(oauth.accessToken) : null;

if (decryptedAccessToken) {
const post = await findPostByUrl(decryptedAccessToken, postUrl);
verifiedLive = Boolean(post);
}
}

  const youtubeId = extractVideoId(postUrl);
  if (verifiedLive === null && youtubeId) {
    const video = await getYouTubeVideo(youtubeId);
    // Use video existence and explicit privacyStatus public check.
    verifiedLive = Boolean(video?.privacyStatus === "public");
  }

if (verifiedLive === false) {
flags.push({
rule: "POST_NO_LONGER_ACCESSIBLE",
severity: "CRITICAL",
description: "Official platform API no longer returns the post as public",
});
riskScore += 80;
  } else if (verifiedLive === null) {
    flags.push({
      rule: "OFFICIAL_VERIFICATION_UNAVAILABLE",
      severity: "MEDIUM",
      description: "Official platform API verification is unavailable",
    });
    riskScore += 15;
  }

let action: FraudCheckResult["action"] = "ALLOW";
if (riskScore >= 80) action = "BLOCK";
else if (riskScore >= 50) action = "REVIEW";
else if (riskScore >= 30) action = "FLAG";

return {
passed: action === "ALLOW" || action === "FLAG",
flags,
riskScore,
action,
};
}

// ==================== CONTENT UNIQUENESS CHECKS ====================

export async function checkContentUniqueness(
contentHash: string,
currentDealId?: string,
): Promise<FraudCheckResult> {
const flags: FraudFlag[] = [];
let riskScore = 0;

// Check if this content hash has been used in any other deal
// This prevents:
// 1. Resubmitting same content for multiple campaigns
// 2. Stealing content from other influencers (if hash matches)

// Note: This requires the Deal model to have verificationHash field (which it does)
const duplicateWhere: Prisma.DealWhereInput = {
verificationHash: contentHash,
status: { in: ["COMPLETED", "VERIFIED", "POSTED", "CONTENT_APPROVED"] },
};
if (currentDealId) {
duplicateWhere.id = { not: currentDealId };
}

const duplicate = await prisma.deal.findFirst({
where: {
...duplicateWhere,
},
select: {
id: true,
influencerId: true,
postedAt: true,
},
});

if (duplicate) {
flags.push({
rule: "DUPLICATE_CONTENT_HASH",
severity: "CRITICAL",
description: `Content matches existing deal ${duplicate.id}`,
evidence: `Match found with deal from ${duplicate.postedAt}`,
});
riskScore += 100; // Immediate block
}

let action: FraudCheckResult["action"] = "ALLOW";
if (riskScore >= 100) action = "BLOCK";

return {
passed: action === "ALLOW",
flags,
riskScore,
action,
};
}

// ==================== BLACKLIST CHECKS ====================

