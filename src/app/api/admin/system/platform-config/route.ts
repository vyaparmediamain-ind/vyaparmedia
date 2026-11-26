import { apiWrapper, ApiResponse } from "@/lib/api-wrapper";
import {
  getPlatformConfigStatus,
  validateTaxReportPrerequisites,
} from "@/lib/platform-config-check";

async function _handler_GET() {
  const fields = getPlatformConfigStatus();
  const taxCheck = validateTaxReportPrerequisites();

  return ApiResponse.success(
    {
      fields,
      taxCheck,
    },
    "Platform configuration status retrieved successfully",
  );
}

export const GET = apiWrapper(_handler_GET, {
  requireAdmin: true,
  userRateLimit: { bucket: "API_DEFAULT" },
});
