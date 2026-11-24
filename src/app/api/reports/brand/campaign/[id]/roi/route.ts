import { NextRequest } from "next/server";
import { apiWrapper, ApiResponse, type AuthenticatedRequest } from "@/lib/api-wrapper";
import prisma from "@/lib/db";
import {
  csvResponse,
  paiseToRupees,
  buildBrandedCsv,
  buildReportFilename,
} from "@/lib/csv-export";
import { RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { MatchingService } from "@/services/matching.service";
import { buildReportMeta } from "@/lib/report-meta";
import { ReportVerificationService } from "@/services/report-verification.service";

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

  if (!campaign || !campaign.brand || campaign.brand.userId !== session.user.id) {
    return ApiResponse.error("Campaign not found", 404);
  }

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
          followerAuthenticityScore: deal.influencer.followerAuthenticityScore ?? null,
          averageRating: deal.influencer.averageRating ?? null,
        },
        deal.amount
      );

      const predictedViews = matchResult.matchBreakdown.estimatedViews;
      const predictedCpvPaise = Math.round(deal.amount / Math.max(1, predictedViews));
      const predictedRoiScore = matchResult.matchBreakdown.roiScore;
      const actualRoiScore =
        views > 0
          ? MatchingService.calculateRoiScore(cpvPaise, categoryBaselineCpvPaise)
          : 0;

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
          : views === 0 && predictedViews === 0
          ? 100
          : 0;

      const viewsVariance = views - predictedViews;
      const viewsVariancePercent =
        views > 0 && predictedViews > 0
          ? Number((((views - predictedViews) / predictedViews) * 100).toFixed(1))
          : predictedViews > 0
          ? -100
          : 0;
      const deliveryMultiplier =
        predictedViews > 0 && views > 0 ? Number((views / predictedViews).toFixed(2)) : 0;

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
        metricsQuality: snapshot?.metricsQuality ?? null,
        snapshotInterval: snapshot?.interval ?? "pending",
      };
    })
  );

  // Campaign totals
  const totalSpend = campaign.deals.reduce((s, d) => s + d.amount, 0);
  const totalReach = influencerBreakdown.reduce((s, d) => s + d.reach, 0);
  const totalViews = influencerBreakdown.reduce((s, d) => s + d.views, 0);
  const totalVerifiedViews = influencerBreakdown.filter((d) => !d.isEstimated).reduce((s, d) => s + d.views, 0);
  const totalEstimatedViews = influencerBreakdown.filter((d) => d.isEstimated).reduce((s, d) => s + d.views, 0);
  const totalPredictedViews = influencerBreakdown.reduce((s, d) => s + d.predictedViews, 0);
  const totalEngagements = influencerBreakdown.reduce((s, d) => s + d.totalEngagements, 0);
  const hasEstimatedData = influencerBreakdown.some((d) => d.isEstimated);
  const dataQualityStatus = hasEstimatedData ? "ESTIMATED" : "VERIFIED";
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
      : 0;

  const overallViewsVariancePercent =
    totalPredictedViews > 0
      ? Number((((totalViews - totalPredictedViews) / totalPredictedViews) * 100).toFixed(1))
      : 0;

  const overallDeliveryMultiplier =
    totalPredictedViews > 0 ? Number((totalViews / totalPredictedViews).toFixed(2)) : 1;

  const predictedAverageCpvPaise =
    totalPredictedViews > 0 ? Math.round(totalSpend / totalPredictedViews) : 0;
  const predictedAverageCpvRupees = paiseToRupees(predictedAverageCpvPaise);

  const verifiedViewsRatio = totalViews > 0 ? (totalVerifiedViews / totalViews) * 100 : 100;
  const estimatedViewsRatio = totalViews > 0 ? (totalEstimatedViews / totalViews) * 100 : 0;

  const reportMeta = buildReportMeta({
    type: "ROI",
    scope: `Campaign: ${campaign.title}`,
    period: "Campaign Lifecycle",
    user: {
      id: session.user.id,
      name: campaign.brand.companyName || session.user.name,
      email: session.user.email,
      role: "BRAND",
    },
    dataQualitySummary: {
      verifiedPercent: verifiedViewsRatio,
      estimatedPercent: estimatedViewsRatio,
      selfReportedPercent: 0,
    },
    payload: {
      campaignId: campaign.id,
      totalSpend,
      totalViews,
      totalEngagements,
      influencers: influencerBreakdown.map((d) => ({
        handle: d.handle,
        views: d.views,
        paid: d.paidRupees,
      })),
    },
  });

  // Audit export action
  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: "REPORT_EXPORT",
      entityType: "Campaign",
      entityId: campaign.id,
      metadata: {
        type: "ROI",
        format: fmt,
        reportId: reportMeta.reportId,
      },
    },
  }).catch(() => { });

  // Cryptographic report verification registration
  await ReportVerificationService.recordReport({
    id: reportMeta.reportId,
    type: "ROI",
    userId: session.user.id,
    scopeId: campaign.id,
    payloadHash: reportMeta.integrityCode,
  });

  if (fmt === "csv") {
    const columns = [
      { key: "influencer", label: "Influencer", format: (v: unknown) => String(v || "Creator") },
      { key: "handle", label: "Handle", format: (v: unknown) => (v ? `@${v}` : "") },
      { key: "followers", label: "Followers", format: (v: unknown) => String(v ?? 0) },
      { key: "paidRupees", label: "Paid (INR)" },
      { key: "predictedViews", label: "Predicted Views", format: (v: unknown) => String(v ?? 0) },
      { key: "views", label: "Delivered Views", format: (v: unknown) => String(v ?? 0) },
      {
        key: "viewsVariancePercent",
        label: "Variance (%)",
        format: (v: unknown) => `${Number(v) > 0 ? "+" : ""}${v}%`,
      },
      { key: "accuracyPercentage", label: "Accuracy (%)", format: (v: unknown) => `${v}%` },
      { key: "predictedCpvRupees", label: "Predicted CPV (INR)" },
      { key: "costPerView", label: "Actual CPV (INR)" },
      { key: "reach", label: "Reach", format: (v: unknown) => String(v ?? 0) },
      { key: "likes", label: "Likes", format: (v: unknown) => String(v ?? 0) },
      { key: "comments", label: "Comments", format: (v: unknown) => String(v ?? 0) },
      { key: "shares", label: "Shares", format: (v: unknown) => String(v ?? 0) },
      { key: "saves", label: "Saves", format: (v: unknown) => String(v ?? 0) },
      { key: "totalEngagements", label: "Total Engagements", format: (v: unknown) => String(v ?? 0) },
      {
        key: "engagementRate",
        label: "ER (%)",
        format: (v: unknown) => `${Number(v).toFixed(2)}%`,
      },
      { key: "costPerEngagement", label: "CPE (INR)" },
      { key: "costPerReach", label: "CPR (INR)" },
      {
        key: "rating",
        label: "Rating",
        format: (v: unknown) => (v ? (Number(v) / 100).toFixed(1) : "N/A"),
      },
      {
        key: "isEstimated",
        label: "Data Quality",
        format: (v: unknown) => (v ? "Estimated" : "Verified API"),
      },
      {
        key: "ratesQuality",
        label: "Rates Quality",
        format: (_v: unknown, row: Record<string, unknown>) => (row?.isEstimated ? "DERIVED" : "API"),
      },
    ];

    const summaryRows = [
      {
        influencer: "TOTAL",
        handle: `${influencerBreakdown.length} creators`,
        followers: "",
        paidRupees: paiseToRupees(totalSpend),
        predictedViews: String(totalPredictedViews),
        views: String(totalViews),
        viewsVariancePercent: `${overallViewsVariancePercent > 0 ? "+" : ""}${overallViewsVariancePercent}%`,
        accuracyPercentage: `${overallAlgorithmAccuracy}%`,
        predictedCpvRupees: predictedAverageCpvRupees,
        costPerView: effectiveCpvRupees,
        reach: String(totalReach),
        likes: String(influencerBreakdown.reduce((s, d) => s + d.likes, 0)),
        comments: String(influencerBreakdown.reduce((s, d) => s + d.comments, 0)),
        shares: String(influencerBreakdown.reduce((s, d) => s + d.shares, 0)),
        saves: String(influencerBreakdown.reduce((s, d) => s + d.saves, 0)),
        totalEngagements: String(totalEngagements),
        engagementRate: `${avgEngagementRate.toFixed(2)}%`,
        costPerEngagement: blendedCPE,
        costPerReach: effectiveCprRupees,
        rating: "",
        isEstimated: hasEstimatedData ? "Estimated (Mixed)" : "Verified API",
      },
    ];

    const customSections = [
      {
        title: "CAMPAIGN DOSSIER",
        rows: [
          ["Campaign ID", campaign.id],
          ["Campaign Title", campaign.title],
          ["Brand Entity", campaign.brand.companyName || "Brand Partner"],
          ["Target Categories", campaign.targetCategories.join(" | ") || "General"],
          ["Category Baseline CPV", `INR ${categoryBaselineCpvRupees} per view`],
          ["Campaign Status", campaign.status],
          ["Total Escrow Budget (INR)", paiseToRupees(campaign.totalBudget)],
          ["Total Budget Realized / Disbursed (INR)", paiseToRupees(totalSpend)],
        ] as Array<[string, string | number]>,
      },
      {
        title: "EXECUTIVE PERFORMANCE SUMMARY",
        rows: [
          ["Total Estimated Reach", String(totalReach)],
          ["Total Delivered Views (Blended)", String(totalViews)],
          ["Verified Delivered Views (API-Sourced)", String(totalVerifiedViews)],
          ["Estimated Delivered Views (Modelled)", String(totalEstimatedViews)],
          ["Overall Data Quality Status", hasEstimatedData ? "ESTIMATED (Contains Modelled Metrics)" : "VERIFIED (100% Verified API)"],
          ["Matching-Projected Views", String(totalPredictedViews)],
          ["Overall Delivery Multiplier", `${overallDeliveryMultiplier}x of target projection`],
          ["Algorithm Match Accuracy", `${overallAlgorithmAccuracy}%`],
          ["Total Engagements (Likes + Comments + Shares + Saves)", String(totalEngagements)],
          ["Average Engagement Rate", `${avgEngagementRate.toFixed(2)}%`],
          ["Predicted CPV at Matching", `INR ${predictedAverageCpvRupees}`],
          ["Effective Cost Per View (CPV)", effectiveCpvRupees !== "N/A" ? `INR ${effectiveCpvRupees}` : "N/A"],
          ["Blended Cost Per Engagement (CPE)", blendedCPE !== "N/A" ? `INR ${blendedCPE}` : "N/A"],
          ["Blended Cost Per Reach (CPR)", effectiveCprRupees !== "N/A" ? `INR ${effectiveCprRupees}` : "N/A"],
          ["Category Efficiency Factor", efficiencyMultiplier ? `${efficiencyMultiplier}x industry baseline` : "N/A"],
        ] as Array<[string, string | number]>,
      },
      {
        title: "METHODOLOGY & STATUTORY CERTIFICATION",
        rows: [
          ["Escrow Audit", "100% of recorded payouts were disbursed through RBI-compliant escrow ledger accounts."],
          ["Algorithm Benchmarking", "Predicted ROI at matching time was calculated using historical audience conversion and category baseline CPVs."],
          ["Metrics Source", "Engagement metrics aggregated via verified social APIs & 7-day post-delivery analytics snapshots."],
          ["Legal Note", "This is an official campaign performance statement issued by VyaparMedia Technologies Pvt Ltd."],
        ] as Array<[string, string | number]>,
      },
    ];

    const csv = buildBrandedCsv({
      meta: reportMeta,
      columns,
      rows: influencerBreakdown as unknown as Record<string, unknown>[],
      summaryRows,
      customSections,
    });

    const filename = buildReportFilename("ROI", campaign.title);
    return csvResponse(csv, filename);
  }

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
        totalVerifiedViews,
        totalEstimatedViews,
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
        hasEstimatedData,
        dataQualityStatus,
      },
      reportMeta,
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
  userRateLimit: { bucket: "REPORTS" },
});
