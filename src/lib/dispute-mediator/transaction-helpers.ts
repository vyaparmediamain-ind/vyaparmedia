import { getDealTotalAmount } from "../utils";
import { ensurePlatformTreasury } from "../db";
import { logger } from "../logger";
import { refundPayment } from "../razorpay";
import { FullDeal, MediatorAnalysis } from "./types";
import {
TransactionType,
TransactionStatus,
Prisma,
} from "@prisma/client";
import {
creditInfluencerPayoutWithTax,
recordPlatformFeeRevenue,
} from "../deal-settlement";
import { finalizeDealGamification } from "../gamification-engine";
import { processReferralReward } from "../referral-engine";
import { NotificationService } from "@/services/notification.service";
import { AppError } from "../errors";

// Helper interfaces for transaction clawback
interface CompletedDealClawbackConfig {
tx: Prisma.TransactionClient;
deal: FullDeal;
brandUserId: string | null;
influencerUserId: string;
actualDeduct: number;
debtPending: number;
treasuryClawback: number;
brandRefundActual: number;
analysis: MediatorAnalysis;
}

interface ActiveDealEscrowSettlementConfig {
tx: Prisma.TransactionClient;
deal: FullDeal;
brandUserId: string | null;
influencerUserId: string;
influencerShare: number;
brandRefund: number;
totalAmount: number;
analysis: MediatorAnalysis;
}

// ==================== APPLY RESOLUTION ====================

/**
* Apply a mediator analysis resolution to the dispute and deal.
* Updates dispute status, deal status, wallet balances, trust scores, and notifications.
*/
interface CompletedDealClawbackConfig {
tx: Prisma.TransactionClient;
deal: FullDeal;
brandUserId: string | null;
influencerUserId: string;
actualDeduct: number;
debtPending: number;
treasuryClawback: number;
brandRefundActual: number;
analysis: MediatorAnalysis;
}

async function applyCompletedDealClawback(config: CompletedDealClawbackConfig) {
const {
tx,
deal,
brandUserId,
influencerUserId,
actualDeduct,
debtPending,
treasuryClawback,
brandRefundActual,
analysis,
} = config;

const influencerWallet = await tx.wallet.findUnique({
where: { userId: influencerUserId },
});

if (!influencerWallet) {
throw AppError.badRequest("Influencer wallet missing during clawback");
}

  // Debit Influencer (Enforce Debt) up to actualDeduct, increment debt by debtPending
  const debitResult = await tx.wallet.updateMany({
    where: { userId: influencerUserId, balance: { gte: actualDeduct } },
    data: {
      balance: { decrement: actualDeduct },
      totalEarned: { decrement: Math.min(actualDeduct, influencerWallet.totalEarned ?? 0) },
      debt: { increment: debtPending },
    },
  });

  if (debitResult.count === 0) {
    throw AppError.badRequest("Insufficient wallet balance for clawback deduction.");
  }

// Debit Platform Treasury for platform's portion of the refund
if (treasuryClawback > 0) {
await ensurePlatformTreasury(tx);
await tx.wallet.updateMany({
where: { userId: "PLATFORM_TREASURY" },
data: {
balance: { decrement: treasuryClawback },
},
});
}

  const transactions = [];

  if (actualDeduct > 0 || debtPending > 0) {
    const debtSuffix = debtPending > 0 ? ` (Pending debt: ${debtPending} Paise)` : "";
    const description = `Dispute clawback for brand refund (${analysis.refundPercentage}%)${debtSuffix}`;
    transactions.push({
      walletId: influencerWallet.id,
      dealId: deal.id,
      type: "CLAWBACK" as TransactionType,
      amount: actualDeduct,
      status: "COMPLETED" as TransactionStatus,
      description,
    });
  }

  if (treasuryClawback > 0) {
    await ensurePlatformTreasury(tx);
    const treasuryWallet = await tx.wallet.findUnique({
      where: { userId: "PLATFORM_TREASURY" },
      select: { id: true }
    });
    if (treasuryWallet) {
      transactions.push({
        walletId: treasuryWallet.id,
        dealId: deal.id,
        type: "CLAWBACK" as TransactionType,
        amount: treasuryClawback,
        status: "COMPLETED" as TransactionStatus,
        description: `Platform fee clawback for dispute resolution (${analysis.refundPercentage}%)`,
      });
    }
  }

  if (brandUserId && brandRefundActual > 0) {
    const brandWallet = await tx.wallet.upsert({
      where: { userId: brandUserId },
      create: { userId: brandUserId, balance: brandRefundActual, pendingBalance: 0 },
      update: { balance: { increment: brandRefundActual } },
    });

    if (debtPending > 0) {
      await tx.debtClaim.create({
        data: {
          debtorWalletId: influencerWallet.id,
          creditorUserId: brandUserId,
          dealId: deal.id,
          amount: debtPending,
          originalAmount: debtPending,
          status: "PENDING",
        },
      });
    }

    transactions.push({
      walletId: brandWallet.id,
      dealId: deal.id,
      type: "REFUND" as TransactionType,
      amount: brandRefundActual,
      status: "COMPLETED" as TransactionStatus,
      description: `Dispute refund from influencer clawback and platform fee refund (${analysis.refundPercentage}%)`,
    });
  }

  if (transactions.length > 0) {
    await tx.transaction.createMany({
      data: transactions,
    });
  }
}

