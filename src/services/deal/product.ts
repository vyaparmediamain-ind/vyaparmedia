import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { NotificationService } from "@/services/notification.service";
import { invalidateDealCache, lockAndFetchDealForAction, validateShippingAddress } from "./helpers";

export async function submitShippingAddress(
userId: string,
dealId: string,
address: unknown,
) {
const shippingAddress = validateShippingAddress(address);

const updatedDeal = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
const deal = await lockAndFetchDealForAction(tx, dealId);

if (deal.influencer.userId !== userId) throw AppError.forbidden("Unauthorized");
if (!deal.requiresProduct) throw AppError.badRequest("This deal does not require product shipping");
// Guard: no product actions on terminal or disputed deals
if (["CANCELLED", "COMPLETED", "DISPUTED"].includes(deal.status)) {
  throw AppError.badRequest(`Cannot submit shipping address on a deal in ${deal.status} status`);
}
if (!["ADDRESS_PENDING", "READY_TO_DISPATCH"].includes(deal.productFulfillmentStatus)) {
throw AppError.badRequest("Shipping address cannot be changed after dispatch");
}

    const updated = await tx.deal.update({
      where: { id: dealId },
      data: {
        shippingAddress: {
          ...(shippingAddress as Record<string, unknown>),
          submittedAt: new Date().toISOString(),
        },
        productFulfillmentStatus: "READY_TO_DISPATCH",
      },
    });

if (deal.brand?.userId) {
await NotificationService.createNotification({
userId: deal.brand.userId,
type: "deal_update",
title: "Shipping address received",
message: `${deal.influencer.displayName || "Influencer"} added a shipping address for "${deal.campaign.title}".`,
data: { link: `/dashboard/deals/${dealId}` },
}, tx);
}

return updated;
});

await invalidateDealCache(dealId);
return updatedDeal;
}


export async function confirmProductDispatch(
userId: string,
dealId: string,
data: { trackingNumber: string; carrier?: string },
) {
const trackingNumber = data.trackingNumber.trim();
const carrier = data.carrier?.trim();
if (!trackingNumber || trackingNumber.length > 120) {
throw AppError.badRequest("Tracking number is required");
}

const updatedDeal = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
const deal = await lockAndFetchDealForAction(tx, dealId);

if (deal.brand?.userId !== userId) throw AppError.forbidden("Unauthorized");
if (!deal.requiresProduct) throw AppError.badRequest("This deal does not require product shipping");
// Guard: dispatch only permitted when deal is active and payment held
if (["CANCELLED", "COMPLETED", "DISPUTED", "PENDING_SIGNATURE", "PAYMENT_PENDING"].includes(deal.status)) {
  throw AppError.badRequest(`Cannot dispatch product on a deal in ${deal.status} status`);
}
if (deal.productFulfillmentStatus !== "READY_TO_DISPATCH" || !deal.shippingAddress) {
throw AppError.badRequest("Influencer shipping address is required before dispatch");
}

const updated = await tx.deal.update({
where: { id: dealId },
data: {
dispatchTrackingNumber: trackingNumber,
dispatchCarrier: carrier || null,
dispatchedAt: new Date(),
productFulfillmentStatus: "DISPATCHED",
},
});

await NotificationService.createNotification({
userId: deal.influencer.userId,
type: "deal_update",
title: "Product dispatched",
message: `${deal.brand?.companyName || "Brand"} dispatched the product for "${deal.campaign.title}". Please confirm once received.`,
data: { link: `/dashboard/deals/${dealId}` },
}, tx);

return updated;
});

await invalidateDealCache(dealId);
return updatedDeal;
}


export async function confirmProductReceived(userId: string, dealId: string) {
const updatedDeal = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
const deal = await lockAndFetchDealForAction(tx, dealId);

if (deal.influencer.userId !== userId) throw AppError.forbidden("Unauthorized");
if (!deal.requiresProduct) throw AppError.badRequest("This deal does not require product shipping");
// Guard: receiving not valid on terminal deals
if (["CANCELLED", "COMPLETED", "DISPUTED"].includes(deal.status)) {
  throw AppError.badRequest(`Cannot confirm receipt on a deal in ${deal.status} status`);
}
if (deal.productFulfillmentStatus !== "DISPATCHED") {
throw AppError.badRequest("Product must be dispatched before it can be marked received");
}

const updated = await tx.deal.update({
where: { id: dealId },
data: {
productFulfillmentStatus: "RECEIVED",
productReceivedAt: new Date(),
},
});

if (deal.brand?.userId) {
await NotificationService.createNotification({
userId: deal.brand.userId,
type: "deal_update",
title: "Product received",
message: `${deal.influencer.displayName || "Influencer"} confirmed product receipt for "${deal.campaign.title}".`,
data: { link: `/dashboard/deals/${dealId}` },
}, tx);
}

return updated;
});

await invalidateDealCache(dealId);
return updatedDeal;
}

