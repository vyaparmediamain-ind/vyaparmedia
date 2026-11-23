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
import { assertTaxReportPrerequisites } from "@/lib/platform-config-check";
import { buildReportMeta } from "@/lib/report-meta";
import { ReportVerificationService } from "@/services/report-verification.service";
import {
  GST_STANDARD_RATE,
  GST_STANDARD_RATE_PERCENT_STRING,
  GST_DEAL_EXEMPT_THRESHOLD_PAISE,
} from "@/constants";

async function _handler(req: NextRequest) {
  const session = (req as AuthenticatedRequest).session;

  // External / Tax reports must verify corporate configuration completeness
  assertTaxReportPrerequisites();

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
  const totalGST = deals.reduce((s, d) => {
    return s + (d.amount > GST_DEAL_EXEMPT_THRESHOLD_PAISE ? Math.round(d.platformFee * GST_STANDARD_RATE) : 0);
  }, 0);
  const totalInvoice = totalPlatformFee + totalGST;

  const reportMeta = buildReportMeta({
    type: "SPEND",
    scope: profile.companyName || "Brand Client",
    period: `FY ${fy}`,
    user: {
      id: session.user.id,
      name: profile.companyName || session.user.name,
      email: session.user.email,
      role: "BRAND",
    },
    dataQualitySummary: {
      verifiedPercent: 100,
      estimatedPercent: 0,
      selfReportedPercent: 0,
    },
    payload: {
      fy,
      brandId: profile.id,
      totalPaid,
      totalPlatformFee,
      totalGST,
      totalInvoice,
      deals: deals.map((d) => ({ id: d.id, amount: d.amount })),
    },
  });

  // Audit log
  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: "REPORT_EXPORT",
      entityType: "BrandProfile",
      entityId: profile.id,
      metadata: {
        type: "SPEND",
        fy,
        format: fmt,
        reportId: reportMeta.reportId,
      },
    },
  }).catch(() => {});

  // Cryptographic report verification registration
  await ReportVerificationService.recordReport({
    id: reportMeta.reportId,
    type: "SPEND",
    userId: session.user.id,
    scopeId: profile.id,
    payloadHash: reportMeta.integrityCode,
  });

  if (fmt === "csv") {
    const address = formatEntityAddress(profile);

    const columns = [
      { key: "sr", label: "Sr." },
      { key: "date", label: "Date" },
      { key: "campaign", label: "Campaign" },
      { key: "influencer", label: "Influencer" },
      { key: "instagramHandle", label: "Instagram Handle" },
      { key: "followers", label: "Followers" },
      { key: "paidToInfluencer", label: "Paid to Influencer (INR)" },
      { key: "platformFee", label: "Platform Fee (INR)" },
      { key: "gstOnFee", label: `GST @ ${GST_STANDARD_RATE_PERCENT_STRING} on Fee (INR)` },
      { key: "invoiceTotal", label: "Invoice Total (INR)" },
    ];

    const rows = deals.map((d, i) => {
      const gstOnFee = d.amount > GST_DEAL_EXEMPT_THRESHOLD_PAISE ? Math.round(d.platformFee * GST_STANDARD_RATE) : 0;
      const invoiceTotal = d.platformFee + gstOnFee;
      return {
        sr: i + 1,
        date: d.completedAt ? format(d.completedAt, "dd/MM/yyyy") : "",
        campaign: d.campaign?.title ?? "",
        influencer: d.influencer?.displayName ?? "",
        instagramHandle: d.influencer?.instagramHandle ?? "",
        followers: d.influencer?.instagramFollowers ?? 0,
        paidToInfluencer: paiseToRupees(d.amount),
        platformFee: paiseToRupees(d.platformFee),
        gstOnFee: paiseToRupees(gstOnFee),
        invoiceTotal: paiseToRupees(invoiceTotal),
      };
    });

    const customSections = [
      {
        title: "CLIENT DETAILS",
        rows: [
          ["Company Name", profile.companyName || ""],
          ["Address", address],
          [
            "GSTIN",
            profile.gstNumber
              ? `${profile.gstNumber.slice(0, 2)}XXXXXXXXXX${profile.gstNumber.slice(-3)}`
              : "Not Provided",
          ],
          ["PAN", profile.panNumber ? `XXXXX${profile.panNumber.slice(-4)}` : "Not Provided"],
        ] as Array<[string, string | number]>,
      },
      {
        title: "GST SUMMARY",
        rows: [
          ["Service Accounting Code (SAC)", "998365 (Advertising, Marketing & Influencer Services)"],
          ["Total Amount Paid to Influencers (INR)", paiseToRupees(totalPaid)],
          ["Total Platform Fee (INR)", paiseToRupees(totalPlatformFee)],
          [`Total GST @ ${GST_STANDARD_RATE_PERCENT_STRING} on Platform Fee (INR)`, paiseToRupees(totalGST)],
          ["Total Invoice Amount (INR)", paiseToRupees(totalInvoice)],
          [
            `GST Component (CGST @ ${Math.round((GST_STANDARD_RATE * 100) / 2)}%)`,
            paiseToRupees(Math.round(totalGST / 2)),
          ],
          [
            `GST Component (SGST @ ${Math.round((GST_STANDARD_RATE * 100) / 2)}%)`,
            paiseToRupees(Math.round(totalGST / 2)),
          ],
          ["Reverse Charge Mechanism (RCM)", "Not Applicable — Normal Charge"],
        ] as Array<[string, string | number]>,
      },
    ];

    const csv = buildBrandedCsv({
      meta: reportMeta,
      columns,
      rows,
      customSections,
    });

    const filename = buildReportFilename("Spend", profile.companyName || "Brand");
    return csvResponse(csv, filename);
  }

  // JSON response
  return ApiResponse.success({
    fy,
    period: { from: bounds.start, to: bounds.end },
    reportMeta,
    summary: {
      totalPaidRupees: paiseToRupees(totalPaid),
      totalFeeRupees: paiseToRupees(totalPlatformFee),
      totalGstRupees: paiseToRupees(totalGST),
      totalInvoiceRupees: paiseToRupees(totalInvoice),
      dealCount: deals.length,
    },
    deals: deals.map((d) => {
      const gstOnFee = d.amount > GST_DEAL_EXEMPT_THRESHOLD_PAISE ? Math.round(d.platformFee * GST_STANDARD_RATE) : 0;
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
  userRateLimit: { bucket: "REPORTS" },
});
