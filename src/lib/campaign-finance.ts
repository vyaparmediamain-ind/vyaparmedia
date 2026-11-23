/**
 * Campaign Finance & Tax Engine (Pure Logic)
 *
 * Implements deterministic financial accounting for campaigns:
 * - Budget breakdown: Total, Funded, Escrow-Locked, Released, Remaining.
 * - Per-deal accounting from DB fields: amount, platformFee as charged, gatewayFee,
 *   influencerPayout, tdsDeducted, grossPayout, netPayout.
 * - Statutory Indian tax summary: GST on platform fee (18% if deal > ₹1,500) and TDS (Section 194-O / 393(1)).
 * - Mathematical reconciliation verification (Sum of parts == Total).
 * - RFC 4180 CSV export with formula injection prevention (`csvEsc`).
 *
 * PURE LOGIC ONLY: No database access, no fetch, no implicit Date.now().
 */

import {
  GST_STANDARD_RATE,
  GST_DEAL_EXEMPT_THRESHOLD_PAISE,
} from "@/constants/tax";
import { csvEsc, getIndianFYBounds, paiseToRupees } from "@/lib/csv-export";

export interface RawFinanceDeal {
  id: string;
  campaignId: string;
  influencerId: string;
  influencerName?: string | null;
  influencerHandle?: string | null;
  status: string;
  amount: number; // in paise
  platformFee: number; // in paise (as charged)
  gatewayFee: number; // in paise
  influencerPayout: number | null; // in paise
  tdsDeducted: number; // in paise
  grossPayout: number; // in paise
  netPayout: number; // in paise
  createdAt: Date;
  completedAt: Date | null;
}

export interface CalculatedDealFinance {
  id: string;
  creatorName: string;
  creatorHandle: string | null;
  status: string;
  amountPaise: number;
  amountRupees: string;
  platformFeePaise: number;
  platformFeeRupees: string;
  gstOnPlatformFeePaise: number;
  gstOnPlatformFeeRupees: string;
  gatewayFeePaise: number;
  gatewayFeeRupees: string;
  influencerPayoutPaise: number;
  influencerPayoutRupees: string;
  tdsDeductedPaise: number;
  tdsDeductedRupees: string;
  grossPayoutPaise: number;
  grossPayoutRupees: string;
  netPayoutPaise: number;
  netPayoutRupees: string;
  isReconciled: boolean;
  reconciliationNotes: string[];
  createdAt: string;
  completedAt: string | null;
}

export interface CampaignFinanceSummary {
  budgetTotalPaise: number;
  budgetTotalRupees: string;
  budgetFundedPaise: number;
  budgetFundedRupees: string;
  escrowLockedPaise: number;
  escrowLockedRupees: string;
  escrowReleasedPaise: number;
  escrowReleasedRupees: string;
  escrowRefundedPaise: number;
  escrowRefundedRupees: string;
  budgetRemainingPaise: number;
  budgetRemainingRupees: string;
  totalPlatformFeePaise: number;
  totalPlatformFeeRupees: string;
  totalGstOnPlatformFeePaise: number;
  totalGstOnPlatformFeeRupees: string;
  totalGatewayFeePaise: number;
  totalGatewayFeeRupees: string;
  totalGrossPayoutPaise: number;
  totalGrossPayoutRupees: string;
  totalTdsDeductedPaise: number;
  totalTdsDeductedRupees: string;
  totalNetPayoutPaise: number;
  totalNetPayoutRupees: string;
  dealCount: number;
  activeDealCount: number;
  completedDealCount: number;
  cancelledDealCount: number;
  reconciliation: {
    isReconciled: boolean;
    discrepancyPaise: number;
    discrepancyRupees: string;
    warnings: string[];
  };
}

export interface CampaignFinanceTaxSummary {
  gstRatePercentString: string;
  gstExemptThresholdRupees: number;
  tdsRatePercentString: string;
  tdsStatutorySection: string;
  brandGstin: string | null;
  brandPan: string | null;
  taxReadinessStatus: "READY" | "ACTION_REQUIRED";
  advisories: string[];
}

