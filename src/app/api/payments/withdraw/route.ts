import { apiWrapper, ApiResponse, type AuthenticatedRequest } from "@/lib/api-wrapper";
import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { PaymentService } from "@/services/payment.service";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError } from "@/lib/errors";
import { claimIdempotencyKey, releaseIdempotencyKey, saveIdempotencyResponse, type IdempotencyCheckResult } from "@/lib/idempotency";
import { env } from "@/env";

const withdrawalSchema = z.object({
  amount: z.preprocess(
    Number,
    z
      .number()
      .int()
      .positive()
      .min(
        env.MIN_WITHDRAWAL_AMOUNT,
        `Minimum withdrawal is INR ${env.MIN_WITHDRAWAL_AMOUNT / 100}`,
      )
      .max(50_000_000, "Maximum single withdrawal is INR 5,00,000"),
  ),
  /**
   * bankAccountId is the ONLY accepted payment destination.
   * Freeform bank details (bankAccountName, bankAccountNumber, ifscCode) are
   * intentionally NOT accepted here — they were a money-laundering vector that
   * allowed routing funds to any unverified third-party account.
   * All accounts must first be saved via POST /api/wallet/bank-accounts and then
   * verified via POST /api/wallet/bank-accounts/verify (Razorpay penny-drop).
   */
  bankAccountId: z.string().min(1, "bankAccountId is required — use a verified saved bank account"),
});

function getWithdrawalIdempotencyKey(request: NextRequest, userId: string) {
const headerKey = request.headers.get("Idempotency-Key")?.trim();
return `withdraw:${userId}:${headerKey}`;
}

function checkIdempotencyHeader(request: NextRequest) {
const idempotencyHeader = request.headers.get("Idempotency-Key")?.trim();
if (!idempotencyHeader || !/^[A-Za-z0-9:_-]{16,128}$/.test(idempotencyHeader)) {
throw AppError.badRequest("Invalid Idempotency-Key");
}
}

async function verifyTaxCompliance(userId: string) {
const taxCompliance = await prisma.indiaTaxCompliance.findUnique({
where: { userId },
select: { panLast4: true },
});

if (!taxCompliance?.panLast4) {
throw AppError.badRequest("PAN tax compliance is required before withdrawals");
}
}

async function getPayoutDetailsFromDb(
  userId: string,
  bankAccountId: string
) {
  const bankAccount = await prisma.bankAccount.findFirst({
    where: {
      id: bankAccountId,
      userId,
      deletedAt: null,
    },
  });

  if (!bankAccount) {
    throw AppError.notFound("Bank account not found");
  }

  // SECURITY: Block withdrawals to unverified bank accounts.
  // Accounts must pass Razorpay Fund Account Validation (penny-drop)
  // before they can receive payouts — this prevents routing funds to
  // unowned third-party accounts (money laundering / session-hijack drain).
  if (!bankAccount.isVerified) {
    throw AppError.badRequest(
      "BANK_ACCOUNT_NOT_VERIFIED: This bank account has not been verified yet. " +
      "Please complete bank account verification before withdrawing."
    );
  }

  let accountNumber = bankAccount.accountNumber;
  try {
    accountNumber = decrypt(bankAccount.accountNumber);
  } catch {
    // Support old plain-text records if they still exist.
  }

  const isUpiPayout = accountNumber === "UPI_PAYOUT" && bankAccount.ifscCode === "UPI00000000";

  if (!isUpiPayout && !/^\d{9,18}$/.test(accountNumber)) {
    throw AppError.badRequest(
      "Stored bank account is invalid or masked. Please re-add this account before withdrawing."
    );
  }

  let upiId = bankAccount.upiId;
  if (upiId) {
    try {
upiId = decrypt(upiId);
} catch {
// Support old plain-text records if they still exist.
}
}

const details: {
bankAccountName: string;
bankAccountNumber: string;
ifscCode: string;
upiId?: string;
} = {
bankAccountName: bankAccount.accountName,
bankAccountNumber: accountNumber,
ifscCode: bankAccount.ifscCode,
};
if (upiId) {
details.upiId = upiId;
}
return details;
}

