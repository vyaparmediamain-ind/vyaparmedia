import { NextRequest } from "next/server";
import { apiWrapper, ApiResponse, type AuthenticatedRequest } from "@/lib/api-wrapper";
import prisma from "@/lib/db";
import {
  csvResponse,
  paiseToRupees,
  parseReportQueryParams,
  formatEntityAddress,
  buildBrandedCsv,
  buildReportFilename,
} from "@/lib/csv-export";
import { format } from "date-fns";
import { RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import {
  TDS_194O_RATE_PERCENT_STRING,
  TDS_206AA_PENAL_RATE_PERCENT_STRING,
  TDS_194O_THRESHOLD_RUPEES,
} from "@/constants";
import { PLATFORM_CONFIG } from "@/lib/platform-config";
import { assertTaxReportPrerequisites } from "@/lib/platform-config-check";
import { buildReportMeta } from "@/lib/report-meta";
import { ReportVerificationService } from "@/services/report-verification.service";

async function _handler(req: NextRequest) {
  const session = (req as AuthenticatedRequest).session;

  // External / Tax reports must verify corporate configuration completeness
  assertTaxReportPrerequisites();

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
  const totalNet = deals.reduce(
    (s, d) => s + (d.netPayout ?? Math.max(0, (d.grossPayout || d.amount) - (d.tdsDeducted || 0))),
    0
  );
  const totalGSTTCS = Math.max(0, totalGross - totalTDS - totalNet);

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

  const reportMeta = buildReportMeta({
    type: "INCOME",
    scope: profile.displayName || "Creator Income",
    period: `FY ${fy}`,
    user: {
      id: session.user.id,
      name: profile.displayName || session.user.name,
      email: session.user.email,
      role: "INFLUENCER",
    },
    dataQualitySummary: {
      verifiedPercent: 100,
      estimatedPercent: 0,
      selfReportedPercent: 0,
    },
    payload: {
      fy,
      influencerId: profile.id,
      totalGross,
      totalTDS,
      totalGSTTCS,
      totalNet,
      deals: deals.map((d) => ({ id: d.id, amount: d.amount })),
    },
  });

  // Audit log
  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: "REPORT_EXPORT",
      entityType: "InfluencerProfile",
      entityId: profile.id,
      metadata: {
        type: "INCOME",
        fy,
        format: fmt,
        reportId: reportMeta.reportId,
      },
    },
  }).catch(() => {});

  // Cryptographic report verification registration
  await ReportVerificationService.recordReport({
    id: reportMeta.reportId,
    type: "INCOME",
    userId: session.user.id,
    scopeId: profile.id,
    payloadHash: reportMeta.integrityCode,
  });

  if (fmt === "csv") {
    const address = formatEntityAddress(profile);

    const columns = [
      { key: "sr", label: "Sr." },
      { key: "date", label: "Completed Date" },
      { key: "brand", label: "Brand" },
      { key: "campaign", label: "Campaign" },
      { key: "category", label: "Category" },
      { key: "grossAmount", label: "Gross Amount (INR)" },
      { key: "platformFee", label: "Brand Platform Fee (INR)" },
      { key: "tds", label: "TDS 194-O (INR)" },
      { key: "gstTcs", label: "GST TCS Sec 52 (INR)" },
      { key: "netReceived", label: "Net Received (INR)" },
    ];

    const rows = deals.map((d, i) => {
      const gross = d.grossPayout || d.amount;
      const tds = d.tdsDeducted || 0;
      const net = d.netPayout ?? Math.max(0, gross - tds);
      const tcs = Math.max(0, gross - tds - net);
      return {
        sr: i + 1,
        date: d.completedAt ? format(d.completedAt, "dd/MM/yyyy") : "",
        brand: d.brand?.companyName ?? "",
        campaign: d.campaign?.title ?? "",
        category: String(d.campaign?.targetCategories?.[0] ?? ""),
        grossAmount: paiseToRupees(gross),
        platformFee: paiseToRupees(d.platformFee),
        tds: paiseToRupees(tds),
        gstTcs: paiseToRupees(tcs),
        netReceived: paiseToRupees(net),
      };
    });

    const customSections = [
      {
        title: "INFLUENCER DETAILS",
        rows: [
          ["Name", profile.displayName || ""],
          ["Address", address],
          ["PAN", tax?.panLast4 ? `XXXXX${tax.panLast4}` : "Not Provided"],
        ] as Array<[string, string | number]>,
      },
      {
        title: "ANNUAL INCOME SUMMARY",
        rows: [
          ["Total Gross Earnings (INR)", paiseToRupees(totalGross)],
          ["Platform Fee Deducted from Creator (INR)", "0.00 (Zero Fee for Creators)"],
          ["Total Brand Platform Fee Paid (INR)", paiseToRupees(totalPlatformFee)],
          ["Total TDS Deducted (INR)", paiseToRupees(totalTDS)],
          ["Total GST TCS Deducted (Sec 52) (INR)", paiseToRupees(totalGSTTCS)],
          ["Total Net Bank Disbursements (INR)", paiseToRupees(totalNet)],
        ] as Array<[string, string | number]>,
      },
      {
        title: "QUARTERLY TDS SCHEDULE (FORM 16A / 26AS RECONCILIATION)",
        rows: Object.values(quarters).map((q) => [
          `${q.label} (${q.count} Deals)`,
          `Gross: INR ${paiseToRupees(q.gross)} | TDS: INR ${paiseToRupees(q.tds)} | Net: INR ${paiseToRupees(q.net)}`,
        ]) as Array<[string, string | number]>,
      },
      {
        title: "STATUTORY TAX DECLARATION",
        rows: [
          ["Applicable Section", "Section 194-O / 194-J of the Income Tax Act 1961"],
          [
            "Deduction Rate",
            `${TDS_194O_RATE_PERCENT_STRING} on gross payments exceeding statutory limits (or ${TDS_206AA_PENAL_RATE_PERCENT_STRING} if PAN unverified)`,
          ],
          ["Deductor Entity", PLATFORM_CONFIG.legalName.toUpperCase()],
          ["Deductor CIN", PLATFORM_CONFIG.cin],
          ["Deductor GSTIN", PLATFORM_CONFIG.gstin],
          ["Form 16A Availability", "Quarterly TDS certificates available post quarterly TRACES filing"],
        ] as Array<[string, string | number]>,
      },
    ];

    const csv = buildBrandedCsv({
      meta: reportMeta,
      columns,
      rows,
      customSections,
    });

    const filename = buildReportFilename("Income", profile.displayName || "Creator");
    return csvResponse(csv, filename);
  }

  // JSON response
  return ApiResponse.success({
    fy,
    influencer: profile.displayName,
    period: { from: bounds.start, to: bounds.end },
    reportMeta,
    summary: {
      totalGrossRupees: paiseToRupees(totalGross),
      creatorPlatformFeeRupees: "0.00",
      brandPlatformFeeRupees: paiseToRupees(totalPlatformFee),
      totalTDSRupees: paiseToRupees(totalTDS),
      totalGstTcsRupees: paiseToRupees(totalGSTTCS),
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
    deals: deals.map((d) => {
      const gross = d.grossPayout || d.amount;
      const tds = d.tdsDeducted || 0;
      const net = d.netPayout ?? Math.max(0, gross - tds);
      const tcs = Math.max(0, gross - tds - net);
      return {
        id: d.id,
        brand: d.brand?.companyName,
        campaign: d.campaign?.title,
        completedAt: d.completedAt,
        grossRupees: paiseToRupees(gross),
        platformFeeRupees: paiseToRupees(d.platformFee),
        tdsRupees: paiseToRupees(tds),
        gstTcsRupees: paiseToRupees(tcs),
        netRupees: paiseToRupees(net),
      };
    }),
  }, "Income report generated");
}

export const GET = apiWrapper(_handler, {
  requirePermission: "VIEW_OWN_FINANCE",
  rateLimit: RATE_LIMIT_CONFIGS.REPORTS,
  userRateLimit: { bucket: "REPORTS" },
});
