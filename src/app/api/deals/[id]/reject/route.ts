import { apiWrapper, ApiResponse, ValidatedNextRequest } from "@/lib/api-wrapper";
import { z } from "zod";
import { routeParamsSchema } from "@/lib/validations";
import { DealService } from "@/services/deal.service";

const rejectSchema = z
  .object({
    reason: z.string().trim().min(5).max(500).optional(),
  })
  .optional();

async function handleReject(req: ValidatedNextRequest) {
  const userId = req.session?.user?.id;
  if (!userId) {
    return ApiResponse.unauthorized();
  }

  const validParams = req.validParams as { id: string } | undefined;
  const dealId = validParams?.id;
  if (!dealId) {
    return ApiResponse.error("Invalid Deal ID", 400);
  }

  const validBody = req.validBody as { reason?: string } | undefined;
  const reason = validBody?.reason;

  await DealService.rejectPendingInvite(userId, dealId, reason);

  return ApiResponse.success(null, "Invite rejected successfully");
}

export const POST = apiWrapper(handleReject, {
  requireAuth: true,
  userRateLimit: {
    bucket: "DEAL_UPDATES",
    errorMessage: "Too many deal update requests",
  },
  validate: {
    params: routeParamsSchema,
    body: rejectSchema,
  },
});
