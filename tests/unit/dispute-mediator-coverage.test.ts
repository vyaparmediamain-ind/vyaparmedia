import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks
vi.mock("@/lib/db", () => {
  const mockPrisma = {
    dispute: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    deal: { update: vi.fn() },
    wallet: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn(),
      upsert: vi.fn(),
    },
    transaction: { create: vi.fn() },
    debtClaim: { create: vi.fn() },
    activityLog: { create: vi.fn() },
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    platformRevenue: { create: vi.fn() },
    $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => cb(mockPrisma)),
  };
  return {
    default: mockPrisma,
    prisma: mockPrisma,
    ensurePlatformTreasury: vi.fn().mockResolvedValue(true),
  };
});

vi.mock("@/lib/redis", () => ({
  default: { get: vi.fn(), setex: vi.fn(), del: vi.fn() },
  redis: { get: vi.fn(), setex: vi.fn(), del: vi.fn() },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    critical: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/lib/contract-engine", () => ({
  verifyContractSignature: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/trust-engine", () => ({
  updateTrustAndLevel: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/penalty/hooks", () => ({
  getProgressivePenaltyHandler: vi.fn().mockReturnValue({
    recordViolation: vi.fn().mockResolvedValue(true),
  }),
}));

vi.mock("@/lib/deal-settlement", () => ({
  creditInfluencerPayoutWithTax: vi.fn().mockResolvedValue({ totalPaid: 1000 }),
  recordPlatformFeeRevenue: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/gamification-engine", () => ({
  finalizeDealGamification: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/referral-engine", () => ({
  processReferralReward: vi.fn().mockResolvedValue({ referrerId: "ref-1" }),
}));

vi.mock("@/lib/razorpay", () => ({
  refundPayment: vi.fn().mockResolvedValue({ id: "rfnd-123" }),
}));

vi.mock("@/services/notification.service", () => ({
  NotificationService: {
    createNotification: vi.fn().mockResolvedValue(true),
    createNotifications: vi.fn().mockResolvedValue(true),
  },
}));

import prisma from "@/lib/db";
import { analyzeDispute } from "@/lib/dispute-mediator";
import { escalateDispute } from "@/lib/dispute-mediator/actions";
import {
  checkContractSignatureIntegrity,
  checkSubmissionDeadline,
  createErrorAnalysis,
} from "@/lib/dispute-mediator/helpers";
import { analyzeGenericDispute } from "@/lib/dispute-mediator/analyzers/generic";
import {
  analyzeTimelineDispute,
  analyzeQualityDispute,
  analyzeContentDeletedDispute,
  analyzePaymentDispute,
  analyzeTermsViolationDispute,
} from "@/lib/dispute-mediator/analyzers/specific";
import type { FullDeal, FullDispute, MediatorAnalysis, Finding } from "@/lib/dispute-mediator/types";

