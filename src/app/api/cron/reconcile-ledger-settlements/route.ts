import { NextRequest, NextResponse } from "next/server";
import { apiWrapper } from "@/lib/api-wrapper";
import { validateCronSecret } from "../guard";
import prisma from "@/lib/db";
import { NotificationService } from "@/services/notification.service";
import { logger } from "@/lib/logger";
import { acquireDistributedLock, releaseDistributedLock } from "@/lib/lock";
import { createActivityLog } from "@/lib/audit";
import { fetchRazorpayPayments } from "@/lib/razorpay";

/**
 * Daily Ledger vs Razorpay Settlement Reconciliation Cron Job
 * 
 * Target Schedule: 0 3 * * * (Daily at 3:00 AM IST via QStash)
 * Compares total ledger liabilities, stored wallet balances, and gateway settled inflows/outflows.
 * Triggers critical security alerts to admins if financial drift is detected.
 */

const CRON_LOCK_KEY = "cron:reconcile-ledger-settlements:lock";
const LOCK_TTL_SECS = 300; // 5 minutes

export interface ReconciliationSummary {
  timestamp: string;
  totalUserWallets: number;
  totalUserBalancePaise: number;
  totalPendingEscrowPaise: number;
  treasuryBalancePaise: number;
  tdsTreasuryBalancePaise: number;
  totalSystemLiabilityPaise: number;
  totalLedgerCreditsPaise: number;
  totalLedgerDebitsPaise: number;
  netLedgerBalancePaise: number;
  ledgerToWalletDriftPaise: number;
  totalSettledGatewayDepositsPaise: number;
  totalSettledGatewayPayoutsPaise: number;
  netGatewaySettledPaise: number;
  isBalanced: boolean;
  driftDetected: boolean;
}

export async function performLedgerReconciliation(): Promise<ReconciliationSummary> {
  // 1. Stored Wallet Aggregations
  const [walletAggregates, treasuryWallet, tdsWallet] = await Promise.all([
    prisma.wallet.aggregate({
      where: {
        userId: {
          notIn: ["PLATFORM_TREASURY", "TDS_WITHHOLDING_TREASURY"],
        },
      },
      _sum: {
        balance: true,
        pendingBalance: true,
      },
      _count: {
        id: true,
      },
    }),
    prisma.wallet.findUnique({
      where: { userId: "PLATFORM_TREASURY" },
      select: { balance: true },
    }),
    prisma.wallet.findUnique({
      where: { userId: "TDS_WITHHOLDING_TREASURY" },
      select: { balance: true },
    }),
  ]);

  const totalUserWallets = walletAggregates._count.id || 0;
  const totalUserBalancePaise = walletAggregates._sum.balance || 0;
  const totalPendingEscrowPaise = walletAggregates._sum.pendingBalance || 0;
  const treasuryBalancePaise = treasuryWallet?.balance || 0;
  const tdsTreasuryBalancePaise = tdsWallet?.balance || 0;

  // Total funds accounted for across all wallets
  const totalStoredBalancePaise =
    totalUserBalancePaise + treasuryBalancePaise + tdsTreasuryBalancePaise;
  const totalSystemLiabilityPaise = totalStoredBalancePaise + totalPendingEscrowPaise;

  // 2. Transaction Ledger Aggregations (Completed balance-impacting transactions)
  const [creditTransactions, debitTransactions] = await Promise.all([
    prisma.transaction.aggregate({
      where: {
        status: "COMPLETED",
        deletedAt: null,
        type: { in: ["CREDIT", "REFUND"] },
      },
      _sum: {
        amount: true,
      },
    }),
    prisma.transaction.aggregate({
      where: {
        status: "COMPLETED",
        deletedAt: null,
        type: { in: ["DEBIT", "WITHDRAWAL", "PLATFORM_FEE", "CLAWBACK", "CHARGEBACK", "SHIPPING_CHARGE"] },
        NOT: [
          { description: { startsWith: "TDS deduction" } },
          { description: { startsWith: "Payment held for deal (Escrow)" } },
          { description: { startsWith: "Funds reserved for direct invite deal:" } },
        ],
      },
      _sum: {
        amount: true,
      },
    }),
  ]);

  const totalLedgerCreditsPaise = creditTransactions._sum.amount || 0;
  const totalLedgerDebitsPaise = debitTransactions._sum.amount || 0;
  const netLedgerBalancePaise = totalLedgerCreditsPaise - totalLedgerDebitsPaise;

  // Drift between all wallet stored balances and net ledger sum
  const ledgerToWalletDriftPaise = totalStoredBalancePaise - netLedgerBalancePaise;

  // 3. Gateway Inflow / Outflow Aggregations (Razorpay settlements)
  const [gatewayDeposits, gatewayPayouts] = await Promise.all([
    prisma.transaction.aggregate({
      where: {
        status: "COMPLETED",
        type: "CREDIT",
        razorpayPaymentId: { not: null },
      },
      _sum: {
        amount: true,
      },
    }),
    prisma.withdrawal.aggregate({
      where: {
        status: "COMPLETED",
        razorpayPayoutId: { not: null },
      },
      _sum: {
        amount: true,
      },
    }),
  ]);

  const totalSettledGatewayDepositsPaise = gatewayDeposits._sum.amount || 0;
  const totalSettledGatewayPayoutsPaise = gatewayPayouts._sum.amount || 0;
  const netGatewaySettledPaise =
    totalSettledGatewayDepositsPaise - totalSettledGatewayPayoutsPaise;

  const driftDetected = ledgerToWalletDriftPaise !== 0;
  const isBalanced = !driftDetected;

  const summary: ReconciliationSummary = {
    timestamp: new Date().toISOString(),
    totalUserWallets,
    totalUserBalancePaise,
    totalPendingEscrowPaise,
    treasuryBalancePaise,
    tdsTreasuryBalancePaise,
    totalSystemLiabilityPaise,
    totalLedgerCreditsPaise,
    totalLedgerDebitsPaise,
    netLedgerBalancePaise,
    ledgerToWalletDriftPaise,
    totalSettledGatewayDepositsPaise,
    totalSettledGatewayPayoutsPaise,
    netGatewaySettledPaise,
    isBalanced,
    driftDetected,
  };

  return summary;
}

