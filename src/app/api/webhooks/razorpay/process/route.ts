import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";
import { isWebhookProcessed, markWebhookProcessed } from "@/lib/idempotency";
import { PaymentService } from "@/services/payment.service";
import { sendWithdrawalEmail } from "@/lib/email";
import { WebhookJobPayload } from "@/lib/qstash";
import { recordWebhookAnomaly, recordPaymentFailure } from "@/lib/observability";
import { transitionDealState } from "@/lib/deal-state-machine";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

/**
 * Heavy Webhook Background Processor
 * Handles amount verification, terminal-state guards, atomic ledger mutations, and email notifications.
 */
export async function processWebhookEventInternal(
  job: WebhookJobPayload,
): Promise<{ success: boolean; message: string }> {
  // 1. Double-check DB Idempotency before doing any work
  const alreadyProcessed = await isWebhookProcessed(job.eventId);
  if (alreadyProcessed) {
    logger.info("Webhook event already recorded in ProcessedWebhookEvent table, skipping", {
      eventId: job.eventId,
      eventType: job.eventType,
    });
    return { success: true, message: "Duplicate webhook ignored" };
  }

  const payload = job.payload as {
    event?: string;
    payload?: {
      payment?: {
        entity?: {
          id: string;
          order_id?: string;
          amount: number;
        };
      };
      payout?: {
        entity?: {
          id: string;
          amount: number;
          status: string;
          reference_id?: string;
          failure_reason?: string;
          utr?: string;
        };
      };
      refund?: {
        entity?: {
          id: string;
          payment_id?: string;
          amount?: number;
          status?: string;
        };
      };
    };
  };

  const event = payload?.event || job.eventType;

  // payment.captured: Top-Up / Deal Escrow Payment
  if (event === "payment.captured") {
    const payment = payload?.payload?.payment?.entity;
    if (!payment) {
      logger.warn("Malformed payment.captured entity", { eventId: job.eventId });
      return { success: false, message: "Missing payment entity" };
    }

    const orderId = payment.order_id;
    const paymentId = payment.id;
    const capturedAmount = payment.amount;

    if (!orderId || !paymentId || !Number.isInteger(capturedAmount) || capturedAmount <= 0) {
      logger.warn("Malformed payment.captured values", { orderId, paymentId, capturedAmount });
      return { success: false, message: "Invalid payment fields" };
    }

    // Check if this payment is for a deal escrow hold (Razorpay Route)
    const paymentHold = await prisma.paymentHold.findUnique({
      where: { razorpayOrderId: orderId },
      include: { deal: true },
    });

    if (paymentHold) {
      if (paymentHold.status === "RELEASED") {
        logger.info("PaymentHold already released, ignoring duplicate capture event", { orderId, paymentId });
        await markWebhookProcessed(job.eventId, job.eventType, job.payload as Prisma.InputJsonValue);
        return { success: true, message: "Already released" };
      }

      await prisma.paymentHold.update({
        where: { id: paymentHold.id },
        data: {
          status: "HELD",
          capturedAt: new Date(),
          razorpayPaymentId: paymentId,
        },
      });

      if (
        paymentHold.deal &&
        ["PAYMENT_PENDING", "PENDING_SIGNATURE"].includes(paymentHold.deal.status)
      ) {
        await transitionDealState({
          dealId: paymentHold.deal.id,
          fromState: paymentHold.deal.status,
          toState: "PAYMENT_HELD",
          actor: { userId: "SYSTEM_WEBHOOK", role: "SYSTEM" },
          reason: "Brand deal payment captured and escrow hold locked via Razorpay Route",
          metadata: {
            paymentId,
            orderId,
            amount: capturedAmount,
          },
        });
      }

      await markWebhookProcessed(job.eventId, job.eventType, job.payload as Prisma.InputJsonValue);
      return { success: true, message: "Deal escrow hold secured via Razorpay Route" };
    }

    const transaction = await prisma.transaction.findFirst({
      where: { razorpayOrderId: orderId },
      select: {
        id: true,
        walletId: true,
        amount: true,
        status: true,
      },
    });

    if (!transaction) {
      logger.warn("Webhook: Transaction not found for orderId", { orderId });
      await markWebhookProcessed(job.eventId, job.eventType, job.payload as Prisma.InputJsonValue);
      return { success: true, message: "Orphan event acknowledged" };
    }

    // Terminal-State Guard: Already completed or failed record cannot be re-processed
    if (["COMPLETED", "FAILED", "REVERSED"].includes(transaction.status)) {
      logger.info("Transaction is already in terminal state, ignoring webhook", {
        transactionId: transaction.id,
        status: transaction.status,
      });
      await markWebhookProcessed(job.eventId, job.eventType, job.payload as Prisma.InputJsonValue);
      return { success: true, message: "Already terminal" };
    }

    // Amount Verification: strictly compare received amount with expected DB amount
    if (transaction.amount !== capturedAmount) {
      logger.error("AMOUNT_MISMATCH: Webhook amount does not match expected transaction amount", {
        transactionId: transaction.id,
        expectedAmount: transaction.amount,
        capturedAmount,
        orderId,
        paymentId,
      });

      recordWebhookAnomaly("AMOUNT_MISMATCH", {
        eventId: job.eventId,
        eventType: job.eventType,
        orderId,
        paymentId,
        expectedAmount: transaction.amount,
        receivedAmount: capturedAmount,
        transactionId: transaction.id,
      });

      // Mark transaction as FAILED with terminal state guard
      await prisma.transaction.updateMany({
        where: {
          id: transaction.id,
          status: { notIn: ["COMPLETED", "FAILED", "REVERSED"] },
        },
        data: {
          status: "FAILED",
          description: `Failed due to top-up amount mismatch: expected ${transaction.amount} Paise, got ${capturedAmount} Paise`,
        },
      });

      await markWebhookProcessed(job.eventId, job.eventType, job.payload as Prisma.InputJsonValue);
      return { success: false, message: "Amount mismatch: transaction marked FAILED" };
    }

    // Atomic completion of wallet top-up
    await prisma.$transaction(async (tx) => {
      await PaymentService.completeWalletTopUp(tx, {
        transactionId: transaction.id,
        walletId: transaction.walletId,
        amount: transaction.amount,
        razorpayPaymentId: paymentId,
      });
    });

    await markWebhookProcessed(job.eventId, job.eventType, job.payload as Prisma.InputJsonValue);
    return { success: true, message: "Top-up completed" };
  }

  // payout.*: payout.processed / payout.failed / payout.reversed
  if (event.startsWith("payout.")) {
    const payout = payload?.payload?.payout?.entity;
    const withdrawalId = payout?.reference_id;
    const payoutId = payout?.id;
    const payoutAmount = payout?.amount;

    if (!withdrawalId || !payoutId) {
      logger.warn("Malformed payout webhook payload", { eventId: job.eventId });
      return { success: false, message: "Missing payout reference" };
    }

    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
      include: {
        wallet: {
          include: {
            user: {
              select: { email: true },
            },
          },
        },
      },
    });

    if (!withdrawal) {
      logger.warn("Withdrawal not found for payout webhook", { withdrawalId, payoutId });
      await markWebhookProcessed(job.eventId, job.eventType, job.payload as Prisma.InputJsonValue);
      return { success: true, message: "Orphan payout event acknowledged" };
    }

    // Amount Verification for payout
    if (payoutAmount !== undefined && withdrawal.amount !== payoutAmount) {
      logger.error("PAYOUT_AMOUNT_MISMATCH: Webhook payout amount differs from withdrawal amount", {
        withdrawalId,
        expected: withdrawal.amount,
        received: payoutAmount,
      });
    }

    const transaction = await prisma.transaction.findFirst({
      where: { withdrawalId: withdrawal.id },
      select: { id: true, status: true },
    });

    // Terminal-State Guard: ignore if already in terminal state unless it's a reversal of a completed payout
    if (
      ["COMPLETED", "FAILED", "REVERSED"].includes(withdrawal.status) &&
      !(withdrawal.status === "COMPLETED" && event === "payout.reversed")
    ) {
      logger.info("Withdrawal is already in terminal state, ignoring webhook", {
        withdrawalId,
        status: withdrawal.status,
      });
      await markWebhookProcessed(job.eventId, job.eventType, job.payload as Prisma.InputJsonValue);
      return { success: true, message: "Already terminal" };
    }

    await prisma.$transaction(async (tx) => {
      if (event === "payout.processed") {
        const updateCount = await tx.withdrawal.updateMany({
          where: {
            id: withdrawal.id,
            status: { notIn: ["COMPLETED", "FAILED", "REVERSED"] },
          },
          data: {
            status: "COMPLETED",
            processedAt: new Date(),
            razorpayPayoutId: payoutId,
            ...(payout?.utr ? { utr: payout.utr } : {}),
          },
        });

        if (updateCount.count > 0 && transaction) {
          await tx.transaction.updateMany({
            where: {
              id: transaction.id,
              status: { notIn: ["COMPLETED", "FAILED", "REVERSED"] },
            },
            data: { status: "COMPLETED" },
          });

          await tx.wallet.update({
            where: { id: withdrawal.walletId },
            data: { totalWithdrawn: { increment: withdrawal.amount } },
          });
        }
      } else if (event === "payout.failed" || event === "payout.rejected") {
        const failureReason = payout?.failure_reason || `Payout failed via webhook (${event})`;
        recordPaymentFailure("PAYOUT_FAILED_WEBHOOK", new Error(failureReason), {
          withdrawalId: withdrawal.id,
          payoutId,
          amount: withdrawal.amount,
          reason: failureReason,
          event,
        });
        await PaymentService.refundFailedWithdrawal(
          withdrawal.id,
          tx,
          failureReason,
          payoutId,
          false,
        );
      } else if (event === "payout.reversed") {
        const reversalReason = payout?.failure_reason || "Bank payout reversed after settlement";
        recordPaymentFailure("PAYOUT_REVERSED_WEBHOOK", new Error(reversalReason), {
          withdrawalId: withdrawal.id,
          payoutId,
          amount: withdrawal.amount,
          reason: reversalReason,
          event,
        });
        await PaymentService.refundFailedWithdrawal(
          withdrawal.id,
          tx,
          reversalReason,
          payoutId,
          true,
        );
      }
    });

    // Send email notification in background
    if (withdrawal.wallet?.user?.email) {
      const emailStatus = event === "payout.processed" ? "success" : "failed";
      sendWithdrawalEmail(withdrawal.wallet.user.email, withdrawal.amount, emailStatus).catch((err) => {
        logger.error("Failed to send withdrawal email", {
          withdrawalId,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }

    await markWebhookProcessed(job.eventId, job.eventType, job.payload as Prisma.InputJsonValue);
    return { success: true, message: "Payout event processed" };
  }

  // transfer.*: Route split transfer reconciliation updates
  if (event.startsWith("transfer.")) {
    const transferEntity = (payload?.payload as Record<string, unknown>)?.transfer as
      | {
          entity?: {
            id?: string;
            source?: string;
            recipient?: string;
            amount?: number;
            on_hold?: boolean;
            status?: string;
            notes?: Record<string, string>;
            error_code?: string;
            error_description?: string;
          };
        }
      | undefined;
    const transfer = transferEntity?.entity;
    logger.info("Razorpay Route transfer event received", {
      event,
      transferId: transfer?.id,
      source: transfer?.source,
      account: transfer?.recipient,
      amount: transfer?.amount,
      onHold: transfer?.on_hold,
      status: transfer?.status,
    });

    const dealId = transfer?.notes?.deal_id;
    const paymentId = transfer?.source;

    // Resolve PaymentHold by dealId, razorpayPaymentId, or Redis transfer mapping
    let paymentHold = null;
    if (dealId) {
      paymentHold = await prisma.paymentHold.findUnique({
        where: { dealId },
        include: { deal: true },
      });
    }
    if (!paymentHold && paymentId) {
      paymentHold = await prisma.paymentHold.findFirst({
        where: { razorpayPaymentId: paymentId },
        include: { deal: true },
      });
    }

    if (transfer?.id && paymentHold) {
      await redis.set(`rzp:route:transfer:${paymentHold.dealId}`, transfer.id, "EX", 86400 * 30).catch((err) => {
        logger.warn("Failed to cache Route transfer ID in Redis from webhook", { dealId: paymentHold?.dealId, error: err });
      });
    }

    if (event === "transfer.processed") {
      if (paymentHold) {
        // When transfer hold is confirmed released (or status is processed/settled), reconcile DB to RELEASED
        if (transfer?.on_hold === false || transfer?.status === "processed" || transfer?.status === "settled") {
          if (paymentHold.status !== "RELEASED") {
            await prisma.paymentHold.update({
              where: { id: paymentHold.id },
              data: {
                status: "RELEASED",
                releasedAt: new Date(),
              },
            });

            logger.info("Reconciled PaymentHold to RELEASED via transfer.processed webhook", {
              dealId: paymentHold.dealId,
              transferId: transfer?.id,
            });

            // If deal deliverable was approved/verified but was waiting on webhook release confirmation, complete it
            if (paymentHold.deal && ["VERIFIED", "CONTENT_APPROVED"].includes(paymentHold.deal.status)) {
              await transitionDealState({
                dealId: paymentHold.deal.id,
                fromState: paymentHold.deal.status,
                toState: "COMPLETED",
                actor: { userId: "SYSTEM_WEBHOOK", role: "SYSTEM" },
                reason: "Deal successfully completed after Razorpay Route transfer settlement confirmation",
                metadata: {
                  transferId: transfer?.id,
                  amount: transfer?.amount,
                },
              }).catch((transErr) => {
                logger.warn("Could not transition deal to COMPLETED in transfer.processed webhook", {
                  dealId: paymentHold?.dealId,
                  error: transErr,
                });
              });
            }
          }
        }
      }
    } else if (event === "transfer.failed") {
      recordPaymentFailure(
        "RAZORPAY_ROUTE_TRANSFER_FAILED",
        new Error(transfer?.error_description || "Razorpay Route transfer failed"),
        {
          dealId: paymentHold?.dealId,
          transferId: transfer?.id,
          ...(typeof transfer?.amount === "number" ? { amount: transfer.amount } : {}),
          ...(transfer?.error_description ? { reason: transfer.error_description } : {}),
        },
      );
      if (paymentHold) {
        await prisma.paymentHold.update({
          where: { id: paymentHold.id },
          data: { status: "FAILED" },
        });

        logger.critical("PaymentHold marked FAILED via transfer.failed webhook", {
          dealId: paymentHold.dealId,
          transferId: transfer?.id,
          reason: transfer?.error_description,
          errorCode: transfer?.error_code,
        });
      }
    }

    await markWebhookProcessed(job.eventId, job.eventType, job.payload as Prisma.InputJsonValue);
    return { success: true, message: `Transfer event ${event} reconciled successfully` };
  }

  // Handle gateway refunds and chargeback disputes (P6-MONEY-01)
  if (event.startsWith("refund.") || event.startsWith("dispute.") || event.startsWith("payment.dispute.")) {
    const refund = payload?.payload?.refund?.entity;
    const payment = payload?.payload?.payment?.entity;
    const paymentId = refund?.payment_id || payment?.id;
    const amountPaise = refund?.amount || payment?.amount || 0;

    logger.critical("Gateway refund or dispute event received for financial settlement", {
      eventId: job.eventId,
      eventType: event,
      refundId: refund?.id,
      paymentId,
      amount: amountPaise,
    });

    if (paymentId) {
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // 1. If associated with a PaymentHold, update hold status to FAILED
        await tx.paymentHold.updateMany({
          where: { razorpayPaymentId: paymentId, status: { in: ["PENDING", "HELD"] } },
          data: { status: "FAILED" },
        });

        // 2. If associated with a completed top-up transaction, claw back or record liability
        const topupTx = await tx.transaction.findFirst({
          where: { razorpayPaymentId: paymentId, type: "CREDIT", status: "COMPLETED" },
        });

        if (topupTx?.walletId && amountPaise > 0) {
          const wallet = await tx.wallet.findUnique({
            where: { id: topupTx.walletId },
            select: { id: true, balance: true, userId: true },
          });

          if (wallet) {
            const deductAmount = Math.min(wallet.balance, amountPaise);
            if (deductAmount > 0) {
              await tx.wallet.update({
                where: { id: wallet.id },
                data: { balance: { decrement: deductAmount } },
              });
            }

            await tx.transaction.create({
              data: {
                walletId: wallet.id,
                type: "CHARGEBACK",
                amount: amountPaise,
                status: "COMPLETED",
                description: `Gateway ${event} reversal: ${paymentId}`,
                razorpayPaymentId: paymentId,
                metadata: {
                  refundId: refund?.id,
                  eventType: event,
                  balanceImpact: true,
                  deductedPaise: deductAmount,
                  unrecoveredPaise: amountPaise - deductAmount,
                },
              },
            });

            // If wallet balance was insufficient, record debt and DebtClaim if deal exists
            if (amountPaise > deductAmount) {
              const shortfall = amountPaise - deductAmount;
              await tx.wallet.update({
                where: { id: wallet.id },
                data: { debt: { increment: shortfall } },
              });

              if (topupTx.dealId) {
                await tx.debtClaim.create({
                  data: {
                    debtorWalletId: wallet.id,
                    creditorUserId: "PLATFORM_TREASURY",
                    dealId: topupTx.dealId,
                    amount: shortfall,
                    originalAmount: shortfall,
                    status: "PENDING",
                  },
                });
              }
            }
          }
        }
      });
    }

    await markWebhookProcessed(job.eventId, job.eventType, job.payload as Prisma.InputJsonValue);
    return { success: true, message: `Financial event ${event} processed and reconciled` };
  }

  // Acknowledge unhandled event types
  await markWebhookProcessed(job.eventId, job.eventType, job.payload as Prisma.InputJsonValue);
  return { success: true, message: `Event type ${event} acknowledged` };
}

async function _handler_POST(request: NextRequest) {
  try {
    const job = (await request.json()) as WebhookJobPayload;
    if (!job?.eventId || !job?.eventType) {
      return NextResponse.json({ success: false, message: "Invalid job payload" }, { status: 400 });
    }

    const result = await processWebhookEventInternal(job);
    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    logger.error("Error in webhook background processor", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, message: "Internal error processing webhook" }, { status: 500 });
  }
}

import { verifySignatureAppRouter } from "@/lib/qstash-guard";

// Wrap handler with secure QStash signature verification (rejects unauthenticated requests with 401)
export const POST = verifySignatureAppRouter(_handler_POST);
