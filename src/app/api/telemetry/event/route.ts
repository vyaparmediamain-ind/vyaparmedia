import { NextRequest } from "next/server";
import { apiWrapper, ApiResponse, type AuthenticatedRequest } from "@/lib/api-wrapper";
import { TelemetryService } from "@/services/telemetry.service";
import { RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { PageViewEventInputSchema } from "@/lib/telemetry";

async function _handler(req: NextRequest) {
  const session = (req as AuthenticatedRequest).session;
  const callerUser = session?.user
    ? {
        id: session.user.id,
        role: session.user.userType,
      }
    : null;

  const body = await req.json();

  const result = await TelemetryService.recordPageView(body, callerUser);

  return ApiResponse.success(result, "Telemetry event processed");
}

export const POST = apiWrapper(_handler, {
  requireAuth: false,
  rateLimit: RATE_LIMIT_CONFIGS.API_DEFAULT,
  userRateLimit: { bucket: "API_DEFAULT" },
  maxBodySize: 32_768, // 32KB is plenty for lightweight telemetry events
  validate: {
    body: PageViewEventInputSchema,
  },
});
