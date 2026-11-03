import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  evaluateHistoricalPostMetrics,
  CreatorAuditService,
} from "@/services/creator-audit.service";
import { InstagramPost } from "@/lib/instagram";
import prisma from "@/lib/db";

// Mock dependencies
vi.mock("@/lib/db", () => {
  const mockPrisma = {
    influencerProfile: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (ops: unknown[]) => {
      return Array.isArray(ops) ? Promise.all(ops) : ops;
    }),
  };
  return { default: mockPrisma };
});

vi.mock("@/lib/instagram", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/instagram")>();
  return {
    ...actual,
    getFreshInstagramAccessToken: vi.fn().mockResolvedValue("mock_access_token_123"),
    getRecentPosts: vi.fn().mockResolvedValue([]),
    getPostComments: vi.fn().mockResolvedValue([]),
  };
});

vi.mock("@/lib/redis", () => ({
  redis: {
    del: vi.fn().mockResolvedValue(1),
  },
}));

describe("Creator Historical Social Audit & Fraud Detection Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("evaluateHistoricalPostMetrics (Pure Engine)", () => {
    it("evaluates healthy organic creator with high authenticity score (tier EXCELLENT)", () => {
      // 10 posts with organic like/comment distribution (approx 3-5% comments relative to likes)
      const mockPosts: InstagramPost[] = Array.from({ length: 10 }, (_, i) => ({
        id: `post_${i}`,
        mediaType: i % 2 === 0 ? "REELS" : "IMAGE",
        mediaUrl: "https://instagram.com/p/1",
        permalink: `https://instagram.com/reel/post_${i}`,
        caption: `Great travel vlog episode ${i} #travel #india`,
        timestamp: new Date(Date.now() - i * 86400000).toISOString(),
        likeCount: 450 + (i * 15),
        commentsCount: 22 + (i * 2), // ~4.5% comment ratio
        isLive: true,
      }));

      const followers = 12000;
      const organicComments = [
        "Loved the cinematography here!",
        "Where is this location in Himachal?",
        "Can you share the hotel details please?",
        "Super helpful guide, saving this for next month!",
      ];

      const metrics = evaluateHistoricalPostMetrics(mockPosts, followers, organicComments);

      expect(metrics.analyzedPostsCount).toBe(10);
      expect(metrics.podDetected).toBe(false);
      expect(metrics.botLikesDetected).toBe(false);
      expect(metrics.ghostFollowersDetected).toBe(false);
      expect(metrics.flags.length).toBe(0);
      expect(metrics.followerAuthenticityScore).toBeGreaterThanOrEqual(85);
      expect(metrics.authenticityTier).toBe("EXCELLENT");
      expect(metrics.contentQualityScore).toBeGreaterThanOrEqual(75);
    });

    it("detects bot likes when comment ratio is abnormally low (< 0.3%)", () => {
      // 10 posts with 3,000 likes but only 2 comments
      const mockPosts: InstagramPost[] = Array.from({ length: 10 }, (_, i) => ({
        id: `post_${i}`,
        mediaType: "IMAGE",
        mediaUrl: "https://instagram.com/p/1",
        permalink: `https://instagram.com/p/post_${i}`,
        caption: `Random selfie ${i}`,
        timestamp: new Date(Date.now() - i * 86400000).toISOString(),
        likeCount: 3000,
        commentsCount: 2, // 0.06% comments (extreme bot pattern)
        isLive: true,
      }));

      const followers = 25000;
      const metrics = evaluateHistoricalPostMetrics(mockPosts, followers, ["nice", "cool"]);

      expect(metrics.botLikesDetected).toBe(true);
      expect(metrics.flags.some((f) => f.includes("BOT_LIKES_SUSPECTED"))).toBe(true);
      expect(metrics.followerAuthenticityScore).toBeLessThan(75);
      expect(["SUSPICIOUS", "HIGH_RISK"]).toContain(metrics.authenticityTier);
    });

    it("detects engagement pod collusion when comment-to-like ratio is unnaturally high (>40%)", () => {
      // 10 posts with 60 likes but 45 comments (pod swarm pattern)
      const mockPosts: InstagramPost[] = Array.from({ length: 10 }, (_, i) => ({
        id: `post_${i}`,
        mediaType: "IMAGE",
        mediaUrl: "https://instagram.com/p/1",
        permalink: `https://instagram.com/p/post_${i}`,
        caption: `Daily quote ${i}`,
        timestamp: new Date(Date.now() - i * 86400000).toISOString(),
        likeCount: 60,
        commentsCount: 40, // 66% comment ratio (pod pattern)
        isLive: true,
      }));

      const followers = 2000;
      const metrics = evaluateHistoricalPostMetrics(mockPosts, followers);

      expect(metrics.podDetected).toBe(true);
      expect(metrics.flags.some((f) => f.includes("ENGAGEMENT_POD_SUSPECTED"))).toBe(true);
      expect(metrics.followerAuthenticityScore).toBeLessThan(80);
    });

    it("detects ghost followers when high follower count has near-zero activity", () => {
      // 80,000 followers but only 25 likes per post (0.03% ER)
      const mockPosts: InstagramPost[] = Array.from({ length: 10 }, (_, i) => ({
        id: `post_${i}`,
        mediaType: "IMAGE",
        mediaUrl: "https://instagram.com/p/1",
        permalink: `https://instagram.com/p/post_${i}`,
        caption: `Post ${i}`,
        timestamp: new Date(Date.now() - i * 86400000).toISOString(),
        likeCount: 25,
        commentsCount: 1,
        isLive: true,
      }));

      const followers = 80000;
      const metrics = evaluateHistoricalPostMetrics(mockPosts, followers);

      expect(metrics.ghostFollowersDetected).toBe(true);
      expect(metrics.flags.some((f) => f.includes("GHOST_FOLLOWERS_SUSPECTED"))).toBe(true);
    });

    it("penalizes duplicate bot comments with emoji spam patterns", () => {
      const mockPosts: InstagramPost[] = Array.from({ length: 5 }, (_, i) => ({
        id: `post_${i}`,
        mediaType: "IMAGE",
        mediaUrl: "https://instagram.com/p/1",
        permalink: `https://instagram.com/p/post_${i}`,
        caption: `Pic ${i}`,
        timestamp: new Date().toISOString(),
        likeCount: 500,
        commentsCount: 20,
        isLive: true,
      }));

      // Heavy emoji spam and duplicate bot phrases
      const botComments = [
        "nice",
        "nice",
        "fire",
        "wow",
        "love it",
        "nice",
        "awesome",
        "follow me",
      ];

      const metrics = evaluateHistoricalPostMetrics(mockPosts, 5000, botComments);

      expect(metrics.flags.some((f) => f.includes("COMMENT_AUDIT"))).toBe(true);
      expect(metrics.followerAuthenticityScore).toBeLessThan(90);
    });
  });

  describe("CreatorAuditService.auditHistoricalInstagramData (End-to-End Orchestration)", () => {
    it("orchestrates fetch, evaluation, and Prisma persistence for existing creator", async () => {
      const { getRecentPosts, getPostComments } = await import("@/lib/instagram");

      vi.mocked(prisma.influencerProfile.findUnique).mockResolvedValueOnce({
        id: "inf_test_123",
        userId: "user_test_123",
        displayName: "Aman Sharma",
        instagramHandle: "amansharma_vlogs",
        instagramFollowers: 15000,
      } as any);

      vi.mocked(getRecentPosts).mockResolvedValueOnce([
        {
          id: "ig_post_1",
          mediaType: "REELS",
          mediaUrl: "https://instagram.com/reel/1",
          permalink: "https://instagram.com/reel/1",
          caption: "Check out this new smartphone unboxing!",
          timestamp: new Date().toISOString(),
          likeCount: 650,
          commentsCount: 35,
          isLive: true,
          isPaidPartnership: false,
        },
      ]);

      vi.mocked(getPostComments).mockResolvedValueOnce([
        { id: "c1", text: "Specs look solid for this price point!", username: "techgeek" },
        { id: "c2", text: "Does it support 120Hz display?", username: "user_mobile" },
      ]);

      vi.mocked(prisma.influencerProfile.update).mockResolvedValueOnce({} as any);
      vi.mocked(prisma.activityLog.create).mockResolvedValueOnce({} as any);

      const result = await CreatorAuditService.auditHistoricalInstagramData(
        "user_test_123",
        "mock_token",
      );

      expect(result.success).toBe(true);
      expect(result.instagramHandle).toBe("amansharma_vlogs");
      expect(result.metrics).toBeDefined();
      expect(result.metrics?.followerAuthenticityScore).toBeGreaterThanOrEqual(80);
      expect(result.metrics?.authenticityTier).toBe("EXCELLENT");

      // Verify Prisma update was called
      expect(prisma.influencerProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user_test_123" },
          data: expect.objectContaining({
            followerAuthenticityScore: expect.any(Number),
            contentQualityScore: expect.any(Number),
            instagramEngagementRate: expect.any(Number),
          }),
        }),
      );

      // Verify ActivityLog was generated
      expect(prisma.activityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "user_test_123",
            action: "CREATOR_HISTORICAL_AUDIT_COMPLETED",
          }),
        }),
      );
    });

    it("returns error gracefully when creator has no connected handle", async () => {
      vi.mocked(prisma.influencerProfile.findUnique).mockResolvedValueOnce({
        id: "inf_test_none",
        userId: "user_test_none",
        displayName: "No Insta",
        instagramHandle: null,
        instagramFollowers: null,
      } as any);

      const result = await CreatorAuditService.auditHistoricalInstagramData("user_test_none");

      expect(result.success).toBe(false);
      expect(result.error).toContain("No connected Instagram handle found");
    });
  });
});

