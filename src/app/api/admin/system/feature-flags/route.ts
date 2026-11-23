import { apiWrapper, ValidatedNextRequest, ApiResponse } from "@/lib/api-wrapper";
import { FeatureFlagService } from "@/services/feature-flag.service";
import { FEATURE_FLAGS, type FeatureFlagKey } from "@/lib/feature-flags";
import { getSecureClientIp } from "@/lib/ip";
import { z } from "zod";

const updateFeatureFlagSchema = z.object({
  key: z.enum([
    FEATURE_FLAGS.CREATOR_METRICS,
    FEATURE_FLAGS.FAIR_PRICE,
    FEATURE_FLAGS.FAIR_PRICE_PUBLIC_BADGE,
    FEATURE_FLAGS.INSTAGRAM_INSIGHTS,
    FEATURE_FLAGS.TELEMETRY_ANONYMOUS,
    FEATURE_FLAGS.TELEMETRY_IDENTIFIED,
    FEATURE_FLAGS.CAMPAIGN_HUB,
    FEATURE_FLAGS.BRANDED_REPORTS,
    FEATURE_FLAGS.REPORT_VERIFICATION,
  ]),
  enabled: z.boolean().optional(),
  rolloutPercent: z.number().int().min(0).max(100).optional(),
  allowRoles: z.array(z.string().trim().toUpperCase()).optional(),
  description: z.string().trim().max(500).optional(),
}).strict();

type UpdateFeatureFlagBody = z.infer<typeof updateFeatureFlagSchema>;

async function _handler_GET() {
  const flags = await FeatureFlagService.getAllFlags();
  return ApiResponse.success(flags, "Feature flags retrieved successfully");
}

async function _handler_PATCH(req: ValidatedNextRequest) {
  const session = req.session;
  const adminUserId = session?.user?.id;

  if (!adminUserId) {
    return ApiResponse.unauthorized();
  }

  const data = req.validBody as UpdateFeatureFlagBody | undefined;
  if (!data) {
    return ApiResponse.error("Request body validation failed", 400);
  }

  const ipAddress = getSecureClientIp(req);

  const updated = await FeatureFlagService.updateFlag(
    data.key as FeatureFlagKey,
    {
      enabled: data.enabled,
      rolloutPercent: data.rolloutPercent,
      allowRoles: data.allowRoles,
      description: data.description,
    },
    adminUserId,
    ipAddress,
  );

  return ApiResponse.success(
    updated,
    `Feature flag '${data.key}' updated successfully.`,
  );
}

export const GET = apiWrapper(_handler_GET, {
  requireAdmin: true,
  userRateLimit: { bucket: "API_DEFAULT" },
});

export const PATCH = apiWrapper(_handler_PATCH, {
  requireAdmin: true,
  userRateLimit: { bucket: "API_DEFAULT" },
  maxBodySize: 32 * 1024,
  validate: {
    body: updateFeatureFlagSchema,
  },
});
