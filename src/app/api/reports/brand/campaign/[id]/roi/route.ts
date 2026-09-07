import { NextRequest } from "next/server";
import { apiWrapper, ApiResponse, type AuthenticatedRequest } from "@/lib/api-wrapper";
import prisma from "@/lib/db";
import { toCsv, csvResponse, paiseToRupees } from "@/lib/csv-export";
import { RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { getPlatformHeader, getPlatformFooter } from "@/lib/platform-config";

async function _handler(req: NextRequest, context: { params: Promise<Record<string, string | string[]>> }) {
const session = (req as AuthenticatedRequest).session;

const params = await context.params;
const campaignId = params.id as string;
const fmt = new URL(req.url).searchParams.get("format") === "csv" ? "csv" : "json";

// Verify brand owns this campaign
const campaign = await prisma.campaign.findUnique({
where: { id: campaignId },
include: {
brand: { select: { userId: true } },
deals: {
where: { status: "COMPLETED" },
include: {
engagementSnapshots: {
orderBy: { capturedAt: "desc" },
},
influencer: {
select: {
displayName: true,
instagramHandle: true,
instagramFollowers: true,
youtubeSubscribers: true,
averageRating: true,
},
},
},
},
},
});

if (!campaign) return ApiResponse.error("Campaign not found", 404);
if (!campaign.brand || campaign.brand.userId !== session.user.id) return ApiResponse.forbidden();

// Per-influencer ROI
const influencerBreakdown = campaign.deals.map((deal) => {
// Best snapshot = 7d (most data), fallback to 48h, fallback to 24h
const snapshot = deal.engagementSnapshots.find(s => s.interval === "7d")
?? deal.engagementSnapshots.find(s => s.interval === "48h")
?? deal.engagementSnapshots.find(s => s.interval === "24h")
?? deal.engagementSnapshots[0];

const totalEngagements = snapshot
? snapshot.likes + snapshot.comments + snapshot.shares + snapshot.saves
: 0;

const reach = snapshot?.estimatedReach ?? 0;
const views = snapshot?.views ?? 0;

return {
influencer: deal.influencer.displayName,
handle: deal.influencer.instagramHandle,
followers: deal.influencer.instagramFollowers,
paid: deal.amount,
paidRupees: paiseToRupees(deal.amount),
reach,
views,
likes: snapshot?.likes ?? 0,
comments: snapshot?.comments ?? 0,
shares: snapshot?.shares ?? 0,
saves: snapshot?.saves ?? 0,
totalEngagements,
engagementRate: snapshot?.engagementRate ?? 0,
costPerEngagement: totalEngagements > 0
? paiseToRupees(Math.round(deal.amount / totalEngagements))
: "N/A",
costPerReach: reach > 0
? paiseToRupees(Math.round(deal.amount / reach))
: "N/A",
rating: deal.influencer.averageRating,
isEstimated: snapshot?.isEstimated ?? true,
};
});

// Campaign totals
const totals = {
totalSpend: campaign.deals.reduce((s, d) => s + d.amount, 0),
totalReach: influencerBreakdown.reduce((s, d) => s + d.reach, 0),
totalViews: influencerBreakdown.reduce((s, d) => s + d.views, 0),
totalEngagements: influencerBreakdown.reduce((s, d) => s + d.totalEngagements, 0),
avgEngagementRate: influencerBreakdown.length > 0
? influencerBreakdown.reduce((s, d) => s + d.engagementRate, 0) / influencerBreakdown.length
: 0,
};

// Weighted avg CPE
const blendedCPE = totals.totalEngagements > 0
? paiseToRupees(Math.round(totals.totalSpend / totals.totalEngagements))
: "N/A";

if (fmt === "csv") {
const rows: Record<string, string | number>[] = influencerBreakdown.map((d) => ({
"Influencer": d.influencer,
"Handle": d.handle ?? "",
"Followers": d.followers ?? 0,
"Paid ()": d.paidRupees,
"Reach": d.reach,
"Views": d.views,
"Likes": d.likes,
"Comments": d.comments,
"Shares": d.shares,
"Saves": d.saves,
"Total Engagements": d.totalEngagements,
"Engagement Rate": `${d.engagementRate.toFixed(2)}%`,
"CPE ()": d.costPerEngagement,
"CPR ()": d.costPerReach,
"Rating": d.rating ? (d.rating / 100).toFixed(1) : "N/A",
"Data Source": d.isEstimated ? "Estimated (rule-based)" : "Real API data",
}));

// Add summary rows
rows.push(
{ "Influencer": "", "Handle": "", "Followers": "", "Paid ()": "", "Reach": "", "Views": "", "Likes": "", "Comments": "", "Shares": "", "Saves": "", "Total Engagements": "", "Engagement Rate": "", "CPE ()": "", "CPR ()": "", "Rating": "" },
{ "Influencer": "TOTAL", "Handle": `${influencerBreakdown.length} influencers`, "Followers": "", "Paid ()": paiseToRupees(totals.totalSpend), "Reach": totals.totalReach, "Views": totals.totalViews, "Likes": influencerBreakdown.reduce((s, d) => s + d.likes, 0), "Comments": influencerBreakdown.reduce((s, d) => s + d.comments, 0), "Shares": influencerBreakdown.reduce((s, d) => s + d.shares, 0), "Saves": influencerBreakdown.reduce((s, d) => s + d.saves, 0), "Total Engagements": totals.totalEngagements, "Engagement Rate": `${totals.avgEngagementRate.toFixed(2)}%`, "CPE ()": blendedCPE, "CPR ()": totals.totalReach > 0 ? paiseToRupees(Math.round(totals.totalSpend / totals.totalReach)) : "N/A", "Rating": "" }
);

// Add platform header and footer
const platformHeader = getPlatformHeader().map((line) => ({ "Platform Info": line }));
const platformFooter = getPlatformFooter().map((line) => ({ "Platform Info": line }));

const finalRows = [
...platformHeader,
{ "Influencer": "", "Handle": "", "Followers": "", "Paid ()": "", "Reach": "", "Views": "", "Likes": "", "Comments": "", "Shares": "", "Saves": "", "Total Engagements": "", "Engagement Rate": "", "CPE ()": "", "CPR ()": "", "Rating": "" },
...rows,
...platformFooter,
];

const filename = `vyaparmedia-roi-${campaign.title.replace(/\s+/g, "_")}-${Date.now()}.csv`;
return csvResponse(toCsv(finalRows), filename);
}

const hasEstimatedData = influencerBreakdown.some((d) => d.isEstimated);

return ApiResponse.success({
campaign: {
id: campaign.id,
title: campaign.title,
targetCategories: campaign.targetCategories,
},
summary: {
totalSpendRupees: paiseToRupees(totals.totalSpend),
totalReach: totals.totalReach,
totalViews: totals.totalViews,
totalEngagements: totals.totalEngagements,
avgEngagementRate: totals.avgEngagementRate,
blendedCPE,
influencerCount: influencerBreakdown.length,
},
influencers: influencerBreakdown,
dataDisclaimer: hasEstimatedData
? " Some engagement figures are modelled estimates (rule-based), not real-time data from Instagram/YouTube APIs. Rows marked isEstimated=true should be treated as indicative only."
: null,
}, "ROI report generated");
}

export const GET = apiWrapper(_handler, {
requirePermission: "VIEW_OWN_FINANCE",
rateLimit: RATE_LIMIT_CONFIGS.REPORTS,
});
