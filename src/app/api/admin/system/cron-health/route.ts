import { apiWrapper, ApiResponse } from "@/lib/api-wrapper";
import { CronRunService } from "@/services/cron-run.service";

async function _handler_GET() {
  const heartbeats = await CronRunService.getCronHeartbeats();

  return ApiResponse.success(
    heartbeats,
    "Cron heartbeats retrieved successfully",
  );
}

export const GET = apiWrapper(_handler_GET, {
  requireAdmin: true,
  userRateLimit: { bucket: "API_DEFAULT" },
});
