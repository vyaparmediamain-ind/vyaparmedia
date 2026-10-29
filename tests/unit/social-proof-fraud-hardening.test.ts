import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  checkCrossPlatformConsistency,
  detectSuddenEngagementSpike,
  calculateWinsorizedEngagementRate,
  calculateFollowerAuthenticity,
  analyzeInfluencerFraudProfile,
} from "@/lib/social-proof-core";
import { ReviewService } from "@/services/review.service";
import { AdminService } from "@/services/admin.service";
import { checkFraudAppealEligibility } from "@/lib/action-eligibility";
import prisma from "@/lib/db";
import { NotificationService } from "@/services/notification.service";

// Mock logger preserving maskPII export
vi.mock("@/lib/logger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/logger")>();
  return {
    ...actual,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  };
});

vi.mock("@/lib/db", () => {
  const mockPrisma: Record<string, unknown> = {
    deal: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    review: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      aggregate: vi.fn().mockResolvedValue({ _avg: { rating: 5 }, _count: { rating: 1 } }),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    influencerProfile: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    brandProfile: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    activityLog: {
      create: vi.fn().mockResolvedValue({ id: "act-1" }),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "audit-1" }),
    },
    notification: {
      create: vi.fn(),
    },
    dispute: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
  };

  mockPrisma.$transaction = vi.fn((ops) => {
    if (typeof ops === "function") {
      return ops(mockPrisma);
    }
    return Promise.all(ops);
  });

  return { default: mockPrisma };
});

vi.mock("@/services/notification.service", () => ({
  NotificationService: {
    createNotification: vi.fn().mockResolvedValue({ id: "notif-1" }),
    sendNotification: vi.fn().mockResolvedValue({ id: "notif-1" }),
  },
}));

