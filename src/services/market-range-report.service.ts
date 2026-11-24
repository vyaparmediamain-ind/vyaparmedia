/**
 * Market Range Report Service
 *
 * Generates official, branded "Estimated Market Range" reports for creators (self) and administrators:
 * - Conforms to VyaparMedia Report Standard (v3).
 * - Full VyaparMedia letterhead from PLATFORM_CONFIG with warning when corporate details are unconfigured.
 * - Creator handle, categories, audience follower tier, and verification status.
 * - Estimated market range (min, max, mid in INR) + step-by-step waterfall explanation.
 * - 12-week CreatorMetricSnapshot historical delivery table with explicit data quality tagging.
 * - Strict Data Quality summary: % verified, % estimated, % self-reported with legend.
 * - Quality flags and statutory advisory disclaimer.
 * - Cryptographic SHA-256 payload integrity code and RFC 4648 Base32 short hash.
 * - Object-level authorization with IDOR defense (returns 404 for non-owned profiles).
 * - Audit trail logging for administrative and creator exports.
 * - Gated under the `branded_reports` feature flag.
 */

import prisma from "@/lib/db";
import { AppError } from "@/lib/errors";
import { createActivityLog, createAuditLog } from "@/lib/audit";
import { assertFeatureEnabled, FEATURE_FLAGS } from "@/lib/feature-flags";
import { buildReportMeta, ReportMeta } from "@/lib/report-meta";
import {
  buildBrandedCsv,
  buildReportFilename,
  paiseToRupees,
} from "@/lib/csv-export";
import { FairPriceService } from "@/services/fair-price.service";
import { PricingConfigService } from "@/services/pricing-config.service";
import { ReportVerificationService } from "@/services/report-verification.service";
import { resolveFollowerTier, DEFAULT_FAIR_PRICE_CONFIG, CreatorFollowerTier } from "@/lib/fair-price-engine";
import { MetricViewsQuality } from "@prisma/client";
import { format } from "date-fns";
import { Actor, normalizeActor } from "@/lib/authz";

export interface SnapshotReportRow {
  id: string;
  weekIndex: number;
  dateStr: string;
  platform: string;
  followers: number;
  followersFormatted: string;
  avgViews: number;
  avgViewsFormatted: string;
  engagementRatePercent: string;
  dataQuality: "VERIFIED" | "ESTIMATED" | "SELF_REPORTED";
  isEstimated: boolean;
  tier: string;
}

export interface MarketRangeReportData {
  creator: {
    id: string;
    userId: string;
    displayName: string;
    instagramHandle: string | null;
    youtubeHandle: string | null;
    categories: string[];
    primaryPlatform: string;
    followers: number;
    followerTier: CreatorFollowerTier;
    authenticityScore: number | null;
    drsScore: number;
  };
  marketRange: {
    minPaise: number;
    maxPaise: number;
    basePaise: number;
    minRupees: string;
    maxRupees: string;
    baseRupees: string;
    confidence: string;
    dataQuality: "VERIFIED" | "ESTIMATED" | "SELF_REPORTED";
    flags: string[];
    explanation: Array<{
      step: string;
      description: string;
      multiplier?: number | undefined;
      contributionPaise: number;
      runningTotalPaise: number;
      runningTotalRupees: string;
    }>;
    engineVersion: string;
    configVersion: number;
  };
  snapshots: SnapshotReportRow[];
  dataQualitySummary: {
    verifiedPercent: number;
    estimatedPercent: number;
    selfReportedPercent: number;
    text: string;
  };
  reportMeta: ReportMeta;
  disclaimer: string;
}

