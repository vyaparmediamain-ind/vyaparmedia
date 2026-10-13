import { Prisma } from "@prisma/client";
import { ensurePlatformTreasury, ensureTdsTreasury } from "./db";
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

import {
  TDS_194O_RATE,
  TDS_194O_THRESHOLD_PAISE,
  TDS_194J_RATE,
  TDS_194J_THRESHOLD_PAISE,
  TDS_206AA_PENAL_RATE,
  TDS_194J_PENAL_RATE,
  TDS_194O_RATE_PERCENT_STRING,
  TDS_206AA_PENAL_RATE_PERCENT_STRING,
  TDS_194J_RATE_PERCENT_STRING,
  TDS_194J_PENAL_RATE_PERCENT_STRING,
  IST_OFFSET_MS,
} from "@/constants";

function currentIndianFinancialYearStart() {
const now = new Date();
// India Standard Time is UTC+5:30. Use IST so April 1 00:00 IST is correctly
// treated as the new FY start (April 1 00:00 IST = March 31 18:30 UTC without
// this offset getUTCMonth() returns 2/March and bucketing goes to the prior FY).
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

  // Fetch current deal's prior gross payouts and withheld TDS (supports milestones/partial settlements)
  const currentDeal = await tx.deal.findUnique({
    where: { id: dealId },
    select: { grossPayout: true, tdsDeducted: true },
  });
  const currentDealPriorGross = currentDeal?.grossPayout ?? 0;
  const currentDealPriorTds = currentDeal?.tdsDeducted ?? 0;

  const fyDeals = await tx.deal.findMany({
    where: {
      influencer: { userId },
      status: { in: ["COMPLETED", "ACTIVE", "DISPUTED"] },
      completedAt: { gte: currentIndianFinancialYearStart() },
      id: { not: dealId },
    },
    // tdsDeducted required to avoid re-taxing previously withheld amounts
    select: { grossPayout: true, influencerPayout: true, amount: true, tdsDeducted: true },
  });

  const previousFyEarnings = fyDeals.reduce(
    (sum, deal) => sum + (deal.grossPayout > 0 ? deal.grossPayout : (deal.influencerPayout ?? deal.amount)),
    currentDealPriorGross,
  );

  const totalEarnings = previousFyEarnings + grossPayout;
  const hasPan = Boolean(taxCompliance?.panLast4);
  // Under Second Proviso to Section 194-O(1), the Rs 5,00,000 threshold only applies if PAN/Aadhaar is furnished.
  // If no PAN is furnished, threshold is 0 and TDS is deducted from the first rupee under Section 206AA.
  const tdsThreshold = !hasPan ? 0 : (is194J ? TDS_194J_THRESHOLD_PAISE : TDS_194O_THRESHOLD_PAISE);
  if (totalEarnings < tdsThreshold) return 0;

  // Calculate total TDS required on entire FY earnings, then subtract already-deducted amounts.
  // This prevents under-withholding when the threshold is crossed mid-year on a large payout.
  const previousFyTdsAlreadyDeducted = fyDeals.reduce(
    (sum, deal) => sum + (deal.tdsDeducted ?? 0),
    currentDealPriorTds,
  );
  
  const tdsRate = calculateApplicableTdsRate(hasPan, is194J);

  const totalRequiredTds = Math.round(totalEarnings * tdsRate);
  return Math.max(0, totalRequiredTds - previousFyTdsAlreadyDeducted);
}

function calculateApplicableTdsRate(hasPan: boolean, is194J: boolean): number {
  if (!hasPan) {
    return is194J ? TDS_194J_PENAL_RATE : TDS_206AA_PENAL_RATE; // Under Section 206AA, apply penal rate if PAN is missing and threshold is crossed
  }
  return is194J ? TDS_194J_RATE : TDS_194O_RATE;
}