interface ActiveDealEscrowSettlementConfig {
tx: Prisma.TransactionClient;
deal: FullDeal;
brandUserId: string | null;
influencerUserId: string;
influencerShare: number;
brandRefund: number;
totalAmount: number;
analysis: MediatorAnalysis;
}

async function handleRazorpayGatewayRefund(
deal: FullDeal,
brandRefund: number,
analysis: MediatorAnalysis
) {
if (brandRefund > 0 && deal.paymentHold?.razorpayPaymentId) {
try {
await refundPayment({
paymentId: deal.paymentHold.razorpayPaymentId as string,
amount: brandRefund,
speed: "normal",
notes: {
dealId: deal.id,
reason: `Dispute auto-resolution refund (${analysis.refundPercentage}% back to brand)`,
},
});
logger.info("Razorpay refund issued for card-funded dispute settlement", {
dealId: deal.id,
paymentId: deal.paymentHold.razorpayPaymentId,
refundAmount: brandRefund,
});
} catch (refundErr) {
// Log and continue wallet credit above has already succeeded. The
// Razorpay refund failure should trigger a manual follow-up; we don't
// want to roll back the entire dispute resolution for a payment-gateway
// transient error.
logger.error(
"Razorpay refund failed during dispute resolution wallet credited but gateway refund pending manual retry",
refundErr instanceof Error ? refundErr : new Error(String(refundErr)),
{ dealId: deal.id, paymentId: deal.paymentHold.razorpayPaymentId, brandRefund },
);
}
}
}

async function handleBrandWalletRefund(
tx: Prisma.TransactionClient,
deal: FullDeal,
brandUserId: string | null,
brandRefund: number,
influencerShare: number,
analysis: MediatorAnalysis
) {
if (brandRefund <= 0) return;
if (!brandUserId) {
throw AppError.badRequest("Brand owner missing during wallet dispute refund");
}

let brandWallet = await tx.wallet.findUnique({
where: { userId: brandUserId },
});
if (!brandWallet) {
brandWallet = await tx.wallet.create({
data: { userId: brandUserId, balance: 0, pendingBalance: 0 },
});
}

const brandWalletUpdate = await tx.wallet.updateMany({
where: {
id: brandWallet.id,
...(deal.reservedFromWallet ? {} : { pendingBalance: { gte: brandRefund } }),
},
data: deal.reservedFromWallet
? { balance: { increment: brandRefund } }
: { pendingBalance: { decrement: brandRefund } },
});

if (brandWalletUpdate.count === 0) {
throw AppError.badRequest("Invalid brand wallet state: insufficient pending balance for dispute refund");
}

await tx.transaction.create({
data: {
walletId: brandWallet.id,
dealId: deal.id,
type: "REFUND",
amount: brandRefund,
status: "COMPLETED",
description: `Dispute refund from wallet-funded reserve (${analysis.refundPercentage}%)`,
metadata: {
balanceImpact: true,
source: "wallet_dispute_resolution",
influencerShare,
reservedFromWallet: deal.reservedFromWallet,
},
},
});
}

