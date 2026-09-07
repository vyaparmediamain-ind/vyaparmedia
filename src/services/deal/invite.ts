import { logger } from "@/lib/logger";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { createActivityLog } from "@/lib/audit";
import { NotificationService } from "@/services/notification.service";
import { getDealTotalAmount } from "@/lib/utils";
import { DealWithRelations, invalidateDealCache, lockAndFetchDealForAction, releaseWalletHold } from "./helpers";

async function refundRejectPendingInvite(tx: Prisma.TransactionClient, deal: DealWithRelations) {
if (deal.brand?.userId && deal.reservedFromWallet) {
const refundAmount = getDealTotalAmount(deal);
const isCampaignPoolRefund = !deal.campaign.isDirectInvite;
await releaseWalletHold(
tx,
deal.brand.userId,
deal.id,
refundAmount,
`Refund for rejected invite: ${deal.campaign.title}`,
{
balanceImpact: !isCampaignPoolRefund,
source: isCampaignPoolRefund
? "campaign_pool_refund"
: "direct_invite_refund",
},
isCampaignPoolRefund ? "INCREMENT_PENDING" : "INCREMENT_BALANCE"
);
} else if (deal.campaign.isDirectInvite && deal.brand?.userId) {
await releaseWalletHold(
tx,
deal.brand.userId,
deal.id,
getDealTotalAmount(deal),
`Refund for rejected invite: ${deal.campaign.title}`,
undefined,
"SHIFT_PENDING_TO_BALANCE"
);
} else if (deal.brand?.userId) {
// Fallback case: reservedFromWallet = false and !isDirectInvite
await releaseWalletHold(
tx,
deal.brand.userId,
deal.id,
getDealTotalAmount(deal),
`Refund for rejected deal signature: ${deal.campaign.title}`,
{
balanceImpact: true,
source: "non_wallet_pool_refund",
},
"SHIFT_PENDING_TO_BALANCE"
);
}
}
async function cancelCampaignForDirectInvite(tx: Prisma.TransactionClient, deal: DealWithRelations) {
if (deal.campaign.isDirectInvite) {
await tx.campaign.update({
where: { id: deal.campaignId },
data: { status: "CANCELLED" },
});

if (deal.campaign.brandId && deal.campaign.status === "ACTIVE") {
await tx.brandProfile.updateMany({
where: {
id: deal.campaign.brandId,
activeCampaigns: { gt: 0 },
},
data: {
activeCampaigns: { decrement: 1 },
},
});
}
}
}




export async function rejectPendingInvite(
userId: string,
dealId: string,
reason?: string,
) {
const reasonText =
reason?.trim() || "Invite rejected by influencer before signing.";

const updatedDeal = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
// LOCK: Lock and fetch deal using helper
const deal = await lockAndFetchDealForAction(tx, dealId);

if (deal.influencer.userId !== userId) {
logger.warn("Unauthorized invite rejection attempt", { userId, dealId });
throw AppError.forbidden("Unauthorized");
}

if (deal.status !== "PENDING_SIGNATURE") {
throw AppError.badRequest("Only pending signature invites can be rejected");
}

await tx.deal.update({
where: { id: dealId },
data: {
status: "CANCELLED",
rejectionReason: reasonText,
},
});

await tx.application.updateMany({
where: {
campaignId: deal.campaignId,
influencerId: deal.influencerId,
status: "SELECTED",
},
data: {
status: "WITHDRAWN",
rejectionReason: reasonText,
},
});

  const campaignForRelease = await tx.campaign.findUnique({
    where: { id: deal.campaignId },
    select: { selectedInfluencers: true, reservedAmount: true, reservedTotalAmount: true },
  });
  const selectedCount = campaignForRelease?.selectedInfluencers ?? 0;
  const currentReservedAmount = campaignForRelease?.reservedAmount ?? 0;
  const currentReservedTotal = campaignForRelease?.reservedTotalAmount ?? 0;
  const dealTotal = getDealTotalAmount(deal);

  await tx.campaign.update({
    where: { id: deal.campaignId },
    data: {
      selectedInfluencers: { decrement: selectedCount > 0 ? 1 : 0 },
      reservedAmount: { decrement: Math.min(currentReservedAmount, deal.amount) },
      reservedTotalAmount: { decrement: Math.min(currentReservedTotal, dealTotal) },
    },
  });

await refundRejectPendingInvite(tx, deal);
await cancelCampaignForDirectInvite(tx, deal);

if (deal.brand?.userId) {
await NotificationService.createNotification({
userId: deal.brand.userId,
type: "deal_update",
title: "Invite rejected",
message: `${deal.influencer.displayName} rejected the invite for ${deal.campaign.title}.`,
data: { link: `/dashboard/deals/${dealId}` },
}, tx);
}

await createActivityLog({
userId,
action: "REJECT_DEAL_INVITE",
entityType: "Deal",
entityId: dealId,
metadata: {
campaignId: deal.campaignId,
directInvite: deal.campaign.isDirectInvite,
reason: reasonText,
},
}, tx);

return await tx.deal.findUniqueOrThrow({ where: { id: dealId } });
});

await invalidateDealCache(dealId);
return updatedDeal;
}

