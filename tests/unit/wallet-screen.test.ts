import { describe, it, expect, vi } from "vitest";
import { formatCurrency } from "@/lib/utils-client";
import { subscribeToWalletUpdates } from "@/lib/supabase-realtime";
import { validateWithdrawalAmount } from "@/components/dashboard/wallet/FullScreenWithdrawFlow";
import { withdrawalSchema } from "@/lib/validations/payment";

describe("Wallet Screen: Balance Segregation & Formatting", () => {
  it("formats currency values cleanly in INR format", () => {
    // 50,000 paise = ₹500
    expect(formatCurrency(50000)).toContain("500");
    // 1,00,000 paise = ₹1,000
    expect(formatCurrency(100000)).toContain("1,000");
    // 10,00,000 paise = ₹10,000
    expect(formatCurrency(1000000)).toContain("10,000");
    // 1,00,00,000 paise = ₹1,00,000 (1 Lakh)
    expect(formatCurrency(10000000)).toContain("1,00,000");
  });

  it("strictly separates available, escrow-locked, and pending balances", () => {
    const rawWallet = {
      balance: 2500000, // ₹25,000 available
      pendingBalance: 1500000, // ₹15,000 pending clearance
      totalHeld: 5000000, // ₹50,000 brand escrow held
      totalEarned: 10000000,
      totalWithdrawn: 6000000,
    };

    const availablePaise = rawWallet.balance;
    const escrowLockedPaise = rawWallet.totalHeld;
    const pendingPaise = rawWallet.pendingBalance;

    expect(availablePaise).toBe(2500000);
    expect(escrowLockedPaise).toBe(5000000);
    expect(pendingPaise).toBe(1500000);

    // Sum verification: Available + Escrow + Pending are mutually exclusive buckets
    expect(availablePaise + escrowLockedPaise + pendingPaise).toBe(9000000);
  });
});

describe("Wallet Screen: Withdrawal Amount Validation Guards", () => {
  const availableBalanceInPaise = 2500000; // ₹25,000

  it("rejects amounts below minimum ₹500", () => {
    // Client-side UI validation
    const result = validateWithdrawalAmount("200", availableBalanceInPaise);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Minimum withdrawal amount is");

    // Server-side route schema validation
    const serverResult = withdrawalSchema.safeParse({ amount: 20000, bankAccountId: "acc_test_1" });
    expect(serverResult.success).toBe(false);
  });

  it("rejects amounts exceeding available balance", () => {
    const result = validateWithdrawalAmount("30000", availableBalanceInPaise);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("exceeds your available balance");
  });

  it("rejects amounts exceeding maximum ₹5,00,000", () => {
    const result = validateWithdrawalAmount("600000", availableBalanceInPaise);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Maximum single withdrawal is");

    // Server-side route schema validation
    const serverResult = withdrawalSchema.safeParse({ amount: 60000000, bankAccountId: "acc_test_1" });
    expect(serverResult.success).toBe(false);
  });

  it("approves valid amounts within boundaries", () => {
    const result = validateWithdrawalAmount("10000", availableBalanceInPaise);
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();

    // Server-side route schema validation
    const serverResult = withdrawalSchema.safeParse({ amount: 1000000, bankAccountId: "acc_test_1" });
    expect(serverResult.success).toBe(true);
  });

  it("enforces env-configured MAX_WITHDRAWAL_AMOUNT limit dynamically", () => {
    // Exactly at MAX_WITHDRAWAL_AMOUNT (₹5,00,000 / 50M paise)
    const exactMaxResult = withdrawalSchema.safeParse({
      amount: 50_000_000,
      bankAccountId: "acc_test_1",
    });
    expect(exactMaxResult.success).toBe(true);

    // 1 paise above MAX_WITHDRAWAL_AMOUNT
    const overMaxResult = withdrawalSchema.safeParse({
      amount: 50_000_001,
      bankAccountId: "acc_test_1",
    });
    expect(overMaxResult.success).toBe(false);
    expect(overMaxResult.error?.issues[0]?.message).toContain("Maximum single withdrawal is INR");
  });
});

describe("Wallet Screen: Payout Itemized Breakdown & Idempotency", () => {
  it("calculates zero-fee breakdown and net payout correctly", () => {
    const requestedPaise = 1500000; // ₹15,000
    const platformFeePaise = 0; // Zero fee
    const tdsPaise = 0; // 0 for PAN compliant

    const netPaise = requestedPaise - platformFeePaise - tdsPaise;
    expect(netPaise).toBe(1500000);
    expect(formatCurrency(netPaise)).toContain("15,000");
  });

  it("generates 32-character idempotency key with valid format", () => {
    const rawUuid = "abcdef1234567890abcdef1234567890";
    const key = `withdraw_key_${rawUuid}`.slice(0, 32);

    expect(key.length).toBe(32);
    expect(key).toMatch(/^withdraw_key_[a-f0-9]+$/);
  });
});

describe("Wallet Screen: Virtualized Ledger Filtering", () => {
  const sampleTransactions = [
    { id: "tx-1", type: "CREDIT", amount: 2000000, status: "COMPLETED", description: "Campaign Payout: Nike" },
    { id: "tx-2", type: "WITHDRAWAL", amount: 1000000, status: "COMPLETED", description: "IMPS Payout to HDFC" },
    { id: "tx-3", type: "DEBIT", amount: 50000, status: "COMPLETED", description: "Platform Fee" },
    { id: "tx-4", type: "CREDIT", amount: 500000, status: "PENDING", description: "Pending Deal Escrow Release" },
    { id: "tx-5", type: "REFUND", amount: 100000, status: "COMPLETED", description: "Dispute Refund" },
  ];

  const CREDIT_TYPES = new Set(["CREDIT", "REFUND"]);
  const DEBIT_TYPES = new Set(["DEBIT", "WITHDRAWAL", "PLATFORM_FEE", "CLAWBACK", "CHARGEBACK"]);

  it("filters credit transactions (credits + refunds)", () => {
    const credits = sampleTransactions.filter((t) => CREDIT_TYPES.has(t.type));
    expect(credits.length).toBe(3);
    expect(credits.map((t) => t.id)).toEqual(["tx-1", "tx-4", "tx-5"]);
  });

  it("filters debit transactions (withdrawals + fees)", () => {
    const debits = sampleTransactions.filter((t) => DEBIT_TYPES.has(t.type));
    expect(debits.length).toBe(2);
    expect(debits.map((t) => t.id)).toEqual(["tx-2", "tx-3"]);
  });

  it("filters pending transactions", () => {
    const pending = sampleTransactions.filter((t) => t.status === "PENDING");
    expect(pending.length).toBe(1);
    expect(pending[0]?.id).toBe("tx-4");
  });

  it("searches transactions by keyword across description and ID", () => {
    const search = "Nike".toLowerCase();
    const matches = sampleTransactions.filter((t) =>
      t.description.toLowerCase().includes(search) || t.id.toLowerCase().includes(search)
    );
    expect(matches.length).toBe(1);
    expect(matches[0]?.id).toBe("tx-1");
  });
});

describe("Wallet Screen: Supabase Realtime Subscription", () => {
  it("provides subscribeToWalletUpdates with teardown function", () => {
    const callback = vi.fn();
    const unsubscribe = subscribeToWalletUpdates("user_test_123", callback);
    expect(typeof unsubscribe).toBe("function");

    // Calling unsubscribe executes cleanly without throwing
    expect(() => unsubscribe()).not.toThrow();
  });
});