async function notifyAdminsOfReconciliationDrift(summary: ReconciliationSummary) {
  const adminUsers = await prisma.user.findMany({
    where: { userType: "ADMIN", status: "ACTIVE" },
    select: { id: true },
    take: 20,
  });

  if (adminUsers.length === 0) {
    logger.error("RECONCILE_DRIFT: Drift detected but NO admin users exist to notify", {
      drift: summary.ledgerToWalletDriftPaise,
    });
    return;
  }

  const driftInRupees = (summary.ledgerToWalletDriftPaise / 100).toFixed(2);
  const storedTotalRupees = (
    (summary.totalUserBalancePaise + summary.treasuryBalancePaise + summary.tdsTreasuryBalancePaise) /
    100
  ).toFixed(2);
  const ledgerTotalRupees = (summary.netLedgerBalancePaise / 100).toFixed(2);

  const notifications = adminUsers.map((admin) => ({
    userId: admin.id,
    type: "admin_alert",
    title: `🚨 Financial Reconciliation Alert: Drift of ₹${driftInRupees}`,
    message:
      `Daily ledger reconciliation detected a balance discrepancy.\n` +
      `Stored Total: ₹${storedTotalRupees}\n` +
      `Ledger Total: ₹${ledgerTotalRupees}\n` +
      `Drift: ₹${driftInRupees}\n` +
      `Immediate financial inspection required.`,
    data: {
      type: "ledger_reconciliation_drift",
      summary,
    },
  }));

  await NotificationService.createNotifications(notifications);

  logger.critical("RECONCILE_CRITICAL_DRIFT: Admin notifications sent for ledger mismatch", {
    driftPaise: summary.ledgerToWalletDriftPaise,
    adminCount: adminUsers.length,
  });
}

/**
 * Computes yesterday's 00:00:00 to 23:59:59 window in Indian Standard Time (IST, UTC+5:30),
 * returning UTC epoch timestamps in seconds as required by the Razorpay Payments API.
 */
export function getYesterdayISTWindow(): { from: number; to: number } {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const istMs = utcMs + 5.5 * 3600000;
  const istDate = new Date(istMs);

  const startYesterdayIST = new Date(istDate.getFullYear(), istDate.getMonth(), istDate.getDate() - 1, 0, 0, 0, 0);
  const endYesterdayIST = new Date(istDate.getFullYear(), istDate.getMonth(), istDate.getDate() - 1, 23, 59, 59, 0);

  const from = Math.floor((startYesterdayIST.getTime() - 5.5 * 3600000) / 1000);
  const to = Math.floor((endYesterdayIST.getTime() - 5.5 * 3600000) / 1000);

  return { from, to };
}

/**
 * Daily Gateway Payment vs Ledger Cross-Check for Yesterday in IST.
 * Fetches all captured payments from Razorpay (paginating count/skip max 100)
 * and compares with prisma.transaction table.
 * Any missing transaction or amount mismatch is logged and recorded in DeadLetterJob.
 */
