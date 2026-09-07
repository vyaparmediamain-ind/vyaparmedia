import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { apiWrapper } from "@/lib/api-wrapper";
import { processSecureWebhook } from "@/lib/razorpay";
import { markWebhookProcessed } from "@/lib/idempotency";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";
import { sendWithdrawalEmail } from "@/lib/email";
import { NotificationService } from "@/services/notification.service";
import { PaymentService } from "@/services/payment.service";

// Next.js config to allow raw body for Razorpay crypto verification
export const dynamic = "force-dynamic";

async function handleWalletTopupWebhook(payload: { event?: string; payload?: { payment?: { entity?: { order_id?: string; id: string; amount: number } } } }) {
if (payload?.event !== "payment.captured") return;

const payment = payload?.payload?.payment?.entity;
if (!payment) return;

const orderId = payment.order_id;
const paymentId = payment.id;
const amount = payment.amount;

if (!orderId || !paymentId || !Number.isInteger(amount) || amount <= 0) {
logger.warn("Skipping malformed wallet top-up webhook payload", {
orderId,
paymentId,
amount,
});
return;
}

const transaction = await prisma.transaction.findFirst({
where: {
razorpayOrderId: orderId,
},
select: {
id: true,
walletId: true,
amount: true,
status: true,
},
});

  if (!transaction) {
    // M8 FIX: Throwing here causes HTTP 500 which Razorpay retries for 24-48 hours.
    // Return 200 to acknowledge receipt — orphan events (e.g. test webhooks) cannot be resolved.
    logger.warn(`Webhook: Transaction not found for orderId — acknowledged as orphan event`, { orderId });
    return;
  }

if (transaction.status !== "PENDING") {
logger.info("Transaction already processed, ignoring webhook", {
orderId,
status: transaction.status,
});
return;
}

  if (transaction.amount !== amount) {
    logger.error("Webhook amount mismatch: expected different amount than captured", {
      transactionId: transaction.id,
      expectedAmount: transaction.amount,
      receivedAmount: amount,
      orderId,
      paymentId,
    });
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        status: "FAILED",
        description: `Failed due to top-up amount mismatch: expected ${transaction.amount} Paise, got ${amount} Paise`,
      },
    });
    return;
  }

try {
await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
  await PaymentService.completeWalletTopUp(tx, {
    transactionId: transaction.id,
    walletId: transaction.walletId,
    amount: transaction.amount,
    razorpayPaymentId: paymentId,
  });
});
} catch (error: unknown) {
if ((error as { code?: string })?.code === "P2002") {
logger.warn("Duplicate payment ID already recorded", {
paymentId,
transactionId: transaction.id,
});
return;
}
throw error;
}
}
async function handleProcessedPayout(
  tx: Prisma.TransactionClient,
  withdrawal: Prisma.WithdrawalGetPayload<{ include: { wallet: { include: { user: true } } } }>,
  transaction: { id: string },
  payoutId: string,
) {
  const updateResult = await tx.withdrawal.updateMany({
    where: { id: withdrawal.id, status: { notIn: ["COMPLETED", "FAILED", "REVERSED"] } },
    data: { status: "COMPLETED", processedAt: new Date(), razorpayPayoutId: payoutId }
  });

  if (updateResult.count === 0) {
    logger.info("Withdrawal already completed or in terminal state, skipping totalWithdrawn increment", { withdrawalId: withdrawal.id });
    return;
  }

  await tx.transaction.update({
    where: { id: transaction.id },
    data: { status: "COMPLETED" }
  });
  await tx.wallet.update({
    where: { id: withdrawal.walletId },
    data: { totalWithdrawn: { increment: withdrawal.amount } }
  });
  await NotificationService.createNotification({
    userId: withdrawal.wallet.userId,
    type: "payout",
    title: "Withdrawal Successful ",
    message: `Your withdrawal of ${(withdrawal.amount / 100).toLocaleString("en-IN")} was successfully processed.`,
  }, tx);
}

