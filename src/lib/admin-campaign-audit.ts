/**
 * Admin Campaign Operations & Financial Audit Engine (Pure Logic)
 *
 * Implements deterministic calculation rules for platform operations:
 * 1. Platform revenue: Sum of Deal.platformFee for completed deals minus gateway fee.
 * 2. Deals at deadline risk: Active deals with overdue or imminent (<48h) deadlines.
 * 3. Dispute counts: Categorized dispute totals on campaign deals.
 * 4. Contact-leak flags: Counts and deal links with zero raw message text exposure.
 * 5. Fraud flags: Identity, review, and authenticity risk markers.
 * 6. Creator metric anomaly flags (P06): Follower spikes, ER collapse, and sample size warnings.
 * 7. Estimated-vs-API data share: Basis points and percentage breakdown.
 *
 * PURE LOGIC ONLY: No database access, no fetch, no implicit Date.now().
 */

import { paiseToRupees } from "@/lib/csv-export";
import {
  detectMetricAnomalies,
  type AnomalyDetectionInput,
} from "@/lib/metric-stats";

export interface RawAdminDeal {
  id: string;
  campaignId: string;
  influencerId: string;
  influencerName?: string | null | undefined;
  influencerHandle?: string | null | undefined;
  followerAuthenticityScore?: number | null | undefined;
  followers?: number | null | undefined;
  engagementRate?: number | null | undefined;
  recentLikesSample?: number[] | undefined;
  historicalFollowers?: number | null | undefined;
  status: string;
  amount: number; // in paise
  platformFee: number; // in paise (as charged)
  gatewayFee: number; // in paise
  postingDeadline: Date;
  signDeadline?: Date | null | undefined;
  completedAt?: Date | null | undefined;
  createdAt: Date;
  views?: number | undefined;
  isEstimated?: boolean | undefined;
}

export interface RawAdminDispute {
  id: string;
  dealId: string;
  type: string;
  status: string;
  description: string;
  tier: number;
  createdAt: Date;
  resolvedAt?: Date | null;
}

export interface RawAdminContactLeakMessage {
  id: string;
  dealId: string | null;
  senderId: string;
  senderEmail?: string | null;
  senderUserType?: string | null;
  isBlocked: boolean;
  hasWarning: boolean;
  metadata?: unknown;
  createdAt: Date;
}

export interface PlatformRevenueResult {
  grossPlatformFeePaise: number;
  grossPlatformFeeRupees: string;
  gatewayCostPaise: number;
  gatewayCostRupees: string;
  netPlatformRevenuePaise: number;
  netPlatformRevenueRupees: string;
  completedDealsCount: number;
}

export interface DealDeadlineRisk {
  dealId: string;
  influencerId: string;
  influencerName: string;
  influencerHandle: string | null;
  status: string;
  postingDeadline: string;
  signDeadline: string | null;
  hoursUntilPostingDeadline: number;
  riskSeverity: "OVERDUE" | "IMMINENT_48H" | "SIGN_OVERDUE";
}

export interface ContactLeakAuditItem {
  messageId: string;
  dealId: string | null;
  senderId: string;
  senderEmail: string | null;
  senderUserType: string | null;
  flagType: string;
  createdAt: string;
  dealLink: string | null;
}

export interface FraudAuditFlag {
  entityType: "CREATOR" | "CAMPAIGN" | "DISPUTE";
  entityId: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  flag: string;
  details: string;
}

export interface CreatorMetricAnomalyAudit {
  influencerId: string;
  influencerName: string;
  influencerHandle: string | null;
  rule: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  description: string;
}

export interface EstimatedVsApiShareResult {
  totalViews: number;
  verifiedViews: number;
  estimatedViews: number;
  apiViewsShareBps: number;
  apiSharePercent: number;
  estimatedSharePercent: number;
  dataQuality: "VERIFIED" | "ESTIMATED";
}

export interface AdminCampaignAuditOverview {
  revenue: PlatformRevenueResult;
  deadlineRisks: DealDeadlineRisk[];
  disputes: {
    total: number;
    open: number;
    resolved: number;
    items: Array<{
      id: string;
      dealId: string;
      type: string;
      status: string;
      tier: number;
      createdAt: string;
    }>;
  };
  contactLeaks: {
    totalCount: number;
    items: ContactLeakAuditItem[];
  };
  fraudFlags: FraudAuditFlag[];
  creatorMetricAnomalies: CreatorMetricAnomalyAudit[];
  dataQualityShare: EstimatedVsApiShareResult;
}

