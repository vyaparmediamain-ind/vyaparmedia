import { NextRequest, NextResponse } from "next/server";
import { apiWrapper } from "@/lib/api-wrapper";
import { validateCronSecret } from "../guard";
import prisma from "@/lib/db";
import { DisputeType } from "@prisma/client";
import { NotificationService } from "@/services/notification.service";
import { logger } from "@/lib/logger";
import { acquireDistributedLock, releaseDistributedLock } from "@/lib/lock";

/**
* Stale Product Fulfillment Scanner Daily Cron
*
* Scans deals stuck in READY_TO_DISPATCH or DISPATCHED state.
*
* Thresholds:
* 7+ days reminder notification to both parties
* 14+ days auto-escalate: create a PRODUCT_NOT_RECEIVED dispute and
* notify both parties + all admins
*
* Safety: only touches deals where status = PAYMENT_HELD (escrow active)
* and requiresProduct = true. Deals with an existing open dispute are skipped.
*
* Schedule: 0 10 * * * (daily at 10:00 AM UTC / 3:30 PM IST)
*/

const REMINDER_DAYS = 7;
const ESCALATION_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 200;
const LOCK_KEY = "cron:stale_fulfillment:lock";
const LOCK_TTL_SECS = 300;

interface StaleDeal {
  id: string;
  productFulfillmentStatus: string;
  updatedAt: Date;
  dispatchedAt: Date | null;
  shippingAddress: unknown;
  campaign: { title: string };
  influencer: { userId: string; displayName: string | null };
  brand: { userId: string; companyName: string | null } | null;
}

function getStaleDays(deal: StaleDeal): number {
  // For DISPATCHED, measure from when it was dispatched.
  // For READY_TO_DISPATCH, measure from when address was submitted.
  if (deal.productFulfillmentStatus === "DISPATCHED" && deal.dispatchedAt) {
    return Math.floor((Date.now() - new Date(deal.dispatchedAt).getTime()) / MS_PER_DAY);
  }
  const shippingAddressObj = deal.shippingAddress as Record<string, unknown> | null;
  const anchor = shippingAddressObj?.submittedAt
    ? new Date(shippingAddressObj.submittedAt as string)
    : deal.updatedAt;
  return Math.floor((Date.now() - anchor.getTime()) / MS_PER_DAY);
}

async function hasOpenDispute(dealId: string): Promise<boolean> {
  const existing = await prisma.dispute.findFirst({
    where: {
      dealId,
      // M13 FIX: TIER3_ARBITRATION was missing — deals in arbitration were being re-escalated
      status: { notIn: ["RESOLVED", "CLOSED"] },
    },
    select: { id: true },
  });
  return existing !== null;
}

function addDispatchOverdueNotifications(
deal: StaleDeal,
staleDays: number,
campaignTitle: string,
influencerName: string,
brandName: string,
dealLink: string,
notifications: Parameters<typeof NotificationService.createNotifications>[0]
) {
const brandUserId = deal.brand?.userId;
if (brandUserId) {
const s = staleDays === 1 ? "" : "s";
notifications.push({
userId: brandUserId,
type: "deal_update",
title: ` Product dispatch overdue ${staleDays} days`,
message: `The deal "${campaignTitle}" with ${influencerName} is waiting for you to dispatch the product. It has been ${staleDays} day${s} since the shipping address was submitted. Please dispatch soon to avoid escalation.`,
data: { link: dealLink, dealId: deal.id, staleDays, type: "stale_fulfillment_reminder" },
});
}
const influencerUserId = deal.influencer?.userId;
if (influencerUserId) {
const s = staleDays === 1 ? "" : "s";
notifications.push({
userId: influencerUserId,
type: "deal_update",
title: ` Awaiting product dispatch ${staleDays} days`,
message: `The brand ${brandName} has not yet dispatched the product for "${campaignTitle}". It has been ${staleDays} day${s}. You may raise a dispute if needed.`,
data: { link: dealLink, dealId: deal.id, staleDays, type: "stale_fulfillment_reminder" },
});
}
}

function addTransitOverdueNotifications(
deal: StaleDeal,
staleDays: number,
campaignTitle: string,
influencerName: string,
brandName: string,
dealLink: string,
notifications: Parameters<typeof NotificationService.createNotifications>[0]
) {
const influencerUserId = deal.influencer?.userId;
if (influencerUserId) {
const s = staleDays === 1 ? "" : "s";
notifications.push({
userId: influencerUserId,
type: "deal_update",
title: ` Please confirm product received ${staleDays} days in transit`,
message: `The product for "${campaignTitle}" has been marked as dispatched by ${brandName} and has been in transit for ${staleDays} day${s}. Please confirm receipt once you have the product.`,
data: { link: dealLink, dealId: deal.id, staleDays, type: "stale_fulfillment_reminder" },
});
}
const brandUserId = deal.brand?.userId;
if (brandUserId) {
const s = staleDays === 1 ? "" : "s";
notifications.push({
userId: brandUserId,
type: "deal_update",
title: ` Product receipt unconfirmed ${staleDays} days`,
message: `${influencerName} has not yet confirmed receipt of the product for "${campaignTitle}". It has been ${staleDays} day${s} since dispatch. Please follow up.`,
data: { link: dealLink, dealId: deal.id, staleDays, type: "stale_fulfillment_reminder" },
});
}
}

