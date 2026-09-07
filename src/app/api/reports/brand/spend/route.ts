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

// Get brand profile
const profile = await prisma.brandProfile.findUnique({
where: { userId: session.user.id },
select: {
id: true,
companyName: true,
address: true,
city: true,
state: true,
pinCode: true,
gstNumber: true,
panNumber: true,
},
});
if (!profile) return ApiResponse.error("Profile not found", 404);

// Deals in this FY
const deals = await prisma.deal.findMany({
    take: 500,
where: {
brandId: profile.id,
status: "COMPLETED",
completedAt: { gte: bounds.start, lte: bounds.end },
},
select: {
id: true,
amount: true,
totalAmount: true,
platformFee: true,
completedAt: true,
campaign: {
select: {
id: true,
title: true,
targetCategories: true,
},
},
influencer: {
select: {
displayName: true,
instagramHandle: true,
instagramFollowers: true,
},
},
},
orderBy: { completedAt: "asc" },
});

// Summary Totals
const totalPaid = deals.reduce((s, d) => s + d.amount, 0);
const totalPlatformFee = deals.reduce((s, d) => s + d.platformFee, 0);
const totalGST = Math.round(totalPlatformFee * 0.18); // 18% GST on platform fee
const totalInvoice = totalPlatformFee + totalGST;

if (fmt === "csv") {
const address = formatEntityAddress(profile);

let csv = csvPlatformHeader("BRAND SPEND & GST REPORT");

// Report metadata
csv += csvTitle("REPORT DETAILS");
csv += csvRow("Report Type", "Brand Spend & GST Ledger");
csv += csvRow("Financial Year", `FY ${fy}`);
csv += csvRow("Generated On", format(new Date(), "dd/MM/yyyy HH:mm") + " IST");
csv += csvRow("Total Deals", deals.length);
csv += csvSep();

// Client details
csv += csvTitle("CLIENT DETAILS");
csv += csvRow("Company Name", profile.companyName || "");
csv += csvRow("Address", address);
csv += csvRow("GSTIN", profile.gstNumber || "Not Provided");
csv += csvRow("PAN", profile.panNumber || "Not Provided");
csv += csvSep();

// Deal-wise table
csv += csvTitle("DEAL-WISE EXPENSE DETAILS");
csv += "Sr.,Date,Campaign,Influencer,Instagram Handle,Followers,Paid to Influencer (INR),Platform Fee (INR),GST @ 18% on Fee (INR),Invoice Total (INR)\r\n";
deals.forEach((d, i) => {
const gstOnFee = Math.round(d.platformFee * 0.18);
const invoiceTotal = d.platformFee + gstOnFee;
csv += [
i + 1,
d.completedAt ? format(d.completedAt, "dd/MM/yyyy") : "",
csvEsc(d.campaign?.title ?? ""),
csvEsc(d.influencer?.displayName ?? ""),
csvEsc(d.influencer?.instagramHandle ?? ""),
d.influencer?.instagramFollowers ?? 0,
paiseToRupees(d.amount),
paiseToRupees(d.platformFee),
paiseToRupees(gstOnFee),
paiseToRupees(invoiceTotal),
].join(",") + "\r\n";
});
csv += csvSep();

// GST Summary
csv += csvTitle("GST SUMMARY");
csv += csvRow("Total Amount Paid to Influencers (INR)", paiseToRupees(totalPaid));
csv += csvRow("Total Platform Fee (INR)", paiseToRupees(totalPlatformFee));
csv += csvRow("Total GST @ 18% on Platform Fee (INR)", paiseToRupees(totalGST));
csv += csvRow("Total Invoice Amount (INR)", paiseToRupees(totalInvoice));
csv += csvRow("GST Component (CGST @ 9%)", paiseToRupees(Math.round(totalGST / 2)));
csv += csvRow("GST Component (SGST @ 9%)", paiseToRupees(Math.round(totalGST / 2)));
csv += csvSep();

// Footer
csv += csvRow("--- End of Report ---", "");
csv += csvRow("This is a system-generated document.", "No signature required.");
csv += csvRow("For GST queries contact", "support@VyaparMedia.in");

const safeName = profile.companyName?.replace(/\s+/g, "_") ?? session.user.id;
return csvResponse(csv, `VyaparMedia-spend-report-FY${fy}-${safeName}.csv`);
}

// JSON response
return ApiResponse.success({
fy,
period: { from: bounds.start, to: bounds.end },
summary: {
totalPaidRupees: paiseToRupees(totalPaid),
totalFeeRupees: paiseToRupees(totalPlatformFee),
totalGstRupees: paiseToRupees(totalGST),
totalInvoiceRupees: paiseToRupees(totalInvoice),
dealCount: deals.length,
},
deals: deals.map((d) => {
const gstOnFee = Math.round(d.platformFee * 0.18);
const invoiceTotal = d.platformFee + gstOnFee;
return {
id: d.id,
completedAt: d.completedAt,
campaign: d.campaign?.title,
influencer: d.influencer?.displayName,
paidRupees: paiseToRupees(d.amount),
platformFeeRupees: paiseToRupees(d.platformFee),
gstrRupees: paiseToRupees(gstOnFee),
invoiceTotalRupees: paiseToRupees(invoiceTotal),
};
}),
}, "Spend report generated");
}

export const GET = apiWrapper(_handler, {
requirePermission: "VIEW_OWN_FINANCE",
rateLimit: RATE_LIMIT_CONFIGS.REPORTS,
});
