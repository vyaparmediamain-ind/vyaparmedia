import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { makeSession } from "../utils/auth";
import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({
  requireActiveAdmin: vi.fn(async (user: { userType?: string; status?: string }) => {
    if (user?.userType !== "ADMIN") throw AppError.forbidden("Admin access required");
    if (user?.status === "SUSPENDED") throw AppError.forbidden("Account is suspended");
    return true;
  }),
}));

vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return {
    ...actual,
    rateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
    checkRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
    checkTieredRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
  };
});

vi.mock("@/lib/idempotency", () => ({
  claimIdempotencyKey: vi.fn().mockResolvedValue({ isDuplicate: false }),
  releaseIdempotencyKey: vi.fn().mockResolvedValue(true),
  saveIdempotencyResponse: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/kill-switch", () => ({
  assertKillSwitchInactive: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/action-eligibility", () => ({
  checkDealEscrowFundingEligibility: vi.fn(
    (deal: { status?: string; creatorHasVerifiedBank?: boolean }, userId: string) => {
      if (deal.status !== "ACCEPTED") {
        return { allowed: false, reason: "Deal is not in ACCEPTED state", reasonCode: "INVALID_STATE" };
      }
      if (!deal.creatorHasVerifiedBank) {
        return { allowed: false, reason: "Creator must have a verified bank account", reasonCode: "UNVERIFIED_BANK" };
      }
      return { allowed: true };
    }
  ),
}));

vi.mock("@/services/payment.service", () => ({
  PaymentService: {
    createDealRouteEscrowOrder: vi.fn().mockResolvedValue({
      orderId: "order_mock_123",
      amount: 5000000,
      currency: "INR",
      key: "rzp_test_123",
      creatorAccountId: "acc_123",
    }),
    requestWithdrawal: vi.fn().mockResolvedValue({
      payoutId: "pout_mock_123",
      amountPaise: 100000,
      status: "QUEUED",
    }),
  },
}));

vi.mock("@/services/deal.service", () => ({
  DealService: {
    rejectPendingInvite: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("@/lib/contract-engine", () => ({
  signAndSaveDealContract: vi.fn().mockResolvedValue({
    signed: { isFullySigned: true },
    contractHash: "sha256_mock_hash",
  }),
}));

vi.mock("@/services/wallet.service", () => ({
  WalletService: {
    getWallet: vi.fn().mockResolvedValue({
      wallet: {
        transactions: [
          {
            id: "tx_1",
            amount: 50000, // 50000 paise (₹500)
            type: "PAYOUT",
            status: "SUCCESS",
            createdAt: new Date().toISOString(),
          },
        ],
      },
      totalTransactions: 1,
      totalPages: 1,
    }),
  },
}));

vi.mock("@/services/report-verification.service", () => ({
  ReportVerificationService: {
    verifyReport: vi.fn(async (id: string) => {
      if (id === "rep_valid_123") {
        return {
          valid: true,
          id: "rep_valid_123",
          type: "TAX_INVOICE",
          createdAt: "2026-11-23T10:00:00.000Z",
        };
      }
      return { valid: false };
    }),
  },
}));

vi.mock("@/lib/db", () => {
  const mockBank = {
    id: "bank_1",
    userId: "usr_influencer_1",
    accountName: "Creator Name",
    accountNumber: "123456789012",
    ifscCode: "HDFC0001234",
    isVerified: true,
    deletedAt: null,
  };

  const mockDealAccepted = {
    id: "deal_fund_1",
    status: "ACCEPTED",
    amount: 5000000, // 5000000 paise
    brand: { id: "bp_1", userId: "usr_brand_1" },
    influencer: {
      user: {
        bankAccounts: [mockBank],
      },
    },
    paymentHold: null,
  };

  const mockDealPendingSig = {
    id: "deal_sign_1",
    status: "PENDING_SIGNATURE",
    signDeadline: new Date(Date.now() + 86400000).toISOString(),
    influencer: { userId: "usr_influencer_1", displayName: "Creator" },
    brand: { userId: "usr_brand_1", companyName: "Brand Inc" },
    campaign: { title: "Campaign Title" },
  };

  const mockDeadJob = {
    id: "dlq_1",
    topic: "PAYMENT_SETTLEMENT",
    status: "FAILED",
    attempts: 3,
    error: "Timeout contacting payment gateway",
    createdAt: new Date(),
  };

  return {
    default: {
      indiaTaxCompliance: {
        findUnique: vi.fn(async ({ where }: { where: { userId: string } }) => {
          if (where.userId === "usr_compliant") {
            return { panLast4: "1234" };
          }
          return null;
        }),
      },
      bankAccount: {
        findFirst: vi.fn(async ({ where }: { where: { id: string; userId: string } }) => {
          if (where.id === "bank_verified") {
            return { ...mockBank, id: "bank_verified", isVerified: true };
          }
          if (where.id === "bank_unverified") {
            return { ...mockBank, id: "bank_unverified", isVerified: false };
          }
          return null;
        }),
      },
      deal: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
          if (where.id === "deal_fund_1") return mockDealAccepted;
          return null;
        }),
        findFirst: vi.fn(async ({ where }: { where: { id: string } }) => {
          if (where.id === "deal_sign_1") return mockDealPendingSig;
          return null;
        }),
      },
      deadLetterJob: {
        findMany: vi.fn().mockResolvedValue([mockDeadJob]),
        count: vi.fn().mockResolvedValue(1),
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
          if (where.id === "dlq_1") return mockDeadJob;
          return null;
        }),
        update: vi.fn().mockResolvedValue({ ...mockDeadJob, status: "DISCARDED" }),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: "usr_admin_1", userType: "ADMIN", status: "ACTIVE" }),
      },
    },
    ensurePlatformTreasury: vi.fn().mockResolvedValue({ id: "treasury_1" }),
  };
});

