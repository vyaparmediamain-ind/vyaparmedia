import { NextRequest, NextResponse } from "next/server";
import { apiWrapper } from "@/lib/api-wrapper";
import { validateCronSecret } from "../guard";
import { logger } from "@/lib/logger";
import { acquireDistributedLock, releaseDistributedLock } from "@/lib/lock";
import { createActivityLog } from "@/lib/audit";
import {
  performLedgerReconciliation,
  reconcileGatewayPaymentsIST,
  notifyAdminsOfReconciliationDrift,
} from "@/lib/ledger-reconciliation";

/**
 * Daily Ledger vs Razorpay Settlement Reconciliation Cron Job
 * 
 * Target Schedule: 0 3 * * * (Daily at 3:00 AM IST via QStash)
 * Reconciles ledger settlements excluding non-impacting memo transactions:
 * - startsWith: "TDS deduction"
 * - type: { in: ["DEBIT", "WITHDRAWAL", "PLATFORM_FEE", "CLAWBACK", "CHARGEBACK", "SHIPPING_CHARGE"] }
 */

const CRON_LOCK_KEY = "cron:reconcile-ledger-settlements:lock";
const LOCK_TTL_SECS = 300; // 5 minutes

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
