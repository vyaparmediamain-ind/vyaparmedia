import { NextRequest } from "next/server";
import { apiWrapper, ApiResponse } from "@/lib/api-wrapper";
import prisma from "@/lib/db";
import { toCsv, csvResponse, paiseToRupees, parseReportQueryParams } from "@/lib/csv-export";
import { format } from "date-fns";
import { RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { getPlatformHeader, getPlatformFooter } from "@/lib/platform-config";

async function _handler(req: NextRequest) {
const { fy, format: fmt, bounds } = parseReportQueryParams(req.url);
if (!bounds) return ApiResponse.error("Invalid FY format. Use YYYY-YY e.g. 2025-26");

// Query all TDS transactions in FY
const tdsTransactions = await prisma.transaction.findMany({
take: 1000,
where: {
status: "COMPLETED",
createdAt: { gte: bounds.start, lte: bounds.end },
metadata: {
path: ["source"],
equals: "tds_withholding",
},
},
include: {
deal: {
include: {
influencer: {
include: {
user: {
include: {
          taxCompliance: {
            select: { panLast4: true, tdsSection: true }
          }
},
},
},
},
},
},
},
orderBy: { createdAt: "asc" },
});

// Summary totals
const totalGross = tdsTransactions.reduce((s, t) => s + ((t.metadata as Record<string, number | undefined>)?.grossPayout ?? 0), 0);
const totalTDS = tdsTransactions.reduce((s, t) => s + t.amount, 0);
const totalNet = tdsTransactions.reduce((s, t) => s + ((t.metadata as Record<string, number | undefined>)?.netPayout ?? 0), 0);

  // Map rows with dynamic section and rates
  const getTransactionTdsDetails = (t: typeof tdsTransactions[number]) => {
    const meta = t.metadata as Record<string, unknown> | null;
    const userTdsSection = t.deal?.influencer?.user?.taxCompliance?.tdsSection;
    const is194J = userTdsSection?.startsWith("194J") ?? false;
    const appliedSection = (meta?.tdsSection as string | undefined) ?? (is194J ? "194J" : "194-O");

    const gross = typeof meta?.grossPayout === "number" ? meta.grossPayout : 0;
    let rateStr = "0.1%";
    if (gross > 0) {
      const calculatedRate = (t.amount / gross) * 100;
      if (calculatedRate > 4) {
        rateStr = calculatedRate > 8 ? "10%" : "5%";
      }
    } else {
      rateStr = is194J ? "10%" : "0.1%";
    }

    return { section: appliedSection, rate: rateStr };
  };

  const uniqueSections = Array.from(new Set(tdsTransactions.map(t => getTransactionTdsDetails(t).section)));
  const summaryTdsSection = uniqueSections.length > 0 ? uniqueSections.join(" / ") : "194-O";

  if (fmt === "csv") {
    // CSV output for CA/tax consultant
    const rows = tdsTransactions.map((t) => {
      const details = getTransactionTdsDetails(t);
      return {
        "Deal ID": t.dealId,
        "Influencer": t.deal?.influencer?.displayName ?? "",
        "PAN (last 4)": t.deal?.influencer?.user?.taxCompliance?.panLast4 ?? "",
        "Gross ()": paiseToRupees((t.metadata as Record<string, number | undefined>)?.grossPayout ?? 0),
        "TDS Rate": details.rate,
        "TDS ()": paiseToRupees(t.amount),
        "Net ()": paiseToRupees((t.metadata as Record<string, number | undefined>)?.netPayout ?? 0),
        "Date": format(new Date(t.createdAt), "dd/MM/yyyy"),
        "Section": details.section,
      };
    });

    // Add summary rows
    rows.push(
      { "Deal ID": "", "Influencer": "", "PAN (last 4)": "", "Gross ()": "", "TDS Rate": "", "TDS ()": "", "Net ()": "", "Date": "", "Section": "" },
      { "Deal ID": "TOTAL", "Influencer": `${tdsTransactions.length} deals`, "PAN (last 4)": "", "Gross ()": paiseToRupees(totalGross), "TDS Rate": "", "TDS ()": paiseToRupees(totalTDS), "Net ()": paiseToRupees(totalNet), "Date": `FY ${fy}`, "Section": summaryTdsSection }
    );

    // Add platform header and footer
    const platformHeader = getPlatformHeader().map((line) => ({ "Platform Info": line }));
    const platformFooter = getPlatformFooter().map((line) => ({ "Platform Info": line }));

    const finalRows = [
      ...platformHeader,
      { "Deal ID": "", "Influencer": "", "PAN (last 4)": "", "Gross ()": "", "TDS Rate": "", "TDS ()": "", "Net ()": "", "Date": "", "Section": "" },
      ...rows,
      ...platformFooter,
    ];

    const filename = `VyaparMedia-tds-summary-${fy}-${Date.now()}.csv`;
    return csvResponse(toCsv(finalRows), filename);
  }

  // JSON response
  return ApiResponse.success({
    fy,
    period: { from: bounds.start, to: bounds.end },
    summary: {
      totalGrossRupees: paiseToRupees(totalGross),
      totalTDSRupees: paiseToRupees(totalTDS),
      totalNetRupees: paiseToRupees(totalNet),
      dealCount: tdsTransactions.length,
      tdsSection: summaryTdsSection,
    },
    transactions: tdsTransactions.map((t) => {
      const details = getTransactionTdsDetails(t);
      return {
        dealId: t.dealId,
        influencer: t.deal?.influencer?.displayName,
        panLast4: t.deal?.influencer?.user?.taxCompliance?.panLast4,
        grossRupees: paiseToRupees((t.metadata as Record<string, number | undefined>)?.grossPayout ?? 0),
        tdsRate: details.rate,
        tdsRupees: paiseToRupees(t.amount),
        netRupees: paiseToRupees((t.metadata as Record<string, number | undefined>)?.netPayout ?? 0),
        date: t.createdAt,
        section: details.section,
      };
    }),
  }, "TDS summary generated");
}


export const GET = apiWrapper(_handler, {
requirePermission: "MANAGE_PLATFORM_FINANCE",
rateLimit: RATE_LIMIT_CONFIGS.REPORTS,
});