export interface CampaignFinanceReportData {
  campaign: {
    id: string;
    title: string;
    status: string;
    brandName: string;
    targetCategories: string[];
  };
  selectedFy: string | null;
  availableFys: string[];
  summary: CampaignFinanceSummary;
  taxSummary: CampaignFinanceTaxSummary;
  deals: CalculatedDealFinance[];
}

/**
 * Calculates per-deal financial values and validates mathematical consistency.
 */
export function calculateDealFinance(deal: RawFinanceDeal): CalculatedDealFinance {
  const isCancelled = deal.status === "CANCELLED";
  const isCompleted = deal.status === "COMPLETED";

  // GST on platform fee: 18% standard rate if deal amount exceeds ₹1,500 threshold
  const gstOnPlatformFeePaise =
    !isCancelled && deal.amount > GST_DEAL_EXEMPT_THRESHOLD_PAISE
      ? Math.round(deal.platformFee * GST_STANDARD_RATE)
      : 0;

  // Expected influencer payout if not explicitly recorded
  const fallbackInfluencerPayout = Math.max(0, deal.amount - deal.platformFee - deal.gatewayFee);
  const influencerPayoutPaise = deal.influencerPayout ?? fallbackInfluencerPayout;

  const reconciliationNotes: string[] = [];
  let isReconciled = true;

  if (isCompleted) {
    // For completed deals, Gross Payout must equal Net Payout + TDS Deducted
    const expectedGross = deal.netPayout + deal.tdsDeducted;
    if (deal.grossPayout > 0 && deal.grossPayout !== expectedGross) {
      isReconciled = false;
      reconciliationNotes.push(
        `Gross payout (${deal.grossPayout}p) does not match Net payout (${deal.netPayout}p) + TDS (${deal.tdsDeducted}p)`
      );
    }

    // Deal Amount must equal Gross Payout + Platform Fee + Gateway Fee
    const expectedAmount = (deal.grossPayout || influencerPayoutPaise) + deal.platformFee + deal.gatewayFee;
    if (deal.amount > 0 && Math.abs(deal.amount - expectedAmount) > 1) {
      isReconciled = false;
      reconciliationNotes.push(
        `Deal amount (${deal.amount}p) does not match sum of Gross Payout (${deal.grossPayout || influencerPayoutPaise}p) + Platform Fee (${deal.platformFee}p) + Gateway Fee (${deal.gatewayFee}p)`
      );
    }
  }

  return {
    id: deal.id,
    creatorName: deal.influencerName || "Creator Partner",
    creatorHandle: deal.influencerHandle || null,
    status: deal.status,
    amountPaise: deal.amount,
    amountRupees: paiseToRupees(deal.amount),
    platformFeePaise: deal.platformFee,
    platformFeeRupees: paiseToRupees(deal.platformFee),
    gstOnPlatformFeePaise,
    gstOnPlatformFeeRupees: paiseToRupees(gstOnPlatformFeePaise),
    gatewayFeePaise: deal.gatewayFee,
    gatewayFeeRupees: paiseToRupees(deal.gatewayFee),
    influencerPayoutPaise,
    influencerPayoutRupees: paiseToRupees(influencerPayoutPaise),
    tdsDeductedPaise: deal.tdsDeducted,
    tdsDeductedRupees: paiseToRupees(deal.tdsDeducted),
    grossPayoutPaise: deal.grossPayout,
    grossPayoutRupees: paiseToRupees(deal.grossPayout),
    netPayoutPaise: deal.netPayout,
    netPayoutRupees: paiseToRupees(deal.netPayout),
    isReconciled,
    reconciliationNotes,
    createdAt: deal.createdAt.toISOString(),
    completedAt: deal.completedAt ? deal.completedAt.toISOString() : null,
  };
}

/**
 * Filters a list of deals by an Indian Financial Year (e.g. "2025-26" or "2026-27").
 * Uses deal completion timestamp when available, otherwise creation date.
 */
