/**
* Engagement Tracker
* Captures and tracks post engagement metrics at 24h, 48h, and 7d intervals.
*
* Spec Part 4 Step 3: Track views, likes, comments, shares, saves
* and calculate ROI for brands.
*
* STRICT RULE-BASED LOGIC ONLY NO ML.
*/

import prisma from "./db";
import { logger } from "./logger";
import { findPostByUrl } from "./instagram";
import { verifyYouTubeVideoIsLive } from "./youtube";
import { decrypt } from "./encryption";

// ==================== TYPES ====================

interface EngagementMetrics {
views: number;
likes: number;
comments: number;
shares: number;
saves: number;
clicks: number;
engagementRate: number;
clickThroughRate: number;
estimatedReach: number;
}

export interface EngagementReport {
dealId: string;
postUrl: string | null;
snapshots: {
interval: string;
metrics: EngagementMetrics;
capturedAt: Date;
/** true when values are rule-based estimates, false when sourced from real API data */
isEstimated: boolean;
}[];
roi: ROICalculation | null;
trend: "GROWING" | "STABLE" | "DECLINING" | "INSUFFICIENT_DATA";
/** true if ANY snapshot in this report is estimated used to show a UI disclaimer */
hasEstimatedData: boolean;
}

interface ROICalculation {
dealAmount: number; // in paise
costPerView: number; // in paise
costPerEngagement: number; // in paise
costPerClick: number; // in paise
estimatedValue: number; // in paise
roiPercentage: number; // positive = profit
}

// ==================== METRICS CAPTURE ====================

/**
* Capture engagement metrics for a deal's post at a specific interval.
* In production, this would call Instagram/YouTube APIs.
* Currently uses rule-based estimation from post URL analysis.
*/
async function fetchRealYouTubeMetrics(postUrl: string): Promise<Partial<EngagementMetrics> | null> {
if (!postUrl.includes("youtube.com") && !postUrl.includes("youtu.be")) {
return null;
}
try {
const ytResult = await verifyYouTubeVideoIsLive(postUrl);
if (ytResult.isLive && ytResult.video) {
const video = ytResult.video;
const views = video.viewCount;
const likes = video.likeCount;
const comments = video.commentCount;
const shares = Math.round(likes * 0.1);
const saves = 0;
const clicks = Math.round(views * 0.02);
const totalEngagements = likes + comments + shares + saves;
const er = views > 0 ? (totalEngagements / views) * 100 : 0;
const ctr = views > 0 ? (clicks / views) * 100 : 0;

return {
views,
likes,
comments,
shares,
saves,
clicks,
engagementRate: Math.round(er * 100) / 100,
clickThroughRate: Math.round(ctr * 100) / 100,
estimatedReach: Math.round(views * 0.8),
};
}
} catch (err) {
logger.error("Error fetching real YouTube stats for engagement capture", err);
}
return null;
}

async function fetchRealInstagramMetrics(postUrl: string, userId: string): Promise<Partial<EngagementMetrics> | null> {
if (!postUrl.includes("instagram.com")) {
return null;
}
try {
const oauth = await prisma.oAuthAccount.findFirst({
where: { userId, provider: "instagram" },
select: { accessToken: true },
});
const decryptedAccessToken = oauth?.accessToken ? decrypt(oauth.accessToken) : null;
if (decryptedAccessToken) {
const post = await findPostByUrl(decryptedAccessToken, postUrl);
if (post) {
const likes = post.likeCount;
const comments = post.commentsCount;
const views = Math.max(likes * 6, likes + comments);
const shares = Math.round(likes * 0.05);
const saves = Math.round(likes * 0.08);
const clicks = Math.round(likes * 0.15);
const totalEngagements = likes + comments + shares + saves;
const er = views > 0 ? (totalEngagements / views) * 100 : 0;
const ctr = views > 0 ? (clicks / views) * 100 : 0;

return {
views,
likes,
comments,
shares,
saves,
clicks,
engagementRate: Math.round(er * 100) / 100,
clickThroughRate: Math.round(ctr * 100) / 100,
estimatedReach: Math.round(likes * 4),
};
}
}
} catch (err) {
logger.error("Error fetching real Instagram stats for engagement capture", err);
}
return null;
}

