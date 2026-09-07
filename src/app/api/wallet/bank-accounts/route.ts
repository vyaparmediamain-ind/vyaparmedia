import { apiWrapper, type AuthenticatedRequest } from "@/lib/api-wrapper";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { encrypt, maskAccountNumber, maskUpiId, hashForDuplicateDetection } from "@/lib/encryption";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError } from "@/lib/errors";

const bankAccountSchema = z
.object({
accountName: z.string().min(2, "Name must be at least 2 characters").max(100),
accountNumber: z.string().optional(),
ifscCode: z.string().optional(),
bankName: z.string().optional(),
upiId: z.string().max(50).optional(),
isDefault: z.boolean().optional(),
})
.superRefine((data, ctx) => {
const isUpiOnly = !!data.upiId && !data.accountNumber && !data.ifscCode && !data.bankName;
if (isUpiOnly) {
if (!data.upiId || !/^[\w.-]{2,256}@[a-zA-Z]{2,64}$/.test(data.upiId)) {
ctx.addIssue({
code: z.ZodIssueCode.custom,
path: ["upiId"],
message: "Invalid UPI ID format (e.g. name@bank)",
});
}
} else {
if (!data.accountNumber || !/^\d{9,18}$/.test(data.accountNumber)) {
ctx.addIssue({
code: z.ZodIssueCode.custom,
path: ["accountNumber"],
message: "Invalid account number (9-18 digits)",
});
}
if (!data.ifscCode || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(data.ifscCode)) {
ctx.addIssue({
code: z.ZodIssueCode.custom,
path: ["ifscCode"],
message: "Invalid IFSC Code",
});
}
if (!data.bankName || data.bankName.length < 2) {
ctx.addIssue({
code: z.ZodIssueCode.custom,
path: ["bankName"],
message: "Bank name is required",
});
}
}
});

/** Shared: enforce influencer-only guard. Returns userId. */
async function requireInfluencerSession(req: NextRequest): Promise<
{ userId: string; errorResponse: null }
> {
const session = (req as AuthenticatedRequest).session;
return { userId: session.user.id!, errorResponse: null };
}

/** Shared: rate-limit guard for bank account mutation endpoints. */
async function checkBankAccountRateLimit(userId: string): Promise<NextResponse | null> {
  const limit = await checkRateLimit(userId, "BANK_ACCOUNT");
  if (!limit.success) {
    return NextResponse.json({ error: "Too many bank account updates" }, { status: 429 });
  }
  return null;
}

/** Mask sensitive fields on a BankAccount record before sending to client. */
function maskAccount<T extends { accountNumber: string; upiId: string | null }>(account: T) {
return {
...account,
accountNumber: maskAccountNumber(account.accountNumber),
upiId: account.upiId ? maskUpiId(account.upiId) : null,
};
}

async function _handler_GET(req: NextRequest) {
try {
const { userId, errorResponse } = await requireInfluencerSession(req);
    if (errorResponse) {
      return errorResponse;
    }

  const accounts = await prisma.bankAccount.findMany({
    where: { userId, deletedAt: null },
    take: 20,
    orderBy: { createdAt: "desc" },
  });

return NextResponse.json({ accounts: accounts.map(maskAccount) });
} catch (error) {
logger.error("Failed to fetch bank accounts", error);
if (error instanceof AppError) {
return NextResponse.json({ error: error.message }, { status: error.statusCode });
}
return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
}
}

async function checkDuplicateAccount(
  userId: string,
  upiId: string | undefined,
  accountNumberHash: string,
  ifscCode: string,
): Promise<NextResponse | null> {
  if (upiId) {
    const upiIdHash = hashForDuplicateDetection(upiId);
    const duplicateUpi = await prisma.bankAccount.findFirst({
      where: { userId, upiIdHash, deletedAt: null },
    });
    if (duplicateUpi) {
      return NextResponse.json(
        { error: "This UPI ID has already been added to your profile." },
        { status: 400 },
      );
    }
  } else {
    const duplicateBank = await prisma.bankAccount.findFirst({
      where: { userId, accountNumberHash, ifscCode, deletedAt: null },
    });
    if (duplicateBank) {
      return NextResponse.json(
        { error: "This bank account has already been added to your profile." },
        { status: 400 },
      );
    }
  }
  return null;
}

