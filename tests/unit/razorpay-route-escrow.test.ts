import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRedisStore = new Map<string, string>();

vi.mock("@/lib/circuit-breaker", () => ({
  withCircuitBreaker: vi.fn().mockImplementation((_name, fn) => fn()),
}));

vi.mock("@/lib/redis", () => ({
  redis: {
    get: vi.fn().mockImplementation((key: string) => Promise.resolve(mockRedisStore.get(key) || null)),
    set: vi.fn().mockImplementation((key: string, val: string) => {
      mockRedisStore.set(key, val);
      return Promise.resolve("OK");
    }),
    del: vi.fn().mockImplementation((key: string) => {
      mockRedisStore.delete(key);
      return Promise.resolve(1);
    }),
  },
}));

import {
  createLinkedAccount,
  releaseTransferHold,
  reverseTransfer,
  getOrCreateLinkedAccount,
} from "@/lib/razorpay";
import { checkDealEscrowFundingEligibility } from "@/lib/action-eligibility";

describe("Razorpay Route Escrow & RBI-Compliant Split Settlement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisStore.clear();
    process.env.RAZORPAY_KEY_ID = "rzp_test_key_12345";
    process.env.RAZORPAY_KEY_SECRET = "rzp_test_secret_12345";
  });

  describe("1. Action Eligibility: checkDealEscrowFundingEligibility", () => {
    it("should allow brand owner to fund deal in PAYMENT_PENDING status", () => {
      const deal = {
        status: "PAYMENT_PENDING",
        totalAmount: 100000,
        reservedFromWallet: false,
        brand: { userId: "user_brand_1" },
      };

      const result = checkDealEscrowFundingEligibility(deal, "user_brand_1", "ACTIVE");
      expect(result.allowed).toBe(true);
      expect(result.ctaText).toContain("Deposit Escrow");
    });

    it("should block non-brand users from funding deal escrow", () => {
      const deal = {
        status: "PAYMENT_PENDING",
        totalAmount: 100000,
        reservedFromWallet: false,
        brand: { userId: "user_brand_1" },
      };

      const result = checkDealEscrowFundingEligibility(deal, "user_other", "ACTIVE");
      expect(result.allowed).toBe(false);
      expect(result.reasonCode).toBe("UNAUTHORIZED");
    });

    it("should block funding if deal is already funded in escrow (HELD)", () => {
      const deal = {
        status: "ACTIVE",
        totalAmount: 100000,
        reservedFromWallet: false,
        paymentHold: { status: "HELD" },
        brand: { userId: "user_brand_1" },
      };

      const result = checkDealEscrowFundingEligibility(deal, "user_brand_1", "ACTIVE");
      expect(result.allowed).toBe(false);
      expect(result.reasonCode).toBe("ALREADY_FUNDED");
    });

    it("should block suspended or flagged brand users from depositing escrow", () => {
      const deal = {
        status: "PAYMENT_PENDING",
        totalAmount: 100000,
        reservedFromWallet: false,
        brand: { userId: "user_brand_1" },
      };

      const result = checkDealEscrowFundingEligibility(deal, "user_brand_1", "SUSPENDED");
      expect(result.allowed).toBe(false);
      expect(result.reasonCode).toBe("ACCOUNT_SUSPENDED");
    });

    it("should block escrow funding if creator has not linked a verified bank account", () => {
      const deal = {
        status: "PAYMENT_PENDING",
        totalAmount: 100000,
        reservedFromWallet: false,
        brand: { userId: "user_brand_1" },
        creatorHasVerifiedBank: false,
      };

      const result = checkDealEscrowFundingEligibility(deal, "user_brand_1", "ACTIVE");
      expect(result.allowed).toBe(false);
      expect(result.reasonCode).toBe("CREATOR_BANK_MISSING");
      expect(result.reason).toContain("verified bank account");
    });

    it("should block escrow funding if creator route account is not active", () => {
      const deal = {
        status: "PAYMENT_PENDING",
        totalAmount: 100000,
        reservedFromWallet: false,
        brand: { userId: "user_brand_1" },
        creatorRouteAccountActive: false,
      };

      const result = checkDealEscrowFundingEligibility(deal, "user_brand_1", "ACTIVE");
      expect(result.allowed).toBe(false);
      expect(result.reasonCode).toBe("CREATOR_KYC_PENDING");
      expect(result.reason).toContain("KYC");
    });
  });

  describe("2. Linked Account Creation & Resolution", () => {
    it("should create and return a linked account id for creator onboarding", async () => {
      const account = await createLinkedAccount({
        userId: "usr_creator_99",
        email: "creator@example.com",
        legalBusinessName: "Rohan Creator",
        phone: "9876543210",
        accountNumber: "1234567890",
        ifscCode: "HDFC0001234",
      });

      expect(account).toBeDefined();
      expect(account.accountId).toMatch(/^acc_/);
      expect(account.email).toBe("creator@example.com");
    });

    it("should resolve linked account idempotently for the same creator", async () => {
      const id1 = await getOrCreateLinkedAccount("usr_creator_repeat", {
        email: "repeat@example.com",
        name: "Repeat Creator",
      });
      const id2 = await getOrCreateLinkedAccount("usr_creator_repeat", {
        email: "repeat@example.com",
        name: "Repeat Creator",
      });

      expect(id1).toBe(id2);
      expect(id1).toMatch(/^acc_/);
    });
  });

  describe("3. Escrow Hold Management: Release & Reverse", () => {
    it("should release simulated transfer hold on milestone approval", async () => {
      const releaseResult = await releaseTransferHold("trf_sandbox_deal_123");
      expect(releaseResult.success).toBe(true);
      expect(releaseResult.transferId).toBe("trf_sandbox_deal_123");
      expect(releaseResult.status).toBe("settled");
    });

    it("should reverse transfer hold on deal cancellation or dispute refund", async () => {
      const reversalResult = await reverseTransfer({
        transferId: "trf_sandbox_deal_123",
        amount: 90000,
        notes: { dealId: "deal_123", reason: "Brand cancelled before draft" },
      });

      expect(reversalResult.success).toBe(true);
      expect(reversalResult.transferId).toBe("trf_sandbox_deal_123");
      expect(reversalResult.amount).toBe(90000);
      expect(reversalResult.reversalId).toBeDefined();
    });
  });
});
