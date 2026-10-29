import { describe, it, expect } from "vitest";
import {
  getInfluencerQualitativeBreakdown,
  getBrandQualitativeBreakdown,
  getDRSTierLabel,
  InfluencerDRSFactors,
  BrandDRSFactors,
} from "@/lib/drs-score";

describe("Qualitative Reputation Transparency (Anti-Reverse-Engineering Guard)", () => {
  const mockInfluencerFactors: InfluencerDRSFactors = {
    completedDeals: 12,
    totalEarningsPaise: 5000000,
    disputesLost: 0,
    dealBuckets: { recent: 5, mid: 4, old: 3 },
    reviewBuckets: { recent: 6, mid: 3, old: 1 },
    uniqueReviewersCount: 8,
    onTimeBuckets: { recent: 5, mid: 4, old: 3 },
    disputeWonBuckets: { recent: 1, mid: 0, old: 0 },
    lateDeliveryBuckets: { recent: 0, mid: 0, old: 0 },
    poorReviewBuckets: { recent: 0, mid: 0, old: 0 },
    contentRejectionBuckets: { recent: 0, mid: 1, old: 0 },
    disputeLostBuckets: { recent: 0, mid: 0, old: 0 },
    identityVerified: true,
    accountAgeDays: 180,
    engagementRate: 4.2,
    fakeFollowersDetected: false,
    termsViolations: 0,
    paymentFraudAttempts: 0,
    successfulReferrals: 4,
    avgReferralDRS: 720,
    profileCompleteness: 95,
  };

  const mockBrandFactors: BrandDRSFactors = {
    completedCampaigns: 8,
    fastApprovals: 6,
    lateApprovals: 0,
    fairReviews: 7,
    uniqueInfluencersCount: 6,
    disputesLost: 0,
    companyVerified: true,
    paymentReliability: 1.0,
    termsViolations: 0,
    longTermPartnerships: 2,
    unfairRejections: 0,
    influencerComplaints: 0,
  };

  it("returns only high-level categories and qualitative statuses for influencers", () => {
    const { categories, guidance } = getInfluencerQualitativeBreakdown(mockInfluencerFactors, 760);

    expect(categories.length).toBeGreaterThanOrEqual(4);

    const validStatuses = new Set(["Exceptional", "Good", "Building", "Starting Out", "Needs Attention"]);

    for (const cat of categories) {
      expect(typeof cat.category).toBe("string");
      expect(validStatuses.has(cat.status)).toBe(true);
      expect(typeof cat.description).toBe("string");
    }

    // Must have generic guidance
    expect(guidance.length).toBeGreaterThan(0);
    for (const tip of guidance) {
      expect(typeof tip).toBe("string");
    }
  });

  it("strictly omits point values, impact numbers, and weight constants from influencer breakdown", () => {
    const { categories, guidance } = getInfluencerQualitativeBreakdown(mockInfluencerFactors, 760);
    const jsonStr = JSON.stringify({ categories, guidance });

    // Ensure raw calculation fields and formula terms are never leaked
    expect(jsonStr).not.toContain('"impact"');
    expect(jsonStr).not.toContain('"weight"');
    expect(jsonStr).not.toContain('"rawWeight"');
    expect(jsonStr).not.toContain('"bonusPoints"');
    expect(jsonStr).not.toContain("BONUS_CAP");
    expect(jsonStr).not.toContain("decayFactor");
    expect(jsonStr).not.toContain("recencyWeighted");
    expect(jsonStr).not.toContain("cap=");
    expect(jsonStr).not.toContain("+15");
    expect(jsonStr).not.toContain("+30");
    expect(jsonStr).not.toContain("-240");
  });

  it("provides appropriate qualitative guidance without reverse-engineerable gaming instructions", () => {
    const strugglingFactors: InfluencerDRSFactors = {
      ...mockInfluencerFactors,
      completedDeals: 1,
      lateDeliveryBuckets: { recent: 2, mid: 1, old: 0 },
      poorReviewBuckets: { recent: 1, mid: 0, old: 0 },
      identityVerified: false,
    };

    const { categories, guidance } = getInfluencerQualitativeBreakdown(strugglingFactors, 450);

    // Categories reflect issues qualitatively
    const timeliness = categories.find((c) => c.category === "Fulfillment & Timeliness");
    expect(timeliness?.status).toBe("Needs Attention");

    const reviews = categories.find((c) => c.category === "Client Reviews");
    expect(reviews?.status).toBe("Needs Attention");

    const longevity = categories.find((c) => c.category === "Account Longevity");
    expect(longevity?.status).toBe("Needs Attention");

    // Guidance is constructive and generic, not telling the user "Do exactly 3 deals to get +45 points"
    const guidanceText = guidance.join(" ");
    expect(guidanceText).toContain("deadlines");
    expect(guidanceText).toContain("verification");
    expect(guidanceText).not.toMatch(/\+\d+\s*points/i);
    expect(guidanceText).not.toMatch(/formula/i);
    expect(guidanceText).not.toMatch(/multiplier/i);
  });

  it("returns clean qualitative breakdown for brands without formula leakage", () => {
    const { categories, guidance } = getBrandQualitativeBreakdown(mockBrandFactors, 800);

    expect(categories.length).toBeGreaterThanOrEqual(3);
    const jsonStr = JSON.stringify({ categories, guidance });

    expect(jsonStr).not.toContain('"impact"');
    expect(jsonStr).not.toContain('"weight"');
    expect(jsonStr).not.toContain("cap=");
    expect(jsonStr).not.toContain("-150");
  });

  it("maps DRS tiers to friendly descriptive labels", () => {
    expect(getDRSTierLabel("ELITE")).toBe("Elite Partner (Tier 5)");
    expect(getDRSTierLabel("TRUSTED")).toBe("Trusted Partner (Tier 4)");
    expect(getDRSTierLabel("NORMAL")).toBe("Verified Partner (Tier 3)");
    expect(getDRSTierLabel("LIMITED")).toBe("Provisional Partner (Tier 2)");
    expect(getDRSTierLabel("FLAGGED")).toBe("Restricted Partner (Tier 1)");
  });
});
