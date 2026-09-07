import { NextRequest, NextResponse } from "next/server";
import { apiWrapper } from "@/lib/api-wrapper";
import { validateCronSecret } from "../guard";
import { scanAllWalletsForDrift, VerificationAnomaly } from "@/lib/ledger-guard";
import prisma from "@/lib/db";
import { NotificationService } from "@/services/notification.service";
import { logger } from "@/lib/logger";

/**
* Ledger Drift Scan Daily Cron
*
* Recalculates every wallet's balance from the transaction ledger.
* If drift is detected, admin notifications are created so the
* operations team can investigate before financial drift compounds.
*
* Schedule: 0 2 * * * (daily at 2:00 AM IST)
*/

async function notifyAdminsOfAnomalies(anomalies: VerificationAnomaly[]) {
  if (anomalies.length === 0) {
    return;
  }

  const adminUsers = await prisma.user.findMany({
    where: { userType: "ADMIN", status: "ACTIVE" },
    select: { id: true },
    take: 20,
  });

if (adminUsers.length === 0) {
logger.error("LEDGER_SCAN: Anomalies detected but NO admin users exist to notify", {
anomalyCount: anomalies.length,
});
return;
}

const summary = anomalies
.map(
(a) =>
` Wallet ${a.walletId.slice(-6)}: stored ${(a.storedBalance / 100).toFixed(2)} vs ledger ${(a.calculatedBalance / 100).toFixed(2)} (drift ${(a.drift / 100).toFixed(2)})`,
)
.join("\n");

const notifications = adminUsers.map((admin: { id: string }) => ({
userId: admin.id,
type: "admin_alert",
title: ` Ledger Drift Detected ${anomalies.length} wallet(s)`,
message: `Daily ledger scan found balance discrepancies:\n${summary}`,
data: {
type: "ledger_drift",
anomalyCount: anomalies.length,
anomalies: anomalies.map((a) => ({
walletId: a.walletId,
userId: a.userId,
drift: a.drift,
})),
detectedAt: new Date().toISOString(),
},
}));

await NotificationService.createNotifications(notifications);

logger.error("LEDGER_SCAN: Admin notifications sent for financial drift", {
anomalyCount: anomalies.length,
adminCount: adminUsers.length,
});
}

async function _handler_POST(_req: NextRequest) {
  await validateCronSecret(_req);

  const anomalies = await scanAllWalletsForDrift(500);

  if (anomalies.length > 0) {
    await notifyAdminsOfAnomalies(anomalies);
  }

  logger.info("Ledger scan complete", {
    totalAnomalies: anomalies.length,
    clean: anomalies.length === 0,
  });

  return NextResponse.json({
    success: true,
    message: anomalies.length === 0
      ? "All wallets balanced no drift detected"
      : `${anomalies.length} wallet(s) with drift admin alerted`,
    data: {
      anomalyCount: anomalies.length,
      scannedAt: new Date().toISOString(),
    },
  });
}

export const GET = apiWrapper(_handler_POST);
export const POST = apiWrapper(_handler_POST);
