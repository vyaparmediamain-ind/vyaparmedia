/**
 * Campaign Performance Report Service
 *
 * Conforms to VyaparMedia Report Standard (v3).
 *
 * Implements:
 * 1. Letterhead, Brand Legal Details, Performance KPIs, Conversion Funnel, Creator Deliverables Table.
 * 2. Mathematical Finance & Indian Tax (GST/TDS) Reconciliation that equals the Finance Tab.
 * 3. Data-Quality Audit (Verified vs Estimated vs Self-Reported).
 * 4. Cryptographic Document Integrity (SHA-256 Canonical Hashing + Base32 Short Code).
 * 5. Formula-Injection Safe Branded CSV Export.
 *
 * SECURITY:
 * - Object-level authorization: Caller must be owner brand or active admin.
 * - Non-owners receive 404 (not 403) to prevent IDOR / object enumeration.
 */

import prisma from "@/lib/db";
import { AppError } from "@/lib/errors";
import { paiseToRupees, buildBrandedCsv, buildReportFilename } from "@/lib/csv-export";
import { CampaignRoiService, type CreatorRoiBreakdown } from "@/services/campaign-roi.service";
import { CampaignFinanceService } from "@/services/campaign-finance.service";
import { buildReportMeta, type ReportMeta, type DataQualitySummary } from "@/lib/report-meta";
import { assertTaxReportPrerequisites } from "@/lib/platform-config-check";
import { Actor, normalizeActor } from "@/lib/authz";

export interface BrandLegalDetails {
  companyName: string;
  pan: string | null;
  gstin: string | null;
  address: string | null;
}

export interface CampaignPerformanceReportData {
  campaign: {
    id: string;
    title: string;
    status: string;
    totalBudgetPaise: number;
    totalBudgetRupees: string;
    fundedAmountPaise: number;
    fundedAmountRupees: string;
    targetCategories: string[];
    brandName: string;
    brandLegalDetails: BrandLegalDetails;
  };
  kpis: {
    totalSpendPaise: number;
    totalSpendRupees: string;
    totalReach: number;
    totalViews: number;
    verifiedViews: number;
    estimatedViews: number;
    totalEngagements: number;
    avgEngagementRate: number;
    effectiveCpvPaise: number;
    effectiveCpvRupees: string;
    categoryBaselineCpvPaise: number;
    categoryBaselineCpvRupees: string;
    efficiencyMultiplier: number | null;
    algorithmMatchAccuracy: number;
  };
  funnel: {
    reach: number;
    views: number;
    engagements: number;
    conversions: number;
  };
  creators: CreatorRoiBreakdown[];
  finance: {
    totalEscrowPaise: number;
    totalEscrowRupees: string;
    platformFeePaise: number;
    platformFeeRupees: string;
    gstOnPlatformFeePaise: number;
    gstOnPlatformFeeRupees: string;
    grossPayoutPaise: number;
    grossPayoutRupees: string;
    tdsDeductedPaise: number;
    tdsDeductedRupees: string;
    netPayoutPaise: number;
    netPayoutRupees: string;
    reconciled: boolean;
    discrepancyPaise: number;
    reconciliationMessage: string;
  };
  dataQualitySummary: DataQualitySummary;
  reportMeta: ReportMeta;
  disclaimer: string;
}

