import { AppError } from "@/lib/errors";
import { Prisma } from "@prisma/client";
import prisma, { ensurePlatformTreasury } from "@/lib/db";
import {
createOrder,
createPayout,
} from "@/lib/razorpay";
import { encrypt, hashForDuplicateDetection } from "@/lib/encryption";
import { logger } from "@/lib/logger";
import { processReferralReward } from "@/lib/referral-engine";
import { finalizeDealGamification } from "@/lib/gamification-engine";
import { updateTrustAndLevel } from "@/lib/trust-engine";
import { checkPaymentFraud } from "@/lib/fraud-detection";
import { getWithdrawalSpeed } from "@/lib/enterprise-trust-guard";
import { redis } from "@/lib/redis";
import { getDealTotalAmount, getErrorMessage } from "@/lib/utils";
import {
creditInfluencerPayoutWithTax,
recordPlatformFeeRevenue,
} from "@/lib/deal-settlement";
import { releaseIdempotencyKey } from "@/lib/idempotency";

export class PaymentService {
  static async createWalletTopUpOrder(userId: string, amountInPaise: number) {
    if (!Number.isInteger(amountInPaise) || amountInPaise < 100) {
      throw AppError.badRequest("Minimum top-up amount is ₹1 (100 paise)");
    }

    // L9 FIX: Enforce a max single top-up of ₹10,00,000 (100,000,000 paise = 10 lakh).
    // Without this, a single request can create an arbitrarily large Razorpay order.
    const MAX_TOPUP_PAISE = 100_000_000; // 100 million paise = ₹10 lakh
    if (amountInPaise > MAX_TOPUP_PAISE) {
      throw AppError.badRequest("Top-up amount exceeds maximum allowed (₹10,00,000 per transaction)");
    }

    // L9 FIX: Blocked/suspended users must not be able to top up.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });
    if (!user || ["SUSPENDED", "BANNED", "FLAGGED", "DELETED"].includes(user.status || "")) {
      throw AppError.forbidden("Your account is not eligible for wallet top-up");
    }

    const wallet = await prisma.wallet.upsert({
      where: { userId },
      create: { userId, balance: 0, pendingBalance: 0 },
      update: {},
    });

const receipt = `wallet_${userId}_${Date.now()}`;
const order = await createOrder({
amount: amountInPaise,
currency: "INR",
receipt,
notes: {
type: "wallet_topup",
user_id: userId,
},
});

await prisma.transaction.create({
data: {
walletId: wallet.id,
type: "CREDIT",
amount: amountInPaise,
status: "PENDING",
description: "Wallet top-up via Razorpay order",
razorpayOrderId: order.orderId,
},
});

return {
orderId: order.orderId,
amount: order.amount,
currency: order.currency,
key: process.env.RAZORPAY_KEY_ID,
};
}

