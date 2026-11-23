import { apiWrapper, ApiResponse } from "@/lib/api-wrapper";
import prisma from "@/lib/db";

async function _handler_GET() {
  const [total, active, insightsActive, unknownScope, personalAccount, needsReconnect] = await Promise.all([
    prisma.oAuthAccount.count({
      where: { provider: "instagram" },
    }),
    prisma.oAuthAccount.count({
      where: {
        provider: "instagram",
        accessToken: { not: null },
        scope: { not: "NEEDS_RECONNECT" },
      },
    }),
    prisma.oAuthAccount.count({
      where: {
        provider: "instagram",
        accessToken: { not: null },
        scope: { not: "NEEDS_RECONNECT" },
        grantedScopes: { has: "instagram_business_manage_insights" },
      },
    }),
    prisma.oAuthAccount.count({
      where: {
        provider: "instagram",
        scope: "UNKNOWN",
      },
    }),
    prisma.oAuthAccount.count({
      where: {
        provider: "instagram",
        scope: "PERSONAL_ACCOUNT",
      },
    }),
    prisma.oAuthAccount.count({
      where: {
        provider: "instagram",
        scope: "NEEDS_RECONNECT",
      },
    }),
  ]);

  const insightsMissing = Math.max(0, active - insightsActive - unknownScope - personalAccount);

  return ApiResponse.success(
    {
      total,
      active,
      insightsActive,
      insightsMissing,
      unknownScope,
      personalAccount,
      needsReconnect,
    },
    "Social insights connection statistics retrieved",
  );
}

export const GET = apiWrapper(_handler_GET, {
  requireAdmin: true,
  userRateLimit: { bucket: "API_DEFAULT" },
});