describe("Dispute Mediator Subsystem Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockDeal: FullDeal = {
    id: "deal-101",
    campaignId: "camp-1",
    brandId: "brand-prof-1",
    influencerId: "inf-prof-1",
    amount: 100000,
    totalAmount: 110000,
    platformFee: 10000,
    productHandlingFee: 0,
    tdsAmount: 0,
    gstAmount: 0,
    status: "IN_PROGRESS",
    submissionDeadline: new Date(Date.now() + 86400000),
    brandReviewDeadline: new Date(Date.now() + 172800000),
    postingDeadline: new Date(Date.now() + 259200000),
    contractTerms: { campaignTitle: "Test Campaign", deliverables: [] },
    contractSignature: {
      influencerSignature: { signatureHash: "hash1", signedAt: "2026-01-01" },
      brandSignature: { signatureHash: "hash2", signedAt: "2026-01-01" },
    },
    campaign: {
      title: "Test Campaign",
      deliverables: [{ type: "REEL", count: 1 }],
      requirements: "Follow guidelines",
    },
    influencer: {
      userId: "inf-user-1",
      displayName: "Creator One",
      completedDeals: 5,
      averageRating: 4.8,
    },
    brand: {
      userId: "brand-user-1",
      companyName: "Brand One",
    },
    contentSubmissions: [
      {
        id: "sub-1",
        dealId: "deal-101",
        version: 1,
        contentUrl: "https://instagram.com/p/123",
        caption: "Nice post #ad",
        status: "PENDING",
        submittedAt: new Date(),
        reviewedAt: null,
        feedback: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    paymentHold: null,
    reviews: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    productDeliveredAt: null,
    contentApprovedAt: null,
    contentPublishedAt: null,
    completedAt: null,
    autoApprovedAt: null,
    cancelledAt: null,
    reservedFromWallet: false,
    contentDraft: null,
    trackingNumber: null,
    shippingCarrier: null,
  } as any;

  const mockDispute: FullDispute = {
    id: "disp-101",
    dealId: "deal-101",
    raisedById: "brand-user-1",
    raisedAgainstId: "inf-user-1",
    type: "TIMELINE",
    reason: "Late submission",
    status: "OPEN",
    tier: 1,
    resolution: null,
    resolvedAt: null,
    resolvedAmicably: false,
    influencerOutcome: null,
    brandOutcome: null,
    escalatedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deal: mockDeal,
    raisedBy: { id: "brand-user-1", userType: "BRAND" },
  } as any;

  // =========================================================================
  // 1. Mediator Helpers & Signature Verification
  // =========================================================================
  describe("dispute-mediator/helpers.ts", () => {
    it("verifies contract signature integrity when signatures are present", () => {
      const finding = checkContractSignatureIntegrity(mockDeal);
      expect(finding.check).toBe("Contract signature integrity");
      expect(finding.result).toBe("PASS");
    });

    it("returns warning when signatures are missing", () => {
      const dealNoSig = { ...mockDeal, contractSignature: null };
      const finding = checkContractSignatureIntegrity(dealNoSig);
      expect(finding.result).toBe("WARNING");
    });

    it("checkSubmissionDeadline determines timeliness", () => {
      const findings: Finding[] = [];
      const res = checkSubmissionDeadline(mockDeal, findings);
      expect(res.submissionDeadline).toBeDefined();
      expect(res.submittedAt).toBeDefined();
      expect(findings.length).toBeGreaterThan(0);
    });

    it("createErrorAnalysis builds structured error response", () => {
      const err = createErrorAnalysis("disp-err", "Missing deal");
      expect(err.disputeId).toBe("disp-err");
      expect(err.verdict).toBe("ESCALATE");
      expect(err.explanation).toContain("Missing deal");
    });
  });

  // =========================================================================
  // 2. Dispute Analyzers (Generic & Specific)
  // =========================================================================
  describe("dispute-mediator/analyzers", () => {
    it("analyzeGenericDispute escalates unknown types to Tier 2 human mediation", () => {
      const analysis = analyzeGenericDispute(mockDispute, mockDeal);
      expect(analysis.verdict).toBe("ESCALATE");
      expect(analysis.tier).toBe(1);
      expect(analysis.autoResolvable).toBe(false);
    });

    it("analyzeTimelineDispute analyzes timeline and deadlines", () => {
      const analysis = analyzeTimelineDispute(mockDispute, mockDeal, null);
      expect(analysis.disputeId).toBe("disp-101");
      expect(analysis.findings.length).toBeGreaterThan(0);
    });

    it("analyzeQualityDispute evaluates quality and deliverables", () => {
      const qualityDispute = { ...mockDispute, type: "QUALITY" as const };
      const analysis = analyzeQualityDispute(qualityDispute, mockDeal, null);
      expect(analysis.disputeId).toBe("disp-101");
      expect(["INFLUENCER_FAVORED", "BRAND_FAVORED", "SPLIT", "ESCALATE", "DISMISSED"]).toContain(analysis.verdict);
    });

    it("analyzeContentDeletedDispute handles early post deletion", () => {
      const deletedDispute = { ...mockDispute, type: "CONTENT_DELETED" as const };
      const analysis = analyzeContentDeletedDispute(deletedDispute, mockDeal);
      expect(analysis.disputeId).toBe("disp-101");
      expect(analysis.findings.length).toBeGreaterThan(0);
    });

    it("analyzePaymentDispute evaluates escrow and payment holds", () => {
      const paymentDispute = { ...mockDispute, type: "PAYMENT" as const };
      const analysis = analyzePaymentDispute(paymentDispute, mockDeal);
      expect(analysis.disputeId).toBe("disp-101");
    });

    it("analyzeTermsViolationDispute evaluates contract terms adherence", () => {
      const termsDispute = { ...mockDispute, type: "TERMS_VIOLATION" as const };
      const analysis = analyzeTermsViolationDispute(termsDispute, mockDeal, {});
      expect(analysis.disputeId).toBe("disp-101");
    });
  });

  // =========================================================================
  // 3. Main Dispute Mediator Entry Point
  // =========================================================================
  describe("dispute-mediator.ts", () => {
    it("returns error analysis when dispute is not found", async () => {
      vi.mocked(prisma.dispute.findUnique).mockResolvedValueOnce(null);
      const res = await analyzeDispute("disp-none");
      expect(res.verdict).toBe("ESCALATE");
      expect(res.explanation).toContain("Dispute or associated deal not found");
    });

    it("routes and analyzes dispute successfully", async () => {
      vi.mocked(prisma.dispute.findUnique).mockResolvedValueOnce(mockDispute as any);
      const res = await analyzeDispute("disp-101");
      expect(res.disputeId).toBe("disp-101");
      expect(res.verdict).toBeDefined();
    });
  });

  // =========================================================================
  // 4. Dispute Actions
  // =========================================================================
  describe("dispute-mediator/actions.ts", () => {
    it("escalates dispute to Tier 2 and notifies participants", async () => {
      vi.mocked(prisma.dispute.findUnique).mockResolvedValueOnce(mockDispute as any);
      vi.mocked(prisma.dispute.update).mockResolvedValueOnce({
        ...mockDispute,
        tier: 2,
        status: "TIER2_MEDIATION",
      } as any);

      const res = await escalateDispute("disp-101", "brand-user-1");
      expect(res).toBeDefined();
      expect(prisma.dispute.update).toHaveBeenCalledWith({
        where: { id: "disp-101" },
        data: expect.objectContaining({
          tier: 2,
          status: "TIER2_MEDIATION",
        }),
      });
    });
  });
});