describe("Follower Authenticity & Fraud Detection Hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Cross-Platform Consistency Check", () => {
    it("flags extreme mismatch (e.g. Instagram 5.0% ER vs YouTube 0.1% ER) with HIGH severity and -20 penalty", () => {
      const result = checkCrossPlatformConsistency({
        instagramFollowers: 25000,
        instagramEngagementRate: 5.0,
        youtubeSubscribers: 15000,
        youtubeEngagementRate: 0.1,
      });

      expect(result.isMismatched).toBe(true);
      expect(result.divergenceRatio).toBeGreaterThanOrEqual(10);
      expect(result.scoreAdjustment).toBe(-20);
      expect(result.signal).toBeDefined();
      expect(result.signal?.code).toBe("CROSS_PLATFORM_MISMATCH");
      expect(result.signal?.severity).toBe("HIGH");
      expect(result.signal?.detail).toContain("Extreme divergence");
    });

    it("flags moderate mismatch (e.g. Instagram 4.5% ER vs YouTube 0.6% ER, ~7.5x ratio) with MEDIUM severity", () => {
      const result = checkCrossPlatformConsistency({
        instagramFollowers: 20000,
        instagramEngagementRate: 4.5,
        youtubeSubscribers: 10000,
        youtubeEngagementRate: 0.6,
      });

      expect(result.isMismatched).toBe(true);
      expect(result.divergenceRatio).toBeGreaterThanOrEqual(6);
      expect(result.scoreAdjustment).toBe(-10);
      expect(result.signal?.severity).toBe("MEDIUM");
    });

    it("minimizes false positives for single-platform creators: ignores secondary platform if followers < 1,000", () => {
      // Creator has huge Instagram but is dormant/new on YouTube with only 250 subscribers
      const result = checkCrossPlatformConsistency({
        instagramFollowers: 80000,
        instagramEngagementRate: 4.8,
        youtubeSubscribers: 250,
        youtubeEngagementRate: 0.05,
      });

      // Must NOT be flagged because YouTube audience is not mature enough to benchmark
      expect(result.isMismatched).toBe(false);
      expect(result.scoreAdjustment).toBe(0);
      expect(result.signal).toBeUndefined();
    });

    it("permits normal organic variance between platforms (e.g. YouTube 1.8% vs Instagram 3.5% = 1.9x)", () => {
      const result = checkCrossPlatformConsistency({
        instagramFollowers: 30000,
        instagramEngagementRate: 3.5,
        youtubeSubscribers: 25000,
        youtubeEngagementRate: 1.8,
      });

      expect(result.isMismatched).toBe(false);
      expect(result.scoreAdjustment).toBe(0);
      expect(result.signal).toBeUndefined();
    });

    it("handles zero or missing platform data safely without crashing", () => {
      const result = checkCrossPlatformConsistency({
        instagramFollowers: null,
        instagramEngagementRate: null,
        youtubeSubscribers: null,
        youtubeEngagementRate: null,
      });

      expect(result.isMismatched).toBe(false);
      expect(result.divergenceRatio).toBe(1);
      expect(result.scoreAdjustment).toBe(0);
    });
  });

  describe("2. Sudden Engagement Spike Check & Winsorization", () => {
    it("detects 10x single-post outlier engagement spikes (bought engagement signal)", () => {
      // Baseline median is ~1.5%, but one post spiked to 18.0%
      const result = detectSuddenEngagementSpike({
        recentPostEngagementRates: [1.4, 1.6, 1.5, 1.3, 18.0],
        medianEngagementRate: 1.5,
      });

      expect(result.hasSpike).toBe(true);
      expect(result.spikeRatio).toBeGreaterThanOrEqual(10);
      expect(result.scoreAdjustment).toBe(-15);
      expect(result.signal?.code).toBe("SUDDEN_ENGAGEMENT_SPIKE");
      expect(result.signal?.severity).toBe("HIGH");
    });

    it("winsorizes outlier post engagement so a single bought post does not overweight historical average", () => {
      const rawPosts = [1.2, 1.4, 1.5, 1.6, 20.0];
      const rawAverage = rawPosts.reduce((a, b) => a + b, 0) / rawPosts.length; // 5.14% (heavily distorted)

      const winsorizedRate = calculateWinsorizedEngagementRate(rawPosts);
      // Median is 1.5, 2.5x cap is 3.75%. The 20.0% is clamped to 3.75%, giving average of ~1.89%
      expect(winsorizedRate).toBeLessThan(2.0);
      expect(winsorizedRate).toBeLessThan(rawAverage);
    });

    it("does not flag normal organic post fluctuations (e.g. 2.0% to 3.8%)", () => {
      const result = detectSuddenEngagementSpike({
        recentPostEngagementRates: [2.1, 2.8, 3.2, 2.5, 3.5],
        medianEngagementRate: 2.8,
      });

      expect(result.hasSpike).toBe(false);
      expect(result.scoreAdjustment).toBe(0);
      expect(result.signal).toBeUndefined();
    });
  });

  describe("3. Follower Authenticity End-to-End Scoring Engine", () => {
    it("penalizes rapid unnatural follower growth surges (>50% monthly)", () => {
      const result = calculateFollowerAuthenticity({
        followers: 20000,
        following: 500,
        engagementRate: 3.0,
        accountAgeDays: 120,
        followerGrowthMonthly: 65, // 65% surge
      });

      const growthSignal = result.fraudSignals.find((s) => s.code === "FOLLOWER_GROWTH_SPIKE");
      expect(growthSignal).toBeDefined();
      expect(growthSignal?.severity).toBe("HIGH");
      expect(result.breakdown.growthConsistencyScore).toBe(-10);
    });

    it("flags an influencer as HIGH risk when multiple severe signals are present", () => {
      const result = calculateFollowerAuthenticity({
        followers: 30000,
        following: 2000,
        engagementRate: 1.3,
        accountAgeDays: 90,
        followerGrowthMonthly: 70, // growth spike
        crossPlatform: {
          instagramFollowers: 30000,
          instagramEngagementRate: 5.0,
          youtubeSubscribers: 15000,
          youtubeEngagementRate: 0.1, // 50x mismatch
        },
        recentPostEngagementRates: [1.2, 1.4, 1.3, 19.5], // 15x spike
      });

      expect(result.isFlagged).toBe(true);
      expect(result.fraudRiskLevel).toBe("HIGH");
      expect(result.fraudSignals.length).toBeGreaterThanOrEqual(3);
    });

    it("classifies legitimate creators with normal steady metrics as LOW risk without flags", () => {
      const result = calculateFollowerAuthenticity({
        followers: 15000,
        following: 400,
        engagementRate: 3.2,
        accountAgeDays: 300,
        followerGrowthMonthly: 6, // steady healthy growth
        uniqueCommentersRatio: 0.75,
        crossPlatform: {
          instagramFollowers: 15000,
          instagramEngagementRate: 3.2,
          youtubeSubscribers: 10000,
          youtubeEngagementRate: 2.1, // organic balance
        },
        recentPostEngagementRates: [2.8, 3.1, 3.4, 3.2],
      });

      expect(result.isFlagged).toBe(false);
      expect(result.fraudRiskLevel).toBe("LOW");
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.fraudSignals.length).toBe(0);
    });
  });

  describe("4. Review Authenticity & Anti-Farming Protections", () => {
    it("rejects reviews on zero-dollar deals with no physical product delivery (empty deals cannot farm reviews)", async () => {
      vi.mocked(prisma.deal.findUnique).mockResolvedValueOnce({
        id: "deal-empty",
        status: "COMPLETED",
        amount: 0,
        requiresProduct: false,
        influencer: { userId: "creator-1" },
        brand: { userId: "brand-1" },
      } as never);

      await expect(
        ReviewService.createReview("brand-1", {
          dealId: "deal-empty",
          rating: 5,
          comment: "Amazing creator, highly recommend!",
        })
      ).rejects.toThrow("verified monetary or product escrow settlement");
    });

    it("allows reviews on verified paid deals or barter deals with physical product escrow", async () => {
      vi.mocked(prisma.deal.findUnique).mockResolvedValueOnce({
        id: "deal-paid",
        status: "COMPLETED",
        amount: 8000,
        requiresProduct: false,
        influencer: { userId: "creator-1" },
        brand: { userId: "brand-1" },
      } as never);

      vi.mocked(prisma.review.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.review.count).mockResolvedValueOnce(0);
      vi.mocked(prisma.review.findFirst).mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      
      // User findUnique called for reviewer, then for receiver
      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce({ id: "brand-1", userType: "BRAND" } as never)
        .mockResolvedValueOnce({
          id: "creator-1",
          userType: "INFLUENCER",
          influencerProfile: { id: "inf-1" },
        } as never);

      vi.mocked(prisma.review.create).mockResolvedValueOnce({ id: "rev-1", rating: 5 } as never);

      const review = await ReviewService.createReview("brand-1", {
        dealId: "deal-paid",
        rating: 5,
        comment: "Excellent collaboration and high quality reel!",
      });

      expect(review).toBeDefined();
    });

    it("enforces pairwise velocity cap: prevents >3 reviews in 30 days between the exact same brand-creator pair", async () => {
      vi.mocked(prisma.deal.findUnique).mockResolvedValueOnce({
        id: "deal-4",
        status: "COMPLETED",
        amount: 5000,
        requiresProduct: false,
        influencer: { userId: "creator-1" },
        brand: { userId: "brand-1" },
      } as never);

      vi.mocked(prisma.review.findUnique).mockResolvedValueOnce(null);
      // Already 3 reviews exist in last 30 days
      vi.mocked(prisma.review.count).mockResolvedValueOnce(3);

      await expect(
        ReviewService.createReview("brand-1", {
          dealId: "deal-4",
          rating: 5,
          comment: "Fourth deal in two weeks, perfect work!",
        })
      ).rejects.toThrow("Review farming limit reached");
    });

    it("enforces a 24-hour pairwise cooldown between reviews from the same partner", async () => {
      vi.mocked(prisma.deal.findUnique).mockResolvedValueOnce({
        id: "deal-2",
        status: "COMPLETED",
        amount: 5000,
        requiresProduct: false,
        influencer: { userId: "creator-1" },
        brand: { userId: "brand-1" },
      } as never);

      vi.mocked(prisma.review.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.review.count).mockResolvedValueOnce(1);
      // Review submitted within the last 4 hours
      vi.mocked(prisma.review.findFirst).mockResolvedValueOnce({
        id: "recent-rev",
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      } as never);

      await expect(
        ReviewService.createReview("brand-1", {
          dealId: "deal-2",
          rating: 5,
          comment: "Another great job!",
        })
      ).rejects.toThrow("wait at least 24 hours");
    });

    it("blocks canned duplicate review text submitted across multiple deals", async () => {
      vi.mocked(prisma.deal.findUnique).mockResolvedValueOnce({
        id: "deal-3",
        status: "COMPLETED",
        amount: 5000,
        requiresProduct: false,
        influencer: { userId: "creator-1" },
        brand: { userId: "brand-1" },
      } as never);

      vi.mocked(prisma.review.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.review.count).mockResolvedValueOnce(1);
      vi.mocked(prisma.review.findFirst)
        .mockResolvedValueOnce(null) // no cooldown hit
        .mockResolvedValueOnce({
          id: "dup-text-rev",
          comment: "Super professional creator, will definitely hire again for future campaigns!",
        } as never); // duplicate text match!

      await expect(
        ReviewService.createReview("brand-1", {
          dealId: "deal-3",
          rating: 5,
          comment: "Super professional creator, will definitely hire again for future campaigns!",
        })
      ).rejects.toThrow("Duplicate review text detected");
    });
  });

  describe("5. Admin Fraud Explainability & Dispute Appeal Resolution", () => {
    it("deconstructs influencer profile into transparent audit metrics via analyzeInfluencerFraudProfile", () => {
      const analysis = analyzeInfluencerFraudProfile({
        id: "inf-101",
        instagramFollowers: 30000,
        instagramEngagementRate: 500, // 5.0%
        youtubeSubscribers: 15000,
        youtubeEngagementRate: 10, // 0.1%
        followerAuthenticityScore: 35,
      });

      expect(analysis.influencerId).toBe("inf-101");
      expect(analysis.followerAuthenticityScore).toBe(35);
      expect(analysis.metrics.instagramEngagementRate).toBeCloseTo(5.0);
      expect(analysis.metrics.youtubeEngagementRate).toBeCloseTo(0.1);
      expect(analysis.metrics.crossPlatformRatio).toBeGreaterThanOrEqual(10);
      expect(analysis.fraudSignals.length).toBeGreaterThan(0);
      expect(analysis.fraudSignals[0]?.code).toBe("CROSS_PLATFORM_MISMATCH");
    });

    it("allows admin to approve an appeal, resetting FLAGGED status and recalibrating score to >= 75", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: "creator-flagged",
        userType: "INFLUENCER",
        status: "FLAGGED",
        influencerProfile: {
          id: "inf-prof-1",
          followerAuthenticityScore: 32,
        },
      } as never);

      const result = await AdminService.resolveInfluencerFraudAppeal(
        "admin-user-1",
        "creator-flagged",
        "APPROVE_APPEAL",
        "Creator provided screenshot analytics proving viral reel"
      );

      expect(result.success).toBe(true);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(NotificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "creator-flagged",
          title: "Authenticity Flag Cleared",
        })
      );
    });

    it("allows admin to uphold/confirm a fraud flag with audit log", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: "creator-fake",
        userType: "INFLUENCER",
        status: "ACTIVE",
        influencerProfile: {
          id: "inf-prof-2",
          followerAuthenticityScore: 25,
        },
      } as never);

      const result = await AdminService.resolveInfluencerFraudAppeal(
        "admin-user-1",
        "creator-fake",
        "CONFIRM_FLAG",
        "Confirmed bot comments and fake followers"
      );

      expect(result.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "creator-fake" },
        data: { status: "FLAGGED" },
      });
    });

    it("evaluates checkFraudAppealEligibility: blocks healthy accounts, non-influencers, or short reasons", () => {
      // Non-influencer
      const brandCheck = checkFraudAppealEligibility({
        userType: "BRAND",
        userStatus: "FLAGGED",
      });
      expect(brandCheck.allowed).toBe(false);
      expect(brandCheck.reasonCode).toBe("NOT_INFLUENCER");

      // Healthy creator account
      const healthyCheck = checkFraudAppealEligibility({
        userType: "INFLUENCER",
        userStatus: "ACTIVE",
        followerAuthenticityScore: 85,
      });
      expect(healthyCheck.allowed).toBe(false);
      expect(healthyCheck.reasonCode).toBe("ACCOUNT_HEALTHY");

      // Pending appeal
      const pendingCheck = checkFraudAppealEligibility({
        userType: "INFLUENCER",
        userStatus: "FLAGGED",
        hasPendingAppeal: true,
      });
      expect(pendingCheck.allowed).toBe(false);
      expect(pendingCheck.reasonCode).toBe("PENDING_APPEAL");

      // Reason too short
      const shortReasonCheck = checkFraudAppealEligibility({
        userType: "INFLUENCER",
        userStatus: "FLAGGED",
        appealReasonLength: 8,
      });
      expect(shortReasonCheck.allowed).toBe(false);
      expect(shortReasonCheck.reasonCode).toBe("REASON_TOO_SHORT");

      // Valid appeal eligibility
      const validCheck = checkFraudAppealEligibility({
        userType: "INFLUENCER",
        userStatus: "FLAGGED",
        followerAuthenticityScore: 35,
        appealReasonLength: 30,
      });
      expect(validCheck.allowed).toBe(true);
    });

    it("allows flagged influencer to submit an appeal with audit log and notification", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: "creator-appeal-1",
        userType: "INFLUENCER",
        status: "FLAGGED",
        influencerProfile: {
          id: "inf-prof-app-1",
          followerAuthenticityScore: 38,
        },
      } as never);

      vi.mocked(prisma.activityLog.findFirst).mockResolvedValueOnce(null);

      const result = await AdminService.submitInfluencerFraudAppeal("creator-appeal-1", {
        reason: "My Instagram reel went viral because it was boosted via Meta Ads campaign.",
        evidenceUrl: "https://drive.google.com/ad-proof.png",
      });

      expect(result.success).toBe(true);
      expect(prisma.activityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "creator-appeal-1",
            action: "FRAUD_APPEAL_SUBMITTED",
          }),
        })
      );
      expect(NotificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "creator-appeal-1",
          title: "Authenticity Appeal Submitted",
        })
      );
    });

    it("rejects duplicate pending appeals within 7 days", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: "creator-appeal-2",
        userType: "INFLUENCER",
        status: "FLAGGED",
        influencerProfile: {
          id: "inf-prof-app-2",
          followerAuthenticityScore: 30,
        },
      } as never);

      vi.mocked(prisma.activityLog.findFirst).mockResolvedValueOnce({
        id: "recent-act-1",
        userId: "creator-appeal-2",
        action: "FRAUD_APPEAL_SUBMITTED",
        createdAt: new Date(),
      } as never);

      await expect(
        AdminService.submitInfluencerFraudAppeal("creator-appeal-2", {
          reason: "Another appeal attempt before the previous one was reviewed.",
        })
      ).rejects.toThrow("already pending manual review");
    });
  });
});