  private static async checkAndBlockLatePost(
    deal: {
      status: string;
      postedAt: Date | null;
      verifiedAt: Date | null;
      postingDeadline: Date | null;
      requiresPostVerification?: boolean;
    },
    dealId: string,
  ): Promise<void> {
    if (deal.requiresPostVerification === false) {
      return; // Skip checking if post verification is not required for this deal
    }
    const checkTime = deal.postedAt || deal.verifiedAt;
    if (!checkTime) {
      return; // Skip if not posted or verified yet
    }
    if (deal.postingDeadline) {
      // M9 & M10 FIX: Compare exact dates without UTC midnight truncation.
      // Also ensure that if the deal is CONTENT_APPROVED, its status is correctly transitioned to PAYMENT_PENDING.
      if (checkTime > deal.postingDeadline) {
        await prisma.deal.updateMany({
          where: { id: dealId, status: { in: ["VERIFIED", "CONTENT_APPROVED"] } },
          data: {
            status: "PAYMENT_PENDING",
            rejectionReason: `LATE_POST_BLOCKED: Post verified/submitted after deadline (Posted: ${deal.postedAt?.toISOString() ?? "N/A"}, Verified: ${deal.verifiedAt?.toISOString() ?? "N/A"}, Deadline: ${deal.postingDeadline?.toISOString() ?? "N/A"})`,
          },
        });
        logger.warn("PAYOUT_BLOCKED: Post verified/submitted after deadline deal moved to PAYMENT_PENDING for admin review", {
          dealId,
          postedAt: deal.postedAt,
          verifiedAt: deal.verifiedAt,
          deadline: deal.postingDeadline,
        });
        throw AppError.badRequest("LATE_POST_PAYMENT_BLOCKED");
      }
    }
  }

// ==================== DEAL COMPLETION (Wallet Settlement) ====================

/**
* TWO-PHASE COMPLETION PATTERN
* Phase 1: DB Lock & Validate (Atomic)
* Phase 2: DB Transaction for state updates
*/
static async processDealCompletion(dealId: string) {
const lockKey = `lock:deal_completion:${dealId}`;
const acquired = await redis.set(lockKey, "LOCKED", "EX", 60, "NX");
if (!acquired) {
logger.info("processDealCompletion already running for this deal, skipping.", { dealId });
return;
}
try {
const deal = await prisma.deal.findUnique({
where: { id: dealId },
include: { influencer: true, brand: true },
});

if (
!deal ||
!["VERIFIED", "CONTENT_APPROVED"].includes(deal.status)
) {
return;
}

await PaymentService.checkAndBlockLatePost(deal, dealId);


const brandUserId = deal.brand?.userId;
if (!brandUserId) {
logger.critical("PAYOUT_FAILED: Missing brand owner", { dealId });
return;
}

// Retrieve PLATFORM_TREASURY wallet
let treasuryWalletId = "";
const treasuryWallet = await ensurePlatformTreasury();
treasuryWalletId = treasuryWallet.id;

try {
type ReferralRewardResult = Awaited<ReturnType<typeof processReferralReward>>;
let influencerRefResult: ReferralRewardResult | undefined;
let brandRefResult: ReferralRewardResult | undefined;
await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
// Re-verify deal eligibility under database transaction isolation
const txDeal = await tx.deal.findUnique({
where: { id: dealId },
select: { status: true },
});
if (
!txDeal ||
!["VERIFIED", "CONTENT_APPROVED"].includes(txDeal.status)
) {
throw AppError.badRequest("Deal not eligible for completion in transaction context");
}

const brandWallet = await tx.wallet.findUnique({
where: { userId: brandUserId },
select: { id: true, pendingBalance: true },
});

if (
!deal.reservedFromWallet &&
(!brandWallet || brandWallet.pendingBalance < getDealTotalAmount(deal))
) {
throw AppError.badRequest("NO_RESERVED_CAMPAIGN_FUNDS");
}

const dealUpdate = await tx.deal.updateMany({
where: { id: deal.id, status: { not: "COMPLETED" } },
data: { status: "COMPLETED", completedAt: new Date() },
});

if (dealUpdate.count === 0) return;

if (brandWallet && !deal.reservedFromWallet) {
// Atomic conditional decrement: only succeeds if pendingBalance still covers the amount.
// Prevents double-spend when two deals complete concurrently for the same brand wallet.
const pendingRelease = getDealTotalAmount(deal);
const escrowUpdate = await tx.wallet.updateMany({
where: { id: brandWallet.id, pendingBalance: { gte: pendingRelease } },
data: {
pendingBalance: { decrement: pendingRelease },
totalSpent: { increment: getDealTotalAmount(deal) },
},
});
if (escrowUpdate.count === 0) {
throw AppError.badRequest("INSUFFICIENT_PENDING_BALANCE");
}
} else if (brandWallet) {
// reservedFromWallet deals — just update totalSpent, no pendingBalance change needed
await tx.wallet.update({
where: { id: brandWallet.id },
data: { totalSpent: { increment: getDealTotalAmount(deal) } },
});
}

if (deal.brandId) {
await tx.brandProfile.update({
where: { id: deal.brandId },
data: { totalSpent: { increment: getDealTotalAmount(deal) } },
});
}

const influencerPayout = deal.influencerPayout ?? deal.amount;
await creditInfluencerPayoutWithTax(
tx,
{
userId: deal.influencer.userId,
dealId: deal.id,
grossPayout: influencerPayout,
description: `Payout for deal: ${deal.id}`,
razorpayPaymentId: null,
metadata: {
balanceImpact: true,
source: "wallet_completion",
},
},
);

await recordPlatformFeeRevenue(tx, {
brandUserId,
deal,
source: "wallet_completion",
});

// Call finalizeDealGamification (updates completedDeals, totalEarnings, XP, badges)
// We set skipReferral: true because we handle processReferralReward manually below
// to implement same-referrer deduplication between influencer and brand.
await finalizeDealGamification(deal.influencer.userId, influencerPayout, tx, { skipReferral: true });

// 3. Process Referral Reward one reward per unique referrer per deal.
// Guards: (a) use influencerPayout (not gross amount) for influencer-side reward,
// (b) fetch both referrers inside the tx to dedup if influencer & brand
// share the same referrer, only credit once (influencer side wins).
try {
const [influencerReferrer, brandReferrer] = await Promise.all([
tx.user.findUnique({ where: { id: deal.influencer.userId }, select: { referredBy: true } }),
tx.user.findUnique({ where: { id: brandUserId }, select: { referredBy: true } }),
]);

// Influencer side use actual payout (not gross amount)
influencerRefResult = await processReferralReward(deal.influencer.userId, influencerPayout, tx, treasuryWalletId, deal.id);

// Brand side only reward if brand's referrer is a DIFFERENT person than influencer's referrer
const sameReferrer =
  influencerReferrer?.referredBy &&
  brandReferrer?.referredBy &&
  influencerReferrer.referredBy === brandReferrer.referredBy;

if (!sameReferrer) {
  brandRefResult = await processReferralReward(brandUserId, deal.amount, tx, treasuryWalletId, deal.id);
} else {
logger.warn("Skipping duplicate referral reward: influencer and brand share the same referrer", {
dealId: deal.id,
sharedReferrerId: influencerReferrer?.referredBy,
});
}
} catch (err) {
logger.warn("Referral reward failed", { error: err, influencerUserId: deal.influencer.userId, brandUserId });
}
});

// Invalidate platform fee caches outside transaction after successful commit
const keysToDel = [];
if (influencerRefResult?.referrerId) {
keysToDel.push(`platform_fee:effective:${influencerRefResult.referrerId}`);
}
if (brandRefResult?.referrerId && brandRefResult.referrerId !== influencerRefResult?.referrerId) {
keysToDel.push(`platform_fee:effective:${brandRefResult.referrerId}`);
}
if (keysToDel.length > 0) {
try {
await redis.del(keysToDel);
} catch (err) {
logger.warn("Failed to invalidate platform fee cache after deal completion", { error: err });
}
}

// 5. Recalculate Trust outside the transaction after successful commit
await updateTrustAndLevel(deal.influencer.userId, "DEAL_VERIFIED");
} catch (error) {
const msg = getErrorMessage(error);

// If payment genuinely failed (not ambiguous/timeout), release idempotency lock so retry is possible
if (msg !== "LATE_POST_PAYMENT_BLOCKED") {
await releaseIdempotencyKey(`deal_completion:${dealId}`).catch(() => {});
}

if (msg === "NO_RESERVED_CAMPAIGN_FUNDS") {
await prisma.deal.updateMany({
where: { id: dealId, status: { not: "COMPLETED" } },
data: { status: "PAYMENT_PENDING" },
});
}

logger.critical("CAPTURE_FAILED: Deal completion failed", {
dealId,
error,
});
}
} finally {
await redis.del(lockKey);
}
}

  static async executeWithdrawalDbTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
    data: { amount: number; bankAccountName: string; bankAccountNumber: string; ifscCode: string; upiId?: string },
    idempotencyKey: string,
    fraudAction: string,
    fraudRiskScore: number,
    trustBasedManualReview: boolean
  ) {
    const existing = await tx.transaction.findUnique({
      where: { razorpayPaymentId: idempotencyKey },
      include: { wallet: { select: { userId: true } } },
    });
    if (existing) {
      if (existing.wallet.userId !== userId) {
        logger.warn("Withdrawal idempotency owner mismatch", {
          userId,
          transactionId: existing.id,
        });
        throw AppError.badRequest("IDEMPOTENCY_KEY_OWNER_MISMATCH");
      }

      if (existing.status === "FAILED") {
        if (existing.amount !== data.amount) {
          logger.warn("Withdrawal retry amount mismatch", {
            userId,
            existingAmount: existing.amount,
            requestedAmount: data.amount,
          });
          throw AppError.badRequest("IDEMPOTENCY_KEY_AMOUNT_MISMATCH");
        }
        // Free up the unique constraint slot while preserving the failed transaction audit trail
        await tx.transaction.update({
          where: { id: existing.id },
          data: { razorpayPaymentId: `failed:${existing.id}:${idempotencyKey}` },
        });
      } else {
        return { alreadyProcessed: true };
      }
    }

    const updateResult = await tx.wallet.updateMany({
      where: { userId, balance: { gte: data.amount }, isFrozen: false },
      data: { balance: { decrement: data.amount } }
    });

    if (updateResult.count === 0) throw AppError.badRequest("INSUFFICIENT_FUNDS_OR_FROZEN");

    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      throw AppError.badRequest("User wallet not found");
    }
    const encryptedAcc = encrypt(data.bankAccountNumber);
    const bankAccountHash = hashForDuplicateDetection(data.bankAccountNumber);
    const upiIdHash = data.upiId ? hashForDuplicateDetection(data.upiId) : null;

    const w = await tx.withdrawal.create({
      data: {
        walletId: wallet.id,
        amount: data.amount,
        bankAccountName: data.bankAccountName,
        bankAccountNumber: encryptedAcc,
        bankAccountHash,
        ifscCode: data.ifscCode,
        upiId: data.upiId ? encrypt(data.upiId) : null,
        upiIdHash,
        status: (fraudAction === "REVIEW" || trustBasedManualReview) ? "PENDING_REVIEW" : "PROCESSING",
        isManualReview: fraudAction === "REVIEW" || trustBasedManualReview,
        riskScore: fraudRiskScore,
      }
    });

    const t = await tx.transaction.create({
      data: {
        walletId: wallet.id,
        withdrawalId: w.id,
        type: "WITHDRAWAL",
        amount: data.amount,
        status: "PENDING",
        description: `Withdrawal Ref: ${w.id}`,
        razorpayPaymentId: idempotencyKey,
      }
    });

    return { w, t };
  }

  static async handlePayoutError(
    error: unknown,
    withdrawalId: string,
    userId: string,
    idempotencyKey: string,
  ): Promise<{ success: boolean; status: string }> {
    const errorMsg = getErrorMessage(error) || "";
    logger.error("PAYOUT_FAILED: Payout creation failed", { userId, error });

    const isConnectionNeverEstablished =
      errorMsg.includes("ECONNREFUSED") ||
      errorMsg.includes("ENOTFOUND");

    if (isConnectionNeverEstablished) {
      // Request never reached Razorpay — definitely safe to restore balance
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await PaymentService.refundFailedWithdrawal(
          withdrawalId,
          tx,
          errorMsg || "Connection never established",
          undefined,
          false
        );
      });
      // Release idempotency key since request never reached Razorpay
      await releaseIdempotencyKey(idempotencyKey, userId);
      throw AppError.badRequest(`Payout failed: connection error. Funds returned to wallet.`);
    }

    const isAmbiguousTimeout =
      errorMsg.includes("timeout") ||
      errorMsg.includes("fetch") ||
      errorMsg.includes("network") ||
      errorMsg.includes("Circuit is OPEN");

    if (isAmbiguousTimeout) {
      // Genuinely ambiguous — keep as PROCESSING for webhook reconciliation
      logger.warn("Payout request timed out or network error occurred. Keeping status as PROCESSING for background/webhook reconciliation.", { userId, withdrawalId });
      return { success: true, status: "PROCESSING" };
    }

    const statusCode = (error as { statusCode?: number })?.statusCode;
    const is4xxGatewayError =
      (statusCode !== undefined && statusCode >= 400 && statusCode < 500) ||
      errorMsg.includes("STATUS_CODE:400") ||
      errorMsg.includes("STATUS_CODE:422") ||
      errorMsg.includes("STATUS_CODE:404") ||
      errorMsg.includes("bad request") ||
      errorMsg.includes("invalid account") ||
      errorMsg.includes("invalid ifsc");

    if (is4xxGatewayError) {
      logger.warn("PAYOUT_REJECTED: Razorpay rejected with 4xx — immediately refunding wallet", {
        userId,
        withdrawalId,
        error: errorMsg,
      });
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await PaymentService.refundFailedWithdrawal(
          withdrawalId,
          tx,
          `Gateway 4xx rejection: ${errorMsg}`,
          undefined,
          false
        );
      });
      await releaseIdempotencyKey(idempotencyKey, userId);
      throw AppError.badRequest(`Payout rejected by gateway: ${errorMsg}. Funds returned to wallet.`);
    }

    // Non-connection, non-timeout, non-deterministic error from Razorpay.
    // Strategy: Keep withdrawal in PROCESSING status with ambiguous=true.
    // The payout webhook will reconcile the final state.
    await prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        failureReason: `Ambiguous gateway error awaiting webhook reconciliation: ${errorMsg}`,
        adminNotes: `Ambiguous gateway error at ${new Date().toISOString()}: ${errorMsg}`,
      },
    });
    logger.error("PAYOUT_AMBIGUOUS: Non-connection error from Razorpay keeping PROCESSING, awaiting webhook", {
      userId,
      withdrawalId,
      error: errorMsg,
    });
    throw AppError.badRequest(`GATEWAY_AMBIGUOUS`);
  }

  static async initiateWithdrawal(userId: string, data: { amount: number; bankAccountName: string; bankAccountNumber: string; ifscCode: string; upiId?: string }, idempotencyKey: string) {
    // Guard: amount must be a positive integer (in paise). Negative or float values
    // would bypass the balance >= check and execute decrement(negative) = balance inflation.
    if (!Number.isInteger(data.amount) || data.amount <= 0) {
      throw AppError.badRequest("INVALID_WITHDRAWAL_AMOUNT");
    }

    const withdrawal = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { status: true, trustScore: true },
      });

      if (!user || ["SUSPENDED", "BANNED", "FLAGGED", "DELETED"].includes(user.status || "")) {
        logger.warn("Withdrawal blocked: user account is suspended, banned, flagged, or deleted", {
          userId,
          status: user?.status,
        });
        throw AppError.badRequest("WITHDRAWAL_BLOCK");
      }

      // Determine withdrawal processing speed based on trust score
      const withdrawalSpeed = getWithdrawalSpeed(user.trustScore);
      const trustBasedManualReview = withdrawalSpeed === "MANUAL_REVIEW";
      if (trustBasedManualReview) {
        logger.warn("Withdrawal routed to manual review due to low trust score", {
          userId,
          trustScore: user.trustScore,
          withdrawalSpeed,
        });
      } else {
        logger.info("Withdrawal speed tier determined", { userId, withdrawalSpeed, trustScore: user.trustScore });
      }

      const fraudCheck = await checkPaymentFraud({
        userId,
        amount: data.amount,
        bankAccount: data.bankAccountNumber,
        upiId: data.upiId,
      });

      if (fraudCheck.action === "BLOCK") {
        logger.warn("Withdrawal blocked by fraud check", {
          userId,
          amount: data.amount,
          flags: fraudCheck.flags.map((f) => f.description).join(", "),
        });
        throw AppError.badRequest("WITHDRAWAL_BLOCK");
      }

      return await PaymentService.executeWithdrawalDbTransaction(
        tx,
        userId,
        data,
        idempotencyKey,
        fraudCheck.action,
        fraudCheck.riskScore,
        trustBasedManualReview
      );
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });

    if ("alreadyProcessed" in withdrawal) {
      return { success: true, alreadyProcessed: true };
    }

    if (withdrawal.w.status === "PENDING_REVIEW") {
      return { success: true, status: "PENDING_REVIEW" };
    }

    try {
      const payout = await createPayout({
        accountNumber: data.bankAccountNumber,
        ifscCode: data.ifscCode,
        beneficiaryName: data.bankAccountName,
        amount: data.amount,
        referenceId: withdrawal.w.id,
        userId,
        ...(data.upiId ? { upiId: data.upiId } : {}),
      });

      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        if (payout.status === "processed") {
          // Guard against concurrent webhook having already set the status
          const updateCount = await tx.withdrawal.updateMany({
            where: { id: withdrawal.w.id, status: { notIn: ["COMPLETED", "FAILED", "REVERSED"] } },
            data: { status: "COMPLETED", processedAt: new Date(), razorpayPayoutId: payout.payoutId }
          });
          if (updateCount.count > 0) {
            await tx.transaction.update({
              where: { id: withdrawal.t.id },
              data: { status: "COMPLETED" }
            });
            await tx.wallet.update({
              where: { userId },
              data: { totalWithdrawn: { increment: data.amount } }
            });
          }
        } else if (["rejected", "failed", "reversed"].includes(payout.status)) {
          await PaymentService.refundFailedWithdrawal(
            withdrawal.w.id,
            tx,
            `Payout rejected/failed immediately with status ${payout.status}`,
            payout.payoutId,
            false
          );
        } else {
          // Guard against concurrent webhook having already finalized the status
          await tx.withdrawal.updateMany({
            where: { id: withdrawal.w.id, status: { notIn: ["COMPLETED", "FAILED", "REVERSED"] } },
            data: { status: "PROCESSING", razorpayPayoutId: payout.payoutId }
          });
        }
      });

      return { success: true, status: payout.status };
    } catch (error: unknown) {
      return await PaymentService.handlePayoutError(error, withdrawal.w.id, userId, idempotencyKey);
    }
  }

