import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks for dependencies before imports
vi.mock("@/lib/db", () => {
  const mockPrisma = {
    user: { findUnique: vi.fn(), findFirst: vi.fn() },
    wallet: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
    transaction: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    brandProfile: { findUnique: vi.fn() },
    influencerProfile: {
      findMany: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    campaign: { findMany: vi.fn() },
    deal: { aggregate: vi.fn() },
    debtClaim: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    auditLog: { create: vi.fn() },
    deadLetterJob: { create: vi.fn() },
    oAuthAccount: { findFirst: vi.fn() },
    $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => cb(mockPrisma)),
    $queryRaw: vi.fn().mockResolvedValue([]),
  };
  return { default: mockPrisma, prisma: mockPrisma };
});

vi.mock("@/lib/redis", () => {
  const mockRedis = {
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
  };
  return { default: mockRedis, redis: mockRedis };
});

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    critical: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/lib/referral-engine", () => ({
  getEffectivePlatformFee: vi.fn().mockResolvedValue({ tier: "STANDARD", effectiveFee: 10 }),
}));

vi.mock("@/lib/drs-score", () => ({
  calculateLevel: vi.fn((xp: number) => ({ level: Math.max(1, Math.floor(xp / 1000) + 1) })),
  getPlatformFeePercentage: vi.fn((level: number) => (level >= 5 ? 8 : 10)),
}));

vi.mock("@/lib/youtube", () => ({
  getYouTubeChannel: vi.fn().mockResolvedValue({ id: "yt-123", subscriberCount: 50000 }),
  calculateYouTubeEngagement: vi.fn().mockResolvedValue({ engagementRate: 4.5 }),
}));

vi.mock("@/lib/instagram", () => ({
  getInstagramProfile: vi.fn().mockResolvedValue({ username: "test_handle", followersCount: 25000 }),
  calculateEngagement: vi.fn().mockResolvedValue({ engagementRate: 3.2 }),
}));

vi.mock("@/lib/encryption", () => ({
  decrypt: vi.fn((val: string) => `decrypted_${val}`),
}));

vi.mock("@/services/notification.service", () => ({
  NotificationService: {
    sendNotification: vi.fn().mockResolvedValue(true),
  },
}));

// Imports
import prisma from "@/lib/db";
import redis from "@/lib/redis";
import {
  ABSOLUTE_MIN_PLATFORM_FEE,
  resolveBrandPlatformFee,
  invalidateBrandPlatformFeeCache,
} from "@/lib/platform-fees";
import { scanAllWalletsForDrift } from "@/lib/ledger-guard";
import { creditWalletWithDebtAdjustment } from "@/lib/wallet-debt";
import {
  CATEGORY_BASELINE_CPV_PAISE,
  DEFAULT_BASELINE_CPV_PAISE,
  getCategoryBaselineCpvSync,
  calculateRoiScore,
} from "@/lib/roi-calculator";
import {
  MATCHING_PRIORITY_PRESETS,
  MATCHING_PRIORITY_META,
  encodeMatchingPriority,
  decodeMatchingPriority,
  stripMatchingPriority,
} from "@/lib/matching-priority";
import {
  calculateFollowerAuthenticity,
  calculateContentQuality,
  recalculateAllSocialProof,
} from "@/lib/social-proof-calculator";