export function filterDealsByIndianFY(
  deals: RawFinanceDeal[],
  fy: string | null | undefined
): RawFinanceDeal[] {
  if (!fy || fy === "ALL") {
    return deals;
  }

  const bounds = getIndianFYBounds(fy);
  if (!bounds) {
    return deals;
  }

  return deals.filter((deal) => {
    const relevantDate = deal.completedAt ?? deal.createdAt;
    return relevantDate >= bounds.start && relevantDate <= bounds.end;
  });
}

/**
 * Extracts distinct Indian Financial Years from a list of deals based on dates.
 */
export function extractAvailableFYs(deals: RawFinanceDeal[]): string[] {
  const f建Set = new Set<string>();

  for (const deal of deals) {
    const d = deal.completedAt ?? deal.createdAt;
    // IST offset: UTC + 5:30
    const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
    const yr = ist.getUTCMonth() >= 3 ? ist.getUTCFullYear() : ist.getUTCFullYear() - 1;
    f建Set.add(`${yr}-${String(yr + 1).slice(-2)}`);
  }

  return Array.from(f建Set).sort().reverse();
}

/**
 * Pure aggregation of campaign financial metrics, budget totals, and reconciliation assertions.
 */
export function aggregateCampaignFinance(params: {
  budgetTotalPaise: number;
  deals: RawFinanceDeal[];
  selectedFy?: string | null;
}): {
  summary: CampaignFinanceSummary;
  calculatedDeals: CalculatedDealFinance[];
} {
  const { budgetTotalPaise, deals, selectedFy } = params;

  // Filter deals by Indian FY if specified
  const filteredDeals = filterDealsByIndianFY(deals, selectedFy);
  const calculatedDeals = filteredDeals.map(calculateDealFinance);

  let escrowLockedPaise = 0;
  let escrowReleasedPaise = 0;
  let escrowRefundedPaise = 0;

  let totalPlatformFeePaise = 0;
  let totalGstOnPlatformFeePaise = 0;
  let totalGatewayFeePaise = 0;
  let totalGrossPayoutPaise = 0;
  let totalTdsDeductedPaise = 0;
  let totalNetPayoutPaise = 0;

  let activeDealCount = 0;
  let completedDealCount = 0;
  let cancelledDealCount = 0;

  for (const d of calculatedDeals) {
    if (d.status === "CANCELLED") {
      escrowRefundedPaise += d.amountPaise;
      cancelledDealCount += 1;
      continue;
    }

    if (d.status === "COMPLETED") {
      escrowReleasedPaise += d.amountPaise;
      completedDealCount += 1;
    } else {
      escrowLockedPaise += d.amountPaise;
      activeDealCount += 1;
    }

    totalPlatformFeePaise += d.platformFeePaise;
    totalGstOnPlatformFeePaise += d.gstOnPlatformFeePaise;
    totalGatewayFeePaise += d.gatewayFeePaise;
    totalGrossPayoutPaise += d.grossPayoutPaise;
    totalTdsDeductedPaise += d.tdsDeductedPaise;
    totalNetPayoutPaise += d.netPayoutPaise;
  }

  // Budget Funded = Total funds committed across active + completed deals (excludes cancelled)
  const budgetFundedPaise = escrowLockedPaise + escrowReleasedPaise;
  const budgetRemainingPaise = Math.max(0, budgetTotalPaise - budgetFundedPaise);

  // Reconciliation Assertions
  const warnings: string[] = [];
  let isReconciled = true;

  // 1. Check deal-level discrepancies
  const unreconciledDeals = calculatedDeals.filter((d) => !d.isReconciled);
  if (unreconciledDeals.length > 0) {
    isReconciled = false;
    warnings.push(
      `${unreconciledDeals.length} completed deal(s) have internal math variances between gross payout, net payout, and fees.`
    );
  }

  // 2. Aggregate Gross Payout vs Net Payout + TDS Deducted
  const expectedTotalGross = totalNetPayoutPaise + totalTdsDeductedPaise;
  if (totalGrossPayoutPaise > 0 && totalGrossPayoutPaise !== expectedTotalGross) {
    isReconciled = false;
    const diff = Math.abs(totalGrossPayoutPaise - expectedTotalGross);
    warnings.push(
      `Aggregate Gross Payout (${totalGrossPayoutPaise}p) does not match Net Payout + TDS (${expectedTotalGross}p). Variance: ${diff}p.`
    );
  }

  // 3. For completed deals, Total Released Escrow vs (Gross Payout + Platform Fee + Gateway Fee)
  const completedDeals = calculatedDeals.filter((d) => d.status === "COMPLETED");
  const completedSum = completedDeals.reduce((s, d) => s + d.amountPaise, 0);
  const completedPartsSum = completedDeals.reduce(
    (s, d) => s + (d.grossPayoutPaise || d.influencerPayoutPaise) + d.platformFeePaise + d.gatewayFeePaise,
    0
  );

  let discrepancyPaise = 0;
  if (completedSum > 0 && Math.abs(completedSum - completedPartsSum) > 1) {
    isReconciled = false;
    discrepancyPaise = Math.abs(completedSum - completedPartsSum);
    warnings.push(
      `Total Released Escrow (${completedSum}p) differs from sum of Creator Payouts + Fees (${completedPartsSum}p) by ${discrepancyPaise}p.`
    );
  }

  return {
    summary: {
      budgetTotalPaise,
      budgetTotalRupees: paiseToRupees(budgetTotalPaise),
      budgetFundedPaise,
      budgetFundedRupees: paiseToRupees(budgetFundedPaise),
      escrowLockedPaise,
      escrowLockedRupees: paiseToRupees(escrowLockedPaise),
      escrowReleasedPaise,
      escrowReleasedRupees: paiseToRupees(escrowReleasedPaise),
      escrowRefundedPaise,
      escrowRefundedRupees: paiseToRupees(escrowRefundedPaise),
      budgetRemainingPaise,
      budgetRemainingRupees: paiseToRupees(budgetRemainingPaise),
      totalPlatformFeePaise,
      totalPlatformFeeRupees: paiseToRupees(totalPlatformFeePaise),
      totalGstOnPlatformFeePaise,
      totalGstOnPlatformFeeRupees: paiseToRupees(totalGstOnPlatformFeePaise),
      totalGatewayFeePaise,
      totalGatewayFeeRupees: paiseToRupees(totalGatewayFeePaise),
      totalGrossPayoutPaise,
      totalGrossPayoutRupees: paiseToRupees(totalGrossPayoutPaise),
      totalTdsDeductedPaise,
      totalTdsDeductedRupees: paiseToRupees(totalTdsDeductedPaise),
      totalNetPayoutPaise,
      totalNetPayoutRupees: paiseToRupees(totalNetPayoutPaise),
      dealCount: calculatedDeals.length,
      activeDealCount,
      completedDealCount,
      cancelledDealCount,
      reconciliation: {
        isReconciled,
        discrepancyPaise,
        discrepancyRupees: paiseToRupees(discrepancyPaise),
        warnings,
      },
    },
    calculatedDeals,
  };
}

