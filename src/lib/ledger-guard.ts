import { Prisma, DealStatus } from "@prisma/client";

import prisma from "./db";
import { logger } from "./logger";
import { createActivityLog } from "./audit";
import { redis } from "./redis";
import { ACTIVE_DEAL_STATUSES } from "./utils";

const CREDIT_TYPES = new Set(["CREDIT", "REFUND"]);
const DEBIT_TYPES = new Set([
"DEBIT",
"WITHDRAWAL",
"PLATFORM_FEE",
"CLAWBACK",
"CHARGEBACK",
]);

type LedgerTransaction = {
type: string;
amount: number;
description: string | null;
metadata: Prisma.JsonValue | null;
razorpayPaymentId: string | null;
};

function getMetadataObject(metadata: Prisma.JsonValue | null): Record<string, unknown> | null {
if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
return null;
}

return metadata as Record<string, unknown>;
}

function impactsStoredWalletBalance(transaction: LedgerTransaction) {
const metadata = getMetadataObject(transaction.metadata);
if (metadata?.balanceImpact === false) return false;
if (metadata?.balanceImpact === true) return true;

const description = transaction.description || "";

// Legacy audit rows created before balanceImpact metadata existed.
if (
transaction.type === "DEBIT" &&
transaction.razorpayPaymentId &&
description === "Payment held for deal (Escrow)"
) {
return false;
}

if (
transaction.type === "DEBIT" &&
description.startsWith("Funds reserved for direct invite deal:")
) {
return false;
}

if (
transaction.type === "DEBIT" &&
description.startsWith("TDS deduction")
) {
return false;
}

return true;
}

/**
* Ledger Invariant Verification Engine (LIVE)
*
* Recalculates wallet balances from the transaction ledger.
* This should be run as a background task to detect financial drift.
*
* INVARIANT: wallet.balance === sum(balance-impacting credits) - sum(balance-impacting debits)
*/

export interface VerificationAnomaly {
walletId: string;
userId: string;
calculatedBalance: number;
storedBalance: number;
drift: number;
storedPendingBalance?: number;
pendingDrift?: number;
}

/**
* Recalculate and verify a specific user's wallet balance.
* Returns null if everything is correct, or anomaly data if drift exists.
*/
async function verifyWalletBalance(userId: string): Promise<VerificationAnomaly | null> {
  return prisma.$transaction(async (tx) => {
    // 1. Lock the wallet row to prevent concurrent updates during verification
    await tx.$queryRaw`SELECT id FROM "Wallet" WHERE "userId" = ${userId} FOR UPDATE`;

    const wallet = await tx.wallet.findUnique({
      where: { userId },
    });
    if (!wallet) {
      return null;
    }

    // FIX: Use findMany to allow impactsStoredWalletBalance filtering, which correctly excludes
    // TDS deductions, escrow rows, and other non-balance-impacting transactions.
    const allTransactions = await tx.transaction.findMany({
      where: {
        wallet: { userId },
        status: "COMPLETED",
        deletedAt: null,
        type: { in: ["CREDIT", "REFUND", "DEBIT", "WITHDRAWAL", "PLATFORM_FEE", "CLAWBACK", "CHARGEBACK"] },
      },
      select: {
        type: true,
        amount: true,
        description: true,
        metadata: true,
        razorpayPaymentId: true,
      },
    });

    const balanceImpacting = allTransactions.filter(impactsStoredWalletBalance);

    let totalCredits = 0;
    let totalDebits = 0;
    for (const t of balanceImpacting) {
      if (CREDIT_TYPES.has(t.type)) totalCredits += t.amount;
      else if (DEBIT_TYPES.has(t.type)) totalDebits += t.amount;
    }
    const calculatedBalance = totalCredits - totalDebits;

    let expectedPendingBalance = 0;
    const user = await tx.user.findUnique({
      where: { id: wallet.userId },
      select: { userType: true },
    });

    if (user?.userType === "BRAND") {
      const brandProfile = await tx.brandProfile.findUnique({
        where: { userId: wallet.userId },
        select: { id: true },
      });

      if (brandProfile) {
        const [campaignEscrow, dealEscrow] = await Promise.all([
          tx.campaign.findMany({
            where: {
              brandId: brandProfile.id,
              status: { notIn: ["COMPLETED", "CANCELLED"] },
            },
            select: { fundedAmount: true, reservedTotalAmount: true },
          }),
          tx.deal.aggregate({
            where: {
              brandId: brandProfile.id,
              status: { in: ACTIVE_DEAL_STATUSES as DealStatus[] },
            },
            _sum: { totalAmount: true },
          }),
        ]);

        const campaignUnallocated = campaignEscrow.reduce(
          (sum, c) => sum + Math.max(0, (c.fundedAmount || 0) - (c.reservedTotalAmount || 0)),
          0,
        );
        const dealUnreleased = dealEscrow._sum.totalAmount || 0;

        expectedPendingBalance = campaignUnallocated + dealUnreleased;
      }
    }

    const pendingDrift = wallet.pendingBalance < 0
      ? wallet.pendingBalance
      : wallet.pendingBalance - expectedPendingBalance;

    if (calculatedBalance !== wallet.balance || pendingDrift !== 0) {
      const drift = wallet.balance - calculatedBalance;
      const anomaly = {
        walletId: wallet.id,
        userId: wallet.userId,
        calculatedBalance,
        storedBalance: wallet.balance,
        drift,
        storedPendingBalance: wallet.pendingBalance,
        pendingDrift,
      };

      await handleLedgerDriftAnomaly(tx, wallet, calculatedBalance, drift, anomaly);
      return anomaly;
    }

    return null;
  });
}

