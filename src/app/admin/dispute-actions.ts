"use server";

import { AppError } from "@/lib/errors";

import prisma from "@/lib/db";
import { redis } from "@/lib/redis";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { updateTrustAndLevel } from "@/lib/trust-engine";
import { finalizeDealGamification } from "@/lib/gamification-engine";
import { logger } from "@/lib/logger";
import { auth } from "@/lib/auth";
import { requireActiveAdmin } from "@/lib/admin-auth";
import { createActivityLog } from "@/lib/audit";
import {
creditInfluencerPayoutWithTax,
recordPlatformFeeRevenue,
} from "@/lib/deal-settlement";
import { refundPayment, capturePayment } from "@/lib/razorpay";

type DisputeWithDeal = Prisma.DisputeGetPayload<{
include: {
deal: {
include: {
influencer: { select: { userId: true } };
brand: { select: { userId: true } };
};
};
};
}>;


async function requireAdmin() {
const session = await auth();
await requireActiveAdmin(session?.user);
return session!;
}

async function determineDisputeConfidence(disputeId: string, dispute: DisputeWithDeal): Promise<string> {
let confidence = "HIGH";
try {
if (dispute.influencerOutcome) {
const parsed = JSON.parse(dispute.influencerOutcome);
if (parsed.confidence) confidence = parsed.confidence;
} else if (dispute.brandOutcome) {
const parsed = JSON.parse(dispute.brandOutcome);
if (parsed.confidence) confidence = parsed.confidence;
} else {
const { analyzeDispute } = await import("@/lib/dispute-mediator");
const analysis = await analyzeDispute(disputeId);
if (analysis?.confidence) {
confidence = analysis.confidence;
}
}
} catch (err) {
logger.error("Error determining dispute confidence in resolveDispute", err);
}
return confidence;
}

async function performGatewayRefund(
tx: Prisma.TransactionClient,
dealId: string,
refundAmount: number,
reason: string
) {
const paymentHold = await tx.paymentHold.findUnique({
where: { dealId },
select: { razorpayPaymentId: true },
});
if (paymentHold?.razorpayPaymentId) {
try {
await refundPayment({
paymentId: paymentHold.razorpayPaymentId,
amount: refundAmount,
speed: "normal",
notes: {
dealId,
reason: `Admin dispute resolution: ${reason}`,
},
});
logger.info("Razorpay refund issued for admin dispute resolution", {
dealId,
paymentId: paymentHold.razorpayPaymentId,
refundAmount,
});
} catch (refundErr) {
// Wallet credit has already committed log for manual follow-up
// but don't throw, as that would roll back the entire resolution.
logger.error(
"Razorpay refund failed during admin dispute resolution wallet credited but gateway refund pending manual retry",
refundErr instanceof Error ? refundErr : new Error(String(refundErr)),
{ dealId, paymentId: paymentHold.razorpayPaymentId, refundAmount },
);
}
} else {
logger.warn(
"Card-funded deal has no razorpayPaymentId in PaymentHold gateway refund skipped",
{ dealId },
);
}
}

async function processBrandWalletRefund(
tx: Prisma.TransactionClient,
brandUserId: string,
dispute: DisputeWithDeal,
reason: string
) {
const brandWallet = await tx.wallet.findUnique({ where: { userId: brandUserId } });
  if (!brandWallet) {
    return;
  }

  const refundAmount = dispute.deal.totalAmount || dispute.deal.amount;

  if (dispute.deal.reservedFromWallet) {
    const updateResult = await tx.wallet.updateMany({
      where: { id: brandWallet.id, pendingBalance: { gte: refundAmount } },
      data: {
        balance: { increment: refundAmount },
        pendingBalance: { decrement: refundAmount },
      },
    });
    if (updateResult.count === 0) {
      throw AppError.badRequest("Invalid deal state: missing refundable wallet reserve.");
    }
  }

  await tx.transaction.create({
    data: {
      walletId: brandWallet.id,
      type: "REFUND",
      amount: refundAmount,
      description: `Refund for disputed deal: ${dispute.deal.campaignId} (Reason: ${reason})`,
      status: "COMPLETED",
      metadata: {
        balanceImpact: dispute.deal.reservedFromWallet,
        reservedFromWallet: dispute.deal.reservedFromWallet,
        source: "admin_dispute_refund",
      },
    },
  });

  if (!dispute.deal.reservedFromWallet) {
    await performGatewayRefund(tx, dispute.dealId, refundAmount, reason);
  }
}

