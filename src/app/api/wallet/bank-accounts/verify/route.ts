import { apiWrapper, type AuthenticatedRequest } from "@/lib/api-wrapper";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { decrypt } from "@/lib/encryption";
import { validateFundAccount } from "@/lib/razorpay";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError } from "@/lib/errors";

const verifySchema = z.object({
  bankAccountId: z.string().min(1, "bankAccountId is required"),
});

/**
 * POST /api/wallet/bank-accounts/verify
 *
 * Initiates Razorpay Fund Account Validation (penny-drop) for a saved bank account.
 * On success, marks BankAccount.isVerified = true.
 *
 * Security guarantees:
 *  - Account must belong to the calling user (userId ownership check)
 *  - UPI accounts are excluded — UPI verification is inherently VPA-based
 *  - Already-verified accounts are short-circuited (idempotent)
 *  - Rate-limited to prevent penny-drop abuse (costs money per call)
 */
async function _handler_POST(req: NextRequest) {
  const session = (req as AuthenticatedRequest).session;
  const userId = session.user.id;

  // Rate-limit: max 3 bank verifications per hour per user
  const limit = await checkRateLimit(userId, "BANK_ACCOUNT");
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many verification attempts. Please wait before retrying." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.format() },
      { status: 400 }
    );
  }

  const { bankAccountId } = parsed.data;

  // 1. Load and ownership-check the bank account
  const bankAccount = await prisma.bankAccount.findFirst({
    where: { id: bankAccountId, userId, deletedAt: null },
  });

  if (!bankAccount) {
    return NextResponse.json({ error: "Bank account not found" }, { status: 404 });
  }

  // 2. Already verified — idempotent response
  if (bankAccount.isVerified) {
    return NextResponse.json({
      success: true,
      alreadyVerified: true,
      message: "This bank account is already verified.",
    });
  }

  // 3. UPI accounts — auto-verify (penny-drop FAV is not applicable for VPA).
  //    Previously this returned HTTP 400, leaving isVerified=false and permanently
  //    blocking UPI users from withdrawing (withdraw route requires isVerified=true).
  const isUpiAccount =
    bankAccount.ifscCode === "UPI00000000" || bankAccount.accountNumber === "UPI_PAYOUT";
  if (isUpiAccount) {
    await prisma.bankAccount.updateMany({
      where: { id: bankAccountId, userId },
      data: { isVerified: true, verifiedAt: new Date() },
    });
    return NextResponse.json({
      success: true,
      message: "UPI account auto-verified successfully.",
    });
  }

  // 4. Decrypt stored account number for FAV
  let accountNumber = bankAccount.accountNumber;
  try {
    accountNumber = decrypt(bankAccount.accountNumber);
  } catch {
    // Fall through — may be plain-text legacy record
  }

  if (!/^\d{9,18}$/.test(accountNumber)) {
    throw AppError.badRequest(
      "Stored account number is invalid. Please delete and re-add this account."
    );
  }

  // 5. Trigger Razorpay Fund Account Validation
  logger.info("Initiating fund account validation", { userId, bankAccountId });

  const favResult = await validateFundAccount({
    userId,
    accountHolderName: bankAccount.accountName,
    accountNumber,
    ifscCode: bankAccount.ifscCode,
  });

  if (!favResult.isValid) {
    logger.warn("Fund account validation failed", {
      userId,
      bankAccountId,
      registeredName: favResult.registeredName,
    });
    return NextResponse.json(
      {
        error:
          "Bank account validation failed. The account number or IFSC may be incorrect, or the account may be inactive.",
        registeredName: favResult.registeredName,
      },
      { status: 422 }
    );
  }

  // 6. Mark as verified in DB
  await prisma.bankAccount.updateMany({
    where: { id: bankAccountId, userId },
    data: {
      isVerified: true,
      verifiedAt: new Date(),
    },
  });

  logger.info("Bank account verified successfully via FAV", {
    userId,
    bankAccountId,
    registeredName: favResult.registeredName,
  });

  return NextResponse.json({
    success: true,
    message: "Bank account verified successfully.",
    registeredName: favResult.registeredName,
  });
}

export const POST = apiWrapper(_handler_POST, { requirePermission: "WITHDRAW_FUNDS" });

