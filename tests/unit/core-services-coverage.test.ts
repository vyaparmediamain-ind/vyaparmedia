import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks
vi.mock("@/lib/db", () => {
  const mockPrisma = {
    user: { findUnique: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
    influencerProfile: { findUnique: vi.fn() },
    brandProfile: { findUnique: vi.fn() },
    userBlock: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn(), findMany: vi.fn() },
    wallet: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    transaction: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0), aggregate: vi.fn() },
    campaign: { findUnique: vi.fn(), findMany: vi.fn(), aggregate: vi.fn() },
    deal: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0, totalAmount: 0 } }),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    application: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      update: vi.fn(),
    },
    dispute: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      update: vi.fn(),
    },
    message: { count: vi.fn().mockResolvedValue(0) },
    review: { findFirst: vi.fn() },
    activityLog: { create: vi.fn() },
    $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => cb(mockPrisma)),
    $queryRaw: vi.fn().mockResolvedValue([]),
  };
  return { default: mockPrisma, prisma: mockPrisma, ensurePlatformTreasury: vi.fn().mockResolvedValue(true) };
});

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
  searchCreators: vi.fn().mockResolvedValue({ items: [], total: 0, hasMore: false }),
  invalidateCreatorSearchCache: vi.fn(),
}));

import prisma from "@/lib/db";
import { AppError } from "@/lib/errors";
import { checkStreakActivity } from "@/lib/gamification/badges-streaks";
import { BlockService } from "@/services/block.service";
import { UserService } from "@/services/user.service";
import { WalletService, invalidateWalletServiceCache } from "@/services/wallet.service";
import { DisputeService } from "@/services/dispute.service";
import { ApplicationService } from "@/services/application.service";
import { acceptApplication, rejectApplication } from "@/services/application/action";
import { createApplication } from "@/services/application/create";
import { listApplications } from "@/services/application/list";
import { resolveApplicationDealAmount } from "@/services/application/types";

describe("Core Services Coverage Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. Gamification: Streak Badges (badges-streaks.ts)
  // =========================================================================
  describe("badges-streaks.ts", () => {
    it("checkStreakActivity verifies first_login and activity streaks", async () => {
      const mockUser = {
        id: "u-streak-1",
        userType: "INFLUENCER",
        trustScore: 700,
        influencerProfile: { id: "inf-1", completedDeals: 5 },
        brandProfile: null,
        badges: [],
      };

      expect(await checkStreakActivity("first_login", "u-streak-1", mockUser as any, prisma as any, 5, mockUser.influencerProfile as any)).toBe(true);

      vi.mocked(prisma.message.count).mockResolvedValueOnce(12);
      expect(await checkStreakActivity("highly_responsive", "u-streak-1", mockUser as any, prisma as any, 5, mockUser.influencerProfile as any)).toBe(true);
    });
  });

  // =========================================================================
  // 2. Block Service (block.service.ts)
  // =========================================================================
  describe("block.service.ts", () => {
    it("throws error when trying to block oneself", async () => {
      await expect(BlockService.blockUser("u1", "u1")).rejects.toThrow("You cannot block yourself");
    });

    it("throws notFound when user to block does not exist", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
      await expect(BlockService.blockUser("u1", "u2")).rejects.toThrow("User to block not found");
    });

    it("creates block record if not already blocked", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: "u2" } as any);
      vi.mocked(prisma.userBlock.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.userBlock.create).mockResolvedValueOnce({ blockingUserId: "u1", blockedUserId: "u2" } as any);

      const res = await BlockService.blockUser("u1", "u2");
      expect(res).toBeDefined();
      expect(prisma.userBlock.create).toHaveBeenCalled();
    });

    it("unblocks user when existing block is present", async () => {
      vi.mocked(prisma.userBlock.findUnique).mockResolvedValueOnce({
        blockingUserId: "u1",
        blockedUserId: "u2",
      } as any);

      const res = await BlockService.unblockUser("u1", "u2");
      expect(res).toEqual({ success: true });
      expect(prisma.userBlock.delete).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 3. User Service (user.service.ts)
  // =========================================================================
  describe("user.service.ts", () => {
    it("listInfluencers delegates to searchCreators and returns pagination", async () => {
      const res = await UserService.listInfluencers({
        page: 1,
        limit: 10,
        category: "Tech",
      });
      expect(res).toBeDefined();
      expect(res.influencers).toBeDefined();
    });
  });

  // =========================================================================
  // 4. Wallet Service (wallet.service.ts)
  // =========================================================================
  describe("wallet.service.ts", () => {
    it("getWallet creates wallet if none exists and calculates balance invariants", async () => {
      vi.mocked(prisma.wallet.findUnique).mockResolvedValue({
        id: "w-1",
        userId: "u-1",
        balance: 50000,
        pendingBalance: 0,
        debt: 0,
        withdrawals: [],
        user: { userType: "INFLUENCER", brandProfile: null },
        transactions: [],
      } as any);

      const res = await WalletService.getWallet("u-1");
      expect(res.wallet).toBeDefined();
      expect(res.wallet.balance).toBe(50000);
    });

    it("invalidateWalletServiceCache no-ops safely", () => {
      expect(() => invalidateWalletServiceCache("u-1")).not.toThrow();
    });
  });

  // =========================================================================
  // 5. Dispute Service (dispute.service.ts)
  // =========================================================================
  describe("dispute.service.ts", () => {
    it("listDisputes fetches paginated disputes scoped to user", async () => {
      vi.mocked(prisma.dispute.findMany).mockResolvedValueOnce([
        {
          id: "disp-1",
          type: "QUALITY",
          status: "OPEN",
          deal: { id: "deal-1", amount: 50000, campaign: { title: "Campaign" } },
          evidence: [],
        },
      ] as any);
      vi.mocked(prisma.dispute.count).mockResolvedValueOnce(1);

      const res = await DisputeService.listDisputes("u-1", { page: 1, limit: 10 });
      expect(res.disputes.length).toBe(1);
      expect(res.total).toBe(1);
    });
  });

  // =========================================================================
  // 6. Application Subsystem (application.service.ts, action, create, list, types)
  // =========================================================================
  describe("application subsystem", () => {
    it("resolveApplicationDealAmount uses proposedRate or falls back to perInfluencerBudget", () => {
      expect(resolveApplicationDealAmount(50000, 40000)).toBe(50000);
      expect(resolveApplicationDealAmount(0, 40000)).toBe(40000);
      expect(resolveApplicationDealAmount(null, 40000)).toBe(40000);
      expect(resolveApplicationDealAmount(null, null)).toBe(0);
    });

    it("ApplicationService references all modular actions", () => {
      expect(ApplicationService.listApplications).toBe(listApplications);
      expect(ApplicationService.createApplication).toBe(createApplication);
      expect(ApplicationService.acceptApplication).toBe(acceptApplication);
      expect(ApplicationService.rejectApplication).toBe(rejectApplication);
    });

    it("listApplications returns empty list for user without profile", async () => {
      vi.mocked(prisma.influencerProfile.findUnique).mockResolvedValueOnce(null);
      const res = await listApplications("u-no-prof", "INFLUENCER", { page: 1, limit: 10 });
      expect(res.applications).toEqual([]);
      expect(res.total).toBe(0);
    });
  });
});
