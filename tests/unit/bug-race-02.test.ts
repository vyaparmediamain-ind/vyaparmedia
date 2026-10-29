import { describe, it, expect, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("BUG-RACE-02: TOCTOU Duplicate Referral Reward Double-Credit", () => {
  it("enforces unique rewardKey on referral Transaction to prevent duplicate payout races", () => {
    const filePath = path.join(process.cwd(), "src/lib/referral-engine.ts");
    const content = fs.readFileSync(filePath, "utf-8");

    // Ensure rewardKey pattern exists for deal referral transactions
    expect(content).toMatch(/ref_reward:/);
    // Ensure razorpayPaymentId is populated with the unique rewardKey
    expect(content).toMatch(/razorpayPaymentId:\s*rewardKey/);
    // Ensure P2002 concurrent error handling exists
    expect(content).toMatch(/P2002/);
  });

  it("prevents double-credit when two concurrent reward calls run via Promise.all(2)", async () => {
    const { processReferralReward } = await import("@/lib/referral-engine");

    const userId = "referee_user_1";
    const referrerId = "referrer_user_1";
    const dealId = "deal_race_123";
    const dealAmountPaise = 100000; // 1000 INR

    // Track created transactions in-memory
    const createdTransactions: Array<{ walletId: string; type: string; amount: number; razorpayPaymentId?: string | null }> = [];

    // Mock prisma client
    const mockTx = {
      user: {
        findUnique: vi.fn().mockImplementation(async ({ where }: { where: { id: string } }) => {
          if (where.id === userId) {
            return { id: userId, referredBy: referrerId, trustScore: 75, createdAt: new Date() };
          }
          if (where.id === referrerId) {
            return { id: referrerId, trustScore: 750, createdAt: new Date(), badges: [] };
          }
          return null;
        }),
        count: vi.fn().mockResolvedValue(500), // Platinum tier (1% revenue share)
      },
      wallet: {
        upsert: vi.fn().mockResolvedValue({ id: "wallet_referrer_1", userId: referrerId, balance: 0 }),
        findUnique: vi.fn().mockResolvedValue({ id: "wallet_referrer_1" }),
        findFirst: vi.fn().mockResolvedValue({ id: "wallet_treasury_1", balance: 5000000 }),
        create: vi.fn().mockResolvedValue({ id: "wallet_treasury_1", balance: 5000000 }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue({ id: "wallet_referrer_1", balance: 5000 }),
      },
      transaction: {
        findFirst: vi.fn().mockImplementation(async ({ where }: { where: { dealId?: string; razorpayPaymentId?: string } }) => {
          return createdTransactions.find(t => t.type === "CREDIT" && t.razorpayPaymentId && t.razorpayPaymentId === where.razorpayPaymentId) || null;
        }),
        findUnique: vi.fn().mockImplementation(async ({ where }: { where: { razorpayPaymentId?: string } }) => {
          return createdTransactions.find(t => t.razorpayPaymentId === where.razorpayPaymentId) || null;
        }),
        create: vi.fn().mockImplementation(async ({ data }: { data: { walletId: string; type: string; amount: number; razorpayPaymentId?: string | null } }) => {
          if (data.razorpayPaymentId) {
            const conflict = createdTransactions.find(t => t.razorpayPaymentId === data.razorpayPaymentId);
            if (conflict) {
              const err = new Error("Unique constraint failed on the fields: (`razorpayPaymentId`)");
              (err as Error & { code?: string }).code = "P2002";
              throw err;
            }
          }
          createdTransactions.push(data);
          return { id: `tx_${createdTransactions.length}`, ...data };
        }),
      },
      influencerProfile: { findUnique: vi.fn().mockResolvedValue(null) },
      brandProfile: { findUnique: vi.fn().mockResolvedValue(null) },
      badge: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn(), createMany: vi.fn() },
      userBadge: { createMany: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
      weeklyChallenge: { findFirst: vi.fn().mockResolvedValue(null) },
      userChallengeProgress: { findUnique: vi.fn().mockResolvedValue(null) },
      notification: { create: vi.fn().mockResolvedValue({ id: "notif_1" }) },
    };

    // Run 2 concurrent calls with identical dealId and userId
    await Promise.all([
      processReferralReward(userId, dealAmountPaise, mockTx as unknown as Parameters<typeof processReferralReward>[2], "wallet_treasury_1", dealId),
      processReferralReward(userId, dealAmountPaise, mockTx as unknown as Parameters<typeof processReferralReward>[2], "wallet_treasury_1", dealId),
    ]);

    // Assert that exactly 1 CREDIT transaction was created, NOT 2
    const creditTxs = createdTransactions.filter(t => t.type === "CREDIT");
    expect(creditTxs).toHaveLength(1);
  });
});