function getAppliedTdsRatePercent(hasPan: boolean, is194J: boolean): string {
  if (!hasPan) {
    return is194J ? TDS_194J_PENAL_RATE_PERCENT_STRING : TDS_206AA_PENAL_RATE_PERCENT_STRING;
  }
  if (is194J) {
    return TDS_194J_RATE_PERCENT_STRING;
  }
  return TDS_194O_RATE_PERCENT_STRING;
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
    balanceImpact?: boolean;
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

  const rawMeta =
    params.metadata && typeof params.metadata === "object" && !Array.isArray(params.metadata)
      ? (params.metadata as Record<string, unknown>)
      : {};

  const balanceImpact =
    params.balanceImpact !== undefined
      ? params.balanceImpact
      : (rawMeta.balanceImpact !== undefined ? rawMeta.balanceImpact !== false : true);

  const metadata: Record<string, unknown> = {
    ...rawMeta,
    balanceImpact,
  };

  const wallet = await creditWalletWithDebtAdjustment(
    tx,
    params.userId,
    netPayout,
    params.dealId,
    params.description,
    params.razorpayPaymentId ?? null,
    metadata,
  );

  if (tdsAmount > 0) {
    const taxCompliance = await tx.indiaTaxCompliance.findUnique({
      where: { userId: params.userId },
      select: { panLast4: true, tdsSection: true },
    });
    const is194J = taxCompliance?.tdsSection?.startsWith("194J") ?? false;
    const appliedSection = is194J ? "194J" : "393(1) (Income-tax Act, 2025 / 194-O)";
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
          tdsRate: is194J ? TDS_194J_RATE : TDS_194O_RATE,
        },
      },
    });

    // Double-entry accounting: credit the dedicated TDS withholding treasury wallet
    // so total debits and credits across the platform balance sheet remain equal.
    const tdsTreasuryWallet = await ensureTdsTreasury(tx);
    await tx.wallet.update({
      where: { id: tdsTreasuryWallet.id },
      data: { balance: { increment: tdsAmount } },
    });

    await tx.transaction.create({
      data: {
        walletId: tdsTreasuryWallet.id,
        dealId: params.dealId,
        type: "CREDIT",
        amount: tdsAmount,
        status: "COMPLETED",
        description: `TDS liability credited to tax treasury (Section ${appliedSection}, ${appliedRatePercent}) for deal: ${params.dealId}`,
        metadata: {
          source: "tds_withholding",
          grossPayout,
          netPayout,
          tdsSection: appliedSection,
          tdsRate: is194J ? TDS_194J_RATE : TDS_194O_RATE,
          influencerUserId: params.userId,
        },
      },
    });
  }

  // Lock the deal row to serialize concurrent milestone payouts or settlements
  await tx.$queryRaw`SELECT id FROM "Deal" WHERE id = ${params.dealId} FOR UPDATE`;

  // Increment tax and payout fields on Deal (supporting milestone / partial payouts)
  await tx.deal.update({
    where: { id: params.dealId },
    data: {
      tdsDeducted: { increment: tdsAmount },
      grossPayout: { increment: grossPayout },
      netPayout: { increment: netPayout },
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

    // Credit the PLATFORM_TREASURY wallet with all retained fees (platform + gateway)
    // so total debits and credits across the platform balance sheet remain equal (double-entry).
    const totalFeeRevenue = platformFee + gatewayFee;
    if (totalFeeRevenue > 0) {
      await ensurePlatformTreasury(tx);
      const treasuryWallet = await tx.wallet.update({
        where: { userId: "PLATFORM_TREASURY" },
        data: { balance: { increment: totalFeeRevenue } },
      });

      await tx.transaction.create({
        data: {
          walletId: treasuryWallet.id,
          dealId: params.deal.id,
          type: "CREDIT",
          amount: totalFeeRevenue,
          status: "COMPLETED",
          description: `Platform and gateway fee income credited to treasury for deal: ${params.deal.id}`,
          metadata: {
            source: params.source,
            platformFee,
            gatewayFee,
            totalFeeRevenue,
            feeRatio: ratio,
            brandUserId: params.brandUserId,
          },
        },
      });
    }
  }
}