export class MarketRangeReportService {
  /**
   * Generates the canonical Market Range Report payload.
   * Enforces feature flag gating, object-level authorization, and audit logging.
   */
  public static async generateReport(
    callerUser: Actor | { id: string; userType?: string | undefined; role?: string | undefined; name?: string | null | undefined; email?: string | null | undefined; isActiveAdmin?: boolean | undefined },
    influencerId: string,
    opts?: { format?: "json" | "csv" | undefined; clock?: Date | undefined }
  ): Promise<MarketRangeReportData> {
    const actor = normalizeActor(callerUser);

    // 1. Feature Flag Check (branded_reports)
    await assertFeatureEnabled(FEATURE_FLAGS.BRANDED_REPORTS, {
      userId: actor.id,
      role: actor.role,
    });

    // 2. Fetch Creator Profile
    const profile = await prisma.influencerProfile.findUnique({
      where: { id: influencerId },
      include: {
        user: { select: { email: true, trustScore: true } },
      },
    });

    // IDOR Defense: Return 404 (not 403) so existence is not leaked to unauthorized callers
    if (!profile) {
      throw AppError.notFound("Influencer profile not found");
    }

    // 3. Object-Level Authorization: Only active admins or profile owners may access
    const isOwner = profile.userId === actor.id;

    if (!actor.isActiveAdmin && !isOwner) {
      throw AppError.notFound("Influencer profile not found");
    }

    // 4. Resolve Follower Counts & Audience Tier
    const followers = Math.max(
      profile.instagramFollowers || 0,
      profile.youtubeSubscribers || 0,
      0
    );
    const followerTier = resolveFollowerTier(followers, DEFAULT_FAIR_PRICE_CONFIG);
    const categories = (profile.categories || "general")
      .split(/[,;|]/)
      .map((c) => c.trim())
      .filter(Boolean);

    // 5. Run Pure Fair Price Engine Evaluation
    const evalResult = await FairPriceService.evaluateInfluencer(profile.id, {
      requestedByUserId: actor.id,
      clock: opts?.clock,
    });
    const { evaluation } = evalResult;

    // 6. Active Pricing Config Version
    const { version: configVersion } = await PricingConfigService.getActivePricingConfig();

    // 7. Query Last 12 Metric Snapshots
    const rawSnapshots = await prisma.creatorMetricSnapshot.findMany({
      where: { influencerId: profile.id },
      orderBy: { capturedAt: "desc" },
      take: 12,
    });

    // Format snapshots for display with estimated indicator (~)
    const snapshots: SnapshotReportRow[] = rawSnapshots.map((s, idx) => {
      const isVerified = s.viewsQuality === MetricViewsQuality.API;
      const isEstimated = !isVerified;
      const dataQuality: "VERIFIED" | "ESTIMATED" = isVerified ? "VERIFIED" : "ESTIMATED";
      const avgViews = s.avgViews ?? 0;
      const engagementBps = s.engagementRateBps ?? 0;
      const snapshotTier = resolveFollowerTier(s.followers, DEFAULT_FAIR_PRICE_CONFIG);

      return {
        id: s.id,
        weekIndex: idx + 1,
        dateStr: format(s.capturedAt, "dd MMM yyyy"),
        platform: s.platform,
        followers: s.followers,
        followersFormatted: s.followers.toLocaleString("en-IN"),
        avgViews,
        avgViewsFormatted: isVerified
          ? avgViews.toLocaleString("en-IN")
          : `~${avgViews.toLocaleString("en-IN")} (est.)`,
        engagementRatePercent: `${(engagementBps / 100).toFixed(2)}%`,
        dataQuality,
        isEstimated,
        tier: snapshotTier.toUpperCase(),
      };
    });

    // 8. Compute Strict Data Quality Statistics
    const totalDataPoints = snapshots.length + 1; // snapshots + valuation views basis
    const verifiedDataPoints =
      snapshots.filter((s) => s.dataQuality === "VERIFIED").length +
      (evaluation.dataQuality === "VERIFIED" ? 1 : 0);
    const verifiedPercent =
      totalDataPoints > 0 ? Math.round((verifiedDataPoints / totalDataPoints) * 100) : 0;
    const estimatedPercent = 100 - verifiedPercent;

    const dataQualitySummary = {
      verifiedPercent,
      estimatedPercent,
      selfReportedPercent: 0,
      text: `Data quality: ${verifiedPercent}% verified, ${estimatedPercent}% estimated, 0% self-reported`,
    };

    // 9. Format Explanation Steps with INR
    const formattedExplanation = evaluation.explanation.map((item) => ({
      step: item.step,
      description: item.description,
      multiplier: item.multiplier,
      contributionPaise: item.contributionPaise,
      runningTotalPaise: item.runningTotalPaise,
      runningTotalRupees: paiseToRupees(item.runningTotalPaise),
    }));

    // 10. Construct Canonical Report Metadata
    const scopeIdentifier =
      profile.instagramHandle ? `@${profile.instagramHandle}` : profile.displayName || profile.id;

    const reportMeta = buildReportMeta({
      type: "RANGE",
      scope: scopeIdentifier,
      period: "Past 12 Weeks Assessment",
      user: {
        id: actor.id,
        name: actor.name || profile.displayName,
        email: actor.email || profile.user?.email || null,
        role: actor.role,
      },
      dataQualitySummary,
      versions: {
        engine: evaluation.engineVersion || "1.0.0",
        config: `v${configVersion}`,
      },
      dataSources: [
        "Instagram Graph API",
        "YouTube Analytics API",
        `VyaparMedia Valuation Engine v${evaluation.engineVersion || "1.0.0"}`,
      ],
      payload: {
        influencerId: profile.id,
        minPaise: evaluation.minPaise,
        maxPaise: evaluation.maxPaise,
        basePaise: evaluation.basePaise,
        snapshots: snapshots.map((s) => ({ id: s.id, views: s.avgViews, quality: s.dataQuality })),
      },
      now: opts?.clock,
    });

    // 11. Register Cryptographic Report Verification (if flag active)
    await ReportVerificationService.recordReport({
      id: reportMeta.reportId,
      type: "RANGE",
      userId: actor.id,
      scopeId: profile.id,
      payloadHash: reportMeta.integrityCode,
    });

    // 12. Audit Trail Logging
    if (actor.isActiveAdmin) {
      await createAuditLog({
        actorId: actor.id,
        actionType: "REPORT_EXPORT_ADMIN",
        entityType: "InfluencerProfile",
        entityId: profile.id,
        afterJSON: {
          reportId: reportMeta.reportId,
          type: "MARKET_RANGE",
          format: opts?.format || "json",
          targetInfluencerId: profile.id,
        },
      }).catch(() => {});
    } else {
      await createActivityLog({
        userId: actor.id,
        action: "REPORT_EXPORT",
        entityType: "InfluencerProfile",
        entityId: profile.id,
        metadata: {
          type: "MARKET_RANGE",
          reportId: reportMeta.reportId,
          format: opts?.format || "json",
        },
      }).catch(() => {});
    }

    const disclaimer =
      "Estimated figures are indicative benchmark ranges derived from statistical models and historical platform deliveries. This report does not guarantee deal closure, impressions, or conversions, and does not constitute financial, legal, or tax advice.";

    const primaryPlatform =
      (profile.instagramFollowers || 0) >= (profile.youtubeSubscribers || 0)
        ? "INSTAGRAM"
        : "YOUTUBE";
    const drsSnapshot = await prisma.drsScoreSnapshot.findFirst({
      where: { userId: profile.userId },
      orderBy: { createdAt: "desc" },
      select: { finalScore: true },
    });
    const drsScore = drsSnapshot?.finalScore ?? profile.user?.trustScore ?? 600;

    return {
      creator: {
        id: profile.id,
        userId: profile.userId,
        displayName: profile.displayName || "Creator",
        instagramHandle: profile.instagramHandle,
        youtubeHandle: profile.youtubeHandle,
        categories: categories.length > 0 ? categories : ["General"],
        primaryPlatform,
        followers,
        followerTier,
        authenticityScore: profile.followerAuthenticityScore ?? null,
        drsScore,
      },
      marketRange: {
        minPaise: evaluation.minPaise,
        maxPaise: evaluation.maxPaise,
        basePaise: evaluation.basePaise,
        minRupees: paiseToRupees(evaluation.minPaise),
        maxRupees: paiseToRupees(evaluation.maxPaise),
        baseRupees: paiseToRupees(evaluation.basePaise),
        confidence: evaluation.confidence,
        dataQuality: evaluation.dataQuality,
        flags: evaluation.flags,
        explanation: formattedExplanation,
        engineVersion: evaluation.engineVersion,
        configVersion,
      },
      snapshots,
      dataQualitySummary,
      reportMeta,
      disclaimer,
    };
  }

