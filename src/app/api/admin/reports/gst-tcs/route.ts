import { NextRequest } from "next/server";
import { apiWrapper, ApiResponse } from "@/lib/api-wrapper";
import prisma from "@/lib/db";
import { toCsv, csvResponse, paiseToRupees, parseReportQueryParams } from "@/lib/csv-export";
import { format } from "date-fns";
import { RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { getPlatformHeader, getPlatformFooter } from "@/lib/platform-config";
import { GST_TCS_RATE_PERCENT_STRING } from "@/constants";

async function _handler(req: NextRequest) {
  const { fy, format: fmt, bounds } = parseReportQueryParams(req.url);
  if (!bounds) return ApiResponse.error("Invalid FY format. Use YYYY-YY e.g. 2025-26");

  // Query all GST TCS transactions in FY
  const tcsTransactions = await prisma.transaction.findMany({
    take: 1000,
    where: {
      status: "COMPLETED",
      createdAt: { gte: bounds.start, lte: bounds.end },
      metadata: {
        path: ["source"],
        equals: "gst_tcs_withholding",
      },
      type: "DEBIT",
    },
    include: {
      deal: {
        include: {
          influencer: {
            include: {
              user: {
                include: {
                  taxCompliance: {
                    select: {
                      panLast4: true,
                      gstinLast4: true,
                      gstStateCode: true,
                      gstRegistrationType: true,
                    },
                  },
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
  const totalGross = tcsTransactions.reduce(
    (s, t) => s + ((t.metadata as Record<string, number | undefined>)?.grossPayout ?? 0),
    0,
  );
  const totalTCS = tcsTransactions.reduce((s, t) => s + t.amount, 0);
  const totalCgst = tcsTransactions.reduce(
    (s, t) => s + ((t.metadata as Record<string, number | undefined>)?.cgstPaise ?? 0),
    0,
  );
  const totalSgst = tcsTransactions.reduce(
    (s, t) => s + ((t.metadata as Record<string, number | undefined>)?.sgstPaise ?? 0),
    0,
  );
  const totalIgst = tcsTransactions.reduce(
    (s, t) => s + ((t.metadata as Record<string, number | undefined>)?.igstPaise ?? 0),
    0,
  );
  const totalNet = tcsTransactions.reduce(
    (s, t) => s + ((t.metadata as Record<string, number | undefined>)?.netPayout ?? 0),
    0,
  );

  if (fmt === "csv") {
    // CSV output formatted for Form GSTR-8 e-commerce operator filing
    const rows = tcsTransactions.map((t) => {
      const meta = t.metadata as Record<string, unknown> | null;
      const isInterState = Boolean(meta?.isInterState);
      const cgst = typeof meta?.cgstPaise === "number" ? meta.cgstPaise : 0;
      const sgst = typeof meta?.sgstPaise === "number" ? meta.sgstPaise : 0;
      const igst = typeof meta?.igstPaise === "number" ? meta.igstPaise : 0;
      const gross = typeof meta?.grossPayout === "number" ? meta.grossPayout : 0;
      const net = typeof meta?.netPayout === "number" ? meta.netPayout : 0;

      return {
        "Deal ID": t.dealId ?? "",
        "Supplier (Influencer)": t.deal?.influencer?.displayName ?? "",
        "Supplier GSTIN (Last 4)": (meta?.supplierGstinLast4 as string | undefined) ?? t.deal?.influencer?.user?.taxCompliance?.gstinLast4 ?? "",
        "Supply Type": isInterState ? "Inter-State (IGST)" : "Intra-State (CGST+SGST)",
        "Gross Value (\u20B9)": paiseToRupees(gross),
        "TCS Rate": GST_TCS_RATE_PERCENT_STRING,
        "CGST (\u20B9)": paiseToRupees(cgst),
        "SGST (\u20B9)": paiseToRupees(sgst),
        "IGST (\u20B9)": paiseToRupees(igst),
        "Total TCS Deducted (\u20B9)": paiseToRupees(t.amount),
        "Net Disbursed (\u20B9)": paiseToRupees(net),
        "Date": format(new Date(t.createdAt), "dd/MM/yyyy"),
        "Section": "CGST Sec 52",
      };
    });

    // Add summary rows
    rows.push(
      {
        "Deal ID": "",
        "Supplier (Influencer)": "",
        "Supplier GSTIN (Last 4)": "",
        "Supply Type": "",
        "Gross Value (\u20B9)": "",
        "TCS Rate": "",
        "CGST (\u20B9)": "",
        "SGST (\u20B9)": "",
        "IGST (\u20B9)": "",
        "Total TCS Deducted (\u20B9)": "",
        "Net Disbursed (\u20B9)": "",
        "Date": "",
        "Section": "",
      },
      {
        "Deal ID": "TOTAL",
        "Supplier (Influencer)": `${tcsTransactions.length} transactions`,
        "Supplier GSTIN (Last 4)": "",
        "Supply Type": "",
        "Gross Value (\u20B9)": paiseToRupees(totalGross),
        "TCS Rate": GST_TCS_RATE_PERCENT_STRING,
        "CGST (\u20B9)": paiseToRupees(totalCgst),
        "SGST (\u20B9)": paiseToRupees(totalSgst),
        "IGST (\u20B9)": paiseToRupees(totalIgst),
        "Total TCS Deducted (\u20B9)": paiseToRupees(totalTCS),
        "Net Disbursed (\u20B9)": paiseToRupees(totalNet),
        "Date": `FY ${fy}`,
        "Section": "CGST Sec 52",
      },
    );

    // Add platform header and footer
    const platformHeader = getPlatformHeader().map((line) => ({ "Platform Info": line }));
    const platformFooter = getPlatformFooter().map((line) => ({ "Platform Info": line }));

    const finalRows = [
      ...platformHeader,
      {
        "Deal ID": "",
        "Supplier (Influencer)": "",
        "Supplier GSTIN (Last 4)": "",
        "Supply Type": "",
        "Gross Value (\u20B9)": "",
        "TCS Rate": "",
        "CGST (\u20B9)": "",
        "SGST (\u20B9)": "",
        "IGST (\u20B9)": "",
        "Total TCS Deducted (\u20B9)": "",
        "Net Disbursed (\u20B9)": "",
        "Date": "",
        "Section": "",
      },
      ...rows,
      ...platformFooter,
    ];

    const filename = `VyaparMedia-gstr8-tcs-summary-${fy}-${Date.now()}.csv`;
    return csvResponse(toCsv(finalRows), filename);
  }

  // JSON response
  return ApiResponse.success({
    fy,
    period: { from: bounds.start, to: bounds.end },
    summary: {
      totalGross: paiseToRupees(totalGross),
      totalTcs: paiseToRupees(totalTCS),
      totalCgst: paiseToRupees(totalCgst),
      totalSgst: paiseToRupees(totalSgst),
      totalIgst: paiseToRupees(totalIgst),
      totalNet: paiseToRupees(totalNet),
      transactionCount: tcsTransactions.length,
      section: "Section 52 (CGST Act, 2017)",
    },
    transactions: tcsTransactions.map((t) => {
      const meta = t.metadata as Record<string, unknown> | null;
      return {
        id: t.id,
        dealId: t.dealId,
        amount: paiseToRupees(t.amount),
        cgst: paiseToRupees(typeof meta?.cgstPaise === "number" ? meta.cgstPaise : 0),
        sgst: paiseToRupees(typeof meta?.sgstPaise === "number" ? meta.sgstPaise : 0),
        igst: paiseToRupees(typeof meta?.igstPaise === "number" ? meta.igstPaise : 0),
        grossPayout: paiseToRupees(typeof meta?.grossPayout === "number" ? meta.grossPayout : 0),
        netPayout: paiseToRupees(typeof meta?.netPayout === "number" ? meta.netPayout : 0),
        createdAt: t.createdAt,
      };
    }),
  });
}

export const GET = apiWrapper(_handler, {
  requireAuth: true,
  requireAdmin: true,
  rateLimit: RATE_LIMIT_CONFIGS.REPORTS,
});
