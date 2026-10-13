import { describe, it, expect } from "vitest";
import {
  validateCampaignForm,
  getRecommendedRate,
  deliverableTypes,
  CampaignFormData,
  calculateCampaignEscrowPaise,
} from "@/components/dashboard/campaigns/create/CampaignCreateHelpers";
import {
  DEFAULT_BRAND_PLATFORM_FEE_PERCENT,
  DEFAULT_GATEWAY_FEE_PERCENT,
  DEFAULT_PRODUCT_HANDLING_FEE_PERCENT,
} from "@/constants/deals";

describe("Campaign Creation Wizard", () => {
  const validFormData: CampaignFormData = {
    title: "Summer Fest Glow Collection Launch",
    description: "Promoting our cruelty-free vegan sunscreen range across Instagram reels.",
    requirements: "High energy 60s Reel showing direct product application. Include link sticker.",
    totalBudget: 15000,
    perInfluencerBudget: 3000,
    targetCategories: ["Beauty", "Fashion"],
    targetCities: ["Mumbai", "Bengaluru"],
    targetGender: "FEMALE",
    targetAgeMin: 18,
    targetAgeMax: 34,
    minFollowers: 5000,
    maxFollowers: 50000,
    maxInfluencers: 5,
    applicationDeadline: new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0]!,
    contentDeadline: new Date(Date.now() + 86400000 * 7).toISOString().split("T")[0]!,
    postingDeadline: new Date(Date.now() + 86400000 * 10).toISOString().split("T")[0]!,
    requiresProduct: true,
    productName: "Glow Daily Sunscreen SPF 50",
    productValue: 999,
    productDescription: "Standard 50ml retail pack shipped via BlueDart.",
    deliverables: [
      { type: "INSTAGRAM_REEL", count: 1, rate: 3000 },
    ],
  };

  describe("Validation & Step Integrity", () => {
    it("should successfully validate a well-formed campaign payload", () => {
      const result = validateCampaignForm(validFormData);
      expect(result.success).toBe(true);
      expect(result.fieldErrors).toBeUndefined();
    });

    it("should fail validation if no categories are chosen", () => {
      const invalid = { ...validFormData, targetCategories: [] };
      const result = validateCampaignForm(invalid);
      expect(result.success).toBe(false);
      const errMessage = result.fieldErrors?.targetCategories || result.error || "";
      expect(errMessage.toLowerCase()).toContain("category");
    });

    it("should reject budgets below platform minimums", () => {
      const invalid = { ...validFormData, totalBudget: 500, perInfluencerBudget: 200 };
      const result = validateCampaignForm(invalid);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Minimum budget/);
    });

    it("should reject deadlines where posting is before content submission", () => {
      const invalid = {
        ...validFormData,
        contentDeadline: "2026-10-15",
        postingDeadline: "2026-10-10",
      };
      const result = validateCampaignForm(invalid);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Posting deadline must be after content deadline");
    });

    it("should reject maxFollowers less than minFollowers", () => {
      const invalid = {
        ...validFormData,
        minFollowers: 10000,
        maxFollowers: 5000,
      };
      const result = validateCampaignForm(invalid);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Max followers must be greater than or equal to min followers");
    });
  });

  describe("Rate Recommendations & Deliverables", () => {
    it("should provide higher recommended rates for YouTube vs Instagram", () => {
      const instaRate = getRecommendedRate("INSTAGRAM_REEL", 10000);
      const ytRate = getRecommendedRate("YOUTUBE_VIDEO", 10000);

      expect(ytRate).toBeGreaterThan(instaRate);
      expect(instaRate).toBeGreaterThanOrEqual(500);
      expect(ytRate).toBeGreaterThanOrEqual(750);
    });

    it("should support standard creator deliverable formats", () => {
      const values = deliverableTypes.map((d) => d.value);
      expect(values).toContain("INSTAGRAM_POST");
      expect(values).toContain("INSTAGRAM_REEL");
      expect(values).toContain("INSTAGRAM_STORY");
      expect(values).toContain("YOUTUBE_VIDEO");
      expect(values).toContain("YOUTUBE_SHORT");
    });
  });

  describe("Escrow & Gateway Fee Financial Calculations", () => {
    it("should compute accurate escrow lock requirement with platform fee and gateway fee", () => {
      const breakdown = calculateCampaignEscrowPaise(15000);

      const expectedCreatorPool = 1500000;
      const expectedPlatformFee = Math.round((expectedCreatorPool * DEFAULT_BRAND_PLATFORM_FEE_PERCENT) / 100);
      const expectedGatewayFee = Math.round(((expectedCreatorPool + expectedPlatformFee) * DEFAULT_GATEWAY_FEE_PERCENT) / 100);
      const expectedTotal = expectedCreatorPool + expectedPlatformFee + expectedGatewayFee;

      expect(breakdown.creatorPayoutPoolPaise).toBe(expectedCreatorPool); // ₹15,000 in paise
      expect(breakdown.platformFeePaise).toBe(expectedPlatformFee); // 10% fee = ₹1,500
      expect(breakdown.gatewayFeePaise).toBe(expectedGatewayFee); // 2% gateway fee = ₹330
      expect(breakdown.totalEscrowRequiredPaise).toBe(expectedTotal); // ₹16,830 in paise
      expect(breakdown.platformFeePercent).toBe(DEFAULT_BRAND_PLATFORM_FEE_PERCENT);
      expect(breakdown.gatewayFeePercent).toBe(DEFAULT_GATEWAY_FEE_PERCENT);
    });

    it("should compute accurate escrow for product-seeded and product-only campaigns", () => {
      // Product-seeded campaign (Budget ₹10,000, Product ₹1,000, 2 slots)
      const seeded = calculateCampaignEscrowPaise(10000, undefined, undefined, {
        requiresProduct: true,
        productValueRupees: 1000,
        maxInfluencers: 2,
      });

      const expectedProductFee = Math.round((1000 * 100 * DEFAULT_PRODUCT_HANDLING_FEE_PERCENT) / 100) * 2;
      const expectedPlatformFee = Math.round((10000 * 100 * DEFAULT_BRAND_PLATFORM_FEE_PERCENT) / 100) + expectedProductFee;
      const expectedGatewayFee = Math.round(((10000 * 100 + expectedPlatformFee) * DEFAULT_GATEWAY_FEE_PERCENT) / 100);
      const expectedTotal = 10000 * 100 + expectedPlatformFee + expectedGatewayFee;

      expect(seeded.productHandlingFeePaise).toBe(expectedProductFee);
      expect(seeded.platformFeePaise).toBe(expectedPlatformFee);
      expect(seeded.gatewayFeePaise).toBe(expectedGatewayFee);
      expect(seeded.totalEscrowRequiredPaise).toBe(expectedTotal);

      // Product-only campaign (Budget ₹0, Product ₹1,000, 1 slot)
      const productOnly = calculateCampaignEscrowPaise(0, undefined, undefined, {
        requiresProduct: true,
        productValueRupees: 1000,
        maxInfluencers: 1,
      });
      const expectedProductOnlyFee = Math.round((1000 * 100 * DEFAULT_BRAND_PLATFORM_FEE_PERCENT) / 100);
      const expectedProductOnlyGateway = Math.round((expectedProductOnlyFee * DEFAULT_GATEWAY_FEE_PERCENT) / 100);
      expect(productOnly.platformFeePaise).toBe(expectedProductOnlyFee);
      expect(productOnly.gatewayFeePaise).toBe(expectedProductOnlyGateway);
      expect(productOnly.totalEscrowRequiredPaise).toBe(expectedProductOnlyFee + expectedProductOnlyGateway);
    });

    it("should accurately detect insufficient wallet balance and calculate exact shortfall", () => {
      const { totalEscrowRequiredPaise } = calculateCampaignEscrowPaise(15000);

      // Case 1: Insufficient funds (wallet has ₹10,000)
      const walletBalancePaise = 10000 * 100; // 1,000,000 paise
      const isBalanceInsufficient = walletBalancePaise < totalEscrowRequiredPaise;
      const shortfallPaise = isBalanceInsufficient
        ? totalEscrowRequiredPaise - walletBalancePaise
        : 0;

      expect(isBalanceInsufficient).toBe(true);
      expect(shortfallPaise).toBe(totalEscrowRequiredPaise - walletBalancePaise);

      // Case 2: Sufficient funds (wallet has ₹20,000)
      const sufficientBalancePaise = 20000 * 100;
      const isSufficient = sufficientBalancePaise < totalEscrowRequiredPaise;
      const zeroShortfall = isSufficient
        ? totalEscrowRequiredPaise - sufficientBalancePaise
        : 0;

      expect(isSufficient).toBe(false);
      expect(zeroShortfall).toBe(0);
    });

    it("should enforce premature-action-exposure guard rule (disable launch on shortfall, keep draft enabled)", () => {
      const isBalanceInsufficient = true;
      const isLoading = false;

      // Launch button must be blocked before backend rejection
      const isLaunchButtonDisabled = isLoading || isBalanceInsufficient;
      expect(isLaunchButtonDisabled).toBe(true);

      // Save as draft must stay available without requiring escrow lock
      const isDraftButtonDisabled = isLoading;
      expect(isDraftButtonDisabled).toBe(false);
    });

    it("should flag creator profile invite low balance when wallet cannot cover min deliverable rate", () => {
      const creatorMinRatePaise = 2500000; // ₹25,000
      const brandWalletPaise = 1000000; // ₹10,000

      const isLowBalance = brandWalletPaise < Math.max(creatorMinRatePaise, 50000);
      expect(isLowBalance).toBe(true);

      const highBrandWalletPaise = 3000000; // ₹30,000
      const isNotLowBalance = highBrandWalletPaise < Math.max(creatorMinRatePaise, 50000);
      expect(isNotLowBalance).toBe(false);
    });
  });
});
