import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/lib/db";
import {
  captureEngagement,
  buildInstagramViews,
  buildInstagramShares,
  buildInstagramSaves,
  buildInstagramClicks,
  buildInstagramReach,
  buildYouTubeViews,
  buildYouTubeLikes,
  buildYouTubeComments,
  buildYouTubeShares,
  buildYouTubeSaves,
  buildYouTubeClicks,
  buildYouTubeReach,
  estimateMetrics,
} from "@/lib/engagement-tracker";
import { MatchingService, invalidateCategoryBenchmarkMemoryCache } from "@/services/matching.service";
import { runEngagementQualityBackfill } from "../../scripts/backfill-engagement-quality";
import * as instagramModule from "@/lib/instagram";
import * as youtubeModule from "@/lib/youtube";

// Mock Sentry, logger, redis
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/lib/redis", () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    mget: vi.fn().mockResolvedValue([]),
    setex: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
  },
}));

vi.mock("@/lib/instagram", () => ({
  getFreshInstagramAccessToken: vi.fn().mockResolvedValue("mock-ig-access-token"),
  findPostByUrl: vi.fn(),
  getMediaInsights: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/youtube", () => ({
  verifyYouTubeVideoIsLive: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  default: {
    deal: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    engagementSnapshot: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    trustRuleConfig: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

describe("Engagement Data Quality & Baseline Exclusion (P01 Requirements)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateCategoryBenchmarkMemoryCache();
  });

  describe("1. Pure Metric Builders & Field-Level Quality", () => {
    it("Instagram metric builders: views, shares, saves, reach are DERIVED; clicks is UNAVAILABLE", () => {
      const views = buildInstagramViews(500, 50);
      expect(views.value).toBe(3000); // max(500*6, 550)
      expect(views.quality).toBe("DERIVED");

      const shares = buildInstagramShares(500);
      expect(shares.value).toBe(25);
      expect(shares.quality).toBe("DERIVED");

      const saves = buildInstagramSaves(500);
      expect(saves.value).toBe(40);
      expect(saves.quality).toBe("DERIVED");

      const clicks = buildInstagramClicks();
      expect(clicks.value).toBe(0);
      expect(clicks.quality).toBe("UNAVAILABLE");

      const reach = buildInstagramReach(500);
      expect(reach.value).toBe(2000);
      expect(reach.quality).toBe("DERIVED");
    });

    it("YouTube metric builders: views, likes, comments are API; shares, reach DERIVED; saves, clicks UNAVAILABLE", () => {
      const views = buildYouTubeViews(12000);
      expect(views.value).toBe(12000);
      expect(views.quality).toBe("API");

      const likes = buildYouTubeLikes(600);
      expect(likes.value).toBe(600);
      expect(likes.quality).toBe("API");

      const comments = buildYouTubeComments(80);
      expect(comments.value).toBe(80);
      expect(comments.quality).toBe("API");

      const shares = buildYouTubeShares(600);
      expect(shares.value).toBe(60);
      expect(shares.quality).toBe("DERIVED");

      const saves = buildYouTubeSaves();
      expect(saves.value).toBe(0);
      expect(saves.quality).toBe("UNAVAILABLE");

      const clicks = buildYouTubeClicks();
      expect(clicks.value).toBe(0);
      expect(clicks.quality).toBe("UNAVAILABLE");

      const reach = buildYouTubeReach(12000);
      expect(reach.value).toBe(9600);
      expect(reach.quality).toBe("DERIVED");
    });

    it("Fallback estimateMetrics: marks all engagement metrics DERIVED and clicks UNAVAILABLE", () => {
      const estimated = estimateMetrics(10000, 2.5, "24h");
      expect(estimated.metricsQuality).toEqual({
        views: "DERIVED",
        likes: "DERIVED",
        comments: "DERIVED",
        shares: "DERIVED",
        saves: "DERIVED",
        clicks: "UNAVAILABLE",
        reach: "DERIVED",
      });
      expect(estimated.clicks).toBe(0);
      expect(estimated.views).toBeGreaterThan(0);
    });
  });

  describe("2. Instagram Engagement Capture Quality", () => {
    it("must mark isEstimated=true and record per-field metricsQuality with DERIVED views", async () => {
      const mockDeal = {
        id: "deal-ig-001",
        postUrl: "https://www.instagram.com/p/C_abc1234/",
        influencer: {
          userId: "user-ig-001",
          instagramFollowers: 50000,
          instagramEngagementRate: 250,
          instagramHandle: "creator_test",
          youtubeHandle: null,
          youtubeSubscribers: 0,
          youtubeEngagementRate: 0,
        },
        campaign: { deliverables: ["INSTAGRAM_REEL"] },
      };

      vi.mocked(prisma.deal.findUnique).mockResolvedValue(mockDeal as never);
      vi.mocked(prisma.engagementSnapshot.findUnique).mockResolvedValue(null);
      vi.mocked(instagramModule.findPostByUrl).mockResolvedValue({
        id: "post-123",
        likeCount: 1000,
        commentsCount: 100,
        permalink: mockDeal.postUrl,
      } as never);

      await captureEngagement("deal-ig-001", "24h");

      expect(prisma.engagementSnapshot.create).toHaveBeenCalledTimes(1);
      const createCall = vi.mocked(prisma.engagementSnapshot.create).mock.calls[0]![0];
      const snapshotData = createCall.data as Record<string, unknown>;

      expect(snapshotData.isEstimated).toBe(true);
      expect(snapshotData.metricsQuality).toBeDefined();
      const quality = snapshotData.metricsQuality as Record<string, string>;
      expect(quality.views).toBe("DERIVED");
      expect(quality.likes).toBe("API");
      expect(quality.comments).toBe("API");
      expect(quality.shares).toBe("DERIVED");
      expect(quality.saves).toBe("DERIVED");
      expect(quality.clicks).toBe("UNAVAILABLE");
      expect(quality.reach).toBe("DERIVED");
      expect(snapshotData.clicks).toBe(0);
    });

    it("must mark views as API-sourced and isEstimated=false when Instagram media insights return views", async () => {
      const mockDeal = {
        id: "deal-ig-insights-001",
        postUrl: "https://www.instagram.com/p/verified_post_123/",
        influencer: {
          userId: "user-ig-insights-001",
          instagramFollowers: 50000,
          instagramEngagementRate: 250,
          instagramHandle: "creator_insights",
          youtubeHandle: null,
          youtubeSubscribers: 0,
          youtubeEngagementRate: 0,
        },
        campaign: { deliverables: ["INSTAGRAM_POST"] },
      };

      vi.mocked(prisma.deal.findUnique).mockResolvedValue(mockDeal as never);
      vi.mocked(prisma.engagementSnapshot.findUnique).mockResolvedValue(null);
      vi.mocked(instagramModule.findPostByUrl).mockResolvedValue({
        id: "media_insights_123",
        mediaType: "IMAGE",
        mediaProductType: "FEED",
        mediaUrl: "https://cdn.instagram.com/p1.jpg",
        permalink: "https://www.instagram.com/p/verified_post_123/",
        caption: "Sponsored post #ad",
        timestamp: new Date().toISOString(),
        likeCount: 1200,
        commentsCount: 95,
        isLive: true,
      });

      vi.mocked(instagramModule.getMediaInsights).mockResolvedValue({
        status: "OK",
        values: {
          views: 18500,
          reach: 14200,
          likes: 1200,
          comments: 95,
          shares: 80,
          saved: 150,
          totalInteractions: 1525,
        },
        quality: "API",
        views: 18500,
        reach: 14200,
        likes: 1200,
        comments: 95,
        shares: 80,
        saved: 150,
        totalInteractions: 1525,
      });

      await captureEngagement("deal-ig-insights-001", "24h");

      expect(prisma.engagementSnapshot.create).toHaveBeenCalled();
      const lastCall = vi.mocked(prisma.engagementSnapshot.create).mock.calls.at(-1)![0];
      const snapshotData = lastCall.data as Record<string, unknown>;

      expect(snapshotData.isEstimated).toBe(false);
      expect(snapshotData.views).toBe(18500);
      expect(snapshotData.likes).toBe(1200);
      expect(snapshotData.comments).toBe(95);
      expect(snapshotData.shares).toBe(80);
      expect(snapshotData.saves).toBe(150);

      const quality = snapshotData.metricsQuality as Record<string, string>;
      expect(quality.views).toBe("API");
      expect(quality.likes).toBe("API");
      expect(quality.comments).toBe("API");
      expect(quality.shares).toBe("API");
      expect(quality.saves).toBe("API");
      expect(quality.reach).toBe("API");
      expect(quality.clicks).toBe("UNAVAILABLE");
    });
  });

  describe("3. YouTube Engagement Capture Quality", () => {
    it("must keep views as API-sourced (isEstimated=false), but mark shares and clicks appropriately", async () => {
      const mockDeal = {
        id: "deal-yt-001",
        postUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        influencer: {
          userId: "user-yt-001",
          instagramFollowers: 0,
          instagramEngagementRate: 0,
          instagramHandle: null,
          youtubeHandle: "creator_yt",
          youtubeSubscribers: 100000,
          youtubeEngagementRate: 350,
        },
        campaign: { deliverables: ["YOUTUBE_VIDEO"] },
      };

      vi.mocked(prisma.deal.findUnique).mockResolvedValue(mockDeal as never);
      vi.mocked(prisma.engagementSnapshot.findUnique).mockResolvedValue(null);
      vi.mocked(youtubeModule.verifyYouTubeVideoIsLive).mockResolvedValue({
        isLive: true,
        video: {
          videoId: "dQw4w9WgXcQ",
          title: "Test Video",
          publishedAt: new Date().toISOString(),
          viewCount: 25000,
          likeCount: 1500,
          commentCount: 200,
        },
      } as never);

      await captureEngagement("deal-yt-001", "24h");

      expect(prisma.engagementSnapshot.create).toHaveBeenCalledTimes(1);
      const createCall = vi.mocked(prisma.engagementSnapshot.create).mock.calls[0]![0];
      const snapshotData = createCall.data as Record<string, unknown>;

      expect(snapshotData.isEstimated).toBe(false);
      expect(snapshotData.views).toBe(25000);
      expect(snapshotData.likes).toBe(1500);
      expect(snapshotData.comments).toBe(200);

      expect(snapshotData.metricsQuality).toBeDefined();
      const quality = snapshotData.metricsQuality as Record<string, string>;
      expect(quality.views).toBe("API");
      expect(quality.likes).toBe("API");
      expect(quality.comments).toBe("API");
      expect(quality.shares).toBe("DERIVED");
      expect(quality.clicks).toBe("UNAVAILABLE");
      expect(snapshotData.clicks).toBe(0);
    });
  });

  describe("4. MatchingService Dynamic Category Baseline Excludes Estimated Snapshots", () => {
    it("must ignore deals that only have isEstimated=true snapshots and not classify them as DYNAMIC_30D", async () => {
      const mockEstimatedDeals = Array.from({ length: 5 }, (_, i) => ({
        amount: 500000,
        engagementSnapshots: [
          {
            views: 10000,
            isEstimated: true,
            metricsQuality: { views: "DERIVED" },
          },
        ],
      }));

      vi.mocked(prisma.deal.findMany).mockResolvedValue(mockEstimatedDeals as never);

      const baseline = await MatchingService.resolveSingleCategoryBaseline("Technology");
      expect(baseline.source).not.toBe("DYNAMIC_30D");
    });

    it("uses dynamic 30D baseline when >= 5 deals have verified API-sourced snapshots", async () => {
      const mockVerifiedDeals = Array.from({ length: 5 }, (_, i) => ({
        amount: 500000,
        engagementSnapshots: [
          {
            views: 10000,
            isEstimated: false,
            metricsQuality: { views: "API" },
          },
        ],
      }));

      vi.mocked(prisma.deal.findMany).mockResolvedValue(mockVerifiedDeals as never);

      const baseline = await MatchingService.resolveSingleCategoryBaseline("Technology");
      expect(baseline.source).toBe("DYNAMIC_30D");
      expect(baseline.baselinePaise).toBe(50);
    });
  });

  describe("5. Backfill Migration Script Idempotency", () => {
    it("backfill correctly classifies Instagram, YouTube and fallback snapshots and is idempotent", async () => {
      const mockSnapshots = [
        {
          id: "snap-1",
          views: 6000,
          likes: 1000,
          comments: 100,
          shares: 50,
          saves: 80,
          clicks: 150,
          isEstimated: false,
          metricsQuality: null,
          deal: { postUrl: "https://www.instagram.com/p/post1/" },
        },
        {
          id: "snap-2",
          views: 20000,
          likes: 1200,
          comments: 80,
          shares: 120,
          saves: 0,
          clicks: 400,
          isEstimated: false,
          metricsQuality: null,
          deal: { postUrl: "https://www.youtube.com/watch?v=vid1" },
        },
        {
          id: "snap-3",
          views: 5000,
          likes: 300,
          comments: 20,
          shares: 15,
          saves: 20,
          clicks: 0,
          isEstimated: true,
          metricsQuality: null,
          deal: { postUrl: null },
        },
      ];

      vi.mocked(prisma.engagementSnapshot.findMany).mockResolvedValue(mockSnapshots as never);

      // Pass 1: Live backfill execution
      const summary1 = await runEngagementQualityBackfill({ dryRun: false, batchSize: 10 });
      expect(summary1.totalExamined).toBe(3);
      expect(summary1.updated).toBe(3);
      expect(summary1.skipped).toBe(0);
      expect(summary1.byPlatform.instagram).toBe(1);
      expect(summary1.byPlatform.youtube).toBe(1);
      expect(summary1.byPlatform.fallback).toBe(1);
      expect(prisma.engagementSnapshot.update).toHaveBeenCalledTimes(3);

      // Simulate state after update in DB
      const updatedSnapshots = [
        {
          ...mockSnapshots[0],
          isEstimated: true,
          metricsQuality: {
            views: "DERIVED",
            likes: "API",
            comments: "API",
            shares: "DERIVED",
            saves: "DERIVED",
            clicks: "UNAVAILABLE",
            reach: "DERIVED",
          },
          clicks: 0,
        },
        {
          ...mockSnapshots[1],
          isEstimated: false,
          metricsQuality: {
            views: "API",
            likes: "API",
            comments: "API",
            shares: "DERIVED",
            saves: "UNAVAILABLE",
            clicks: "UNAVAILABLE",
            reach: "DERIVED",
          },
          clicks: 0,
        },
        {
          ...mockSnapshots[2],
          isEstimated: true,
          metricsQuality: {
            views: "DERIVED",
            likes: "DERIVED",
            comments: "DERIVED",
            shares: "DERIVED",
            saves: "DERIVED",
            clicks: "UNAVAILABLE",
            reach: "DERIVED",
          },
          clicks: 0,
        },
      ];

      vi.mocked(prisma.engagementSnapshot.findMany).mockResolvedValue(updatedSnapshots as never);
      vi.mocked(prisma.engagementSnapshot.update).mockClear();

      // Pass 2: Re-run backfill (idempotency test)
      const summary2 = await runEngagementQualityBackfill({ dryRun: false, batchSize: 10 });
      expect(summary2.totalExamined).toBe(3);
      expect(summary2.updated).toBe(0);
      expect(summary2.skipped).toBe(3);
      expect(prisma.engagementSnapshot.update).not.toHaveBeenCalled();
    });

    it("dry-run mode produces summary without making database updates", async () => {
      const mockSnapshots = [
        {
          id: "snap-ig-dry",
          views: 5000,
          likes: 800,
          comments: 40,
          shares: 40,
          saves: 60,
          clicks: 100,
          isEstimated: false,
          metricsQuality: null,
          deal: { postUrl: "https://www.instagram.com/p/dryrun/" },
        },
      ];

      vi.mocked(prisma.engagementSnapshot.findMany).mockResolvedValue(mockSnapshots as never);
      vi.mocked(prisma.engagementSnapshot.update).mockClear();

      const summary = await runEngagementQualityBackfill({ dryRun: true, batchSize: 10 });
      expect(summary.totalExamined).toBe(1);
      expect(summary.updated).toBe(1);
      expect(summary.dryRun).toBe(true);
      expect(prisma.engagementSnapshot.update).not.toHaveBeenCalled();
    });
  });
});