async function applyActiveDealEscrowSettlement(config: ActiveDealEscrowSettlementConfig) {
const {
tx,
deal,
brandUserId,
influencerUserId,
influencerShare,
brandRefund,
totalAmount,
analysis,
} = config;

  if (!deal.reservedFromWallet) {
    if (!brandUserId) {
      throw AppError.badRequest("Brand owner missing during wallet dispute settlement");
    }

    // 1. Release the full escrow pending balance from the brand's wallet (decrement pendingBalance only, do not credit balance)
    await tx.wallet.updateMany({
      where: { userId: brandUserId, pendingBalance: { gte: totalAmount } },
      data: { pendingBalance: { decrement: totalAmount } },
    });

    // 2. Refund to card via Razorpay
    await handleRazorpayGatewayRefund(deal, brandRefund, analysis);

    // 3. Create a ledger audit transaction for the card refund (balanceImpact: false)
    if (brandRefund > 0) {
      const brandWallet = await tx.wallet.findUnique({ where: { userId: brandUserId } });
      if (brandWallet) {
        await tx.transaction.create({
          data: {
            walletId: brandWallet.id,
            dealId: deal.id,
            type: "REFUND",
            amount: brandRefund,
            status: "COMPLETED",
            description: `Dispute card refund via Razorpay (${analysis.refundPercentage}%)`,
            metadata: {
              balanceImpact: false, // Card refund does not impact wallet balance!
              source: "razorpay_gateway_dispute_resolution",
              influencerShare,
              reservedFromWallet: false,
            },
          },
        });
      }
    }
  }

  if (influencerShare > 0) {
    await creditInfluencerPayoutWithTax(
      tx,
      {
        userId: influencerUserId,
        dealId: deal.id,
        grossPayout: influencerShare,
        description: `Dispute resolution wallet payout (${analysis.influencerPayoutPercentage}%)`,
        metadata: {
          balanceImpact: true,
          source: "wallet_dispute_resolution",
          refundPercentage: analysis.refundPercentage,
          reservedFromWallet: deal.reservedFromWallet,
        },
      },
    );
  }

  // Only call handleBrandWalletRefund for wallet-funded deals!
  if (deal.reservedFromWallet) {
    await handleBrandWalletRefund(tx, deal, brandUserId, brandRefund, influencerShare, analysis);
  }
}

interface ResolutionResults {
influencerRefResult: { referrerId?: string } | undefined;
brandRefResult: { referrerId?: string } | undefined;
}



export async function applyFinancialResolution(
tx: Prisma.TransactionClient,
params: {
analysis: MediatorAnalysis;
isCompleted: boolean;
deal: FullDeal;
brandUserId: string | null;
influencerUserId: string;
actualDeduct: number;
debtPending: number;
treasuryClawback: number;
brandRefundActual: number;
influencerShare: number;
brandRefund: number;
totalAmount: number;
}
) {
const {
analysis,
isCompleted,
deal,
brandUserId,
influencerUserId,
actualDeduct,
debtPending,
treasuryClawback,
brandRefundActual,
influencerShare,
brandRefund,
totalAmount,
} = params;

if (analysis.verdict !== "ESCALATE" && analysis.verdict !== "DISMISSED") {
if (isCompleted) {
await applyCompletedDealClawback({
tx,
deal,
brandUserId,
influencerUserId,
actualDeduct,
debtPending,
treasuryClawback,
brandRefundActual,
analysis,
});
} else if (totalAmount > 0) {
await applyActiveDealEscrowSettlement({
tx,
deal,
brandUserId,
influencerUserId,
influencerShare,
brandRefund,
totalAmount,
analysis,
});
}
}
}

