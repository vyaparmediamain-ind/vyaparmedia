import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockRevalidatePath, mockRedis, mockPrisma } = vi.hoisted(() => {
  const mockPrismaClient: any = {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    userViolation: {
      create: vi.fn().mockResolvedValue({ id: "v_1" }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    deal: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    paymentHold: {
      findUnique: vi.fn(),
    },
    verificationDocument: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({ id: "doc_123", type: "PAN_CARD", status: "VERIFIED" }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    refreshToken: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    indiaTaxCompliance: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn(),
    },
    application: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    categoryBenchmark: {
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    trustRuleConfig: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      upsert: vi.fn(),
    },
    brandProfile: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    dispute: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    disputeEvent: {
      create: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (cb: unknown) => {
      if (typeof cb === "function") {
        return (cb as (tx: unknown) => unknown)(mockPrismaClient);
      }
      return cb;
    }),
  };

  return {
    mockAuth: vi.fn(),
    mockRevalidatePath: vi.fn(),
    mockRedis: {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn().mockResolvedValue(1),
      scan: vi.fn().mockResolvedValue(["0", []]),
    },
    mockPrisma: mockPrismaClient,
  };
});

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => mockRevalidatePath(path),
}));

vi.mock("@/lib/redis", () => ({
  redis: mockRedis,
  default: mockRedis,
}));

vi.mock("@/lib/db", () => ({
  default: mockPrisma,
}));