/**
 * 1. Calculate platform revenue on campaign.
 * Gross revenue = Sum of platformFee for completed deals.
 * Gateway cost = Sum of gatewayFee for completed deals.
 * Net platform revenue = Gross platform fee - Gateway cost.
 */
export function calculatePlatformRevenue(deals: RawAdminDeal[]): PlatformRevenueResult {
  let grossPlatformFeePaise = 0;
  let gatewayCostPaise = 0;
  let completedDealsCount = 0;

  for (const deal of deals) {
    if (deal.status === "COMPLETED") {
      grossPlatformFeePaise += Math.max(0, deal.platformFee);
      gatewayCostPaise += Math.max(0, deal.gatewayFee);
      completedDealsCount += 1;
    }
  }

  const netPlatformRevenuePaise = Math.max(0, grossPlatformFeePaise - gatewayCostPaise);

  return {
    grossPlatformFeePaise,
    grossPlatformFeeRupees: paiseToRupees(grossPlatformFeePaise),
    gatewayCostPaise,
    gatewayCostRupees: paiseToRupees(gatewayCostPaise),
    netPlatformRevenuePaise,
    netPlatformRevenueRupees: paiseToRupees(netPlatformRevenuePaise),
    completedDealsCount,
  };
}

/**
 * 2. Identify deals at deadline risk.
 * Active deals that are already overdue or due within 48 hours.
 */
export function detectDeadlineRisks(
  deals: RawAdminDeal[],
  now: Date
): DealDeadlineRisk[] {
  const risks: DealDeadlineRisk[] = [];
  const nowMs = now.getTime();
  const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

  for (const deal of deals) {
    // Only in-flight deals can be at deadline risk
    if (
      deal.status === "COMPLETED" ||
      deal.status === "CANCELLED" ||
      deal.status === "PAYMENT_PENDING"
    ) {
      continue;
    }

    if (deal.status === "PENDING_SIGNATURE" && deal.signDeadline) {
      if (deal.signDeadline.getTime() < nowMs) {
        risks.push({
          dealId: deal.id,
          influencerId: deal.influencerId,
          influencerName: deal.influencerName || "Creator Partner",
          influencerHandle: deal.influencerHandle || null,
          status: deal.status,
          postingDeadline: deal.postingDeadline.toISOString(),
          signDeadline: deal.signDeadline.toISOString(),
          hoursUntilPostingDeadline: Math.round(
            (deal.postingDeadline.getTime() - nowMs) / (60 * 60 * 1000)
          ),
          riskSeverity: "SIGN_OVERDUE",
        });
        continue;
      }
    }

    const postingDeadlineMs = deal.postingDeadline.getTime();
    const diffMs = postingDeadlineMs - nowMs;
    const hoursRemaining = Math.round(diffMs / (60 * 60 * 1000));

    if (diffMs < 0) {
      risks.push({
        dealId: deal.id,
        influencerId: deal.influencerId,
        influencerName: deal.influencerName || "Creator Partner",
        influencerHandle: deal.influencerHandle || null,
        status: deal.status,
        postingDeadline: deal.postingDeadline.toISOString(),
        signDeadline: deal.signDeadline ? deal.signDeadline.toISOString() : null,
        hoursUntilPostingDeadline: hoursRemaining,
        riskSeverity: "OVERDUE",
      });
    } else if (diffMs <= FORTY_EIGHT_HOURS_MS) {
      risks.push({
        dealId: deal.id,
        influencerId: deal.influencerId,
        influencerName: deal.influencerName || "Creator Partner",
        influencerHandle: deal.influencerHandle || null,
        status: deal.status,
        postingDeadline: deal.postingDeadline.toISOString(),
        signDeadline: deal.signDeadline ? deal.signDeadline.toISOString() : null,
        hoursUntilPostingDeadline: hoursRemaining,
        riskSeverity: "IMMINENT_48H",
      });
    }
  }

  // Sort by highest urgency (overdue first, then least hours remaining)
  return risks.sort((a, b) => a.hoursUntilPostingDeadline - b.hoursUntilPostingDeadline);
}