export async function captureEngagement(
dealId: string,
interval: "24h" | "48h" | "7d",
): Promise<EngagementMetrics | null> {
try {
const deal = await prisma.deal.findUnique({
where: { id: dealId },
include: {
influencer: {
select: {
userId: true,
instagramFollowers: true,
instagramEngagementRate: true,
instagramHandle: true,
youtubeHandle: true,
youtubeSubscribers: true,
youtubeEngagementRate: true,
},
},
campaign: {
select: { deliverables: true },
},
},
});

if (!deal?.postUrl) {
logger.warn("Cannot capture engagement: no post URL", { dealId });
return null;
}

// Check if already captured for this interval
const existing = await prisma.engagementSnapshot.findUnique({
where: { dealId_interval: { dealId, interval } },
});

if (existing) {
logger.info("Engagement already captured for interval", {
dealId,
interval,
});
return {
views: existing.views,
likes: existing.likes,
comments: existing.comments,
shares: existing.shares,
saves: existing.saves,
clicks: existing.clicks,
engagementRate: existing.engagementRate,
clickThroughRate: existing.clickThroughRate,
estimatedReach: existing.estimatedReach,
};
}

let realMetrics: Partial<EngagementMetrics> | null = null;
let usedRealData = false;

// Check if YouTube
realMetrics = await fetchRealYouTubeMetrics(deal.postUrl);
if (realMetrics) {
usedRealData = true;
logger.info("Captured real YouTube engagement metrics", { dealId, metrics: realMetrics });
} else {
// Check if Instagram
realMetrics = await fetchRealInstagramMetrics(deal.postUrl, deal.influencer.userId);
if (realMetrics) {
usedRealData = true;
logger.info("Captured real Instagram engagement metrics", { dealId, metrics: realMetrics });
}
}

const isYouTubePost =
deal.postUrl.includes("youtube.com") || deal.postUrl.includes("youtu.be");
const fallbackFollowers = isYouTubePost
? deal.influencer.youtubeSubscribers || 0
: deal.influencer.instagramFollowers || 0;
const fallbackEngagementRate = isYouTubePost
? deal.influencer.youtubeEngagementRate || 0
: deal.influencer.instagramEngagementRate || 0;

const isEstimated = !usedRealData;
const metrics = usedRealData
? (realMetrics as EngagementMetrics)
: estimateMetrics(fallbackFollowers, fallbackEngagementRate, interval);

// Save snapshot
await prisma.engagementSnapshot.create({
data: {
dealId,
interval,
...metrics,
isEstimated,
capturedAt: new Date(),
},
});

logger.info("Engagement captured", { dealId, interval, isEstimated, metrics });
return metrics;
} catch (error) {
logger.error("Engagement capture failed", { dealId, interval, error });
return null;
}
}

/**
* Estimate engagement metrics based on follower count and engagement rate.
* Rule-based estimation replace with actual API data in production.
*/
function estimateMetrics(
followers: number,
engagementRate: number,
interval: "24h" | "48h" | "7d",
): EngagementMetrics {
// Reach multiplier by interval (content gets discovered over time)
const reachMultipliers: Record<string, number> = {
"24h": 0.15, // 15% of followers see in 24h
"48h": 0.25, // 25% in 48h
"7d": 0.4, // 40% in 7 days
};

const reachMult = reachMultipliers[interval] || 0.15;
const estimatedReach = Math.round(followers * reachMult);

// Views are typically higher than reach (due to explore/hashtag discovery)
const views = Math.round(estimatedReach * 1.3);

// Engagement breakdown (distribution of total engagement)
const totalEngagements = Math.round(views * (engagementRate / 100));
const likes = Math.round(totalEngagements * 0.7); // 70% likes
const comments = Math.round(totalEngagements * 0.1); // 10% comments
const shares = Math.round(totalEngagements * 0.08); // 8% shares
const saves = Math.round(totalEngagements * 0.12); // 12% saves

// Click-through rate (typically 1-3% for sponsored content)
const clicks = Math.round(views * 0.02);

const actualEngagementRate =
views > 0 ? ((likes + comments + shares + saves) / views) * 100 : 0;

const clickThroughRate = views > 0 ? (clicks / views) * 100 : 0;

return {
views,
likes,
comments,
shares,
saves,
clicks,
engagementRate: Math.round(actualEngagementRate * 100) / 100,
clickThroughRate: Math.round(clickThroughRate * 100) / 100,
estimatedReach,
};
}

// ==================== REPORT GENERATION ====================

/**
* Get engagement report for a deal, including all snapshots and ROI calculation.
*/
export async function getEngagementReport(
dealId: string,
): Promise<EngagementReport | null> {
const deal = await prisma.deal.findUnique({
where: { id: dealId },
include: {
engagementSnapshots: {
orderBy: { capturedAt: "asc" },
},
},
});

if (!deal) return null;

const snapshots = deal.engagementSnapshots.map((s: { interval: string; views: number; likes: number; comments: number; shares: number; saves: number; clicks: number; engagementRate: number; clickThroughRate: number; estimatedReach: number; isEstimated: boolean; capturedAt: Date }) => ({
interval: s.interval,
metrics: {
views: s.views,
likes: s.likes,
comments: s.comments,
shares: s.shares,
saves: s.saves,
clicks: s.clicks,
engagementRate: s.engagementRate,
clickThroughRate: s.clickThroughRate,
estimatedReach: s.estimatedReach,
},
capturedAt: s.capturedAt,
isEstimated: s.isEstimated,
}));

const latestSnapshot =
deal.engagementSnapshots.find((s: { interval: string }) => s.interval === "7d") ||
deal.engagementSnapshots.at(-1);

const roi = latestSnapshot ? calculateROI(deal.amount, latestSnapshot) : null;
const trend = calculateTrend(deal.engagementSnapshots);

return {
dealId,
postUrl: deal.postUrl,
snapshots,
roi,
trend,
hasEstimatedData: snapshots.some((s) => s.isEstimated),
};
}

