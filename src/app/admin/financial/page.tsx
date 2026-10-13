import { auth } from "@/lib/auth";
import { requireActiveAdmin } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import { formatCurrency } from "@/lib/utils-client";
import { AdminAnalyticsService } from "@/services/admin-analytics.service";
import { Button, PageContainer, PageHeader } from "@/components/ui";
import {
  Wallet,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  Download,
  FileSpreadsheet,
  BookOpen,
} from "lucide-react";

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
    <PageContainer maxWidth="6xl" className="space-y-6 py-2 sm:py-4">
      {/* Page header */}
      <PageHeader
        icon={
          <div className="w-10 h-10 rounded-xl bg-escrow/10 border border-escrow-border flex items-center justify-center">
            <Wallet className="w-5 h-5 text-escrow" />
          </div>
        }
        title="Financial Overview"
        subtitle="Real-time treasury metrics, platform fee earnings, and wallet liabilities."
      />

      {/* Top KPI grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Gross Merchandise Value",
            value: formatCurrency(data.overview.gmv),
            sub: `Last 30d: ${formatCurrency(data.overview.gmvLast30Days)}`,
            icon: <TrendingUp className="w-5 h-5 text-primary" />,
            bg: "bg-primary/10 border-primary/20",
          },
          {
            label: "Net Profit",
            value: formatCurrency(data.overview.netProfit),
            sub: `Gross Revenue: ${formatCurrency(data.overview.platformRevenue)}`,
            icon: <ArrowUpRight className="w-5 h-5 text-verified" />,
            bg: "bg-verified/10 border-verified-border",
            valueClass: "text-verified",
          },
          {
            label: "Influencer Payouts",
            value: formatCurrency(data.overview.influencerPayouts),
            sub: "Total platform disbursements",
            icon: <ArrowDownRight className="w-5 h-5 text-escrow" />,
            bg: "bg-escrow/10 border-escrow-border",
          },
          {
            label: "Gateway Fees",
            value: formatCurrency(data.overview.gatewayFees),
            sub: "Processor transaction costs",
            icon: <AlertCircle className="w-5 h-5 text-pending" />,
            bg: "bg-pending/10 border-pending-border",
          },
        ].map((kpi, i) => (
          <div
            key={i}
            className="flex items-center gap-4 p-5 rounded-xl bg-card border border-border shadow-sm"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${kpi.bg}`}>
              {kpi.icon}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-0.5">
                {kpi.label}
              </div>
              <div className={`text-xl font-extrabold tabular-nums truncate ${kpi.valueClass ?? "text-foreground"}`}>
                {kpi.value}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{kpi.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Secondary grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Treasury & Wallet Liabilities */}
        <div className="p-5 rounded-2xl bg-card border border-border shadow-sm">
          <h2 className="text-base font-extrabold text-foreground mb-4">
            Treasury &amp; Wallet Liabilities
          </h2>
          <div className="space-y-3">
            {[
              {
                label: "Total Outstanding Liability (Wallet Balances)",
                value: formatCurrency(data.wallets.totalBalance),
                valueClass: "text-disputed font-bold",
              },
              {
                label: "Total Earned by Users",
                value: formatCurrency(data.wallets.totalEarned),
                valueClass: "font-bold text-foreground",
              },
              {
                label: "Total Withdrawn by Users",
                value: formatCurrency(data.wallets.totalWithdrawn),
                valueClass: "font-bold text-foreground",
              },
            ].map((row, i) => (
              <div
                key={i}
                className="flex justify-between items-center py-3 border-b border-border last:border-0"
              >
                <span className="text-sm text-muted-foreground">{row.label}</span>
                <span className={`text-sm tabular-nums ${row.valueClass}`}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pending Escrows & Withdrawals */}
        <div className="p-5 rounded-2xl bg-card border border-border shadow-sm">
          <h2 className="text-base font-extrabold text-foreground mb-4">
            Pending Escrows &amp; Withdrawals
          </h2>
          <div className="space-y-3">
            {[
              {
                label: "Pending Escrow Payouts (Active Deals)",
                value: `${formatCurrency(data.payments.pendingPayouts)} (${data.payments.pendingPayoutCount} deals)`,
                valueClass: "font-bold text-foreground",
              },
              {
                label: "Pending Bank Withdrawals",
                value: `${formatCurrency(data.withdrawals.pendingAmount)} (${data.withdrawals.pendingCount} requests)`,
                valueClass: "text-pending font-bold",
              },
              {
                label: "Successful Payouts (Completed)",
                value: `${formatCurrency(data.withdrawals.completedAmount)} (${data.withdrawals.completedCount} requests)`,
                valueClass: "font-bold text-foreground",
              },
            ].map((row, i) => (
              <div
                key={i}
                className="flex justify-between items-center py-3 border-b border-border last:border-0"
              >
                <span className="text-sm text-muted-foreground">{row.label}</span>
                <span className={`text-sm tabular-nums text-right ${row.valueClass}`}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Deal Operations Stats */}
        <div className="p-5 rounded-2xl bg-card border border-border shadow-sm">
          <h2 className="text-base font-extrabold text-foreground mb-4">
            Deal Operations Stats
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { label: "Total Created",     value: data.deals.total,          cls: "text-foreground" },
              { label: "Completed",         value: data.deals.completed,      cls: "text-verified" },
              { label: "Active / Pending",  value: data.deals.active,         cls: "text-escrow" },
              { label: "Disputed",          value: data.deals.disputed,       cls: "text-disputed" },
              { label: "Cancelled",         value: data.deals.cancelled,      cls: "text-muted-foreground" },
              { label: "Completion Rate",   value: `${data.deals.completionRate}%`, cls: "text-foreground" },
            ].map((stat) => (
              <div key={stat.label} className="p-3 rounded-xl bg-muted/30 border border-border">
                <div className="text-xs text-muted-foreground font-medium mb-1">{stat.label}</div>
                <div className={`text-xl font-extrabold tabular-nums ${stat.cls}`}>{stat.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Refunds & Gateway Performance */}
        <div className="p-5 rounded-2xl bg-card border border-border shadow-sm">
          <h2 className="text-base font-extrabold text-foreground mb-4">
            Refunds &amp; Gateway Performance
          </h2>
          <div className="space-y-3">
            {[
              {
                label: `Total Refunded Amount (${data.refunds.totalCount} refunds)`,
                value: formatCurrency(data.refunds.totalAmount),
                valueClass: "font-bold text-foreground",
              },
              {
                label: `Refunds Issued — Last 30 Days (${data.refunds.last30DaysCount})`,
                value: formatCurrency(data.refunds.last30DaysAmount),
                valueClass: "font-bold text-foreground",
              },
              {
                label: "Payment / Transaction Success Rate",
                value: `${data.payments.successRate}%`,
                valueClass: "text-verified font-bold",
              },
            ].map((row, i) => (
              <div
                key={i}
                className="flex justify-between items-center py-3 border-b border-border last:border-0"
              >
                <span className="text-sm text-muted-foreground">{row.label}</span>
                <span className={`text-sm tabular-nums ${row.valueClass}`}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Export Reports */}
      <div className="p-5 rounded-2xl bg-card border border-border shadow-sm">
        <h2 className="text-base font-extrabold text-foreground mb-1">
          Export Financial Reports
        </h2>
        <p className="text-sm text-muted-foreground mb-5">
          Generate and download detailed financial statements in CSV format for compliance, auditing, and tax filing.
        </p>
        <div className="flex gap-3 flex-wrap">
          <Button
            href="/api/admin/reports/revenue?format=csv"
            variant="primary"
            size="sm"
            className="gap-1.5"
            aria-label="Download revenue report as CSV"
          >
            <Download className="w-3.5 h-3.5" />
            Revenue Report (CSV)
          </Button>
          <Button
            href="/api/admin/reports/tds?format=csv"
            variant="secondary"
            size="sm"
            className="gap-1.5"
            aria-label="Download TDS report as CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            TDS Report (CSV)
          </Button>
          <Button
            href="/api/admin/financial?format=csv"
            variant="secondary"
            size="sm"
            className="gap-1.5"
            aria-label="Download General Ledger as CSV"
          >
            <BookOpen className="w-3.5 h-3.5" />
            General Ledger (CSV)
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
