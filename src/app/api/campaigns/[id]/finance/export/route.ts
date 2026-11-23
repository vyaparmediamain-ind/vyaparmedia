import { NextRequest } from "next/server";
import { apiWrapper, type AuthenticatedRequest } from "@/lib/api-wrapper";
import { CampaignFinanceService } from "@/services/campaign-finance.service";
import { csvResponse } from "@/lib/csv-export";
import { RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { resolveActor } from "@/lib/authz";

async function _handler(
  req: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> }
) {
  const session = (req as AuthenticatedRequest).session;
  const actor = await resolveActor(session);
  const params = await context.params;
  const campaignId = params.id as string;
  const { searchParams } = new URL(req.url);
  const fy = searchParams.get("fy");

  const csv = await CampaignFinanceService.exportCampaignFinanceCsv(
    campaignId,
    actor,
    fy
  );

  const filename = `campaign-${campaignId}-finance-${fy || "all"}.csv`;
  return csvResponse(csv, filename);
}

export const GET = apiWrapper(_handler, {
  requireAuth: true,
  rateLimit: RATE_LIMIT_CONFIGS.REPORTS,
  userRateLimit: { bucket: "REPORTS" },
});
