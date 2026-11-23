import prisma from "@/lib/db";
import { logger } from "@/lib/logger";
import { getFeatureFlagRecord, evaluateFeatureFlag, FEATURE_FLAGS } from "@/lib/feature-flags";
import { reportGeneratedTotal } from "@/lib/metrics";

export interface RecordReportParams {
  id: string; // e.g. "VM-ROI-20261122-A1B2C3"
  type: string;
  userId: string;
  scopeId?: string | null | undefined;
  payloadHash: string;
  format?: string | undefined;
}

export interface VerifyReportResult {
  valid: boolean;
  id?: string;
  type?: string;
  createdAt?: string;
}

/**
 * Service for public report verification & integrity auditing.
 * Governed by the `report_verification` feature flag.
 */
export class ReportVerificationService {
  /**
   * Persists a generated report verification fingerprint if the feature flag is enabled.
   */
  public static async recordReport(params: RecordReportParams): Promise<void> {
    try {
      const flag = await getFeatureFlagRecord(FEATURE_FLAGS.REPORT_VERIFICATION);
      const isEnabled = evaluateFeatureFlag(flag, { userId: params.userId });
      if (!isEnabled) {
        return; // Opt-in feature flag guard
      }

      await prisma.generatedReport.upsert({
        where: { id: params.id },
        create: {
          id: params.id,
          type: params.type.toUpperCase(),
          userId: params.userId,
          scopeId: params.scopeId ?? null,
          payloadHash: params.payloadHash,
        },
        update: {
          payloadHash: params.payloadHash,
        },
      });

      logger.info("Recorded generated report verification fingerprint", {
        reportId: params.id,
        type: params.type,
      });

      // Prometheus metrics tracking
      reportGeneratedTotal.inc({
        type: params.type.toUpperCase(),
        format: (params.format ?? "JSON").toUpperCase(),
      });
    } catch (err) {
      // Non-blocking: never fail user report generation if verification recording fails
      logger.error("Failed to record generated report verification", {
        reportId: params.id,
        error: err,
      });
    }
  }

  /**
   * Public verification check.
   * Returns ONLY validity, report type, and generation timestamp.
   * NEVER exposes financial numbers, user PII, or internal IDs.
   */
  public static async verifyReport(reportId: string): Promise<VerifyReportResult> {
    if (!reportId || typeof reportId !== "string") {
      return { valid: false };
    }
    const cleanId = reportId.trim();
    if (cleanId.length < 4 || cleanId.length > 100) {
      return { valid: false };
    }

    try {
      const record = await prisma.generatedReport.findUnique({
        where: { id: cleanId },
        select: {
          id: true,
          type: true,
          createdAt: true,
        },
      });

      if (!record) {
        return { valid: false };
      }

      return {
        valid: true,
        id: record.id,
        type: record.type,
        createdAt: record.createdAt.toISOString(),
      };
    } catch (err) {
      logger.error("Error during public report verification lookup", {
        reportId,
        error: err,
      });
      return { valid: false };
    }
  }
}
