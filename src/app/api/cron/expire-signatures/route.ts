import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { apiWrapper } from "@/lib/api-wrapper";
import prisma from "@/lib/db";
import { logger } from "@/lib/logger";
import { validateCronSecret } from "../guard";
import { getDealTotalAmount } from "@/lib/utils";
import { AppError } from "@/lib/errors";

import { acquireDistributedLock, releaseDistributedLock } from "@/lib/lock";

type ExpiredSignatureDeal = Prisma.DealGetPayload<{
  include: {
    brand: { select: { id: true; userId: true; companyName: true } };
    campaign: {
      select: {
        id: true;
        title: true;
        isDirectInvite: true;
        totalBudget: true;
        status: true;
        brandId: true;
      };
    };
    influencer: {
      select: { id: true; userId: true; displayName: true };
    };
  };
}>;


async function _handler_POST(_req: NextRequest) {
  await validateCronSecret(_req);

  // M11 FIX: Acquire distributed lock to prevent concurrent cron execution
  const lockKey = "cron:expire-signatures:lock";
  const lockToken = await acquireDistributedLock(lockKey, 300);
  if (!lockToken) {
    logger.warn("cron:expire-signatures: Lock acquisition failed, execution skipped.");
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
    const results: Array<{ dealId: string; success: boolean; error?: string }> = [];

    const failedIds: string[] = [];
    while (processedCount < MAX_PROCESS_LIMIT) {
      const currentTake = Math.min(BATCH_SIZE, MAX_PROCESS_LIMIT - processedCount);
      const expiredDeals = await prisma.deal.findMany({
        where: {
          status: "PENDING_SIGNATURE",
          signDeadline: { lt: now },
          deletedAt: null, // M11 & L10 FIX: Ignore soft-deleted deals
          ...(failedIds.length > 0 ? { id: { notIn: failedIds } } : {}),
        },
        include: {
          brand: { select: { id: true, userId: true, companyName: true } },
          campaign: {
            select: {
              id: true,
              title: true,
              isDirectInvite: true,
              totalBudget: true,
              status: true,
              brandId: true,
            },
          },
          influencer: {
            select: { id: true, userId: true, displayName: true },
          },
        },
        take: currentTake,
      });

      if (expiredDeals.length === 0) {
        break;
      }

      for (const deal of expiredDeals) {
        try {
          await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            await expireSingleDealSignature(tx, deal);
          });

          results.push({
            dealId: deal.id,
            success: true,
          });
        } catch (err: unknown) {
          logger.error("Failed to expire deal signature", err, { dealId: deal.id });
          failedIds.push(deal.id);
          results.push({
            dealId: deal.id,
            success: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      processedCount += expiredDeals.length;
    }

    logger.info("Expire signatures cron run completed", { expiredCount: processedCount });

    return NextResponse.json({
      success: true,
      scanned: processedCount,
      results,
    });
  } finally {
    // Release lock safely via CAS
    await releaseDistributedLock(lockKey, lockToken);
  }
}

export const GET = apiWrapper(_handler_POST);
export const POST = apiWrapper(_handler_POST);

async function handleWalletRefund(tx: Prisma.TransactionClient, deal: ExpiredSignatureDeal, brandUserId: string) {
  const refundAmount = getDealTotalAmount(deal);
  if (refundAmount <= 0) return;

  const isCampaignPoolRefund = !deal.campaign.isDirectInvite;
  const wallet = await tx.wallet.findUnique({
    where: { userId: brandUserId },
    select: { id: true, pendingBalance: true },
  });

  if (!wallet) {
    logger.error("CRITICAL SIGNATURE EXPIRY INTEGRITY VIOLATION: Wallet not found for brand user during signature-expiry refund", {
      dealId: deal.id,
      brandUserId,
      expectedRefund: refundAmount,
    });
    return;
  }

  // When reservedFromWallet is true, pendingBalance was already decremented at deal creation.
  // Direct invites return to withdrawable balance; campaign pools return to pendingBalance.
  if (isCampaignPoolRefund) {
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { pendingBalance: { increment: refundAmount } },
    });
  } else {
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: refundAmount } },
    });
  }

  await tx.transaction.create({
    data: {
      walletId: wallet.id,
      dealId: deal.id,
      type: "REFUND",
      amount: refundAmount,
      status: "COMPLETED",
      description: `Refund for expired invite: ${deal.campaign.title}`,
      metadata: {
        balanceImpact: !isCampaignPoolRefund,
        source: isCampaignPoolRefund ? "campaign_pool_refund" : "direct_invite_refund",
      },
    },
  });
}

