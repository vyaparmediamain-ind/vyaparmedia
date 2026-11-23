import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/lib/db";
import {
  trimmedMean,
  median,
  engagementRateBps,
  detectMetricAnomalies,
  getIsoWeekBounds,
  getIsoWeekString,
  METRIC_ANOMALY_THRESHOLDS,
} from "@/lib/metric-stats";
import {
  CreatorMetricsService,
  CREATOR_METRICS_CONFIG,
} from "@/services/creator-metrics.service";
import * as youtubeModule from "@/lib/youtube";
import * as instagramModule from "@/lib/instagram";
import * as killSwitchModule from "@/lib/kill-switch";
import * as featureFlagsModule from "@/lib/feature-flags";
import { MetricPlatform, MetricViewsQuality } from "@prisma/client";

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/app/api/cron/guard", () => ({
  validateCronSecret: vi.fn(),
}));

// Mock distributed lock
vi.mock("@/lib/lock", () => ({
  acquireDistributedLock: vi.fn().mockResolvedValue("mock_lock_token"),
  releaseDistributedLock: vi.fn().mockResolvedValue(true),
}));

describe("Creator Metrics Subsystem (P11 REL-07)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(prisma.creatorMetricSnapshot, "findFirst").mockResolvedValue(null);
    vi.spyOn(prisma.creatorMetricSnapshot, "findMany").mockResolvedValue([]);
    vi.spyOn(prisma.creatorMetricSnapshot, "create").mockResolvedValue({
      id: "snap_default",
      influencerId: "inf_default",
      platform: MetricPlatform.INSTAGRAM,
      capturedAt: new Date(),
      followers: 10000,
      avgLikes: 200,
      avgComments: 10,
      avgViews: null,
      avgReach: null,
      engagementRateBps: 210,
      postsSampled: 5,
      viewsQuality: MetricViewsQuality.UNAVAILABLE,
      flagsJson: null,
    });
    vi.spyOn(prisma.creatorMetricSnapshot, "deleteMany").mockResolvedValue({ count: 0 });
  });

  // ─── 1. Stats Math Pure Functions ──────────────────────────────────────────

  describe("1. Pure Mathematical & Statistical Helpers (metric-stats.ts)", () => {
    describe("trimmedMean", () => {
      it("returns null for empty array or non-array inputs", () => {
        expect(trimmedMean([])).toBeNull();
        expect(trimmedMean(null as unknown as number[])).toBeNull();
        expect(trimmedMean(undefined as unknown as number[])).toBeNull();
      });

      it("filters out invalid, negative, or non-finite inputs", () => {
        expect(trimmedMean([-10, NaN, Infinity, -1])).toBeNull();
        expect(trimmedMean([10, -5, NaN, 20])).toBe(15);
      });

      it("returns regular rounded average for small arrays (<= 2 elements)", () => {
        expect(trimmedMean([10])).toBe(10);
        expect(trimmedMean([10, 20])).toBe(15);
        expect(trimmedMean([10, 21])).toBe(16); // Math.round(15.5) = 16
      });

      it("trims outliers from upper and lower bounds for larger sets", () => {
        // 10 elements: 10% trim = 1 element trimmed from bottom (5) and top (1000)
        // Remaining 8 items: [100, 102, 105, 108, 110, 112, 115, 120] -> sum = 872 -> mean = 109
        const values = [5, 100, 102, 105, 108, 110, 112, 115, 120, 1000];
        const result = trimmedMean(values, 0.1);
        expect(result).toBe(109);
      });

      it("clamps extreme trim ratios to preserve distribution center", () => {
        const values = [10, 20, 30, 40, 50];
        const result = trimmedMean(values, 0.9); // Should clamp to <= 0.49
        expect(result).toBeDefined();
        expect(result).toBeGreaterThanOrEqual(10);
        expect(result).toBeLessThanOrEqual(50);
      });
    });

    describe("median", () => {
      it("returns null for empty or invalid arrays", () => {
        expect(median([])).toBeNull();
        expect(median(null as unknown as number[])).toBeNull();
        expect(median([-5, NaN])).toBeNull();
      });

      it("returns exact middle element for odd-length arrays", () => {
        expect(median([7])).toBe(7);
        expect(median([30, 10, 20])).toBe(20);
        expect(median([5, 1, 9, 3, 7])).toBe(5);
      });

      it("returns rounded average of two middle elements for even-length arrays", () => {
        expect(median([10, 20])).toBe(15);
        expect(median([10, 20, 30, 40])).toBe(25);
        expect(median([10, 21])).toBe(16);
      });
    });

    describe("engagementRateBps", () => {
      it("returns 0 for zero or negative interactions or audience", () => {
        expect(engagementRateBps({ interactions: 0, audience: 10000 })).toBe(0);
        expect(engagementRateBps({ interactions: -50, audience: 10000 })).toBe(0);
        expect(engagementRateBps({ interactions: 500, audience: 0 })).toBe(0);
        expect(engagementRateBps({ interactions: 500, audience: -100 })).toBe(0);
        expect(engagementRateBps({ interactions: NaN, audience: 10000 })).toBe(0);
      });

      it("accurately computes basis points (1% = 100 bps) and rounds once", () => {
        // 500 interactions on 10,000 audience = 5% = 500 bps
        expect(engagementRateBps({ interactions: 500, audience: 10000 })).toBe(500);

        // 250 interactions on 10,000 audience = 2.5% = 250 bps
        expect(engagementRateBps({ interactions: 250, audience: 10000 })).toBe(250);

        // 1 interaction on 3 audience = 33.333% = 3333 bps
        expect(engagementRateBps({ interactions: 1, audience: 3 })).toBe(3333);

        // 35 interactions on 1,000 audience = 3.5% = 350 bps
        expect(engagementRateBps({ interactions: 35, audience: 1000 })).toBe(350);
      });
    });

    describe("ISO Week Date Utilities", () => {
      it("computes exact Monday 00:00:00 to Sunday 23:59:59 bounds", () => {
        // Wednesday Nov 25, 2026
        const wednesday = new Date("2026-11-25T14:30:00.000Z");
        const bounds = getIsoWeekBounds(wednesday);

        expect(bounds.start.toISOString()).toBe("2026-11-23T00:00:00.000Z"); // Monday
        expect(bounds.end.toISOString()).toBe("2026-11-29T23:59:59.999Z"); // Sunday
      });

      it("formats ISO week strings deterministically", () => {
        const d = new Date("2026-11-25T14:30:00.000Z");
        expect(getIsoWeekString(d)).toBe("2026-W48");
      });
    });
  });

  // ─── 2. Anomaly Flags Detection ────────────────────────────────────────────

  describe("2. Pure Anomaly Detection Flags (flags only, no automatic penalty)", () => {
    it("flags follower spike > 20% within 7-day rolling window", () => {
      const now = new Date("2026-11-25T10:00:00.000Z");
      const fiveDaysAgo = new Date("2026-11-20T10:00:00.000Z");

      const flags = detectMetricAnomalies({
        followers: 12500, // 25% increase from 10,000
        avgLikes: 300,
        engagementRateBps: 300,
        capturedAt: now,
        previousSnapshot: {
          followers: 10000,
          engagementRateBps: 300,
          capturedAt: fiveDaysAgo,
        },
      });

      expect(flags).toHaveLength(1);
      expect(flags[0]?.rule).toBe("FOLLOWER_SPIKE_7D");
      expect(flags[0]?.severity).toBe("MEDIUM");
      expect(flags[0]?.description).toContain("increased by 25.0%");
    });

    it("does not flag follower growth <= 20% or outside 8-day window", () => {
      const now = new Date("2026-11-25T10:00:00.000Z");
      const fiveDaysAgo = new Date("2026-11-20T10:00:00.000Z");

      // 15% growth: below 20% threshold
      const normalFlags = detectMetricAnomalies({
        followers: 11500,
        avgLikes: 300,
        capturedAt: now,
        previousSnapshot: {
          followers: 10000,
          capturedAt: fiveDaysAgo,
        },
      });
      expect(normalFlags.some((f) => f.rule === "FOLLOWER_SPIKE_7D")).toBe(false);

      // 50% growth but 30 days apart (not in 7-day window)
      const thirtyDaysAgo = new Date("2026-10-25T10:00:00.000Z");
      const olderFlags = detectMetricAnomalies({
        followers: 15000,
        avgLikes: 300,
        capturedAt: now,
        previousSnapshot: {
          followers: 10000,
          capturedAt: thirtyDaysAgo,
        },
      });
      expect(olderFlags.some((f) => f.rule === "FOLLOWER_SPIKE_7D")).toBe(false);
    });

    it("flags engagement rate collapse (>= 50% drop)", () => {
      const now = new Date("2026-11-25T10:00:00.000Z");
      const previousDate = new Date("2026-11-18T10:00:00.000Z");

      const flags = detectMetricAnomalies({
        followers: 10000,
        avgLikes: 100,
        engagementRateBps: 150, // Dropped from 400 bps (62.5% decline)
        capturedAt: now,
        previousSnapshot: {
          followers: 10000,
          engagementRateBps: 400,
          capturedAt: previousDate,
        },
      });

      const erFlag = flags.find((f) => f.rule === "ER_COLLAPSE");
      expect(erFlag).toBeDefined();
      expect(erFlag?.severity).toBe("MEDIUM");
      expect(erFlag?.description).toContain("collapsed by 62.5%");
    });

    it("flags abnormally high like-to-follower ratio (> 40%) for accounts with >= 1,000 followers", () => {
      const flags = detectMetricAnomalies({
        followers: 5000,
        avgLikes: 2500, // 50% of followers -> Bot like farms
        engagementRateBps: 5000,
      });

      const likeFlag = flags.find((f) => f.rule === "ABNORMAL_LIKES_RATIO");
      expect(likeFlag).toBeDefined();
      expect(likeFlag?.severity).toBe("HIGH");
      expect(likeFlag?.description).toContain("50.0%");
    });

    it("flags abnormally low like-to-follower ratio (< 0.05%) for accounts with >= 1,000 followers", () => {
      const flags = detectMetricAnomalies({
        followers: 100000,
        avgLikes: 20, // 0.02% of followers -> Inactive ghost audience
        engagementRateBps: 2,
      });

      const likeFlag = flags.find((f) => f.rule === "ABNORMAL_LIKES_RATIO");
      expect(likeFlag).toBeDefined();
      expect(likeFlag?.severity).toBe("LOW");
      expect(likeFlag?.description).toContain("ghost followers");
    });

    it("skips like-to-follower ratio check for small accounts (< 1,000 followers)", () => {
      const flags = detectMetricAnomalies({
        followers: 500,
        avgLikes: 300, // 60%, but account is micro/nano (<1000)
        engagementRateBps: 6000,
      });

      expect(flags.some((f) => f.rule === "ABNORMAL_LIKES_RATIO")).toBe(false);
    });
  });

  // ─── 3. Quota Exhaustion & Circuit Breakers ────────────────────────────────

  describe("3. Quota Exhaustion, Circuit Breakers & Kill Switches", () => {
    it("safely skips YouTube capture when YouTube API quota is exhausted", async () => {
      vi.spyOn(prisma.influencerProfile, "findUnique").mockResolvedValue({
        id: "inf_test_1",
        userId: "user_test_1",
        youtubeHandle: "TechTester",
        youtubeSubscribers: 50000,
        instagramHandle: null,
        instagramFollowers: null,
      } as unknown as any);

      vi.spyOn(prisma.creatorMetricSnapshot, "findMany").mockResolvedValue([]);
      vi.spyOn(killSwitchModule, "isKillSwitchActive").mockResolvedValue(false);
      vi.spyOn(youtubeModule, "getFreshYouTubeAccessToken").mockResolvedValue("mock_yt_token");

      // Quota exhausted mock
      vi.spyOn(youtubeModule, "checkAndConsumeYouTubeQuota").mockResolvedValue({
        allowed: false,
        currentUsage: 10000,
        dailyQuota: 10000,
      });

      const getRecentVideosSpy = vi.spyOn(youtubeModule, "getRecentVideos");

      const result = await CreatorMetricsService.captureForInfluencer("inf_test_1");

      expect(result.youtube?.captured).toBe(false);
      expect(result.youtube?.skippedReason).toBe("QUOTA_EXHAUSTED");
      expect(getRecentVideosSpy).not.toHaveBeenCalled();
    });

    it("skips platform capture when operational kill switch is active", async () => {
      vi.spyOn(prisma.influencerProfile, "findUnique").mockResolvedValue({
        id: "inf_test_1",
        userId: "user_test_1",
        youtubeHandle: "TechTester",
        youtubeSubscribers: 50000,
        instagramHandle: "tech_ig",
        instagramFollowers: 20000,
      } as unknown as any);

      vi.spyOn(prisma.creatorMetricSnapshot, "findMany").mockResolvedValue([]);

      // Kill switches active for both platforms
      vi.spyOn(killSwitchModule, "isKillSwitchActive").mockImplementation(async (feat) => {
        return (
          feat === killSwitchModule.KILL_SWITCH_FEATURES.SOCIAL_YOUTUBE ||
          feat === killSwitchModule.KILL_SWITCH_FEATURES.SOCIAL_INSTAGRAM
        );
      });

      const result = await CreatorMetricsService.captureForInfluencer("inf_test_1");

      expect(result.youtube?.captured).toBe(false);
      expect(result.youtube?.skippedReason).toBe("KILL_SWITCH_ACTIVE");
      expect(result.instagram?.captured).toBe(false);
      expect(result.instagram?.skippedReason).toBe("KILL_SWITCH_ACTIVE");
    });
  });

  // ─── 4. Partial API Failure & Fault Isolation ─────────────────────────────

  describe("4. Partial API Failure & Token Absence", () => {
    it("captures Instagram successfully even if YouTube fails with an API error", async () => {
      vi.spyOn(prisma.influencerProfile, "findUnique").mockResolvedValue({
        id: "inf_test_1",
        userId: "user_test_1",
        youtubeHandle: "TechTester",
        youtubeSubscribers: 50000,
        instagramHandle: "tech_ig",
        instagramFollowers: 20000,
      } as unknown as any);

      vi.spyOn(prisma.creatorMetricSnapshot, "findMany").mockResolvedValue([]);
      vi.spyOn(killSwitchModule, "isKillSwitchActive").mockResolvedValue(false);

      // YouTube token present, quota allowed, but channel throws API error
      vi.spyOn(youtubeModule, "getFreshYouTubeAccessToken").mockResolvedValue("yt_token");
      vi.spyOn(youtubeModule, "checkAndConsumeYouTubeQuota").mockResolvedValue({
        allowed: true,
        currentUsage: 100,
        dailyQuota: 10000,
      });
      vi.spyOn(youtubeModule, "getYouTubeChannelByToken").mockRejectedValue(new Error("YouTube API 500 Internal Error"));

      // Instagram token present and succeeds (with likes/comments only)
      vi.spyOn(instagramModule, "getFreshInstagramAccessToken").mockResolvedValue("ig_token");
      vi.spyOn(prisma.oAuthAccount, "findFirst").mockResolvedValue({
        scope: "instagram_business_basic",
        grantedScopes: ["instagram_business_basic"],
        accessToken: "encrypted_token",
      } as any);

      vi.spyOn(featureFlagsModule, "isFeatureEnabled").mockResolvedValue(false); // Insights flag OFF
      vi.spyOn(instagramModule, "getInstagramProfile").mockResolvedValue({
        id: "ig_user_1",
        username: "tech_ig",
        name: "Tech IG",
        biography: "",
        followersCount: 20000,
        followingCount: 100,
        mediaCount: 50,
        profilePicture: "",
        isVerified: false,
      });

      vi.spyOn(instagramModule, "getRecentPosts").mockResolvedValue([
        { id: "p1", likeCount: 400, commentsCount: 20, mediaProductType: "FEED" } as unknown as instagramModule.InstagramPost,
        { id: "p2", likeCount: 600, commentsCount: 40, mediaProductType: "FEED" } as unknown as instagramModule.InstagramPost,
      ]);

      const mockCreate = vi.spyOn(prisma.creatorMetricSnapshot, "create").mockResolvedValue({
        id: "snap_ig_1",
        influencerId: "inf_test_1",
        platform: MetricPlatform.INSTAGRAM,
        capturedAt: new Date(),
        followers: 20000,
        avgLikes: 500,
        avgComments: 30,
        avgViews: null,
        avgReach: null,
        engagementRateBps: 265,
        postsSampled: 2,
        viewsQuality: MetricViewsQuality.UNAVAILABLE,
        flagsJson: null,
      });

      const result = await CreatorMetricsService.captureForInfluencer("inf_test_1");

      // YouTube failed cleanly
      expect(result.youtube?.captured).toBe(false);
      expect(result.youtube?.skippedReason).toBe("API_ERROR");

      // Instagram succeeded independently
      expect(result.instagram?.captured).toBe(true);
      expect(result.instagram?.snapshot?.platform).toBe(MetricPlatform.INSTAGRAM);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            platform: MetricPlatform.INSTAGRAM,
            avgViews: null,
            viewsQuality: MetricViewsQuality.UNAVAILABLE, // Never invent views!
          }),
        }),
      );
    });

    it("skips platforms cleanly when creator has no token or token needs reconnect", async () => {
      vi.spyOn(prisma.influencerProfile, "findUnique").mockResolvedValue({
        id: "inf_test_1",
        userId: "user_test_1",
        youtubeHandle: null,
        youtubeSubscribers: null,
        instagramHandle: "tech_ig",
        instagramFollowers: 20000,
      } as unknown as any);

      vi.spyOn(prisma.creatorMetricSnapshot, "findMany").mockResolvedValue([]);
      vi.spyOn(killSwitchModule, "isKillSwitchActive").mockResolvedValue(false);

      // YouTube: no token
      vi.spyOn(youtubeModule, "getFreshYouTubeAccessToken").mockResolvedValue(null);

      // Instagram: token needs reconnect
      vi.spyOn(instagramModule, "getFreshInstagramAccessToken").mockResolvedValue("ig_token");
      vi.spyOn(prisma.oAuthAccount, "findFirst").mockResolvedValue({
        scope: "NEEDS_RECONNECT",
        grantedScopes: [],
        accessToken: null,
      } as any);

      const result = await CreatorMetricsService.captureForInfluencer("inf_test_1");

      expect(result.youtube?.captured).toBe(false);
      expect(result.youtube?.skippedReason).toBe("NO_HEALTHY_OAUTH_TOKEN");
      expect(result.instagram?.captured).toBe(false);
      expect(result.instagram?.skippedReason).toBe("NEEDS_RECONNECT");
    });
  });

  // ─── 5. Idempotent Weekly Capture & Instagram Insights Flag ────────────────

  describe("5. Idempotent Weekly Capture & Instagram Insights Gating", () => {
    it("skips capture if snapshot already exists in the same ISO week", async () => {
      const clock = new Date("2026-11-25T12:00:00.000Z");

      vi.spyOn(prisma.influencerProfile, "findUnique").mockResolvedValue({
        id: "inf_test_1",
        userId: "user_test_1",
        youtubeHandle: "TechTester",
        instagramHandle: "tech_ig",
      } as unknown as any);

      // Both platforms already have snapshots for this week
      vi.spyOn(prisma.creatorMetricSnapshot, "findMany").mockResolvedValue([
        { platform: MetricPlatform.YOUTUBE },
        { platform: MetricPlatform.INSTAGRAM },
      ] as any);

      const result = await CreatorMetricsService.captureForInfluencer("inf_test_1", { clock });

      expect(result.youtube?.captured).toBe(false);
      expect(result.youtube?.skippedReason).toBe("ALREADY_CAPTURED_THIS_WEEK");
      expect(result.instagram?.captured).toBe(false);
      expect(result.instagram?.skippedReason).toBe("ALREADY_CAPTURED_THIS_WEEK");
    });

    it("captures verified views when instagram_insights flag is ON and capability insights=true", async () => {
      vi.spyOn(prisma.influencerProfile, "findUnique").mockResolvedValue({
        id: "inf_test_1",
        userId: "user_test_1",
        instagramHandle: "tech_ig",
        instagramFollowers: 15000,
        youtubeHandle: null,
      } as unknown as any);

      vi.spyOn(prisma.creatorMetricSnapshot, "findMany").mockResolvedValue([]);
      vi.spyOn(killSwitchModule, "isKillSwitchActive").mockResolvedValue(false);
      vi.spyOn(youtubeModule, "getFreshYouTubeAccessToken").mockResolvedValue(null);

      vi.spyOn(instagramModule, "getFreshInstagramAccessToken").mockResolvedValue("ig_token");
      vi.spyOn(prisma.oAuthAccount, "findFirst").mockResolvedValue({
        scope: "instagram_business_basic,instagram_business_manage_insights",
        grantedScopes: ["instagram_business_basic", "instagram_business_manage_insights"],
        accessToken: "encrypted_token",
      } as any);

      // Insights flag ON
      vi.spyOn(featureFlagsModule, "isFeatureEnabled").mockResolvedValue(true);
      vi.spyOn(instagramModule, "getInstagramProfile").mockResolvedValue({
        id: "ig_user_1",
        username: "tech_ig",
        name: "Tech IG",
        biography: "",
        followersCount: 15000,
        followingCount: 100,
        mediaCount: 50,
        profilePicture: "",
        isVerified: false,
      });

      vi.spyOn(instagramModule, "getRecentPostsWithInsights").mockResolvedValue([
        {
          post: { id: "p1", likeCount: 400, commentsCount: 30, mediaProductType: "REELS" } as unknown as instagramModule.InstagramPost,
          insights: {
            status: "OK",
            values: { views: 8000, reach: 6500 },
            quality: "API",
            views: 8000,
            reach: 6500,
          },
        },
        {
          post: { id: "p2", likeCount: 500, commentsCount: 50, mediaProductType: "REELS" } as unknown as instagramModule.InstagramPost,
          insights: {
            status: "OK",
            values: { views: 12000, reach: 9500 },
            quality: "API",
            views: 12000,
            reach: 9500,
          },
        },
      ]);

      const mockCreate = vi.spyOn(prisma.creatorMetricSnapshot, "create").mockResolvedValue({
        id: "snap_ig_verified",
        influencerId: "inf_test_1",
        platform: MetricPlatform.INSTAGRAM,
        capturedAt: new Date(),
        followers: 15000,
        avgLikes: 450,
        avgComments: 40,
        avgViews: 10000,
        avgReach: 8000,
        engagementRateBps: 327,
        postsSampled: 2,
        viewsQuality: MetricViewsQuality.API,
        flagsJson: null,
      });

      const result = await CreatorMetricsService.captureForInfluencer("inf_test_1");

      expect(result.instagram?.captured).toBe(true);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            platform: MetricPlatform.INSTAGRAM,
            avgViews: 10000,
            avgReach: 8000,
            viewsQuality: MetricViewsQuality.API,
          }),
        }),
      );
    });
  });

  // ─── 6. Retention Pruning & Cadence Jitter ────────────────────────────────

  describe("6. 12-Month Retention Pruning & Weekly Cadence Jitter", () => {
    it("prunes snapshots older than 12 months in batches", async () => {
      const cutoff = new Date("2025-11-25T00:00:00.000Z");

      // Mock finding 2 stale records on first iteration, then 0 on second
      vi.spyOn(prisma.creatorMetricSnapshot, "findMany")
        .mockResolvedValueOnce([{ id: "stale_1" }, { id: "stale_2" }] as any)
        .mockResolvedValueOnce([]);

      const deleteManySpy = vi
        .spyOn(prisma.creatorMetricSnapshot, "deleteMany")
        .mockResolvedValue({ count: 2 });

      const prunedCount = await CreatorMetricsService.pruneOldSnapshots(cutoff, 500);

      expect(prunedCount).toBe(2);
      expect(deleteManySpy).toHaveBeenCalledWith({
        where: { id: { in: ["stale_1", "stale_2"] } },
      });
    });

    it("distributes creator cadence days evenly across 0-6 days using hash jitter", () => {
      const day1 = CreatorMetricsService.getCreatorCadenceDay("inf_creator_alpha");
      const day2 = CreatorMetricsService.getCreatorCadenceDay("inf_creator_beta");
      const day3 = CreatorMetricsService.getCreatorCadenceDay("inf_creator_gamma");

      expect(day1).toBeGreaterThanOrEqual(0);
      expect(day1).toBeLessThanOrEqual(6);
      expect(day2).toBeGreaterThanOrEqual(0);
      expect(day2).toBeLessThanOrEqual(6);
      expect(day3).toBeGreaterThanOrEqual(0);
      expect(day3).toBeLessThanOrEqual(6);

      // Deterministic: same ID gives same day
      expect(CreatorMetricsService.getCreatorCadenceDay("inf_creator_alpha")).toBe(day1);
    });
  });

  // ─── 7. Cron Route Handler & Auth Guard ───────────────────────────────────

  describe("7. Cron Route Handler & Auth Guard (/api/cron/creator-metrics)", () => {
    it("executes cadence batch successfully when cron guard passes", async () => {
      const { GET } = await import("@/app/api/cron/creator-metrics/route");

      const runBatchSpy = vi
        .spyOn(CreatorMetricsService, "runWeeklyCadenceBatch")
        .mockResolvedValue({
          totalEvaluated: 10,
          processed: 5,
          skippedNoHealthyAccount: 2,
          skippedCadenceJitter: 2,
          skippedAlreadyCapturedThisWeek: 1,
          capturedSnapshots: 8,
          prunedSnapshots: 0,
        });

      // Stub CRON_SECRET and Authorization header
      vi.stubEnv("CRON_SECRET", "test_cron_secret");

      const req = new (await import("next/server")).NextRequest(
        "http://localhost:3000/api/cron/creator-metrics",
        {
          headers: {
            authorization: "Bearer test_cron_secret",
          },
        },
      );

      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.processed).toBe(5);
      expect(runBatchSpy).toHaveBeenCalled();
    });
  });
});

