import { apiWrapper, ApiResponse, type ValidatedNextRequest } from "@/lib/api-wrapper";
import { VisibilityAnalyticsService } from "@/services/visibility-analytics.service";

async function _handler(req: ValidatedNextRequest) {
  const session = req.session;
  if (!session?.user?.id) {
    return ApiResponse.unauthorized("Authentication required");
  }

  const stats = await VisibilityAnalyticsService.getBrandCampaignVisibilityStats(session.user.id);
  return ApiResponse.success(stats);
}

export const GET = apiWrapper(_handler, {
  requireAuth: true,
  requireBrand: true,
  userRateLimit: {
    bucket: "API_DEFAULT",
  },
});