function handleWithdrawalPostError(error: unknown) {
const errMsg = error instanceof Error ? error.message : String(error);
logger.error("POST /api/payments/withdraw error", { error: errMsg });

if (errMsg === "WITHDRAWAL_BLOCK") {
return ApiResponse.forbidden("Withdrawal is currently blocked. Please contact support.");
}

  if (errMsg.includes("BANK_ACCOUNT_NOT_VERIFIED")) {
    return ApiResponse.error(
      "This bank account has not been verified. Please verify your bank account before withdrawing.",
      403
    );
  }

  if (errMsg.includes("Insufficient funds") || errMsg.includes("INSUFFICIENT_FUNDS_OR_FROZEN")) {
return ApiResponse.error("Insufficient funds or frozen balance. Please check your wallet.", 400);
}

if (errMsg.includes("Payout failed")) {
return ApiResponse.error("Payout could not be processed. Please try again later.", 400);
}

if (errMsg.includes("Rate limit")) {
return ApiResponse.error("Too many requests. Please wait before trying again.", 429);
}

return ApiResponse.error("Withdrawal failed. Please try again later.", 500);
}

function handleDuplicateRequest(claim: IdempotencyCheckResult) {
if (claim.savedResponse) {
const saved = claim.savedResponse as { status?: number | string; body?: unknown };
if (saved.status === "PROCESSING") {
return ApiResponse.error("A request with this idempotency key is already processing. Please wait.", 409);
}
return new Response(JSON.stringify(saved.body), {
status: typeof saved.status === "number" ? saved.status : 200,
headers: { "Content-Type": "application/json" },
});
}
return ApiResponse.error("Duplicate request detected.", 409);
}

async function _handler_POST(request: NextRequest) {
const session = (request as AuthenticatedRequest).session;
checkIdempotencyHeader(request);

const idempotencyKey = getWithdrawalIdempotencyKey(request, session.user.id);

// 1. Claim idempotency key before performing operations
const claim = await claimIdempotencyKey(idempotencyKey, session.user.id);
if (claim.isDuplicate) {
return handleDuplicateRequest(claim);
}

try {
const body = await request.json();
const parsed = withdrawalSchema.safeParse(body);

if (!parsed.success) {
throw AppError.badRequest("Invalid payload");
}

await verifyTaxCompliance(session.user.id);

const limit = await checkRateLimit(session.user.id, "WITHDRAWAL");
if (!limit.success) {
throw AppError.tooManyRequests(
"Daily withdrawal limit reached. Please try again later.",
);
}

const payoutDetails = await getPayoutDetailsFromDb(session.user.id, parsed.data.bankAccountId);

const withdrawal = await PaymentService.initiateWithdrawal(
session.user.id,
{
amount: parsed.data.amount,
...payoutDetails,
},
idempotencyKey,
);

if ("alreadyProcessed" in withdrawal) {
const successRes = {
success: true,
message: "Withdrawal already processed",
data: { alreadyProcessed: true },
};
await saveIdempotencyResponse(idempotencyKey, {
status: 200,
body: successRes,
}, session.user.id);
return ApiResponse.success({ alreadyProcessed: true }, "Withdrawal already processed");
}

    if (withdrawal.status === "rejected" || withdrawal.status === "failed" || withdrawal.status === "reversed") {
      await releaseIdempotencyKey(idempotencyKey, session.user.id);
      return ApiResponse.error(
        `Payout was rejected or failed by payment provider (status: ${withdrawal.status}). Your wallet balance has been restored.`,
        400,
      );
    }

const responseMessage = withdrawal.status === "PENDING_REVIEW"
? "Withdrawal requires manual review. It will be reviewed by our team."
: "Withdrawal initiated successfully";

const successRes = {
success: true,
message: responseMessage,
data: withdrawal,
};

// Save final response in idempotency log
await saveIdempotencyResponse(idempotencyKey, {
status: 200,
body: successRes,
}, session.user.id);

return ApiResponse.success(withdrawal, responseMessage);
  } catch (error: unknown) {
    // IMPORTANT: Only release the idempotency key for deterministic / unambiguous failures.
    // If the withdrawal was saved in PROCESSING state (e.g. gateway timeout), the key must
    // remain held until the webhook reconciles the payout outcome. Releasing early would let
    // the user resubmit immediately and create a second withdrawal / double-payout.
    const isAmbiguousGatewayState =
      error instanceof AppError &&
      (error.message === "GATEWAY_TIMEOUT" || error.message === "GATEWAY_AMBIGUOUS");

    if (!isAmbiguousGatewayState) {
      await releaseIdempotencyKey(idempotencyKey, session.user.id);
    }

    if (error instanceof AppError) {
      return ApiResponse.error(error.message, error.statusCode);
    }
    return handleWithdrawalPostError(error);
  }
}

// Wrapped handlers via apiWrapper
export const POST = apiWrapper(_handler_POST, { requirePermission: "WITHDRAW_FUNDS" });
