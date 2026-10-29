import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import {
  calculateReviewDiversityRatio,
  calculateInfluencerDRS,
  InfluencerDRSFactors,
} from "@/lib/drs-score";
import prisma from "@/lib/db";
import { detectCollusionPatterns } from "@/lib/trust-engine";

// Mock prisma and logger for unit test simulation
vi.mock("@/lib/db", () => {
  const mockPrisma: Record<string, unknown> = {
    user: {
      findUnique: vi.fn(),
    },
    deal: {
      findMany: vi.fn(),
    },
    reviewFlagRecord: {
      upsert: vi.fn(),
    },
  };
  return { default: mockPrisma };
});

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Collusion & Wash-Trading Prevention Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Diversity Metric (calculateReviewDiversityRatio)", () => {
    it("permits full weight (1.0) for accounts with 2 or fewer total reviews to avoid penalizing beginners", () => {
      expect(calculateReviewDiversityRatio(1, 1)).toBe(1.0);
      expect(calculateReviewDiversityRatio(1, 2)).toBe(1.0);
      expect(calculateReviewDiversityRatio(2, 2)).toBe(1.0);
    });

    it("severely penalizes repeated reviews from a single counterparty (collusion / wash-trading)", () => {
      // 5 reviews from only 1 single brand -> 1 / 5 = 0.20 (80% penalty)
      const singlePartnerRatio = calculateReviewDiversityRatio(1, 5);
      expect(singlePartnerRatio).toBeCloseTo(0.2, 5);

      // 10 reviews from 1 partner -> 1 / 10 = 0.10 (90% penalty)
      expect(calculateReviewDiversityRatio(1, 10)).toBeCloseTo(0.1, 5);

      // 10 reviews from 2 partners -> 2 / 10 = 0.20
      expect(calculateReviewDiversityRatio(2, 10)).toBeCloseTo(0.2, 5);
    });

    it("awards full weight (1.0) when reviews come from unique counterparties", () => {
      expect(calculateReviewDiversityRatio(5, 5)).toBe(1.0);
      expect(calculateReviewDiversityRatio(10, 10)).toBe(1.0);
      expect(calculateReviewDiversityRatio(8, 10)).toBe(0.8);
    });

    it("handles boundary edge cases safely", () => {
      expect(calculateReviewDiversityRatio(0, 5)).toBe(0.0);
      expect(calculateReviewDiversityRatio(-1, 5)).toBe(0.0);
      // Unique greater than total should cap at 1.0
      expect(calculateReviewDiversityRatio(12, 10)).toBe(1.0);
    });
  });

  describe("DRS Impact: Collusion vs Organic Reviews", () => {
    const baseFactors: InfluencerDRSFactors = {
      completedDeals: 5,
      totalEarningsPaise: 500000,
      disputesLost: 0,
      dealBuckets: { recent: 5, mid: 0, old: 0 },
      reviewBuckets: { recent: 5, mid: 0, old: 0 },
      uniqueReviewersCount: 1, // Collusion: 5 reviews from same 1 brand
      onTimeBuckets: { recent: 5, mid: 0, old: 0 },
      disputeWonBuckets: { recent: 0, mid: 0, old: 0 },
      lateDeliveryBuckets: { recent: 0, mid: 0, old: 0 },
      poorReviewBuckets: { recent: 0, mid: 0, old: 0 },
      contentRejectionBuckets: { recent: 0, mid: 0, old: 0 },
      disputeLostBuckets: { recent: 0, mid: 0, old: 0 },
      identityVerified: false,
      accountAgeDays: 30,
      engagementRate: 2.0,
      fakeFollowersDetected: false,
      termsViolations: 0,
      paymentFraudAttempts: 0,
      successfulReferrals: 0,
      avgReferralDRS: 0,
      profileCompleteness: 80,
    };

    it("colluding account (5 reviews from 1 partner) receives only 20% of 5-star review bonus", () => {
      // 1. Colluding Influencer (all 5 reviews from 1 brand)
      const colludingResult = calculateInfluencerDRS(baseFactors);
      const colludingReviewItem = colludingResult.breakdown.find(
        (b) => b.factor === "5-Star Quality"
      );

      // 2. Organic Influencer (5 reviews from 5 distinct brands)
      const organicFactors: InfluencerDRSFactors = {
        ...baseFactors,
        uniqueReviewersCount: 5,
      };
      const organicResult = calculateInfluencerDRS(organicFactors);
      const organicReviewItem = organicResult.breakdown.find(
        (b) => b.factor === "5-Star Quality"
      );

      expect(colludingReviewItem).toBeDefined();
      expect(organicReviewItem).toBeDefined();

      // Organic account gets full review bonus
      // With tieredBonus(5, 30, 3, 3, 150):
      // First 3 deals = 3 * 30 = 90
      // Next 2 deals = 2 * (30/2) = 30
      // Total raw bonus = 120
      expect(organicReviewItem?.impact).toBe(120);

      // Colluding account with 1/5 ratio gets Math.round(120 * 0.20) = 24
      expect(colludingReviewItem?.impact).toBe(24);

      // Ensure the explanation indicates diversity penalty was applied
      expect(colludingReviewItem?.reason).toContain("diversity penalty: 1/5 unique counterparties (20%)");
      expect(colludingReviewItem?.reason).toContain("scaled 120 → 24 pts");

      // Collusion attempt prevents score inflation
      expect(organicResult.score).toBeGreaterThan(colludingResult.score + 90);
    });
  });

  describe("Collusion Detection Algorithm (detectCollusionPatterns)", () => {
    const INFLUENCER_ID = "test-influencer-collusion-1";
    const BRAND_ID = "test-brand-collusion-2";

    it("flags a pair with repeated minimum-threshold deals and mutual 5-star reviews", async () => {
      // Simulate User lookup
      (prisma.user.findUnique as unknown as Mock).mockResolvedValue({
        id: INFLUENCER_ID,
        userType: "INFLUENCER",
      });

      // Simulate 4 deals between the SAME pair:
      // - amount is ₹600 (DRS_QUALIFIED_DEAL_VALUE_PAISE is ₹500, <= 2x threshold ₹1000)
      // - both brand and influencer gave rating 5
      const mockCollusionDeals = [
        {
          id: "deal-col-1",
          amount: 60000, // ₹600.00
          influencer: { userId: INFLUENCER_ID },
          brand: { userId: BRAND_ID },
          reviews: [
            { reviewerId: BRAND_ID, receiverId: INFLUENCER_ID, rating: 5, reviewerType: "BRAND" },
            { reviewerId: INFLUENCER_ID, receiverId: BRAND_ID, rating: 5, reviewerType: "INFLUENCER" },
          ],
        },
        {
          id: "deal-col-2",
          amount: 55000, // ₹550.00
          influencer: { userId: INFLUENCER_ID },
          brand: { userId: BRAND_ID },
          reviews: [
            { reviewerId: BRAND_ID, receiverId: INFLUENCER_ID, rating: 5, reviewerType: "BRAND" },
            { reviewerId: INFLUENCER_ID, receiverId: BRAND_ID, rating: 5, reviewerType: "INFLUENCER" },
          ],
        },
        {
          id: "deal-col-3",
          amount: 50000, // ₹500.00 (exact threshold)
          influencer: { userId: INFLUENCER_ID },
          brand: { userId: BRAND_ID },
          reviews: [
            { reviewerId: BRAND_ID, receiverId: INFLUENCER_ID, rating: 5, reviewerType: "BRAND" },
            { reviewerId: INFLUENCER_ID, receiverId: BRAND_ID, rating: 5, reviewerType: "INFLUENCER" },
          ],
        },
        {
          id: "deal-col-4",
          amount: 70000, // ₹700.00
          influencer: { userId: INFLUENCER_ID },
          brand: { userId: BRAND_ID },
          reviews: [
            { reviewerId: BRAND_ID, receiverId: INFLUENCER_ID, rating: 5, reviewerType: "BRAND" },
            { reviewerId: INFLUENCER_ID, receiverId: BRAND_ID, rating: 5, reviewerType: "INFLUENCER" },
          ],
        },
      ];

      (prisma.deal.findMany as unknown as Mock).mockResolvedValue(mockCollusionDeals);
      (prisma.reviewFlagRecord.upsert as unknown as Mock).mockResolvedValue({ id: "flag-rec-1" });

      await detectCollusionPatterns(INFLUENCER_ID);

      // Verify upsert was called with high risk score and PENDING status
      expect(prisma.reviewFlagRecord.upsert).toHaveBeenCalledTimes(1);
      const upsertArgs = (prisma.reviewFlagRecord.upsert as unknown as Mock).mock.calls[0]![0];

      expect(upsertArgs.where).toEqual({
        influencerUserId_brandUserId: {
          influencerUserId: INFLUENCER_ID,
          brandUserId: BRAND_ID,
        },
      });

      // 4 out of 4 deals suspicious -> 100% risk score
      expect(upsertArgs.create.totalDealsInPair).toBe(4);
      expect(upsertArgs.create.suspiciousDealCount).toBe(4);
      expect(upsertArgs.create.riskScore).toBe(100);
      expect(upsertArgs.create.avgDealAmountPaise).toBeGreaterThan(0);
      expect(upsertArgs.create.flagReason).toContain("4 mutual 5-star deals (of 4 total)");
      expect(upsertArgs.update.status).toEqual({ set: "PENDING" });
    });

    it("does not flag pairs with high-value authentic deals above the threshold multiplier", async () => {
      (prisma.user.findUnique as unknown as Mock).mockResolvedValue({
        id: INFLUENCER_ID,
        userType: "INFLUENCER",
      });

      // Deals with high amounts (e.g. ₹5,000, ₹10,000) are commercial campaigns, not wash-trading
      const authenticDeals = [
        {
          id: "deal-auth-1",
          amount: 500000, // ₹5,000.00 (> 2x threshold of ₹1,000)
          influencer: { userId: INFLUENCER_ID },
          brand: { userId: BRAND_ID },
          reviews: [
            { reviewerId: BRAND_ID, receiverId: INFLUENCER_ID, rating: 5, reviewerType: "BRAND" },
            { reviewerId: INFLUENCER_ID, receiverId: BRAND_ID, rating: 5, reviewerType: "INFLUENCER" },
          ],
        },
        {
          id: "deal-auth-2",
          amount: 800000, // ₹8,000.00
          influencer: { userId: INFLUENCER_ID },
          brand: { userId: BRAND_ID },
          reviews: [
            { reviewerId: BRAND_ID, receiverId: INFLUENCER_ID, rating: 5, reviewerType: "BRAND" },
            { reviewerId: INFLUENCER_ID, receiverId: BRAND_ID, rating: 5, reviewerType: "INFLUENCER" },
          ],
        },
        {
          id: "deal-auth-3",
          amount: 1200000, // ₹12,000.00
          influencer: { userId: INFLUENCER_ID },
          brand: { userId: BRAND_ID },
          reviews: [
            { reviewerId: BRAND_ID, receiverId: INFLUENCER_ID, rating: 5, reviewerType: "BRAND" },
            { reviewerId: INFLUENCER_ID, receiverId: BRAND_ID, rating: 5, reviewerType: "INFLUENCER" },
          ],
        },
      ];

      (prisma.deal.findMany as unknown as Mock).mockResolvedValue(authenticDeals);

      await detectCollusionPatterns(INFLUENCER_ID);

      // No collusion record should be created/updated because suspicious count < 3
      expect(prisma.reviewFlagRecord.upsert).not.toHaveBeenCalled();
    });

    it("does not flag pairs where mutual reviews are not 5-star ratings", async () => {
      (prisma.user.findUnique as unknown as Mock).mockResolvedValue({
        id: INFLUENCER_ID,
        userType: "INFLUENCER",
      });

      // Low value deals, but ratings are 4, 3, etc. (organic reviews, not 5-star wash trading)
      const mixedReviewDeals = [
        {
          id: "deal-mixed-1",
          amount: 60000,
          influencer: { userId: INFLUENCER_ID },
          brand: { userId: BRAND_ID },
          reviews: [
            { reviewerId: BRAND_ID, receiverId: INFLUENCER_ID, rating: 4, reviewerType: "BRAND" },
            { reviewerId: INFLUENCER_ID, receiverId: BRAND_ID, rating: 5, reviewerType: "INFLUENCER" },
          ],
        },
        {
          id: "deal-mixed-2",
          amount: 60000,
          influencer: { userId: INFLUENCER_ID },
          brand: { userId: BRAND_ID },
          reviews: [
            { reviewerId: BRAND_ID, receiverId: INFLUENCER_ID, rating: 5, reviewerType: "BRAND" },
            { reviewerId: INFLUENCER_ID, receiverId: BRAND_ID, rating: 3, reviewerType: "INFLUENCER" },
          ],
        },
        {
          id: "deal-mixed-3",
          amount: 60000,
          influencer: { userId: INFLUENCER_ID },
          brand: { userId: BRAND_ID },
          reviews: [
            { reviewerId: BRAND_ID, receiverId: INFLUENCER_ID, rating: 4, reviewerType: "BRAND" },
            { reviewerId: INFLUENCER_ID, receiverId: BRAND_ID, rating: 4, reviewerType: "INFLUENCER" },
          ],
        },
      ];

      (prisma.deal.findMany as unknown as Mock).mockResolvedValue(mixedReviewDeals);

      await detectCollusionPatterns(INFLUENCER_ID);

      expect(prisma.reviewFlagRecord.upsert).not.toHaveBeenCalled();
    });
  });
});
