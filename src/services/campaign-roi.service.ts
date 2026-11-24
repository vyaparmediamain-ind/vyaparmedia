/**
 * Campaign ROI Service
 *
 * Refactored shared service for Campaign ROI analytics and calculation.
 * Sourced by both:
 * 1. `/api/reports/brand/campaign/[id]/roi` (and `/dashboard/campaigns/[id]/roi`)
 * 2. `/dashboard/campaigns/[id]/analytics`
 *
 * SECURITY:
 * - Object-level authorization: Caller must be owner brand or admin.
 * - Unauthorized access returns 404 AppError.notFound so campaign existence cannot be probed.
 */

import prisma from "@/lib/db";
import { AppError } from "@/lib/errors";
import { paiseToRupees } from "@/lib/csv-export";
import { MatchingService } from "@/services/matching.service";
import { buildReportMeta, type ReportMeta } from "@/lib/report-meta";
import { Actor, normalizeActor } from "@/lib/authz";

export interface CreatorRoiBreakdown {
  dealId: string;
  influencerId: string;
  influencer: string;
  handle?: string | null;
  followers: number | null;
  paid: number; // paise
  paidRupees: string;
  reach: number;
  views: number;
  predictedViews: number;
  predictedCpvPaise: number;
  predictedCpvRupees: string;
  predictedRoiScore: number;
  actualRoiScore: number;
  accuracyPercentage: number;
  viewsVariance: number;
  viewsVariancePercent: number;
  deliveryMultiplier: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  totalEngagements: number;
  engagementRate: number; // percentage
  cpvPaise: number;
  costPerView: string;
  costPerEngagement: string;
  costPerReach: string;
  rating?: number | null;
  isEstimated: boolean;
  metricsQuality: unknown;
  snapshotInterval: string;
  drsScore: number;
  isOnTime: boolean;
  approvalCycleHours: number;
}

export interface CampaignRoiSummary {
  totalSpendPaise: number;
  totalSpendRupees: string;
  totalReach: number;
  totalViews: number;
  totalVerifiedViews: number;
  totalEstimatedViews: number;
  totalPredictedViews: number;
  totalEngagements: number;
  avgEngagementRate: number;
  blendedCPE: string;
  effectiveCpvPaise: number;
  effectiveCpvRupees: string;
  effectiveCprRupees: string;
  categoryBaselineCpvPaise: number;
  categoryBaselineCpvRupees: string;
  categoryBenchmarkSource: string;
  efficiencyMultiplier: number | null;
  influencerCount: number;
  overallAlgorithmAccuracy: number;
  overallViewsVariancePercent: number;
  overallDeliveryMultiplier: number;
  predictedAverageCpvPaise: number;
  predictedAverageCpvRupees: string;
  hasEstimatedData: boolean;
  dataQualityStatus: "VERIFIED" | "ESTIMATED";
}

export interface CampaignRoiReportResult {
  campaign: {
    id: string;
    title: string;
    status: string;
    totalBudgetPaise: number;
    totalBudgetRupees: string;
    targetCategories: string[];
    brandName: string;
    brandUserId?: string | null;
  };
  summary: CampaignRoiSummary;
  influencers: CreatorRoiBreakdown[];
  reportMeta: ReportMeta;
  dataDisclaimer: string | null;
}

