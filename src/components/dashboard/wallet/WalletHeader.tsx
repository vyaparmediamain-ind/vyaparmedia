"use client";

import { Button } from "@/components/ui";
import { formatCurrency } from "@/lib/utils-client";

export interface WalletData {
  balance: number;
  pendingBalance: number;
  totalEarned: number;
  totalWithdrawn: number;
  totalSpent?: number;
  totalDeposited?: number;
  totalHeld?: number;
}

interface WalletHeaderProps {
  readonly userType: string | null | undefined;
  readonly balance: number;
  readonly isDownloading: Record<string, boolean | undefined>;
  readonly setShowWithdrawModal: (show: boolean) => void;
  readonly setShowAddFundsModal: (show: boolean) => void;
  readonly handleDownloadCSV: () => void;
  readonly handleDownloadIncomeReport: () => void;
  readonly handleDownloadSpendReport: () => void;
}

export function WalletHeader({
  userType,
  balance,
  isDownloading,
  setShowWithdrawModal,
  setShowAddFundsModal,
  handleDownloadCSV,
  handleDownloadIncomeReport,
  handleDownloadSpendReport,
}: WalletHeaderProps) {
  return (
    <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
      <div>
        <h1 className="font-extrabold text-3xl wallet-title mb-1">
          Wallet and Payments
        </h1>
        <p className="text-secondary text-sm">
          {userType === "BRAND"
            ? "Manage campaign spending, top-ups, and payment history."
            : "Manage earnings, transactions, and payouts."}
        </p>
      </div>

      <div className="flex gap-2.5 flex-wrap items-center">
        {userType === "BRAND" && (
          <Button
            variant="primary"
            aria-label="Add funds to wallet"
            onClick={() => setShowAddFundsModal(true)}
            className="flex items-center gap-1.5 font-semibold"
          >
            <span>+</span> Add Funds
          </Button>
        )}
        {userType === "INFLUENCER" && (
          <Button
            variant="primary"
            aria-label={balance < 50000 ? "Withdraw (minimum balance not met)" : "Withdraw funds"}
            onClick={() => setShowWithdrawModal(true)}
            disabled={balance < 50000}
            className="flex items-center gap-1.5 font-semibold"
          >
            <span>💸</span> Withdraw
          </Button>
        )}
        <Button
          variant="secondary"
          aria-label={isDownloading["txn"] ? "Downloading transactions" : "Download transactions as CSV"}
          onClick={handleDownloadCSV}
          disabled={!!isDownloading["txn"]}
          data-loading={isDownloading["txn"] ? "true" : "false"}
          className="text-xs"
        >
          {isDownloading["txn"] ? "⏳ Downloading..." : "📥 Download CSV"}
        </Button>
        {userType === "INFLUENCER" && (
          <Button
            variant="secondary"
            aria-label={isDownloading["income"] ? "Downloading income report" : "Download income report for ITR"}
            onClick={handleDownloadIncomeReport}
            disabled={!!isDownloading["income"]}
            data-loading={isDownloading["income"] ? "true" : "false"}
            className="text-xs"
          >
            {isDownloading["income"] ? "⏳ Downloading..." : "📄 Income Report (ITR)"}
          </Button>
        )}
        {userType === "BRAND" && (
          <Button
            variant="secondary"
            aria-label={isDownloading["spend"] ? "Downloading spend report" : "Download spend report for GST"}
            onClick={handleDownloadSpendReport}
            disabled={!!isDownloading["spend"]}
            data-loading={isDownloading["spend"] ? "true" : "false"}
            className="text-xs"
          >
            {isDownloading["spend"] ? "⏳ Downloading..." : "📊 Spend Report (GST)"}
          </Button>
        )}
      </div>
    </div>
  );
}

interface WalletSummaryCardsProps {
  readonly userType: string | null | undefined;
  readonly walletData: WalletData;
}

export function WalletSummaryCards({ userType, walletData }: WalletSummaryCardsProps) {
  return (
    <div className="grid-4 mb-8 gap-4">
      <div className="card wallet-card-primary p-5 flex flex-col justify-between">
        <div className="flex items-center justify-between text-sm mb-2 text-primary-light font-medium">
          <span>Available Balance</span>
          <span>💳</span>
        </div>
        <div className="font-extrabold text-3xl text-white tracking-tight">
          {formatCurrency(walletData.balance)}
        </div>
      </div>

      <div className="card p-5 flex flex-col justify-between">
        <div className="flex items-center justify-between text-sm text-secondary mb-2">
          <span>{userType === "BRAND" ? "Active Holds" : "Pending"}</span>
          <span>⏳</span>
        </div>
        <div className="font-extrabold text-3xl text-amber tracking-tight">
          {formatCurrency(userType === "BRAND" ? walletData.totalHeld || 0 : walletData.pendingBalance)}
        </div>
      </div>

      <div className="card p-5 flex flex-col justify-between">
        <div className="flex items-center justify-between text-sm text-secondary mb-2">
          <span>{userType === "BRAND" ? "Total Spent" : "Total Earned"}</span>
          <span>📈</span>
        </div>
        <div className="font-extrabold text-3xl text-emerald tracking-tight">
          {formatCurrency(userType === "BRAND" ? walletData.totalSpent || 0 : walletData.totalEarned)}
        </div>
      </div>

      <div className="card p-5 flex flex-col justify-between">
        <div className="flex items-center justify-between text-sm text-secondary mb-2">
          <span>{userType === "BRAND" ? "Total Added" : "Total Withdrawn"}</span>
          <span>🏦</span>
        </div>
        <div className="font-extrabold text-3xl text-white tracking-tight">
          {formatCurrency(userType === "BRAND" ? walletData.totalDeposited || 0 : walletData.totalWithdrawn)}
        </div>
      </div>
    </div>
  );
}
