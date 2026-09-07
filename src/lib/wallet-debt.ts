import { Prisma } from "@prisma/client";
import { logger } from "./logger";

async function createCreditTransaction(
tx: Prisma.TransactionClient,
walletId: string,
amount: number,
dealId?: string,
description?: string,
razorpayPaymentId?: string | null,
metadata?: Record<string, unknown>,
) {
await tx.transaction.create({
data: {
walletId,
dealId: dealId || null,
type: "CREDIT",
amount,
status: "COMPLETED",
description: description || `Payout credited`,
razorpayPaymentId: razorpayPaymentId || null,
metadata: metadata ? (metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
},
});
}

async function distributeRecoveredDebtToCreditors(
tx: Prisma.TransactionClient,
initialRemainingDebtPaid: number,
pendingClaims: { id: string; amount: number; creditorUserId: string; dealId: string }[]
): Promise<number> {
let remainingDebtPaid = initialRemainingDebtPaid;

for (const claim of pendingClaims) {
if (remainingDebtPaid <= 0) break;
const payForThisClaim = Math.min(claim.amount, remainingDebtPaid);

// 1. Update the claim amount/status
const newAmount = claim.amount - payForThisClaim;
await tx.debtClaim.update({
where: { id: claim.id },
data: {
amount: newAmount,
status: newAmount === 0 ? "RECOVERED" : "PENDING",
},
});

// 2. Credit the creditor's wallet directly
    const creditorWallet = await tx.wallet.upsert({
      where: { userId: claim.creditorUserId },
      create: { userId: claim.creditorUserId, balance: payForThisClaim, pendingBalance: 0 },
      update: { balance: { increment: payForThisClaim } },
    });

// 3. Record transaction for the creditor's wallet (REFUND)
await tx.transaction.create({
data: {
walletId: creditorWallet.id,
dealId: claim.dealId,
type: "REFUND",
amount: payForThisClaim,
status: "COMPLETED",
description: `Recovered clawback debt refund from influencer payout (Deal: ${claim.dealId})`,
},
});

remainingDebtPaid -= payForThisClaim;
}

return remainingDebtPaid;
}

async function createNewWalletWithCredit(
tx: Prisma.TransactionClient,
userId: string,
creditAmount: number,
dealId?: string,
description?: string,
razorpayPaymentId?: string | null,
metadata?: Record<string, unknown>,
) {
const newWallet = await tx.wallet.create({
data: {
userId,
balance: creditAmount,
totalEarned: creditAmount,
},
});

if (creditAmount > 0) {
await createCreditTransaction(tx, newWallet.id, creditAmount, dealId, description, razorpayPaymentId, metadata);
}

return newWallet;
}

interface ApplyDebtRecoveryConfig {
tx: Prisma.TransactionClient;
wallet: { id: string; debt: number };
userId: string;
creditAmount: number;
dealId: string | undefined;
description: string | undefined;
razorpayPaymentId: string | null | undefined;
metadata: Record<string, unknown> | undefined;
}

async function applyDebtRecovery(config: ApplyDebtRecoveryConfig) {
const {
tx,
wallet,
userId,
creditAmount,
dealId,
description,
razorpayPaymentId,
metadata,
} = config;
const outstandingDebt = wallet.debt || 0;
const debtPaid = Math.min(outstandingDebt, creditAmount);
const netCredit = creditAmount - debtPaid;

const updatedWallet = await tx.wallet.update({
where: { id: wallet.id },
data: {
balance: { increment: netCredit },
totalEarned: { increment: netCredit },
debt: { decrement: debtPaid },
},
});

  // Lock the debt claim rows to serialize concurrent debt recovery distributions for this wallet
  await tx.$queryRaw`SELECT id FROM "DebtClaim" WHERE "debtorWalletId" = ${wallet.id} AND "status" = 'PENDING' AND "amount" > 0 FOR UPDATE`;

  const pendingClaims = await tx.debtClaim.findMany({
    where: {
      debtorWalletId: wallet.id,
      status: "PENDING",
      amount: { gt: 0 },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, amount: true, creditorUserId: true, dealId: true },
  });

const remainingDebtPaid = await distributeRecoveredDebtToCreditors(
tx,
debtPaid,
pendingClaims
);

if (remainingDebtPaid > 0) {
logger.critical("DEBT_DISTRIBUTION_GAP: Debt recovered but not fully distributed to creditors due to claim sum discrepancy", {
walletId: wallet.id,
userId,
remainingDebtPaid,
debtPaid,
});
try {
await tx.auditLog.create({
data: {
actorId: "PLATFORM_TREASURY",
actionType: "DEBT_DISTRIBUTION_GAP",
entityType: "Wallet",
entityId: wallet.id,
beforeJSON: { debtPaid, claimsSum: debtPaid - remainingDebtPaid },
afterJSON: { remainingUndistributed: remainingDebtPaid, userId, dealId: dealId ?? null },
},
});
} catch (auditErr) {
logger.error("DEBT_DISTRIBUTION_GAP: Failed to write audit record manual review required immediately", {
walletId: wallet.id,
userId,
remainingDebtPaid,
error: auditErr,
});
}
}

await tx.transaction.create({
data: {
walletId: wallet.id,
dealId: dealId || null,
type: "DEBIT",
amount: debtPaid,
status: "COMPLETED",
description: `Debt recovery auto-deduction for outstanding clawback balance`,
metadata: { balanceImpact: false, source: "debt_recovery" },
},
});

if (netCredit > 0) {
await createCreditTransaction(
tx,
wallet.id,
netCredit,
dealId,
description || `Payout credited (net of debt)`,
razorpayPaymentId,
metadata
);
}

return updatedWallet;
}

/**
* Credits the wallet of a user, applying any outstanding debts.
* If user has outstanding debt, it deducts the credit amount up to the debt.
*/
export async function creditWalletWithDebtAdjustment(
tx: Prisma.TransactionClient,
userId: string,
creditAmount: number,
dealId?: string,
description?: string,
razorpayPaymentId?: string | null,
metadata?: Record<string, unknown>,
) {
const wallets = await tx.$queryRaw<{ id: string; debt: number }[]>`
SELECT id, debt FROM "Wallet" WHERE "userId" = ${userId} FOR UPDATE
`;
const wallet = wallets[0] || null;

if (!wallet) {
return createNewWalletWithCredit(tx, userId, creditAmount, dealId, description, razorpayPaymentId, metadata);
}

const outstandingDebt = wallet.debt || 0;
if (outstandingDebt > 0 && creditAmount > 0) {
return applyDebtRecovery({
tx,
wallet,
userId,
creditAmount,
dealId,
description,
razorpayPaymentId,
metadata,
});
}

const updatedWallet = await tx.wallet.update({
where: { id: wallet.id },
data: {
balance: { increment: creditAmount },
totalEarned: { increment: creditAmount },
},
});

if (creditAmount > 0) {
await createCreditTransaction(tx, wallet.id, creditAmount, dealId, description, razorpayPaymentId, metadata);
}

return updatedWallet;
}

