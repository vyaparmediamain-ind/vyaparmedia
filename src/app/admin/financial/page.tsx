import { auth } from "@/lib/auth";
import { requireActiveAdmin } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import { formatCurrency } from "@/lib/utils-client";
import { AdminAnalyticsService } from "@/services/admin-analytics.service";
import { Button } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata = {
title: "Financial Overview | Admin",
description: "Treasury and platform fees overview",
};

export default async function AdminFinancialPage() {
const session = await auth();

try {
await requireActiveAdmin(session?.user);
} catch {
redirect("/dashboard");
}

// Call service directly on the server to prevent port-binding failures and loopback request overhead
const data = await AdminAnalyticsService.getFinancialOverview();

return (
<div className="admin-page text-primary">
{/* Header */}
<div className="mb-8">
<h1 className="gradient-text text-3xl font-extrabold mb-1">
Financial Overview
</h1>
<p className="text-secondary text-sm">
Real-time treasury metrics, platform fee earnings, and wallet liabilities.
</p>
</div>

{/* Overview Metrics Grid */}
<div
className="grid gap-6 mb-8 grid-auto-240"
>
<div className="card p-6 border-l-primary">
<div className="text-xs font-bold text-muted mb-2 uppercase">
Gross Merchandise Value (GMV)
</div>
<div className="text-2xl font-extrabold">{formatCurrency(data.overview.gmv)}</div>
<div className="text-xs text-secondary mt-1">
Last 30 Days: {formatCurrency(data.overview.gmvLast30Days)}
</div>
</div>

<div className="card p-6 border-l-success">
<div className="text-xs font-bold text-muted mb-2 uppercase">
Net Profit (Revenue - Gateway Fees)
</div>
<div className="text-2xl font-extrabold text-emerald">{formatCurrency(data.overview.netProfit)}</div>
<div className="text-xs text-secondary mt-1">
Gross Revenue: {formatCurrency(data.overview.platformRevenue)}
</div>
</div>

<div className="card p-6 border-l-blue">
<div className="text-xs font-bold text-muted mb-2 uppercase">
Influencer Payouts
</div>
<div className="text-2xl font-extrabold">{formatCurrency(data.overview.influencerPayouts)}</div>
<div className="text-xs text-secondary mt-1">
Total platform disbursements
</div>
</div>

<div className="card p-6 border-l-amber">
<div className="text-xs font-bold text-muted mb-2 uppercase">
Gateway Fees
</div>
<div className="text-2xl font-extrabold">{formatCurrency(data.overview.gatewayFees)}</div>
<div className="text-xs text-secondary mt-1">
Processor transaction costs
</div>
</div>
</div>

<div
className="grid gap-6 mb-8 grid-auto-360"
>
{/* Treasury & Wallet Liabilities */}
<div className="card p-6">
<h3 className="text-lg font-extrabold mb-5"> Treasury & Wallet Liabilities</h3>
<div className="flex flex-col gap-4">
<div className="flex justify-between border-b border-card pb-3">
<span className="text-secondary">Total Outstanding Liability (Wallet Balances)</span>
<span className="font-bold text-rose">{formatCurrency(data.wallets.totalBalance)}</span>
</div>
<div className="flex justify-between border-b border-card pb-3">
<span className="text-secondary">Total Earned by Users</span>
<span className="font-bold">{formatCurrency(data.wallets.totalEarned)}</span>
</div>
<div className="flex justify-between">
<span className="text-secondary">Total Withdrawn by Users</span>
<span className="font-bold">{formatCurrency(data.wallets.totalWithdrawn)}</span>
</div>
</div>
</div>

{/* Escrows & Payouts */}
<div className="card p-6">
<h3 className="text-lg font-extrabold mb-5"> Pending Escrows & Withdrawals</h3>
<div className="flex flex-col gap-4">
<div className="flex justify-between border-b border-card pb-3">
<span className="text-secondary">Pending Escrow Payouts (Active Deals)</span>
<span className="font-bold">
{formatCurrency(data.payments.pendingPayouts)}{" "}
<span className="text-xs font-medium text-muted">
({data.payments.pendingPayoutCount} deals)
</span>
</span>
</div>
<div className="flex justify-between border-b border-card pb-3">
<span className="text-secondary">Pending Bank Withdrawals</span>
<span className="font-bold text-amber">
{formatCurrency(data.withdrawals.pendingAmount)}{" "}
<span className="text-xs font-medium text-muted">
({data.withdrawals.pendingCount} requests)
</span>
</span>
</div>
<div className="flex justify-between">
<span className="text-secondary">Successful Payouts (Completed Withdrawals)</span>
<span className="font-bold">
{formatCurrency(data.withdrawals.completedAmount)}{" "}
<span className="text-xs font-medium text-muted">
({data.withdrawals.completedCount} requests)
</span>
</span>
</div>
</div>
</div>
</div>

<div
className="grid gap-6 grid-auto-360"
>
{/* Deal Operations Stats */}
<div className="card p-6">
<h3 className="text-lg font-extrabold mb-5"> Deal Operations Stats</h3>
<div className="grid gap-4 responsive-two-col">
<div>
<div className="text-xs text-muted">Total Deals Created</div>
<div className="text-xl font-bold mt-1">{data.deals.total}</div>
</div>
<div>
<div className="text-xs text-muted">Completed Deals</div>
<div className="text-xl font-bold mt-1 text-emerald">{data.deals.completed}</div>
</div>
<div>
<div className="text-xs text-muted">Active/Pending Deals</div>
<div className="text-xl font-bold mt-1 text-primary-light">{data.deals.active}</div>
</div>
<div>
<div className="text-xs text-muted">Disputed Deals</div>
<div className="text-xl font-bold mt-1 text-rose">{data.deals.disputed}</div>
</div>
<div>
<div className="text-xs text-muted">Cancelled Deals</div>
<div className="text-xl font-bold mt-1">{data.deals.cancelled}</div>
</div>
<div>
<div className="text-xs text-muted">Deal Completion Rate</div>
<div className="text-xl font-bold mt-1">{data.deals.completionRate}%</div>
</div>
</div>
</div>

{/* Transaction History & Refunds */}
<div className="card p-6">
<h3 className="text-lg font-extrabold mb-5"> Refunds & Gateway Performance</h3>
<div className="flex flex-col gap-4">
<div className="flex justify-between border-b border-card pb-3">
<span className="text-secondary">Total Refunded Amount</span>
<span className="font-bold">
{formatCurrency(data.refunds.totalAmount)}{" "}
<span className="text-xs font-medium text-muted">
({data.refunds.totalCount} refunds)
</span>
</span>
</div>
<div className="flex justify-between border-b border-card pb-3">
<span className="text-secondary">Refunds Issued (Last 30 Days)</span>
<span className="font-bold">
{formatCurrency(data.refunds.last30DaysAmount)}{" "}
<span className="text-xs font-medium text-muted">
({data.refunds.last30DaysCount} refunds)
</span>
</span>
</div>
<div className="flex justify-between">
<span className="text-secondary">Payment/Transaction Success Rate</span>
<span className="font-bold text-emerald">{data.payments.successRate}%</span>
</div>
</div>
</div>
</div>

{/* Export Reports Section */}
<div className="card p-6 mt-6">
<h3 className="text-lg font-extrabold mb-3"> Export Financial Reports</h3>
<p className="text-secondary text-sm mb-5">
Generate and download detailed financial statements in CSV format for compliance, auditing, and tax filing.
</p>
<div className="flex gap-4 flex-wrap">
<Button
href="/api/admin/reports/revenue?format=csv"
variant="primary"
leftIcon={<span aria-hidden="true"></span>}
aria-label="Download revenue report as CSV"
>
Download Revenue Report (CSV)
</Button>
<Button
href="/api/admin/reports/tds?format=csv"
variant="secondary"
leftIcon={<span aria-hidden="true"></span>}
aria-label="Download TDS report as CSV"
>
Download TDS Report (CSV)
</Button>
<Button
href="/api/admin/financial?format=csv"
variant="secondary"
leftIcon={<span aria-hidden="true"></span>}
aria-label="Download General Ledger as CSV"
>
Download General Ledger (CSV)
</Button>
</div>
</div>
</div>
);
}
