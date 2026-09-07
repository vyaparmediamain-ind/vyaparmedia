import { Prisma } from "@prisma/client";
import { ensurePlatformTreasury } from "./db";
import { creditWalletWithDebtAdjustment } from "./wallet-debt";

type DealFeeInput = {
id: string;
amount: number;
platformFee: number;
gatewayFee: number;
influencerPayout: number | null;
};

type PayoutWithTaxResult = {
grossPayout: number;
tdsAmount: number;
netPayout: number;
};

// Rs 5,00,000 100 paise = 50,000,000 paise. Section 194-O threshold.
// Previous value (500000) was Rs 5,000 100 too small, causing illegal over-withholding.
const TDS_THRESHOLD = 50_000_000;
const TDS_RATE = 0.001; // Section 194-O: 0.1%.

function currentIndianFinancialYearStart() {
const now = new Date();
// India Standard Time is UTC+5:30. Use IST so April 1 00:00 IST is correctly
// treated as the new FY start (April 1 00:00 IST = March 31 18:30 UTC without
// this offset getUTCMonth() returns 2/March and bucketing goes to the prior FY).
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const istNow = new Date(now.getTime() + IST_OFFSET_MS);
const year = istNow.getUTCFullYear();
const month = istNow.getUTCMonth();
return new Date(Date.UTC(month >= 3 ? year : year - 1, 3, 1, 0, 0, 0, 0) - IST_OFFSET_MS);
}

async function calculateTdsForPayout(
  tx: Prisma.TransactionClient,
  userId: string,
  dealId: string,
  grossPayout: number,
) {
  if (grossPayout <= 0) {
    return 0;
  }

  // Lock the influencer's wallet to serialize concurrent TDS and balance updates.
  // Avoid locking the User table to prevent deadlock hazards with other operations.
  await tx.$queryRaw`SELECT id FROM "Wallet" WHERE "userId" = ${userId} FOR UPDATE`;

  const taxCompliance = await tx.indiaTaxCompliance.findUnique({
    where: { userId },
    select: { panLast4: true, tdsSection: true },
  });

  const is194J = taxCompliance?.tdsSection?.startsWith("194J") ?? false;

  const fyDeals = await tx.deal.findMany({
    where: {
      influencer: { userId },
      status: "COMPLETED",
      completedAt: { gte: currentIndianFinancialYearStart() },
      id: { not: dealId },
    },
    // tdsDeducted required to avoid re-taxing previously withheld amounts
    select: { influencerPayout: true, amount: true, tdsDeducted: true },
  });

  const previousFyEarnings = fyDeals.reduce(
    (sum, deal) => sum + (deal.influencerPayout ?? deal.amount),
    0,
  );

  const totalEarnings = previousFyEarnings + grossPayout;
  const tdsThreshold = is194J ? 3_000_000 : TDS_THRESHOLD; // Rs 30,000 for 194J, Rs 5,00,000 for 194-O
  if (totalEarnings < tdsThreshold) return 0;

  // Calculate total TDS required on entire FY earnings, then subtract already-deducted amounts.
  // This prevents under-withholding when the threshold is crossed mid-year on a large payout.
  const previousFyTdsAlreadyDeducted = fyDeals.reduce(
    (sum, deal) => sum + (deal.tdsDeducted ?? 0),
    0,
  );
  
  const hasPan = Boolean(taxCompliance?.panLast4);
  const tdsRate = calculateApplicableTdsRate(hasPan, is194J);

  const totalRequiredTds = Math.round(totalEarnings * tdsRate);
  return Math.max(0, totalRequiredTds - previousFyTdsAlreadyDeducted);
}

function calculateApplicableTdsRate(hasPan: boolean, is194J: boolean): number {
  if (!hasPan) {
    return is194J ? 0.20 : 0.05; // Under Section 206AA, apply penal rate if PAN is missing and threshold is crossed
  }
  return is194J ? 0.10 : TDS_RATE;
}

function getAppliedTdsRatePercent(hasPan: boolean, is194J: boolean): string {
  if (!hasPan) {
    return is194J ? "20%" : "5%";
  }
  if (is194J) {
    return "10%";
  }
  return "0.1%";
}

