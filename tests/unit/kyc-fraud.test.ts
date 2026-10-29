import { describe, it, expect, vi, beforeEach } from "vitest";
import { maskPII } from "@/lib/logger";
import {
  encrypt,
  decrypt,
  hashForDuplicateDetection,
} from "@/lib/encryption";
import {
  getKYCProvider,
  setKYCProvider,
  assertNoDuplicateDocument,
  hasMatchingNameTokens,
  invalidateUserKYCCache,
  type KYCProvider,
} from "@/lib/kyc";
import {
  getTrustRuleWeights,
  updateTrustRuleWeight,
  DEFAULT_TRUST_RULE_WEIGHTS,
} from "@/lib/trust-rules";
import { calculateInfluencerDRS, calculateBrandDRS, calculateReviewDiversityRatio } from "@/lib/drs-score";
import { checkPaymentFraud } from "@/lib/fraud-detection/payment";
import prisma from "@/lib/db";
import { redis } from "@/lib/redis";

describe("Unit Tests: KYC Verification & Fraud-Detection Hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. PII MASKING AND LOG SCRUBBING
  // =========================================================================
  describe("Requirement 2 & DoD 1: PII Masking & Log Scrubbing", () => {
    it("should scrub Aadhaar numbers (continuous, spaced, hyphenated) from log messages and metadata", () => {
      const payload = {
        continuous: "User Aadhaar is 234567890123 for verification",
        spaced: "User Aadhaar is 2345 6789 0123 for verification",
        hyphenated: "User Aadhaar is 2345-6789-0123 for verification",
      };

      const scrubbed = maskPII(payload) as Record<string, string>;
      expect(scrubbed.continuous).not.toContain("234567890123");
      expect(scrubbed.continuous).toContain("[REDACTED_AADHAAR]");
      expect(scrubbed.spaced).not.toContain("2345 6789 0123");
      expect(scrubbed.spaced).toContain("[REDACTED_AADHAAR]");
      expect(scrubbed.hyphenated).not.toContain("2345-6789-0123");
      expect(scrubbed.hyphenated).toContain("[REDACTED_AADHAAR]");
    });

    it("should scrub PAN numbers and sensitive keys from log metadata", () => {
      const payload = {
        message: "Processing PAN ABCDE1234F for user",
        pan: "ABCDE1234F",
        documentNumber: "234567890123",
        documentNumberHash: "mock_hash_abc",
        bankAccount: "987654321012",
        upi: "merchant@okhdfcbank",
        gstin: "27ABCDE1234F1Z5",
        password: "SuperSecretPassword123!",
      };

      const scrubbed = maskPII(payload) as Record<string, string>;
      expect(scrubbed.message).not.toContain("ABCDE1234F");
      expect(scrubbed.message).toContain("[REDACTED_PAN]");
      expect(scrubbed.pan).toBe("[REDACTED]");
      expect(scrubbed.documentNumber).toBe("[REDACTED]");
      expect(scrubbed.documentNumberHash).toBe("[REDACTED]");
      expect(scrubbed.bankAccount).toBe("[REDACTED]");
      expect(scrubbed.upi).toBe("[REDACTED]");
      expect(scrubbed.gstin).toBe("[REDACTED]");
      expect(scrubbed.password).toBe("[REDACTED]");
    });
  });

  // =========================================================================
  // 2. KYC PROVIDER ABSTRACTION LAYER
  // =========================================================================
  describe("Requirement 1: Pluggable KYC Provider Abstraction", () => {
    it("should resolve provider without coupling to vendor implementation", () => {
      const provider = getKYCProvider("manual");
      expect(provider.name).toBe("manual");
      expect(typeof provider.verifyAadhaar).toBe("function");
      expect(typeof provider.verifyPAN).toBe("function");
      expect(typeof provider.verifyBankAccount).toBe("function");
    });

    it("should allow swapping provider seamlessly via setKYCProvider", async () => {
      const mockCustomProvider: KYCProvider = {
        name: "custom-mock-surepass",
        verifyAadhaar: vi.fn().mockResolvedValue({
          success: true,
          status: "VERIFIED",
          data: { name: "Aarav Sharma", documentNumber: "•••• 0123" },
        }),
        verifyPAN: vi.fn().mockResolvedValue({
          success: true,
          status: "VERIFIED",
          data: { name: "Aarav Sharma" },
        }),
        verifyGSTIN: vi.fn().mockResolvedValue({
          success: true,
          status: "VERIFIED",
          data: { businessName: "Sharma Enterprises" },
        }),
        verifyBankAccount: vi.fn().mockResolvedValue({
          success: true,
          nameMatch: true,
          accountExists: true,
          beneficiaryName: "Aarav Sharma",
        }),
      };

      setKYCProvider(mockCustomProvider);
      const active = getKYCProvider();
      expect(active.name).toBe("custom-mock-surepass");

      const res = await active.verifyAadhaar("234567890123");
      expect(res.success).toBe(true);
      expect(res.status).toBe("VERIFIED");
      expect(res.data?.name).toBe("Aarav Sharma");

      // Reset back to default
      setKYCProvider(getKYCProvider("manual"));
    });
  });

  // =========================================================================
  // 3. PII ENCRYPTION AT REST & DUPLICATE DETECTION HASHING
  // =========================================================================
  describe("Requirement 2: PII Encryption at Rest & Duplicate Document Detection", () => {
    it("should encrypt sensitive document numbers at rest using AES-256-GCM and decrypt accurately", () => {
      const rawAadhaar = "234567890123";
      const encrypted = encrypt(rawAadhaar);

      expect(encrypted).not.toBe(rawAadhaar);
      expect(encrypted).toMatch(/^(v|k)\d+:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/i);

      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(rawAadhaar);
    });

    it("should generate deterministic HMAC-SHA256 for fast indexed duplicate detection", () => {
      const doc1 = "2345 6789 0123";
      const doc2 = "2345-6789-0123";
      const doc3 = "234567890123";

      const hash1 = hashForDuplicateDetection(doc1);
      const hash2 = hashForDuplicateDetection(doc2);
      const hash3 = hashForDuplicateDetection(doc3);

      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
      expect(hash1.length).toBe(64); // SHA-256 hex string
    });

    it("should block cross-account duplicate document registration via assertNoDuplicateDocument", async () => {
      const testAadhaar = "998877665544";
      const userAId = "usr_kyc_test_alpha";
      const userBId = "usr_kyc_test_beta";

      // Mock database finding an existing verified document owned by User A
      vi.spyOn(prisma.verificationDocument, "findFirst").mockResolvedValueOnce({
        id: "doc_existing_123",
        userId: userAId,
      } as never);

      // User B attempts to submit the same document
      await expect(
        assertNoDuplicateDocument(testAadhaar, "AADHAAR", userBId),
      ).rejects.toThrow("DUPLICATE_DOCUMENT: This AADHAAR is already registered with another account");
    });
  });

  // =========================================================================
  // 4. TABLE-DRIVEN TRUST RULES ENGINE
  // =========================================================================
  describe("Requirement 3: Dynamic Table-Driven Trust Rules Engine", () => {
    it("should initialize default rules and construct weight dictionary", async () => {
      vi.spyOn(redis, "get").mockResolvedValueOnce(null);
      vi.spyOn(prisma.trustRuleConfig, "findMany").mockResolvedValueOnce([]);
      vi.spyOn(prisma.trustRuleConfig, "upsert").mockResolvedValue({} as never);

      const weights = await getTrustRuleWeights();
      expect(weights.IDENTITY_VERIFIED_WEIGHT).toBe(DEFAULT_TRUST_RULE_WEIGHTS.IDENTITY_VERIFIED_WEIGHT?.weight ?? 60);
      expect(weights.RAPID_WITHDRAWAL_RISK).toBe(40);
      expect(weights.FRAUD_BLOCK_THRESHOLD).toBe(70);
    });

    it("should dynamically recalculate DRS when DB rule weight is updated without code redeployment", async () => {
      const baseInfluencerData = {
        completedDeals: 1,
        totalEarningsPaise: 100000,
        disputesLost: 0,
        dealBuckets:              { recent: 1, mid: 0, old: 0 },
        reviewBuckets:            { recent: 0, mid: 0, old: 0 },
        onTimeBuckets:            { recent: 1, mid: 0, old: 0 },
        disputeWonBuckets:        { recent: 0, mid: 0, old: 0 },
        lateDeliveryBuckets:      { recent: 0, mid: 0, old: 0 },
        poorReviewBuckets:        { recent: 0, mid: 0, old: 0 },
        contentRejectionBuckets:  { recent: 0, mid: 0, old: 0 },
        disputeLostBuckets:       { recent: 0, mid: 0, old: 0 },
        identityVerified: true,
        accountAgeDays: 30,
        engagementRate: 2.0,
        fakeFollowersDetected: false,
        termsViolations: 0,
        paymentFraudAttempts: 0,
        avgReferralDRS: 0,
        successfulReferrals: 0,
        profileCompleteness: 100,
      };

      const defaultWeights = { ...DEFAULT_TRUST_RULE_WEIGHTS };
      const defaultWeightsMap: Record<string, number> = {};
      for (const [k, v] of Object.entries(defaultWeights)) {
        defaultWeightsMap[k] = v.weight;
      }

      const initialScore = calculateInfluencerDRS(baseInfluencerData, defaultWeightsMap);

      // Now simulate weight update in DB to 150 points for IDENTITY_VERIFIED_WEIGHT
      const tunedWeightsMap = { ...defaultWeightsMap, IDENTITY_VERIFIED_WEIGHT: 150 };
      const updatedScore = calculateInfluencerDRS(baseInfluencerData, tunedWeightsMap);

      expect(updatedScore.score).toBeGreaterThan(initialScore.score);
      expect(updatedScore.score - initialScore.score).toBe(90); // 150 - 60 = 90
    });

    it("should dynamically tune Brand DRS when DB rule weights are updated", () => {
      const baseBrandData = {
        completedCampaigns: 2,
        fastApprovals: 2,
        lateApprovals: 0,
        fairReviews: 1,
        disputesLost: 0,
        companyVerified: true,
        paymentReliability: 1.0,
        termsViolations: 0,
        longTermPartnerships: 1,
        unfairRejections: 0,
        influencerComplaints: 0,
      };

      const defaultScore = calculateBrandDRS(baseBrandData);

      // Double the brand campaign weight and verified weight
      const tunedWeights = {
        BRAND_CAMPAIGN_WEIGHT: 36, // 18 -> 36
        BRAND_VERIFIED_WEIGHT: 180, // 90 -> 180
      };

      const tunedScore = calculateBrandDRS(baseBrandData, tunedWeights);
      expect(tunedScore.score).toBeGreaterThan(defaultScore.score);
    });

    it("should invalidate Redis cache when updateTrustRuleWeight is called", async () => {
      vi.spyOn(prisma.trustRuleConfig, "upsert").mockResolvedValueOnce({
        ruleKey: "IDENTITY_VERIFIED_WEIGHT",
        weight: 100,
      } as never);
      const redisDelSpy = vi.spyOn(redis, "del").mockResolvedValueOnce(1);

      const result = await updateTrustRuleWeight("IDENTITY_VERIFIED_WEIGHT", 100, "admin_user_1");
      expect(result.success).toBe(true);
      expect(result.weight).toBe(100);
      expect(redisDelSpy).toHaveBeenCalledWith("trust_rules:weights_map");
    });

    it("should calculate review diversity ratio accurately and protect against low sample sizes", () => {
      expect(calculateReviewDiversityRatio(0, 0)).toBe(1.0);
      expect(calculateReviewDiversityRatio(1, 1)).toBe(1.0);
      expect(calculateReviewDiversityRatio(1, 2)).toBe(1.0); // <= 2 reviews grace period
      expect(calculateReviewDiversityRatio(10, 10)).toBe(1.0); // 10 unique reviewers
      expect(calculateReviewDiversityRatio(1, 10)).toBe(0.1); // 1 reviewer repeated 10 times
      expect(calculateReviewDiversityRatio(3, 10)).toBe(0.3); // 3 reviewers across 10 reviews
      expect(calculateReviewDiversityRatio(5, 10)).toBe(0.5);
    });

    it("should scale down influencer 5-star review bonus when reviews come from a single colluding reviewer", () => {
      const baseFactors = {
        completedDeals: 0,
        totalEarningsPaise: 0,
        disputesLost: 0,
        dealBuckets: { recent: 0, mid: 0, old: 0 },
        reviewBuckets: { recent: 10, mid: 0, old: 0 }, // 10 five-star reviews
        onTimeBuckets: { recent: 0, mid: 0, old: 0 },
        disputeWonBuckets: { recent: 0, mid: 0, old: 0 },
        lateDeliveryBuckets: { recent: 0, mid: 0, old: 0 },
        poorReviewBuckets: { recent: 0, mid: 0, old: 0 },
        contentRejectionBuckets: { recent: 0, mid: 0, old: 0 },
        disputeLostBuckets: { recent: 0, mid: 0, old: 0 },
        identityVerified: false,
        accountAgeDays: 0,
        engagementRate: 0,
        fakeFollowersDetected: false,
        termsViolations: 0,
        paymentFraudAttempts: 0,
        avgReferralDRS: 0,
        successfulReferrals: 0,
        profileCompleteness: 0,
      };

      // 10 distinct brands reviewed the influencer
      const diverseResult = calculateInfluencerDRS({
        ...baseFactors,
        uniqueReviewersCount: 10,
      });

      // Only 1 colluding brand gave all 10 reviews (Sybil ring)
      const colludedResult = calculateInfluencerDRS({
        ...baseFactors,
        uniqueReviewersCount: 1,
      });

      expect(diverseResult.score).toBeGreaterThan(colludedResult.score);
      const diverseReviewBreakdown = diverseResult.breakdown.find((b) => b.factor === "5-Star Quality");
      const colludedReviewBreakdown = colludedResult.breakdown.find((b) => b.factor === "5-Star Quality");

      expect(diverseReviewBreakdown?.impact).toBe(120); // capped at 120 with full diversity
      expect(colludedReviewBreakdown?.impact).toBe(12);  // 120 * 0.1 diversity penalty = 12
      expect(colludedReviewBreakdown?.reason).toContain("diversity penalty");
    });

    it("should scale down brand fair review bonus when reviews come from a single colluding creator", () => {
      const baseBrand = {
        completedCampaigns: 0,
        fastApprovals: 0,
        lateApprovals: 0,
        fairReviews: 5,
        disputesLost: 0,
        companyVerified: false,
        paymentReliability: 0,
        termsViolations: 0,
        longTermPartnerships: 0,
        unfairRejections: 0,
        influencerComplaints: 0,
      };

      const diverseBrand = calculateBrandDRS({
        ...baseBrand,
        uniqueInfluencersCount: 5,
      });

      const colludedBrand = calculateBrandDRS({
        ...baseBrand,
        uniqueInfluencersCount: 1,
      });

      expect(diverseBrand.score).toBeGreaterThan(colludedBrand.score);
      const diverseFairBreakdown = diverseBrand.breakdown.find((b) => b.factor === "Fair Reviews");
      const colludedFairBreakdown = colludedBrand.breakdown.find((b) => b.factor === "Fair Reviews");

      expect(diverseFairBreakdown?.impact).toBe(5 * 30); // 150 pts
      expect(colludedFairBreakdown?.impact).toBe(Math.round(150 * 0.2)); // 30 pts (diversity ratio = 1/5 = 0.2)
      expect(colludedFairBreakdown?.reason).toContain("diversity penalty");
    });
  });

  // =========================================================================
  // 5. MULTI-VECTOR FRAUD DETECTION CHECKS
  // =========================================================================
  describe("Requirement 4 & 5: Multi-Vector Fraud Checks & Manual Review Queue", () => {
    it("should accurately match tokenized and substring names in KYC records", () => {
      expect(hasMatchingNameTokens("Rajesh Kumar", "Rajesh Kumar")).toBe(true);
      expect(hasMatchingNameTokens("Rajesh Kumar Sharma", "Rajesh Kumar")).toBe(true);
      expect(hasMatchingNameTokens("Aarav Enterprises Pvt Ltd", "Aarav Enterprises")).toBe(true);

      // Clear mismatch
      expect(hasMatchingNameTokens("Rajesh Kumar", "Vikram Malhotra")).toBe(false);
      expect(hasMatchingNameTokens(null, "Rajesh")).toBe(false);
    });

    it("should detect bank account name mismatch vs verified KYC name and assign high risk", async () => {
      vi.spyOn(prisma.verificationDocument, "findFirst").mockResolvedValueOnce({
        metadata: { fullName: "Rajesh Kumar" },
      } as never);
      vi.spyOn(prisma.user, "findUnique").mockResolvedValueOnce({
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days old
        trustScore: 85,
        influencerProfile: { displayName: "Rajesh Kumar" },
        brandProfile: null,
      } as never);
      vi.spyOn(prisma.withdrawal, "count").mockResolvedValueOnce(0);

      const check = await checkPaymentFraud({
        userId: "usr_test_1",
        amount: 50000,
        bankAccount: "112233445566",
        bankAccountName: "Completely Different Person",
      });

      const mismatchFlag = check.flags.find((f) => f.rule === "BANK_NAME_KYC_MISMATCH");
      expect(mismatchFlag).toBeDefined();
      expect(check.riskScore).toBeGreaterThanOrEqual(40);
      expect(["REVIEW", "BLOCK"]).toContain(check.action);
    });

    it("should detect rapid-fire withdrawal attempts in a 10-minute window", async () => {
      vi.spyOn(prisma.withdrawal, "count").mockResolvedValue(3); // 3 recent withdrawals
      vi.spyOn(prisma.verificationDocument, "findFirst").mockResolvedValueOnce({
        metadata: { fullName: "Rajesh Kumar" },
      } as never);
      vi.spyOn(prisma.user, "findUnique").mockResolvedValueOnce({
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        trustScore: 85,
        influencerProfile: { displayName: "Rajesh Kumar" },
        brandProfile: null,
      } as never);

      const check = await checkPaymentFraud({
        userId: "usr_test_1",
        amount: 50000,
        bankAccount: "112233445566",
        bankAccountName: "Rajesh Kumar",
      });

      const rapidFlag = check.flags.find((f) => f.rule === "RAPID_FIRE_WITHDRAWAL");
      expect(rapidFlag).toBeDefined();
      expect(check.riskScore).toBeGreaterThanOrEqual(40);
      expect(["REVIEW", "BLOCK"]).toContain(check.action);
    });

    it("should detect device fingerprint clustering across multiple user accounts", async () => {
      vi.spyOn(prisma.withdrawal, "count").mockResolvedValueOnce(0);
      vi.spyOn(prisma.verificationDocument, "findFirst").mockResolvedValueOnce(null);
      vi.spyOn(prisma.user, "findUnique").mockResolvedValueOnce({
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        trustScore: 85,
      } as never);

      vi.spyOn(redis, "sadd").mockResolvedValueOnce(1);
      vi.spyOn(redis, "expire").mockResolvedValueOnce(1);
      vi.spyOn(redis, "scard").mockResolvedValueOnce(3); // 3 distinct user accounts on device

      const check = await checkPaymentFraud({
        userId: "usr_test_1",
        amount: 25000,
        bankAccount: "112233445566",
        deviceFingerprint: "fp_shared_device_hash_123",
      });

      const deviceFlag = check.flags.find((f) => f.rule === "DEVICE_FINGERPRINT_CLUSTERING");
      expect(deviceFlag).toBeDefined();
      expect(check.riskScore).toBeGreaterThanOrEqual(50);
      expect(["REVIEW", "BLOCK"]).toContain(check.action);
    });
  });

  // =========================================================================
  // 6. CACHE INVALIDATION ON KYC STATUS MUTATIONS
  // =========================================================================
  describe("Requirement 6: Immediate Cache Invalidation on KYC Status Mutations", () => {
    it("should evict all trust badges, verification status, and profile caches from Redis", async () => {
      const mockUserId = "usr_cache_test_999";
      const pipelineSpy = {
        del: vi.fn(),
        exec: vi.fn().mockResolvedValue([1, 1, 1, 1, 1, 1]),
      };
      vi.spyOn(redis, "pipeline").mockReturnValueOnce(pipelineSpy as never);

      await invalidateUserKYCCache(mockUserId);

      expect(pipelineSpy.del).toHaveBeenCalledWith(`trust_badge:${mockUserId}`);
      expect(pipelineSpy.del).toHaveBeenCalledWith(`user:trust:${mockUserId}`);
      expect(pipelineSpy.del).toHaveBeenCalledWith(`user:profile:${mockUserId}`);
      expect(pipelineSpy.del).toHaveBeenCalledWith(`user:verification:${mockUserId}`);
      expect(pipelineSpy.del).toHaveBeenCalledWith(`platform_fee:effective:${mockUserId}`);
      expect(pipelineSpy.del).toHaveBeenCalledWith(`auth:user:${mockUserId}`);
      expect(pipelineSpy.exec).toHaveBeenCalled();
    });
  });
});