export class CampaignRoiService {
  /**
   * Computes the complete audited ROI report for a campaign with object-level authorization.
   */
  public static async getCampaignRoiReport(
    campaignId: string,
    caller: Actor | string,
    legacyIsAdmin = false
  ): Promise<CampaignRoiReportResult> {
    const actor = normalizeActor(caller, legacyIsAdmin);

    // 1. Verify campaign exists and caller owns it or is admin
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        brand: { select: { userId: true, companyName: true } },
        deals: {
          where: { status: { in: ["POSTED", "VERIFICATION_PENDING", "VERIFIED", "COMPLETED"] } },
          include: {
            contentSubmissions: {
              orderBy: { submittedAt: "desc" },
            },
            engagementSnapshots: {
              orderBy: { capturedAt: "desc" },
            },
            influencer: {
              select: {
                id: true,
                user: { select: { trustScore: true } },
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

    if (!campaign) {
      throw AppError.notFound("Campaign not found");
    }

    const isOwner = campaign.brand?.userId === actor.id;
    if (!isOwner && !actor.isActiveAdmin) {
      // 404 returned so unauthorized callers cannot detect campaign presence
      throw AppError.notFound("Campaign not found");
    }

    // 2. Category Baseline CPV & Relative Performance
    const categoryBaselineDetails = await MatchingService.getCategoryBaselineDetails(
      campaign.targetCategories
    );
    const categoryBaselineCpvPaise = categoryBaselineDetails.baselinePaise;
    const categoryBaselineCpvRupees = paiseToRupees(categoryBaselineCpvPaise);

    // 3. Per-creator ROI & deliverable breakdown
    const influencerBreakdown: CreatorRoiBreakdown[] = await Promise.all(
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
          views > 0 && cpvPaise > 0
            ? MatchingService.calculateRoiScore(cpvPaise, categoryBaselineCpvPaise)
            : 0;

        // Accuracy metric (0-100%): Never fabricate 100% when views are missing/unreported
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
            : 0;

        const viewsVariance = views > 0 ? views - predictedViews : -predictedViews;
        const viewsVariancePercent =
          views > 0 && predictedViews > 0
            ? Number((((views - predictedViews) / predictedViews) * 100).toFixed(1))
            : predictedViews > 0
            ? -100
            : 0;
        const deliveryMultiplier =
          predictedViews > 0 && views > 0
            ? Number((views / predictedViews).toFixed(2))
            : 0;

        // On-Time Delivery Check
        let isOnTime = true;
        if (deal.postingDeadline && deal.completedAt) {
          isOnTime = deal.completedAt.getTime() <= deal.postingDeadline.getTime();
        } else if (deal.postingDeadline && deal.postedAt) {
          isOnTime = deal.postedAt.getTime() <= deal.postingDeadline.getTime();
        } else if (deal.submissionDeadline && deal.submittedAt) {
          isOnTime = deal.submittedAt.getTime() <= deal.submissionDeadline.getTime();
        }

        // Approval Turnaround (hours)
        let approvalCycleHours = 0;
        const latestSubmission = deal.contentSubmissions[0];
        if (latestSubmission?.reviewedAt && latestSubmission?.submittedAt) {
          const diffMs = Math.max(
            0,
            latestSubmission.reviewedAt.getTime() - latestSubmission.submittedAt.getTime()
          );
          approvalCycleHours = Number((diffMs / (1000 * 60 * 60)).toFixed(1));
        }

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
          predictedViews,
          predictedCpvPaise,
          predictedCpvRupees: paiseToRupees(predictedCpvPaise),
          predictedRoiScore,
          actualRoiScore,
          accuracyPercentage,
          viewsVariance,
          viewsVariancePercent,
          deliveryMultiplier,
          likes: snapshot?.likes ?? 0,
          comments: snapshot?.comments ?? 0,
          shares: snapshot?.shares ?? 0,
          saves: snapshot?.saves ?? 0,
          totalEngagements,
          engagementRate: snapshot?.engagementRate ? snapshot.engagementRate / 100 : 0,
          cpvPaise,
          costPerView: views > 0 ? paiseToRupees(cpvPaise) : "N/A",
          costPerEngagement: totalEngagements > 0 ? paiseToRupees(cpePaise) : "N/A",
          costPerReach: reach > 0 ? paiseToRupees(cprPaise) : "N/A",
          rating: deal.influencer.averageRating,
          isEstimated: snapshot?.isEstimated ?? true,
          metricsQuality: snapshot?.metricsQuality ?? null,
          snapshotInterval: snapshot?.interval ?? "pending",
          drsScore: deal.influencer.user?.trustScore ?? 600,
          isOnTime,
          approvalCycleHours,
        };
      })
    );

    // 4. Aggregate campaign totals
    const totalSpend = campaign.deals.reduce((s, d) => s + d.amount, 0);
    const totalReach = influencerBreakdown.reduce((s, d) => s + d.reach, 0);
    const totalViews = influencerBreakdown.reduce((s, d) => s + d.views, 0);
    const totalVerifiedViews = influencerBreakdown
      .filter((d) => !d.isEstimated)
      .reduce((s, d) => s + d.views, 0);
    const totalEstimatedViews = influencerBreakdown
      .filter((d) => d.isEstimated)
      .reduce((s, d) => s + d.views, 0);
    const totalPredictedViews = influencerBreakdown.reduce((s, d) => s + d.predictedViews, 0);
    const totalEngagements = influencerBreakdown.reduce((s, d) => s + d.totalEngagements, 0);
    const hasEstimatedData = influencerBreakdown.some((d) => d.isEstimated);
    const dataQualityStatus = hasEstimatedData ? "ESTIMATED" : "VERIFIED";

    const avgEngagementRate =
      influencerBreakdown.length > 0
        ? influencerBreakdown.reduce((s, d) => s + d.engagementRate, 0) /
          influencerBreakdown.length
        : 0;

    const blendedCPE =
      totalEngagements > 0
        ? paiseToRupees(Math.round(totalSpend / totalEngagements))
        : "N/A";
    const effectiveCpvPaise = totalViews > 0 ? Math.round(totalSpend / totalViews) : 0;
    const effectiveCpvRupees = totalViews > 0 ? paiseToRupees(effectiveCpvPaise) : "N/A";
    const effectiveCprRupees =
      totalReach > 0 ? paiseToRupees(Math.round(totalSpend / totalReach)) : "N/A";

    const efficiencyMultiplier =
      effectiveCpvPaise > 0
        ? Number((categoryBaselineCpvPaise / effectiveCpvPaise).toFixed(2))
        : null;

    const overallAlgorithmAccuracy =
      influencerBreakdown.length > 0
        ? Math.round(
            influencerBreakdown.reduce((s, d) => s + d.accuracyPercentage, 0) /
              influencerBreakdown.length
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

    const verifiedViewsRatio = totalViews > 0 ? (totalVerifiedViews / totalViews) * 100 : 100;
    const estimatedViewsRatio = totalViews > 0 ? (totalEstimatedViews / totalViews) * 100 : 0;

    const reportMeta = buildReportMeta({
      type: "ROI",
      scope: `Campaign: ${campaign.title}`,
      period: "Campaign Lifecycle",
      user: {
        id: actor.id,
        name: campaign.brand?.companyName || "Brand Partner",
        email: "brand@vyaparmedia.in",
        role: actor.isActiveAdmin ? "ADMIN" : "BRAND",
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

    return {
      campaign: {
        id: campaign.id,
        title: campaign.title,
        status: campaign.status,
        totalBudgetPaise: campaign.totalBudget,
        totalBudgetRupees: paiseToRupees(campaign.totalBudget),
        targetCategories: campaign.targetCategories,
        brandName: campaign.brand?.companyName || "Brand Partner",
        brandUserId: campaign.brand?.userId ?? null,
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
      influencers: influencerBreakdown,
      reportMeta,
      dataDisclaimer: hasEstimatedData
        ? "Some engagement figures are modelled estimates (rule-based), not real-time data from Instagram/YouTube APIs. Rows marked isEstimated=true should be treated as indicative only."
        : null,
    };
  }
}
