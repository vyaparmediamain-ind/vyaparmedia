import { AppError } from "@/lib/errors";
import { Prisma } from "@prisma/client";
import { invalidate } from "@/lib/cache";
import { ContractTerms } from "@/lib/contract-engine";

export async function invalidateDealCache(dealId: string) {
await invalidate(`deal:${dealId}`);
}

export async function lockAndFetchDealForAction(tx: Prisma.TransactionClient, dealId: string) {
// Execute row-level write lock in PostgreSQL
await tx.$queryRaw`SELECT id FROM "Deal" WHERE id = ${dealId} FOR UPDATE`;

const deal = await tx.deal.findUnique({
where: { id: dealId },
include: {
influencer: {
select: { id: true, userId: true, displayName: true },
},
brand: {
select: { id: true, userId: true, companyName: true },
},
campaign: {
select: {
id: true,
title: true,
isDirectInvite: true,
totalBudget: true,
status: true,
brandId: true,
},
},
contentSubmissions: {
orderBy: { version: "desc" },
take: 1,
},
},
});
if (!deal) throw AppError.notFound("Deal not found");
return deal;
}


export type DealWithRelations = Prisma.PromiseReturnType<typeof lockAndFetchDealForAction>;

export interface ExpiredDealCandidate {
id: string;
submittedAt: Date | null;
reviewPeriodHours: number;
requiresPostVerification: boolean;
campaign: { title: string };
brand: { userId: string } | null;
influencer: { userId: string };
contentSubmissions: Array<{ id: string; status: string }>;
}

export async function releaseWalletHold(
tx: Prisma.TransactionClient,
brandUserId: string,
dealId: string,
amount: number,
description: string,
metadata?: Record<string, unknown>,
mode?: "INCREMENT_PENDING" | "INCREMENT_BALANCE" | "SHIFT_PENDING_TO_BALANCE"
) {
  await tx.$queryRaw`SELECT id FROM "Wallet" WHERE "userId" = ${brandUserId} FOR UPDATE`;

  const wallet = await tx.wallet.findUnique({
    where: { userId: brandUserId },
    select: { id: true, pendingBalance: true },
  });

if (!wallet) return;

let finalAmount = amount;
if (mode === "SHIFT_PENDING_TO_BALANCE") {
finalAmount = Math.min(wallet.pendingBalance, amount);
}

if (finalAmount <= 0) return;

let updateData = {};
if (mode === "INCREMENT_PENDING") {
updateData = { pendingBalance: { increment: finalAmount } };
} else if (mode === "INCREMENT_BALANCE") {
updateData = { balance: { increment: finalAmount } };
} else {
updateData = {
pendingBalance: { decrement: finalAmount },
balance: { increment: finalAmount },
};
}

await tx.wallet.update({
where: { id: wallet.id },
data: updateData,
});

await tx.transaction.create({
data: {
walletId: wallet.id,
dealId: dealId,
type: "REFUND",
amount: finalAmount,
status: "COMPLETED",
description,
...(metadata ? { metadata: metadata as Prisma.InputJsonValue } : {}),
},
});
}

export function normalizeMandatoryElements(
terms: { mandatoryElements?: unknown; mandatoryTags?: unknown } | null,
) {
const elements = Array.isArray(terms?.mandatoryElements)
? terms.mandatoryElements
: terms?.mandatoryTags;

if (!Array.isArray(elements)) return [];

return elements
.map((element) => String(element).trim())
.filter(Boolean);
}

export function formatFraudFlags(flags: { description?: string; rule?: string }[]) {
return flags
.map((flag) => flag.description || flag.rule || "Verification failed")
.join(", ");
}

export function validateShippingAddress(value: unknown): Prisma.InputJsonValue {
if (!value || typeof value !== "object" || Array.isArray(value)) {
throw AppError.badRequest("Shipping address is required");
}

const input = value as Record<string, unknown>;
const getSafeStr = (v: unknown, fallback = ""): string => {
return typeof v === "string" || typeof v === "number" || typeof v === "boolean"
? String(v).trim()
: fallback;
};

const address = {
fullName: getSafeStr(input.fullName),
phone: getSafeStr(input.phone),
line1: getSafeStr(input.line1),
line2: input.line2 ? getSafeStr(input.line2) : null,
city: getSafeStr(input.city),
state: getSafeStr(input.state),
pinCode: getSafeStr(input.pinCode),
country: getSafeStr(input.country, "India"),
};

if (
!address.fullName ||
!/^[6-9]\d{9}$/.test(address.phone) ||
!address.line1 ||
!address.city ||
!address.state ||
!/^\d{6}$/.test(address.pinCode)
) {
throw AppError.badRequest("Complete Indian shipping address with valid phone and PIN is required");
}

return address as Prisma.InputJsonValue;
}

export async function createDealAndReserveFunds(
tx: Prisma.TransactionClient,
params: {
brandUserId: string;
campaignId: string;
influencerId: string;
brandProfileId: string;
dealAmount: number;
paymentAmounts: {
totalAmount: number;
platformFee: number;
gatewayFee: number;
influencerReceives: number;
};
requiresProduct: boolean;
productName: string | null;
productValue: number | null;
productHandlingFee: number;
submissionDeadline: Date;
postingDeadline: Date;
draftContractTerms: ContractTerms;
}
) {
const reserveResult = await tx.wallet.updateMany({
where: { userId: params.brandUserId, pendingBalance: { gte: params.paymentAmounts.totalAmount } },
data: { pendingBalance: { decrement: params.paymentAmounts.totalAmount } },
});

if (reserveResult.count === 0) {
throw AppError.badRequest("Insufficient held campaign funds.");
}

const deal = await tx.deal.create({
data: {
campaignId: params.campaignId,
influencerId: params.influencerId,
brandId: params.brandProfileId,
amount: params.dealAmount,
platformFee: params.paymentAmounts.platformFee,
gatewayFee: params.paymentAmounts.gatewayFee,
totalAmount: params.paymentAmounts.totalAmount,
influencerPayout: params.paymentAmounts.influencerReceives,
reservedFromWallet: true,
requiresProduct: params.requiresProduct,
productName: params.productName,
productValue: params.productValue,
productHandlingFee: params.productHandlingFee,
productFulfillmentStatus: params.requiresProduct
? "ADDRESS_PENDING"
: "NOT_REQUIRED",
submissionDeadline: params.submissionDeadline,
postingDeadline: params.postingDeadline,
signDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000),
contractTerms: params.draftContractTerms as unknown as Prisma.InputJsonValue,
status: "PENDING_SIGNATURE",
},
});

await tx.deal.update({
where: { id: deal.id },
data: {
contractTerms: {
...params.draftContractTerms,
dealId: deal.id,
} as unknown as Prisma.InputJsonValue,
},
});

return deal;
}


