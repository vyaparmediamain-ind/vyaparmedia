/**
 * Brand Analytics Domain Logic (Pure Functions)
 *
 * PURE DOMAIN LOGIC:
 * - No Prisma, no fetch, no Date.now() inside; inject clock.
 * - Integer paise for all money; basis points for all rates.
 * - Handles spend vs views, CPV vs baseline, creator ROI rankings, repeat partnerships,
 *   and operational campaign alerts.
 */

export interface BrandCampaignMetricInput {
  id: string;
  title: string;
  status: string;
  category: string;
  budgetPaise: number;
  spendPaise: number;
  deliveredViews: number;
  verifiedViews: number;
  estimatedViews: number;
  baselineCpvPaise: number;
  applicationDeadline?: Date | null | undefined;
  endDate?: Date | null | undefined;
  activeDealsCount?: number | undefined;
}

export interface BrandDealCreatorInput {
  dealId: string;
  campaignId: string;
  campaignTitle: string;
  creatorId: string;
  creatorName: string;
  creatorHandle?: string | null | undefined;
  avatar?: string | null | undefined;
  amountPaise: number;
  deliveredViews: number;
  isVerifiedViews: boolean;
  engagementRateBps?: number | null | undefined;
  completedAt?: Date | null | undefined;
}

export interface CampaignCpvComparison {
  campaignId: string;
  title: string;
  category: string;
  spendPaise: number;
  deliveredViews: number;
  actualCpvPaise: number;
  baselineCpvPaise: number;
  varianceBps: number; // Positive = expensive (premium), Negative = savings
  variancePercent: number;
  status: "SAVINGS" | "PREMIUM" | "ON_PAR";
  dataQuality: "VERIFIED" | "ESTIMATED";
}

export interface BestCreatorItem {
  creatorId: string;
  name: string;
  handle: string;
  avatar: string | null;
  dealsCount: number;
  totalSpendPaise: number;
  deliveredViews: number;
  effectiveCpvPaise: number;
  roiScore: number; // 0-100 composite score
  rank: number;
  dataQuality: "VERIFIED" | "ESTIMATED";
}

export interface RepeatCreatorsSummary {
  totalUniqueCreators: number;
  repeatCreatorsCount: number;
  repeatRateBps: number; // basis points (5000 = 50%)
  repeatRatePercent: number;
  repeatCreators: Array<{
    creatorId: string;
    name: string;
    handle: string;
    dealsCount: number;
    totalSpendPaise: number;
  }>;
}

export interface BrandOperationalAlert {
  id: string;
  type: "DELIVERABLE_DUE" | "APPROVAL_PENDING" | "HIGH_CPV_VARIANCE" | "BUDGET_EXHAUSTION";
  severity: "HIGH" | "MEDIUM" | "INFO";
  title: string;
  message: string;
  campaignId?: string | undefined;
  ctaLabel?: string | undefined;
  ctaLink?: string | undefined;
}

/**
 * Calculates Cost Per View (in paise) and compares against category baseline.
 */
export function calculateCampaignCpv(
  campaign: BrandCampaignMetricInput
): CampaignCpvComparison {
  const { spendPaise, deliveredViews, baselineCpvPaise } = campaign;

  const actualCpvPaise =
    deliveredViews > 0 ? Math.round(spendPaise / deliveredViews) : baselineCpvPaise;

  const diff = actualCpvPaise - baselineCpvPaise;
  const varianceBps =
    baselineCpvPaise > 0 ? Math.round((diff / baselineCpvPaise) * 10000) : 0;
  const variancePercent = Math.round(varianceBps / 100);

  let status: "SAVINGS" | "PREMIUM" | "ON_PAR" = "ON_PAR";
  if (variancePercent < -5) {
    status = "SAVINGS";
  } else if (variancePercent > 5) {
    status = "PREMIUM";
  }

  const dataQuality = campaign.verifiedViews >= campaign.estimatedViews ? "VERIFIED" : "ESTIMATED";

  return {
    campaignId: campaign.id,
    title: campaign.title,
    category: campaign.category,
    spendPaise,
    deliveredViews,
    actualCpvPaise,
    baselineCpvPaise,
    varianceBps,
    variancePercent,
    status,
    dataQuality,
  };
}

