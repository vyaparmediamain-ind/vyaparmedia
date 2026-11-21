import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTierFromCount, processReferralReward } from "@/lib/referral-engine";
import prisma from "@/lib/db";

// Mock redis
vi.mock("@/lib/redis", () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    setex: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
  },
}));

vi.mock("@/lib/db", () => {
  const dbMock: any = {
    user: {
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    wallet: {
      upsert: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn(),
    },
    transaction: {
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "tx_ref_123" }),
    },
    scoutProfile: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    deal: {
      count: vi.fn().mockResolvedValue(0),
    },
    $transaction: vi.fn(async (cb: any) => cb(dbMock)),
  };
  return {
    default: dbMock,
    ensurePlatformTreasury: vi.fn().mockResolvedValue({
      id: "treasury_w_id",
      userId: "PLATFORM_TREASURY",
      balance: 100000000,
    }),
  };
});

vi.mock("@/services/notification.service", () => ({
  NotificationService: {
    createNotification: vi.fn().mockResolvedValue({ id: "notif_123" }),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Dual-Incentive Referral Engine: 1% Cash Royalty + Milestone Fee Discount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Tier Definitions & Hybrid Rewards", () => {
    it("Starter (0 referrals): Day 1 1% GMV Cash Royalty with 0% fee discount", () => {
      const tier = getTierFromCount(0);
      expect(tier.name).toBe("STARTER");
      expect(tier.revenueShare).toBe(0.01); // 1% Cash Royalty from day 1!
      expect(tier.feeDiscount).toBe(0);
    });

    it("Bronze (10 referrals): 1% Cash Royalty + 1% Fee Discount on own deals + 250 XP", () => {
      const tier = getTierFromCount(10);
      expect(tier.name).toBe("BRONZE");
      expect(tier.revenueShare).toBe(0.01);
      expect(tier.feeDiscount).toBe(1);
      expect(tier.xpReward).toBe(250);
    });

    it("Silver (50 referrals): 1% Cash Royalty + 1.5% Fee Discount on own deals + 1500 XP", () => {
      const tier = getTierFromCount(50);
      expect(tier.name).toBe("SILVER");
      expect(tier.revenueShare).toBe(0.01);
      expect(tier.feeDiscount).toBe(1.5);
      expect(tier.xpReward).toBe(1500);
    });

    it("Gold (100 referrals): 1% Cash Royalty + 2% Fee Discount on own deals + 3500 XP", () => {
      const tier = getTierFromCount(100);
      expect(tier.name).toBe("GOLD");
      expect(tier.revenueShare).toBe(0.01);
      expect(tier.feeDiscount).toBe(2);
      expect(tier.xpReward).toBe(3500);
    });

    it("Platinum (500 referrals): Flat 1% Cash Royalty + 2% Fee Discount", () => {
      const tier = getTierFromCount(500);
      expect(tier.name).toBe("PLATINUM");
      expect(tier.revenueShare).toBe(0.01);
      expect(tier.feeDiscount).toBe(2);
    });

    it("Diamond (1000+ referrals): Flat 1% Cash Royalty + 2% Fee Discount", () => {
      const tier = getTierFromCount(1000);
      expect(tier.name).toBe("DIAMOND");
      expect(tier.revenueShare).toBe(0.01);
      expect(tier.feeDiscount).toBe(2);
    });
  });

  describe("Day 1 Payout: Creator/Brand receives 1% Cash on First Referral Deal", () => {
    it("credits 1% royalty to Referrer wallet on deal completion (Starter tier, 1 referral)", async () => {
      const mockTx = {
        user: {
          findUnique: vi.fn().mockImplementation(async ({ where }) => {
            if (where.id === "referred_creator_user") {
              return {
                id: "referred_creator_user",
                referredBy: "referring_creator_user",
                userType: "INFLUENCER",
                trustScore: 750,
                createdAt: new Date(),
                influencerProfile: { id: "inf_p_1", completedDeals: 1 },
              };
            }
            if (where.id === "referring_creator_user") {
              return {
                id: "referring_creator_user",
                userType: "INFLUENCER",
                trustScore: 800,
                createdAt: new Date(),
                badges: [],
              };
            }
            return null;
          }),
          count: vi.fn().mockResolvedValue(1), // 1 active referral (Starter Tier)
        },
        scoutProfile: {
          findUnique: vi.fn().mockResolvedValue(null), // Referrer is a Creator, NOT a scout
        },
        wallet: {
          upsert: vi.fn().mockResolvedValue({ id: "referrer_wallet_id", userId: "referring_creator_user" }),
          findUnique: vi.fn().mockResolvedValue({ id: "referrer_wallet_id", userId: "referring_creator_user" }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }), // Treasury debit
          update: vi.fn().mockResolvedValue({ id: "referrer_wallet_id" }), // Referrer credit
        },
        transaction: {
          findUnique: vi.fn().mockResolvedValue(null), // Idempotency check
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: "tx_payout_1" }),
        },
        deal: {
          count: vi.fn().mockResolvedValue(0),
        },
        badge: {
          findMany: vi.fn().mockResolvedValue([]),
          createMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
        userBadge: {
          findMany: vi.fn().mockResolvedValue([]),
          createMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      } as any;

      // ₹10,000 Deal = 1,000,000 paise. 1% Royalty = 10,000 paise (₹100).
      const result = await processReferralReward(
        "referred_creator_user",
        1_000_000,
        mockTx,
        "treasury_wallet_id",
        "deal_starter_001"
      );

      expect(result).toBeDefined();
      expect(result?.referrerId).toBe("referring_creator_user");

      // Verify Treasury was debited by 10,000 paise (₹100)
      expect(mockTx.wallet.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: "treasury_wallet_id",
            balance: { gte: 10_000 },
          }),
          data: { balance: { decrement: 10_000 } },
        })
      );

      // Verify Referrer wallet was credited by 10,000 paise (₹100)
      expect(mockTx.wallet.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "referrer_wallet_id" },
          data: expect.objectContaining({
            balance: { increment: 10_000 },
            totalEarned: { increment: 10_000 },
          }),
        })
      );

      // Verify double-entry transactions recorded
      expect(mockTx.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            walletId: "treasury_wallet_id",
            type: "DEBIT",
            amount: 10_000,
          }),
        })
      );

      expect(mockTx.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            walletId: "referrer_wallet_id",
            type: "CREDIT",
            amount: 10_000,
          }),
        })
      );
    });
  });

  describe("Deduplication Guard with Scout Program", () => {
    it("skips referral monetary payout if referrer is an approved Scout (ScoutService handles it)", async () => {
      const mockTx = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: "some_creator",
            referredBy: "scout_user_99",
          }),
        },
        scoutProfile: {
          findUnique: vi.fn().mockResolvedValue({
            userId: "scout_user_99",
            verificationStatus: "APPROVED",
          }),
        },
        wallet: {
          updateMany: vi.fn(),
          update: vi.fn(),
        },
        transaction: {
          create: vi.fn(),
        },
      } as any;

      const result = await processReferralReward(
        "some_creator",
        1_000_000,
        mockTx,
        "treasury_wallet_id",
        "deal_scout_dup_1"
      );

      expect(result?.referrerId).toBe("scout_user_99");
      // Double payout blocked: wallet was not debited or credited by processReferralReward
      expect(mockTx.wallet.updateMany).not.toHaveBeenCalled();
      expect(mockTx.wallet.update).not.toHaveBeenCalled();
    });
  });
});
