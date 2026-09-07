import { apiWrapper } from "@/lib/api-wrapper";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma, { ensurePlatformTreasury } from "@/lib/db";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { calculateCancellation } from "@/lib/contract-engine";
import { creditInfluencerPayoutWithTax } from "@/lib/deal-settlement";
import { Prisma } from "@prisma/client";
import { getDealTotalAmount } from "@/lib/utils";
import { createActivityLog } from "@/lib/audit";
import { AppError } from "@/lib/errors";

interface CancellationSummary {
refundAmount: number;
payoutAmount: number;
platformFeeKept: number;
reason: string;
}

type DealWithProfile = Prisma.DealGetPayload<{
include: { influencer: true; brand: true };
}>;


async function _handler_POST(
  _request: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> }
) {
try {
const session = await auth();
if (!session?.user?.id) {
return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
}

const limit = await checkRateLimit(session.user.id, "DEAL_UPDATES");
if (!limit.success) {
return NextResponse.json({ success: false, message: "Too many requests" }, { status: 429 });
}

const resolvedParams = await context.params;
const dealId = String(resolvedParams.id ?? '');

const deal = await prisma.deal.findUnique({
where: { id: dealId },
include: {
influencer: true,
brand: true,
},
});

if (!deal) {
return NextResponse.json({ success: false, message: "Deal not found" }, { status: 404 });
}

// Only the brand owner who created the deal can cancel it
if (deal.brand?.userId !== session.user.id) {
return NextResponse.json({ success: false, message: "Forbidden. Only the brand can cancel this deal." }, { status: 403 });
}

// Verify deal is in a cancelable state
if (["COMPLETED", "CANCELLED", "DISPUTED"].includes(deal.status)) {
return NextResponse.json({ success: false, message: `Deal cannot be cancelled in status ${deal.status}` }, { status: 400 });
}

// DB updates in transaction
try {
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // H4 FIX: calculateCancellation must run inside the transaction after locking the deal row.
    // Calling it outside is a TOCTOU race — deal status can change between calculation
    // and execution, causing stale payout amounts to be used for financial settlement.
    const cancelSummary = await calculateCancellation(dealId, tx);
    const { refundAmount, payoutAmount, platformFeeKept, reason } = cancelSummary;

    await executeCancellationTransaction(tx, deal, cancelSummary, session.user.id);

    await createActivityLog({
      userId: session.user.id,
      action: "CANCEL_DEAL",
      entityType: "Deal",
      entityId: dealId,
      metadata: {
        payoutAmount,
        refundAmount,
        platformFeeKept,
        reason,
      },
    }, tx);
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });

  return NextResponse.json({ success: true, message: `Deal cancelled successfully.` });
} catch (txError) {
if (txError instanceof AppError) throw txError;
logger.error("Database transaction failed during cancellation", txError);
return NextResponse.json({ success: false, message: "Database transaction failed during cancellation" }, { status: 500 });
}
} catch (error: unknown) {
if (error instanceof AppError) throw error;
logger.error("POST /api/deals/[id]/cancel error", { error: (error instanceof Error ? error.message : String(error)) });
return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
}
}


// Wrapped handlers via apiWrapper
export const POST = apiWrapper(_handler_POST);

