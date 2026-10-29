import { describe, it, expect } from "vitest";
import {
  calculateLevel,
  getPlatformFeePercentage,
  calculateInfluencerDRS,
  calculateBrandDRS,
  clampDRSScore,
  getDRSTierAndLimit,
  type InfluencerDRSFactors,
  type BrandDRSFactors,
} from "@/lib/drs-score";
import {
  DEFAULT_BRAND_PLATFORM_FEE_PERCENT,
  DEFAULT_GATEWAY_FEE_PERCENT,
  TDS_194O_RATE,
  TDS_194J_RATE,
  TDS_194O_THRESHOLD_PAISE,
} from "@/constants";

describe("Unit Tests: Fee, Tax & Commission Calculation", () => {
  describe("DRS Level & Platform Fee Brackets", () => {
    it("should calculate user level correctly from XP", () => {
      expect(calculateLevel(0).level).toBe(1);
      expect(calculateLevel(500).level).toBe(2);
      expect(calculateLevel(1500).level).toBe(3);
    });

    it("should return decreasing platform fee percentage as creator/brand level increases", () => {
      const feeLevel1 = getPlatformFeePercentage(1);
      const feeLevel5 = getPlatformFeePercentage(5);
      const feeLevel10 = getPlatformFeePercentage(10);

      expect(feeLevel1).toBe(10); // Base fee is 10%
      expect(feeLevel5).toBe(9);  // Level 4-5 is 9%
      expect(feeLevel10).toBe(7); // Level 8+ is 7%
      expect(feeLevel1).toBeGreaterThan(feeLevel5);
      expect(feeLevel5).toBeGreaterThan(feeLevel10);
    });
  });

  describe("TDS Calculation Rules (Section 194-O vs 194-J)", () => {
    // Section 194-O: E-commerce platform threshold is Rs 5,00,000 (50,000,000 paise) at 0.1%
    const TDS_THRESHOLD_PAISE = TDS_194O_THRESHOLD_PAISE;

    it("should withhold 0 TDS under Section 194-O if cumulative payout is below threshold", () => {
      const cumulativePriorPayout = 20_000_000; // Rs 2,00,000
      const currentPayout = 10_000_000;         // Rs 1,00,000
      const total = cumulativePriorPayout + currentPayout; // Rs 3,00,000 < Rs 5,00,000

      let tds = 0;
      if (total > TDS_THRESHOLD_PAISE) {
        const taxablePortion = total - TDS_THRESHOLD_PAISE;
        tds = Math.round(taxablePortion * TDS_194O_RATE);
      }

      expect(tds).toBe(0);
    });

    it("should withhold 0.1% TDS on the portion crossing the Section 194-O threshold", () => {
      const cumulativePriorPayout = 45_000_000; // Rs 4.5 Lakhs
      const currentPayout = 10_000_000;         // Rs 1.0 Lakh
      const total = cumulativePriorPayout + currentPayout; // Rs 5.5 Lakhs (50k over threshold)

      const taxablePortion = total - TDS_THRESHOLD_PAISE; // Rs 50,000 = 5,000,000 paise
      const tds = Math.round(taxablePortion * TDS_194O_RATE); // 0.1% of 5,000,000 = 5,000 paise (Rs 50)

      expect(taxablePortion).toBe(5_000_000);
      expect(tds).toBe(5000); // Rs 50
    });

    it("should withhold 10% TDS under Section 194-J for professional services without threshold", () => {
      const grossPayout = 10_000_000; // Rs 1,00,000 (10M paise)
      const tds = Math.round(grossPayout * TDS_194J_RATE);

      expect(tds).toBe(1_000_000); // 10% = 10,000 INR (1M paise)
      const netPayout = grossPayout - tds;
      expect(netPayout).toBe(9_000_000);
    });
  });

  describe("Complete Deal Settlement Reconciliation", () => {
    it("should cleanly reconcile gross deal budget into platform fee, gateway fee, and influencer payout", () => {
      const dealAmount = 100_000_00; // Rs 1,00,000
      const platformFeePercent = DEFAULT_BRAND_PLATFORM_FEE_PERCENT;  // 10%
      const platformFee = Math.round((dealAmount * platformFeePercent) / 100); // 10,000 INR
      const gatewayFeePercent = DEFAULT_GATEWAY_FEE_PERCENT;   // 2%
      const gatewayFee = Math.round((dealAmount * gatewayFeePercent) / 100);   // 2,000 INR

      const grossInfluencerPayout = dealAmount - platformFee - gatewayFee;

      // Section 194-O tax on payout
      const tdsAmount = Math.round(grossInfluencerPayout * TDS_194O_RATE);
      const netInfluencerPayout = grossInfluencerPayout - tdsAmount;

      expect(dealAmount).toBe(platformFee + gatewayFee + grossInfluencerPayout);
      expect(grossInfluencerPayout).toBe(88_000_00); // Rs 88,000
      expect(tdsAmount).toBe(88_00); // Rs 88
      expect(netInfluencerPayout).toBe(87_912_00); // Rs 87,912
      expect(netInfluencerPayout + tdsAmount + platformFee + gatewayFee).toBe(dealAmount);
    });
  });

  describe("DRS Reputation Calculator & Tier Limits", () => {
    it("should clamp DRS scores within the 300 to 900 CIBIL range", () => {
      expect(clampDRSScore(-50)).toBe(300);
      expect(clampDRSScore(200)).toBe(300);
      expect(clampDRSScore(450.4)).toBe(450);
      expect(clampDRSScore(950)).toBe(900);
    });

    it("should map scores to appropriate tiers and deal amount ceilings", () => {
      expect(getDRSTierAndLimit(400)).toEqual({ tier: "FLAGGED", maxDealAmount: 0 });
      expect(getDRSTierAndLimit(500)).toEqual({ tier: "LIMITED", maxDealAmount: 500000 });
      expect(getDRSTierAndLimit(650)).toEqual({ tier: "NORMAL", maxDealAmount: 2500000 });
      expect(getDRSTierAndLimit(800)).toEqual({ tier: "TRUSTED", maxDealAmount: 10000000 });
      expect(getDRSTierAndLimit(890)).toEqual({ tier: "ELITE", maxDealAmount: -1 });
    });

    it("should calculate influencer DRS incorporating positive factors and penalties", () => {
      const factors: InfluencerDRSFactors = {
        completedDeals: 10,
        totalEarningsPaise: 50000000,
        disputesLost: 0,
        // All activity placed in recent bucket for strongest score
        dealBuckets:              { recent: 10, mid: 0, old: 0 },
        reviewBuckets:            { recent: 8,  mid: 0, old: 0 },
        onTimeBuckets:            { recent: 9,  mid: 0, old: 0 },
        disputeWonBuckets:        { recent: 1,  mid: 0, old: 0 },
        lateDeliveryBuckets:      { recent: 1,  mid: 0, old: 0 },
        poorReviewBuckets:        { recent: 0,  mid: 0, old: 0 },
        contentRejectionBuckets:  { recent: 1,  mid: 0, old: 0 },
        disputeLostBuckets:       { recent: 0,  mid: 0, old: 0 },
        identityVerified: true,
        accountAgeDays: 400,
        engagementRate: 4.5,
        fakeFollowersDetected: false,
        termsViolations: 0,
        paymentFraudAttempts: 0,
        avgReferralDRS: 700,
        successfulReferrals: 3,
        profileCompleteness: 100,
      };

      const result = calculateInfluencerDRS(factors);
      expect(result.score).toBeGreaterThanOrEqual(700);
      expect(result.tier).toMatch(/TRUSTED|ELITE/);
      expect(result.breakdown.length).toBeGreaterThan(0);
    });

    it("should heavily penalize fake followers and fraud attempts", () => {
      const fraudulentFactors: InfluencerDRSFactors = {
        completedDeals: 2,
        totalEarningsPaise: 1000000,
        disputesLost: 2,
        dealBuckets:              { recent: 2,  mid: 0, old: 0 },
        reviewBuckets:            { recent: 0,  mid: 0, old: 0 },
        onTimeBuckets:            { recent: 1,  mid: 0, old: 0 },
        disputeWonBuckets:        { recent: 0,  mid: 0, old: 0 },
        lateDeliveryBuckets:      { recent: 2,  mid: 0, old: 0 },
        poorReviewBuckets:        { recent: 2,  mid: 0, old: 0 },
        contentRejectionBuckets:  { recent: 3,  mid: 0, old: 0 },
        disputeLostBuckets:       { recent: 2,  mid: 0, old: 0 },
        identityVerified: false,
        accountAgeDays: 10,
        engagementRate: 0.5,
        fakeFollowersDetected: true,
        termsViolations: 1,
        paymentFraudAttempts: 1,
        avgReferralDRS: 0,
        successfulReferrals: 0,
        profileCompleteness: 30,
      };

      const result = calculateInfluencerDRS(fraudulentFactors);
      expect(result.score).toBe(300); // Clamped at minimum
      expect(result.tier).toBe("FLAGGED");
      expect(result.maxDealAmount).toBe(0);
    });

    it("should calculate brand DRS correctly", () => {
      const brandFactors: BrandDRSFactors = {
        completedCampaigns: 5,
        fastApprovals: 8,
        lateApprovals: 0,
        fairReviews: 5,
        disputesLost: 0,
        companyVerified: true,
        paymentReliability: 1.0,
        termsViolations: 0,
        longTermPartnerships: 2,
        unfairRejections: 0,
        influencerComplaints: 0,
      };

      const result = calculateBrandDRS(brandFactors);
      expect(result.score).toBeGreaterThan(600);
      expect(result.breakdown.length).toBeGreaterThan(0);
    });
  });
});
