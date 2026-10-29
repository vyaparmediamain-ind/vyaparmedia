import { describe, it, expect } from "vitest";
import { calculateTotalAmount } from "@/lib/razorpay";
import { generateContractTerms } from "@/lib/contract-engine";
import { calculateCampaignEscrowPaise } from "@/components/dashboard/campaigns/create/CampaignCreateHelpers";
import { calculateCampaignActivationCostPaise } from "@/lib/action-eligibility";
import {
  DEFAULT_BRAND_PLATFORM_FEE_PERCENT,
  DEFAULT_GATEWAY_FEE_PERCENT,
  GST_STANDARD_RATE,
  GST_DEAL_EXEMPT_THRESHOLD_RUPEES,
  GST_DEAL_EXEMPT_THRESHOLD_PAISE,
} from "@/constants";

describe("E2E Verification: Deal-Tier GST Architecture (<= ₹1,500 Zero Tax vs > ₹1,500 18% GST)", () => {
  describe("0. Threshold Constant Integrity", () => {
    it("should maintain ₹1,500 threshold constants correctly", () => {
      expect(GST_DEAL_EXEMPT_THRESHOLD_RUPEES).toBe(1500);
      expect(GST_DEAL_EXEMPT_THRESHOLD_PAISE).toBe(150000);
    });
  });

  describe("1. Backend Financial Settlement Engine (calculateTotalAmount)", () => {
    it("should exempt deals <= ₹1,500 from GST (0% GST on platform fee)", () => {
      // Test cases: ₹500, ₹1,000, ₹1,500
      const testCases = [50000, 100000, 150000];

      for (const dealPaise of testCases) {
        const result = calculateTotalAmount(dealPaise);
        const expectedFee = Math.round((dealPaise * DEFAULT_BRAND_PLATFORM_FEE_PERCENT) / 100);
        const expectedGateway = Math.round(((dealPaise + expectedFee) * DEFAULT_GATEWAY_FEE_PERCENT) / 100);

        expect(result.dealAmount).toBe(dealPaise);
        expect(result.platformFee).toBe(expectedFee);
        expect(result.gstAmount).toBe(0); // Zero GST
        expect(result.gstPercent).toBe(0);
        expect(result.gatewayFee).toBe(expectedGateway);
        expect(result.totalAmount).toBe(dealPaise + expectedFee + expectedGateway);
        expect(result.influencerReceives).toBe(dealPaise); // 100% creator dignity
      }
    });

    it("should automatically apply 18% GST on platform fee for deals > ₹1,500", () => {
      // Test cases: ₹1,501, ₹2,500, ₹10,000
      const testCases = [150100, 250000, 1000000];

      for (const dealPaise of testCases) {
        const result = calculateTotalAmount(dealPaise);
        const expectedFee = Math.round((dealPaise * DEFAULT_BRAND_PLATFORM_FEE_PERCENT) / 100);
        const expectedGst = Math.round(expectedFee * GST_STANDARD_RATE);
        const expectedGateway = Math.round(((dealPaise + expectedFee + expectedGst) * DEFAULT_GATEWAY_FEE_PERCENT) / 100);

        expect(result.dealAmount).toBe(dealPaise);
        expect(result.platformFee).toBe(expectedFee);
        expect(result.gstPercent).toBe(18); // 18% GST
        expect(result.gstAmount).toBe(expectedGst);
        expect(result.gatewayFee).toBe(expectedGateway);
        expect(result.totalAmount).toBe(dealPaise + expectedFee + expectedGst + expectedGateway);
        expect(result.influencerReceives).toBe(dealPaise);
      }
    });

    it("should handle the exact 1-paise boundary at ₹1,500 cleanly", () => {
      // Exactly ₹1,500 (150,000 paise) -> 0 GST
      const atExact = calculateTotalAmount(GST_DEAL_EXEMPT_THRESHOLD_PAISE);
      expect(atExact.gstAmount).toBe(0);
      expect(atExact.gstPercent).toBe(0);

      // Exactly ₹1,500.01 (150,001 paise) -> 18% GST
      const aboveExact = calculateTotalAmount(GST_DEAL_EXEMPT_THRESHOLD_PAISE + 1);
      expect(aboveExact.gstPercent).toBe(18);
      expect(aboveExact.gstAmount).toBeGreaterThan(0);
      expect(aboveExact.gstAmount).toBe(Math.round(aboveExact.platformFee * 0.18));
    });
  });

  describe("2. Smart Contract Digital Terms (generateContractTerms)", () => {
    it("should record 0% GST in digital contract for deals <= ₹1,500", () => {
      const contract = generateContractTerms(
        "deal_test_micro",
        {
          totalBudget: 150000,
          perInfluencerBudget: 150000,
          deliverables: [{ type: "INSTAGRAM_REEL", count: 1 }],
          contentDeadline: new Date(Date.now() + 86400000 * 3),
          postingDeadline: new Date(Date.now() + 86400000 * 5),
        },
        { rate: 150000 }
      );

      expect(contract.dealAmount).toBe(150000);
      expect(contract.gstAmount).toBe(0);
      expect(contract.gstPercent).toBe(0);
      expect(contract.totalAmount).toBe(150000 + contract.platformFee + contract.gatewayFee);
    });

    it("should record 18% GST in digital contract for deals > ₹1,500", () => {
      const contract = generateContractTerms(
        "deal_test_std",
        {
          totalBudget: 250000,
          perInfluencerBudget: 250000,
          deliverables: [{ type: "INSTAGRAM_REEL", count: 1 }],
          contentDeadline: new Date(Date.now() + 86400000 * 3),
          postingDeadline: new Date(Date.now() + 86400000 * 5),
        },
        { rate: 250000 }
      );

      const expectedGst = Math.round(contract.platformFee * 0.18);
      expect(contract.dealAmount).toBe(250000);
      expect(contract.gstPercent).toBe(18);
      expect(contract.gstAmount).toBe(expectedGst);
      expect(contract.totalAmount).toBe(250000 + contract.platformFee + expectedGst + contract.gatewayFee);
    });
  });

  describe("3. Frontend Campaign Creation Wizard & Escrow Simulator Calculations", () => {
    it("should correctly compute 0 GST for micro campaigns where total campaign budget is <= ₹1,500", () => {
      // 1. Single creator micro campaign of ₹1,000
      const breakdown1k = calculateCampaignEscrowPaise(1000);
      expect(breakdown1k.creatorPayoutPoolPaise).toBe(100000);
      expect(breakdown1k.gstPaise).toBe(0);
      expect(breakdown1k.gstPercent).toBe(0);
      expect(breakdown1k.totalEscrowRequiredPaise).toBe(100000 + breakdown1k.platformFeePaise + breakdown1k.gatewayFeePaise);

      // 2. Micro campaign of ₹1,500 (e.g. 2 creators × ₹750)
      const microMulti = calculateCampaignEscrowPaise(1500, undefined, undefined, {
        maxInfluencers: 2,
        perInfluencerBudgetRupees: 750,
      });
      expect(microMulti.creatorPayoutPoolPaise).toBe(150000);
      expect(microMulti.gstPaise).toBe(0);
      expect(microMulti.gstPercent).toBe(0);
    });

    it("should automatically apply 18% GST whenever total campaign budget is > ₹1,500 (e.g. 4 creators × ₹1,500 = ₹6,000)", () => {
      // Total budget ₹6,000 with 4 creators = ₹1,500 per creator -> GST MUST APPLY because total spend is ₹6,000!
      const multiAtThreshold = calculateCampaignEscrowPaise(6000, undefined, undefined, {
        maxInfluencers: 4,
        perInfluencerBudgetRupees: 1500,
      });

      const expectedPlatformFee = Math.round((600000 * DEFAULT_BRAND_PLATFORM_FEE_PERCENT) / 100);
      const expectedGst = Math.round(expectedPlatformFee * 0.18);
      expect(multiAtThreshold.creatorPayoutPoolPaise).toBe(600000);
      expect(multiAtThreshold.platformFeePaise).toBe(expectedPlatformFee);
      expect(multiAtThreshold.gstPercent).toBe(18); // GST applies on ₹6,000 budget!
      expect(multiAtThreshold.gstPaise).toBe(expectedGst);
    });
  });

  describe("4. Action Eligibility & Wallet Lock Guard", () => {
    it("should require exact escrow amount matching GST tier", () => {
      // Case A: ≤ ₹1,500 (150,000 paise)
      const microRequired = calculateCampaignActivationCostPaise({
        totalBudget: 150000,
        perInfluencerBudget: 150000,
        maxInfluencers: 1,
      });
      const microTotalAmount = calculateTotalAmount(150000).totalAmount;
      expect(microRequired).toBe(microTotalAmount);

      // Case B: > ₹1,500 (300,000 paise)
      const stdRequired = calculateCampaignActivationCostPaise({
        totalBudget: 300000,
        perInfluencerBudget: 300000,
        maxInfluencers: 1,
      });
      const stdTotalAmount = calculateTotalAmount(300000).totalAmount;
      expect(stdRequired).toBe(stdTotalAmount);
    });
  });
});