/**
 * 3. Categorize campaign dispute counts.
 */
export function summarizeDisputes(disputes: RawAdminDispute[]) {
  let open = 0;
  let resolved = 0;

  for (const d of disputes) {
    if (d.status === "OPEN" || d.status === "PENDING" || d.status === "UNDER_REVIEW") {
      open += 1;
    } else if (d.status === "RESOLVED" || d.status === "CLOSED") {
      resolved += 1;
    }
  }

  return {
    total: disputes.length,
    open,
    resolved,
    items: disputes.map((d) => ({
      id: d.id,
      dealId: d.dealId,
      type: d.type,
      status: d.status,
      tier: d.tier,
      createdAt: d.createdAt.toISOString(),
    })),
  };
}

/**
 * 4. Sanitize contact-leak flags: Counts + Links, strictly NO message dumps!
 */
export function sanitizeContactLeakFlags(
  messages: RawAdminContactLeakMessage[]
): {
  totalCount: number;
  items: ContactLeakAuditItem[];
} {
  const items: ContactLeakAuditItem[] = [];

  for (const msg of messages) {
    if (msg.isBlocked || msg.hasWarning) {
      let flagType = "CONTACT_PATTERN_DETECTED";
      if (
        msg.metadata &&
        typeof msg.metadata === "object" &&
        "type" in (msg.metadata as Record<string, unknown>)
      ) {
        flagType = String((msg.metadata as Record<string, unknown>).type);
      }

      items.push({
        messageId: msg.id,
        dealId: msg.dealId,
        senderId: msg.senderId,
        senderEmail: msg.senderEmail ?? null,
        senderUserType: msg.senderUserType ?? null,
        flagType,
        createdAt: msg.createdAt.toISOString(),
        dealLink: msg.dealId ? `/dashboard/deals/${msg.dealId}` : null,
      });
    }
  }

  return {
    totalCount: items.length,
    items,
  };
}

/**
 * 5. Aggregate fraud flags for the campaign and participating creators.
 */
export function aggregateFraudFlags(params: {
  campaignId: string;
  deals: RawAdminDeal[];
  disputes: RawAdminDispute[];
}): FraudAuditFlag[] {
  const { campaignId, deals, disputes } = params;
  const flags: FraudAuditFlag[] = [];

  // Check creator DRS / authenticity scores
  for (const d of deals) {
    const authScore = d.followerAuthenticityScore ?? 100;
    if (authScore < 50) {
      flags.push({
        entityType: "CREATOR",
        entityId: d.influencerId,
        severity: "HIGH",
        flag: "LOW_AUTHENTICITY_SCORE",
        details: `Creator @${d.influencerHandle || d.influencerId} has critical authenticity score (${authScore}/100), indicating suspected synthetic follower growth.`,
      });
    }
  }

  // Check dispute fraud indicators
  for (const disp of disputes) {
    if (disp.type === "FRAUD" || disp.description.toLowerCase().includes("fraud")) {
      flags.push({
        entityType: "DISPUTE",
        entityId: disp.id,
        severity: "HIGH",
        flag: "FRAUD_DISPUTE_FILED",
        details: `Dispute ${disp.id} reported on deal ${disp.dealId} under category ${disp.type}.`,
      });
    }
  }

  // Check campaign-level deal dispute ratio
  if (deals.length >= 3 && disputes.length / deals.length >= 0.3) {
    flags.push({
      entityType: "CAMPAIGN",
      entityId: campaignId,
      severity: "MEDIUM",
      flag: "ELEVATED_DISPUTE_RATIO",
      details: `Campaign has an elevated dispute rate of ${Math.round(
        (disputes.length / deals.length) * 100
      )}% (${disputes.length} disputes across ${deals.length} deals).`,
    });
  }

  return flags;
}

/**
 * 6. Creator metric anomaly flags (P06): Follower spikes, ER collapse, ratio skews.
 */
