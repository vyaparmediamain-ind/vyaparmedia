import { NextRequest, NextResponse } from "next/server";
import { apiWrapper } from "@/lib/api-wrapper";
import prisma from "@/lib/db";
import { logger } from "@/lib/logger";
import { validateCronSecret } from "../guard";
import { acquireDistributedLock, releaseDistributedLock } from "@/lib/lock";
import { invalidateCampaignSearchCache } from "@/lib/search";
import { createActivityLog } from "@/lib/audit";

async function _handler_POST(_req: NextRequest) {
  await validateCronSecret(_req);

  const lockKey = "cron:expire-campaigns:lock";
  const lockToken = await acquireDistributedLock(lockKey, 300);
  if (!lockToken) {
    logger.warn("cron:expire-campaigns: Lock acquisition failed, execution skipped.");
    return NextResponse.json({
      success: true,
      message: "Another instance is already running.",
    });
  }

  try {
    const now = new Date();
    const BATCH_SIZE = 50;
    const MAX_PROCESS_LIMIT = 200;
    let processedCount = 0;
    const results: Array<{ campaignId: string; success: boolean; error?: string }> = [];

    const failedIds: string[] = [];
    while (processedCount < MAX_PROCESS_LIMIT) {
      const currentTake = Math.min(BATCH_SIZE, MAX_PROCESS_LIMIT - processedCount);
      const expiredCampaigns = await prisma.campaign.findMany({
        where: {
          status: "ACTIVE",
          applicationDeadline: { lt: now },
          deletedAt: null,
          ...(failedIds.length > 0 ? { id: { notIn: failedIds } } : {}),
        },
        select: {
          id: true,
          title: true,
          brandId: true,
          brand: { select: { userId: true } },
        },
        take: currentTake,
      });

      if (expiredCampaigns.length === 0) {
        break;
      }

      for (const campaign of expiredCampaigns) {
        try {
          await prisma.$transaction(async (tx) => {
            // Update campaign status to PAUSED (applications closed for review)
            await tx.campaign.update({
              where: { id: campaign.id },
              data: { status: "PAUSED" },
            });

            // Decrement activeCampaigns counter on BrandProfile if applicable
            if (campaign.brandId) {
              await tx.brandProfile.updateMany({
                where: {
                  id: campaign.brandId,
                  activeCampaigns: { gt: 0 },
                },
                data: {
                  activeCampaigns: { decrement: 1 },
                },
              });
            }

            // Create audit log
            await createActivityLog(
              {
                userId: campaign.brand?.userId || "SYSTEM_CRON",
                action: "CAMPAIGN_AUTO_PAUSED",
                entityType: "Campaign",
                entityId: campaign.id,
                metadata: {
                  reason: "Application deadline passed",
                  previousStatus: "ACTIVE",
                  newStatus: "PAUSED",
                },
              },
              tx,
            );
          });

          results.push({ campaignId: campaign.id, success: true });
        } catch (err: unknown) {
          logger.error("Failed to expire campaign deadline", err, { campaignId: campaign.id });
          failedIds.push(campaign.id);
          results.push({
            campaignId: campaign.id,
            success: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      processedCount += expiredCampaigns.length;
    }

    if (processedCount > 0) {
      invalidateCampaignSearchCache().catch((err) => {
        logger.warn("Failed to invalidate campaign search cache after expiring campaigns", { err });
      });
    }

    logger.info("Expire campaigns cron run completed", { expiredCount: processedCount });

    return NextResponse.json({
      success: true,
      scanned: processedCount,
      results,
    });
  } finally {
    await releaseDistributedLock(lockKey, lockToken);
  }
}

export const GET = apiWrapper(_handler_POST);
export const POST = apiWrapper(_handler_POST);
