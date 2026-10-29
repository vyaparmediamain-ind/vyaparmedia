import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { NotificationService } from "@/services/notification.service";
import { invalidateDealCache, lockAndFetchDealForAction, validateShippingAddress } from "./helpers";
import { shiprocketWebhookPayloadSchema } from "@/lib/validations";
import { redis } from "@/lib/redis";

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

    // Keep creator's profile address synchronized for all future product deals
    const parsedAddr = shippingAddress as Record<string, string>;
    if (parsedAddr.line1 && parsedAddr.city && parsedAddr.state && parsedAddr.pinCode) {
      await tx.influencerProfile.updateMany({
        where: { userId },
        data: {
          address: parsedAddr.line1 + (parsedAddr.line2 ? `, ${parsedAddr.line2}` : ""),
          city: parsedAddr.city,
          state: parsedAddr.state,
          pinCode: parsedAddr.pinCode,
        },
      });
    }

if (deal.brand?.userId) {
await NotificationService.createNotification({
userId: deal.brand.userId,
type: "deal_update",
title: "Shipping address received",
message: `${deal.influencer?.displayName || "Influencer"} added a shipping address for "${deal.campaign.title}".`,
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
shippingAwbCode: trackingNumber,
shippingCourierName: carrier || null,
shippingStatus: "DISPATCHED",
dispatchedAt: new Date(),
productFulfillmentStatus: "DISPATCHED",
},
});

await NotificationService.createNotification({
userId: deal.influencer.userId,
type: "deal_update",
title: "Product dispatched",
message: `${deal.brand?.companyName || "Brand"} dispatched the product for "${deal.campaign.title}". Tracking: ${trackingNumber} (${carrier || "Carrier"}).`,
data: { link: `/dashboard/deals/${dealId}` },
}, tx);

return updated;
});

await invalidateDealCache(dealId);
return updatedDeal;
}


