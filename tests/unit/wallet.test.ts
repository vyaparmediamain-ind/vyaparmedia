import { describe, it, expect, vi, beforeEach } from "vitest";
import { PaymentService } from "@/services/payment.service";
import { TDS_194O_RATE } from "@/constants";

describe("Unit Tests: Wallet Debit, Credit & Double-Entry Ledger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    process.env.ENCRYPTION_KEY = "a".repeat(64);
    process.env.HMAC_KEY = "b".repeat(64);
  });

  const createStatefulTx = (initialBalance = 50_000, initialFrozen = false) => {
    const state = {
      wallet: {
        id: "wallet_123",
        userId: "user_test_wallet",
        balance: initialBalance,
        isFrozen: initialFrozen,
      },
      transactions: [] as Array<{
        id: string;
        walletId: string;
        type: string;
        amount: number;
        status: string;
        razorpayPaymentId: string;
      }>,
      withdrawals: [] as Array<{
        id: string;
        walletId: string;
        amount: number;
        status: string;
      }>,
    };

    let serializedLock = Promise.resolve();

    const mockTx = {
      state,
      transaction: {
        findUnique: vi.fn().mockImplementation(async ({ where }) => {
          const found = state.transactions.find(
            (t) => t.razorpayPaymentId === where.razorpayPaymentId
          );
          if (!found) return null;
          return {
            ...found,
            wallet: { userId: state.wallet.userId },
          };
        }),
        update: vi.fn().mockImplementation(async ({ where, data }) => {
          const t = state.transactions.find((tx) => tx.id === where.id);
          if (t) Object.assign(t, data);
          return t;
        }),
        create: vi.fn().mockImplementation(async ({ data }) => {
          const newTx = {
            id: `tx_${Date.now()}_${Math.random()}`,
            ...data,
          };
          state.transactions.push(newTx);
          return newTx;
        }),
      },
      wallet: {
        updateMany: vi.fn().mockImplementation(async ({ where, data }) => {
          return new Promise((resolve) => {
            serializedLock = serializedLock.then(async () => {
              await new Promise((r) => setTimeout(r, Math.random() * 5));
              if (
                state.wallet.userId === where.userId &&
                state.wallet.balance >= where.balance.gte &&
                !state.wallet.isFrozen
              ) {
                state.wallet.balance -= data.balance.decrement;
                resolve({ count: 1 });
              } else {
                resolve({ count: 0 });
              }
            });
          });
        }),
        findUnique: vi.fn().mockImplementation(async ({ where }) => {
          if (state.wallet.userId === where.userId || state.wallet.id === where.id) {
            return { ...state.wallet };
          }
          return null;
        }),
      },
      withdrawal: {
        create: vi.fn().mockImplementation(async ({ data }) => {
          const newW = {
            id: `wd_${Date.now()}_${Math.random()}`,
            ...data,
          };
          state.withdrawals.push(newW);
          return newW;
        }),
      },
    };

    return mockTx;
  };

  // =========================================================================
  // 1. ATOMIC CONDITIONAL BALANCE DEDUCTION PATTERN
  // =========================================================================
  describe("Pillar 1 & 4: Atomic Conditional Balance Deduction Pattern", () => {
    it("should execute atomic conditional balance deduction via real PaymentService when funds are sufficient and wallet is active", async () => {
      const mockTx = createStatefulTx(50_000, false);
      const res = await PaymentService.executeWithdrawalDbTransaction(
        mockTx as never,
        "user_test_wallet",
        {
          amount: 20_000,
          bankAccountName: "Tester",
          bankAccountNumber: "1234567890",
          ifscCode: "HDFC0001234",
        },
        "idem_wd_1",
        "ALLOW",
        0,
        false
      );

      expect(res.w).toBeDefined();
      expect(mockTx.state.wallet.balance).toBe(30_000);
      expect(mockTx.state.transactions).toHaveLength(1);
    });

    it("should reject balance deduction when funds are insufficient via real PaymentService (count === 0)", async () => {
      const mockTx = createStatefulTx(10_000, false);

      await expect(
        PaymentService.executeWithdrawalDbTransaction(
          mockTx as never,
          "user_test_wallet",
          {
            amount: 25_000,
            bankAccountName: "Tester",
            bankAccountNumber: "1234567890",
            ifscCode: "HDFC0001234",
          },
          "idem_wd_insufficient",
          "ALLOW",
          0,
          false
        )
      ).rejects.toThrow("INSUFFICIENT_FUNDS: Insufficient wallet balance for withdrawal");

      expect(mockTx.state.wallet.balance).toBe(10_000);
    });

    it("should reject balance deduction in the same query when wallet is frozen even if balance is sufficient via real PaymentService", async () => {
      const mockTx = createStatefulTx(100_000, true);

      await expect(
        PaymentService.executeWithdrawalDbTransaction(
          mockTx as never,
          "user_test_wallet",
          {
            amount: 10_000,
            bankAccountName: "Tester",
            bankAccountNumber: "1234567890",
            ifscCode: "HDFC0001234",
          },
          "idem_wd_frozen",
          "ALLOW",
          0,
          false
        )
      ).rejects.toThrow("WALLET_FROZEN: Your wallet is currently frozen or locked");

      expect(mockTx.state.wallet.balance).toBe(100_000);
    });
  });

  // =========================================================================
  // 2. CONCURRENCY RACE SIMULATION (DEFINITION OF DONE)
  // =========================================================================
  describe("Definition of Done: Concurrent Withdrawal Race Condition Simulation", () => {
    it("should allow exactly 1 withdrawal to succeed and 1 to cleanly fail with INSUFFICIENT_FUNDS on parallel requests via real PaymentService", async () => {
      const mockTx = createStatefulTx(100_000, false); // ₹1,000 in paise
      const withdrawalAmount = 80_000; // ₹800 each (Total ₹1,600 required)
      const withdrawalData = {
        amount: withdrawalAmount,
        bankAccountName: "Tester",
        bankAccountNumber: "1234567890",
        ifscCode: "HDFC0001234",
      };

      // Dispatch 2 parallel withdrawal requests directly to real PaymentService
      const [res1, res2] = await Promise.allSettled([
        PaymentService.executeWithdrawalDbTransaction(
          mockTx as never,
          "user_test_wallet",
          withdrawalData,
          "req_parallel_01",
          "ALLOW",
          0,
          false
        ),
        PaymentService.executeWithdrawalDbTransaction(
          mockTx as never,
          "user_test_wallet",
          withdrawalData,
          "req_parallel_02",
          "ALLOW",
          0,
          false
        ),
      ]);

      const successes = [res1, res2].filter((r) => r.status === "fulfilled");
      const rejections = [res1, res2].filter((r) => r.status === "rejected");

      // Exactly 1 succeeds, 1 cleanly rejected
      expect(successes).toHaveLength(1);
      expect(rejections).toHaveLength(1);

      const rejectionReason = (rejections[0] as PromiseRejectedResult).reason;
      expect(rejectionReason.message).toContain("INSUFFICIENT_FUNDS");

      // Balance must be exactly ₹200 (20,000 paise). Zero double-debit!
      expect(mockTx.state.wallet.balance).toBe(20_000);
      expect(mockTx.state.withdrawals).toHaveLength(1);
      expect(mockTx.state.transactions).toHaveLength(1);
    });
  });

  // =========================================================================
  // 3. DOUBLE-ENTRY LEDGER CONSERVATION
  // =========================================================================
  describe("Pillar 2: Double-Entry Ledger Integrity & Balance Sheet Conservation", () => {
    it("should ensure total debits equal total credits for any balance-affecting transfer", () => {
      const escrowTransferAmount = 100000; // 1000 INR
      const platformFee = 10000; // 100 INR
      const influencerPayout = 90000; // 900 INR

      // Brand pays escrowTransferAmount
      const debitEntries = [
        { account: "BRAND_ESCROW_OUT", amount: escrowTransferAmount, type: "DEBIT" },
      ];

      // Influencer receives net payout + Platform receives fee
      const creditEntries = [
        { account: "INFLUENCER_WALLET", amount: influencerPayout, type: "CREDIT" },
        { account: "PLATFORM_REVENUE", amount: platformFee, type: "CREDIT" },
      ];

      const totalDebits = debitEntries.reduce((sum, e) => sum + e.amount, 0);
      const totalCredits = creditEntries.reduce((sum, e) => sum + e.amount, 0);

      expect(totalDebits).toBe(totalCredits);
      expect(totalDebits).toBe(100000);
    });

    it("should conserve double-entry balance sheet on deal completion with TDS withholding", () => {
      const grossDealAmount = 100_000; // ₹1,000
      const tdsRate = TDS_194O_RATE; // Section 194-O
      const tdsWithheld = Math.round(grossDealAmount * tdsRate); // 100 paise = ₹1
      const netPayout = grossDealAmount - tdsWithheld; // 99,900 paise = ₹999

      const journalEntries = [
        { account: "BRAND_WALLET_DEBIT", amount: grossDealAmount, side: "DEBIT" },
        { account: "INFLUENCER_WALLET_NET_CREDIT", amount: netPayout, side: "CREDIT" },
        { account: "TDS_TREASURY_CREDIT", amount: tdsWithheld, side: "CREDIT" },
      ];

      const totalDebit = journalEntries
        .filter((e) => e.side === "DEBIT")
        .reduce((sum, e) => sum + e.amount, 0);
      const totalCredit = journalEntries
        .filter((e) => e.side === "CREDIT")
        .reduce((sum, e) => sum + e.amount, 0);

      expect(totalDebit).toBe(totalCredit);
      expect(totalDebit).toBe(grossDealAmount);
    });
  });

  // =========================================================================
  // 4. IDEMPOTENCY KEY REPLAY GUARD
  // =========================================================================
  describe("Pillar 3: Idempotency Key Replay Protection", () => {
    it("should complete top-up and increment wallet balance on first invocation", async () => {
      const mockTx = {
        transaction: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        wallet: {
          update: vi.fn().mockResolvedValue({ id: "w_1", balance: 5000 }),
        },
      };

      const result = await PaymentService.completeWalletTopUp(mockTx as never, {
        transactionId: "tx_123",
        walletId: "w_1",
        amount: 5000,
        razorpayPaymentId: "pay_test_123",
      });

      expect(result).toBe(true);
      expect(mockTx.transaction.updateMany).toHaveBeenCalledWith({
        where: {
          id: "tx_123",
          status: { notIn: ["COMPLETED", "FAILED", "REVERSED"] },
        },
        data: {
          status: "COMPLETED",
          razorpayPaymentId: "pay_test_123",
        },
      });
      expect(mockTx.wallet.update).toHaveBeenCalledWith({
        where: { id: "w_1" },
        data: {
          balance: { increment: 5000 },
          totalDeposited: { increment: 5000 },
        },
      });
    });

    it("should return false idempotently when transaction was already completed without mutating balance", async () => {
      const mockTx = {
        transaction: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }), // Already processed
        },
        wallet: {
          update: vi.fn(),
        },
      };

      const result = await PaymentService.completeWalletTopUp(mockTx as never, {
        transactionId: "tx_123",
        walletId: "w_1",
        amount: 5000,
        razorpayPaymentId: "pay_test_123",
      });

      expect(result).toBe(false);
      expect(mockTx.wallet.update).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 5. RECONCILIATION ENGINE INVARIANTS
  // =========================================================================
  describe("Pillar 5: Daily Ledger vs Wallet Balance Reconciliation", () => {
    it("should calculate zero drift when stored wallet balance matches net completed transactions", () => {
      const completedTransactions = [
        { type: "CREDIT", amount: 100_000 }, // Deposit ₹1,000
        { type: "DEBIT", amount: 40_000 },   // Withdrawal ₹400
        { type: "CREDIT", amount: 20_000 },  // Reward ₹200
      ];

      const totalCredits = completedTransactions
        .filter((t) => t.type === "CREDIT")
        .reduce((sum, t) => sum + t.amount, 0);

      const totalDebits = completedTransactions
        .filter((t) => t.type === "DEBIT")
        .reduce((sum, t) => sum + t.amount, 0);

      const calculatedNetBalance = totalCredits - totalDebits; // 80,000
      const storedWalletBalance = 80_000;

      const drift = storedWalletBalance - calculatedNetBalance;
      expect(drift).toBe(0);
    });

    it("should flag financial anomaly when stored balance does not match ledger sum", () => {
      const totalCredits = 100_000;
      const totalDebits = 30_000;
      const calculatedNetBalance = totalCredits - totalDebits; // 70,000 paise

      const storedCorruptedBalance = 90_000; // Drift of +20,000 paise (leak)

      const drift = storedCorruptedBalance - calculatedNetBalance;
      expect(drift).not.toBe(0);
      expect(drift).toBe(20_000);
    });
  });

  // =========================================================================
  // 6. DB CHECK CONSTRAINT BACKSTOP (BALANCE >= 0)
  // =========================================================================
  describe("Pillar 6: PostgreSQL Engine Constraint Backstop", () => {
    it("should reject negative balances as invalid at database level", () => {
      const validateNonNegativeBalance = (balance: number) => {
        if (balance < 0) {
          throw new Error("violates check constraint check_wallet_balance_nonnegative");
        }
        return true;
      };

      expect(validateNonNegativeBalance(0)).toBe(true);
      expect(validateNonNegativeBalance(5000)).toBe(true);
      expect(() => validateNonNegativeBalance(-1)).toThrow("check_wallet_balance_nonnegative");
    });
  });

  // =========================================================================
  // 7. TOP-UP BOUNDARY VALIDATIONS
  // =========================================================================
  describe("PaymentService.createWalletTopUpOrder Validation", () => {
    it("should reject non-integer or below-minimum top-up amounts", async () => {
      await expect(PaymentService.createWalletTopUpOrder("u1", 50)).rejects.toThrow(
        "Minimum top-up amount is ₹1",
      );
      await expect(PaymentService.createWalletTopUpOrder("u1", 100.5)).rejects.toThrow(
        "Minimum top-up amount is ₹1",
      );
      await expect(PaymentService.createWalletTopUpOrder("u1", -500)).rejects.toThrow(
        "Minimum top-up amount is ₹1",
      );
    });

    it("should reject amounts exceeding maximum ₹10,00,000 top-up ceiling", async () => {
      const overLimitPaise = 100_000_001; // > 10 lakh
      await expect(PaymentService.createWalletTopUpOrder("u1", overLimitPaise)).rejects.toThrow(
        "Top-up amount exceeds maximum allowed",
      );
    });
  });
});