async function handleRefundBrand(tx: Prisma.TransactionClient, dispute: DisputeWithDeal, reason: string) {
  // Cancel Deal atomically with status check
  const cancelResult = await tx.deal.updateMany({
    where: {
      id: dispute.dealId,
      status: { notIn: ["COMPLETED", "CANCELLED"] },
    },
    data: { status: "CANCELLED" },
  });

  if (cancelResult.count === 0) {
    throw AppError.badRequest("Invalid deal state for brand refund. The deal may have already been completed or cancelled.");
  }

  // Handle Funds (Internal Wallet Deal)
  if (dispute.deal.brandId) {
    const brand = await tx.brandProfile.findUnique({
      where: { id: dispute.deal.brandId },
    });
    if (brand) {
      await processBrandWalletRefund(tx, brand.userId, dispute, reason);
    }
  }

  await tx.campaign.update({
    where: { id: dispute.deal.campaignId },
    data: {
      reservedAmount: { decrement: dispute.deal.amount },
      reservedTotalAmount: { decrement: dispute.deal.totalAmount || dispute.deal.amount },
    },
  });
}

async function secureBrandFundsForRelease(
  tx: Prisma.TransactionClient,
  deal: DisputeWithDeal["deal"],
) {
  if (deal.brand?.userId && deal.reservedFromWallet) {
    const reserveAmount = deal.totalAmount || deal.amount;
    const debitResult = await tx.wallet.updateMany({
      where: { userId: deal.brand.userId, pendingBalance: { gte: reserveAmount } },
      data: { pendingBalance: { decrement: reserveAmount } },
    });

    if (debitResult.count === 0) {
      throw AppError.badRequest("Invalid deal state: Missing pending balance in brand's wallet. Concurrent process detected.");
    }
  } else if (!deal.reservedFromWallet) {
    const paymentHold = await tx.paymentHold.findUnique({
      where: { dealId: deal.id },
      select: { razorpayPaymentId: true },
    });
    if (paymentHold?.razorpayPaymentId) {
      try {
        const captureAmount = deal.totalAmount || deal.amount;
        await capturePayment(paymentHold.razorpayPaymentId, captureAmount);
        logger.info("Razorpay payment captured for card-funded dispute resolution", {
          dealId: deal.id,
          paymentId: paymentHold.razorpayPaymentId,
          captureAmount,
        });
      } catch (captureErr) {
        logger.error("Razorpay capture failed during dispute resolution", captureErr instanceof Error ? captureErr : new Error(String(captureErr)), {
          dealId: deal.id,
        });
        throw AppError.badRequest("Failed to capture brand payment — cannot release influencer payout without confirmed funds.");
      }
    } else {
      logger.warn("No PaymentHold found for card-funded deal during dispute release", { dealId: deal.id });
    }
  }
}

