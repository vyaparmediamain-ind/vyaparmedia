import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks
vi.mock("@/lib/db", () => {
  const mockPrisma = {
    campaign: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      update: vi.fn(),
    },
    deal: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn(),
      groupBy: vi.fn().mockResolvedValue([]),
      aggregate: vi.fn().mockResolvedValue({ _count: { _all: 0 }, _sum: { amount: 0, totalAmount: 0, influencerPayout: 0 } }),
    },
    user: { findUnique: vi.fn() },
    influencerProfile: { findUnique: vi.fn() },
    brandProfile: { findUnique: vi.fn() },
    contentSubmission: { create: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    activityLog: { create: vi.fn() },
    $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => cb(mockPrisma)),
    $queryRaw: vi.fn().mockResolvedValue([]),
  };
  return { default: mockPrisma, prisma: mockPrisma };
});

vi.mock("@/lib/lock", () => ({
  acquireDistributedLock: vi.fn().mockResolvedValue("lock-token"),
  releaseDistributedLock: vi.fn().mockResolvedValue(true),
  extendDistributedLock: vi.fn().mockResolvedValue(true),
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

vi.mock("@/services/notification.service", () => ({
  NotificationService: {
    createNotification: vi.fn().mockResolvedValue(true),
    createNotifications: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("@/lib/search", () => ({
  invalidateCampaignSearchCache: vi.fn(),
}));

import prisma from "@/lib/db";
import { AppError } from "@/lib/errors";
import { CampaignService } from "@/services/campaign.service";
import { assertNoContactDetails } from "@/services/campaign/create";
import { listCampaigns } from "@/services/campaign/list";
import { getCampaignById } from "@/services/campaign/manage";
import {
  TierError,
  estimateCampaignDealSlots,
  safeStringCast,
  safeStringOrNullCast,
} from "@/services/campaign/types";
import { autoApproveExpiredContent, accumulateVerificationFlags } from "@/services/deal/auto-approve";
import { submitContent } from "@/services/deal/content";
import { rejectPendingInvite } from "@/services/deal/invite";
import { listDeals, invalidateDealStatsCache } from "@/services/deal/list";
import { verifyPost } from "@/services/deal/verify";

describe("Campaign and Deal Sub-Services Coverage Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. Campaign Types & Slots Estimation (campaign/types.ts)
  // =========================================================================
  describe("campaign/types.ts", () => {
    it("safeStringCast and safeStringOrNullCast normalize inputs", () => {
      expect(safeStringCast("hello")).toBe("hello");
      expect(safeStringCast(null)).toBe("");
      expect(safeStringCast(undefined)).toBe("");
      expect(safeStringCast(123)).toBe("123");

      expect(safeStringOrNullCast("hello")).toBe("hello");
      expect(safeStringOrNullCast(null)).toBeNull();
      expect(safeStringOrNullCast(undefined)).toBeNull();
    });

    it("estimateCampaignDealSlots calculates available slots", () => {
      // Priority 1: maxInfluencers
      expect(estimateCampaignDealSlots(100000, 10000, 5)).toBe(5);

      // Priority 2: derived from budget (100k / 20k = 5 slots)
      expect(estimateCampaignDealSlots(100000, 20000, null)).toBe(5);

      // Error when neither is set
      expect(() => estimateCampaignDealSlots(100000, null, null)).toThrow(
        "at least one of 'maxInfluencers' or 'perInfluencerBudget' must be set"
      );
    });

    it("TierError constructs 403 Forbidden error with tier details", () => {
      const err = new TierError("Limit exceeded", {
        error: "Exceeded",
        code: "VERIFICATION_REQUIRED",
        tier: 1,
        monthlyUsed: 5000000,
        monthlyLimit: 5000000,
        requiredDocs: ["PAN_CARD"],
        upgradeUrl: "/settings",
      });
      expect(err.statusCode).toBe(403);
      expect(err.tierError.tier).toBe(1);
    });
  });

  // =========================================================================
  // 2. Campaign Create (campaign/create.ts)
  // =========================================================================
  describe("campaign/create.ts", () => {
    it("assertNoContactDetails blocks text containing email, phone, or UPI", () => {
      expect(() =>
        assertNoContactDetails("Contact me at user@gmail.com", "description")
      ).toThrow("Contact details");

      expect(() =>
        assertNoContactDetails("Clean text without contact info", "description")
      ).not.toThrow();
    });
  });

  // =========================================================================
  // 3. Campaign List & Manage (campaign/list.ts, manage.ts)
  // =========================================================================
  describe("campaign/list.ts and manage.ts", () => {
    it("listCampaigns returns paginated campaigns", async () => {
      vi.mocked(prisma.campaign.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.campaign.count).mockResolvedValueOnce(0);

      const res = await listCampaigns("u-1", "INFLUENCER", { page: 1, limit: 10 });
      expect(res.campaigns).toEqual([]);
      expect(res.total).toBe(0);
    });

    it("getCampaignById returns null if campaign does not exist", async () => {
      vi.mocked(prisma.campaign.findFirst).mockResolvedValueOnce(null);
      const res = await getCampaignById("camp-missing");
      expect(res).toBeNull();
    });

    it("CampaignService aggregates create, list, manage methods", () => {
      expect(CampaignService.listCampaigns).toBe(listCampaigns);
      expect(CampaignService.getCampaignById).toBe(getCampaignById);
    });
  });

  // =========================================================================
  // 4. Deal Auto-Approve (deal/auto-approve.ts)
  // =========================================================================
  describe("deal/auto-approve.ts", () => {
    it("accumulateVerificationFlags aggregates fraud flags and calculates confidence", () => {
      const flags = accumulateVerificationFlags(
        { action: "PASS", passed: true, flags: [] },
        null,
        { action: "PASS", passed: true, flags: [] }
      );
      expect(flags.isBlocked).toBe(false);
      expect(flags.needsReview).toBe(false);
    });

    it("autoApproveExpiredContent handles distributed lock and execution", async () => {
      vi.mocked(prisma.deal.findMany).mockResolvedValueOnce([]);
      const result = await autoApproveExpiredContent();
      expect(result.processed).toBe(0);
      expect(result.scanned).toBe(0);
    });
  });

  // =========================================================================
  // 5. Deal Content, Invite, List, and Verify
  // =========================================================================
  describe("deal content, invite, list, and verify", () => {
    it("listDeals lists deals scoped to user", async () => {
      vi.mocked(prisma.influencerProfile.findUnique).mockResolvedValueOnce({ id: "inf-p1" } as any);
      vi.mocked(prisma.deal.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.deal.count).mockResolvedValueOnce(0);

      const res = await listDeals("u-inf", "INFLUENCER", { page: 1, limit: 10 });
      expect(res.deals).toEqual([]);
      expect(res.total).toBe(0);
    });

    it("invalidateDealStatsCache no-ops safely", () => {
      expect(() => invalidateDealStatsCache("key")).not.toThrow();
    });

    it("verifyPost throws notFound if deal does not exist", async () => {
      vi.mocked(prisma.deal.findUnique).mockResolvedValueOnce(null);
      await expect(verifyPost("u-inf", "deal-none", "https://instagram.com/p/123")).rejects.toThrow("Deal not found");
    });
  });
});