  /**
   * Generates formula-injection-safe, branded CSV export following Report Standard.
   */
  public static generateCsv(reportData: MarketRangeReportData): {
    csv: string;
    filename: string;
  } {
    const { creator, marketRange, snapshots, dataQualitySummary, reportMeta, disclaimer } =
      reportData;

    const columns = [
      { key: "weekIndex", label: "Week #" },
      { key: "dateStr", label: "Captured Date (IST)" },
      { key: "platform", label: "Platform" },
      { key: "followers", label: "Followers / Subscribers" },
      { key: "avgViewsFormatted", label: "Average Views" },
      { key: "engagementRatePercent", label: "Engagement Rate" },
      { key: "dataQuality", label: "Data Quality" },
    ];

    const rows = snapshots.map((s) => ({
      weekIndex: s.weekIndex,
      dateStr: s.dateStr,
      platform: s.platform,
      followers: s.followers,
      avgViewsFormatted: s.avgViewsFormatted,
      engagementRatePercent: s.engagementRatePercent,
      dataQuality: s.dataQuality,
    }));

    const customSections = [
      {
        title: "CREATOR PROFILE & ATTRIBUTES",
        rows: [
          ["Creator Display Name", creator.displayName],
          ["Instagram Handle", creator.instagramHandle ? `@${creator.instagramHandle}` : "Not Linked"],
          ["YouTube Handle", creator.youtubeHandle ? `@${creator.youtubeHandle}` : "Not Linked"],
          ["Categories", creator.categories.join(", ")],
          ["Audience Follower Tier", creator.followerTier.toUpperCase()],
          ["Audience Authenticity Score", `${creator.authenticityScore}/100`],
          ["Platform DRS Reputation Score", `${creator.drsScore}/900`],
        ] as Array<[string, string | number]>,
      },
      {
        title: "ESTIMATED MARKET RANGE VALUATION",
        rows: [
          ["Estimated Market Range (INR)", `INR ${marketRange.minRupees} – INR ${marketRange.maxRupees}`],
          ["Valuation Midpoint (INR)", `INR ${marketRange.baseRupees}`],
          ["Engine Confidence", marketRange.confidence],
          ["Overall Data Quality", marketRange.dataQuality],
          ["Engine Version", marketRange.engineVersion],
          ["Configuration Version", `v${marketRange.configVersion}`],
        ] as Array<[string, string | number]>,
      },
      {
        title: "VALUATION WATERFALL BREAKDOWN",
        rows: marketRange.explanation.map((e) => [
          `${e.step}: ${e.description}`,
          `Running Total: INR ${e.runningTotalRupees}`,
        ]) as Array<[string, string | number]>,
      },
      {
        title: "DATA QUALITY AUDIT & LEGEND",
        rows: [
          ["Quality Summary", dataQualitySummary.text],
          ["Verified (API Measured)", `${dataQualitySummary.verifiedPercent}% (Instagram Graph / YouTube API)`],
          ["Estimated (Algorithmic)", `${dataQualitySummary.estimatedPercent}% (Reach-rate bands / heuristic)`],
          ["Self-Reported", "0% (No self-reported views permitted in valuation)"],
          ["Footnote", "Values marked with ~ or (est.) are derived estimates and should not be treated as directly measured delivery."],
        ] as Array<[string, string | number]>,
      },
      {
        title: "STATUTORY & ADVISORY DISCLAIMER",
        rows: [["Notice", disclaimer]] as Array<[string, string | number]>,
      },
    ];

    const csv = buildBrandedCsv({
      meta: reportMeta,
      columns,
      rows,
      customSections,
    });

    const scopeName = creator.instagramHandle || creator.displayName || "Creator";
    const filename = buildReportFilename("MarketRange", scopeName);

    return { csv, filename };
  }
}
