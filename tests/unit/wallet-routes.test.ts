import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as getWalletRoute } from "@/app/api/wallet/route";
import { GET as getTransactionsRoute } from "@/app/api/wallet/transactions/route";
import { WalletService } from "@/services/wallet.service";
import { auth } from "@/lib/auth";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/services/wallet.service", () => ({
  WalletService: {
    getWallet: vi.fn(),
    getTransactions: vi.fn(),
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkTieredRateLimit: vi.fn().mockResolvedValue({ success: true }),
}));

describe("Wallet Route Handlers Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/wallet", () => {
    it("returns 401 Unauthorized when session is unauthenticated", async () => {
      vi.mocked(auth).mockResolvedValueOnce(null as any);

      const req = new NextRequest("http://localhost:3000/api/wallet");
      const res = await getWalletRoute(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error || json.message).toContain("Unauthorized");
    });

    it("returns 404 when user wallet does not exist", async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: "user_without_wallet", userType: "BRAND" },
      } as any);
      vi.mocked(WalletService.getWallet).mockResolvedValueOnce(null as any);

      const req = new NextRequest("http://localhost:3000/api/wallet");
      const res = await getWalletRoute(req);
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.message).toContain("Wallet not found");
    });

    it("returns 200 with sanitized wallet metrics for authenticated user", async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: "brand_owner_1", userType: "BRAND" },
      } as any);
      vi.mocked(WalletService.getWallet).mockResolvedValueOnce({
        wallet: {
          id: "wallet_123",
          userId: "brand_owner_1",
          balance: 500000,
          pendingBalance: 150000,
          totalEarned: 0,
          totalWithdrawn: 0,
          totalHeld: 150000,
          totalSpent: 350000,
          totalDeposited: 650000,
          debt: 0,
          isFrozen: false,
          frozenReason: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        transactions: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      } as any);

      const req = new NextRequest("http://localhost:3000/api/wallet");
      const res = await getWalletRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.wallet.id).toBe("wallet_123");
      expect(json.wallet.balance).toBe(500000);
      expect(json.wallet.isFrozen).toBe(false);
    });
  });

  describe("GET /api/wallet/transactions", () => {
    it("returns 401 Unauthorized when unauthenticated", async () => {
      vi.mocked(auth).mockResolvedValueOnce(null as any);

      const req = new NextRequest("http://localhost:3000/api/wallet/transactions");
      const res = await getTransactionsRoute(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error || json.message).toBeTruthy();
    });

    it("returns 200 with paginated transactions when authenticated", async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: "creator_555", userType: "CREATOR" },
      } as any);
      vi.mocked(WalletService.getWallet).mockResolvedValueOnce({
        wallet: {
          id: "wallet_creator_555",
          transactions: [
            {
              id: "tx_1",
              amount: 250000,
              type: "ESCROW_RELEASE",
              status: "SUCCESS",
              description: "Milestone payout for campaign #4",
              createdAt: new Date().toISOString(),
            },
          ],
        },
        totalTransactions: 1,
        totalPages: 1,
      } as any);

      const req = new NextRequest("http://localhost:3000/api/wallet/transactions?page=1&limit=20");
      const res = await getTransactionsRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.transactions).toHaveLength(1);
      expect(json.transactions[0].id).toBe("tx_1");
    });
  });
});
