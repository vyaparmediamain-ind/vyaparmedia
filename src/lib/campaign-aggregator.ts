/**
 * Campaign Analytics & Performance Metrics Aggregator (Pure Logic)
 *
 * RULES:
 * - Pure logic: zero prisma, zero fetch, zero Date.now inside (clock and dates injected).
 * - Money = integer paise; rates = basis points (100% = 10,000 bps). Round once at end with Math.round.
 * - Every number carries data quality: "VERIFIED" | "ESTIMATED" | "SELF_REPORTED".
 * - Time: bucket days in Asia/Kolkata (+05:30) explicitly, no implicit server TZ.
 * - Cancelled / refunded deals are strictly excluded from performance & deliverable metrics.
 */

import { calculateRoiScore, DEFAULT_BASELINE_CPV_PAISE } from "./roi-calculator";
import { IST_OFFSET_MS, getKolkataDayBounds } from "./telemetry-aggregator";

export { IST_OFFSET_MS, getKolkataDayBounds };

export type DataQualityTier = "VERIFIED" | "ESTIMATED" | "SELF_REPORTED";

export interface MetricWithQuality<T> {
  value: T;
  dataQuality: DataQualityTier;
}

export interface RawCampaignApplication {
  id: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RawCampaignDeal {
  id: string;
  status: string;
  amount: number; // paise
  platformFee: number; // paise
  submissionDeadline?: Date | null;
  postingDeadline?: Date | null;
  submittedAt?: Date | null;
  approvedAt?: Date | null;
  postedAt?: Date | null;
  completedAt?: Date | null;
  revisionsUsed?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RawCampaignSubmission {
  id: string;
  dealId: string;
  status: string; // PENDING, APPROVED, REVISION_REQUESTED
  submittedAt: Date;
  reviewedAt?: Date | null;
}

export interface RawCampaignSnapshot {
  id: string;
  dealId: string;
  interval: string; // '24h', '48h', '7d'
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  isEstimated: boolean;
  metricsQuality?: unknown;
  capturedAt: Date;
}

export interface RawCampaignPageView {
  id: string;
  sessionHash: string;
  activeMs: number;
  createdAt: Date;
}

export interface RawCampaignTransaction {
  id: string;
  dealId?: string | null;
  type: string; // CREDIT, DEBIT
  amount: number; // paise
  status: string; // PENDING, COMPLETED, FAILED
  createdAt: Date;
}

export interface RawCampaignPaymentHold {
  id: string;
  dealId: string;
  amount: number; // paise
  status: string; // PENDING, HELD, CAPTURED, RELEASED, EXPIRED, FAILED
  createdAt: Date;
  capturedAt?: Date | null;
  releasedAt?: Date | null;
}

export interface CampaignDayAggregationInput {
  campaignId: string;
  date: Date; // Midnight UTC representing the IST date
  applications: readonly RawCampaignApplication[];
  deals: readonly RawCampaignDeal[];
  submissions: readonly RawCampaignSubmission[];
  snapshots: readonly RawCampaignSnapshot[];
  pageViews: readonly RawCampaignPageView[];
  transactions: readonly RawCampaignTransaction[];
  paymentHolds: readonly RawCampaignPaymentHold[];
}

export interface CampaignDailyMetricOutput {
  campaignId: string;
  date: Date;
  briefViews: number;
  uniqueBriefViewers: number;
  applications: number;
  shortlisted: number;
  hired: number;
  contentSubmitted: number;
  postsLive: number;
  deliveredViews: bigint;
  apiViewsShareBps: number;
  engagements: bigint;
  escrowFundedPaise: bigint;
  escrowReleasedPaise: bigint;
  platformFeePaise: bigint;
}

export interface DerivedCampaignMetrics {
  blendedCpvPaise: MetricWithQuality<number>;
  cpePaise: MetricWithQuality<number>;
  roiScore: MetricWithQuality<number>;
  onTimeDeliveryRateBps: MetricWithQuality<number>;
  onTimeDeliveryRatePercent: MetricWithQuality<number>;
  approvalCycleTimeHours: MetricWithQuality<number>;
  approvalCycleTimeMs: MetricWithQuality<number>;
  revisionRateBps: MetricWithQuality<number>;
  revisionRatePercent: MetricWithQuality<number>;
  totalSpendPaise: MetricWithQuality<number>;
  totalDeliveredViews: MetricWithQuality<number>;
  apiViewsShareBps: MetricWithQuality<number>;
}

/**
 * Checks whether an engagement snapshot qualifies as an API-verified measurement.
 */
export function isApiQualitySnapshot(snapshot: RawCampaignSnapshot): boolean {
  if (snapshot.isEstimated === false) return true;

  if (snapshot.metricsQuality && typeof snapshot.metricsQuality === "object") {
    const quality = snapshot.metricsQuality as Record<string, unknown>;
    const viewsQuality = String(quality.views || "").toUpperCase();
    if (viewsQuality === "API" || viewsQuality === "VERIFIED") {
      return true;
    }
  }

  return false;
}

/**
 * Selects the most mature engagement snapshot for a deal (7d > 48h > 24h > latest).
 */
export function selectBestSnapshot(
  dealSnapshots: readonly RawCampaignSnapshot[]
): RawCampaignSnapshot | null {
  if (!dealSnapshots || dealSnapshots.length === 0) return null;

  const s7d = dealSnapshots.find((s) => s.interval === "7d");
  if (s7d) return s7d;

  const s48h = dealSnapshots.find((s) => s.interval === "48h");
  if (s48h) return s48h;

  const s24h = dealSnapshots.find((s) => s.interval === "24h");
  if (s24h) return s24h;

  // Fallback to highest capturedAt
  return [...dealSnapshots].sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime())[0] ?? null;
}

/**
 * Pure aggregation function to compute daily campaign funnel and performance metrics.
 * Operates on non-cancelled entities within the specific Asia/Kolkata calendar day window.
 */
export function aggregateCampaignDailyMetrics(
  input: CampaignDayAggregationInput
): CampaignDailyMetricOutput {
  const { dayStart, dayEnd } = getKolkataDayBounds(input.date);

  // 1. Brief Page Views (within day bounds)
  const dayPageViews = input.pageViews.filter(
    (pv) => pv.createdAt.getTime() >= dayStart.getTime() && pv.createdAt.getTime() < dayEnd.getTime()
  );
  const briefViews = dayPageViews.length;
  const uniqueBriefViewers = new Set(dayPageViews.map((pv) => pv.sessionHash)).size;

  // 2. Applications submitted on this day
  const applications = input.applications.filter(
    (app) => app.createdAt.getTime() >= dayStart.getTime() && app.createdAt.getTime() < dayEnd.getTime()
  ).length;

  // 3. Shortlisted applications on this day
  const shortlisted = input.applications.filter(
    (app) =>
      app.status === "SHORTLISTED" &&
      app.updatedAt.getTime() >= dayStart.getTime() &&
      app.updatedAt.getTime() < dayEnd.getTime()
  ).length;

  // 4. Hired deals created / signed on this day (excluding CANCELLED)
  const validDeals = input.deals.filter((d) => d.status !== "CANCELLED");
  const hired = validDeals.filter(
    (d) => d.createdAt.getTime() >= dayStart.getTime() && d.createdAt.getTime() < dayEnd.getTime()
  ).length;

  // 5. Content Submissions submitted on this day
  const validDealIds = new Set(validDeals.map((d) => d.id));
  const contentSubmitted = input.submissions.filter(
    (sub) =>
      validDealIds.has(sub.dealId) &&
      sub.submittedAt.getTime() >= dayStart.getTime() &&
      sub.submittedAt.getTime() < dayEnd.getTime()
  ).length;

  // 6. Posts live on this day
  const postsLive = validDeals.filter((d) => {
    if (d.postedAt) {
      return d.postedAt.getTime() >= dayStart.getTime() && d.postedAt.getTime() < dayEnd.getTime();
    }
    const isLiveStatus = ["POSTED", "VERIFICATION_PENDING", "VERIFIED", "COMPLETED"].includes(d.status);
    return isLiveStatus && d.updatedAt.getTime() >= dayStart.getTime() && d.updatedAt.getTime() < dayEnd.getTime();
  }).length;

  // 7. Snapshots up to dayEnd for non-cancelled deals
  // Group snapshots by dealId
  const snapshotsByDeal = new Map<string, RawCampaignSnapshot[]>();
  for (const snap of input.snapshots) {
    if (!validDealIds.has(snap.dealId)) continue;
    // Only snapshots captured on or before dayEnd are eligible for this date's state
    if (snap.capturedAt.getTime() >= dayEnd.getTime()) continue;

    const list = snapshotsByDeal.get(snap.dealId) ?? [];
    list.push(snap);
    snapshotsByDeal.set(snap.dealId, list);
  }

  let totalViews = 0;
  let apiViews = 0;
  let totalEngagements = 0;

  for (const dealId of validDealIds) {
    const snaps = snapshotsByDeal.get(dealId);
    if (!snaps || snaps.length === 0) continue;

    const best = selectBestSnapshot(snaps);
    if (!best) continue;

    const views = Math.max(0, best.views);
    totalViews += views;
    if (isApiQualitySnapshot(best)) {
      apiViews += views;
    }

    const engagements =
      Math.max(0, best.likes) +
      Math.max(0, best.comments) +
      Math.max(0, best.shares) +
      Math.max(0, best.saves);
    totalEngagements += engagements;
  }

  const apiViewsShareBps =
    totalViews > 0 ? Math.round((apiViews / totalViews) * 10_000) : 0;

  // 8. Financials on this day (excluding cancelled / refunded deals)
  // Escrow Funded: payment holds created/held on this day OR debit transactions completed
  let dayEscrowFundedPaise = 0;
  for (const hold of input.paymentHolds) {
    if (!validDealIds.has(hold.dealId)) continue;
    const isHeld = ["HELD", "CAPTURED", "RELEASED"].includes(hold.status);
    if (isHeld && hold.createdAt.getTime() >= dayStart.getTime() && hold.createdAt.getTime() < dayEnd.getTime()) {
      dayEscrowFundedPaise += hold.amount;
    }
  }

  // Escrow Released: deals completed on this day or holds released on this day
  let dayEscrowReleasedPaise = 0;
  let dayPlatformFeePaise = 0;

  for (const deal of validDeals) {
    if (deal.status === "COMPLETED" && deal.completedAt) {
      if (deal.completedAt.getTime() >= dayStart.getTime() && deal.completedAt.getTime() < dayEnd.getTime()) {
        dayEscrowReleasedPaise += deal.amount;
        dayPlatformFeePaise += deal.platformFee;
      }
    }
  }

  return {
    campaignId: input.campaignId,
    date: dayStart,
    briefViews,
    uniqueBriefViewers,
    applications,
    shortlisted,
    hired,
    contentSubmitted,
    postsLive,
    deliveredViews: BigInt(totalViews),
    apiViewsShareBps,
    engagements: BigInt(totalEngagements),
    escrowFundedPaise: BigInt(dayEscrowFundedPaise),
    escrowReleasedPaise: BigInt(dayEscrowReleasedPaise),
    platformFeePaise: BigInt(dayPlatformFeePaise),
  };
}

/**
 * Pure calculation of derived campaign performance metrics across a cumulative period.
 */
export function calculateDerivedCampaignMetrics(options: {
  totalSpendPaise: number;
  deliveredViews: number;
  apiViewsShareBps: number;
  engagements: number;
  categoryOrBaseline?: number | string | string[];
  deals: readonly RawCampaignDeal[];
  submissions: readonly RawCampaignSubmission[];
}): DerivedCampaignMetrics {
  const {
    totalSpendPaise,
    deliveredViews,
    apiViewsShareBps,
    engagements,
    categoryOrBaseline,
    deals,
    submissions,
  } = options;

  // 1. Data Quality determination
  const viewsQuality: DataQualityTier =
    deliveredViews > 0 && apiViewsShareBps >= 10_000 ? "VERIFIED" : "ESTIMATED";

  // 2. Blended CPV = Spend ÷ Delivered Views
  let blendedCpvPaise = 0;
  if (deliveredViews > 0 && totalSpendPaise > 0) {
    blendedCpvPaise = Math.round(totalSpendPaise / deliveredViews);
  }

  // 3. CPE = Spend ÷ Engagements
  let cpePaise = 0;
  if (engagements > 0 && totalSpendPaise > 0) {
    cpePaise = Math.round(totalSpendPaise / engagements);
  }

  // 4. ROI Score via calculateRoiScore + resolved baseline (0 delivered views yields 0 ROI score sentinel)
  const roiScore =
    deliveredViews > 0 && blendedCpvPaise > 0
      ? calculateRoiScore(blendedCpvPaise, categoryOrBaseline ?? DEFAULT_BASELINE_CPV_PAISE)
      : 0;

  // 5. On-Time Delivery Rate
  // Exclude CANCELLED deals
  const eligibleDeals = deals.filter((d) => d.status !== "CANCELLED" && (d.completedAt || d.postedAt || d.submittedAt));
  let onTimeCount = 0;

  for (const deal of eligibleDeals) {
    let isOnTime = true;
    if (deal.postingDeadline && deal.completedAt) {
      isOnTime = deal.completedAt.getTime() <= deal.postingDeadline.getTime();
    } else if (deal.postingDeadline && deal.postedAt) {
      isOnTime = deal.postedAt.getTime() <= deal.postingDeadline.getTime();
    } else if (deal.submissionDeadline && deal.submittedAt) {
      isOnTime = deal.submittedAt.getTime() <= deal.submissionDeadline.getTime();
    }

    if (isOnTime) {
      onTimeCount += 1;
    }
  }

  const onTimeDeliveryRateBps =
    eligibleDeals.length > 0 ? Math.round((onTimeCount / eligibleDeals.length) * 10_000) : 10_000;
  const onTimeDeliveryRatePercent = Number(((onTimeDeliveryRateBps / 10_000) * 100).toFixed(1));

  // 6. Approval Cycle Time
  const reviewedSubmissions = submissions.filter(
    (s) => s.reviewedAt !== null && s.reviewedAt !== undefined
  );
  let totalReviewMs = 0;

  for (const sub of reviewedSubmissions) {
    if (sub.reviewedAt) {
      totalReviewMs += Math.max(0, sub.reviewedAt.getTime() - sub.submittedAt.getTime());
    }
  }

  const approvalCycleTimeMs =
    reviewedSubmissions.length > 0 ? Math.round(totalReviewMs / reviewedSubmissions.length) : 0;
  const approvalCycleTimeHours = Number(
    (approvalCycleTimeMs / (1000 * 60 * 60)).toFixed(1)
  );

  // 7. Revision Rate
  const totalSubs = submissions.length;
  const revisionSubs = submissions.filter(
    (s) => s.status === "REVISION_REQUESTED"
  ).length;

  const revisionRateBps =
    totalSubs > 0 ? Math.round((revisionSubs / totalSubs) * 10_000) : 0;
  const revisionRatePercent = Number(((revisionRateBps / 10_000) * 100).toFixed(1));

  return {
    blendedCpvPaise: { value: blendedCpvPaise, dataQuality: viewsQuality },
    cpePaise: { value: cpePaise, dataQuality: viewsQuality },
    roiScore: { value: roiScore, dataQuality: "ESTIMATED" },
    onTimeDeliveryRateBps: { value: onTimeDeliveryRateBps, dataQuality: "VERIFIED" },
    onTimeDeliveryRatePercent: { value: onTimeDeliveryRatePercent, dataQuality: "VERIFIED" },
    approvalCycleTimeHours: { value: approvalCycleTimeHours, dataQuality: "VERIFIED" },
    approvalCycleTimeMs: { value: approvalCycleTimeMs, dataQuality: "VERIFIED" },
    revisionRateBps: { value: revisionRateBps, dataQuality: "VERIFIED" },
    revisionRatePercent: { value: revisionRatePercent, dataQuality: "VERIFIED" },
    totalSpendPaise: { value: totalSpendPaise, dataQuality: "VERIFIED" },
    totalDeliveredViews: { value: deliveredViews, dataQuality: viewsQuality },
    apiViewsShareBps: { value: apiViewsShareBps, dataQuality: "VERIFIED" },
  };
}
