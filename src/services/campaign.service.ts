import { listCampaigns } from "./campaign/list";
import { createCampaign } from "./campaign/create";
import { getCampaignById, updateDraftCampaign, activateDraftCampaign, cancelCampaign } from "./campaign/manage";

export type { ListCampaignsParams } from "./campaign/types";
export { TierError } from "./campaign/types";

export class CampaignService {
static readonly listCampaigns = listCampaigns;
static readonly createCampaign = createCampaign;
static readonly getCampaignById = getCampaignById;
static readonly updateDraftCampaign = updateDraftCampaign;
static readonly activateDraftCampaign = activateDraftCampaign;
static readonly cancelCampaign = cancelCampaign;
}