async function handleReleaseInfluencer(tx: Prisma.TransactionClient, dispute: DisputeWithDeal, payoutAmount: number) {
  // Mark Deal as Completed atomically with status check
  const completeResult = await tx.deal.updateMany({
    where: {
      id: dispute.dealId,
      status: { notIn: ["COMPLETED", "CANCELLED"] },
    },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  if (completeResult.count === 0) {
    throw AppError.badRequest("Invalid deal state for influencer release. The deal may have already been completed or cancelled.");
  }

  if (dispute.deal.brandId) {
    await tx.brandProfile.update({
      where: { id: dispute.deal.brandId },
      data: { totalSpent: { increment: dispute.deal.totalAmount || dispute.deal.amount } },
    });
  }

  let gamificationReferrerId: string | null = null;

  // Credit Influencer Wallet (Internal Wallet Deal)
  if (dispute.deal.influencerId) {
    const influencer = await tx.influencerProfile.findUnique({
      where: { id: dispute.deal.influencerId },
    });
    if (influencer) {
      await secureBrandFundsForRelease(tx, dispute.deal);

      await creditInfluencerPayoutWithTax(
        tx,
        {
          userId: influencer.userId,
          dealId: dispute.deal.id,
          grossPayout: payoutAmount,
          description: `Dispute Resolved in Favor: ${dispute.deal.campaignId}`,
          metadata: {
            balanceImpact: true,
            source: "admin_wallet_dispute_resolution",
          },
        },
      );

      await recordPlatformFeeRevenue(tx, {
        brandUserId: dispute.deal.brand?.userId,
        deal: dispute.deal,
        source: "admin_dispute_resolution",
      });
      const gamificationResult = await finalizeDealGamification(influencer.userId, payoutAmount, tx);
      gamificationReferrerId = gamificationResult?.referrerId ?? null;
    }
  }

  return { gamificationReferrerId };
}

export async function resolveDispute(
disputeId: string,
decision: "REFUND_BRAND" | "RELEASE_INFLUENCER",
reason: string,
) {
const session = await requireAdmin();

const dispute = await prisma.dispute.findUnique({
where: { id: disputeId },
include: {
deal: {
include: {
influencer: { select: { userId: true } },
brand: { select: { userId: true } },
},
},
},
});

if (!dispute) throw AppError.notFound("Dispute not found");
if (dispute.deal.status === "COMPLETED") {
  throw AppError.badRequest("Cannot resolve dispute for an already completed deal.");
}
if (dispute.deal.status === "CANCELLED") {
  throw AppError.badRequest("Cannot resolve dispute for an already cancelled deal.");
}

const confidence = await determineDisputeConfidence(disputeId, dispute);

let gamificationReferrerId: string | null = null;
await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
const payoutAmount = dispute.deal.influencerPayout ?? dispute.deal.amount;
// 1. Update Dispute Status
const lockCheck = await tx.dispute.updateMany({
where: {
id: disputeId,
status: { notIn: ["RESOLVED", "CLOSED"] },
},
data: {
status: "RESOLVED",
resolution: reason,
resolvedByUserId: session.user.id,
resolvedAt: new Date(),
brandOutcome:
decision === "REFUND_BRAND"
? JSON.stringify({ action: "REFUND", refund_percentage: 100, confidence })
: null,
influencerOutcome:
decision === "RELEASE_INFLUENCER"
? JSON.stringify({ action: "RELEASE", payment_percentage: 100, confidence })
: null,
},
});

if (lockCheck.count === 0) {
throw AppError.badRequest("Dispute already resolved, closed, or concurrent request detected.");
}

// 2. Handle Deal & Funds
if (decision === "REFUND_BRAND") {
await handleRefundBrand(tx, dispute, reason);
} else {
const res = await handleReleaseInfluencer(tx, dispute, payoutAmount);
gamificationReferrerId = res.gamificationReferrerId;
}
});

if (gamificationReferrerId) {
try {
await redis.del(`platform_fee:effective:${gamificationReferrerId}`);
} catch (err) {
logger.warn("Failed to invalidate platform fee cache after resolveDispute", { error: err });
}
}

revalidatePath("/admin/disputes");

// Recalculate trust scores for both parties
if (dispute.deal.influencerId) {
const influencer = await prisma.influencerProfile.findUnique({
where: { id: dispute.deal.influencerId },
select: { userId: true },
});
if (influencer) {
await updateTrustAndLevel(influencer.userId, "DISPUTE_RESOLVED");
}
}
if (dispute.deal.brandId) {
const brand = await prisma.brandProfile.findUnique({
where: { id: dispute.deal.brandId },
select: { userId: true },
});
if (brand) {
await updateTrustAndLevel(brand.userId, "DISPUTE_RESOLVED");
}
}

await createActivityLog({
  userId: session.user.id,
  action: "DISPUTE_RESOLUTION",
  entityType: "DEAL",
  entityId: dispute.dealId,
  metadata: {
    disputeId,
    decision,
    reason,
    adminEmail: session.user.email,
  },
}).catch(() => {});
}
