import { NextRequest } from "next/server";
import { apiWrapper, ApiResponse, type AuthenticatedRequest } from "@/lib/api-wrapper";
import { requireActiveAdmin } from "@/lib/admin-auth";
import { ADMIN_GUIDES } from "@/content/guides/admin";
import { GuideSchema } from "@/lib/guides/schema";
import { resolveGuide } from "@/lib/guides/tokens";
import { RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";

const RESOLVED_ADMIN_GUIDES = ADMIN_GUIDES.map((guide) => {
  const parsed = GuideSchema.parse(guide);
  return resolveGuide(parsed);
});

async function _handler(req: NextRequest) {
  const session = (req as AuthenticatedRequest).session;
  await requireActiveAdmin(session.user);

  return ApiResponse.success({
    guides: RESOLVED_ADMIN_GUIDES,
  });
}

export const GET = apiWrapper(_handler, {
  requireAdmin: true,
  rateLimit: RATE_LIMIT_CONFIGS.API_DEFAULT,
  userRateLimit: { bucket: "API_DEFAULT" },
});