/**
 * Ranks creators by composite ROI score across completed collaborations.
 */
export function rankBestCreatorsByRoi(
  deals: BrandDealCreatorInput[],
  defaultBaselineCpvPaise = 50 // 50 paise default baseline
): BestCreatorItem[] {
  if (!deals || deals.length === 0) return [];

  const creatorMap = new Map<
    string,
    {
      creatorId: string;
      name: string;
      handle: string;
      avatar: string | null;
      dealsCount: number;
      totalSpendPaise: number;
      deliveredViews: number;
      verifiedViewsCount: number;
      totalEngagementBps: number;
    }
  >();

  for (const d of deals) {
    if (!creatorMap.has(d.creatorId)) {
      creatorMap.set(d.creatorId, {
        creatorId: d.creatorId,
        name: d.creatorName,
        handle: d.creatorHandle || `@creator_${d.creatorId.slice(-4)}`,
        avatar: d.avatar || null,
        dealsCount: 0,
        totalSpendPaise: 0,
        deliveredViews: 0,
        verifiedViewsCount: 0,
        totalEngagementBps: 0,
      });
    }

    const item = creatorMap.get(d.creatorId)!;
    item.dealsCount += 1;
    item.totalSpendPaise += d.amountPaise;
    item.deliveredViews += d.deliveredViews;
    if (d.isVerifiedViews) item.verifiedViewsCount += 1;
    if (d.engagementRateBps != null) {
      item.totalEngagementBps += d.engagementRateBps;
    }
  }

  const creators = Array.from(creatorMap.values()).map((c) => {
    const effectiveCpvPaise =
      c.deliveredViews > 0 ? Math.round(c.totalSpendPaise / c.deliveredViews) : defaultBaselineCpvPaise;

    // ROI score formulation (0-100 scale):
    // 1. Efficiency factor: Baseline / Effective CPV clamped to max 50 pts
    const efficiencyRatio = defaultBaselineCpvPaise / Math.max(effectiveCpvPaise, 1);
    const efficiencyPts = Math.min(50, Math.round(efficiencyRatio * 35));

    // 2. Engagement factor: up to 30 pts
    const avgEngagementBps = c.dealsCount > 0 ? c.totalEngagementBps / c.dealsCount : 0;
    const engagementPts = Math.min(30, Math.round((avgEngagementBps / 600) * 30));

    // 3. Repeat reliability: 20 pts for multiple successful deliveries
    const reliabilityPts = Math.min(20, c.dealsCount * 10);

    const roiScore = Math.max(10, Math.min(100, efficiencyPts + engagementPts + reliabilityPts));
    const dataQuality: "VERIFIED" | "ESTIMATED" =
      c.verifiedViewsCount >= Math.ceil(c.dealsCount / 2) ? "VERIFIED" : "ESTIMATED";

    return {
      creatorId: c.creatorId,
      name: c.name,
      handle: c.handle,
      avatar: c.avatar,
      dealsCount: c.dealsCount,
      totalSpendPaise: c.totalSpendPaise,
      deliveredViews: c.deliveredViews,
      effectiveCpvPaise,
      roiScore,
      dataQuality,
    };
  });

  // Sort descending by ROI score
  creators.sort((a, b) => b.roiScore - a.roiScore);

  return creators.map((c, index) => ({
    ...c,
    rank: index + 1,
  }));
}

/**
 * Computes repeat creator partnership frequency and loyalty statistics.
 */