async function handleDirectInviteRefund(tx: Prisma.TransactionClient, deal: ExpiredSignatureDeal, brandUserId: string) {
  await handlePendingBalanceShift(tx, deal, brandUserId, `Refund for expired invite: ${deal.campaign.title}`);
}

async function handleFallbackRefund(tx: Prisma.TransactionClient, deal: ExpiredSignatureDeal, brandUserId: string) {
  await handlePendingBalanceShift(tx, deal, brandUserId, `Refund for expired deal signature: ${deal.campaign.title}`, {
    balanceImpact: true,
    source: "non_wallet_pool_refund",
  });
}

/** Shared: shifts funds from pendingBalance -> balance for held non-wallet reserves. */
async function handlePendingBalanceShift(
  tx: Prisma.TransactionClient,
  deal: ExpiredSignatureDeal,
  brandUserId: string,
  description: string,
  metadata?: Prisma.InputJsonObject,
) {
  const wallet = await tx.wallet.findUnique({
    where: { userId: brandUserId },
    select: { id: true, pendingBalance: true },
  });

  const refundAmount = getDealTotalAmount(deal);
  if (!wallet) {
    logger.error("CRITICAL SIGNATURE EXPIRY INTEGRITY VIOLATION: Wallet not found for brand user during signature-expiry pending balance shift", {
      dealId: deal.id,
      brandUserId,
      expectedRefund: refundAmount,
    });
    return;
  }

  const refundableAmount = Math.min(wallet.pendingBalance, refundAmount);
  if (refundableAmount <= 0) return;

  await tx.wallet.update({
    where: { id: wallet.id },
    data: {
      pendingBalance: { decrement: refundableAmount },
      balance: { increment: refundableAmount },
    },
  });

  await tx.transaction.create({
    data: {
      walletId: wallet.id,
      dealId: deal.id,
      type: "REFUND",
      amount: refundableAmount,
      status: "COMPLETED",
      description,
      metadata: {
        ...metadata,
        balanceImpact: true,
      },
    },
  });
}

async function expireSingleDealSignature(tx: Prisma.TransactionClient, deal: ExpiredSignatureDeal) {
const lockResult = await tx.deal.updateMany({
where: { id: deal.id, status: "PENDING_SIGNATURE" },
data: {
status: "CANCELLED",
rejectionReason: "Invite signature deadline expired (auto-cancelled)",
},
});

if (lockResult.count === 0) {
throw AppError.conflict("Deal is no longer in PENDING_SIGNATURE status");
}

await tx.application.updateMany({
where: {
campaignId: deal.campaignId,
influencerId: deal.influencerId,
status: "SELECTED",
},
data: {
status: "WITHDRAWN",
rejectionReason: "Invite signature deadline expired",
},
});

  // Lock campaign row to serialize concurrent updates
  await tx.$queryRaw`SELECT id FROM "Campaign" WHERE id = ${deal.campaignId} FOR UPDATE`;

  const campaignForRelease = await tx.campaign.findUnique({
    where: { id: deal.campaignId },
    select: { selectedInfluencers: true },
  });
  const selectedCount = campaignForRelease?.selectedInfluencers ?? 0;

  await tx.campaign.update({
    where: { id: deal.campaignId },
    data: {
      selectedInfluencers: { decrement: selectedCount > 0 ? 1 : 0 },
      reservedAmount: { decrement: deal.amount },
      reservedTotalAmount: { decrement: getDealTotalAmount(deal) },
    },
  });

const brandUserId = deal.brand?.userId;
if (brandUserId) {
if (deal.reservedFromWallet) {
await handleWalletRefund(tx, deal, brandUserId);
} else if (deal.campaign.isDirectInvite) {
await handleDirectInviteRefund(tx, deal, brandUserId);
} else {
await handleFallbackRefund(tx, deal, brandUserId);
}
}

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