/**
* Calculate ROI for a deal based on engagement metrics.
*/
function calculateROI(
dealAmountPaise: number,
snapshot: {
views: number;
likes: number;
comments: number;
shares: number;
saves: number;
clicks: number;
},
): ROICalculation {
const totalEngagements =
snapshot.likes + snapshot.comments + snapshot.shares + snapshot.saves;

  // Cost per metrics (in paise)
  const costPerView =
    snapshot.views > 0 ? Math.round(dealAmountPaise / snapshot.views) : dealAmountPaise;

  const costPerEngagement =
    totalEngagements > 0 ? Math.round(dealAmountPaise / totalEngagements) : dealAmountPaise;

  const costPerClick =
    snapshot.clicks > 0 ? Math.round(dealAmountPaise / snapshot.clicks) : dealAmountPaise;

// Estimated value (EMV) using weighted coefficients: views = 0.20 (20 paise), engagement = 1.00 (100 paise), clicks = 5.00 (500 paise)
const estimatedValue = Math.round(
snapshot.views * 20 +
totalEngagements * 100 +
snapshot.clicks * 500
);

// ROI percentage: ((value - cost) / cost) * 100
const roiPercentage =
dealAmountPaise > 0
? Math.round(
((estimatedValue - dealAmountPaise) / dealAmountPaise) * 10000,
) / 100
: 0;

return {
dealAmount: dealAmountPaise,
costPerView,
costPerEngagement,
costPerClick,
estimatedValue,
roiPercentage,
};
}

/**
* Calculate engagement trend based on multiple snapshots.
*/
function calculateTrend(
snapshots: Array<{ interval: string; engagementRate: number }>,
): "GROWING" | "STABLE" | "DECLINING" | "INSUFFICIENT_DATA" {
if (snapshots.length < 2) return "INSUFFICIENT_DATA";

const ordered = ["24h", "48h", "7d"];
const sortedSnapshots = snapshots
.filter((s: { interval: string }) => ordered.includes(s.interval))
.sort((a, b) => ordered.indexOf(a.interval) - ordered.indexOf(b.interval));

if (sortedSnapshots.length < 2) return "INSUFFICIENT_DATA";

const first = sortedSnapshots[0]?.engagementRate ?? 0;
const last = sortedSnapshots.at(-1)?.engagementRate ?? 0;

if (first === 0) return "INSUFFICIENT_DATA";

const changePercent = ((last - first) / first) * 100;

if (changePercent > 10) return "GROWING";
if (changePercent < -10) return "DECLINING";
return "STABLE";
}

// ==================== BATCH CAPTURE ====================

/**
* Batch capture engagement for all verified deals.
* Called by cron job to capture metrics at the right intervals.
*/
export async function batchCaptureEngagement(): Promise<{
captured: number;
skipped: number;
errors: number;
}> {
const now = new Date();
let captured = 0;
let skipped = 0;
let errors = 0;

// Find all verified/completed deals with post URLs
const deals = await prisma.deal.findMany({
where: {
status: { in: ["VERIFIED", "COMPLETED"] },
postUrl: { not: null },
postedAt: { not: null },
},
select: {
id: true,
postedAt: true,
engagementSnapshots: {
select: { interval: true },
},
},
});

for (const deal of deals) {
if (!deal.postedAt) continue;

const hoursSincePost =
(now.getTime() - deal.postedAt.getTime()) / (1000 * 60 * 60);
const capturedIntervals = new Set(
deal.engagementSnapshots.map((s: { interval: string }) => s.interval),
);

// Determine which interval to capture
let intervalToCapture: "24h" | "48h" | "7d" | null = null;

if (
hoursSincePost >= 24 &&
hoursSincePost < 48 &&
!capturedIntervals.has("24h")
) {
intervalToCapture = "24h";
} else if (
hoursSincePost >= 48 &&
hoursSincePost < 168 &&
!capturedIntervals.has("48h")
) {
intervalToCapture = "48h";
} else if (hoursSincePost >= 168 && !capturedIntervals.has("7d")) {
intervalToCapture = "7d";
}

if (!intervalToCapture) {
skipped++;
continue;
}

try {
await captureEngagement(deal.id, intervalToCapture);
captured++;
} catch {
errors++;
}
}

return { captured, skipped, errors };
}