export function calculateRepeatCreators(
  deals: BrandDealCreatorInput[]
): RepeatCreatorsSummary {
  const creatorDealCounts = new Map<
    string,
    { name: string; handle: string; count: number; spendPaise: number }
  >();

  for (const d of deals) {
    const existing = creatorDealCounts.get(d.creatorId);
    if (existing) {
      existing.count += 1;
      existing.spendPaise += d.amountPaise;
    } else {
      creatorDealCounts.set(d.creatorId, {
        name: d.creatorName,
        handle: d.creatorHandle || `@creator_${d.creatorId.slice(-4)}`,
        count: 1,
        spendPaise: d.amountPaise,
      });
    }
  }

  const totalUniqueCreators = creatorDealCounts.size;
  const repeatCreatorsList: Array<{
    creatorId: string;
    name: string;
    handle: string;
    dealsCount: number;
    totalSpendPaise: number;
  }> = [];

  for (const [creatorId, item] of creatorDealCounts.entries()) {
    if (item.count >= 2) {
      repeatCreatorsList.push({
        creatorId,
        name: item.name,
        handle: item.handle,
        dealsCount: item.count,
        totalSpendPaise: item.spendPaise,
      });
    }
  }

  repeatCreatorsList.sort((a, b) => b.dealsCount - a.dealsCount);

  const repeatCreatorsCount = repeatCreatorsList.length;
  const repeatRateBps =
    totalUniqueCreators > 0
      ? Math.round((repeatCreatorsCount / totalUniqueCreators) * 10000)
      : 0;
  const repeatRatePercent = Math.round(repeatRateBps / 100);

  return {
    totalUniqueCreators,
    repeatCreatorsCount,
    repeatRateBps,
    repeatRatePercent,
    repeatCreators: repeatCreatorsList,
  };
}

/**
 * Evaluates active campaigns and operations to generate high-priority operational alerts.
 */
export function generateBrandOperationalAlerts(
  campaigns: BrandCampaignMetricInput[],
  pendingReviewsCount: number,
  clock: Date = new Date()
): BrandOperationalAlert[] {
  const alerts: BrandOperationalAlert[] = [];
  const _nowMs = clock.getTime();

  if (pendingReviewsCount > 0) {
    alerts.push({
      id: "pending-reviews",
      type: "APPROVAL_PENDING",
      severity: "HIGH",
      title: "Content Submissions Awaiting Approval",
      message: `${pendingReviewsCount} creator submission${
        pendingReviewsCount > 1 ? "s are" : " is"
      } waiting for your review. Timely approvals help creators stay on schedule.`,
      ctaLabel: "Review Submissions",
      ctaLink: "/dashboard/deals",
    });
  }

  for (const c of campaigns) {
    if (c.status === "ACTIVE" && c.budgetPaise > 0) {
      const spendRatio = c.spendPaise / c.budgetPaise;
      if (spendRatio >= 0.9 && (c.activeDealsCount || 0) === 0) {
        alerts.push({
          id: `budget-exhaust-${c.id}`,
          type: "BUDGET_EXHAUSTION",
          severity: "MEDIUM",
          title: `Budget Nearing Allocation: ${c.title}`,
          message: `Campaign has allocated ${(spendRatio * 100).toFixed(0)}% of its escrow budget.`,
          campaignId: c.id,
          ctaLabel: "Manage Campaign",
          ctaLink: `/dashboard/campaigns/${c.id}`,
        });
      }
    }

    if (c.deliveredViews > 500 && c.baselineCpvPaise > 0) {
      const actualCpv = Math.round(c.spendPaise / c.deliveredViews);
      if (actualCpv > c.baselineCpvPaise * 1.5) {
        alerts.push({
          id: `cpv-variance-${c.id}`,
          type: "HIGH_CPV_VARIANCE",
          severity: "INFO",
          title: `CPV Premium Alert: ${c.title}`,
          message: `Actual CPV is ${(
            ((actualCpv - c.baselineCpvPaise) / c.baselineCpvPaise) *
            100
          ).toFixed(0)}% higher than the category benchmark. Consider adding micro-creators to balance efficiency.`,
          campaignId: c.id,
          ctaLabel: "View Analytics",
          ctaLink: `/dashboard/campaigns/${c.id}/analytics`,
        });
      }
    }
  }

  return alerts;
}
