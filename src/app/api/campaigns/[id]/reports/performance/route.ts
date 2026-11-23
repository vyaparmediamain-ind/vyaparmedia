import { z } from "zod";
import { apiWrapper, ApiResponse, type AuthenticatedRequest } from "@/lib/api-wrapper";
import { isFeatureEnabled, FEATURE_FLAGS } from "@/lib/feature-flags";
import { CampaignPerformanceReportService } from "@/services/campaign-performance-report.service";
import { csvResponse } from "@/lib/csv-export";
import { ReportVerificationService } from "@/services/report-verification.service";
import prisma from "@/lib/db";

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
    const isAdmin = userRole === "ADMIN";

    // Feature flag gate (branded_reports)
    const isBrandedReportsEnabled = await isFeatureEnabled(FEATURE_FLAGS.BRANDED_REPORTS, {
      userId: callerUserId,
      role: userRole,
    });

    if (!isBrandedReportsEnabled) {
      return ApiResponse.forbidden("Official Branded Reports feature is currently not enabled.");
    }

    const fmt = new URL(req.url).searchParams.get("format") === "csv" ? "csv" : "json";

    const reportData = await CampaignPerformanceReportService.getCampaignPerformanceReport(
      id,
      callerUserId,
      isAdmin
    );

    // Activity log entry for brand export
    await prisma.activityLog
      .create({
        data: {
          userId: callerUserId,
          action: "CAMPAIGN_PERFORMANCE_REPORT_EXPORT",
          entityType: "Campaign",
          entityId: id,
          metadata: {
            format: fmt,
            reportId: reportData.reportMeta.reportId,
            integrityCode: reportData.reportMeta.integrityCode,
          },
        },
      })
      .catch(() => {});

    // Cryptographic report verification registration
    await ReportVerificationService.recordReport({
      id: reportData.reportMeta.reportId,
      type: "CAMPAIGN_PERFORMANCE",
      userId: callerUserId,
      scopeId: id,
      payloadHash: reportData.reportMeta.integrityCode,
    });

    if (fmt === "csv") {
      const csv = CampaignPerformanceReportService.generateCampaignPerformanceCsv(reportData);
      const filename = CampaignPerformanceReportService.getReportFilename(reportData);
      return csvResponse(csv, filename);
    }

    return ApiResponse.success(reportData, "Campaign performance report retrieved successfully");
  },
  {
    requireAuth: true,
    userRateLimit: { bucket: "REPORTS" },
  }
);
