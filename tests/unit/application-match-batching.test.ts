import { describe, it, expect, vi, beforeEach } from "vitest";
import { MatchingService } from "@/services/matching.service";
import prisma from "@/lib/db";

// Mock Sentry, logger, prisma, redis
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

vi.mock("@/lib/redis", () => {
  const store = new Map<string, string>();
  return {
    redis: {
      get: vi.fn().mockImplementation((key: string) => Promise.resolve(store.get(key) || null)),
      mget: vi.fn().mockImplementation((...keys: string[]) =>
        Promise.resolve(keys.map((k) => store.get(k) || null))
      ),
      setex: vi.fn().mockImplementation((key: string, _ttl: number, val: string) => {
        store.set(key, val);
        return Promise.resolve("OK");
      }),
      pipeline: vi.fn().mockImplementation(() => {
        const batch: Array<() => void> = [];
        return {
          setex: (key: string, _ttl: number, val: string) => {
            batch.push(() => store.set(key, val));
            return this;
          },
          del: (key: string) => {
            batch.push(() => store.delete(key));
            return this;
          },
          exec: async () => {
            batch.forEach((fn) => fn());
            return Promise.resolve([]);
          },
        };
      }),
      del: vi.fn().mockImplementation((key: string) => {
        store.delete(key);
        return Promise.resolve(1);
      }),
    },
  };
});