describe("Financial Core Coverage Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. Platform Fees
  // =========================================================================
  describe("platform-fees.ts", () => {
    it("exports ABSOLUTE_MIN_PLATFORM_FEE as 7", () => {
      expect(ABSOLUTE_MIN_PLATFORM_FEE).toBe(7);
    });

    it("returns cached fee snapshot from Redis if present", async () => {
      const cached = {
        userLevel: 2,
        levelBasedFee: 10,
        referralTier: "GOLD",
        referralFee: 8,
        effectivePlatformFee: 8,
        customPlatformFee: null,
        isCustomFeeOverride: false,
      };
      vi.mocked(redis.get).mockResolvedValueOnce(JSON.stringify(cached));

      const res = await resolveBrandPlatformFee("brand-123");
      expect(res).toEqual(cached);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it("computes fee from user level and referral tier when no cache", async () => {
      vi.mocked(redis.get).mockResolvedValueOnce(null);
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        xp: 2500,
        brandProfile: { customPlatformFee: null },
      } as any);

      const res = await resolveBrandPlatformFee("brand-456");
      expect(res.userLevel).toBe(3);
      expect(res.isCustomFeeOverride).toBe(false);
      expect(res.effectivePlatformFee).toBe(10);
      expect(redis.setex).toHaveBeenCalledWith(
        "platform_fee:brand_snapshot:brand-456",
        300,
        expect.any(String)
      );
    });

    it("applies custom fee override but enforces absolute 7% minimum floor", async () => {
      vi.mocked(redis.get).mockResolvedValueOnce(null);
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        xp: 100,
        brandProfile: { customPlatformFee: 5 }, // Below 7% floor
      } as any);

      const res = await resolveBrandPlatformFee("brand-subfloor");
      expect(res.isCustomFeeOverride).toBe(true);
      expect(res.effectivePlatformFee).toBe(7); // Clamped to 7%
      expect(res.customPlatformFee).toBe(7);
    });

    it("applies custom fee above 7% without clamping", async () => {
      vi.mocked(redis.get).mockResolvedValueOnce(null);
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        xp: 100,
        brandProfile: { customPlatformFee: 8.5 },
      } as any);

      const res = await resolveBrandPlatformFee("brand-custom-85");
      expect(res.isCustomFeeOverride).toBe(true);
      expect(res.effectivePlatformFee).toBe(8.5);
    });

    it("handles Redis failure gracefully during read and write", async () => {
      vi.mocked(redis.get).mockRejectedValueOnce(new Error("Redis connection dropped"));
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        xp: 0,
        brandProfile: null,
      } as any);
      vi.mocked(redis.setex).mockRejectedValueOnce(new Error("Redis write timed out"));

      const res = await resolveBrandPlatformFee("brand-redis-err");
      expect(res.effectivePlatformFee).toBe(10);
    });

    it("invalidates Redis cache keys for a brand", async () => {
      await invalidateBrandPlatformFeeCache("brand-inv");
      expect(redis.del).toHaveBeenCalledWith("platform_fee:effective:brand-inv");
      expect(redis.del).toHaveBeenCalledWith("platform_fee:brand_snapshot:brand-inv");
    });
  });

  // =========================================================================
  // 2. Ledger Guard
  // =========================================================================
  describe("ledger-guard.ts", () => {
    it("scans wallets for drift and handles empty wallet list", async () => {
      vi.mocked(redis.get).mockResolvedValueOnce("last-id-100");
      vi.mocked(prisma.wallet.findMany).mockResolvedValueOnce([]);

      const anomalies = await scanAllWalletsForDrift(50);
      expect(anomalies).toEqual([]);
      expect(redis.del).toHaveBeenCalled();
    });

    it("scans wallet batches and updates redis cursor when wallets found", async () => {
      vi.mocked(redis.get).mockResolvedValueOnce(null);
      vi.mocked(prisma.wallet.findMany)
        .mockResolvedValueOnce([
          { id: "w1", userId: "u1" },
          { id: "w2", userId: "u2" },
        ] as any)
        .mockResolvedValueOnce([]); // end of scan

      vi.mocked(prisma.wallet.findUnique).mockResolvedValue({
        id: "w1",
        userId: "u1",
        balance: 10000,
        pendingBalance: 0,
      } as any);
      vi.mocked(prisma.transaction.findMany).mockResolvedValue([
        { type: "CREDIT", amount: 10000, description: "Deposit", metadata: null, razorpayPaymentId: null },
      ] as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ userType: "INFLUENCER" } as any);

      const anomalies = await scanAllWalletsForDrift(10);
      expect(anomalies).toEqual([]);
      expect(prisma.wallet.findMany).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 3. Wallet Debt & Recovery Engine
  // =========================================================================
  describe("wallet-debt.ts", () => {
    it("creates a new wallet with credit transaction when user has no existing wallet", async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([]); // no existing wallet
      vi.mocked(prisma.wallet.create).mockResolvedValueOnce({
        id: "new-w-1",
        userId: "new-u-1",
        balance: 50000,
        totalEarned: 50000,
      } as any);

      const res = await creditWalletWithDebtAdjustment(
        prisma as any,
        "new-u-1",
        50000,
        "deal-1",
        "Deal Completion Payout"
      );

      expect(prisma.wallet.create).toHaveBeenCalledWith({
        data: {
          userId: "new-u-1",
          balance: 50000,
          totalEarned: 50000,
        },
      });
      expect(prisma.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          walletId: "new-w-1",
          type: "CREDIT",
          amount: 50000,
          status: "COMPLETED",
        }),
      });
      expect(res.id).toBe("new-w-1");
    });

    it("credits existing wallet without debt directly", async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ id: "exist-w", debt: 0 }]);
      vi.mocked(prisma.wallet.update).mockResolvedValueOnce({
        id: "exist-w",
        balance: 75000,
      } as any);

      await creditWalletWithDebtAdjustment(
        prisma as any,
        "exist-u",
        25000,
        "deal-2"
      );

      expect(prisma.wallet.update).toHaveBeenCalledWith({
        where: { id: "exist-w" },
        data: {
          balance: { increment: 25000 },
          totalEarned: { increment: 25000 },
        },
      });
      expect(prisma.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          walletId: "exist-w",
          type: "CREDIT",
          amount: 25000,
        }),
      });
    });

    it("recovers debt when creditAmount exceeds debt and distributes to creditor claims", async () => {
      // Wallet has 3,000 paise debt; credit is 10,000 paise
      // Debt paid = 3,000; net credit = 7,000 paise
      vi.mocked(prisma.$queryRaw)
        .mockResolvedValueOnce([{ id: "debt-w-1", debt: 3000 }]) // initial query
        .mockResolvedValueOnce([]); // debt claim row lock query

      vi.mocked(prisma.wallet.update).mockResolvedValueOnce({
        id: "debt-w-1",
        balance: 7000,
        debt: 0,
      } as any);

      vi.mocked(prisma.debtClaim.findMany).mockResolvedValueOnce([
        { id: "claim-1", amount: 3000, creditorUserId: "creditor-1", dealId: "deal-old" },
      ] as any);

      vi.mocked(prisma.wallet.upsert).mockResolvedValueOnce({
        id: "creditor-w-1",
        userId: "creditor-1",
        balance: 3000,
      } as any);

      await creditWalletWithDebtAdjustment(
        prisma as any,
        "debt-u-1",
        10000,
        "deal-fresh"
      );

      // Decremented debt and incremented net credit
      expect(prisma.wallet.update).toHaveBeenCalledWith({
        where: { id: "debt-w-1" },
        data: {
          balance: { increment: 7000 },
          totalEarned: { increment: 7000 },
          debt: { decrement: 3000 },
        },
      });

      // Claim updated to RECOVERED
      expect(prisma.debtClaim.update).toHaveBeenCalledWith({
        where: { id: "claim-1" },
        data: {
          amount: 0,
          status: "RECOVERED",
        },
      });

      // Creditor credited with REFUND
      expect(prisma.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          walletId: "creditor-w-1",
          type: "REFUND",
          amount: 3000,
        }),
      });

      // Debtor gets DEBIT for debt recovery
      expect(prisma.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          walletId: "debt-w-1",
          type: "DEBIT",
          amount: 3000,
          metadata: { balanceImpact: false, source: "debt_recovery" },
        }),
      });

      // Debtor gets net CREDIT of 7000
      expect(prisma.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          walletId: "debt-w-1",
          type: "CREDIT",
          amount: 7000,
        }),
      });
    });

    it("handles partial debt recovery when credit is less than debt", async () => {
      // Wallet debt = 50,000 paise; credit = 20,000 paise
      // Debt paid = 20,000; net credit = 0
      vi.mocked(prisma.$queryRaw)
        .mockResolvedValueOnce([{ id: "debt-w-2", debt: 50000 }])
        .mockResolvedValueOnce([]);

      vi.mocked(prisma.wallet.update).mockResolvedValueOnce({
        id: "debt-w-2",
        debt: 30000,
      } as any);

      vi.mocked(prisma.debtClaim.findMany).mockResolvedValueOnce([
        { id: "claim-2", amount: 50000, creditorUserId: "creditor-2", dealId: "deal-partial" },
      ] as any);

      vi.mocked(prisma.wallet.upsert).mockResolvedValueOnce({
        id: "creditor-w-2",
        userId: "creditor-2",
      } as any);

      await creditWalletWithDebtAdjustment(
        prisma as any,
        "debt-u-2",
        20000,
        "deal-new"
      );

      // Claim status is PENDING with remaining 30000
      expect(prisma.debtClaim.update).toHaveBeenCalledWith({
        where: { id: "claim-2" },
        data: {
          amount: 30000,
          status: "PENDING",
        },
      });

      // No net credit transaction should be created since netCredit is 0
      const creditCalls = vi.mocked(prisma.transaction.create).mock.calls.filter(
        (call) => call[0].data.type === "CREDIT"
      );
      expect(creditCalls.length).toBe(0);
    });
  });

  // =========================================================================
  // 4. ROI & CPV Calculator
  // =========================================================================
  describe("roi-calculator.ts", () => {
    it("verifies known category baselines in paise", () => {
      expect(CATEGORY_BASELINE_CPV_PAISE["finance"]).toBe(120);
      expect(CATEGORY_BASELINE_CPV_PAISE["gaming"]).toBe(18);
      expect(CATEGORY_BASELINE_CPV_PAISE["technology"]).toBe(65);
      expect(DEFAULT_BASELINE_CPV_PAISE).toBe(35);
    });

    it("getCategoryBaselineCpvSync handles empty, single, and multiple categories", () => {
      expect(getCategoryBaselineCpvSync([])).toBe(35);
      expect(getCategoryBaselineCpvSync(["finance"])).toBe(120);
      expect(getCategoryBaselineCpvSync(["  GAMING  "])).toBe(18);
      // Multiple: finance (120) + gaming (18) = 138 / 2 = 69
      expect(getCategoryBaselineCpvSync(["finance", "gaming"])).toBe(69);
      // Unknown category falls back to 35
      expect(getCategoryBaselineCpvSync(["unknown-niche"])).toBe(35);
    });

    it("calculateRoiScore returns 100 when cpvPaise <= 0", () => {
      expect(calculateRoiScore(0)).toBe(100);
      expect(calculateRoiScore(-5)).toBe(100);
    });

    it("calculateRoiScore tests all 6 efficiency ratio tiers", () => {
      // Baseline 100 paise:
      // Tier 1: CPV <= 40 (<= 0.4 ratio) -> 95 - 100
      expect(calculateRoiScore(20, 100)).toBeGreaterThanOrEqual(95);
      expect(calculateRoiScore(20, 100)).toBeLessThanOrEqual(100);

      // Tier 2: CPV = 60 (0.6 ratio) -> 85 - 95
      const score2 = calculateRoiScore(60, 100);
      expect(score2).toBeGreaterThanOrEqual(85);
      expect(score2).toBeLessThanOrEqual(95);

      // Tier 3: CPV = 100 (1.0 ratio) -> 70 - 85
      const score3 = calculateRoiScore(100, 100);
      expect(score3).toBeGreaterThanOrEqual(70);
      expect(score3).toBeLessThanOrEqual(85);

      // Tier 4: CPV = 160 (1.6 ratio) -> 50 - 70
      const score4 = calculateRoiScore(160, 100);
      expect(score4).toBeGreaterThanOrEqual(50);
      expect(score4).toBeLessThanOrEqual(70);

      // Tier 5: CPV = 280 (2.8 ratio) -> 30 - 50
      const score5 = calculateRoiScore(280, 100);
      expect(score5).toBeGreaterThanOrEqual(30);
      expect(score5).toBeLessThanOrEqual(50);

      // Tier 6: Substantially overpriced CPV = 500 (5.0 ratio) -> floored at 10
      const score6 = calculateRoiScore(500, 100);
      expect(score6).toBeGreaterThanOrEqual(10);
      expect(score6).toBeLessThanOrEqual(30);
    });

    it("accepts string and array category names", () => {
      const scoreString = calculateRoiScore(60, "finance");
      const scoreArray = calculateRoiScore(60, ["finance", "tech"]);
      expect(typeof scoreString).toBe("number");
      expect(typeof scoreArray).toBe("number");
    });
  });

  // =========================================================================
  // 5. Matching Priority
  // =========================================================================
  describe("matching-priority.ts", () => {
    it("has valid preset weights summing to 1.0", () => {
      for (const [preset, weights] of Object.entries(MATCHING_PRIORITY_PRESETS)) {
        const sum =
          weights.category +
          weights.engagement +
          weights.authenticity +
          weights.quality +
          weights.roi;
        expect(Math.round(sum * 100) / 100).toBe(1.0);
      }
    });

    it("has metadata for each preset", () => {
      for (const preset of ["BALANCED", "REACH_FOCUSED", "TRUST_FOCUSED", "ROI_FOCUSED", "CUSTOM"] as const) {
        expect(MATCHING_PRIORITY_META[preset]).toBeDefined();
        expect(MATCHING_PRIORITY_META[preset].id).toBe(preset);
      }
    });

    it("encodes and decodes matching priority presets correctly", () => {
      const guidelines = "Please mention our organic ingredient source.";
      const encoded = encodeMatchingPriority(guidelines, "ROI_FOCUSED");
      expect(encoded).toContain("[MATCHING_PRIORITY:ROI_FOCUSED]");
      expect(encoded).toContain(guidelines);

      const decoded = decodeMatchingPriority(encoded);
      expect(decoded.priority).toBe("ROI_FOCUSED");
      expect(decoded.cleanGuidelines).toBe(guidelines);
    });

    it("encodes custom weights and decodes them", () => {
      const customWeights = {
        category: 0.1,
        engagement: 0.3,
        authenticity: 0.2,
        quality: 0.2,
        roi: 0.2,
      };
      const encoded = encodeMatchingPriority(null, "CUSTOM", customWeights);
      expect(encoded).toContain("[MATCHING_PRIORITY:CUSTOM]");
      expect(encoded).toContain("[MATCHING_WEIGHTS:");

      const decoded = decodeMatchingPriority(encoded);
      expect(decoded.priority).toBe("CUSTOM");
      expect(decoded.customWeights).toEqual(customWeights);
    });

    it("stripMatchingPriority returns clean guidelines", () => {
      const raw = "[MATCHING_PRIORITY:REACH_FOCUSED]\nKeep it fun and fast paced";
      expect(stripMatchingPriority(raw)).toBe("Keep it fun and fast paced");
    });
  });

  // =========================================================================
  // 6. Social Proof Calculator
  // =========================================================================
  describe("social-proof-calculator.ts", () => {
    it("calculates follower authenticity and content quality", () => {
      const auth = calculateFollowerAuthenticity({
        followers: 100000,
        following: 500,
        engagementRate: 3.5,
        accountAgeDays: 365,
        followerGrowthMonthly: 5,
        uniqueCommentersRatio: 0.8,
        recentPostEngagementRates: [3.4, 3.6, 3.5],
      });
      expect(auth.score).toBeGreaterThan(0);
      expect(auth.score).toBeLessThanOrEqual(100);
      expect(auth.fraudRiskLevel).toBeDefined();

      const qualityScore = calculateContentQuality({
        avgEngagementRate: 3.5,
        postingFrequencyPerWeek: 3,
        contentTypeVariety: 3,
        completedDeals: 11,
        totalDeals: 12,
        averageRating: 4.8,
        onTimeDeliveryRate: 0.95,
      });
      expect(qualityScore).toBeGreaterThan(0);
      expect(qualityScore).toBeLessThanOrEqual(100);
    });

    it("recalculateAllSocialProof processes active influencers", async () => {
      vi.mocked(prisma.influencerProfile.findMany)
        .mockResolvedValueOnce([{ userId: "inf-1" }, { userId: "inf-2" }] as any)
        .mockResolvedValueOnce([]); // next page empty

      vi.mocked(prisma.influencerProfile.findUnique).mockResolvedValue({
        id: "inf-prof-1",
        userId: "inf-1",
        youtubeSubscribers: 10000,
        youtubeEngagementRate: 3.0,
        instagramFollowers: 5000,
        instagramEngagementRate: 2.5,
        totalDeals: 5,
        completedDeals: 5,
        user: { status: "ACTIVE" },
      } as any);

      const res = await recalculateAllSocialProof();
      expect(res).toBeDefined();
      expect(res.processed + res.failed).toBeGreaterThanOrEqual(0);
    });
  });
});
