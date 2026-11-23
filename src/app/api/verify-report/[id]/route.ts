import { NextRequest } from "next/server";
import { z } from "zod";
import { apiWrapper, ApiResponse } from "@/lib/api-wrapper";
import { ReportVerificationService } from "@/services/report-verification.service";

const paramsSchema = z.object({
  id: z.string().trim().min(5).max(64),
}).strict();

async function _handler(
  _req: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> }
) {
  const rawParams = await context.params;
  const parsed = paramsSchema.safeParse(rawParams);

  if (!parsed.success) {
    return ApiResponse.error("Invalid report identifier", 400);
  }

  const result = await ReportVerificationService.verifyReport(parsed.data.id);

  if (!result.valid) {
    return ApiResponse.success({
      valid: false,
      message: "Report not found or verification record not registered.",
    });
  }

  return ApiResponse.success({
    valid: true,
    reportId: result.id,
    type: result.type,
    issuedAt: result.createdAt,
    platform: "VyaparMedia Official Document Verification",
  });
}

export const GET = apiWrapper(_handler, {
  userRateLimit: {
    bucket: "API_DEFAULT",
    errorMessage: "Too many verification requests. Please try again shortly.",
  },
});
