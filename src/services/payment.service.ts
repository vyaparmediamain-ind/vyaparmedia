import { AppError } from "@/lib/errors";
import { Prisma } from "@prisma/client";
import prisma, { ensurePlatformTreasury } from "@/lib/db";
import {
createOrder,
createPayout,
getOrCreateLinkedAccount,
releaseTransferHold,
reverseTransfer,
refundPayment,
checkLinkedAccountActivation,
fetchPaymentTransfers,
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
import { transitionDealState } from "@/lib/deal-state-machine";
import { randomUUID } from "node:crypto";
import { recordPaymentFailure } from "@/lib/observability";

import { checkWalletTopUpEligibility } from "@/lib/action-eligibility";

export class PaymentService {
  static async createWalletTopUpOrder(
    userId: string,
    amountInPaise: number,
    idempotencyKey?: string,
  ) {
    if (!Number.isInteger(amountInPaise)) {
      throw AppError.badRequest("Top-up amount in paise must be an integer (Minimum top-up amount is ₹1)");
    }
    if (amountInPaise < 100) {
      throw AppError.badRequest("Minimum top-up amount is ₹1");
    }
    if (amountInPaise > 100_000_000) {
      throw AppError.badRequest("Top-up amount exceeds maximum allowed (₹10,00,000)");
    }

    // L9 FIX: Blocked/suspended users must not be able to top up.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });

    const wallet = await prisma.wallet.upsert({
      where: { userId },
      create: { userId, balance: 0, pendingBalance: 0 },
      update: {},
    });

    const eligibility = checkWalletTopUpEligibility(
      amountInPaise / 100,
      wallet,
      user?.status
    );
    if (!eligibility.allowed) {
      if (eligibility.reason?.includes("frozen")) {
        throw AppError.badRequest("WALLET_FROZEN: Your wallet is currently frozen or locked");
      }
      if (eligibility.reason?.includes("restricted")) {
        throw AppError.forbidden(eligibility.reason);
      }
      throw AppError.badRequest(eligibility.reason || "Invalid top-up request");
    }

    const receipt = `wallet_${userId}_${Date.now()}`;
    const order = await createOrder({
      amount: amountInPaise,
      currency: "INR",
      receipt,
      notes: {
        type: "wallet_topup",
        user_id: userId,
        ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
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
        ...(idempotencyKey ? { metadata: { idempotencyKey } } : {}),
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
            status: "DISPUTED",
            rejectionReason: `LATE_POST_BLOCKED: Post verified/submitted after deadline (Posted: ${deal.postedAt?.toISOString() ?? "N/A"}, Verified: ${deal.verifiedAt?.toISOString() ?? "N/A"}, Deadline: ${deal.postingDeadline?.toISOString() ?? "N/A"})`,
          },
        });
        logger.warn("PAYOUT_BLOCKED: Post verified/submitted after deadline deal moved to DISPUTED for admin review", {
          dealId,
          postedAt: deal.postedAt,
          verifiedAt: deal.verifiedAt,
          deadline: deal.postingDeadline,
        });
        throw AppError.badRequest("LATE_POST_PAYMENT_BLOCKED");
      }
    }
  }

  /**
   * TWO-PHASE COMPLETION PATTERN
   * Phase 1: DB Lock & Validate (Atomic)
   * Phase 2: DB Transaction for state updates
   */
  static async processDealCompletion(dealId: string) {
    const lockToken = randomUUID();
    const lockKey = `lock:deal_completion:${dealId}`;
    const acquired = await redis.set(lockKey, lockToken, "EX", 60, "NX");
    if (!acquired) {
      logger.info("processDealCompletion already running for this deal, skipping.", { dealId });
      return;
    }
try {
const deal = await prisma.deal.findUnique({
where: { id: dealId },
include: { influencer: true, brand: true, paymentHold: true },
});

    if (
      !deal ||
      !["VERIFIED", "CONTENT_APPROVED"].includes(deal.status) ||
      (deal.status === "CONTENT_APPROVED" && deal.requiresPostVerification !== false)
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

const hasActiveRouteHold = Boolean(
  deal.paymentHold && ["HELD", "CAPTURED"].includes(deal.paymentHold.status)
);

if (
!deal.reservedFromWallet &&
!hasActiveRouteHold &&
(!brandWallet || brandWallet.pendingBalance < getDealTotalAmount(deal))
) {
throw AppError.badRequest("NO_RESERVED_CAMPAIGN_FUNDS");
}

    if (!["VERIFIED", "CONTENT_APPROVED"].includes(deal.status)) {
      return;
    }

    // P5-LOGIC-01 FIX: Transition deal state to COMPLETED under row lock BEFORE disbursing gateway funds.
    // If transition fails (e.g. concurrent dispute), external funds are NOT released.
    await transitionDealState({
      dealId: deal.id,
      fromState: deal.status,
      toState: "COMPLETED",
      actor: { userId: "SYSTEM_PAYMENT", role: "SYSTEM" },
      reason: "Deal successfully verified and completed with escrow release",
      metadata: {
        amount: deal.amount,
        influencerPayout: deal.influencerPayout ?? deal.amount,
        routeEscrowReleased: hasActiveRouteHold,
      },
      tx,
    });

    // If deal was funded via Razorpay Route, release the escrow hold on Razorpay
    if (hasActiveRouteHold && deal.paymentHold) {
      let transferId = "";
      try {
        transferId = (await redis.get(`rzp:route:transfer:${deal.id}`)) || "";
      } catch (redisErr) {
        logger.warn("Failed to get Route transfer ID from Redis, will query payment transfers as fallback", { dealId: deal.id, error: redisErr });
      }

      // Fallback: If not in Redis, look up transfers attached to the captured payment
      if (!transferId && deal.paymentHold.razorpayPaymentId) {
        try {
          const transfers = await fetchPaymentTransfers(deal.paymentHold.razorpayPaymentId);
          const firstTransfer = transfers[0];
          if (firstTransfer && firstTransfer.id) {
            transferId = firstTransfer.id;
            await redis.set(`rzp:route:transfer:${deal.id}`, transferId, "EX", 86400 * 30).catch((redisErr) => {
              logger.warn("Failed to cache Route transfer ID in Redis", { dealId: deal.id, error: redisErr });
            });
          }
        } catch (fetchErr) {
          logger.warn("Could not query payment transfers as fallback", {
            paymentId: deal.paymentHold.razorpayPaymentId,
            error: fetchErr,
          });
        }
      }

      if (!transferId) {
        // Record failure so that hold is tracked as FAILED for manual/cron intervention
        await prisma.paymentHold.update({
          where: { id: deal.paymentHold.id },
          data: { status: "FAILED" },
        }).catch((updateErr) => {
          logger.warn("Failed to mark PaymentHold as FAILED after missing transfer ID", { dealId: deal.id, error: updateErr });
        });

        logger.critical("ESCROW_RELEASE_FAILED: Missing transfer ID for Route deal escrow release", {
          dealId: deal.id,
          paymentHoldId: deal.paymentHold.id,
        });

        // Persist to DeadLetterJob so automated reconciliation and alert queues can pick it up
        await prisma.deadLetterJob.create({
          data: {
            category: "TIME_CRITICAL",
            topic: "payment.escrow_release_missing_transfer",
            deduplicationId: `escrow_missing_tx_${deal.id}`,
            endpoint: "/api/escrow/release",
            payload: {
              dealId: deal.id,
              paymentHoldId: deal.paymentHold.id,
              paymentId: deal.paymentHold.razorpayPaymentId,
              amount: deal.amount,
            },
            errorMessage: "Razorpay Route transfer ID could not be identified to release funds to creator",
            attempts: 1,
            maxRetries: 5,
            status: "FAILED",
          },
        }).catch((dlqErr) => {
          logger.error("Failed to record DeadLetterJob for missing Route transfer ID", dlqErr);
        });

        throw AppError.internal(
          "ESCROW_RELEASE_FAILED: Unable to identify escrow transfer hold"
        );
      }

      try {
        await releaseTransferHold(transferId);
      } catch (err) {
        // Persist FAILED status on paymentHold outside the rolling back transaction
        await prisma.paymentHold.update({
          where: { id: deal.paymentHold.id },
          data: { status: "FAILED" },
        }).catch((updateErr) => {
          logger.warn("Failed to mark PaymentHold as FAILED after release error", { dealId: deal.id, error: updateErr });
        });

        logger.critical("ESCROW_RELEASE_FAILED: Failed to release transfer hold on Razorpay Route", {
          dealId: deal.id,
          transferId,
          error: err instanceof Error ? err.message : String(err),
        });

        // Persist to DeadLetterJob for automated background worker retries and Ops alerting
        await prisma.deadLetterJob.create({
          data: {
            category: "TIME_CRITICAL",
            topic: "payment.escrow_release_gateway_failed",
            deduplicationId: `escrow_release_failed_${deal.id}_${transferId}`,
            endpoint: "/api/escrow/release",
            payload: {
              dealId: deal.id,
              paymentHoldId: deal.paymentHold.id,
              transferId,
              amount: deal.amount,
            },
            errorMessage: err instanceof Error ? err.message : "Gateway error during releaseTransferHold",
            attempts: 1,
            maxRetries: 5,
            status: "FAILED",
          },
        }).catch((dlqErr) => {
          logger.error("Failed to record DeadLetterJob for failed transfer hold release", dlqErr);
        });

        // DO NOT silently swallow! Rethrow so database transaction rolls back,
        // preventing deal from being falsely marked as COMPLETED.
        throw AppError.internal(
          "ESCROW_RELEASE_FAILED: Gateway failed to release escrow hold"
        );
      }

      await tx.paymentHold.update({
        where: { id: deal.paymentHold.id },
        data: {
          status: "RELEASED",
          releasedAt: new Date(),
        },
      });
    }

if (brandWallet && !deal.reservedFromWallet && !hasActiveRouteHold) {
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
// reservedFromWallet deals or Route-held deals — just update totalSpent, no pendingBalance change needed
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
const isDirectGatewaySettlement = Boolean(hasActiveRouteHold);

await creditInfluencerPayoutWithTax(
  tx,
  {
    userId: deal.influencer.userId,
    dealId: deal.id,
    grossPayout: influencerPayout,
    description: isDirectGatewaySettlement
      ? `Direct gateway settlement for deal: ${deal.id}`
      : `Payout for deal: ${deal.id}`,
    razorpayPaymentId: null,
    metadata: {
      balanceImpact: !isDirectGatewaySettlement,
      source: isDirectGatewaySettlement ? "route_direct_settlement" : "wallet_completion",
      directGatewaySettlement: isDirectGatewaySettlement,
    },
    balanceImpact: !isDirectGatewaySettlement,
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
}, {
      maxWait: 10000,
      timeout: 20000,
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
throw error;
}
    } finally {
      // Safely release only OUR lock via Lua CAS to avoid deleting another worker's lock
      const releaseLua = `
        if redis.call('get', KEYS[1]) == ARGV[1] then
          return redis.call('del', KEYS[1])
        else
          return 0
        end
      `;
      await redis.eval(releaseLua, 1, lockKey, lockToken).catch((delErr) => {
        logger.error("Failed to release deal completion lock", delErr, { lockKey });
      });
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

    if (updateResult.count === 0) {
      const wCheck = await tx.wallet.findUnique({
        where: { userId },
        select: { isFrozen: true, balance: true },
      });
      if (!wCheck) {
        throw AppError.notFound("User wallet not found");
      }
      if (wCheck.isFrozen) {
        throw AppError.badRequest("WALLET_FROZEN: Your wallet is currently frozen or locked");
      }
      throw AppError.badRequest("INSUFFICIENT_FUNDS: Insufficient wallet balance for withdrawal");
    }

    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      throw AppError.notFound("User wallet not found");
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
  ): Promise<{ success: boolean; status: string; id?: string; withdrawalId?: string }> {
    const errorMsg = getErrorMessage(error) || "";
    logger.error("PAYOUT_FAILED: Payout creation failed", { userId, error });

    const errCause = (error as { cause?: { code?: string; message?: string } })?.cause;
    const causeCode = errCause?.code || "";
    const causeMsg = errCause?.message || "";

    const isConnectionNeverEstablished =
      errorMsg.includes("ECONNREFUSED") ||
      errorMsg.includes("ENOTFOUND") ||
      causeCode === "ECONNREFUSED" ||
      causeCode === "ENOTFOUND" ||
      causeMsg.includes("ECONNREFUSED") ||
      causeMsg.includes("ENOTFOUND");

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

    if (errorMsg.includes("Circuit is OPEN")) {
      // Circuit breaker is open — request was never dispatched to Razorpay. Safe to restore balance immediately.
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await PaymentService.refundFailedWithdrawal(
          withdrawalId,
          tx,
          "Payout service temporarily unavailable (circuit open)",
          undefined,
          false
        );
      });
      await releaseIdempotencyKey(idempotencyKey, userId);
      throw AppError.badRequest("Payout gateway is temporarily down for maintenance. Funds have been returned to your wallet.");
    }

    const isAmbiguousTimeout =
      errorMsg.includes("ETIMEDOUT") ||
      errorMsg.includes("ESOCKETTIMEDOUT") ||
      errorMsg.toLowerCase().includes("timeout") ||
      causeCode === "ETIMEDOUT" ||
      causeCode === "UND_ERR_CONNECT_TIMEOUT" ||
      causeMsg.toLowerCase().includes("timeout");

    if (isAmbiguousTimeout) {
      // Genuinely ambiguous — keep as PROCESSING for webhook reconciliation
      logger.warn("Payout request timed out or network error occurred. Keeping status as PROCESSING for background/webhook reconciliation.", { userId, withdrawalId });
      return { success: true, id: withdrawalId, withdrawalId, status: "PROCESSING" };
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
      recordPaymentFailure("PAYOUT_REJECTED_4XX", new Error(errorMsg), {
        userId,
        withdrawalId,
        statusCode,
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
      throw AppError.badRequest("PAYOUT_REJECTED: Withdrawal request could not be processed by payout gateway. Funds have been returned to your wallet.");
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
    recordPaymentFailure("PAYOUT_AMBIGUOUS_GATEWAY", new Error(errorMsg), {
      userId,
      withdrawalId,
      error: errorMsg,
    });
    throw AppError.gatewayAmbiguous("Gateway response ambiguous. Transaction awaiting webhook reconciliation.");
  }

  static async initiateWithdrawal(
    userId: string,
    data: {
      amount: number;
      bankAccountName: string;
      bankAccountNumber: string;
      ifscCode: string;
      upiId?: string;
      ipAddress?: string | undefined;
      deviceFingerprint?: string | undefined;
    },
    idempotencyKey: string,
  ) {
    // Guard: amount must be a positive integer (in paise). Negative or float values
    // would bypass the balance >= check and execute decrement(negative) = balance inflation.
    if (!Number.isInteger(data.amount) || data.amount <= 0) {
      throw AppError.badRequest("INVALID_WITHDRAWAL_AMOUNT");
    }

    const user = await prisma.user.findUnique({
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

    // Perform fraud check outside database transaction to prevent connection starvation and timeouts
    const fraudCheck = await checkPaymentFraud({
      userId,
      amount: data.amount,
      bankAccount: data.bankAccountNumber,
      upiId: data.upiId,
      bankAccountName: data.bankAccountName,
      ipAddress: data.ipAddress,
      deviceFingerprint: data.deviceFingerprint,
    });

    if (fraudCheck.action === "BLOCK") {
      logger.warn("Withdrawal blocked by fraud check", {
        userId,
        amount: data.amount,
        flags: fraudCheck.flags.map((f) => f.description).join(", "),
      });
      throw AppError.badRequest("WITHDRAWAL_BLOCK");
    }

    const withdrawal = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
      maxWait: 10000,
      timeout: 15000,
    });

    if ("alreadyProcessed" in withdrawal) {
      return { success: true, alreadyProcessed: true };
    }

    if (withdrawal.w.status === "PENDING_REVIEW") {
      return { success: true, id: withdrawal.w.id, withdrawalId: withdrawal.w.id, status: "PENDING_REVIEW" };
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

      return { success: true, id: withdrawal.w.id, withdrawalId: withdrawal.w.id, status: payout.status };
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
        status:
          status === "REVERSED"
            ? { in: ["COMPLETED", "PROCESSING", "PENDING"] }
            : { notIn: ["COMPLETED", "FAILED", "REVERSED"] },
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

    // If a completed payout was reversed, restore balance and decrement totalWithdrawn
    await tx.wallet.update({
      where: { id: w.walletId },
      data: {
        balance: { increment: w.amount },
        ...(status === "REVERSED" ? { totalWithdrawn: { decrement: w.amount } } : {}),
      },
    });

    await tx.transaction.updateMany({
      where: {
        withdrawalId,
        type: "WITHDRAWAL",
        status: status === "REVERSED" ? { in: ["COMPLETED", "PENDING"] } : "PENDING",
      },
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
      where: {
        id: params.transactionId,
        status: { notIn: ["COMPLETED", "FAILED", "REVERSED"] },
      },
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

  /**
   * Initialize a Razorpay Route Escrow Order for direct deal funding.
   * RBI-compliant architecture: Brand payment is held in Razorpay regulated escrow
   * with transfers[].on_hold = true to the creator's Linked Account.
   */
  static async createDealRouteEscrowOrder(params: {
    dealId: string;
    brandUserId: string;
    idempotencyKey?: string;
  }) {
    const deal = await prisma.deal.findUnique({
      where: { id: params.dealId },
      include: {
        brand: true,
        influencer: {
          include: {
            user: {
              include: {
                bankAccounts: {
                  where: { isVerified: true, deletedAt: null },
                  orderBy: { isDefault: "desc" },
                },
              },
            },
          },
        },
      },
    });

    if (!deal) {
      throw AppError.notFound("Deal not found");
    }

    if (deal.brand?.userId !== params.brandUserId) {
      throw AppError.forbidden("Only the brand owner can fund this deal");
    }

    if (["COMPLETED", "CANCELLED", "ACTIVE", "PAYMENT_HELD"].includes(deal.status)) {
      throw AppError.badRequest(`Deal is in ${deal.status} status and cannot be funded`);
    }

    const creatorUser = deal.influencer.user;
    const defaultBank = creatorUser.bankAccounts[0];

    if (!defaultBank) {
      throw AppError.badRequest(
        "Creator has not added a verified bank account for payouts. Please ask the creator to add and verify their bank account before funding escrow."
      );
    }

    // Onboard creator to Razorpay Route (linked account id acc_...)
    const creatorAccountId = await getOrCreateLinkedAccount(creatorUser.id, {
      email: creatorUser.email,
      name: deal.influencer.displayName || "Vyapar Creator",
      phone: creatorUser.phone || undefined,
      accountNumber: defaultBank.accountNumber,
      ifscCode: defaultBank.ifscCode,
    });

    // Verify creator's linked account activation on Razorpay Route
    const activation = await checkLinkedAccountActivation(creatorAccountId);
    if (!activation.isActivated) {
      throw AppError.badRequest(
        activation.reason ||
          `Creator's gateway payout account is pending KYC activation (status: ${activation.status}). Funds cannot be routed until KYC is approved.`
      );
    }

    const influencerPayout = deal.influencerPayout ?? deal.amount;
    const receipt = `deal_route_${deal.id}_${Date.now()}`;

    // Create split settlement order with on_hold: true
    const order = await createOrder({
      amount: deal.totalAmount,
      currency: "INR",
      receipt,
      notes: {
        type: "route_deal_escrow",
        deal_id: deal.id,
        brand_user_id: params.brandUserId,
        influencer_user_id: creatorUser.id,
        ...(params.idempotencyKey ? { idempotency_key: params.idempotencyKey } : {}),
      },
      transfers: [
        {
          account: creatorAccountId,
          amount: influencerPayout,
          currency: "INR",
          on_hold: true, // Holds funds securely in Razorpay Escrow until deliverable approval
          notes: {
            deal_id: deal.id,
            type: "creator_deal_payout",
          },
        },
      ],
    });

    // Record or update PaymentHold
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.paymentHold.upsert({
      where: { dealId: deal.id },
      create: {
        dealId: deal.id,
        razorpayOrderId: order.orderId,
        amount: deal.totalAmount,
        status: "PENDING",
        expiresAt,
      },
      update: {
        razorpayOrderId: order.orderId,
        amount: deal.totalAmount,
        status: "PENDING",
        expiresAt,
      },
    });

    // If order returned transfers, cache the transfer ID in Redis
    const firstTransfer = order.transfers?.[0];
    if (firstTransfer?.id) {
      try {
        await redis.set(`rzp:route:transfer:${deal.id}`, firstTransfer.id, "EX", 86400 * 30);
      } catch (err) {
        logger.warn("Failed to cache Route transfer ID in Redis during escrow init", { dealId: deal.id, error: err });
      }
    }

    return {
      orderId: order.orderId,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID,
      creatorAccountId,
    };
  }

  /**
   * Cancel a deal funded via Razorpay Route: reverses the transfer hold and refunds the brand.
   */
  static async cancelDealWithRouteRefund(dealId: string, reason: string) {
    const paymentHold = await prisma.paymentHold.findUnique({
      where: { dealId },
    });

    if (paymentHold && paymentHold.status === "HELD") {
      let transferId = "";
      try {
        transferId = (await redis.get(`rzp:route:transfer:${dealId}`)) || "";
      } catch (err) {
        logger.warn("Failed to get Route transfer ID from Redis during cancellation", { dealId, error: err });
      }

      if (transferId) {
        try {
          await reverseTransfer({
            transferId,
            amount: paymentHold.amount,
            notes: { dealId, reason },
          });
        } catch (err) {
          logger.error("Failed to reverse Route transfer", { dealId, transferId, error: err });
          await prisma.deadLetterJob.create({
            data: {
              category: "TIME_CRITICAL",
              topic: "payment.route_cancel_reverse_failed",
              deduplicationId: `cancel_reverse_${dealId}`,
              endpoint: "/api/deals/cancel",
              payload: {
                dealId,
                paymentHoldId: paymentHold.id,
                transferId,
                amount: paymentHold.amount,
                reason,
              },
              errorMessage: err instanceof Error ? err.message : String(err),
              attempts: 1,
              maxRetries: 5,
              status: "FAILED",
            },
          }).catch((dlqErr) => {
            logger.error("Failed to record DeadLetterJob for failed route transfer reversal", dlqErr);
          });
        }
      }

      if (paymentHold.razorpayPaymentId) {
        try {
          await refundPayment({
            paymentId: paymentHold.razorpayPaymentId,
            amount: paymentHold.amount,
            notes: { dealId, reason },
          });
        } catch (err) {
          logger.error("Failed to refund brand payment", { dealId, error: err });
          await prisma.deadLetterJob.create({
            data: {
              category: "TIME_CRITICAL",
              topic: "payment.route_cancel_refund_failed",
              deduplicationId: `cancel_refund_${dealId}`,
              endpoint: "/api/deals/cancel",
              payload: {
                dealId,
                paymentHoldId: paymentHold.id,
                paymentId: paymentHold.razorpayPaymentId,
                amount: paymentHold.amount,
                reason,
              },
              errorMessage: err instanceof Error ? err.message : String(err),
              attempts: 1,
              maxRetries: 5,
              status: "FAILED",
            },
          }).catch((dlqErr) => {
            logger.error("Failed to record DeadLetterJob for failed route cancel refund", dlqErr);
          });
        }
      }

      await prisma.paymentHold.update({
        where: { id: paymentHold.id },
        data: { status: "FAILED" },
      });
    }
  }

  /**
   * Safely retry failed Route escrow release for deals stuck in FAILED hold status.
   */
  static async retryFailedRouteEscrowRelease(dealId: string) {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: { paymentHold: true },
    });

    if (!deal || !deal.paymentHold) {
      throw AppError.notFound("Deal or PaymentHold not found");
    }

    if (deal.paymentHold.status !== "FAILED") {
      throw AppError.badRequest(`PaymentHold is in status '${deal.paymentHold.status}', not FAILED.`);
    }

    if (!["VERIFIED", "CONTENT_APPROVED"].includes(deal.status)) {
      throw AppError.badRequest(`Deal is in status '${deal.status}', which cannot be completed.`);
    }

    // Reset hold status to HELD so processDealCompletion can attempt release again
    await prisma.paymentHold.update({
      where: { id: deal.paymentHold.id },
      data: { status: "HELD" },
    });

    return await PaymentService.processDealCompletion(dealId);
  }
}
