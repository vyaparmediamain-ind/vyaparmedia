/**
 * Dashboard Analytics Extensions & Domain Logic Unit Tests
 *
 * Verifies the extended analytics for:
 * 1. Creator (DRS trend with plain-language drivers, MarketRangeCard summary, delivery rate)
 * 2. Brand (spend vs delivered views, CPV vs baseline per campaign, best creators by ROI, repeat creators, alerts)
 * 3. Admin (GMV verified, actual resolved revenue, funnel drop-offs, data-quality share, cron health, report-config completeness)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  computeDrsTrend,
  getDrsTriggerLabel,
  type DrsSnapshotItem,
} from "@/lib/drs-analytics";
import {
  calculateCampaignCpv,
  rankBestCreatorsByRoi,
  calculateRepeatCreators,
  generateBrandOperationalAlerts,
  type BrandCampaignMetricInput,
  type BrandDealCreatorInput,
} from "@/lib/brand-analytics-calc";
import {
  calculateResolvedRevenue,
  calculateFunnelDropOffs,
  calculateDataQualityShare,
  evaluateCronHealth,
  evaluateReportConfigCompleteness,
} from "@/lib/admin-analytics-calc";
import { CronRunService } from "@/services/cron-run.service";
import prisma from "@/lib/db";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe("1. Creator DRS Analytics & Plain-Language Drivers Engine", () => {
  it("handles empty snapshots by returning fallback baseline and onboarding driver", () => {
    const trend = computeDrsTrend([], 650, "SILVER");
    expect(trend.currentScore).toBe(650);
    expect(trend.previousScore).toBe(650);
    expect(trend.netChange).toBe(0);
    expect(trend.direction).toBe("STABLE");
    expect(trend.tier).toBe("SILVER");
    expect(trend.dataQuality).toBe("VERIFIED");
    expect(trend.drivers).toHaveLength(1);
    expect(trend.drivers[0]?.trigger).toBe("ONBOARDING");
  });

  it("calculates score trajectory, net change, and directions accurately from snapshots", () => {
    const date1 = new Date("2026-11-01T10:00:00Z");
    const date2 = new Date("2026-11-08T10:00:00Z");
    const date3 = new Date("2026-11-15T10:00:00Z");

    const snapshots: DrsSnapshotItem[] = [
      {
        id: "snap_3",
        previousScore: 720,
        calculatedScore: 760,
        finalScore: 750,
        trigger: "DEAL_COMPLETED",
        tier: "GOLD",
        createdAt: date3,
      },
      {
        id: "snap_1",
        previousScore: 650,
        calculatedScore: 680,
        finalScore: 680,
        trigger: "IDENTITY_VERIFIED",
        tier: "SILVER",
        createdAt: date1,
      },
      {
        id: "snap_2",
        previousScore: 680,
        calculatedScore: 720,
        finalScore: 720,
        trigger: "POSITIVE_REVIEW",
        tier: "SILVER",
        createdAt: date2,
      },
    ];

    const trend = computeDrsTrend(snapshots);
    expect(trend.currentScore).toBe(750);
    expect(trend.previousScore).toBe(720);
    expect(trend.netChange).toBe(30);
    expect(trend.direction).toBe("UP");
    expect(trend.tier).toBe("GOLD");
    expect(trend.dataQuality).toBe("VERIFIED");
    expect(trend.history).toHaveLength(3);
    // History should be chronological
    expect(trend.history[0]?.score).toBe(680);
    expect(trend.history[2]?.score).toBe(750);
  });

  it("maps internal trigger codes to clear, reassuring plain-language explanations", () => {
    expect(getDrsTriggerLabel("DEAL_COMPLETED", 15)).toBe("Completed deal deliverables on time");
    expect(getDrsTriggerLabel("POSITIVE_REVIEW", 10)).toBe("Received high brand satisfaction rating");
    expect(getDrsTriggerLabel("DISPUTE_OPENED", -20)).toBe("Active dispute recorded on deal");
    expect(getDrsTriggerLabel("IDENTITY_VERIFIED", 25)).toBe("Government ID & PAN tax verification verified");
    expect(getDrsTriggerLabel("INSTAGRAM_CONNECTED", 15)).toBe("Verified Instagram professional account connected");
    expect(getDrsTriggerLabel("INACTIVITY_DECAY", -10)).toBe("Score decayed due to 60+ days platform inactivity");
  });
});

describe("2. Brand Analytics Calculations Engine", () => {
  it("calculates campaign CPV and benchmark variance in basis points and percent", () => {
    const campaignSavings: BrandCampaignMetricInput = {
      id: "camp_savings",
      title: "Diwali Fest",
      status: "ACTIVE",
      category: "fashion",
      budgetPaise: 1000000,
      spendPaise: 500000, // ₹5,000
      deliveredViews: 20000, // 20,000 views -> ₹0.25 CPV (25 paise)
      verifiedViews: 18000,
      estimatedViews: 2000,
      baselineCpvPaise: 35, // 35 paise baseline
    };

    const res = calculateCampaignCpv(campaignSavings);
    expect(res.actualCpvPaise).toBe(25);
    expect(res.baselineCpvPaise).toBe(35);
    // (25 - 35) / 35 = -28.57% -> -2857 bps
    expect(res.varianceBps).toBe(-2857);
    expect(res.variancePercent).toBe(-29);
    expect(res.status).toBe("SAVINGS");
    expect(res.dataQuality).toBe("VERIFIED");
  });

  it("detects CPV premium when actual cost per view exceeds baseline by > 5%", () => {
    const campaignPremium: BrandCampaignMetricInput = {
      id: "camp_prem",
      title: "Niche Tech Launch",
      status: "ACTIVE",
      category: "tech",
      budgetPaise: 2000000,
      spendPaise: 1000000, // ₹10,000
      deliveredViews: 10000, // 10,000 views -> ₹1.00 CPV (100 paise)
      verifiedViews: 2000,
      estimatedViews: 8000,
      baselineCpvPaise: 50, // 50 paise baseline
    };

    const res = calculateCampaignCpv(campaignPremium);
    expect(res.actualCpvPaise).toBe(100);
    expect(res.variancePercent).toBe(100); // 100% higher
    expect(res.status).toBe("PREMIUM");
    expect(res.dataQuality).toBe("ESTIMATED");
  });

  it("ranks creators by composite ROI score", () => {
    const deals: BrandDealCreatorInput[] = [
      {
        dealId: "d1",
        campaignId: "c1",
        campaignTitle: "Campaign A",
        creatorId: "cr_1",
        creatorName: "Aarav Sharma",
        creatorHandle: "@aarav_vlogs",
        amountPaise: 200000,
        deliveredViews: 10000, // 20 paise CPV (efficient)
        isVerifiedViews: true,
        engagementRateBps: 550, // 5.5% engagement
      },
      {
        dealId: "d2",
        campaignId: "c1",
        campaignTitle: "Campaign A",
        creatorId: "cr_2",
        creatorName: "Pooja Patel",
        creatorHandle: "@pooja_fashion",
        amountPaise: 400000,
        deliveredViews: 4000, // 100 paise CPV (expensive)
        isVerifiedViews: false,
        engagementRateBps: 200, // 2.0% engagement
      },
    ];

    const ranked = rankBestCreatorsByRoi(deals, 35);
    expect(ranked).toHaveLength(2);
    expect(ranked[0]?.creatorId).toBe("cr_1");
    expect(ranked[0]?.rank).toBe(1);
    expect(ranked[0]?.roiScore).toBeGreaterThan(ranked[1]?.roiScore ?? 0);
    expect(ranked[0]?.dataQuality).toBe("VERIFIED");
  });

  it("computes repeat creators collaboration rate and loyalty counts", () => {
    const deals: BrandDealCreatorInput[] = [
      {
        dealId: "d1",
        campaignId: "c1",
        campaignTitle: "Camp 1",
        creatorId: "cr_repeat",
        creatorName: "Rahul",
        amountPaise: 100000,
        deliveredViews: 3000,
        isVerifiedViews: true,
      },
      {
        dealId: "d2",
        campaignId: "c2",
        campaignTitle: "Camp 2",
        creatorId: "cr_repeat",
        creatorName: "Rahul",
        amountPaise: 150000,
        deliveredViews: 4500,
        isVerifiedViews: true,
      },
      {
        dealId: "d3",
        campaignId: "c1",
        campaignTitle: "Camp 1",
        creatorId: "cr_single",
        creatorName: "Sneha",
        amountPaise: 120000,
        deliveredViews: 3500,
        isVerifiedViews: true,
      },
    ];

    const repeatSummary = calculateRepeatCreators(deals);
    expect(repeatSummary.totalUniqueCreators).toBe(2);
    expect(repeatSummary.repeatCreatorsCount).toBe(1);
    expect(repeatSummary.repeatRateBps).toBe(5000); // 50.00%
    expect(repeatSummary.repeatRatePercent).toBe(50);
    expect(repeatSummary.repeatCreators[0]?.creatorId).toBe("cr_repeat");
    expect(repeatSummary.repeatCreators[0]?.dealsCount).toBe(2);
    expect(repeatSummary.repeatCreators[0]?.totalSpendPaise).toBe(250000);
  });

  it("generates operational alerts for pending reviews, budget exhaustion, and CPV premiums", () => {
    const campaigns: BrandCampaignMetricInput[] = [
      {
        id: "c_exhausted",
        title: "Summer Promo",
        status: "ACTIVE",
        category: "beauty",
        budgetPaise: 1000000,
        spendPaise: 950000, // 95% spend
        deliveredViews: 20000,
        verifiedViews: 20000,
        estimatedViews: 0,
        baselineCpvPaise: 35,
        activeDealsCount: 0,
      },
    ];

    const alerts = generateBrandOperationalAlerts(campaigns, 3, new Date());
    expect(alerts.length).toBeGreaterThanOrEqual(2);
    expect(alerts.some((a) => a.type === "APPROVAL_PENDING")).toBe(true);
    expect(alerts.some((a) => a.type === "BUDGET_EXHAUSTION")).toBe(true);
  });
});

describe("3. Admin Platform Analytics & Reliability Engine", () => {
  it("calculates resolved revenue strictly from completed deals and isolates booked escrow fees", () => {
    const res = calculateResolvedRevenue(2500000, 1000000, 30000);
    expect(res.actualResolvedFeePaise).toBe(2500000);
    expect(res.bookedEscrowFeePaise).toBe(1000000);
    expect(res.netResolvedPlatformRevenuePaise).toBe(2470000);
    expect(res.dataQuality).toBe("VERIFIED");
  });

  it("calculates 5-stage conversion funnel and drop-off percentages", () => {
    const funnel = calculateFunnelDropOffs({
      briefViews: 1000,
      applications: 200,
      dealsEscrowed: 50,
      contentApproved: 45,
      dealsCompleted: 40,
    });

    expect(funnel).toHaveLength(5);
    expect(funnel[0]?.stage).toBe("Brief Views");
    expect(funnel[0]?.count).toBe(1000);
    expect(funnel[0]?.conversionPercent).toBe(100);
    expect(funnel[0]?.dropOffPercent).toBe(0);

    expect(funnel[1]?.stage).toBe("Applications");
    expect(funnel[1]?.conversionPercent).toBe(20); // 200/1000
    expect(funnel[1]?.dropOffPercent).toBe(80);

    expect(funnel[2]?.stage).toBe("Deals Escrowed");
    expect(funnel[2]?.conversionPercent).toBe(25); // 50/200
    expect(funnel[2]?.dropOffPercent).toBe(75);
  });

  it("calculates platform data-quality share across verified vs estimated points", () => {
    const dq = calculateDataQualityShare({
      verified: 8000,
      estimated: 1500,
      selfReported: 500,
    });

    expect(dq.totalDataPoints).toBe(10000);
    expect(dq.verifiedShareBps).toBe(8000);
    expect(dq.verifiedPercent).toBe(80);
    expect(dq.estimatedShareBps).toBe(1500);
    expect(dq.estimatedPercent).toBe(15);
    expect(dq.selfReportedPercent).toBe(5);
  });

  it("evaluates background cron health and detects failing jobs", () => {
    const cronDefs = [
      { id: "c1", name: "Reconcile Payouts", path: "/api/cron/reconcile-payouts", cron: "*/30 * * * *" },
      { id: "c2", name: "Creator Metrics", path: "/api/cron/creator-metrics", cron: "0 6 * * *" },
    ];

    const runsMap = new Map<string, { status: string; completedAt: Date; durationMs: number }>();
    runsMap.set("c1", { status: "SUCCESS", completedAt: new Date(), durationMs: 450 });
    runsMap.set("c2", { status: "FAILED", completedAt: new Date(), durationMs: 1200 });

    const evaluation = evaluateCronHealth(cronDefs, runsMap, new Date());
    expect(evaluation.overallStatus).toBe("DEGRADED");
    expect(evaluation.failingJobsCount).toBe(1);
    expect(evaluation.jobs[0]?.status).toBe("HEALTHY");
    expect(evaluation.jobs[1]?.status).toBe("CRITICAL");
  });

  it("audits report configuration completeness against mandatory statutory keys", () => {
    const configIncomplete = {
      legalName: "VyaparMedia Private Limited",
      brandName: "VyaparMedia",
      address: "DLF Cyber City, Gurugram, HR 122002",
      gstin: "07AAAAA0000A1Z5",
      pan: "AAAAA0000A",
      supportEmail: "support@vyaparmedia.in",
      // grievanceEmail missing
      // authorizedSignatory missing
    };

    const audit = evaluateReportConfigCompleteness(configIncomplete);
    expect(audit.isReady).toBe(true); // critical keys present
    expect(audit.completenessPercent).toBeGreaterThanOrEqual(70);
    expect(audit.configuredCount).toBe(5);
    expect(audit.totalRequired).toBe(7);
  });

  it("records CronRun heartbeat without throwing", async () => {
    const createSpy = vi.spyOn(prisma.cronRun, "create").mockResolvedValue({
      id: "run_test_123",
      jobName: "test-cron",
      path: "/api/cron/test",
      status: "SUCCESS",
      durationMs: 250,
      recordsProcessed: 10,
      error: null,
      startedAt: new Date(),
      completedAt: new Date(),
    } as any);

    await CronRunService.recordRun({
      jobName: "test-cron",
      path: "/api/cron/test",
      status: "SUCCESS",
      durationMs: 250,
      recordsProcessed: 10,
    });

    expect(createSpy).toHaveBeenCalledWith({
      data: expect.objectContaining({
        jobName: "test-cron",
        path: "/api/cron/test",
        status: "SUCCESS",
        durationMs: 250,
      }),
    });
  });
});