export async function createShiprocketShipment(
  userId: string,
  dealId: string,
  options?: {
    pickupLocation?: string | undefined;
    pickupPincode?: string | undefined;
    length?: number | undefined;
    breadth?: number | undefined;
    height?: number | undefined;
    weight?: number | undefined;
  },
) {
  // Step 1: Pre-fetch and validate without holding a long database lock
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      brand: {
        select: {
          id: true,
          userId: true,
          companyName: true,
          address: true,
          city: true,
          state: true,
          pinCode: true,
        },
      },
      influencer: {
        select: {
          id: true,
          userId: true,
          displayName: true,
          user: { select: { email: true } },
        },
      },
      campaign: { select: { id: true, title: true } },
    },
  });

  if (!deal) throw AppError.notFound("Deal not found");
  if (deal.brand?.userId !== userId) throw AppError.forbidden("Unauthorized: Only the brand can create shipments");
  if (!deal.requiresProduct) throw AppError.badRequest("This deal does not require product shipping");
  if (["CANCELLED", "COMPLETED", "DISPUTED", "PENDING_SIGNATURE", "PAYMENT_PENDING"].includes(deal.status)) {
    throw AppError.badRequest(`Cannot create shipment on a deal in ${deal.status} status`);
  }
  if (deal.productFulfillmentStatus !== "READY_TO_DISPATCH" || !deal.shippingAddress) {
    throw AppError.badRequest("Creator shipping address is required before creating a shipment");
  }

  const rawAddress = deal.shippingAddress as Record<string, unknown>;
  const shippingAddress = {
    fullName: String(rawAddress.fullName || deal.influencer?.displayName || "Creator"),
    phone: String(rawAddress.phone || ""),
    line1: String(rawAddress.line1 || ""),
    line2: rawAddress.line2 ? String(rawAddress.line2) : null,
    city: String(rawAddress.city || ""),
    state: String(rawAddress.state || ""),
    pinCode: String(rawAddress.pinCode || ""),
    country: rawAddress.country ? String(rawAddress.country) : "India",
  };

  // Pre-fetch brand wallet to check freeze status and balance before touching external APIs
  const brandWallet = deal.brand?.userId
    ? await prisma.wallet.findUnique({
        where: { userId: deal.brand.userId },
        select: { id: true, balance: true, isFrozen: true },
      })
    : null;

  if (brandWallet?.isFrozen) {
    throw AppError.badRequest("Brand wallet is unavailable or frozen. Cannot process shipping charge.");
  }

  // Step 2: Call Shiprocket API to create order, assign courier AWB, fetch label + rate
  // Default pickup address from brand profile if not explicitly specified
  const effectivePickupLocation =
    options?.pickupLocation ||
    deal.brand?.city ||
    "Primary Warehouse";
  const effectivePickupPincode =
    options?.pickupPincode ||
    deal.brand?.pinCode ||
    undefined;

  const { createCompleteShipment } = await import("@/lib/shiprocket");
  const shipment = await createCompleteShipment({
    dealId: deal.id,
    campaignTitle: deal.campaign.title,
    productName: deal.productName || "Campaign Product Sample",
    productValuePaise: deal.productValue || 10000,
    shippingAddress,
    creatorEmail: deal.influencer?.user?.email || undefined,
    pickupLocation: effectivePickupLocation,
    pickupPincode: effectivePickupPincode,
    length: options?.length,
    breadth: options?.breadth,
    height: options?.height,
    weight: options?.weight,
    walletBalancePaise: brandWallet?.balance,
  });

  const courierChargePaise = shipment.courierChargePaise || 0;

  // Step 3: Atomic transaction — validate balance, debit brand wallet, record shipment
  let updatedDeal;
  try {
    updatedDeal = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const lockedDeal = await lockAndFetchDealForAction(tx, dealId);
      if (lockedDeal.productFulfillmentStatus !== "READY_TO_DISPATCH") {
        throw AppError.badRequest("Deal status changed concurrently");
      }

      // --- Integrated Billing: Debit brand wallet for courier charge ---
      if (courierChargePaise > 0 && deal.brand?.userId) {
        const brandWallet = await tx.wallet.findUnique({
          where: { userId: deal.brand.userId },
          select: { id: true, balance: true, isFrozen: true },
        });

        if (!brandWallet || brandWallet.isFrozen) {
          throw AppError.badRequest("Brand wallet is unavailable or frozen. Cannot process shipping charge.");
        }
        if (brandWallet.balance < courierChargePaise) {
          const shortfallRupees = ((courierChargePaise - brandWallet.balance) / 100).toFixed(2);
          throw AppError.badRequest(
            `Insufficient wallet balance for shipping charge. Please deposit ₹${shortfallRupees} more.`,
          );
        }

        // Debit brand wallet
        await tx.wallet.update({
          where: { userId: deal.brand.userId },
          data: { balance: { decrement: courierChargePaise } },
        });

        // Record SHIPPING_CHARGE transaction on brand wallet
        await tx.transaction.create({
          data: {
            walletId: brandWallet.id,
            dealId: deal.id,
            type: "SHIPPING_CHARGE",
            amount: courierChargePaise,
            status: "COMPLETED",
            description: `Shiprocket courier charge for deal: ${deal.id} (AWB: ${shipment.awbCode})`,
            metadata: {
              awbCode: shipment.awbCode,
              courierName: shipment.courierName,
              orderId: shipment.orderId,
              chargeRupees: (courierChargePaise / 100).toFixed(2),
            },
          },
        });

        // Ensure platform treasury user exists before wallet mutation (prevents FK violation)
        await tx.user.upsert({
          where: { id: "PLATFORM_TREASURY" },
          update: {},
          create: {
            id: "PLATFORM_TREASURY",
            email: "treasury@platform.local",
            phone: "+919999999999",
            passwordHash: "sys:treasury_lockout_unusable",
            userType: "ADMIN",
            status: "ACTIVE",
            verificationLevel: "FULL",
            emailVerified: true,
            phoneVerified: true,
          },
        }).catch(() => {});

        // Credit platform treasury (double-entry bookkeeping)
        await tx.wallet.upsert({
          where: { userId: "PLATFORM_TREASURY" },
          create: { userId: "PLATFORM_TREASURY", balance: courierChargePaise, pendingBalance: 0 },
          update: { balance: { increment: courierChargePaise } },
        });
      }
      // ----------------------------------------------------------------

      const updated = await tx.deal.update({
        where: { id: dealId },
        data: {
          productFulfillmentStatus: "DISPATCHED",
          dispatchedAt: new Date(),
          dispatchTrackingNumber: shipment.awbCode,
          dispatchCarrier: shipment.courierName,
          shippingOrderId: shipment.orderId,
          shippingShipmentId: shipment.shipmentId,
          shippingAwbCode: shipment.awbCode,
          shippingCourierName: shipment.courierName,
          shippingLabelUrl: shipment.labelUrl || null,
          shippingManifestUrl: shipment.manifestUrl || null,
          shippingStatus: shipment.initialStatus,
          shippingTrackingHistory: shipment.trackingHistory as unknown as Prisma.InputJsonValue,
          shippingChargeAmount: courierChargePaise > 0 ? courierChargePaise : null,
        },
      });

      const chargeDisplay = courierChargePaise > 0
        ? ` Courier charge ₹${(courierChargePaise / 100).toFixed(2)} debited from your wallet.`
        : "";

      await NotificationService.createNotification({
        userId: deal.influencer.userId,
        type: "deal_update",
        title: "Product dispatched via Shiprocket",
        message: `${deal.brand?.companyName || "Brand"} shipped "${deal.campaign.title}" via ${shipment.courierName}. AWB: ${shipment.awbCode}.`,
        data: { link: `/dashboard/deals/${dealId}` },
      }, tx);

      if (deal.brand?.userId && courierChargePaise > 0) {
        await NotificationService.createNotification({
          userId: deal.brand.userId,
          type: "deal_update",
          title: "Shipping charge billed",
          message: `₹${(courierChargePaise / 100).toFixed(2)} courier charge for "${deal.campaign.title}" deducted from your wallet.${chargeDisplay}`,
          data: { link: `/dashboard/deals/${dealId}` },
        }, tx);
      }

      return updated;
    });
  } catch (txError) {
    // P6-MONEY-05 FIX: If DB transaction fails after Shiprocket shipment was created,
    // persist unbilled shipment to DeadLetterJob for automated ops reconciliation
    await prisma.deadLetterJob.create({
      data: {
        category: "TIME_CRITICAL",
        topic: "shipping.unbilled_shipment_reconcile",
        deduplicationId: `unbilled_shipment_${deal.id}_${shipment.awbCode}`,
        endpoint: `/api/cron/reconcile-shipments`,
        payload: {
          dealId: deal.id,
          brandUserId: deal.brand?.userId,
          awbCode: shipment.awbCode,
          courierName: shipment.courierName,
          orderId: shipment.orderId,
          shipmentId: shipment.shipmentId,
          courierChargePaise,
        },
        errorMessage: txError instanceof Error ? txError.message : "Database transaction failed after Shiprocket shipment creation",
        attempts: 1,
        maxRetries: 5,
        status: "FAILED",
      },
    }).catch((dlqErr) => {
      logger.error("Failed to enqueue DeadLetterJob for unbilled shipment", { dealId: deal.id, dlqErr });
    });

    throw txError;
  }

  await invalidateDealCache(dealId);
  return { deal: updatedDeal, shipment, courierChargePaise };
}


