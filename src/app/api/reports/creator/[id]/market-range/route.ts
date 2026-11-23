import { NextRequest } from "next/server";
import { apiWrapper, ApiResponse, type AuthenticatedRequest } from "@/lib/api-wrapper";
import { MarketRangeReportService } from "@/services/market-range-report.service";
import { csvResponse } from "@/lib/csv-export";
import { RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { resolveActor } from "@/lib/authz";

type Context = {
  params: Promise<Record<string, string | string[]>>;
};

async function _handler(req: NextRequest, context: Context) {
  const session = (req as AuthenticatedRequest).session;
  const params = await context.params;
  const id = params.id as string;

  if (!id) {
    return ApiResponse.error("Influencer ID is required", 400);
  }

  const url = new URL(req.url);
  const format = url.searchParams.get("format") === "csv" ? "csv" : "json";

  const actor = await resolveActor(session);
  const reportData = await MarketRangeReportService.generateReport(
    actor,
    id,
    { format }
  );

  if (format === "csv") {
    const { csv, filename } = MarketRangeReportService.generateCsv(reportData);
    return csvResponse(csv, filename);
  }

  return ApiResponse.success(reportData, "Estimated market range report generated successfully.");
}

export const GET = apiWrapper(_handler, {
  requireAuth: true,
  rateLimit: RATE_LIMIT_CONFIGS.REPORTS,
  userRateLimit: { bucket: "REPORTS" },
});