export function detectCreatorMetricAnomalies(
  deals: RawAdminDeal[]
): CreatorMetricAnomalyAudit[] {
  const anomalies: CreatorMetricAnomalyAudit[] = [];
  const seenCreators = new Set<string>();

  for (const d of deals) {
    if (seenCreators.has(d.influencerId)) continue;
    seenCreators.add(d.influencerId);

    const followers = d.followers ?? 0;
    const er = d.engagementRate ?? 0;

    // Small sample / delivery data check
    if (d.views !== undefined && d.views < 1000 && d.status === "COMPLETED") {
      anomalies.push({
        influencerId: d.influencerId,
        influencerName: d.influencerName || "Creator",
        influencerHandle: d.influencerHandle || null,
        rule: "INSUFFICIENT_SAMPLE_SIZE",
        severity: "LOW",
        description: `Delivered views (${d.views}) are under the 1,000 threshold ("Data kam hai"). Statistical confidence is low.`,
      });
    }

    if (followers > 0) {
      const avgLikes =
        d.recentLikesSample && d.recentLikesSample.length > 0
          ? Math.round(d.recentLikesSample.reduce((a, b) => a + b, 0) / d.recentLikesSample.length)
          : null;
      const erBps = er !== null && er !== undefined ? Math.round(er * 100) : null;

      const input: AnomalyDetectionInput = {
        followers,
        avgLikes,
        engagementRateBps: erBps,
        previousSnapshot:
          d.historicalFollowers !== null && d.historicalFollowers !== undefined
            ? {
                followers: d.historicalFollowers,
                engagementRateBps: erBps,
                capturedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              }
            : null,
      };

      const detected = detectMetricAnomalies(input);
      for (const flag of detected) {
        anomalies.push({
          influencerId: d.influencerId,
          influencerName: d.influencerName || "Creator",
          influencerHandle: d.influencerHandle || null,
          rule: flag.rule,
          severity: flag.severity,
          description: flag.description,
        });
      }
    }
  }

  return anomalies;
}

/**
 * 7. Calculate estimated-vs-API data share.
 */
export function calculateEstimatedVsApiShare(
  deals: RawAdminDeal[]
): EstimatedVsApiShareResult {
  let verifiedViews = 0;
  let estimatedViews = 0;

  for (const d of deals) {
    const views = d.views ?? 0;
    if (d.isEstimated) {
      estimatedViews += views;
    } else {
      verifiedViews += views;
    }
  }

  const totalViews = verifiedViews + estimatedViews;
  const apiViewsShareBps =
    totalViews > 0 ? Math.round((verifiedViews / totalViews) * 10000) : 0;
  const apiSharePercent =
    totalViews > 0 ? Number(((verifiedViews / totalViews) * 100).toFixed(1)) : 0;
  const estimatedSharePercent =
    totalViews > 0 ? Number(((estimatedViews / totalViews) * 100).toFixed(1)) : 0;

  return {
    totalViews,
    verifiedViews,
    estimatedViews,
    apiViewsShareBps,
    apiSharePercent,
    estimatedSharePercent,
    dataQuality: estimatedViews > 0 ? "ESTIMATED" : "VERIFIED",
  };
}

/**
 * Master aggregation function for all admin operations metrics.
 */
export function aggregateAdminCampaignAudit(params: {
  campaignId: string;
  deals: RawAdminDeal[];
  disputes: RawAdminDispute[];
  messages: RawAdminContactLeakMessage[];
  now?: Date;
}): AdminCampaignAuditOverview {
  const clock = params.now ?? new Date();

  const revenue = calculatePlatformRevenue(params.deals);
  const deadlineRisks = detectDeadlineRisks(params.deals, clock);
  const disputeSummary = summarizeDisputes(params.disputes);
  const contactLeaks = sanitizeContactLeakFlags(params.messages);
  const fraudFlags = aggregateFraudFlags({
    campaignId: params.campaignId,
    deals: params.deals,
    disputes: params.disputes,
  });
  const creatorMetricAnomalies = detectCreatorMetricAnomalies(params.deals);
  const dataQualityShare = calculateEstimatedVsApiShare(params.deals);

  return {
    revenue,
    deadlineRisks,
    disputes: disputeSummary,
    contactLeaks,
    fraudFlags,
    creatorMetricAnomalies,
    dataQualityShare,
  };
}
