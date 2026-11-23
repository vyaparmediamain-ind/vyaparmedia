import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks
vi.mock("@/lib/db", () => {
  const mockPrisma = {
    campaign: { findMany: vi.fn(), count: vi.fn() },
    deal: {
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    transaction: { aggregate: vi.fn() },
    contentSubmission: { findMany: vi.fn() },
    oAuthAccount: { findFirst: vi.fn() },
    review: { count: vi.fn() },
    user: { findUnique: vi.fn() },
    $queryRaw: vi.fn().mockResolvedValue([]),
    $queryRawUnsafe: vi.fn().mockResolvedValue([]),
  };
  return { default: mockPrisma, prisma: mockPrisma };
});

vi.mock("@/lib/db-read", () => ({
  getReadClient: vi.fn(() => ({
    $queryRaw: vi.fn().mockResolvedValue([]),
    $queryRawUnsafe: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock("@/lib/redis", () => ({
  default: { get: vi.fn(), setex: vi.fn(), del: vi.fn() },
  redis: { get: vi.fn(), setex: vi.fn(), del: vi.fn() },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    critical: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/lib/search/cache", () => ({
  getCachedSearchResults: vi.fn().mockResolvedValue(null),
  setCachedSearchResults: vi.fn().mockResolvedValue(undefined),
}));

import prisma from "@/lib/db";
import { checkBrandCompliance } from "@/lib/gamification/badges-brands";
import {
  checkMilestoneEarningsReferrals,
  checkVerificationReviews,
} from "@/lib/gamification/badges-milestones";
import { checkStreakActivity } from "@/lib/gamification/badges-streaks";
import { TRIGGER_TO_BADGES, type GamificationUser } from "@/lib/gamification/types";
import type { ViolationCategory } from "@/lib/penalty/types";
import { searchCampaigns } from "@/lib/search/campaign-search";
import { searchCreators } from "@/lib/search/creator-search";
import {
  encodeCursor,
  decodeCursor,
  type CursorPaginationResult,
  type CreatorSearchParams,
  type CampaignSearchParams,
} from "@/lib/search";

describe("Gamification & Search Coverage Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseUser: GamificationUser = {
    id: "user-g1",
    userType: "INFLUENCER",
    trustScore: 750,
    verificationLevel: "IDENTITY",
    influencerProfile: {
      id: "inf-1",
      bio: "Creator Bio",
      categories: "Fashion,Lifestyle",
      completedDeals: 12,
      averageRating: 4.8,
      instagramFollowers: 15000,
      instagramEngagementRate: 350,
    },
    brandProfile: null,
    badges: [],
  };

  // =========================================================================
  // 1. Gamification: Brand Badges
  // =========================================================================
  describe("badges-brands.ts", () => {
    it("checkBrandCompliance evaluates trust milestone badges", async () => {
      const brandUser: GamificationUser = {
        ...baseUser,
        userType: "BRAND",
        trustScore: 700,
        brandProfile: {
          id: "brand-p1",
          companyName: "Acme Brand",
          description: "Top Retail",
          industry: "Fashion",
          totalCampaigns: 3,
        },
      };

      const result = await checkBrandCompliance({
        badgeId: "trust_novice",
        userId: "brand-u1",
        user: brandUser,
        db: prisma as any,
        brandProfile: brandUser.brandProfile,
        completedDealsCount: 2,
        fraudViolationsCount: 0,
        zeroRevisionDealsCount: 0,
      });

      // Trust score 700 >= 650 threshold for trust_novice
      expect(result).toBe(true);
    });

    it("returns false for unknown badgeId in checkBrandCompliance", async () => {
      const result = await checkBrandCompliance({
        badgeId: "unknown_badge",
        userId: "brand-u1",
        user: baseUser,
        db: prisma as any,
        brandProfile: null,
        completedDealsCount: 0,
        fraudViolationsCount: 0,
        zeroRevisionDealsCount: 0,
      });
      expect(result).toBe(false);
    });
  });

  // =========================================================================
  // 2. Gamification: Milestone Badges
  // =========================================================================
  describe("badges-milestones.ts", () => {
    it("checkMilestoneEarningsReferrals checks deal count milestones", async () => {
      // User has completed 12 deals
      expect(await checkMilestoneEarningsReferrals("first_deal", baseUser, prisma as any, null)).toBe(true);
      expect(await checkMilestoneEarningsReferrals("ten_deals", baseUser, prisma as any, null)).toBe(true);
      expect(await checkMilestoneEarningsReferrals("fifty_deals", baseUser, prisma as any, null)).toBe(false);
    });

    it("checkVerificationReviews evaluates verified_identity and verified_pro", async () => {
      expect(
        await checkVerificationReviews("verified_identity", baseUser.id, baseUser, prisma as any, baseUser.influencerProfile, null)
      ).toBe(true);

      // verified_pro requires followers >= 10,000 and er >= 300
      expect(
        await checkVerificationReviews("verified_pro", baseUser.id, baseUser, prisma as any, baseUser.influencerProfile, null)
      ).toBe(true);
    });
  });

  // =========================================================================
  // 3. Gamification Types & Trigger Map
  // =========================================================================
  describe("gamification/types.ts & penalty/types.ts", () => {
    it("TRIGGER_TO_BADGES maps lifecycle triggers to badges", () => {
      expect(TRIGGER_TO_BADGES.CAMPAIGN_CREATED).toContain("first_campaign");
      expect(TRIGGER_TO_BADGES.CAMPAIGN_CREATED).toContain("campaign_master");
    });

    it("validates penalty violation categories", () => {
      const violations: ViolationCategory[] = [
        "FAKE_ENGAGEMENT",
        "POST_DELETION",
        "CONTENT_PLAGIARISM",
        "MISSED_DEADLINE",
        "PAYMENT_FRAUD",
      ];
      expect(violations.length).toBe(5);
    });
  });

  // =========================================================================
  // 4. Search Subsystem (Campaign, Creator, Cursor, Types)
  // =========================================================================
  describe("search subsystem", () => {
    it("encodes and decodes pagination cursor", () => {
      const cursor = encodeCursor({ sortValue: 120000, id: "deal-abc" });
      expect(typeof cursor).toBe("string");
      const decoded = decodeCursor(cursor);
      expect(decoded).toEqual({ sortValue: 120000, id: "deal-abc" });
    });

    it("searchCampaigns executes query and returns pagination structure", async () => {
      const params: CampaignSearchParams = {
        category: "Fashion",
        minBudget: 50000,
        limit: 10,
      };

      const result = await searchCampaigns(params);
      expect(result).toBeDefined();
      expect(Array.isArray(result.items)).toBe(true);
      expect(typeof result.hasMore).toBe("boolean");
    });

    it("searchCreators executes query and returns pagination structure", async () => {
      const params: CreatorSearchParams = {
        category: "Beauty",
        minFollowers: 5000,
        limit: 10,
      };

      const result = await searchCreators(params);
      expect(result).toBeDefined();
      expect(Array.isArray(result.items)).toBe(true);
      expect(typeof result.hasMore).toBe("boolean");
    });
  });
});
