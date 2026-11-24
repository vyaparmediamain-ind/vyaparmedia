import { z } from "zod";
import { apiWrapper, ApiResponse, type AuthenticatedRequest } from "@/lib/api-wrapper";
import { isFeatureEnabled, FEATURE_FLAGS } from "@/lib/feature-flags";
import { CampaignPerformanceReportService } from "@/services/campaign-performance-report.service";
import { csvResponse } from "@/lib/csv-export";
import { ReportVerificationService } from "@/services/report-verification.service";
import { createActivityLog } from "@/lib/audit";
import { resolveActor } from "@/lib/authz";

const paramsSchema = z
  .object({
    id: z.string().min(1, "Campaign ID is required"),
  })
  .strict();

const querySchema = z
  .object({
    format: z.enum(["json", "csv"]).optional().default("json"),
  })
  .strict();

export const GET = apiWrapper(
  async (req, { params }) => {
    const rawParams = await params;
    const { id } = paramsSchema.parse(rawParams);
    const session = (req as AuthenticatedRequest).session;
    const actor = await resolveActor(session);

    // Feature flag gate (branded_reports)
    const isBrandedReportsEnabled = await isFeatureEnabled(FEATURE_FLAGS.BRANDED_REPORTS, {
      userId: actor.id,
      role: actor.role,
    });

    if (!isBrandedReportsEnabled) {
      return ApiResponse.forbidden("Official Branded Reports feature is currently not enabled.");
    }

    const { searchParams } = new URL(req.url);
    const { format: fmt } = querySchema.parse(Object.fromEntries(searchParams.entries()));

    const reportData = await CampaignPerformanceReportService.getCampaignPerformanceReport(
      id,
      actor
    );

    // Activity log entry for brand export
    await createActivityLog({
      userId: actor.id,
      action: "CAMPAIGN_PERFORMANCE_REPORT_EXPORT",
      entityType: "Campaign",
      entityId: id,
      metadata: {
        format: fmt,
        reportId: reportData.reportMeta.reportId,
        integrityCode: reportData.reportMeta.integrityCode,
      },
    }).catch(() => { });

    // Cryptographic report verification registration
    await ReportVerificationService.recordReport({
      id: reportData.reportMeta.reportId,
      type: "CAMPAIGN_PERFORMANCE",
      userId: actor.id,
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
    maxBodySize: 1024 * 1024,
    userRateLimit: { bucket: "REPORTS" },
  }
);
