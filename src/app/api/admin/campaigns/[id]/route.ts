import { z } from "zod";
import { apiWrapper, ApiResponse } from "@/lib/api-wrapper";
import { AdminCampaignService } from "@/services/admin-campaign.service";
import { getSecureClientIp } from "@/lib/ip";

const paramsSchema = z
  .object({
    id: z.string().min(1, "Campaign ID is required"),
  })
  .strict();

export const GET = apiWrapper(
  async (req, { params }) => {
    const rawParams = await params;
    const { id } = paramsSchema.parse(rawParams);
    const ipAddress = getSecureClientIp(req);

    const result = await AdminCampaignService.getAdminCampaignDetails(
      id,
      req.session?.user,
      ipAddress
    );

    return ApiResponse.success(result, "Admin campaign details retrieved successfully");
  },
  {
    requireAuth: true,
    requireAdmin: true,
    userRateLimit: { bucket: "API_DEFAULT" },
  }
);
