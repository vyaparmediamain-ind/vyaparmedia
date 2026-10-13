import { apiWrapper, ApiResponse } from "@/lib/api-wrapper";
import { NextRequest } from "next/server";
import { AdminAnalyticsService } from "@/services/admin-analytics.service";
import { toCsv, csvResponse, paiseToRupees } from "@/lib/csv-export";
import { RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { getPlatformHeader, getPlatformFooter } from "@/lib/platform-config";

async function _handler_GET(req: NextRequest) {
const fmt = req.nextUrl.searchParams.get("format") === "csv" ? "csv" : "json";

const financials = await AdminAnalyticsService.getFinancialOverview();

if (fmt === "csv") {
// Generate comprehensive transaction ledger CSV for CA audit trail
const rows = [
{
"Metric": "GMV",
"Value ()": paiseToRupees(financials.overview.gmv),
"Description": "Total Gross Merchandise Value",
},
{
"Metric": "Platform Revenue",
"Value ()": paiseToRupees(financials.overview.platformRevenue),
"Description": "Total platform fees collected",
},
{
"Metric": "Gateway Fees",
"Value ()": paiseToRupees(financials.overview.gatewayFees),
"Description": "Payment gateway charges",
},
{
"Metric": "Net Profit",
"Value ()": paiseToRupees(financials.overview.netProfit),
"Description": "Revenue minus gateway fees",
},
{
"Metric": "Influencer Payouts",
"Value ()": paiseToRupees(financials.overview.influencerPayouts),
"Description": "Total paid to influencers",
},
{
"Metric": "Pending Payouts",
"Value ()": paiseToRupees(financials.payments.pendingPayouts),
"Description": "Escrowed funds awaiting release",
},
{
"Metric": "Total Wallet Balance",
"Value ()": paiseToRupees(financials.wallets.totalBalance),
"Description": "Sum of all user wallet balances",
},
{
"Metric": "Total Withdrawn",
"Value ()": paiseToRupees(financials.wallets.totalWithdrawn),
"Description": "Total amount withdrawn by users",
},
{
"Metric": "Completed Withdrawals",
"Value ()": paiseToRupees(financials.withdrawals.completedAmount),
"Description": "Total successful withdrawals",
},
{
"Metric": "Pending Withdrawals",
"Value ()": paiseToRupees(financials.withdrawals.pendingAmount),
"Description": "Withdrawals awaiting processing",
},
{
"Metric": "Total Refunds",
"Value ()": paiseToRupees(financials.refunds.totalAmount),
"Description": "Total refund amount processed",
},
{
"Metric": "Late Fees Collected",
"Value ()": paiseToRupees(financials.fees.lateFees),
"Description": "Fees from late approvals",
},
{
"Metric": "Clawbacks",
"Value ()": paiseToRupees(financials.fees.clawbacks),
"Description": "Amount clawed back from influencers",
},
];

// Add deal statistics
rows.push(
{ "Metric": "", "Value ()": "", "Description": "" },
{ "Metric": "DEAL STATISTICS", "Value ()": "", "Description": "" },
{ "Metric": "Total Deals", "Value ()": String(financials.deals.total), "Description": "All deals created" },
{ "Metric": "Completed Deals", "Value ()": String(financials.deals.completed), "Description": "Successfully completed" },
{ "Metric": "Active Deals", "Value ()": String(financials.deals.active), "Description": "Currently in progress" },
{ "Metric": "Disputed Deals", "Value ()": String(financials.deals.disputed), "Description": "Under dispute resolution" },
{ "Metric": "Cancelled Deals", "Value ()": String(financials.deals.cancelled), "Description": "Cancelled deals" },
{ "Metric": "Completion Rate", "Value ()": `${financials.deals.completionRate}%`, "Description": "Percentage of completed deals" }
);

// Add monthly revenue trend
const trendRows = financials.monthlyRevenue.map((m: { month: string; revenue: number; gmv: number; deals: number }) => ({
"Metric": m.month,
"Value ()": paiseToRupees(m.revenue),
"Description": `GMV: ${paiseToRupees(m.gmv)}, Deals: ${m.deals}`,
}));

rows.push(
{ "Metric": "", "Value ()": "", "Description": "" },
{ "Metric": "MONTHLY REVENUE TREND", "Value ()": "", "Description": "" },
...trendRows
);

// Add platform header and footer
const platformHeader = getPlatformHeader().map((line) => ({ "Platform Info": line }));
const platformFooter = getPlatformFooter().map((line) => ({ "Platform Info": line }));

const finalRows = [
...platformHeader,
...rows,
...platformFooter,
];

const filename = `VyaparMedia-admin-financial-${Date.now()}.csv`;
return csvResponse(toCsv(finalRows), filename);
}

return ApiResponse.success(financials, "Report generated");
}

// Wrapped handlers via apiWrapper - auth and admin handled by options
export const GET = apiWrapper(_handler_GET, {
requireAuth: true,
requireAdmin: true,
rateLimit: RATE_LIMIT_CONFIGS.REPORTS,
});