vi.mock("@/lib/db", () => ({
  default: {
    deal: {
      findMany: vi.fn(),
    },
    engagementSnapshot: {
      findMany: vi.fn(),
    },
    review: {
      findMany: vi.fn(),
    },
    trustRuleConfig: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

describe("Batched Matching Score Optimization (O(1) Query Count Verification)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const campaign = {
    id: "camp-benchmark-100",
    targetCategories: ["Tech", "Gadgets"],
    perInfluencerBudget: 1000000, // ₹10,000
    guidelines: "Product unboxing and review",
  };

  // Generate 100 mock candidate applications
  const generateCandidates = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      influencer: {
        id: `inf-${i + 1}`,
        categories: "Tech, Gadgets",
        instagramFollowers: 50000 + i * 1000,
        instagramEngagementRate: 300 + (i % 200),
        youtubeSubscribers: 20000 + i * 500,
        youtubeEngagementRate: 250 + (i % 150),
        followerAuthenticityScore: 80 + (i % 15),
        averageRating: 450 + (i % 50),
        xp: 1500,
      },
      proposedRatePaise: 1000000,
    }));

  it("should execute exactly 3 batched DB queries for 100 applications on cold cache (O(1) vs 300+ legacy queries)", async () => {
    const candidates = generateCandidates(100);

    // Mock DB queries for the batch
    const mockDeals = candidates.map((c) => ({
      id: `deal-for-${c.influencer.id}`,
      influencerId: c.influencer.id,
    }));

    const mockSnapshots = mockDeals.map((d) => ({
      id: `snap-${d.id}`,
      dealId: d.id,
      views: 5000,
      likes: 250,
      comments: 30,
      shares: 15,
      saves: 20,
      engagementRate: 350,
      capturedAt: new Date(),
    }));

    const mockReviews = candidates.map((c) => ({
      influencerRevieweeId: c.influencer.id,
      rating: 5,
      qualityRating: 5,
      communicationRating: 5,
      timelinessRating: 5,
    }));

    (prisma.deal.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockDeals);
    (prisma.engagementSnapshot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockSnapshots);
    (prisma.review.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockReviews);

    // Track DB query count
    const dealFindManySpy = vi.spyOn(prisma.deal, "findMany");
    const snapshotFindManySpy = vi.spyOn(prisma.engagementSnapshot, "findMany");
    const reviewFindManySpy = vi.spyOn(prisma.review, "findMany");

    // Execute Batched Match Calculation
    const results = await MatchingService.calculateMatchScoresBatch(campaign, candidates);

    // Assertions
    expect(results).toHaveLength(100);
    for (const res of results) {
      expect(res.matchScore).toBeGreaterThan(0);
      expect(res.matchBreakdown.estimatedViews).toBeGreaterThan(0);
    }

    // VERIFY O(1) BATCHED DB QUERIES:
    // Deal query for influencer historical records: exactly 1 batch call (with WHERE influencerId IN (...))
    const influencerDealCalls = dealFindManySpy.mock.calls.filter((call) => {
      const where = call[0]?.where as Record<string, unknown> | undefined;
      const infFilter = where?.influencerId as { in?: string[] } | undefined;
      return Array.isArray(infFilter?.in);
    });
    expect(influencerDealCalls).toHaveLength(1);
    const dealQueryWhere = influencerDealCalls[0]?.[0]?.where as Record<string, unknown>;
    const dealInfIn = (dealQueryWhere?.influencerId as { in?: string[] })?.in;
    expect(dealInfIn).toHaveLength(100);

    // EngagementSnapshot query: exactly 1 batch call (with WHERE dealId IN (...))
    expect(snapshotFindManySpy).toHaveBeenCalledTimes(1);
    const snapQueryWhere = snapshotFindManySpy.mock.calls[0]?.[0]?.where as Record<string, unknown>;
    const snapDealIn = (snapQueryWhere?.dealId as { in?: string[] })?.in;
    expect(snapDealIn).toHaveLength(100);

    // Review query: exactly 1 batch call (with WHERE influencerRevieweeId IN (...))
    expect(reviewFindManySpy).toHaveBeenCalledTimes(1);
    const reviewQueryWhere = reviewFindManySpy.mock.calls[0]?.[0]?.where as Record<string, unknown>;
    const reviewInfIn = (reviewQueryWhere?.influencerRevieweeId as { in?: string[] })?.in;
    expect(reviewInfIn).toHaveLength(100);

    // Legacy unbatched query count would have been:
    // 100 applications * 3 DB calls = 300 queries!
    // With batching, influencer-level DB queries are strictly O(1) (1 deals + 1 snapshots + 1 reviews = 3 queries)!
    const totalInfluencerBatchQueries =
      influencerDealCalls.length +
      snapshotFindManySpy.mock.calls.length +
      reviewFindManySpy.mock.calls.length;

    expect(totalInfluencerBatchQueries).toBe(3);
  });

  it("should serve repeated page loads entirely from Redis with 0 DB queries (warm cache)", async () => {
    const candidates = generateCandidates(100);

    // Spies on DB
    const dealFindManySpy = vi.spyOn(prisma.deal, "findMany");
    const snapshotFindManySpy = vi.spyOn(prisma.engagementSnapshot, "findMany");
    const reviewFindManySpy = vi.spyOn(prisma.review, "findMany");

    // Since the previous test executed and wrote the 100 scores into the mock redis store,
    // this execution should be an instant 100% cache hit!
    const cachedResults = await MatchingService.calculateMatchScoresBatch(campaign, candidates);

    expect(cachedResults).toHaveLength(100);
    // 0 database queries executed!
    expect(dealFindManySpy).toHaveBeenCalledTimes(0);
    expect(snapshotFindManySpy).toHaveBeenCalledTimes(0);
    expect(reviewFindManySpy).toHaveBeenCalledTimes(0);
  });

  it("should correctly distribute batched engagement metrics and quality scores per-influencer", async () => {
    const infA = "inf-distinct-A";
    const infB = "inf-distinct-B";

    (prisma.deal.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "deal-A", influencerId: infA },
      { id: "deal-B", influencerId: infB },
    ]);

    (prisma.engagementSnapshot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      // Inf A has 10,000 views and 500 interactions (5% ER)
      {
        id: "snap-A",
        dealId: "deal-A",
        views: 10000,
        likes: 400,
        comments: 60,
        shares: 20,
        saves: 20,
        engagementRate: 500,
        capturedAt: new Date(),
      },
      // Inf B has 20,000 views and 400 interactions (2% ER)
      {
        id: "snap-B",
        dealId: "deal-B",
        views: 20000,
        likes: 300,
        comments: 50,
        shares: 25,
        saves: 25,
        engagementRate: 200,
        capturedAt: new Date(),
      },
    ]);

    const engagementRates = await MatchingService.batchGetHistoricalEngagementRates([infA, infB]);

    expect(engagementRates.get(infA)?.rate).toBe(5);
    expect(engagementRates.get(infA)?.hasData).toBe(true);

    expect(engagementRates.get(infB)?.rate).toBe(2);
    expect(engagementRates.get(infB)?.hasData).toBe(true);
  });
});
