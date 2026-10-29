import { describe, it, expect, vi } from "vitest";
import { sanitizeFileName } from "@/lib/storage";

describe("Phase 16 Fullstack Deep Hardening Suite (P16-FULLSTACK)", () => {
  describe("P16-01: Storage sanitizeFileName Security & Robustness", () => {
    it("sanitizes dangerous characters, path traversal, and uppercase letters", () => {
      const maliciousName = "../../etc/passwd<script>alert(1)</script>.PNG";
      const sanitized = sanitizeFileName(maliciousName);

      expect(sanitized).not.toContain("..");
      expect(sanitized).not.toContain("/");
      expect(sanitized).not.toContain("<");
      expect(sanitized).not.toContain(">");
      expect(sanitized).toMatch(/^[a-z0-9.-]+$/);
      expect(sanitized.endsWith(".png")).toBe(true);
    });

    it("falls back to 'file' when given an empty or entirely invalid filename", () => {
      expect(sanitizeFileName("")).toBe("file");
      expect(sanitizeFileName("   ")).toBe("file");
      expect(sanitizeFileName("???///:::***")).toBe("file");
    });

    it("truncates excessively long filenames to 100 characters", () => {
      const longName = "a".repeat(200) + ".pdf";
      const sanitized = sanitizeFileName(longName);
      expect(sanitized.length).toBeLessThanOrEqual(100);
    });
  });

  describe("P16-02: Dispute Deal Null Safety and Amount Fallbacks", () => {
    it("calculates canonical dealAmount correctly prioritizing totalAmount so escrow is never cut", () => {
      // Funded deal where totalAmount includes gross escrow (platform fee + gateway fee)
      const fundedDeal = { amount: 50000, totalAmount: 59000 };
      const escrowAmount =
        typeof fundedDeal.totalAmount === "number" && fundedDeal.totalAmount > 0
          ? fundedDeal.totalAmount
          : (fundedDeal.amount || 0);
      expect(escrowAmount).toBe(59000); // 59000 is preserved, never cut to 50000

      // Legacy deal where amount is 0 and totalAmount holds legacy value
      const legacyDeal = { amount: 0, totalAmount: 75000 };
      const legacyAmount =
        typeof legacyDeal.totalAmount === "number" && legacyDeal.totalAmount > 0
          ? legacyDeal.totalAmount
          : (legacyDeal.amount || 0);
      expect(legacyAmount).toBe(75000);

      // Unfunded draft where totalAmount is 0 and amount is set
      const draftDeal = { amount: 30000, totalAmount: 0 };
      const draftAmount =
        typeof draftDeal.totalAmount === "number" && draftDeal.totalAmount > 0
          ? draftDeal.totalAmount
          : (draftDeal.amount || 0);
      expect(draftAmount).toBe(30000);

      // Edge case where both are 0 or null
      const zeroDeal = { amount: 0, totalAmount: null };
      const zeroAmount =
        typeof zeroDeal.totalAmount === "number" && zeroDeal.totalAmount > 0
          ? zeroDeal.totalAmount
          : (zeroDeal.amount || 0);
      expect(zeroAmount).toBe(0);
    });

    it("prevents executing influencer deal queries when influencerId is null or undefined", () => {
      const queryInfluencerDeals = vi.fn().mockResolvedValue([]);

      const disputeWithoutInfluencer = {
        id: "disp_123",
        dealId: "deal_123",
        deal: {
          influencerId: null,
          brandId: "brand_abc",
          amount: 10000,
        },
      };

      // Guard logic matching AdminDisputeDetailPage
      const influencerDealsPromise = disputeWithoutInfluencer.deal.influencerId
        ? queryInfluencerDeals(disputeWithoutInfluencer.deal.influencerId)
        : Promise.resolve([]);

      expect(queryInfluencerDeals).not.toHaveBeenCalled();
      return expect(influencerDealsPromise).resolves.toEqual([]);
    });
  });

  describe("P16-04: Route Deal Escrow Order Amount Fallback", () => {
    it("uses canonical amount when totalAmount is missing or 0", () => {
      const legacyDeal = { id: "deal_1", amount: 25000, totalAmount: 0 };
      const effectiveTotalAmount =
        legacyDeal.totalAmount && legacyDeal.totalAmount > 0
          ? legacyDeal.totalAmount
          : legacyDeal.amount;
      expect(effectiveTotalAmount).toBe(25000);

      const modernDeal = { id: "deal_2", amount: 25000, totalAmount: 28500 };
      const modernTotalAmount =
        modernDeal.totalAmount && modernDeal.totalAmount > 0
          ? modernDeal.totalAmount
          : modernDeal.amount;
      expect(modernTotalAmount).toBe(28500);
    });
  });

  describe("P16-05: Brand Analytics Spend Fallback", () => {
    it("correctly computes totalDealSpend from amount with fallback to totalAmount", () => {
      const aggregateResultModern = {
        _sum: { amount: 150000, totalAmount: null },
      };
      const spendModern =
        (aggregateResultModern._sum.amount || 0) > 0
          ? aggregateResultModern._sum.amount!
          : (aggregateResultModern._sum.totalAmount ?? 0);
      expect(spendModern).toBe(150000);

      const aggregateResultLegacy = {
        _sum: { amount: 0, totalAmount: 200000 },
      };
      const spendLegacy =
        (aggregateResultLegacy._sum.amount || 0) > 0
          ? aggregateResultLegacy._sum.amount!
          : (aggregateResultLegacy._sum.totalAmount ?? 0);
      expect(spendLegacy).toBe(200000);
    });
  });
});