async function handleCompletedDealPostSettlement(
tx: Prisma.TransactionClient,
params: {
analysis: MediatorAnalysis;
deal: FullDeal;
brandUserId: string | null;
influencerUserId: string;
influencerShare: number;
feeRatio: number;
settlementCharge: number;
}
) {
const { analysis, deal, brandUserId, influencerUserId, influencerShare, feeRatio, settlementCharge } = params;
let influencerRefResult: { referrerId?: string } | undefined = undefined;
let brandRefResult: { referrerId?: string } | undefined = undefined;

if (deal.brandId && influencerShare > 0) {
await tx.brandProfile.update({
where: { id: deal.brandId },
data: {
totalSpent: { increment: settlementCharge },
},
});
}

const isFavoredOrSplit = analysis.verdict === "INFLUENCER_FAVORED" || analysis.verdict === "SPLIT";
if (isFavoredOrSplit) {
await recordPlatformFeeRevenue(tx, {
brandUserId,
deal,
feeRatio,
source: "dispute_resolution",
});
influencerRefResult = await finalizeDealGamification(influencerUserId, influencerShare, tx, { dealId: deal.id });
if (brandUserId && settlementCharge > 0) {
try {
brandRefResult = await processReferralReward(brandUserId, settlementCharge, tx, undefined, deal.id);
} catch (err) {
logger.warn("Brand referral reward failed in dispute mediator", {
error: err instanceof Error ? err.message : String(err),
brandUserId,
});
}
}
}

return { influencerRefResult, brandRefResult };
}

export async function applyDealStatusAndRevenues(
tx: Prisma.TransactionClient,
params: {
analysis: MediatorAnalysis;
deal: FullDeal;
brandUserId: string | null;
influencerUserId: string;
influencerShare: number;
feeRatio: number;
settlementCharge: number;
}
): Promise<ResolutionResults> {
const { analysis, deal } = params;
let influencerRefResult: { referrerId?: string } | undefined = undefined;
let brandRefResult: { referrerId?: string } | undefined = undefined;

if (analysis.verdict === "ESCALATE" || analysis.verdict === "DISMISSED") {
return { influencerRefResult, brandRefResult };
}

const isFavoredOrSplit = analysis.verdict === "INFLUENCER_FAVORED" || analysis.verdict === "SPLIT";
const dealStatus = isFavoredOrSplit ? "COMPLETED" : "CANCELLED";

await tx.deal.update({
where: { id: deal.id },
data: {
status: dealStatus,
completedAt: dealStatus === "COMPLETED" ? new Date() : null,
},
});

if (dealStatus === "COMPLETED") {
const res = await handleCompletedDealPostSettlement(tx, params);
influencerRefResult = res.influencerRefResult;
brandRefResult = res.brandRefResult;
} else {
await tx.campaign.update({
where: { id: deal.campaignId },
data: {
reservedAmount: { decrement: deal.amount },
reservedTotalAmount: { decrement: getDealTotalAmount(deal) },
},
});
}

return { influencerRefResult, brandRefResult };
}

export async function createResolutionNotifications(
tx: Prisma.TransactionClient,
disputeId: string,
verdict: string,
explanation: string,
dealId: string,
brandUserId: string | null,
influencerUserId: string,
) {
const title =
verdict === "ESCALATE"
? "Dispute Escalated to Mediation "
: `Dispute Resolved ${verdict.replace("_", " ")} `;
const message = explanation.substring(0, 200);

if (influencerUserId) {
await NotificationService.createNotification({
userId: influencerUserId,
type: "dispute",
title,
message,
data: { disputeId, dealId, verdict },
}, tx);
}

if (brandUserId) {
await NotificationService.createNotification({
userId: brandUserId,
type: "dispute",
title,
message,
data: { disputeId, dealId, verdict },
}, tx);
}
}

