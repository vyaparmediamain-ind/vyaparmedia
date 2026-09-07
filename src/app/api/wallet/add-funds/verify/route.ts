import { NextResponse } from "next/server";
import { apiWrapper, type AuthenticatedRequest } from "@/lib/api-wrapper";
import { getOrder, getPayment, verifyPaymentSignature } from "@/lib/razorpay";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { PaymentService } from "@/services/payment.service";

const verifyTopUpSchema = z.object({
razorpay_payment_id: z.string().min(5).max(128),
razorpay_order_id: z.string().min(5).max(128),
razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/i),
}).strip();

export const POST = apiWrapper(async (req) => {
const session = (req as AuthenticatedRequest).session;
const parsed = req.validBody as z.infer<typeof verifyTopUpSchema>;

const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = parsed;
const start = Date.now();

// 1. Verify Signature
const isValid = verifyPaymentSignature({
orderId: razorpay_order_id,
paymentId: razorpay_payment_id,
signature: razorpay_signature,
});

if (!isValid) {
logger.error("Invalid payment signature", {
userId: session.user.id,
orderId: razorpay_order_id,
});
return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
}

// 2. Find pending transaction
const transaction = await prisma.transaction.findFirst({
where: {
wallet: { userId: session.user.id },
razorpayOrderId: razorpay_order_id,
status: "PENDING",
},
});

if (!transaction) {
// Idempotent success for retrying the same verify request.
const existingCompleted = await prisma.transaction.findFirst({
where: {
wallet: { userId: session.user.id },
razorpayOrderId: razorpay_order_id,
razorpayPaymentId: razorpay_payment_id,
status: "COMPLETED",
},
select: { id: true },
});

if (existingCompleted) {
return NextResponse.json({ success: true, alreadyProcessed: true });
}

logger.error("Pending transaction not found during verification", {
orderId: razorpay_order_id,
});
return NextResponse.json(
{ error: "Transaction record not found" },
{ status: 404 },
);
}

// 3. Verify payment against Razorpay API to prevent client-side tampering.
let order: { id: string; amount: string | number; status: string } | null;
let payment: { id: string; order_id: string; amount: string | number; status: string } | null;
try {
[order, payment] = await Promise.all([
getOrder(razorpay_order_id),
getPayment(razorpay_payment_id),
]);
} catch (error: unknown) {
logger.error("Razorpay verification lookup failed", {
error: error instanceof Error ? error.message : String(error),
orderId: razorpay_order_id,
paymentId: razorpay_payment_id,
});
return NextResponse.json(
{ error: "Unable to verify payment with gateway" },
{ status: 400 },
);
}

if (payment?.order_id !== razorpay_order_id) {
logger.warn("Payment order mismatch during wallet top-up verify", {
userId: session.user.id,
expectedOrderId: razorpay_order_id,
actualOrderId: payment?.order_id,
paymentId: razorpay_payment_id,
});
return NextResponse.json({ error: "Payment/order mismatch" }, { status: 400 });
}

if (!["authorized", "captured"].includes(payment?.status)) {
return NextResponse.json(
{ error: "Payment is not completed yet" },
{ status: 400 },
);
}

const orderAmount = Number(order?.amount);
const paymentAmount = Number(payment?.amount);
if (orderAmount !== transaction.amount || paymentAmount !== transaction.amount) {
logger.error("Top-up amount mismatch detected", {
userId: session.user.id,
transactionAmount: transaction.amount,
orderAmount,
paymentAmount,
orderId: razorpay_order_id,
paymentId: razorpay_payment_id,
});
return NextResponse.json({ error: "Amount mismatch detected" }, { status: 400 });
}

// 4. Update wallet and transaction atomically.
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await PaymentService.completeWalletTopUp(tx, {
      transactionId: transaction.id,
      walletId: transaction.walletId,
      amount: transaction.amount,
      razorpayPaymentId: razorpay_payment_id,
    });
  });

const duration = Date.now() - start;
logger.info("Payment verified and wallet credited", {
userId: session.user.id,
amount: transaction.amount,
duration,
});

return NextResponse.json({ success: true });
}, {
requireAuth: true,
userRateLimit: {
bucket: "PAYMENTS",
errorMessage: "Too many payment requests",
},
validate: {
body: verifyTopUpSchema,
},
});