export async function creditInfluencerPayoutWithTax(
tx: Prisma.TransactionClient,
params: {
userId: string;
dealId: string;
grossPayout: number;
description: string;
razorpayPaymentId?: string | null;
metadata?: Prisma.InputJsonValue;
},
): Promise<PayoutWithTaxResult> {
const grossPayout = Math.max(0, Math.round(params.grossPayout));
const calculatedTds = await calculateTdsForPayout(
  tx,
  params.userId,
  params.dealId,
  grossPayout,
);
const tdsAmount = Math.min(grossPayout, calculatedTds);
const netPayout = Math.max(0, grossPayout - tdsAmount);

const wallet = await creditWalletWithDebtAdjustment(
tx,
params.userId,
netPayout,
params.dealId,
params.description,
params.razorpayPaymentId ?? null,
params.metadata as Record<string, unknown> | undefined,
);

  if (tdsAmount > 0) {
    const taxCompliance = await tx.indiaTaxCompliance.findUnique({
      where: { userId: params.userId },
      select: { panLast4: true, tdsSection: true },
    });
    const is194J = taxCompliance?.tdsSection?.startsWith("194J") ?? false;
    const appliedSection = is194J ? "194J" : "194-O";
    const appliedRatePercent = getAppliedTdsRatePercent(Boolean(taxCompliance?.panLast4), is194J);

    await tx.transaction.create({
      data: {
        walletId: wallet.id,
        dealId: params.dealId,
        type: "DEBIT",
        amount: tdsAmount,
        status: "COMPLETED",
        description: `TDS deduction (Section ${appliedSection}, ${appliedRatePercent}) for deal: ${params.dealId}`,
        metadata: {
          balanceImpact: false,
          source: "tds_withholding",
          grossPayout,
          netPayout,
          tdsSection: appliedSection,
          tdsRate: is194J ? 0.10 : 0.001,
        },
      },
    });
  }

// Populate tax fields on Deal for financial reporting
await tx.deal.update({
where: { id: params.dealId },
data: {
tdsDeducted: tdsAmount,
grossPayout,
netPayout,
},
});

return { grossPayout, tdsAmount, netPayout };
}

export async function recordPlatformFeeRevenue(
tx: Prisma.TransactionClient,
params: {
brandUserId: string | null | undefined;
deal: DealFeeInput;
feeRatio?: number;
source: string;
},
) {
const ratio = Math.min(1, Math.max(0, params.feeRatio ?? 1));
const platformFee = Math.round((params.deal.platformFee || 0) * ratio);
const gatewayFee = Math.round((params.deal.gatewayFee || 0) * ratio);

  if (!params.brandUserId || (platformFee <= 0 && gatewayFee <= 0)) return;

  // Lock the deal row to serialize concurrent platform fee recordings for the same deal
  await tx.$queryRaw`SELECT id FROM "Deal" WHERE id = ${params.deal.id} FOR UPDATE`;

  const existingTransactions = await tx.transaction.findMany({
    where: {
      dealId: params.deal.id,
      type: "PLATFORM_FEE",
    },
    select: { metadata: true },
  });

const hasDuplicateFee = existingTransactions.some((t) => {
const meta = t.metadata as Record<string, unknown> | null;
return meta?.source === params.source;
});

if (hasDuplicateFee) return;

const wallet = await tx.wallet.upsert({
where: { userId: params.brandUserId },
create: { userId: params.brandUserId, balance: 0, pendingBalance: 0 },
update: {},
});

if (platformFee > 0) {
await tx.transaction.create({
data: {
walletId: wallet.id,
dealId: params.deal.id,
type: "PLATFORM_FEE",
amount: platformFee,
status: "COMPLETED",
description: `Platform fee for deal: ${params.deal.id}`,
metadata: {
balanceImpact: false,
source: params.source,
gatewayFee,
feeRatio: ratio,
grossDealAmount: params.deal.amount,
influencerPayout: params.deal.influencerPayout ?? params.deal.amount,
},
},
});

// Credit the PLATFORM_TREASURY wallet with the collected fee so that
// referral GMV-share payouts have a real funding source (double-entry).
await ensurePlatformTreasury(tx);
const treasuryWallet = await tx.wallet.update({
where: { userId: "PLATFORM_TREASURY" },
data: { balance: { increment: platformFee } },
});

await tx.transaction.create({
data: {
walletId: treasuryWallet.id,
dealId: params.deal.id,
type: "CREDIT",
amount: platformFee,
status: "COMPLETED",
description: `Platform fee income credited to treasury for deal: ${params.deal.id}`,
metadata: {
source: params.source,
feeRatio: ratio,
brandUserId: params.brandUserId,
},
},
});
}
}