async function sendReminderNotifications(deal: StaleDeal, staleDays: number) {
  const campaignTitle = deal.campaign.title;
  const influencerName = deal.influencer.displayName || "Influencer";
  const brandName = deal.brand?.companyName || "Brand";
  const dealLink = `/dashboard/deals/${deal.id}`;

  // M12 FIX: Prevent duplicate reminder notifications on the same day for a deal.
  // Check if a reminder notification was already sent to either participant in the last 22 hours.
  const userIds = [deal.brand?.userId, deal.influencer.userId].filter(Boolean) as string[];
  const recentNotifications = await prisma.notification.findMany({
    where: {
      userId: { in: userIds },
      type: "deal_update",
      createdAt: { gte: new Date(Date.now() - 22 * 60 * 60 * 1000) },
    },
    select: { data: true },
    take: 20,
  });

  const alreadySent = recentNotifications.some((n) => {
    const payload = n.data as Record<string, unknown> | null;
    return payload?.dealId === deal.id && payload?.type === "stale_fulfillment_reminder";
  });

  if (alreadySent) {
    logger.info("STALE_FULFILLMENT: Skipping reminder notification as one was recently sent", { dealId: deal.id });
    return;
  }

  const notifications: Parameters<typeof NotificationService.createNotifications>[0] = [];

  if (deal.productFulfillmentStatus === "READY_TO_DISPATCH") {
    addDispatchOverdueNotifications(deal, staleDays, campaignTitle, influencerName, brandName, dealLink, notifications);
  } else {
    addTransitOverdueNotifications(deal, staleDays, campaignTitle, influencerName, brandName, dealLink, notifications);
  }

  if (notifications.length > 0) {
    await NotificationService.createNotifications(notifications);
  }
}

async function autoEscalateToDispute(
  deal: StaleDeal,
  staleDays: number,
  firstAdminId: string | null,
  allAdminIds: string[]
) {
  const campaignTitle = deal.campaign.title;
  const dealLink = `/dashboard/deals/${deal.id}`;

  try {
    if (!firstAdminId) {
      logger.error("STALE_FULFILLMENT: Cannot auto-escalate no admin users found", {
        dealId: deal.id,
      });
      return false;
    }

    // Create dispute inside a transaction
    await prisma.$transaction(async (tx) => {
      // Check once more inside transaction that there's no open dispute
      const existingDispute = await tx.dispute.findFirst({
        where: {
          dealId: deal.id,
          status: { notIn: ["RESOLVED", "CLOSED"] }, // M13 FIX
        },
        select: { id: true },
      });
      if (existingDispute) return;

      // Flip the deal status to DISPUTED
      await tx.deal.update({
        where: { id: deal.id },
        data: { status: "DISPUTED" },
      });

      // Create the dispute record
      await tx.dispute.create({
        data: {
          dealId: deal.id,
          raisedByUserId: firstAdminId,
          type: "TERMS_VIOLATION" as DisputeType,
          status: "TIER1_AUTO",
          description:
            `Auto-escalated by system after ${staleDays} days with no fulfillment progress. ` +
            `Fulfillment status was "${deal.productFulfillmentStatus}" at time of escalation. ` +
            `Admin review required to resolve.`,
          dealStatusAtCreation: "PAYMENT_HELD",
        },
      });

      // Notify both parties
      const escalationNotifications: Parameters<
        typeof NotificationService.createNotifications
      >[0] = [];

      if (deal.brand?.userId) {
        escalationNotifications.push({
          userId: deal.brand.userId,
          type: "dispute",
          title: ` Deal auto-escalated to dispute`,
          message: `The deal "${campaignTitle}" has been automatically escalated to a dispute after ${staleDays} days without fulfillment progress. An admin will review and resolve this.`,
          data: { link: dealLink, dealId: deal.id, staleDays, type: "stale_fulfillment_escalation" },
        });
      }

      if (deal.influencer?.userId) {
        escalationNotifications.push({
          userId: deal.influencer.userId,
          type: "dispute",
          title: ` Deal auto-escalated to dispute`,
          message: `The deal "${campaignTitle}" has been automatically escalated to a dispute after ${staleDays} days without fulfillment progress. An admin will review and resolve this.`,
          data: { link: dealLink, dealId: deal.id, staleDays, type: "stale_fulfillment_escalation" },
        });
      }

      if (escalationNotifications.length > 0) {
        await NotificationService.createNotifications(escalationNotifications, tx);
      }
    });

    // Notify all admins about the escalation
    if (allAdminIds.length > 0) {
      await NotificationService.createNotifications(
        allAdminIds.map((adminId) => ({
          userId: adminId,
          type: "admin_alert" as const,
          title: ` System auto-escalated stale deal`,
          message: `Deal ${deal.id} ("${campaignTitle}") was stuck in "${deal.productFulfillmentStatus}" for ${staleDays} days and has been auto-escalated to a TIER1_AUTO dispute. Manual review required.`,
          data: { link: dealLink, dealId: deal.id, staleDays, type: "stale_fulfillment_escalation" },
        })),
      );
    }

    return true;
  } catch (err) {
    logger.error("STALE_FULFILLMENT: Auto-escalation failed", { dealId: deal.id, error: err });
    return false;
  }
}

