import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithProviders } from "../utils/render";
import { createFetchMock } from "../utils/fetch-mock";

import { FullScreenWithdrawFlow } from "@/components/dashboard/wallet/FullScreenWithdrawFlow";
import { StatementExportModal } from "@/components/dashboard/wallet/StatementExportModal";
import BankAccountManager from "@/components/dashboard/wallet/BankAccountManager";
import { VirtualizedTransactionList } from "@/components/dashboard/wallet/VirtualizedTransactionList";
import type { WalletTransactionItem } from "@/lib/schemas";

describe("Component Tests: Wallet (Priority 5)", () => {
  let fetchMock: ReturnType<typeof createFetchMock>;

  const mockTransactions: any[] = [
    {
      id: "txn_001",
      walletId: "wal_123",
      amount: 2500000, // formatCurrency(2500000) = ₹25,000
      amountPaise: 2500000,
      type: "CREDIT",
      status: "COMPLETED",
      description: "Escrow release for Pro Isolate Campaign",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      referenceType: "CAMPAIGN",
      referenceId: "camp_789",
    },
    {
      id: "txn_002",
      walletId: "wal_123",
      amount: 500000, // formatCurrency(500000) = ₹5,000
      amountPaise: 500000,
      type: "WITHDRAWAL",
      status: "COMPLETED",
      description: "IMPS Payout to HDFC Bank ****1234",
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
      referenceType: "PAYOUT",
      referenceId: "payout_456",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = createFetchMock();
    fetchMock.install();

    // Default mock responses
    fetchMock.mockJson("/api/wallet/bank-accounts", {
      success: true,
      data: [
        {
          id: "bank_123",
          accountName: "Vikram Malhotra",
          accountNumber: "••••  ••••  1234",
          ifscCode: "HDFC0001234",
          bankName: "HDFC Bank",
          isDefault: true,
          isVerified: true,
        },
      ],
    });

    fetchMock.mockJson("/api/compliance/india-tax", {
      success: true,
      data: {
        panStatus: "VERIFIED",
        panVerified: true,
        gstStatus: "VERIFIED",
      },
    });

    fetchMock.mockJson("/api/wallet/export", {
      success: true,
      data: {
        downloadUrl: "/api/wallet/download?token=test_token",
      },
    });

    fetchMock.mockJson("/api/wallet/withdraw", {
      success: true,
      data: {
        payoutId: "payout_999",
        status: "PROCESSING",
        amountPaise: 500000,
      },
    });
  });

  describe("FullScreenWithdrawFlow", () => {
    it("renders withdrawal modal with minimum ₹500 rule enforced", async () => {
      renderWithProviders(
        <FullScreenWithdrawFlow
          isOpen={true}
          onClose={vi.fn()}
          availableBalanceInPaise={10000000} // ₹1,00,000
          userEmail="creator@example.com"
          userName="Vikram Malhotra"
        />
      );

      // Check withdrawal header and action
      expect(screen.getByText(/Withdraw to Bank/i)).toBeInTheDocument();
      expect(screen.getByText(/Enter Withdrawal Amount/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Select Bank/i })).toBeInTheDocument();
    });

    it("passes axe accessibility checks on FullScreenWithdrawFlow", async () => {
      const { container } = renderWithProviders(
        <FullScreenWithdrawFlow
          isOpen={true}
          onClose={vi.fn()}
          availableBalanceInPaise={10000000}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("StatementExportModal", () => {
    it("renders statement export options with date preset filters", async () => {
      renderWithProviders(
        <StatementExportModal
          isOpen={true}
          onClose={vi.fn()}
          userName="Vikram Malhotra"
          userEmail="creator@example.com"
          currentBalance={100000}
        />
      );

      expect(screen.getByText(/Download Financial Statement/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /This Month/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Download CSV/i })).toBeInTheDocument();
    });
  });

  describe("BankAccountManager", () => {
    it("renders saved verified bank accounts and handles add account action", async () => {
      renderWithProviders(<BankAccountManager />);

      await waitFor(() => {
        expect(screen.getByText("HDFC Bank")).toBeInTheDocument();
      });

      expect(screen.getByText("Configured Payouts")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Add new bank account or UPI ID/i })).toBeInTheDocument();
    });
  });

  describe("VirtualizedTransactionList", () => {
    it("renders transaction history with correct Indian currency format and credit/debit indicators", () => {
      renderWithProviders(
        <VirtualizedTransactionList
          transactions={mockTransactions}
          isLoading={false}
          onRefresh={vi.fn()}
        />
      );

      // 2,500,000 paise = ₹25,000
      expect(screen.getByText(/₹25,000/i)).toBeInTheDocument();
      // 500,000 paise = ₹5,000
      expect(screen.getByText(/₹5,000/i)).toBeInTheDocument();
      expect(screen.getByText(/Escrow release for Pro Isolate Campaign/i)).toBeInTheDocument();
    });
  });
});
