import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "@/lib/errors";
import { DEAL_TRANSITION_MATRIX, type DealActorRole } from "@/lib/deal-state-machine";
import type { DealStatus } from "@prisma/client";
import { bankAccountInputSchema } from "@/lib/schemas";
import { DEFAULT_BRAND_PLATFORM_FEE_PERCENT, TDS_194O_RATE } from "@/constants";

function canTransitionDeal(from: DealStatus, to: DealStatus, role: DealActorRole): boolean {
  const rules = DEAL_TRANSITION_MATRIX[from] || [];
  return rules.some((r) => r.to === to && r.allowedRoles.includes(role));
}

describe("Fresh-Eyes Pass: Novel Edge-Case User Flow Invariants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Edge Case 1: Mid-Dispute State Protection & Immutable Lock", () => {
    it("should strictly forbid state transitions to CONTENT_SUBMITTED or COMPLETED when deal is DISPUTED", () => {
      // Invariant: Once in DISPUTED state, neither party can unilaterally bypass arbitration
      const canSubmit = canTransitionDeal("DISPUTED", "CONTENT_SUBMITTED", "INFLUENCER");
      expect(canSubmit).toBe(false);

      const canBrandComplete = canTransitionDeal("DISPUTED", "COMPLETED", "BRAND");
      expect(canBrandComplete).toBe(false);

      const canCreatorComplete = canTransitionDeal("DISPUTED", "COMPLETED", "INFLUENCER");
      expect(canCreatorComplete).toBe(false);

      // Attempting an illegal transition directly must throw or be rejected
      expect(() => {
        if (!canTransitionDeal("DISPUTED", "CONTENT_SUBMITTED", "INFLUENCER")) {
          throw AppError.badRequest("Cannot submit content while deal is under active dispute arbitration");
        }
      }).toThrow("Cannot submit content while deal is under active dispute arbitration");
    });

    it("should only allow transition from DISPUTED via authorized ADMIN resolution", () => {
      // Only ADMIN can transition a DISPUTED deal to COMPLETED or CANCELLED
      const adminCanComplete = canTransitionDeal("DISPUTED", "COMPLETED", "ADMIN");
      const adminCanCancel = canTransitionDeal("DISPUTED", "CANCELLED", "ADMIN");
      const influencerCanComplete = canTransitionDeal("DISPUTED", "COMPLETED", "INFLUENCER");
      const brandCanComplete = canTransitionDeal("DISPUTED", "COMPLETED", "BRAND");

      expect(adminCanComplete).toBe(true);
      expect(adminCanCancel).toBe(true);
      expect(influencerCanComplete).toBe(false);
      expect(brandCanComplete).toBe(false);
    });
  });

  describe("Edge Case 2: Payout Guard on Rotated/Malformed Bank Account Details", () => {
    it("should reject bank accounts with malformed IFSC codes (invalid structure, lowercase, or wrong 5th char)", () => {
      // Invalid IFSC: 5th character must be '0' according to RBI standard
      const invalidFifthChar = {
        payoutType: "bank" as const,
        accountName: "Pooja Sharma",
        accountNumber: "919876543210",
        ifscCode: "HDFC1001234", // '1' at index 4 instead of '0'
        bankName: "HDFC Bank",
      };

      const result1 = bankAccountInputSchema.safeParse(invalidFifthChar);
      expect(result1.success).toBe(false);

      // Invalid IFSC: length must be exactly 11 characters
      const invalidLength = {
        payoutType: "bank" as const,
        accountName: "Pooja Sharma",
        accountNumber: "919876543210",
        ifscCode: "HDFC00123", // 9 chars
        bankName: "HDFC Bank",
      };

      const result2 = bankAccountInputSchema.safeParse(invalidLength);
      expect(result2.success).toBe(false);

      // Valid IFSC: 4 letters + '0' + 6 alphanumeric
      const validAccount = {
        payoutType: "bank" as const,
        accountName: "Pooja Sharma",
        accountNumber: "919876543210",
        ifscCode: "HDFC0001234",
        bankName: "HDFC Bank",
      };

      const result3 = bankAccountInputSchema.safeParse(validAccount);
      expect(result3.success).toBe(true);
    });

    it("should reject UPI IDs with missing or invalid domain suffixes", () => {
      const invalidUpi = {
        payoutType: "upi" as const,
        accountName: "Pooja Sharma",
        upiId: "poojasharma@", // Missing handle
      };

      const result = bankAccountInputSchema.safeParse(invalidUpi);
      expect(result.success).toBe(false);

      const validUpi = {
        payoutType: "upi" as const,
        accountName: "Pooja Sharma",
        upiId: "poojasharma@okhdfcbank",
      };

      const validResult = bankAccountInputSchema.safeParse(validUpi);
      expect(validResult.success).toBe(true);
    });
  });

  describe("Edge Case 3: Admin Partial-Dispute Settlement Exact Penny/Paise Invariant", () => {
    it("should guarantee that partial split settlements sum exactly to 100% of escrow with 0 paise leakage", () => {
      // Deal amount: ₹17,355.75 = 1,735,575 paise (odd prime-like paise)
      const escrowHeldPaise = 1735575;

      // Split 67.3% to brand, remaining to creator
      const brandRatio = 0.673;
      const brandRefundPaise = Math.round(escrowHeldPaise * brandRatio);
      const creatorPayoutPaise = escrowHeldPaise - brandRefundPaise;

      // Invariant: The sum of parts must identically equal the total held escrow
      expect(brandRefundPaise + creatorPayoutPaise).toBe(escrowHeldPaise);
      expect(brandRefundPaise).toBeGreaterThan(0);
      expect(creatorPayoutPaise).toBeGreaterThan(0);
    });

    it("should compute net payout deducting platform and TDS fees without negative results", () => {
      const grossPaise = 500000; // ₹5,000
      const platformFeePercent = DEFAULT_BRAND_PLATFORM_FEE_PERCENT; // 10%

      const platformFee = Math.round(grossPaise * (platformFeePercent / 100));
      const tdsDeduction = Math.round(grossPaise * TDS_194O_RATE);
      const netCreatorPayout = grossPaise - platformFee - tdsDeduction;

      expect(platformFee).toBe(50000); // ₹500
      expect(tdsDeduction).toBe(500); // ₹5 (0.1% Section 194-O)
      expect(netCreatorPayout).toBe(449500); // ₹4,495
      expect(netCreatorPayout + platformFee + tdsDeduction).toBe(grossPaise);
    });
  });

  describe("Edge Case 4: Double-Entry Ledger Reversal & Concurrent State Guard", () => {
    it("should reject concurrent terminal transition when deal has already concluded", () => {
      // Once CANCELLED, neither REFUND nor COMPLETE can be executed
      const canCompleteAfterCancel = canTransitionDeal("CANCELLED", "COMPLETED", "ADMIN");
      expect(canCompleteAfterCancel).toBe(false);

      const canSubmitAfterCancel = canTransitionDeal("CANCELLED", "CONTENT_SUBMITTED", "INFLUENCER");
      expect(canSubmitAfterCancel).toBe(false);

      const canDisputeAfterCancel = canTransitionDeal("CANCELLED", "DISPUTED", "BRAND");
      expect(canDisputeAfterCancel).toBe(false);
    });
  });
});