interface ProcessDealResult {
  reminded: boolean;
  escalated: boolean;
  skipped: boolean;
}

async function processSingleStaleDeal(
  deal: StaleDeal,
  firstAdminId: string | null,
  allAdminIds: string[]
): Promise<ProcessDealResult> {
  const staleDays = getStaleDays(deal);

  if (staleDays < REMINDER_DAYS) {
    return { reminded: false, escalated: false, skipped: true };
  }

  // Check for existing open dispute skip if already in dispute
  const alreadyDisputed = await hasOpenDispute(deal.id);
  if (alreadyDisputed) {
    return { reminded: false, escalated: false, skipped: true };
  }

  if (staleDays >= ESCALATION_DAYS) {
    const escalated_ = await autoEscalateToDispute(deal, staleDays, firstAdminId, allAdminIds);
    if (escalated_) {
      logger.info("STALE_FULFILLMENT: Auto-escalated deal", {
        dealId: deal.id,
        staleDays,
        status: deal.productFulfillmentStatus,
      });
      return { reminded: false, escalated: true, skipped: false };
    } else {
      return { reminded: false, escalated: false, skipped: true };
    }
  } else {
    // 7-13 days: send reminder
    await sendReminderNotifications(deal, staleDays);
    logger.info("STALE_FULFILLMENT: Sent reminder for stale deal", {
      dealId: deal.id,
      staleDays,
      status: deal.productFulfillmentStatus,
    });
    return { reminded: true, escalated: false, skipped: false };
  }
}

async function scanStaleFulfillmentDeals(): Promise<{
  scanned: number;
  reminded: number;
  escalated: number;
  skipped: number;
}> {
  let scanned = 0;
  let reminded = 0;
  let escalated = 0;
  let skipped = 0;
  let cursor: string | undefined = undefined;
  let hasMore = true;

  // M14 FIX: Pre-fetch admin details to avoid N+1 queries during deal processing loop
  const admins = await prisma.user.findMany({
    where: { userType: "ADMIN", status: "ACTIVE" },
    select: { id: true },
    take: 20,
  });
  const allAdminIds = admins.map((a) => a.id);
  const firstAdminId = allAdminIds[0] || null;

  while (hasMore) {
    const batch = (await prisma.deal.findMany({
      where: {
        requiresProduct: true,
        productFulfillmentStatus: { in: ["READY_TO_DISPATCH", "DISPATCHED"] },
        status: "PAYMENT_HELD",
        deletedAt: null,
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      select: {
        id: true,
        productFulfillmentStatus: true,
        updatedAt: true,
        dispatchedAt: true,
        shippingAddress: true,
        campaign: { select: { title: true } },
        influencer: { select: { userId: true, displayName: true } },
        brand: { select: { userId: true, companyName: true } },
      },
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
    })) as StaleDeal[];

    scanned += batch.length;
    hasMore = batch.length === BATCH_SIZE;
    const lastItem = batch.at(-1);
    if (lastItem) {
      cursor = lastItem.id;
    }

    for (const deal of batch) {
      const res = await processSingleStaleDeal(deal, firstAdminId, allAdminIds);
      if (res.reminded) {
        reminded++;
      } else if (res.escalated) {
        escalated++;
      } else if (res.skipped) {
        skipped++;
      }
    }
  }

  return { scanned, reminded, escalated, skipped };
}

async function _handler_POST(_req: NextRequest) {
  await validateCronSecret(_req);

  // Redis lock to prevent concurrent runs
  const lockToken = await acquireDistributedLock(LOCK_KEY, LOCK_TTL_SECS);
  if (!lockToken) {
    logger.info("STALE_FULFILLMENT: Already running, skipping to avoid race condition.");
    return NextResponse.json({
      success: true,
      message: "Stale fulfillment scan already running skipped",
      data: { locked: true },
    });
  }

  try {
    const result = await scanStaleFulfillmentDeals();

    logger.info("STALE_FULFILLMENT: Scan complete", result);

    return NextResponse.json({
      success: true,
      message: `Stale fulfillment scan complete ${result.reminded} reminded, ${result.escalated} escalated`,
      data: {
        ...result,
        scannedAt: new Date().toISOString(),
      },
    });
  } finally {
    await releaseDistributedLock(LOCK_KEY, lockToken);
  }
}

export const GET = apiWrapper(_handler_POST);
export const POST = apiWrapper(_handler_POST);