export async function trackDealShipping(userId: string, dealId: string) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      brand: { select: { id: true, userId: true, companyName: true } },
      influencer: { select: { id: true, userId: true, displayName: true } },
      campaign: { select: { id: true, title: true } },
    },
  });

  if (!deal) throw AppError.notFound("Deal not found");
  const isAuthorized =
    deal.brand?.userId === userId ||
    deal.influencer.userId === userId;

  if (!isAuthorized) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { userType: true } });
    if (user?.userType !== "ADMIN") throw AppError.forbidden("Unauthorized to track shipping for this deal");
  }

  const awbCode = deal.shippingAwbCode || deal.dispatchTrackingNumber;
  if (!awbCode) {
    throw AppError.badRequest("No tracking number or AWB assigned to this deal yet");
  }

  const { trackShipment } = await import("@/lib/shiprocket");
  const tracking = await trackShipment(awbCode, deal.shippingStatus || undefined);

  // If tracking shows DELIVERED, automatically advance product fulfillment
  const isNowDelivered = tracking.currentStatus.toUpperCase().includes("DELIVER");
  const wasNotReceived = deal.productFulfillmentStatus !== "RECEIVED";

  const updatedDeal = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const updateData: Prisma.DealUpdateInput = {
      shippingStatus: tracking.currentStatus,
      shippingTrackingHistory: tracking.scans as unknown as Prisma.InputJsonValue,
    };

    if (isNowDelivered && wasNotReceived) {
      updateData.productFulfillmentStatus = "RECEIVED";
      const deliveredDateObj = tracking.deliveredDate ? new Date(tracking.deliveredDate) : new Date();
      updateData.productReceivedAt = isNaN(deliveredDateObj.getTime()) ? new Date() : deliveredDateObj;
    }

    const updated = await tx.deal.update({
      where: { id: dealId },
      data: updateData,
    });

    if (isNowDelivered && wasNotReceived) {
      if (deal.brand?.userId) {
        await NotificationService.createNotification({
          userId: deal.brand.userId,
          type: "deal_update",
          title: "Product delivered to creator",
          message: `Shiprocket confirmed delivery of "${deal.productName || "Product"}" to ${deal.influencer?.displayName || "Influencer"}.`,
          data: { link: `/dashboard/deals/${dealId}` },
        }, tx);
      }
      if (deal.influencer?.userId) {
        await NotificationService.createNotification({
          userId: deal.influencer.userId,
          type: "deal_update",
          title: "Product delivered",
          message: `Your package for "${deal.campaign.title}" has been delivered by ${tracking.courierName || "courier"}.`,
          data: { link: `/dashboard/deals/${dealId}` },
        }, tx);
      }
    }

    return updated;
  });

  await invalidateDealCache(dealId);
  return { deal: updatedDeal, tracking };
}


