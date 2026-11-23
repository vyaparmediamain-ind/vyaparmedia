/**
 * Campaign Governance Report Service (Admin Exclusive)
 *
 * Conforms to VyaparMedia Report Standard (v3).
 *
 * Implements:
 * 1. Letterhead & Brand Legal Dossier.
 * 2. Platform Revenue & Gateway Processing Cost Ledger.
 * 3. Deadline Risk Matrix (Overdue, Imminent <48h, Sign Overdue).
 * 4. Dispute Cases & Arbitration Ledger.
 * 5. Sanitized Contact-Leak Policy Flags (counts + deal links, zero raw message exposure).
 * 6. Fraud & Creator Metric Anomaly (P06) Markers.
 * 7. Full Performance, Funnel, and Finance Reconciliation.
 * 8. Cryptographic Document Integrity & Branded CSV Generation.
 *
 * SECURITY:
 * - Admin-only: strictly enforced by requireActiveAdmin.
 * - Writes immutable audit log on export.
 */

import { requireActiveAdmin, type AdminSessionUser } from "@/lib/admin-auth";
import { createAuditLog } from "@/lib/audit";
import { buildBrandedCsv, buildReportFilename } from "@/lib/csv-export";
import {
  CampaignPerformanceReportService,
  type CampaignPerformanceReportData,
} from "./campaign-performance-report.service";
import {
  AdminCampaignService,
  type AdminCampaignDetailResponse,
} from "./admin-campaign.service";
import { buildReportMeta, type ReportMeta } from "@/lib/report-meta";

export interface CampaignGovernanceReportData extends CampaignPerformanceReportData {
  governance: AdminCampaignDetailResponse["audit"];
  reportMeta: ReportMeta;
}

export class CampaignGovernanceReportService {
  /**
   * Retrieves complete governance report for administrators.
   */
  public static async getCampaignGovernanceReport(
    campaignId: string,
    adminUser: AdminSessionUser | null | undefined,
    ipAddress?: string,
    now?: Date
  ): Promise<CampaignGovernanceReportData> {
    const adminIdentity = await requireActiveAdmin(adminUser);

    // Fetch performance data (with admin bypass) and admin governance audit data
    const [performanceData, adminDetails] = await Promise.all([
      CampaignPerformanceReportService.getCampaignPerformanceReport(
        campaignId,
        adminIdentity.id,
        true,
        now
      ),
      AdminCampaignService.getAdminCampaignDetails(campaignId, adminUser, ipAddress),
    ]);

    const audit = adminDetails.audit;

    // Build canonical governance report metadata
    const reportMeta = buildReportMeta({
      type: "CAMPAIGN_GOVERNANCE",
      scope: `Governance Audit: ${performanceData.campaign.title} (${campaignId})`,
      period: performanceData.reportMeta.period,
      user: {
        id: adminIdentity.id,
        name: "Platform Chief Compliance",
        email: adminIdentity.email,
        role: "ADMIN",
      },
      dataQualitySummary: performanceData.dataQualitySummary,
      dataSources: [
        "VyaparMedia Admin Operations Engine",
        "Escrow Financial Ledger",
        "Meta & YouTube API Telemetry",
        "Dispute Arbitration Records",
      ],
      now,
      payload: {
        campaignId,
        revenue: audit.revenue,
        deadlineRisksCount: audit.deadlineRisks.length,
        disputesTotal: audit.disputes.total,
        contactLeaksCount: audit.contactLeaks.totalCount,
        fraudFlagsCount: audit.fraudFlags.length,
        creatorMetricAnomaliesCount: audit.creatorMetricAnomalies.length,
        reconciled: performanceData.finance.reconciled,
      },
      extraMeta: {
        campaignId,
        netPlatformRevenuePaise: audit.revenue.netPlatformRevenuePaise,
        dealsAtRisk: audit.deadlineRisks.length,
      },
    });

    // Write audit log entry for governance report generation
    await createAuditLog({
      actorId: adminIdentity.id,
      actionType: "ADMIN_GOVERNANCE_REPORT_EXPORT",
      entityType: "CAMPAIGN",
      entityId: campaignId,
      afterJSON: {
        reportId: reportMeta.reportId,
        integrityCode: reportMeta.integrityCode,
        netPlatformRevenuePaise: audit.revenue.netPlatformRevenuePaise,
        dealsAtRiskCount: audit.deadlineRisks.length,
        disputesCount: audit.disputes.total,
      },
      ...(ipAddress ? { ipAddress } : {}),
    });

    return {
      ...performanceData,
      governance: audit,
      reportMeta,
    };
  }

