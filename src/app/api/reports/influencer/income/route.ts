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
import {
  TDS_194O_RATE_PERCENT_STRING,
  TDS_206AA_PENAL_RATE_PERCENT_STRING,
  TDS_194O_THRESHOLD_RUPEES,
} from "@/constants";
import { PLATFORM_CONFIG } from "@/lib/platform-config";

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
select: { panLast4: true },
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
const totalNet = deals.reduce((s, d) => s + (d.netPayout ?? Math.max(0, (d.grossPayout || d.amount) - (d.tdsDeducted || 0))), 0);

// Month-wise breakdown
const monthMap = new Map<string, { gross: number; tds: number; net: number; count: number }>();
for (const deal of deals) {
if (!deal.completedAt) continue;
const month = format(deal.completedAt, "MMM yyyy");
const prev = monthMap.get(month) ?? { gross: 0, tds: 0, net: 0, count: 0 };
monthMap.set(month, {
gross: prev.gross + (deal.grossPayout || deal.amount),
tds: prev.tds + (deal.tdsDeducted || 0),
net: prev.net + (deal.netPayout ?? Math.max(0, (deal.grossPayout || deal.amount) - (deal.tdsDeducted || 0))),
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
csv += csvRow("TDS Section", `Section 194-O (${TDS_194O_RATE_PERCENT_STRING} above ₹${Math.round(TDS_194O_THRESHOLD_RUPEES / 100000)} Lakh statutory threshold)`);
csv += csvSep();

// Influencer details
csv += csvTitle("INFLUENCER DETAILS");
csv += csvRow("Name", profile.displayName || "");
csv += csvRow("Address", address);
csv += csvRow("PAN", tax?.panLast4 ? `XXXXX${tax.panLast4}` : "Not Provided");
csv += csvSep();

// Deal-wise table
csv += csvTitle("DEAL-WISE INCOME DETAILS");
csv += "Sr.,Completed Date,Brand,Campaign,Category,Gross Amount (INR),Brand Platform Fee (INR),TDS 194-O (INR),Net Received (INR)\r\n";
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
paiseToRupees(d.netPayout ?? Math.max(0, (d.grossPayout || d.amount) - (d.tdsDeducted || 0))),
].join(",") + "\r\n";
});
csv += csvSep();

// Quarterly TDS schedule (Form 16A / Cleartax Benchmark)
const quarters = {
  Q1: { label: "Q1 (Apr - Jun)", gross: 0, tds: 0, net: 0, count: 0 },
  Q2: { label: "Q2 (Jul - Sep)", gross: 0, tds: 0, net: 0, count: 0 },
  Q3: { label: "Q3 (Oct - Dec)", gross: 0, tds: 0, net: 0, count: 0 },
  Q4: { label: "Q4 (Jan - Mar)", gross: 0, tds: 0, net: 0, count: 0 },
};

for (const deal of deals) {
  if (!deal.completedAt) continue;
  const m = deal.completedAt.getMonth();
  const q: keyof typeof quarters =
    m >= 3 && m <= 5 ? "Q1" : m >= 6 && m <= 8 ? "Q2" : m >= 9 && m <= 11 ? "Q3" : "Q4";

  quarters[q].gross += deal.grossPayout || deal.amount;
  quarters[q].tds += deal.tdsDeducted || 0;
  quarters[q].net += deal.netPayout ?? Math.max(0, (deal.grossPayout || deal.amount) - (deal.tdsDeducted || 0));
  quarters[q].count += 1;
}

// Income summary
csv += csvTitle("ANNUAL INCOME SUMMARY");
csv += csvRow("Total Gross Earnings (INR)", paiseToRupees(totalGross));
csv += csvRow("Platform Fee Deducted from Creator (INR)", "0.00 (Zero Fee for Creators)");
csv += csvRow("Total Brand Platform Fee Paid (INR)", paiseToRupees(totalPlatformFee));
csv += csvRow("Total TDS Deducted (INR)", paiseToRupees(totalTDS));
csv += csvRow("Total Net Bank Disbursements (INR)", paiseToRupees(totalNet));
csv += csvSep();

// Quarterly TDS Schedule (Cleartax & Form 16A Benchmark)
csv += csvTitle("QUARTERLY TDS SCHEDULE (FORM 16A / 26AS RECONCILIATION)");
csv += "Quarter Period,Deals Completed,Gross Paid (INR),TDS Deducted (INR),Net Disbursed (INR)\r\n";
Object.values(quarters).forEach((q) => {
  csv += [
    q.label,
    q.count,
    paiseToRupees(q.gross),
    paiseToRupees(q.tds),
    paiseToRupees(q.net),
  ].join(",") + "\r\n";
});
csv += csvSep();

// TDS Statutory Note
csv += csvTitle("STATUTORY TAX DECLARATION");
csv += csvRow("Applicable Section", "Section 194-O / 194-J of the Income Tax Act 1961");
csv += csvRow("Deduction Rate", `${TDS_194O_RATE_PERCENT_STRING} on gross payments exceeding statutory limits (or ${TDS_206AA_PENAL_RATE_PERCENT_STRING} if PAN unverified)`);
csv += csvRow("Deductor Entity", PLATFORM_CONFIG.legalName.toUpperCase());
csv += csvRow("Deductor CIN", PLATFORM_CONFIG.cin);
csv += csvRow("Deductor GSTIN", PLATFORM_CONFIG.gstin);
csv += csvRow("Form 16A Availability", "Quarterly TDS certificates available post quarterly TRACES filing");
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
creatorPlatformFeeRupees: "0.00",
brandPlatformFeeRupees: paiseToRupees(totalPlatformFee),
totalTDSRupees: paiseToRupees(totalTDS),
totalNetRupees: paiseToRupees(totalNet),
dealCount: deals.length,
tdsSection: `194-O (${TDS_194O_RATE_PERCENT_STRING} above ₹${Math.round(TDS_194O_THRESHOLD_RUPEES / 100000)} Lakh threshold)`,
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
netRupees: paiseToRupees(d.netPayout ?? Math.max(0, (d.grossPayout || d.amount) - (d.tdsDeducted || 0))),
})),
}, "Income report generated");
}

export const GET = apiWrapper(_handler, {
requirePermission: "VIEW_OWN_FINANCE",
rateLimit: RATE_LIMIT_CONFIGS.REPORTS,
});