async function handleFailedPayout(
  tx: Prisma.TransactionClient,
  withdrawal: Prisma.WithdrawalGetPayload<{ include: { wallet: { include: { user: true } } } }>,
  transaction: { id: string },
  payoutId: string,
  event: string,
  payout: { failure_reason?: string },
  freshWithdrawalStatus: string,
) {
  // Check for existing refund transaction or terminal linked transaction status
  const refundTx = await tx.transaction.findFirst({
    where: {
      withdrawalId: withdrawal.id,
      OR: [
        { type: "REFUND" },
        { status: { in: ["FAILED", "REVERSED"] } }
      ]
    },
  });
  if (refundTx) {
    logger.info("Withdrawal already refunded/failed, skipping balance restore", { withdrawalId: withdrawal.id });
    return;
  }

  const targetStatus = event === "payout.reversed" ? "REVERSED" : "FAILED";

  const updateResult = await tx.withdrawal.updateMany({
    where: {
      id: withdrawal.id,
      status: { notIn: ["FAILED", "REVERSED"] }
    },
    data: {
      status: targetStatus,
      failureReason: `Payout failed with event ${event}. Reason: ${payout.failure_reason || "unknown"}`,
      razorpayPayoutId: payoutId,
      processedAt: new Date(),
    }
  });

  if (updateResult.count === 0) {
    logger.info("Withdrawal already failed/reversed, skipping refund", { withdrawalId: withdrawal.id });
    return;
  }

  // Failed / Rejected / Reversed -> Refund Wallet
  await tx.wallet.update({
    where: { id: withdrawal.walletId },
    data: {
      balance: { increment: withdrawal.amount },
      ...(freshWithdrawalStatus === "COMPLETED"
        ? { totalWithdrawn: { decrement: withdrawal.amount } }
        : {})
    }
  });

  if (freshWithdrawalStatus === "COMPLETED") {
    // M7 FIX: If the withdrawal was already completed, keep the original transaction as COMPLETED
    // to preserve historical ledger records. Instead, create a new COMPLETED REFUND transaction.
    await tx.transaction.create({
      data: {
        walletId: withdrawal.walletId,
        withdrawalId: withdrawal.id,
        type: "REFUND",
        amount: withdrawal.amount,
        status: "COMPLETED",
        description: `Refund for reversed withdrawal Ref: ${withdrawal.id}. Reason: ${payout.failure_reason || "Reversed by gateway"}`,
        metadata: { source: "payout_reversal", event }
      }
    });
  } else {
    // If the withdrawal was never completed, mutate the original transaction to FAILED / REVERSED
    await tx.transaction.update({
      where: { id: transaction.id },
      data: { status: targetStatus }
    });
  }
  await NotificationService.createNotification({
    userId: withdrawal.wallet.userId,
    type: "payout",
    title: "Withdrawal Failed ",
    message: `Your withdrawal of ${(withdrawal.amount / 100).toLocaleString("en-IN")} failed. The amount has been refunded to your wallet.`,
  }, tx);
}