export type CanonicalShippingStatus =
  | "PICKUP_SCHEDULED"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "RTO_INITIATED"
  | "RTO_DELIVERED"
  | "CANCELLED"
  | "LOST"
  | "DAMAGED"
  | "UNKNOWN";

/**
 * Maps raw carrier/Shiprocket status strings into standardized platform status codes.
 * Covers pickup, in-transit, delivery, return-to-origin (RTO), loss, and cancellation.
 */
export function mapShiprocketStatus(rawStatus: string): CanonicalShippingStatus {
  const s = rawStatus.trim().toUpperCase().replace(/[\s\-_]+/g, " ");

  if (s.includes("DELIVERED") && !s.includes("RTO")) return "DELIVERED";
  if (s.includes("RTO DELIVERED") || s.includes("RTO RECEIVED") || s.includes("RETURNED TO ORIGIN")) return "RTO_DELIVERED";
  if (s.includes("RTO") || s.includes("RETURN TO ORIGIN") || s.includes("UNDELIVERED")) return "RTO_INITIATED";
  if (s.includes("OUT FOR DELIVERY") || s.includes("OUT FOR PICKUP")) return "OUT_FOR_DELIVERY";
  if (s.includes("IN TRANSIT") || s.includes("TRANSIT") || s.includes("SHIPPED") || s.includes("DISPATCHED")) return "IN_TRANSIT";
  if (s.includes("PICKUP SCHEDULED") || s.includes("PICKED UP") || s.includes("MANIFEST")) return "PICKUP_SCHEDULED";
  if (s.includes("CANCELLED") || s.includes("CANCELED")) return "CANCELLED";
  if (s.includes("LOST") || s.includes("MISSING")) return "LOST";
  if (s.includes("DAMAGED") || s.includes("DESTROYED")) return "DAMAGED";

  return "UNKNOWN";
}

