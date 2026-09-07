import { NextRequest } from "next/server";
import { apiWrapper, ApiResponse, type AuthenticatedRequest } from "@/lib/api-wrapper";
import prisma from "@/lib/db";
import {
csvResponse,
paiseToRupees,
csvEsc,
csvRow,
csvSep,
csvTitle,
csvPlatformHeader,
parseReportQueryParams,
formatEntityAddress,
} from "@/lib/csv-export";
import { format } from "date-fns";
import { RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";

async function _handler(req: NextRequest) {
const session = (req as AuthenticatedRequest).session;

const { fy, format: fmt, bounds } = parseReportQueryParams(req.url);
if (!bounds) return ApiResponse.error("Invalid FY format. Use YYYY-YY e.g. 2025-26");

// Get influencer profile id
const profile = await prisma.influencerProfile.findUnique({
where: { userId: session.user.id },
select: {
id: true,
displayName: true,
address: true,
city: true,
state: true,
pinCode: true,
},
});
if (!profile) return ApiResponse.error("Profile not found", 404);

const tax = await prisma.indiaTaxCompliance.findUnique({
where: { userId: session.user.id },
select: { panNumber: true },
});

// Deals in this FY
const deals = await prisma.deal.findMany({
    take: 500,
where: {
influencerId: profile.id,
status: "COMPLETED",
completedAt: { gte: bounds.start, lte: bounds.end },
},
select: {
id: true,
amount: true,
platformFee: true,
grossPayout: true,
tdsDeducted: true,
netPayout: true,
completedAt: true,
campaign: {
select: { title: true, targetCategories: true },
},
brand: {
select: { companyName: true },
},
},
orderBy: { completedAt: "asc" },
});

// Summary Totals
const totalGross = deals.reduce((s, d) => s + (d.grossPayout || d.amount), 0);
const totalPlatformFee = deals.reduce((s, d) => s + d.platformFee, 0);
const totalTDS = deals.reduce((s, d) => s + (d.tdsDeducted || 0), 0);
const totalNet = deals.reduce((s, d) => s + (d.netPayout || d.amount - d.platformFee), 0);

// Month-wise breakdown
const monthMap = new Map<string, { gross: number; tds: number; net: number; count: number }>();
for (const deal of deals) {
if (!deal.completedAt) continue;
const month = format(deal.completedAt, "MMM yyyy");
const prev = monthMap.get(month) ?? { gross: 0, tds: 0, net: 0, count: 0 };
monthMap.set(month, {
gross: prev.gross + (deal.grossPayout || deal.amount),
tds: prev.tds + (deal.tdsDeducted || 0),
net: prev.net + (deal.netPayout || deal.amount - deal.platformFee),
count: prev.count + 1,
});
}

if (fmt === "csv") {
const address = formatEntityAddress(profile);

let csv = csvPlatformHeader("INFLUENCER INCOME & TDS STATEMENT");

// Report metadata
csv += csvTitle("REPORT DETAILS");
csv += csvRow("Report Type", "Influencer Income & TDS Ledger");
csv += csvRow("Financial Year", `FY ${fy}`);
csv += csvRow("Generated On", format(new Date(), "dd/MM/yyyy HH:mm") + " IST");
csv += csvRow("Total Deals", deals.length);
csv += csvRow("TDS Section", "Section 194-O (0.1% above Rs. 50L threshold)");
csv += csvSep();

// Influencer details
csv += csvTitle("INFLUENCER DETAILS");
csv += csvRow("Name", profile.displayName || "");
csv += csvRow("Address", address);
csv += csvRow("PAN", tax?.panNumber || "Not Provided");
csv += csvSep();

// Deal-wise table
csv += csvTitle("DEAL-WISE INCOME DETAILS");
csv += "Sr.,Completed Date,Brand,Campaign,Category,Gross Amount (INR),Platform Fee (INR),TDS 194-O (INR),Net Received (INR)\r\n";
deals.forEach((d, i) => {
csv += [
i + 1,
d.completedAt ? format(d.completedAt, "dd/MM/yyyy") : "",
csvEsc(d.brand?.companyName ?? ""),
csvEsc(d.campaign?.title ?? ""),
csvEsc(String(d.campaign?.targetCategories?.[0] ?? "")),
paiseToRupees(d.grossPayout || d.amount),
paiseToRupees(d.platformFee),
paiseToRupees(d.tdsDeducted || 0),
paiseToRupees(d.netPayout || d.amount - d.platformFee),
].join(",") + "\r\n";
});
csv += csvSep();

// Income summary
csv += csvTitle("INCOME SUMMARY");
csv += csvRow("Total Gross Income (INR)", paiseToRupees(totalGross));
csv += csvRow("Total Platform Fee (INR)", paiseToRupees(totalPlatformFee));
csv += csvRow("Total TDS Deducted (INR)", paiseToRupees(totalTDS));
csv += csvRow("Total Net Received (INR)", paiseToRupees(totalNet));
csv += csvSep();

// TDS note
csv += csvTitle("TDS INFORMATION");
csv += csvRow("Applicable Section", "194-O (E-commerce operator payments)");
csv += csvRow("TDS Rate", "0.1% on gross payments above Rs. 50 Lakh");
csv += csvRow("Deducted By", "VYAPARMEDIA TECHNOLOGIES PRIVATE LIMITED");
csv += csvRow("TAN of Deductor", "Contact support@VyaparMedia.in for TAN");
csv += csvSep();

// Footer
csv += csvRow("--- End of Statement ---", "");
csv += csvRow("This is a system-generated document.", "No signature required.");
csv += csvRow("For TDS queries contact", "support@VyaparMedia.in");

const safeName = profile.displayName?.replace(/\s+/g, "_") ?? session.user.id;
return csvResponse(csv, `VyaparMedia-income-report-FY${fy}-${safeName}.csv`);
}

// JSON response
return ApiResponse.success({
fy,
influencer: profile.displayName,
period: { from: bounds.start, to: bounds.end },
summary: {
totalGrossRupees: paiseToRupees(totalGross),
totalPlatformFeeRupees: paiseToRupees(totalPlatformFee),
totalTDSRupees: paiseToRupees(totalTDS),
totalNetRupees: paiseToRupees(totalNet),
dealCount: deals.length,
tdsSection: "194-O (0.1% above 50L threshold)",
},
monthWise: Array.from(monthMap.entries()).map(([month, data]) => ({
month,
...data,
grossRupees: paiseToRupees(data.gross),
netRupees: paiseToRupees(data.net),
tdsRupees: paiseToRupees(data.tds),
})),
deals: deals.map((d) => ({
id: d.id,
brand: d.brand?.companyName,
campaign: d.campaign?.title,
completedAt: d.completedAt,
grossRupees: paiseToRupees(d.grossPayout || d.amount),
platformFeeRupees: paiseToRupees(d.platformFee),
tdsRupees: paiseToRupees(d.tdsDeducted || 0),
netRupees: paiseToRupees(d.netPayout || d.amount - d.platformFee),
})),
}, "Income report generated");
}

export const GET = apiWrapper(_handler, {
requirePermission: "VIEW_OWN_FINANCE",
rateLimit: RATE_LIMIT_CONFIGS.REPORTS,
});