async function handlePayoutWebhook(payload: { event?: string; payload?: { payout?: { entity?: { reference_id?: string; id: string; failure_reason?: string } } } }) {
  const event = payload?.event ?? "";
  if (!["payout.processed", "payout.failed", "payout.rejected", "payout.reversed"].includes(event)) {
    return;
  }

  const payout = payload?.payload?.payout?.entity;
  if (!payout) return;

  const withdrawalId = payout.reference_id;
  const payoutId = payout.id;

  if (!withdrawalId) {
    logger.warn("Skipping payout webhook: missing reference_id", { payoutId });
    return;
  }

  const withdrawal = await prisma.withdrawal.findUnique({
    where: { id: withdrawalId },
    include: { wallet: { include: { user: true } } },
  });

  if (!withdrawal) {
    logger.warn("Webhook: Withdrawal not found — acknowledged as orphan event", { withdrawalId, payoutId });
    return;
  }

  // M6 FIX: Must filter by type:"WITHDRAWAL" — without this, if a REFUND transaction exists
  // for the same withdrawal, findFirst may return it instead of the WITHDRAWAL record,
  // causing status mutations on the wrong transaction row.
  const transaction = await prisma.transaction.findFirst({
    where: { withdrawalId: withdrawal.id, type: "WITHDRAWAL" },
  });

  if (!transaction) {
    logger.warn("Webhook: WITHDRAWAL transaction not found — acknowledged as orphan event", { withdrawalId });
    return;
  }

  try {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const freshWithdrawals = await tx.$queryRaw<{ status: string }[]>`
        SELECT status FROM "Withdrawal" WHERE id = ${withdrawal.id} FOR UPDATE
      `;
      const freshWithdrawal = freshWithdrawals[0];

      if (!freshWithdrawal || freshWithdrawal.status === "FAILED" || freshWithdrawal.status === "REVERSED") {
        logger.info("Withdrawal already processed, ignoring webhook", { withdrawalId, status: freshWithdrawal?.status });
        return;
      }

      if (freshWithdrawal.status === "COMPLETED" && event !== "payout.reversed") {
        logger.info("Withdrawal already processed, ignoring webhook", { withdrawalId, status: freshWithdrawal?.status });
        return;
      }

      if (event === "payout.processed") {
        await handleProcessedPayout(tx, withdrawal, transaction, payoutId);
      } else {
        await handleFailedPayout(tx, withdrawal, transaction, payoutId, event, payout, freshWithdrawal.status);
      }
    });

    const emailStatus = event === "payout.processed" ? "success" : "failed";
    sendWithdrawalEmail(withdrawal.wallet.user.email, withdrawal.amount, emailStatus).catch((err) => {
      logger.error("Failed to send withdrawal email", {
        withdrawalId,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  } catch (error: unknown) {
    logger.error("Error processing payout webhook in transaction", error, { withdrawalId });
    throw error;
  }
}

async function _handler_POST(request: NextRequest) {
const rawBody = await request.text();
const headerList = await headers();
const signature = headerList.get("x-razorpay-signature");

if (!signature) {
return NextResponse.json({ success: false, message: "Missing signature" }, { status: 400 });
}

// Try Parse to grab event types for logger
let payload;
try {
payload = JSON.parse(rawBody);
} catch {
return NextResponse.json({ success: false, message: "Malformed JSON" }, { status: 400 });
}

  // H11 FIX: Always prefix event key with event type so that multiple lifecycle
  // events for the same entity (payout.processed -> payout.reversed) get distinct keys.
  // Previously using bare entity IDs caused the second event to be flagged as a replay.
  const eventType = typeof payload?.event === "string" ? payload.event : "unknown";
  const rawEntityId =
    payload?.payload?.payment?.entity?.id ||
    payload?.payload?.order?.entity?.id ||
    payload?.payload?.payout?.entity?.id ||
    "";
  const headerEventId = headerList.get("x-razorpay-event-id");
  const eventId = headerEventId || (rawEntityId ? `${eventType}:${rawEntityId}` : "");
  const result = await processSecureWebhook(
    rawBody,
    signature,
    eventId,
    eventType,
  );

if (!result.isValid) {
logger.warn("Webhook rejected: invalid signature", {
eventType,
eventId,
});
return NextResponse.json(
{ success: false, message: "Invalid signature" },
{ status: 400 },
);
}

if (result.isDuplicate) {
return NextResponse.json(
{ success: true, message: "Duplicate webhook ignored" },
{ status: 200 },
);
}

  // M5 FIX: Use a random UUID as lock value so we can verify ownership before deletion.
  // With a static "LOCKED" string, if processing exceeds 60s and the lock auto-expires,
  // another worker acquires it with the same value — then our finally block deletes their lock.
  const lockToken = crypto.randomUUID();
  const lockKey = `webhook:lock:${result.eventKey}`;
  const acquired = await redis.set(lockKey, lockToken, "EX", 60, "NX");
  if (!acquired) {
    logger.warn("Webhook collision detected, concurrent processing locked", { eventKey: result.eventKey });
    return NextResponse.json(
      { success: true, message: "Webhook is currently processing elsewhere" },
      { status: 200 },
    );
  }

  // Lua script: only delete the lock if it still holds our token
  const releaseLua = `
    if redis.call('get', KEYS[1]) == ARGV[1] then
      return redis.call('del', KEYS[1])
    else
      return 0
    end
  `;

  try {
    try {
      await handleWalletTopupWebhook(payload);
      await handlePayoutWebhook(payload);
      await markWebhookProcessed(result.eventKey, eventType, payload);

      logger.info("Webhook processed successfully", {
        eventType: payload?.event,
        eventKey: result.eventKey,
      });
    } finally {
      // Safely release only OUR lock via Lua CAS to avoid deleting another worker's lock
      await redis.eval(releaseLua, 1, lockKey, lockToken).catch(() => {});
    }
} catch (error: unknown) {
if (error instanceof Error && error.message === "Webhook already processed") {
return NextResponse.json({ success: true, message: "Idempotency caught" }, { status: 200 });
}
throw error;
}

return NextResponse.json({ success: true, message: "Webhook processed" }, { status: 200 });
}

export const POST = apiWrapper(_handler_POST);
