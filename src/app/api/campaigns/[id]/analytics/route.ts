import { NextRequest } from "next/server";
import { apiWrapper, ApiResponse, type AuthenticatedRequest } from "@/lib/api-wrapper";
import { CampaignMetricsService } from "@/services/campaign-metrics.service";
import { RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { resolveActor } from "@/lib/authz";

async function _handler(
  req: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> }
) {
  const session = (req as AuthenticatedRequest).session;
  const actor = await resolveActor(session);

  const params = await context.params;
  const campaignId = params.id as string;

  const analyticsData = await CampaignMetricsService.getCampaignAnalyticsOverview(
    campaignId,
    actor
  );

  return ApiResponse.success(analyticsData, "Campaign analytics retrieved");
}

export const GET = apiWrapper(_handler, {
  requireAuth: true,
  rateLimit: RATE_LIMIT_CONFIGS.REPORTS,
  userRateLimit: { bucket: "REPORTS" },
});
