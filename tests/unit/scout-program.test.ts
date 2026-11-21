import { describe, it, expect, vi, beforeEach } from "vitest";
import { ScoutService } from "@/services/scout.service";
import prisma from "@/lib/db";

// Mock dependencies
vi.mock("@/lib/db", () => {
  const dbMock: any = {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    scoutProfile: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      count: vi.fn(),
    },
    wallet: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      upsert: vi.fn(),
      create: vi.fn(),
    },
    transaction: {
      findFirst: vi.fn(),
      create: vi.fn(),
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
    },
    deal: {
      count: vi.fn().mockResolvedValue(0),
    },
    $transaction: vi.fn(async (cb: any) => cb(dbMock)),
  };
  return {
    default: dbMock,
    ensurePlatformTreasury: vi.fn().mockResolvedValue({
      id: "treasury_w_id",
      userId: "PLATFORM_TREASURY",
      balance: 50000000,
    }),
  };
});

vi.mock("@/lib/audit", () => ({
  createActivityLog: vi.fn().mockResolvedValue({ id: "audit_123" }),
}));

vi.mock("@/services/notification.service", () => ({
  NotificationService: {
    createNotification: vi.fn().mockResolvedValue({ id: "notif_123" }),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Vyapar Scout / Campus Partner Program", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("KYC Submission Validation", () => {
    it("rejects invalid PAN format", async () => {
      await expect(
        ScoutService.submitKyc("user_scout_1", {
          fullName: "Rahul Sharma",
          phone: "9876543210",
          city: "Delhi",
          state: "Delhi",
          panNumber: "INVALIDPAN",
          aadhaarNumber: "123456789012",
        })
      ).rejects.toThrow(/invalid pan/i);
    });

    it("rejects invalid Aadhaar number (< 12 digits or non-numeric)", async () => {
      await expect(
        ScoutService.submitKyc("user_scout_1", {
          fullName: "Rahul Sharma",
          phone: "9876543210",
          city: "Delhi",
          state: "Delhi",
          panNumber: "ABCDE1234F",
          aadhaarNumber: "12345",
        })
      ).rejects.toThrow(/12 digits/i);
    });

    it("successfully creates or updates scout profile when valid KYC data is submitted", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "user_scout_1",
        email: "scout@example.com",
        userType: "SCOUT",
      } as any);

      vi.mocked(prisma.scoutProfile.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.scoutProfile.upsert).mockResolvedValue({
        id: "scout_prof_1",
        userId: "user_scout_1",
        scoutCode: "SCOUT-1234",
        fullName: "Rahul Sharma",
        phone: "9876543210",
        city: "Delhi",
        state: "Delhi",
        college: "Delhi University",
        panNumber: "ABCDE1234F",
        aadhaarNumber: "123456789012",
        verificationStatus: "PENDING",
        royaltyPercent: 1.0,
        isRoyaltyPaused: false,
        streakMonths: 0,
        totalRoyaltyEarned: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await ScoutService.submitKyc("user_scout_1", {
        fullName: "Rahul Sharma",
        phone: "9876543210",
        city: "Delhi",
        state: "Delhi",
        college: "Delhi University",
        panNumber: "abcde1234f",
        aadhaarNumber: "1234 5678 9012",
      });

      expect(prisma.scoutProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user_scout_1" },
          create: expect.objectContaining({
            userId: "user_scout_1",
            fullName: "Rahul Sharma",
            panNumber: "ABCDE1234F",
            aadhaarNumber: "XXXXXXXX9012",
            verificationStatus: "PENDING",
          }),
        })
      );
      expect(result.verificationStatus).toBe("PENDING");
    });
  });

  describe("Monthly Active Quota Logic", () => {
    it("marks quota as active when scout has added 1+ verified creator/brand this month", async () => {
      const scoutMock = {
        id: "scout_1",
        userId: "user_scout_1",
        scoutCode: "SCOUT-DELHI-01",
        fullName: "Priya Verma",
        city: "Delhi",
        college: "IIT Delhi",
        verificationStatus: "APPROVED",
        isRoyaltyPaused: false,
        monthlyQuotaExemptUntil: null,
        streakMonths: 3,
        royaltyPercent: 1.0,
        totalRoyaltyEarned: 150000,
        user: {
          id: "user_scout_1",
          email: "priya@scout.in",
          wallet: { id: "w_1", balance: 25000, totalEarned: 150000 },
        },
      };

      vi.mocked(prisma.scoutProfile.findUnique).mockResolvedValue(scoutMock as any);

      // Return 1 verified creator onboarded this month
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        {
          id: "referred_creator_1",
          userType: "INFLUENCER",
          createdAt: new Date(),
          influencerProfile: { instagramHandle: "priya_vlogs" },
          brandProfile: null,
        },
      ] as any);

      const dashboard = await ScoutService.getDashboard("user_scout_1");

      expect(dashboard.monthlyQuota.isMet).toBe(true);
      expect(dashboard.monthlyQuota.currentMonthNewVerified).toBe(1);
    });

    it("marks quota as active when scout has an active exam/medical grace pass", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 20);

      const scoutMock = {
        id: "scout_2",
        userId: "user_scout_2",
        scoutCode: "SCOUT-EXAM-01",
        fullName: "Aman Gupta",
        city: "Mumbai",
        college: "NMIMS",
        verificationStatus: "APPROVED",
        isRoyaltyPaused: false,
        monthlyQuotaExemptUntil: futureDate,
        streakMonths: 2,
        royaltyPercent: 1.0,
        totalRoyaltyEarned: 50000,
        user: {
          id: "user_scout_2",
          email: "aman@scout.in",
          wallet: { id: "w_2", balance: 5000, totalEarned: 50000 },
        },
      };

      vi.mocked(prisma.scoutProfile.findUnique).mockResolvedValue(scoutMock as any);
      vi.mocked(prisma.user.findMany).mockResolvedValue([]); // 0 users onboarded
      vi.mocked(prisma.deal.count).mockResolvedValue(0); // 0 deals

      const dashboard = await ScoutService.getDashboard("user_scout_2");

      expect(dashboard.monthlyQuota.isMet).toBe(true);
      expect(dashboard.monthlyQuota.isExempt).toBe(true);
    });
  });

  describe("Deal Passive Royalty Settlement (1% GMV)", () => {
    it("accurately calculates and credits 1% royalty to active Scout wallet", async () => {
      const mockTx = {
        user: {
          findUnique: vi.fn().mockImplementation(async ({ where }) => {
            if (where.id === "creator_user_1") {
              return { referredBy: "scout_user_1", influencerProfile: { displayName: "Rohan Vlogs" } };
            }
            if (where.id === "brand_user_1") {
              return { referredBy: null, brandProfile: { companyName: "Urban Botanics" } };
            }
            return null;
          }),
        },
        scoutProfile: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "scout_1",
              userId: "scout_user_1",
              scoutCode: "SCOUT-001",
              verificationStatus: "APPROVED",
              isRoyaltyPaused: false,
              monthlyQuotaExemptUntil: null,
              royaltyPercent: 1.0,
            },
          ]),
          update: vi.fn().mockResolvedValue({ id: "scout_1" }),
        },
        wallet: {
          findFirst: vi.fn().mockResolvedValue({ id: "treasury_w_id", balance: 50000000 }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          upsert: vi.fn().mockResolvedValue({ id: "scout_w_id", userId: "scout_user_1" }),
        },
        transaction: {
          findFirst: vi.fn().mockResolvedValue(null), // idempotency check
          create: vi.fn().mockResolvedValue({ id: "tx_royalty_1" }),
        },
      } as any;

      // Deal of ₹10,000 = 1,000,000 paise. 1% royalty = 10,000 paise (₹100).
      const result = await ScoutService.processDealRoyalty(
        mockTx,
        "deal_test_99",
        1_000_000,
        "creator_user_1",
        "brand_user_1"
      );

      expect(result.creditedScoutsCount).toBe(1);

      // Verify Treasury debit of 10,000 paise (₹100)
      expect(mockTx.wallet.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: "treasury_w_id",
            balance: { gte: 10_000 },
          }),
          data: { balance: { decrement: 10_000 } },
        })
      );

      // Verify Scout wallet credit of 10,000 paise (₹100)
      expect(mockTx.wallet.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "scout_user_1" },
          update: {
            balance: { increment: 10_000 },
            totalEarned: { increment: 10_000 },
          },
        })
      );

      // Verify double-entry ledger transactions created
      expect(mockTx.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: 10_000,
            type: "DEBIT",
          }),
        })
      );

      expect(mockTx.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: 10_000,
            type: "CREDIT",
          }),
        })
      );
    });

    it("does not pay duplicate royalties if both brand and creator were onboarded by same scout", async () => {
      const mockTx = {
        user: {
          findUnique: vi.fn().mockImplementation(async ({ where }) => {
            if (where.id === "creator_user_1") {
              return { referredBy: "same_scout_user", influencerProfile: { displayName: "Rohan Vlogs" } };
            }
            if (where.id === "brand_user_1") {
              return { referredBy: "same_scout_user", brandProfile: { companyName: "Urban Botanics" } };
            }
            return null;
          }),
        },
        scoutProfile: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "scout_same",
              userId: "same_scout_user",
              scoutCode: "SCOUT-SAME",
              verificationStatus: "APPROVED",
              isRoyaltyPaused: false,
              monthlyQuotaExemptUntil: null,
              royaltyPercent: 1.0,
            },
          ]),
          update: vi.fn().mockResolvedValue({ id: "scout_same" }),
        },
        wallet: {
          findFirst: vi.fn().mockResolvedValue({ id: "treasury_w_id", balance: 50000000 }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          upsert: vi.fn().mockResolvedValue({ id: "scout_w_id", userId: "same_scout_user" }),
        },
        transaction: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: "tx_1" }),
        },
      } as any;

      const result = await ScoutService.processDealRoyalty(
        mockTx,
        "deal_collab_88",
        2_000_000, // ₹20,000 deal -> 1% = ₹200 (20,000 paise)
        "creator_user_1",
        "brand_user_1"
      );

      // Deduped: single credit of 20,000 paise (₹200) to the scout
      expect(result.creditedScoutsCount).toBe(1);
      expect(mockTx.wallet.upsert).toHaveBeenCalledTimes(1);
    });

    it("skips payment if scout has paused royalties", async () => {
      const mockTx = {
        user: {
          findUnique: vi.fn().mockImplementation(async ({ where }) => {
            if (where.id === "creator_user_1") {
              return { referredBy: "scout_paused_user", influencerProfile: { displayName: "Rohan Vlogs" } };
            }
            return null;
          }),
        },
        scoutProfile: {
          findMany: vi.fn().mockResolvedValue([]), // scouts with isRoyaltyPaused: false will return empty
        },
        wallet: {
          findFirst: vi.fn(),
          updateMany: vi.fn(),
          upsert: vi.fn(),
        },
        transaction: {
          findFirst: vi.fn(),
          create: vi.fn(),
        },
      } as any;

      const result = await ScoutService.processDealRoyalty(
        mockTx,
        "deal_paused_1",
        1_000_000,
        "creator_user_1",
        "brand_1"
      );

      expect(result.creditedScoutsCount).toBe(0);
      expect(mockTx.wallet.upsert).not.toHaveBeenCalled();
    });
  });

  describe("Admin Actions", () => {
    it("adminApproveScout sets verificationStatus to APPROVED", async () => {
      vi.mocked(prisma.scoutProfile.update).mockResolvedValueOnce({
        id: "scout_appr",
        userId: "user_appr",
        verificationStatus: "APPROVED",
      } as any);

      const res = await ScoutService.adminApproveScout("scout_appr", "admin_user_1");
      expect(res.verificationStatus).toBe("APPROVED");
      expect(prisma.scoutProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "scout_appr" },
          data: expect.objectContaining({
            verificationStatus: "APPROVED",
            rejectionReason: null,
          }),
        })
      );
    });

    it("adminRejectScout sets verificationStatus to REJECTED with note", async () => {
      vi.mocked(prisma.scoutProfile.update).mockResolvedValueOnce({
        id: "scout_rej",
        userId: "user_rej",
        verificationStatus: "REJECTED",
        rejectionReason: "PAN document mismatch",
      } as any);

      const res = await ScoutService.adminRejectScout("scout_rej", "PAN document mismatch", "admin_user_1");
      expect(res.verificationStatus).toBe("REJECTED");
      expect(prisma.scoutProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "scout_rej" },
          data: expect.objectContaining({
            verificationStatus: "REJECTED",
            rejectionReason: "PAN document mismatch",
          }),
        })
      );
    });

    it("adminToggleRoyaltyPause pauses or resumes royalty stream", async () => {
      vi.mocked(prisma.scoutProfile.update).mockResolvedValueOnce({
        id: "scout_pause_1",
        isRoyaltyPaused: true,
      } as any);

      const res = await ScoutService.adminToggleRoyaltyPause("scout_pause_1", true, "Suspicious activity check", "admin_1");
      expect(res.isRoyaltyPaused).toBe(true);
    });

    it("adminGrantQuotaExemption sets future exemption date", async () => {
      vi.mocked(prisma.scoutProfile.update).mockResolvedValueOnce({
        id: "scout_grace_1",
        monthlyQuotaExemptUntil: new Date(),
      } as any);

      await ScoutService.adminGrantQuotaExemption("scout_grace_1", 30, "admin_1");
      expect(prisma.scoutProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "scout_grace_1" },
          data: expect.objectContaining({
            monthlyQuotaExemptUntil: expect.any(Date),
          }),
        })
      );
    });

    it("adminUpdateRoyaltyPercent updates scout cut", async () => {
      vi.mocked(prisma.scoutProfile.update).mockResolvedValueOnce({
        id: "scout_star_1",
        royaltyPercent: 1.5,
      } as any);

      const res = await ScoutService.adminUpdateRoyaltyPercent("scout_star_1", 1.5, "admin_1");
      expect(res.royaltyPercent).toBe(1.5);
    });
  });
});