static async refundFailedWithdrawal(
withdrawalId: string,
tx: Prisma.TransactionClient,
reason: string,
razorpayPayoutId?: string,
createRefundTx = false,
status: "FAILED" | "REVERSED" = "FAILED"
): Promise<boolean> {
const updated = await tx.withdrawal.updateMany({
where: {
id: withdrawalId,
status: { notIn: ["COMPLETED", "FAILED", "REVERSED"] },
},
data: {
status,
failureReason: reason,
...(razorpayPayoutId ? { razorpayPayoutId } : {}),
processedAt: new Date(),
},
});

if (updated.count === 0) {
logger.warn("Skipping payout refund: withdrawal already processed or failed", { withdrawalId });
return false;
}

const w = await tx.withdrawal.findUnique({
where: { id: withdrawalId },
});
if (!w) throw AppError.notFound("Withdrawal not found during refund");

await tx.wallet.update({
where: { id: w.walletId },
data: { balance: { increment: w.amount } },
});

await tx.transaction.updateMany({
where: { withdrawalId, type: "WITHDRAWAL", status: "PENDING" },
data: { status },
});

    const shouldCreateRefundTx = createRefundTx || status === "REVERSED";
    if (shouldCreateRefundTx) {
      await tx.transaction.create({
        data: {
          walletId: w.walletId,
          withdrawalId,
          type: "REFUND",
          amount: w.amount,
          status: "COMPLETED",
          description: reason,
        },
      });
    }

  return true;
  }

  /**
   * Shared helper: atomically marks a pending top-up transaction as COMPLETED and
   * increments the wallet balance + totalDeposited.
   *
   * Used by both the Razorpay webhook handler and the client-side verify endpoint
   * to eliminate duplicate payment-completion logic.
   *
   * @returns true if the transaction was updated (first caller), false if it was
   *   already processed (idempotent guard — the updateMany matched 0 rows).
   */
  static async completeWalletTopUp(
    tx: Prisma.TransactionClient,
    params: {
      transactionId: string;
      walletId: string;
      amount: number;
      razorpayPaymentId: string;
    },
  ): Promise<boolean> {
    const updated = await tx.transaction.updateMany({
      where: { id: params.transactionId, status: "PENDING" },
      data: {
        status: "COMPLETED",
        razorpayPaymentId: params.razorpayPaymentId,
      },
    });

    if (updated.count === 0) return false;

    await tx.wallet.update({
      where: { id: params.walletId },
      data: {
        balance: { increment: params.amount },
        totalDeposited: { increment: params.amount },
      },
    });

    return true;
  }
}
