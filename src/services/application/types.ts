import { CampaignStatus } from "@prisma/client";

export interface CampaignValidateResult {
id: string;
status: CampaignStatus;
minFollowers: number;
maxFollowers: number | null;
applicationDeadline: Date | null;
perInfluencerBudget: number | null;
maxInfluencers: number | null;
selectedInfluencers: number;
requiresProduct: boolean;
totalBudget: number;
productValue: number | null;
}

export function resolveApplicationDealAmount(
proposedRate: number | null | undefined,
perInfluencerBudget: number | null | undefined,
) {
const proposed = Math.max(0, proposedRate || 0);
const cap = Math.max(0, perInfluencerBudget || 0);

return proposed > 0 ? proposed : cap;
}