async function handleLedgerDriftAnomaly(
  tx: Prisma.TransactionClient,
  wallet: { id: string; userId: string },
  calculatedBalance: number,
  drift: number,
  anomaly: VerificationAnomaly
): Promise<void> {
  // Securely log the anomaly. Auto-correction is gated by env so production
  // teams can require manual review unless an incident runbook enables it.
  logger.error("CRITICAL LEDGER DRIFT DETECTED", anomaly);

  // CRITICAL: Await the audit log ledger drift MUST be recorded
  try {
    await createActivityLog({
      userId: wallet.userId,
      action: "SECURITY_LEDGER_ALERT",
      metadata: {
        ...anomaly,
        reason: "Total ledger sum does not match stored balance"
      }
    }, tx);
  } catch (auditErr) {
    // If even the audit log fails, emit a critical log so monitoring catches it
    logger.error("CRITICAL: Failed to record ledger drift audit log", auditErr, {
      walletId: wallet.id,
      userId: wallet.userId,
      drift,
    });
  }

  if (process.env.AUTO_CORRECT_LEDGER_DRIFT === "true") {
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: calculatedBalance },
    });

    await createActivityLog({
      userId: wallet.userId,
      action: "SECURITY_LEDGER_AUTO_CORRECTED",
      entityType: "Wallet",
      entityId: wallet.id,
      metadata: {
        ...anomaly,
        correctedBalance: calculatedBalance,
      },
    }, tx);
  }
}

/**
* Scan all wallets for financial drift.
* Runs periodically to guard system integrity.
*/
const LEDGER_SCAN_CURSOR_KEY = "ledger:scan:last-wallet-id";

async function scanWalletsBatch(wallets: { id: string; userId: string }[], anomalies: VerificationAnomaly[]) {
  const CONCURRENCY_LIMIT = 5;
  for (let i = 0; i < wallets.length; i += CONCURRENCY_LIMIT) {
    const batch = wallets.slice(i, i + CONCURRENCY_LIMIT);
    const batchResults = await Promise.all(
      batch.map(wallet =>
        verifyWalletBalance(wallet.userId).catch(err => {
          logger.error("Ledger scan failed for wallet verification", {
            userId: wallet.userId,
            error: err instanceof Error ? err.message : String(err),
          });
          return null;
        })
      )
    );
    for (const anomaly of batchResults) {
      if (anomaly) anomalies.push(anomaly);
    }
  }
}

async function fetchWalletBatchForScan(currentTake: number, cursor: string | undefined) {
return prisma.wallet.findMany({
take: currentTake,
...(cursor ? { where: { id: { gt: cursor } } } : {}),
orderBy: { id: "asc" },
select: { id: true, userId: true }
});
}

export async function scanAllWalletsForDrift(maxScanCount: number = 500): Promise<VerificationAnomaly[]> {
  const batchSize = 100;
  let cursor = (await redis.get(LEDGER_SCAN_CURSOR_KEY)) || undefined;
  let totalScanned = 0;

  const anomalies: VerificationAnomaly[] = [];
  while (totalScanned < maxScanCount) {
    const remainingToScan = maxScanCount - totalScanned;
    const currentTake = Math.min(batchSize, remainingToScan);

    const wallets = await fetchWalletBatchForScan(currentTake, cursor);

    if (wallets.length === 0) {
      cursor = undefined;
      break;
    }

    await scanWalletsBatch(wallets, anomalies);

    totalScanned += wallets.length;
    cursor = wallets.at(-1)?.id;
    if (wallets.length < currentTake) {
      cursor = undefined;
      break;
    }
  }

  if (cursor) {
    await redis.setex(LEDGER_SCAN_CURSOR_KEY, 86400, cursor);
  } else {
    await redis.del(LEDGER_SCAN_CURSOR_KEY);
  }

  return anomalies;
}