vi.mock("@/services/payment.service", () => ({
  PaymentService: {
    processDealCompletion: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock("@/lib/deal-state-machine", () => ({
  transitionDealState: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/audit", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    createActivityLog: vi.fn().mockResolvedValue({ id: "log_1" }),
    createAuditLog: vi.fn().mockResolvedValue({ id: "audit_1" }),
  };
});

vi.mock("@/lib/badges", () => ({
  BADGES: {
    VERIFIED_CREATOR: { id: "b1", name: "Verified Creator", category: "VERIFICATION" },
  },
}));

vi.mock("@/lib/gamification-engine", () => ({
  checkAndAwardBadges: vi.fn().mockResolvedValue([]),
  awardBadgeIfNotExists: vi.fn().mockResolvedValue(true),
  finalizeDealGamification: vi.fn().mockResolvedValue(true),
  registerDealCompletionHooks: vi.fn(),
  registerGamificationHooks: vi.fn(),
}));

vi.mock("@/services/pricing-config.service", () => ({
  PricingConfigService: {
    updatePricingConfig: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock("@/services/notification.service", () => ({
  NotificationService: {
    createNotification: vi.fn().mockResolvedValue({ id: "notif_1" }),
  },
}));

vi.mock("@/lib/razorpay", () => ({
  refundPayment: vi.fn().mockResolvedValue({ id: "rfnd_1" }),
  capturePayment: vi.fn().mockResolvedValue({ id: "cap_1" }),
}));

vi.mock("@/lib/deal-settlement", () => ({
  creditInfluencerPayoutWithTax: vi.fn().mockResolvedValue({ netPayoutPaise: 50000 }),
  recordPlatformFeeRevenue: vi.fn().mockResolvedValue({ platformFeePaise: 5000 }),
}));

import {
  approveUser,
  rejectUser,
  approveDocument,
  rejectDocument,
  banUser,
  unbanUser,
  approveFlaggedApplication,
  rejectFlaggedApplication,
  updateCategoryBenchmarkAction,
  resetCategoryBenchmarkAction,
  updatePricingConfigAction,
  approveDeliverableVerification,
  rejectDeliverableVerification,
  setBrandCustomFeeAction,
} from "@/app/admin/actions";

import { resolveDispute } from "@/app/admin/dispute-actions";

describe("Admin Server Actions & Authorization Contract Tests", () => {
  const activeAdminUser = {
    id: "adm_001",
    email: "admin@vyaparmedia.in",
    userType: "ADMIN",
    status: "ACTIVE",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.get.mockResolvedValue("1"); // Cache hit for active admin
    mockRedis.del.mockResolvedValue(1);
    mockRedis.scan.mockResolvedValue(["0", []]);
    mockPrisma.user.findFirst.mockResolvedValue(activeAdminUser);
  });

  describe("Authentication & RBAC Enforcement", () => {
    it("rejects unauthenticated caller with 401 unauthorized", async () => {
      mockAuth.mockResolvedValue(null);

      await expect(approveUser("usr_123")).rejects.toThrowError(
        /Authentication required/i
      );
    });

    it("rejects non-admin role with 403 forbidden", async () => {
      mockAuth.mockResolvedValue({
        user: { id: "usr_influencer", email: "creator@example.com", userType: "INFLUENCER" },
      });

      await expect(approveUser("usr_123")).rejects.toThrowError(
        /Admin access required/i
      );
    });

    it("rejects suspended or demoted admin with 403 forbidden", async () => {
      mockRedis.get.mockResolvedValue(null); // Cache miss
      mockPrisma.user.findFirst.mockResolvedValue(null); // Not active in DB

      mockAuth.mockResolvedValue({
        user: { id: "adm_suspended", email: "suspended@vyaparmedia.in", userType: "ADMIN" },
      });

      await expect(banUser("usr_123")).rejects.toThrowError(
        /Admin access required|Admin account is suspended/i
      );
    });
  });

  describe("User Moderation Server Actions", () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ user: activeAdminUser });
    });

    it("banUser successfully bans target user when eligible", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "target_usr",
        userType: "INFLUENCER",
        status: "ACTIVE",
      });

      mockPrisma.user.update.mockResolvedValue({
        id: "target_usr",
        status: "SUSPENDED",
      });

      await banUser("target_usr");
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "target_usr" },
          data: expect.objectContaining({ status: "BANNED" }),
        })
      );
    });

    it("unbanUser reactivates suspended user", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "target_usr",
        status: "SUSPENDED",
      });

      mockPrisma.user.update.mockResolvedValue({
        id: "target_usr",
        status: "ACTIVE",
      });

      await unbanUser("target_usr");
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "target_usr" },
          data: expect.objectContaining({ status: "ACTIVE" }),
        })
      );
    });
  });

  describe("Document & Application Verification Server Actions", () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ user: activeAdminUser });
    });

    it("approveDocument updates document status to VERIFIED", async () => {
      mockPrisma.verificationDocument.findUnique.mockResolvedValue({
        id: "doc_123",
        userId: "usr_test",
        type: "PAN_CARD",
      });

      mockPrisma.user.findUnique.mockResolvedValue({
        id: "usr_test",
        userType: "INFLUENCER",
        status: "PENDING_VERIFICATION",
        trustScore: 700,
        verificationDocs: [{ id: "doc_123", type: "PAN_CARD", status: "VERIFIED" }],
      });

      await approveDocument("doc_123", "usr_test");
      expect(mockPrisma.verificationDocument.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "doc_123" },
          data: expect.objectContaining({ status: "VERIFIED" }),
        })
      );
    });

    it("rejectDocument updates status to REJECTED with mandatory reason", async () => {
      mockPrisma.verificationDocument.findUnique.mockResolvedValue({
        id: "doc_123",
        userId: "usr_test",
        type: "PAN_CARD",
      });

      mockPrisma.user.findUnique.mockResolvedValue({
        id: "usr_test",
        verificationLevel: "PARTIAL",
      });

      await rejectDocument("doc_123", "usr_test", "Document blurry and illegible");
      expect(mockPrisma.verificationDocument.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "doc_123" },
          data: expect.objectContaining({
            status: "REJECTED",
            rejectionReason: "Document blurry and illegible",
          }),
        })
      );
    });

    it("approveFlaggedApplication updates application status to APPROVED", async () => {
      mockPrisma.application.findUnique.mockResolvedValue({
        id: "app_123",
        status: "FLAGGED",
        influencer: { userId: "usr_inf" },
      });

      await approveFlaggedApplication("app_123");
      expect(mockPrisma.application.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "app_123" },
          data: expect.objectContaining({ status: "PENDING" }),
        })
      );
    });

    it("rejectFlaggedApplication updates application status to REJECTED with reason", async () => {
      mockPrisma.application.findUnique.mockResolvedValue({
        id: "app_123",
        status: "FLAGGED",
        influencer: { userId: "usr_inf" },
      });

      await rejectFlaggedApplication("app_123", "Suspected engagement pod");
      expect(mockPrisma.application.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "app_123" },
          data: expect.objectContaining({
            status: "REJECTED",
          }),
        })
      );
    });
  });

  describe("Benchmark, Deliverable Verification & Pricing Actions", () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ user: activeAdminUser });
    });

    it("updateCategoryBenchmarkAction upserts benchmark in integer paise", async () => {
      mockPrisma.trustRuleConfig.upsert.mockResolvedValue({
        ruleKey: "CPV_BENCHMARK_FASHION",
        numericValue: 45,
      });

      const res = await updateCategoryBenchmarkAction("Fashion", 45);

      expect(res.success).toBe(true);
    });

    it("resetCategoryBenchmarkAction deletes custom category benchmark", async () => {
      mockPrisma.trustRuleConfig.deleteMany.mockResolvedValue({ count: 1 });

      const res = await resetCategoryBenchmarkAction("Fashion");
      expect(res.success).toBe(true);
      expect(mockPrisma.trustRuleConfig.deleteMany).toHaveBeenCalled();
    });

    it("updatePricingConfigAction updates dynamic pricing configuration", async () => {
      const res = await updatePricingConfigAction({
        staleProfileDaysThreshold: 45,
      });

      expect(res.success).toBe(true);
    });

    it("approveDeliverableVerification transitions deal to VERIFIED and marks verifiedAt", async () => {
      mockPrisma.deal.findUnique.mockResolvedValue({
        id: "deal_123",
        status: "CONTENT_APPROVED",
        brandId: "brd_1",
        influencerId: "inf_1",
      });

      const res = await approveDeliverableVerification("deal_123");
      expect(res.success).toBe(true);
      expect(mockPrisma.deal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "deal_123" },
          data: expect.objectContaining({
            requiresPostVerification: false,
          }),
        })
      );
    });

    it("rejectDeliverableVerification transitions deal to DISPUTED with audit reason", async () => {
      mockPrisma.deal.findUnique.mockResolvedValue({
        id: "deal_123",
        status: "CONTENT_APPROVED",
      });

      const res = await rejectDeliverableVerification("deal_123", "Proof of delivery link missing or 404");
      expect(res.success).toBe(true);
      expect(mockPrisma.deal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "deal_123" },
          data: expect.objectContaining({
            rejectionReason: expect.stringContaining("Proof of delivery link missing"),
          }),
        })
      );
    });

    it("setBrandCustomFeeAction sets custom fee bps for brand", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "usr_brand_1",
        userType: "BRAND",
        brandProfile: {
          id: "brd_1",
          companyName: "Acme Brand",
        },
      });

      mockPrisma.brandProfile.update.mockResolvedValue({
        id: "brd_1",
        customPlatformFee: 8.0,
      });

      const res = await setBrandCustomFeeAction("usr_brand_1", 8.0, "Enterprise contract tier");
      expect(res.success).toBe(true);
      expect(mockPrisma.brandProfile.update).toHaveBeenCalled();
    });
  });

  describe("Dispute Resolution Server Action", () => {
    it("resolveDispute requires active admin and resolves dispute", async () => {
      mockAuth.mockResolvedValue({ user: activeAdminUser });

      const disputeCuid = "cuid1234567890abcdef";
      mockPrisma.dispute.findUnique.mockResolvedValue({
        id: disputeCuid,
        dealId: "deal_dsp_1",
        status: "OPEN",
        deal: {
          id: "deal_dsp_1",
          status: "DISPUTED",
          totalAmount: 100000,
          influencerPayout: 80000,
          influencer: { userId: "usr_inf" },
          brand: { userId: "usr_brd" },
        },
      });

      mockPrisma.paymentHold.findUnique.mockResolvedValue({
        razorpayPaymentId: "pay_12345",
      });

      await resolveDispute(
        disputeCuid,
        "REFUND_BRAND",
        "Brand provided valid evidence that deliverable violated guidelines"
      );

      expect(mockPrisma.dispute.updateMany).toHaveBeenCalled();
    });
  });
});