export async function reconcileGatewayPaymentsIST(): Promise<{
  totalGatewayPayments: number;
  matchedCount: number;
  mismatchCount: number;
}> {
  const { from, to } = getYesterdayISTWindow();
  let skip = 0;
  const count = 100;
  let hasMore = true;
  let totalGatewayPayments = 0;
  let matchedCount = 0;
  let mismatchCount = 0;

  while (hasMore) {
    const payments = await fetchRazorpayPayments({ from, to, count, skip });
    if (!payments || payments.length === 0) {
      break;
    }

    for (const payment of payments) {
      if (payment.status !== "captured") continue;
      totalGatewayPayments++;

      const tx = await prisma.transaction.findFirst({
        where: { razorpayPaymentId: payment.id },
      });

      if (!tx) {
        mismatchCount++;
        logger.critical("[Reconciliation] Gateway payment missing from ledger!", {
          paymentId: payment.id,
          amount: payment.amount,
          created_at: payment.created_at,
        });

        await prisma.deadLetterJob.create({
          data: {
            endpoint: "/api/cron/reconcile-ledger-settlements",
            category: "TIME_CRITICAL",
            topic: "reconciliation.gateway_mismatch",
            deduplicationId: `recon_missing_${payment.id}`,
            payload: { paymentId: payment.id, amount: payment.amount, reason: "MISSING_FROM_LEDGER" },
            errorMessage: `Gateway payment ${payment.id} for ₹${payment.amount / 100} exists on Razorpay but missing from transaction ledger`,
            attempts: 1,
            status: "FAILED",
          },
        }).catch((err) => logger.error("Failed to record DLQ for missing payment", err));
      } else if (tx.amount !== payment.amount) {
        mismatchCount++;
        logger.critical("[Reconciliation] Gateway payment amount mismatch with ledger!", {
          paymentId: payment.id,
          gatewayAmount: payment.amount,
          ledgerAmount: tx.amount,
        });

        await prisma.deadLetterJob.create({
          data: {
            endpoint: "/api/cron/reconcile-ledger-settlements",
            category: "TIME_CRITICAL",
            topic: "reconciliation.gateway_mismatch",
            deduplicationId: `recon_amount_mismatch_${payment.id}`,
            payload: { paymentId: payment.id, gatewayAmount: payment.amount, ledgerAmount: tx.amount, reason: "AMOUNT_MISMATCH" },
            errorMessage: `Gateway payment ${payment.id} amount mismatch: Razorpay=${payment.amount} vs Ledger=${tx.amount}`,
            attempts: 1,
            status: "FAILED",
          },
        }).catch((err) => logger.error("Failed to record DLQ for payment amount mismatch", err));
      } else {
        matchedCount++;
      }
    }

    if (payments.length < count) {
      hasMore = false;
    } else {
      skip += count;
    }
  }

  return { totalGatewayPayments, matchedCount, mismatchCount };
}

async function _handler_POST(_req: NextRequest) {
  await validateCronSecret(_req);

  const lockToken = await acquireDistributedLock(CRON_LOCK_KEY, LOCK_TTL_SECS);
  if (!lockToken) {
    logger.warn("cron:reconcile-ledger-settlements: Lock already held, skipping concurrent run.");
    return NextResponse.json({
      success: true,
      message: "Another reconciliation instance is currently running",
      data: { locked: true },
    });
  }

  try {
    const [summary, gatewayRecon] = await Promise.all([
      performLedgerReconciliation(),
      reconcileGatewayPaymentsIST(),
    ]);

    if (summary.driftDetected) {
      logger.critical("CRITICAL_RECONCILIATION_MISMATCH: Stored wallet balances do not match ledger sum", {
        driftPaise: summary.ledgerToWalletDriftPaise,
        summary,
      });

      await notifyAdminsOfReconciliationDrift(summary);

      await createActivityLog({
        userId: "SYSTEM_RECONCILIATION",
        action: "SECURITY_LEDGER_ALERT",
        entityType: "Ledger",
        metadata: {
          reason: "Daily ledger vs stored balances mismatch",
          summary: summary as unknown as Record<string, unknown>,
        },
      });
    } else {
      logger.info("Ledger reconciliation completed successfully: 100% balanced", {
        totalSystemLiabilityPaise: summary.totalSystemLiabilityPaise,
        netLedgerBalancePaise: summary.netLedgerBalancePaise,
      });
    }

    return NextResponse.json({
      success: true,
      message: summary.isBalanced
        ? "Reconciliation complete: All ledger balances and stored wallets match."
        : `Reconciliation discrepancy detected: Drift of ₹${(summary.ledgerToWalletDriftPaise / 100).toFixed(2)}`,
      data: {
        ...summary,
        gatewayReconciliation: gatewayRecon,
      },
    });
  } finally {
    await releaseDistributedLock(CRON_LOCK_KEY, lockToken).catch((err) => {
      logger.error("Failed to release reconciliation lock", err);
    });
  }
}

export const GET = apiWrapper(_handler_POST);
export const POST = apiWrapper(_handler_POST);