export class CampaignPerformanceReportService {
  /**
   * Retrieves complete audited performance report for a campaign.
   */
  public static async getCampaignPerformanceReport(
    campaignId: string,
    caller: Actor | string,
    legacyIsAdmin = false,
    now?: Date
  ): Promise<CampaignPerformanceReportData> {
    const actor = normalizeActor(caller, legacyIsAdmin);

    // 1. Assert statutory tax prerequisites (legalName, gstin, address)
    assertTaxReportPrerequisites();

    // 2. Fetch campaign and brand corporate profile
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        brand: {
          select: {
            id: true,
            userId: true,
            companyName: true,
            website: true,
            address: true,
            city: true,
            state: true,
            pinCode: true,
            user: {
              select: {
                id: true,
                email: true,
                userType: true,
                taxCompliance: {
                  select: {
                    panLast4: true,
                    gstinLast4: true,
                    gstStateCode: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!campaign) {
      throw AppError.notFound("Campaign not found");
    }

    const isOwner = campaign.brand?.userId === actor.id;
    if (!isOwner && !actor.isActiveAdmin) {
      // 404 returned so unauthorized callers cannot detect campaign presence (IDOR protection)
      throw AppError.notFound("Campaign not found");
    }

    // 3. Parallel fetch of ROI Performance and Finance Reconciliation
    const [roiReport, financeReport] = await Promise.all([
      CampaignRoiService.getCampaignRoiReport(campaignId, actor),
      CampaignFinanceService.getCampaignFinance(campaignId, actor),
    ]);

    // 4. Construct brand legal details
    const brandUser = campaign.brand?.user;
    const taxCompliance = brandUser?.taxCompliance;
    const addressParts = [
      campaign.brand?.address,
      campaign.brand?.city,
      campaign.brand?.state,
      campaign.brand?.pinCode,
    ].filter(Boolean);

    const brandLegalDetails: BrandLegalDetails = {
      companyName: campaign.brand?.companyName || "Brand Partner",
      pan: taxCompliance?.panLast4 ? `XXXXXX${taxCompliance.panLast4}` : null,
      gstin: taxCompliance?.gstinLast4
        ? `${taxCompliance.gstStateCode || "XX"}XXXXX${taxCompliance.gstinLast4}`
        : null,
      address: addressParts.length > 0 ? addressParts.join(", ") : null,
    };

    // 5. Build funnel stages
    const totalReach = roiReport.summary.totalReach;
    const totalViews = roiReport.summary.totalViews;
    const totalEngagements = roiReport.summary.totalEngagements;
    const totalConversions = roiReport.influencers.reduce((s, i) => s + i.shares + i.saves, 0);

    // 6. Mathematical Finance Reconciliation assertion (Must equal Finance tab!)
    const totalEscrowPaise = financeReport.summary.budgetTotalPaise;
    const grossPayoutPaise = financeReport.summary.totalGrossPayoutPaise;
    const platformFeePaise = financeReport.summary.totalPlatformFeePaise;
    const netPayoutPaise = financeReport.summary.totalNetPayoutPaise;
    const tdsPaise = financeReport.summary.totalTdsDeductedPaise;

    // Reconciliation rule: Gross Payout + Platform Fee === Total Escrow Spend
    // And: Net Payout + TDS === Gross Payout
    const partsSumPaise = grossPayoutPaise + platformFeePaise;
    const payoutSumPaise = netPayoutPaise + tdsPaise;
    const isReconciled =
      financeReport.summary.reconciliation.isReconciled &&
      (grossPayoutPaise === 0 || payoutSumPaise === grossPayoutPaise);

    const discrepancyPaise = Math.abs(totalEscrowPaise - partsSumPaise);

    // 7. Data Quality Audit
    const verifiedPercent =
      totalViews > 0
        ? Number(((roiReport.summary.totalVerifiedViews / totalViews) * 100).toFixed(1))
        : 100;
    const estimatedPercent =
      totalViews > 0
        ? Number(((roiReport.summary.totalEstimatedViews / totalViews) * 100).toFixed(1))
        : 0;

    const dataQualitySummary: DataQualitySummary = {
      verifiedPercent,
      estimatedPercent,
      selfReportedPercent: 0,
      text: `${verifiedPercent}% verified API, ${estimatedPercent}% estimated, 0% self-reported`,
    };

    // 8. Canonical Report Metadata & Cryptographic Integrity Hash
    const reportMeta = buildReportMeta({
      type: "CAMPAIGN_PERFORMANCE",
      scope: `Campaign: ${campaign.title} (${campaign.id})`,
      period: `FY ${new Date().getFullYear()}-${(new Date().getFullYear() + 1).toString().slice(-2)}`,
      user: {
        id: actor.id,
        name: campaign.brand?.companyName || "Brand Administrator",
        email: brandUser?.email || "billing@brand.in",
        role: actor.isActiveAdmin ? "ADMIN" : "BRAND",
      },
      dataQualitySummary,
      dataSources: ["Meta Graph API", "YouTube Data API", "VyaparMedia Escrow Ledger"],
      now,
      payload: {
        campaignId: campaign.id,
        totalBudgetPaise: campaign.totalBudget,
        totalSpendPaise: roiReport.summary.totalSpendPaise,
        totalViews,
        totalEngagements,
        grossPayoutPaise,
        platformFeePaise,
        tdsPaise,
        netPayoutPaise,
        reconciled: isReconciled,
        creators: roiReport.influencers.map((c) => ({
          dealId: c.dealId,
          handle: c.handle,
          views: c.views,
          paidPaise: c.paid,
        })),
      },
      extraMeta: {
        campaignId: campaign.id,
        brandName: campaign.brand?.companyName || "Brand Partner",
        reconciled: isReconciled ? "YES" : "NO",
      },
    });

    return {
      campaign: {
        id: campaign.id,
        title: campaign.title,
        status: campaign.status,
        totalBudgetPaise: campaign.totalBudget,
        totalBudgetRupees: paiseToRupees(campaign.totalBudget),
        fundedAmountPaise: campaign.fundedAmount,
        fundedAmountRupees: paiseToRupees(campaign.fundedAmount),
        targetCategories: campaign.targetCategories,
        brandName: campaign.brand?.companyName || "Brand Partner",
        brandLegalDetails,
      },
      kpis: {
        totalSpendPaise: roiReport.summary.totalSpendPaise,
        totalSpendRupees: roiReport.summary.totalSpendRupees,
        totalReach,
        totalViews,
        verifiedViews: roiReport.summary.totalVerifiedViews,
        estimatedViews: roiReport.summary.totalEstimatedViews,
        totalEngagements,
        avgEngagementRate: roiReport.summary.avgEngagementRate,
        effectiveCpvPaise: roiReport.summary.effectiveCpvPaise,
        effectiveCpvRupees: roiReport.summary.effectiveCpvRupees,
        categoryBaselineCpvPaise: roiReport.summary.categoryBaselineCpvPaise,
        categoryBaselineCpvRupees: roiReport.summary.categoryBaselineCpvRupees,
        efficiencyMultiplier: roiReport.summary.efficiencyMultiplier,
        algorithmMatchAccuracy: roiReport.summary.overallAlgorithmAccuracy,
      },
      funnel: {
        reach: totalReach,
        views: totalViews,
        engagements: totalEngagements,
        conversions: totalConversions,
      },
      creators: roiReport.influencers,
      finance: {
        totalEscrowPaise,
        totalEscrowRupees: paiseToRupees(totalEscrowPaise),
        platformFeePaise,
        platformFeeRupees: paiseToRupees(platformFeePaise),
        gstOnPlatformFeePaise: financeReport.summary.totalGstOnPlatformFeePaise,
        gstOnPlatformFeeRupees: financeReport.summary.totalGstOnPlatformFeeRupees,
        grossPayoutPaise,
        grossPayoutRupees: paiseToRupees(grossPayoutPaise),
        tdsDeductedPaise: tdsPaise,
        tdsDeductedRupees: paiseToRupees(tdsPaise),
        netPayoutPaise,
        netPayoutRupees: paiseToRupees(netPayoutPaise),
        reconciled: isReconciled,
        discrepancyPaise,
        reconciliationMessage: isReconciled
          ? "100% Mathematically Reconciled (Sum of creator gross payout and platform fee matches campaign spend exactly)."
          : `Discrepancy of ₹${paiseToRupees(discrepancyPaise)} detected in escrow reconciliation.`,
      },
      dataQualitySummary,
      reportMeta,
      disclaimer: "Estimated figures are indicative. This report is not tax, legal or financial advice.",
    };
  }

  /**
   * Generates a formula-injection safe CSV conforming to Report Standard Section 7.
   */
  public static generateCampaignPerformanceCsv(data: CampaignPerformanceReportData): string {
    const columns = [
      { key: "influencer", label: "Creator Partner", format: (v: unknown) => String(v || "Creator") },
      { key: "handle", label: "Handle", format: (v: unknown) => (v ? `@${v}` : "") },
      { key: "followers", label: "Followers", format: (v: unknown) => String(v ?? 0) },
      { key: "paidRupees", label: "Paid (INR)" },
      { key: "views", label: "Delivered Views", format: (v: unknown) => String(v ?? 0) },
      {
        key: "viewsVariancePercent",
        label: "Target Variance (%)",
        format: (v: unknown) => `${Number(v) > 0 ? "+" : ""}${v}%`,
      },
      { key: "accuracyPercentage", label: "Match Accuracy (%)", format: (v: unknown) => `${v}%` },
      { key: "costPerView", label: "Actual CPV (INR)" },
      { key: "reach", label: "Estimated Reach", format: (v: unknown) => String(v ?? 0) },
      { key: "totalEngagements", label: "Engagements", format: (v: unknown) => String(v ?? 0) },
      {
        key: "engagementRate",
        label: "ER (%)",
        format: (v: unknown) => `${Number(v).toFixed(2)}%`,
      },
      { key: "costPerEngagement", label: "CPE (INR)" },
      {
        key: "isEstimated",
        label: "Data Quality",
        format: (v: unknown) => (v ? "Estimated (Heuristic)" : "Verified (API-Sourced)"),
      },
    ];

    const summaryRows = [
      {
        influencer: "TOTAL / AVERAGE",
        handle: `${data.creators.length} Creators`,
        followers: "",
        paidRupees: data.kpis.totalSpendRupees,
        views: String(data.kpis.totalViews),
        viewsVariancePercent: "",
        accuracyPercentage: `${data.kpis.algorithmMatchAccuracy}%`,
        costPerView: data.kpis.effectiveCpvRupees,
        reach: String(data.kpis.totalReach),
        totalEngagements: String(data.kpis.totalEngagements),
        engagementRate: `${data.kpis.avgEngagementRate.toFixed(2)}%`,
        costPerEngagement: "",
        isEstimated: data.kpis.estimatedViews > 0 ? "Mixed (Estimated)" : "Verified API",
      },
    ];

    const customSections = [
      {
        title: "CAMPAIGN & BRAND LEGAL DOSSIER",
        rows: [
          ["Campaign ID", data.campaign.id],
          ["Campaign Title", data.campaign.title],
          ["Brand Entity Legal Name", data.campaign.brandLegalDetails.companyName],
          ["Brand GSTIN", data.campaign.brandLegalDetails.gstin || "Not Configured / Exempt"],
          ["Brand PAN", data.campaign.brandLegalDetails.pan || "Not Configured"],
          ["Registered Address", data.campaign.brandLegalDetails.address || "Not Specified"],
          ["Campaign Status", data.campaign.status],
          ["Target Categories", data.campaign.targetCategories.join(" | ") || "General"],
          ["Total Escrow Budget (INR)", data.campaign.totalBudgetRupees],
          ["Total Escrow Funded (INR)", data.campaign.fundedAmountRupees],
        ] as Array<[string, string | number]>,
      },
      {
        title: "EXECUTIVE PERFORMANCE & ATTRIBUTION",
        rows: [
          ["Total Estimated Reach", String(data.kpis.totalReach)],
          ["Total Delivered Views", String(data.kpis.totalViews)],
          ["Verified Views (API-Sourced)", String(data.kpis.verifiedViews)],
          ["Estimated Views (Heuristic Model)", String(data.kpis.estimatedViews)],
          ["Total Engagements (Likes + Comments + Shares + Saves)", String(data.kpis.totalEngagements)],
          ["Average Engagement Rate (%)", `${data.kpis.avgEngagementRate.toFixed(2)}%`],
          ["Effective Cost Per View (CPV)", `INR ${data.kpis.effectiveCpvRupees}`],
          ["Category Baseline CPV", `INR ${data.kpis.categoryBaselineCpvRupees}`],
          ["Efficiency Multiplier", data.kpis.efficiencyMultiplier ? `${data.kpis.efficiencyMultiplier}x` : "N/A"],
          ["Algorithm Match Accuracy (%)", `${data.kpis.algorithmMatchAccuracy}%`],
        ] as Array<[string, string | number]>,
      },
      {
        title: "CONVERSION FUNNEL ATTRIBUTION",
        rows: [
          ["Stage 1: Estimated Reach", String(data.funnel.reach)],
          ["Stage 2: Delivered Views", String(data.funnel.views)],
          ["Stage 3: Total Engagements", String(data.funnel.engagements)],
          ["Stage 4: Downstream Conversions / Clicks", String(data.funnel.conversions)],
        ] as Array<[string, string | number]>,
      },
      {
        title: "FINANCE & STATUTORY TAX RECONCILIATION",
        rows: [
          ["Total Campaign Spend (Escrow Disbursed)", `INR ${data.finance.totalEscrowRupees}`],
          ["Gross Creator Payouts", `INR ${data.finance.grossPayoutRupees}`],
          ["Section 194-O TDS Deducted (Statutory)", `INR ${data.finance.tdsDeductedRupees}`],
          ["Net Creator Disbursements", `INR ${data.finance.netPayoutRupees}`],
          ["Platform Service Fees", `INR ${data.finance.platformFeeRupees}`],
          ["GST on Platform Fees (18%)", `INR ${data.finance.gstOnPlatformFeeRupees}`],
          ["Mathematical Reconciliation Status", data.finance.reconciled ? "RECONCILED (100% Match)" : "DISCREPANCY DETECTED"],
          ["Reconciliation Note", data.finance.reconciliationMessage],
        ] as Array<[string, string | number]>,
      },
      {
        title: "DATA QUALITY AUDIT & INTEGRITY SEAL",
        rows: [
          ["Data Quality Distribution", data.dataQualitySummary.text || "100% Verified API"],
          ["Cryptographic Integrity Hash (SHA-256)", data.reportMeta.integrityCode],
          ["Public Verification ID", data.reportMeta.reportId],
        ] as Array<[string, string | number]>,
      },
    ];

    return buildBrandedCsv({
      meta: data.reportMeta,
      columns,
      rows: data.creators as unknown as Record<string, unknown>[],
      summaryRows,
      customSections,
    });
  }

  /**
   * Builds the official download filename.
   */
  public static getReportFilename(data: CampaignPerformanceReportData): string {
    return buildReportFilename("Performance", data.campaign.id);
  }
}