// Import route handlers
import { POST as withdrawPost } from "@/app/api/payments/withdraw/route";
import { GET as transactionsGet } from "@/app/api/wallet/transactions/route";
import { POST as fundDealPost } from "@/app/api/deals/[id]/fund/route";
import { POST as signDealPost } from "@/app/api/deals/[id]/sign/route";
import { POST as rejectDealPost } from "@/app/api/deals/[id]/reject/route";
import { GET as verifyReportGet } from "@/app/api/verify-report/[id]/route";
import { GET as adminDlqGet, POST as adminDlqPost } from "@/app/api/admin/jobs/dlq/route";

describe("Money-Critical Routes Business Contract Tests (Requirement 5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Wallet Withdrawal Business Logic (/api/payments/withdraw)", () => {
    it("rejects withdrawal missing Idempotency-Key header with 400", async () => {
      const session = makeSession("INFLUENCER", { id: "usr_compliant" });
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      const req = new NextRequest("http://localhost:3000/api/payments/withdraw", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: 100000, bankAccountId: "bank_verified" }),
      });

      const res = await withdrawPost(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.message).toContain("Idempotency-Key");
    });

    it("rejects withdrawal below minimum amount (50,000 paise = ₹500) with 400", async () => {
      const session = makeSession("INFLUENCER", { id: "usr_compliant" });
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      const req = new NextRequest("http://localhost:3000/api/payments/withdraw", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Idempotency-Key": "idemp_test_key_12345678",
        },
        body: JSON.stringify({ amount: 49999, bankAccountId: "bank_verified" }), // 49999 paise < 50000 paise
      });

      const res = await withdrawPost(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.details || json.error).toBeDefined();
    });

    it("rejects withdrawal without PAN tax compliance with 400", async () => {
      const session = makeSession("INFLUENCER", { id: "usr_non_compliant" });
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      const req = new NextRequest("http://localhost:3000/api/payments/withdraw", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Idempotency-Key": "idemp_test_key_12345678",
        },
        body: JSON.stringify({ amount: 100000, bankAccountId: "bank_verified" }),
      });

      const res = await withdrawPost(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.message).toContain("PAN tax compliance");
    });

    it("rejects withdrawal to unverified bank account with 400", async () => {
      const session = makeSession("INFLUENCER", { id: "usr_compliant" });
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      const req = new NextRequest("http://localhost:3000/api/payments/withdraw", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Idempotency-Key": "idemp_test_key_12345678",
        },
        body: JSON.stringify({ amount: 100000, bankAccountId: "bank_unverified" }),
      });

      const res = await withdrawPost(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.message).toContain("verify this bank account");
    });
  });

  describe("Wallet Transactions Query & Paise Formatting (/api/wallet/transactions)", () => {
    it("returns paginated transactions and balances formatted in integer paise", async () => {
      const session = makeSession("INFLUENCER", { id: "usr_influencer_1" });
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      const req = new NextRequest("http://localhost:3000/api/wallet/transactions?page=1&limit=20");
      const res = await transactionsGet(req, { params: Promise.resolve({}) });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.transactions[0].amount).toBe(50000);
    });

    it("rejects invalid date range (startDate > endDate) with 400", async () => {
      const session = makeSession("INFLUENCER", { id: "usr_influencer_1" });
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      const req = new NextRequest(
        "http://localhost:3000/api/wallet/transactions?startDate=2026-12-01&endDate=2026-11-01"
      );
      const res = await transactionsGet(req, { params: Promise.resolve({}) });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Validation Error");
    });
  });

  describe("Deal Escrow Funding (/api/deals/[id]/fund)", () => {
    it("successfully creates escrow funding order in integer paise for eligible deal", async () => {
      const session = makeSession("BRAND", { id: "usr_brand_1" });
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      const req = new NextRequest("http://localhost:3000/api/deals/deal_fund_1/fund", {
        method: "POST",
      });

      const res = await fundDealPost(req, { params: Promise.resolve({ id: "deal_fund_1" }) });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.amount).toBe(5000000);
    });

    it("returns 404 if deal to fund is not found", async () => {
      const session = makeSession("BRAND", { id: "usr_brand_1" });
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      const req = new NextRequest("http://localhost:3000/api/deals/deal_non_existent/fund", {
        method: "POST",
      });

      const res = await fundDealPost(req, { params: Promise.resolve({ id: "deal_non_existent" }) });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.message).toBe("Deal not found");
    });
  });

  describe("Deal Signature Contract (/api/deals/[id]/sign)", () => {
    it("successfully counter-signs deal and returns fully-signed status", async () => {
      const session = makeSession("INFLUENCER", { id: "usr_influencer_1" });
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      const req = new NextRequest("http://localhost:3000/api/deals/deal_sign_1/sign", {
        method: "POST",
      });

      const res = await signDealPost(req, { params: Promise.resolve({ id: "deal_sign_1" }) });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.isFullySigned).toBe(true);
    });

    it("rejects unauthorized user trying to sign deal with 403", async () => {
      const session = makeSession("INFLUENCER", { id: "usr_attacker_stranger" });
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      const req = new NextRequest("http://localhost:3000/api/deals/deal_sign_1/sign", {
        method: "POST",
      });

      const res = await signDealPost(req, { params: Promise.resolve({ id: "deal_sign_1" }) });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.message || json.error).toContain("party to this deal");
    });
  });

  describe("Deal Rejection Flow (/api/deals/[id]/reject)", () => {
    it("successfully rejects pending deal invite", async () => {
      const session = makeSession("INFLUENCER", { id: "usr_influencer_1" });
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      const req = new NextRequest("http://localhost:3000/api/deals/deal_123/reject", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "Not available on these dates" }),
      });

      const res = await rejectDealPost(req, { params: Promise.resolve({ id: "deal_123" }) });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.message).toContain("rejected successfully");
    });
  });

  describe("Public Report Verification (/api/verify-report/[id])", () => {
    it("verifies authentic report and returns platform cryptographic proof", async () => {
      const req = new NextRequest("http://localhost:3000/api/verify-report/rep_valid_123");
      const res = await verifyReportGet(req, { params: Promise.resolve({ id: "rep_valid_123" }) });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.valid).toBe(true);
      expect(json.data.reportId).toBe("rep_valid_123");
    });

    it("returns valid: false when report ID is not recognized", async () => {
      const req = new NextRequest("http://localhost:3000/api/verify-report/rep_unknown_999");
      const res = await verifyReportGet(req, { params: Promise.resolve({ id: "rep_unknown_999" }) });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.valid).toBe(false);
    });
  });

  describe("Admin Dead-Letter Queue (DLQ) Management (/api/admin/jobs/dlq)", () => {
    it("rejects non-admin accessing DLQ with 403", async () => {
      const session = makeSession("BRAND");
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      const req = new NextRequest("http://localhost:3000/api/admin/jobs/dlq");
      const res = await adminDlqGet(req, { params: Promise.resolve({}) });

      expect(res.status).toBe(403);
    });

    it("allows active admin to list failed DLQ jobs", async () => {
      const session = makeSession("ADMIN", { status: "ACTIVE" });
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      const req = new NextRequest("http://localhost:3000/api/admin/jobs/dlq");
      const res = await adminDlqGet(req, { params: Promise.resolve({}) });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.jobs).toHaveLength(1);
      expect(json.total).toBe(1);
    });

    it("allows active admin to discard a dead letter job", async () => {
      const session = makeSession("ADMIN", { status: "ACTIVE" });
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      const req = new NextRequest("http://localhost:3000/api/admin/jobs/dlq", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dlqId: "dlq_1", action: "discard" }),
      });

      const res = await adminDlqPost(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.message).toBe("Job discarded");
    });
  });
});