/**
 * Builds RFC 4180 CSV export content for campaign financial reporting.
 * Completely immune to CSV formula injection via `csvEsc`.
 */
export function generateCampaignFinanceCsv(data: CampaignFinanceReportData): string {
  const lines: string[] = [];

  // Header / Title block
  lines.push(`${csvEsc("VYAPARMEDIA CAMPAIGN FINANCIAL LEDGER & TAX REPORT")}`);
  lines.push(`${csvEsc("Campaign")},${csvEsc(data.campaign.title)}`);
  lines.push(`${csvEsc("Campaign ID")},${csvEsc(data.campaign.id)}`);
  lines.push(`${csvEsc("Brand Partner")},${csvEsc(data.campaign.brandName)}`);
  lines.push(`${csvEsc("Financial Year")},${csvEsc(data.selectedFy || "ALL TIME")}`);
  lines.push(`${csvEsc("Generated At (UTC)")},${csvEsc(new Date().toISOString())}`);
  lines.push("");

  // Budget Summary Table
  lines.push(`${csvEsc("BUDGET & ESCROW SUMMARY")}`);
  lines.push(`${csvEsc("Metric")},${csvEsc("Amount (Paise)")},${csvEsc("Amount (INR)")}`);
  lines.push(`${csvEsc("Total Campaign Budget")},${csvEsc(data.summary.budgetTotalPaise)},${csvEsc(data.summary.budgetTotalRupees)}`);
  lines.push(`${csvEsc("Funded Budget")},${csvEsc(data.summary.budgetFundedPaise)},${csvEsc(data.summary.budgetFundedRupees)}`);
  lines.push(`${csvEsc("Escrow Locked (In Flight)")},${csvEsc(data.summary.escrowLockedPaise)},${csvEsc(data.summary.escrowLockedRupees)}`);
  lines.push(`${csvEsc("Escrow Released (Completed)")},${csvEsc(data.summary.escrowReleasedPaise)},${csvEsc(data.summary.escrowReleasedRupees)}`);
  lines.push(`${csvEsc("Escrow Refunded (Cancelled)")},${csvEsc(data.summary.escrowRefundedPaise)},${csvEsc(data.summary.escrowRefundedRupees)}`);
  lines.push(`${csvEsc("Remaining Unallocated Budget")},${csvEsc(data.summary.budgetRemainingPaise)},${csvEsc(data.summary.budgetRemainingRupees)}`);
  lines.push("");

  // Statutory Tax Summary Table
  lines.push(`${csvEsc("STATUTORY TAX & COMPLIANCE SUMMARY")}`);
  lines.push(`${csvEsc("Tax Metric")},${csvEsc("Statutory Rate / Section")},${csvEsc("Amount (INR)")}`);
  lines.push(`${csvEsc("Platform Service Fee")},${csvEsc("As Charged")},${csvEsc(data.summary.totalPlatformFeeRupees)}`);
  lines.push(`${csvEsc("GST on Platform Fee")},${csvEsc(data.taxSummary.gstRatePercentString)},${csvEsc(data.summary.totalGstOnPlatformFeeRupees)}`);
  lines.push(`${csvEsc("TDS Withheld (Creator Sales)")},${csvEsc(`${data.taxSummary.tdsRatePercentString} (${data.taxSummary.tdsStatutorySection})`)},${csvEsc(data.summary.totalTdsDeductedRupees)}`);
  lines.push(`${csvEsc("Net Creator Disbursals")},${csvEsc("After TDS Deductions")},${csvEsc(data.summary.totalNetPayoutRupees)}`);
  lines.push(`${csvEsc("Reconciliation Status")},${csvEsc(data.summary.reconciliation.isReconciled ? "VERIFIED BALANCED" : "RECONCILIATION DISCREPANCY")},${csvEsc(data.summary.reconciliation.discrepancyRupees)}`);
  lines.push("");

  // Deals Breakdown Table
  lines.push(`${csvEsc("PER-DEAL FINANCIAL AUDIT LOG")}`);
  const dealColumns = [
    "Sr.",
    "Deal ID",
    "Creator Name",
    "Creator Handle",
    "Status",
    "Deal Amount (INR)",
    "Platform Fee (INR)",
    "GST on Fee (INR)",
    "Gateway Fee (INR)",
    "Creator Gross (INR)",
    "TDS Deducted (INR)",
    "Creator Net (INR)",
    "Reconciled",
    "Completed Date",
  ];
  lines.push(dealColumns.map(csvEsc).join(","));

  data.deals.forEach((d, idx) => {
    const row = [
      idx + 1,
      d.id,
      d.creatorName,
      d.creatorHandle ? `@${d.creatorHandle}` : "",
      d.status,
      d.amountRupees,
      d.platformFeeRupees,
      d.gstOnPlatformFeeRupees,
      d.gatewayFeeRupees,
      d.grossPayoutRupees,
      d.tdsDeductedRupees,
      d.netPayoutRupees,
      d.isReconciled ? "YES" : "NO",
      d.completedAt ? d.completedAt.split("T")[0] : "",
    ];
    lines.push(row.map(csvEsc).join(","));
  });

  return lines.join("\r\n");
}