  /**
   * Generates a formula-injection safe CSV for Campaign Governance Report.
   */
  public static generateCampaignGovernanceCsv(data: CampaignGovernanceReportData): string {
    const columns = [
      { key: "influencer", label: "Creator Partner", format: (v: unknown) => String(v || "Creator") },
      { key: "handle", label: "Handle", format: (v: unknown) => (v ? `@${v}` : "") },
      { key: "followers", label: "Audience", format: (v: unknown) => String(v ?? 0) },
      { key: "paidRupees", label: "Disbursed (INR)" },
      { key: "views", label: "Views Delivered", format: (v: unknown) => String(v ?? 0) },
      { key: "costPerView", label: "CPV (INR)" },
      {
        key: "engagementRate",
        label: "ER (%)",
        format: (v: unknown) => `${Number(v).toFixed(2)}%`,
      },
      {
        key: "isEstimated",
        label: "Data Quality",
        format: (v: unknown) => (v ? "Estimated" : "Verified API"),
      },
    ];

    const summaryRows = [
      {
        influencer: "TOTAL / SUMMARY",
        handle: `${data.creators.length} Creators`,
        followers: "",
        paidRupees: data.kpis.totalSpendRupees,
        views: String(data.kpis.totalViews),
        costPerView: data.kpis.effectiveCpvRupees,
        engagementRate: `${data.kpis.avgEngagementRate.toFixed(2)}%`,
        isEstimated: data.kpis.estimatedViews > 0 ? "Mixed Estimated" : "Verified API",
      },
    ];

    const customSections = [
      {
        title: "CAMPAIGN & BRAND LEGAL DOSSIER",
        rows: [
          ["Campaign ID", data.campaign.id],
          ["Campaign Title", data.campaign.title],
          ["Brand Legal Entity", data.campaign.brandLegalDetails.companyName],
          ["Brand GSTIN", data.campaign.brandLegalDetails.gstin || "Not Configured / Exempt"],
          ["Brand PAN", data.campaign.brandLegalDetails.pan || "Not Configured"],
          ["Corporate Address", data.campaign.brandLegalDetails.address || "Not Specified"],
          ["Campaign Status", data.campaign.status],
        ] as Array<[string, string | number]>,
      },
      {
        title: "PLATFORM REVENUE & TRANSACTION PROCESSOR LEDGER (ADMIN)",
        rows: [
          ["Gross Platform Fees Invoiced", `INR ${data.governance.revenue.grossPlatformFeeRupees}`],
          ["Payment Gateway Processing Costs", `INR ${data.governance.revenue.gatewayCostRupees}`],
          ["Net Platform Revenue Retained", `INR ${data.governance.revenue.netPlatformRevenueRupees}`],
          ["Completed Deals Count", String(data.governance.revenue.completedDealsCount)],
        ] as Array<[string, string | number]>,
      },
      {
        title: "OPERATIONAL DEADLINE RISK MATRIX",
        rows: [
          ["Total Deals at Risk", String(data.governance.deadlineRisks.length)],
          ...data.governance.deadlineRisks.map(
            (r) =>
              [
                `Deal ${r.dealId} (@${r.influencerHandle || r.influencerName})`,
                `Status: ${r.status} | Severity: ${r.riskSeverity} | Hours: ${r.hoursUntilPostingDeadline}h`,
              ] as [string, string | number]
          ),
        ] as Array<[string, string | number]>,
      },
      {
        title: "DISPUTE CASE LEDGER & ARBITRATION",
        rows: [
          ["Total Disputes Filed", String(data.governance.disputes.total)],
          ["Active Open Disputes", String(data.governance.disputes.open)],
          ["Resolved Disputes", String(data.governance.disputes.resolved)],
          ...data.governance.disputes.items.map(
            (d) =>
              [`Dispute ${d.id} (Deal: ${d.dealId})`, `Type: ${d.type} | Tier: ${d.tier} | Status: ${d.status}`] as [
                string,
                string | number,
              ]
          ),
        ] as Array<[string, string | number]>,
      },
      {
        title: "CONTACT-LEAK AUDIT (PRIVACY-SANITIZED: NO RAW MESSAGE CONTENT)",
        rows: [
          ["Total Off-Platform Contact Flags", String(data.governance.contactLeaks.totalCount)],
          ...data.governance.contactLeaks.items.map(
            (l) =>
              [`Event ${l.messageId}`, `Sender: ${l.senderUserType || "USER"} | Pattern: ${l.flagType}`] as [
                string,
                string | number,
              ]
          ),
        ] as Array<[string, string | number]>,
      },
      {
        title: "FRAUD RISK & CREATOR METRIC ANOMALIES (P06)",
        rows: [
          ["Total Platform Fraud Flags", String(data.governance.fraudFlags.length)],
          ...data.governance.fraudFlags.map((f) => [f.flag, `${f.severity}: ${f.details}`] as [string, string | number]),
          ["Creator Metric Anomalies (P06)", String(data.governance.creatorMetricAnomalies.length)],
          ...data.governance.creatorMetricAnomalies.map(
            (a) => [`Anomaly: ${a.rule}`, `@${a.influencerHandle || a.influencerName}: ${a.description}`] as [string, string | number]
          ),
        ] as Array<[string, string | number]>,
      },
      {
        title: "FINANCE & STATUTORY TAX RECONCILIATION",
        rows: [
          ["Total Escrow Disbursed", `INR ${data.finance.totalEscrowRupees}`],
          ["Gross Creator Payouts", `INR ${data.finance.grossPayoutRupees}`],
          ["Section 194-O TDS Deducted", `INR ${data.finance.tdsDeductedRupees}`],
          ["Net Creator Payouts", `INR ${data.finance.netPayoutRupees}`],
          ["Platform Fees", `INR ${data.finance.platformFeeRupees}`],
          ["GST on Platform Fees (18%)", `INR ${data.finance.gstOnPlatformFeeRupees}`],
          ["Mathematical Reconciliation", data.finance.reconciled ? "RECONCILED (100% Match)" : "DISCREPANCY DETECTED"],
        ] as Array<[string, string | number]>,
      },
      {
        title: "DATA QUALITY AUDIT & INTEGRITY",
        rows: [
          ["Data Quality Distribution", data.dataQualitySummary.text || "Verified API"],
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
  public static getReportFilename(data: CampaignGovernanceReportData): string {
    return buildReportFilename("Governance", data.campaign.id);
  }
}
