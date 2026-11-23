import { z } from "zod";
import { apiWrapper, ApiResponse, type AuthenticatedRequest } from "@/lib/api-wrapper";
import { isFeatureEnabled, FEATURE_FLAGS } from "@/lib/feature-flags";
import { CampaignGovernanceReportService } from "@/services/campaign-governance-report.service";
import { csvResponse } from "@/lib/csv-export";
import { ReportVerificationService } from "@/services/report-verification.service";
import { getSecureClientIp } from "@/lib/ip";

const paramsSchema = z
  .object({
    id: z.string().min(1, "Campaign ID is required"),
  })
  .strict();

export const GET = apiWrapper(
  async (req, { params }) => {
    const rawParams = await params;
    const { id } = paramsSchema.parse(rawParams);
    const session = (req as AuthenticatedRequest).session;
    const callerUserId = session.user.id;
    const userRole = session.user.userType;
    const ipAddress = getSecureClientIp(req);

    // Feature flag gate (branded_reports)
    const isBrandedReportsEnabled = await isFeatureEnabled(FEATURE_FLAGS.BRANDED_REPORTS, {
      userId: callerUserId,
      role: userRole,
    });

    if (!isBrandedReportsEnabled) {
      return ApiResponse.forbidden("Official Branded Reports feature is currently not enabled.");
    }

    const fmt = new URL(req.url).searchParams.get("format") === "csv" ? "csv" : "json";

    const reportData = await CampaignGovernanceReportService.getCampaignGovernanceReport(
      id,
      session.user,
      ipAddress
    );

    // Cryptographic report verification registration
    await ReportVerificationService.recordReport({
      id: reportData.reportMeta.reportId,
      type: "CAMPAIGN_GOVERNANCE",
      userId: callerUserId,
      scopeId: id,
      payloadHash: reportData.reportMeta.integrityCode,
    });

    if (fmt === "csv") {
      const csv = CampaignGovernanceReportService.generateCampaignGovernanceCsv(reportData);
      const filename = CampaignGovernanceReportService.getReportFilename(reportData);
      return csvResponse(csv, filename);
    }

    return ApiResponse.success(reportData, "Campaign governance report retrieved successfully");
  },
  {
    requireAuth: true,
    requireAdmin: true,
    userRateLimit: { bucket: "REPORTS" },
  }
);