async function _handler_POST(req: NextRequest) {
  try {
    const { userId, errorResponse } = await requireInfluencerSession(req);
    if (errorResponse) return errorResponse;

    const rateLimitError = await checkBankAccountRateLimit(userId);
    if (rateLimitError) return rateLimitError;

    const body = await req.json();
    const result = bankAccountSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.format() },
        { status: 400 },
      );
    }

    const { accountName, accountNumber, ifscCode, bankName, upiId, isDefault } = result.data;

    // Enforce maximum 5 bank accounts per user (excluding soft-deleted ones)
    const existingCount = await prisma.bankAccount.count({ where: { userId, deletedAt: null } });
    if (existingCount >= 5) {
      return NextResponse.json(
        { error: "Maximum of 5 bank accounts allowed per user" },
        { status: 400 },
      );
    }

    // If setting as default, unset others first
    if (isDefault) {
      await prisma.bankAccount.updateMany({ where: { userId }, data: { isDefault: false } });
    }

    const finalAccountNumber = accountNumber || "UPI_PAYOUT";
    const finalIfscCode = ifscCode || "UPI00000000";
    const finalBankName = bankName || "UPI";
    const encryptedAccountNumber = encrypt(finalAccountNumber);
    const accountNumberHash = hashForDuplicateDetection(finalAccountNumber);
    const encryptedUpiId = upiId ? encrypt(upiId) : null;
    const upiIdHash = upiId ? hashForDuplicateDetection(upiId) : null;

    const duplicateError = await checkDuplicateAccount(userId, upiId, accountNumberHash, finalIfscCode);
    if (duplicateError) {
      return duplicateError;
    }

const account = await prisma.bankAccount.create({
data: {
userId,
accountName,
accountNumber: encryptedAccountNumber,
accountNumberHash,
ifscCode: finalIfscCode,
bankName: finalBankName,
upiId: encryptedUpiId,
upiIdHash,
isDefault: isDefault || false,
},
});

return NextResponse.json({ success: true, account: maskAccount(account) });
} catch (error) {
logger.error("Failed to add bank account", error);
if (error instanceof AppError) {
return NextResponse.json({ error: error.message }, { status: error.statusCode });
}
return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
}
}

async function verifyAndGetBankAccount(
req: NextRequest,
userId: string,
): Promise<{ id: string; errorResponse: NextResponse | null }> {
const { searchParams } = new URL(req.url);
const id = searchParams.get("id")?.trim();

if (!id) {
return { id: "", errorResponse: NextResponse.json({ error: "ID is required" }, { status: 400 }) };
}

  const account = await prisma.bankAccount.findUnique({ where: { id } });
  if (account?.userId !== userId || account?.deletedAt !== null) {
    return { id: "", errorResponse: NextResponse.json({ error: "Account not found" }, { status: 404 }) };
  }

return { id, errorResponse: null };
}

async function _handler_DELETE(req: NextRequest) {
try {
  const { userId, errorResponse } = await requireInfluencerSession(req);
  if (errorResponse) {
    return errorResponse;
  }

  const rateLimitError = await checkBankAccountRateLimit(userId);
  if (rateLimitError) {
    return rateLimitError;
  }

  const verification = await verifyAndGetBankAccount(req, userId);
  if (verification.errorResponse) {
    return verification.errorResponse;
  }

  // L4 FIX: Soft-delete instead of hard delete to preserve audit trail.
  // Hard delete loses the record entirely; soft-delete keeps it for reconciliation and fraud investigation.
  await prisma.bankAccount.updateMany({
    where: { id: verification.id, userId },
    data: { deletedAt: new Date() },
  });
  return NextResponse.json({ success: true });
} catch (error) {
logger.error("Failed to delete bank account", error);
if (error instanceof AppError) {
return NextResponse.json({ error: error.message }, { status: error.statusCode });
}
return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
}
}

async function _handler_PUT(req: NextRequest) {
try {
const { userId, errorResponse } = await requireInfluencerSession(req);
if (errorResponse) return errorResponse;

const rateLimitError = await checkBankAccountRateLimit(userId);
if (rateLimitError) return rateLimitError;

const verification = await verifyAndGetBankAccount(req, userId);
if (verification.errorResponse) return verification.errorResponse;

// Clear all defaults for this user, then set the chosen one
await prisma.$transaction([
prisma.bankAccount.updateMany({ where: { userId }, data: { isDefault: false } }),
prisma.bankAccount.updateMany({ where: { id: verification.id, userId }, data: { isDefault: true } }),
]);

logger.info("Bank account set as default", { userId, accountId: verification.id });
return NextResponse.json({ success: true });
} catch (error) {
logger.error("Failed to set default bank account", error);
if (error instanceof AppError) {
return NextResponse.json({ error: error.message }, { status: error.statusCode });
}
return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
}
}

// Wrapped handlers via apiWrapper
export const GET = apiWrapper(_handler_GET, { requirePermission: "WITHDRAW_FUNDS" });
export const POST = apiWrapper(_handler_POST, { requirePermission: "WITHDRAW_FUNDS" });
export const PUT = apiWrapper(_handler_PUT, { requirePermission: "WITHDRAW_FUNDS" });
export const DELETE = apiWrapper(_handler_DELETE, { requirePermission: "WITHDRAW_FUNDS" });