export async function handleShiprocketWebhook(rawPayload: unknown) {
  const parseResult = shiprocketWebhookPayloadSchema.safeParse(rawPayload);
  if (!parseResult.success) {
    const errorDetails = parseResult.error.issues.map((i) => i.message).join("; ");
    throw AppError.badRequest(`Invalid Shiprocket webhook payload: ${errorDetails}`);
  }

  const payload = parseResult.data;
  const awb = (payload.awb || payload.awb_code || payload.tracking_number || "").trim();
  const orderId = (payload.order_id || "").trim();
  const rawStatus = (payload.current_status || payload.status || "").trim().toUpperCase();
  const status = rawStatus.slice(0, 50);

  // Replay Safety / Deduplication:
  // Use Redis SET NX to short-circuit repeated webhooks with identical timestamp/status
  const timestamp = String(payload.scans?.[0] || payload.shipment_track_activities?.[0] || "").slice(0, 100);
  const dedupKey = `shiprocket:webhook:${awb || orderId}:${rawStatus}:${timestamp}`;
  try {
    const isNew = await redis.set(dedupKey, "1", "EX", 86400, "NX");
    if (!isNew) {
      logger.info("[Shiprocket Webhook] Duplicate webhook received, skipping replay", {
        awb,
        orderId,
        status: rawStatus,
      });
      return { matched: true, dealId: orderId || awb, status: rawStatus, duplicate: true };
    }
  } catch (redisErr) {
    logger.warn("[Shiprocket Webhook] Redis dedup check failed, failing open", { error: redisErr });
  }

  // Find matching deal
  const deal = await prisma.deal.findFirst({
    where: {
      OR: [
        ...(awb ? [{ shippingAwbCode: awb }, { dispatchTrackingNumber: awb }] : []),
        ...(orderId ? [{ shippingOrderId: orderId }] : []),
      ],
    },
    include: {
      brand: { select: { userId: true, companyName: true } },
      influencer: { select: { userId: true, displayName: true } },
      campaign: { select: { title: true } },
    },
  });

  if (!deal) {
    return { matched: false, message: "No deal found matching AWB / Order ID" };
  }

  const canonicalStatus = mapShiprocketStatus(rawStatus);
  if (canonicalStatus === "UNKNOWN") {
    logger.warn("[Shiprocket Webhook] Unmapped carrier status received, preserving status in deal", {
      rawStatus,
      awb,
      orderId,
      dealId: deal.id,
    });
  }

  // Out-of-Order Event Protection:
  // If deal is already delivered/received, ignore downgrades to in-transit or pickup-scheduled
  const isAlreadyReceived = deal.productFulfillmentStatus === "RECEIVED";
  const isDelivered = canonicalStatus === "DELIVERED";
  const shouldSkipStatusUpdate =
    isAlreadyReceived && (canonicalStatus === "IN_TRANSIT" || canonicalStatus === "PICKUP_SCHEDULED");

  // Safely validate and sanitize scan history checkpoints
  const incomingScans = Array.isArray(payload.scans)
    ? payload.scans
    : Array.isArray(payload.shipment_track_activities)
      ? payload.shipment_track_activities
      : [];

  const sanitizedScans = incomingScans.slice(0, 50).map((s) => {
    if (typeof s === "string") {
      return {
        date: new Date().toISOString(),
        status: status || "IN_TRANSIT",
        activity: s.slice(0, 255),
        location: "In Transit",
      };
    }
    const item = s as Record<string, unknown>;
    return {
      date: String(item.date || item.time || new Date().toISOString()).slice(0, 100),
      status: String(item.status || item.activity || "IN_TRANSIT").slice(0, 100),
      activity: String(item.activity || item["sr-status-label"] || item.status || "").slice(0, 255),
      location: String(item.location || item.city || "").slice(0, 255),
    };
  });

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const updateData: Prisma.DealUpdateInput = {
      ...(shouldSkipStatusUpdate ? {} : { shippingStatus: status || deal.shippingStatus }),
      ...(sanitizedScans.length > 0 ? { shippingTrackingHistory: sanitizedScans as unknown as Prisma.InputJsonValue } : {}),
    };

    if (isDelivered && !isAlreadyReceived) {
      updateData.productFulfillmentStatus = "RECEIVED";
      updateData.productReceivedAt = new Date();
    }

    await tx.deal.update({
      where: { id: deal.id },
      data: updateData,
    });

    // 1. Delivery Successful Notifications
    if (isDelivered && !isAlreadyReceived) {
      if (deal.brand?.userId) {
        await NotificationService.createNotification({
          userId: deal.brand.userId,
          type: "deal_update",
          title: "Shiprocket Delivery Confirmed",
          message: `Product for "${deal.campaign.title}" was successfully delivered to creator.`,
          data: { link: `/dashboard/deals/${deal.id}` },
        }, tx);
      }
      await NotificationService.createNotification({
        userId: deal.influencer.userId,
        type: "deal_update",
        title: "Product Delivered",
        message: `Shiprocket courier confirmed package delivery for "${deal.campaign.title}".`,
        data: { link: `/dashboard/deals/${deal.id}` },
      }, tx);
    }

    // 2. Failure Ops: RTO / Return Notifications
    if (canonicalStatus === "RTO_INITIATED") {
      if (deal.brand?.userId) {
        await NotificationService.createNotification({
          userId: deal.brand.userId,
          type: "deal_update",
          title: "Shipment Return Initiated (RTO)",
          message: `Delivery attempt failed for "${deal.campaign.title}". The package is returning to your pickup warehouse.`,
          data: { link: `/dashboard/deals/${deal.id}` },
        }, tx);
      }
      await NotificationService.createNotification({
        userId: deal.influencer.userId,
        type: "deal_update",
        title: "Product Delivery Failed",
        message: `Courier could not deliver sample package for "${deal.campaign.title}". Package is returning to sender.`,
        data: { link: `/dashboard/deals/${deal.id}` },
      }, tx);
    }

    // 3. Failure Ops: Lost or Damaged in Transit
    if (canonicalStatus === "LOST" || canonicalStatus === "DAMAGED") {
      const alertTitle = canonicalStatus === "LOST" ? "Shipment Marked Lost" : "Shipment Reported Damaged";
      if (deal.brand?.userId) {
        await NotificationService.createNotification({
          userId: deal.brand.userId,
          type: "deal_update",
          title: alertTitle,
          message: `Logistics partner reported shipment for "${deal.campaign.title}" as ${canonicalStatus.toLowerCase()}. Please contact support to initiate carrier insurance/dispute.`,
          data: { link: `/dashboard/deals/${deal.id}` },
        }, tx);
      }
      await NotificationService.createNotification({
        userId: deal.influencer.userId,
        type: "deal_update",
        title: alertTitle,
        message: `Your sample shipment for "${deal.campaign.title}" was reported ${canonicalStatus.toLowerCase()} by courier. Our team is resolving this.`,
        data: { link: `/dashboard/deals/${deal.id}` },
      }, tx);
    }
  });

  await invalidateDealCache(deal.id);
  return { matched: true, dealId: deal.id, status };
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
shippingStatus: "DELIVERED",
},
});

if (deal.brand?.userId) {
await NotificationService.createNotification({
userId: deal.brand.userId,
type: "deal_update",
title: "Product received",
message: `${deal.influencer?.displayName || "Influencer"} confirmed product receipt for "${deal.campaign.title}".`,
data: { link: `/dashboard/deals/${dealId}` },
}, tx);
}

return updated;
});

await invalidateDealCache(dealId);
return updatedDeal;
}

