import { NextRequest } from "next/server";
import { apiWrapper, ApiResponse, type AuthenticatedRequest } from "@/lib/api-wrapper";
import { TelemetryService } from "@/services/telemetry.service";
import { RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { TelemetryConsentInputSchema } from "@/lib/telemetry";

async function _getHandler(req: NextRequest) {
  const session = (req as AuthenticatedRequest).session;
  const consent = await TelemetryService.getUserConsent(session.user.id);
  return ApiResponse.success(consent);
}

async function _postHandler(req: NextRequest) {
  const session = (req as AuthenticatedRequest).session;
  const body = await req.json();

  const updated = await TelemetryService.updateUserConsent(
    session.user.id,
    body.consent,
    body.version
  );

  return ApiResponse.success(updated, "Telemetry consent preferences updated successfully");
}

export const GET = apiWrapper(_getHandler, {
  requireAuth: true,
  rateLimit: RATE_LIMIT_CONFIGS.API_DEFAULT,
  userRateLimit: { bucket: "API_DEFAULT" },
});

export const POST = apiWrapper(_postHandler, {
  requireAuth: true,
  rateLimit: RATE_LIMIT_CONFIGS.API_DEFAULT,
  userRateLimit: { bucket: "API_DEFAULT" },
  validate: {
    body: TelemetryConsentInputSchema,
  },
});
