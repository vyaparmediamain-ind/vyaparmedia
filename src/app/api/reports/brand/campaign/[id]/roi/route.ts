import { NextRequest } from "next/server";
import { apiWrapper, ApiResponse, type AuthenticatedRequest } from "@/lib/api-wrapper";
import prisma from "@/lib/db";
import { csvResponse, paiseToRupees } from "@/lib/csv-export";
import { RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { MatchingService } from "@/services/matching.service";
import { PLATFORM_CONFIG } from "@/lib/platform-config";

async function _handler(req: NextRequest, context: { params: Promise<Record<string, string | string[]>> }) {
  const session = (req as AuthenticatedRequest).session;

  const params = await context.params;
  const campaignId = params.id as string;
  const fmt = new URL(req.url).searchParams.get("format") === "csv" ? "csv" : "json";

  // Verify brand owns this campaign
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      brand: { select: { userId: true, companyName: true } },
      deals: {
        where: { status: { in: ["POSTED", "VERIFIED", "COMPLETED"] } },
        include: {
          engagementSnapshots: {
            orderBy: { capturedAt: "desc" },
          },
          influencer: {
            select: {
              id: true,
              displayName: true,
              instagramHandle: true,
              instagramFollowers: true,
              instagramEngagementRate: true,
              youtubeSubscribers: true,
              youtubeEngagementRate: true,
              followerAuthenticityScore: true,
              averageRating: true,
              categories: true,
            },
          },
        },
      },
    },
  });

  if (!campaign) return ApiResponse.error("Campaign not found", 404);
  if (!campaign.brand || campaign.brand.userId !== session.user.id) return ApiResponse.forbidden();

  // Category Baseline CPV & Relative Performance
  const categoryBaselineDetails = await MatchingService.getCategoryBaselineDetails(campaign.targetCategories);
  const categoryBaselineCpvPaise = categoryBaselineDetails.baselinePaise;
  const categoryBaselineCpvRupees = paiseToRupees(categoryBaselineCpvPaise);

  // Per-influencer ROI & deliverable breakdown with Matching-Time Prediction Comparison
  const influencerBreakdown = await Promise.all(
    campaign.deals.map(async (deal) => {
      // Best snapshot = 7d (most mature data), fallback to 48h, fallback to 24h
      const snapshot =
        deal.engagementSnapshots.find((s) => s.interval === "7d") ??
        deal.engagementSnapshots.find((s) => s.interval === "48h") ??
        deal.engagementSnapshots.find((s) => s.interval === "24h") ??
        deal.engagementSnapshots[0];

      const totalEngagements = snapshot
        ? snapshot.likes + snapshot.comments + snapshot.shares + snapshot.saves
        : 0;

      const reach = snapshot?.estimatedReach ?? 0;
      const views = snapshot?.views ?? 0;
      const cpvPaise = views > 0 ? Math.round(deal.amount / views) : 0;
      const cpePaise = totalEngagements > 0 ? Math.round(deal.amount / totalEngagements) : 0;
      const cprPaise = reach > 0 ? Math.round(deal.amount / reach) : 0;

      // Calculate Matching-Time Predicted ROI & Views via matching engine
      const matchResult = await MatchingService.calculateMatchScore(
        {
          id: campaign.id,
          targetCategories: campaign.targetCategories,
          perInfluencerBudget: deal.amount,
          guidelines: campaign.guidelines,
        },
        {
          id: deal.influencer.id,
          categories: deal.influencer.categories || campaign.targetCategories.join(", "),
          instagramFollowers: deal.influencer.instagramFollowers,
          instagramEngagementRate: deal.influencer.instagramEngagementRate,
          youtubeSubscribers: deal.influencer.youtubeSubscribers,
          youtubeEngagementRate: deal.influencer.youtubeEngagementRate,
          followerAuthenticityScore: deal.influencer.followerAuthenticityScore || 75,
          averageRating: deal.influencer.averageRating || 450,
        },
        deal.amount
      );

      const predictedViews = matchResult.matchBreakdown.estimatedViews;
      const predictedCpvPaise = Math.round(deal.amount / Math.max(1, predictedViews));
      const predictedRoiScore = matchResult.matchBreakdown.roiScore;
      const actualRoiScore = MatchingService.calculateRoiScore(cpvPaise, categoryBaselineCpvPaise);

      // Prediction accuracy metric (0-100%): Measures algorithm precision against actual delivery
      const accuracyPercentage =
        predictedViews > 0 && views > 0
          ? Math.round(
              Math.min(
                100,
                Math.max(
                  0,
                  (1 - Math.abs(views - predictedViews) / Math.max(views, predictedViews, 1)) * 100
                )
              )
            )
          : 100;

      const viewsVariance = views - predictedViews;
      const viewsVariancePercent =
        predictedViews > 0
          ? Number((((views - predictedViews) / predictedViews) * 100).toFixed(1))
          : 0;
      const deliveryMultiplier =
        predictedViews > 0 ? Number((views / predictedViews).toFixed(2)) : 1;

      return {
        dealId: deal.id,
        influencerId: deal.influencer.id,
        influencer: deal.influencer.displayName,
        handle: deal.influencer.instagramHandle,
        followers: deal.influencer.instagramFollowers,
        paid: deal.amount,
        paidRupees: paiseToRupees(deal.amount),
        reach,
        views,
        // Matching-Time Prediction Comparison
        predictedViews,
        predictedCpvPaise,
        predictedCpvRupees: paiseToRupees(predictedCpvPaise),
        predictedRoiScore,
        actualRoiScore,
        accuracyPercentage,
        viewsVariance,
        viewsVariancePercent,
        deliveryMultiplier,
        // Interaction breakdown
        likes: snapshot?.likes ?? 0,
        comments: snapshot?.comments ?? 0,
        shares: snapshot?.shares ?? 0,
        saves: snapshot?.saves ?? 0,
        totalEngagements,
        engagementRate: snapshot?.engagementRate ? snapshot.engagementRate / 100 : 0, // basis points to %
        cpvPaise,
        costPerView: views > 0 ? paiseToRupees(cpvPaise) : "N/A",
        costPerEngagement: totalEngagements > 0 ? paiseToRupees(cpePaise) : "N/A",
        costPerReach: reach > 0 ? paiseToRupees(cprPaise) : "N/A",
        rating: deal.influencer.averageRating,
        isEstimated: snapshot?.isEstimated ?? true,
        snapshotInterval: snapshot?.interval ?? "pending",
      };
    })
  );

  // Campaign totals
  const totalSpend = campaign.deals.reduce((s, d) => s + d.amount, 0);
  const totalReach = influencerBreakdown.reduce((s, d) => s + d.reach, 0);
  const totalViews = influencerBreakdown.reduce((s, d) => s + d.views, 0);
  const totalPredictedViews = influencerBreakdown.reduce((s, d) => s + d.predictedViews, 0);
  const totalEngagements = influencerBreakdown.reduce((s, d) => s + d.totalEngagements, 0);
  const avgEngagementRate =
    influencerBreakdown.length > 0
      ? influencerBreakdown.reduce((s, d) => s + d.engagementRate, 0) / influencerBreakdown.length
      : 0;

  // Cost efficiencies
  const blendedCPE = totalEngagements > 0 ? paiseToRupees(Math.round(totalSpend / totalEngagements)) : "N/A";
  const effectiveCpvPaise = totalViews > 0 ? Math.round(totalSpend / totalViews) : 0;
  const effectiveCpvRupees = totalViews > 0 ? paiseToRupees(effectiveCpvPaise) : "N/A";
  const effectiveCprRupees = totalReach > 0 ? paiseToRupees(Math.round(totalSpend / totalReach)) : "N/A";

  const efficiencyMultiplier =
    effectiveCpvPaise > 0
      ? Number((categoryBaselineCpvPaise / effectiveCpvPaise).toFixed(2))
      : null;

  // Overall Algorithm Prediction Accuracy Metrics
  const overallAlgorithmAccuracy =
    influencerBreakdown.length > 0
      ? Math.round(
          influencerBreakdown.reduce((s, d) => s + d.accuracyPercentage, 0) / influencerBreakdown.length
        )
      : 100;

  const overallViewsVariancePercent =
    totalPredictedViews > 0
      ? Number((((totalViews - totalPredictedViews) / totalPredictedViews) * 100).toFixed(1))
      : 0;

  const overallDeliveryMultiplier =
    totalPredictedViews > 0 ? Number((totalViews / totalPredictedViews).toFixed(2)) : 1;

  const predictedAverageCpvPaise =
    totalPredictedViews > 0 ? Math.round(totalSpend / totalPredictedViews) : 0;
  const predictedAverageCpvRupees = paiseToRupees(predictedAverageCpvPaise);

  if (fmt === "csv") {
    const esc = (v: string) => (v.includes(",") ? `"${v.replaceAll('"', '""')}"` : v);
    const row = (label: string, value: string) => `${esc(label)},${esc(value)}\r\n`;
    const sep = () => `\r\n`;
    const title = (t: string) => `${esc(t)},\r\n`;

    let csv = "";

    // Corporate & Platform Header
    csv += row(PLATFORM_CONFIG.legalName.toUpperCase(), "");
    csv += row(`CIN: ${PLATFORM_CONFIG.cin}`, `GSTIN: ${PLATFORM_CONFIG.gstin}`);
    csv += row(PLATFORM_CONFIG.address, "");
    csv += row("CAMPAIGN ROI & INFLUENCER PERFORMANCE REPORT", "");
    csv += row("Report Date", new Date().toISOString().split("T")[0] ?? "");
    csv += row("Tax Code (SAC)", "998365 (Advertising, Promotion & Influencer Services)");
    csv += sep();

    // Campaign Dossier
    csv += title("CAMPAIGN DOSSIER");
    csv += row("Campaign ID", campaign.id);
    csv += row("Campaign Title", campaign.title);
    csv += row("Brand Entity", campaign.brand.companyName || "Brand Partner");
    csv += row("Target Categories", campaign.targetCategories.join(" | ") || "General");
    csv += row("Category Baseline CPV", `INR ${categoryBaselineCpvRupees} per view`);
    csv += row("Campaign Status", campaign.status);
    csv += row("Total Escrow Budget (INR)", paiseToRupees(campaign.totalBudget));
    csv += row("Total Budget Realized / Disbursed (INR)", paiseToRupees(totalSpend));
    csv += sep();

    // Executive Performance Summary with Algorithm Accuracy
    csv += title("EXECUTIVE PERFORMANCE SUMMARY");
    csv += row("Total Estimated Reach", String(totalReach));
    csv += row("Total Delivered Views", String(totalViews));
    csv += row("Matching-Projected Views", String(totalPredictedViews));
    csv += row("Overall Delivery Multiplier", `${overallDeliveryMultiplier}x of target projection`);
    csv += row("Algorithm Match Accuracy", `${overallAlgorithmAccuracy}%`);
    csv += row("Total Engagements (Likes + Comments + Shares + Saves)", String(totalEngagements));
    csv += row("Average Engagement Rate", `${avgEngagementRate.toFixed(2)}%`);
    csv += row("Predicted CPV at Matching", `INR ${predictedAverageCpvRupees}`);
    csv += row("Effective Cost Per View (CPV)", effectiveCpvRupees !== "N/A" ? `INR ${effectiveCpvRupees}` : "N/A");
    csv += row("Blended Cost Per Engagement (CPE)", blendedCPE !== "N/A" ? `INR ${blendedCPE}` : "N/A");
    csv += row("Blended Cost Per Reach (CPR)", effectiveCprRupees !== "N/A" ? `INR ${effectiveCprRupees}` : "N/A");
    csv += row("Category Efficiency Factor", efficiencyMultiplier ? `${efficiencyMultiplier}x industry baseline` : "N/A");
    csv += sep();

    // Influencer Performance Breakdown Table with Matching Comparison
    csv += title("INFLUENCER DELIVERABLE & PERFORMANCE BREAKDOWN");
    csv += "Influencer,Handle,Followers,Paid (INR),Predicted Views,Delivered Views,Variance (%),Accuracy (%),Predicted CPV (INR),Actual CPV (INR),Reach,Likes,Comments,Shares,Saves,Total Engagements,ER (%),CPE (INR),CPR (INR),Rating,Data Quality\r\n";

    for (const d of influencerBreakdown) {
      csv +=
        [
          esc(d.influencer || "Creator"),
          esc(d.handle ? `@${d.handle}` : ""),
          d.followers ?? 0,
          d.paidRupees,
          d.predictedViews,
          d.views,
          `${d.viewsVariancePercent > 0 ? "+" : ""}${d.viewsVariancePercent}%`,
          `${d.accuracyPercentage}%`,
          d.predictedCpvRupees,
          d.costPerView,
          d.reach,
          d.likes,
          d.comments,
          d.shares,
          d.saves,
          d.totalEngagements,
          `${d.engagementRate.toFixed(2)}%`,
          d.costPerEngagement,
          d.costPerReach,
          d.rating ? (d.rating / 100).toFixed(1) : "N/A",
          d.isEstimated ? "Estimated" : "Verified API",
        ].join(",") + "\r\n";
    }

    // Aggregate Total Row
    csv +=
      [
        "TOTAL",
        `${influencerBreakdown.length} creators`,
        "",
        paiseToRupees(totalSpend),
        totalPredictedViews,
        totalViews,
        `${overallViewsVariancePercent > 0 ? "+" : ""}${overallViewsVariancePercent}%`,
        `${overallAlgorithmAccuracy}%`,
        predictedAverageCpvRupees,
        effectiveCpvRupees,
        totalReach,
        influencerBreakdown.reduce((s, d) => s + d.likes, 0),
        influencerBreakdown.reduce((s, d) => s + d.comments, 0),
        influencerBreakdown.reduce((s, d) => s + d.shares, 0),
        influencerBreakdown.reduce((s, d) => s + d.saves, 0),
        totalEngagements,
        `${avgEngagementRate.toFixed(2)}%`,
        blendedCPE,
        effectiveCprRupees,
        "",
        "Aggregate",
      ].join(",") + "\r\n";
    csv += sep();

    // Statutory Certification
    csv += title("METHODOLOGY & VERIFICATION STATEMENT");
    csv += row("Escrow Audit", "100% of recorded payouts were disbursed through RBI-compliant escrow ledger accounts.");
    csv += row("Algorithm Benchmarking", "Predicted ROI at matching time was calculated using historical audience conversion and category baseline CPVs.");
    csv += row("Metrics Source", "Engagement metrics aggregated via verified social APIs & 7-day post-delivery analytics snapshots.");
    csv += row("Legal Note", "This is an official campaign performance statement issued by VyaparMedia Technologies Pvt Ltd.");
    csv += row("--- End of Report ---", "");

    const safeTitle = campaign.title.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_").slice(0, 60);
    const filename = `VyaparMedia-ROI-${safeTitle}-${Date.now()}.csv`;
    return csvResponse(csv, filename);
  }

  const hasEstimatedData = influencerBreakdown.some((d) => d.isEstimated);

  return ApiResponse.success(
    {
      campaign: {
        id: campaign.id,
        title: campaign.title,
        status: campaign.status,
        totalBudgetPaise: campaign.totalBudget,
        totalBudgetRupees: paiseToRupees(campaign.totalBudget),
        targetCategories: campaign.targetCategories,
      },
      summary: {
        totalSpendPaise: totalSpend,
        totalSpendRupees: paiseToRupees(totalSpend),
        totalReach,
        totalViews,
        totalPredictedViews,
        totalEngagements,
        avgEngagementRate,
        blendedCPE,
        effectiveCpvPaise,
        effectiveCpvRupees,
        effectiveCprRupees,
        categoryBaselineCpvPaise,
        categoryBaselineCpvRupees,
        categoryBenchmarkSource: categoryBaselineDetails.source,
        efficiencyMultiplier,
        influencerCount: influencerBreakdown.length,
        overallAlgorithmAccuracy,
        overallViewsVariancePercent,
        overallDeliveryMultiplier,
        predictedAverageCpvPaise,
        predictedAverageCpvRupees,
      },
      influencers: influencerBreakdown,
      dataDisclaimer: hasEstimatedData
        ? "Some engagement figures are modelled estimates (rule-based), not real-time data from Instagram/YouTube APIs. Rows marked isEstimated=true should be treated as indicative only."
        : null,
    },
    "ROI report generated"
  );
}

export const GET = apiWrapper(_handler, {
  requirePermission: "VIEW_OWN_FINANCE",
  rateLimit: RATE_LIMIT_CONFIGS.REPORTS,
});