async function processPayoutAndPlatformFees(
  tx: Prisma.TransactionClient,
  deal: DealWithProfile,
  cancelSummary: CancellationSummary,
) {
  const { payoutAmount, platformFeeKept, reason } = cancelSummary;
  if (payoutAmount <= 0) return;

  const grossPayout = payoutAmount;
  if (grossPayout > 0) {
// Credit influencer payout
await creditInfluencerPayoutWithTax(tx, {
userId: deal.influencer.userId,
dealId: deal.id,
grossPayout,
description: `Cancellation payout: ${reason}`,
metadata: {
source: "wallet_cancellation_payout",
},
});
} else {
logger.warn("Cancellation payout resulted in zero or negative gross payout for influencer", {
dealId: deal.id,
influencerId: deal.influencer.userId,
payoutAmount,
platformFeeKept,
grossPayout,
});
}

if (platformFeeKept > 0) {
if (deal.brand?.userId) {
const brandWallet = await tx.wallet.upsert({
where: { userId: deal.brand.userId },
create: { userId: deal.brand.userId, balance: 0, pendingBalance: 0 },
update: {},
});

await tx.transaction.create({
data: {
walletId: brandWallet.id,
dealId: deal.id,
type: "PLATFORM_FEE",
amount: platformFeeKept,
status: "COMPLETED",
description: `Platform cancellation fee for deal: ${deal.id}`,
metadata: {
balanceImpact: false,
source: "wallet_cancellation_fee",
grossDealAmount: deal.amount,
payoutAmount,
platformFeeKept,
},
},
});
}

// Credit the PLATFORM_TREASURY wallet
await ensurePlatformTreasury(tx);
const treasuryWallet = await tx.wallet.update({
where: { userId: "PLATFORM_TREASURY" },
data: { balance: { increment: platformFeeKept } },
});

await tx.transaction.create({
data: {
walletId: treasuryWallet.id,
dealId: deal.id,
type: "CREDIT",
amount: platformFeeKept,
status: "COMPLETED",
description: `Platform fee income from cancellation credited to treasury for deal: ${deal.id}`,
metadata: {
source: "wallet_cancellation_fee",
brandUserId: deal.brand?.userId,
},
},
});
}
}

async function processBrandCancellationRefund(
  tx: Prisma.TransactionClient,
  deal: DealWithProfile,
  cancelSummary: CancellationSummary,
) {
  const { refundAmount, reason } = cancelSummary;
  if (!deal.brand?.userId) return;

  if (deal.reservedFromWallet) {
    // Wallet-reserved deal: refund returns to brand's withdrawable balance.
    // pendingBalance was already decremented in executeCancellationTransaction via campaign.reservedTotalAmount,
    // so only increment balance here.
    let brandWallet = await tx.wallet.findUnique({ where: { userId: deal.brand.userId } });

    if (brandWallet) {
      brandWallet = await tx.wallet.update({
        where: { id: brandWallet.id },
        data: { balance: { increment: refundAmount } },
      });
    } else {
      brandWallet = await tx.wallet.create({
        data: { userId: deal.brand.userId, balance: refundAmount, pendingBalance: 0 },
      });
    }

    if (refundAmount > 0) {
      await tx.transaction.create({
        data: {
          walletId: brandWallet.id,
          dealId: deal.id,
          type: "REFUND",
          amount: refundAmount,
          status: "COMPLETED",
          description: `Cancellation refund (wallet): ${reason}`,
          metadata: { balanceImpact: true, source: "wallet_cancellation_refund" },
        },
      });
    }
  } else {
    // Campaign-funded deal: funds were held in brand's wallet pendingBalance.
    // Deduct platform fees / creator compensation consumed from campaign's fundedAmount AND brand's wallet pendingBalance
    // so the brand's wallet pendingBalance strictly matches active campaign funded escrow.
    const dealTotal = getDealTotalAmount(deal);
    const feesConsumed = dealTotal - refundAmount;
    if (feesConsumed > 0) {
      await tx.campaign.update({
        where: { id: deal.campaignId },
        data: { fundedAmount: { decrement: feesConsumed } },
      });
      await tx.wallet.updateMany({
        where: { userId: deal.brand.userId, pendingBalance: { gte: feesConsumed } },
        data: { pendingBalance: { decrement: feesConsumed } },
      });
    }
    // No balance change on brand wallet — refund amount stays in campaign pool
    // (it was already freed up via reservedTotalAmount decrement above).
  }
}

async function executeCancellationTransaction(
tx: Prisma.TransactionClient,
deal: DealWithProfile,
cancelSummary: CancellationSummary,
_sessionUserId: string,
) {
const cancelResult = await tx.deal.updateMany({
where: {
id: deal.id,
status: { notIn: ["COMPLETED", "CANCELLED", "DISPUTED"] },
},
data: {
status: "CANCELLED",
},
});
if (cancelResult.count === 0) {
throw AppError.conflict("Deal is no longer in a cancellable state (concurrent modification).");
}

// Decrement campaign reserved amount
await tx.campaign.update({
where: { id: deal.campaignId },
data: {
reservedAmount: { decrement: deal.amount },
reservedTotalAmount: { decrement: getDealTotalAmount(deal) },
},
});

await processPayoutAndPlatformFees(tx, deal, cancelSummary);
await processBrandCancellationRefund(tx, deal, cancelSummary);
}
