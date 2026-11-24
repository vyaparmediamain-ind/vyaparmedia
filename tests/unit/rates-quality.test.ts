import { describe, it, expect, vi } from "vitest";
import {
  buildInstagramViews,
  buildInstagramShares,
  buildInstagramSaves,
  buildInstagramClicks,
  buildYouTubeViews,
  buildYouTubeLikes,
  buildYouTubeShares,
  buildYouTubeSaves,
  buildYouTubeClicks,
  estimateMetrics,
  type SnapshotMetricsQuality,
} from "@/lib/engagement-tracker";
import { rankBestCreatorsByRoi } from "@/lib/brand-analytics-calc";

describe("Rates Quality & Nullable ER Propagation", () => {
  it("marks Instagram views, shares, and saves as DERIVED, clicks as UNAVAILABLE", () => {
    const views = buildInstagramViews(100, 20);
    expect(views.quality).toBe("DERIVED");
    expect(views.value).toBe(600);

    const shares = buildInstagramShares(100);
    expect(shares.quality).toBe("DERIVED");

    const saves = buildInstagramSaves(100);
    expect(saves.quality).toBe("DERIVED");

    const clicks = buildInstagramClicks();
    expect(clicks.quality).toBe("UNAVAILABLE");
    expect(clicks.value).toBe(0);
  });

  it("marks YouTube views and likes as API, shares as DERIVED, saves and clicks as UNAVAILABLE", () => {
    const views = buildYouTubeViews(5000);
    expect(views.quality).toBe("API");
    expect(views.value).toBe(5000);

    const likes = buildYouTubeLikes(250);
    expect(likes.quality).toBe("API");

    const shares = buildYouTubeShares(250);
    expect(shares.quality).toBe("DERIVED");

    const saves = buildYouTubeSaves();
    expect(saves.quality).toBe("UNAVAILABLE");

    const clicks = buildYouTubeClicks();
    expect(clicks.quality).toBe("UNAVAILABLE");
  });

  it("estimateMetrics returns ratesQuality with DERIVED ER and UNAVAILABLE CTR", () => {
    const estimated = estimateMetrics(50000, 3.5, "24h");
    expect(estimated.metricsQuality).toBeDefined();
    expect(estimated.metricsQuality?.ratesQuality).toEqual({
      engagementRate: "DERIVED",
      clickThroughRate: "UNAVAILABLE",
    });
    expect(estimated.views).toBeGreaterThan(0);
    expect(estimated.engagementRate).toBeGreaterThan(0);
  });

  it("handles nullable engagementRateBps cleanly without inserting magic 300 bps", () => {
    const deals = [
      {
        dealId: "d1",
        campaignId: "c1",
        campaignTitle: "Campaign Alpha",
        creatorId: "cr1",
        creatorName: "Creator One",
        amountPaise: 500000,
        deliveredViews: 10000,
        isVerifiedViews: true,
        engagementRateBps: null, // missing engagement rate
      },
    ];

    const campaigns = [
      {
        id: "c1",
        title: "Campaign Alpha",
        status: "ACTIVE",
        category: "lifestyle",
        budgetPaise: 1000000,
        spendPaise: 500000,
        deliveredViews: 10000,
        verifiedViews: 10000,
        estimatedViews: 0,
        baselineCpvPaise: 35,
      },
    ];

    const creators = rankBestCreatorsByRoi(deals, 35);
    expect(creators).toHaveLength(1);
    const firstCreator = creators[0];
    expect(firstCreator).toBeDefined();
    if (!firstCreator) throw new Error("Expected at least one creator");
    // Since engagementRateBps was null, totalEngagementBps was not incremented with 300!
    // The creator's engagementPts is computed without fabricating 300 bps.
    expect(firstCreator.creatorId).toBe("cr1");
    expect(firstCreator.roiScore).toBeGreaterThanOrEqual(10);
  });

  it("fair-price engine does NOT flag LOW_ENGAGEMENT or fabricate penalty when ER is unmeasured (undefined)", async () => {
    const { calculateFairPrice } = await import("@/lib/fair-price-engine");
    const output = calculateFairPrice({
      platform: "INSTAGRAM",
      contentType: "REEL",
      followers: 50000,
      categoryBaselineCpvPaise: 35,
      deliverables: { count: 1 },
      dataQuality: "ESTIMATED",
    });

    expect(output.flags).not.toContain("LOW_ENGAGEMENT");
    expect(output.flags).not.toContain("LOW_AUTHENTICITY");
    expect(output.minPaise).toBeGreaterThan(0);
    expect(output.maxPaise).toBeGreaterThan(output.minPaise);
  });
});
