/**
 * Campaign Finance Service
 *
 * Provides secured database access for campaign budget allocation, deal-by-deal
 * escrow accounting, reconciliation assertions, and statutory tax reporting.
 *
 * SECURITY:
 * - Object-level authorization: Caller must be the campaign's brand owner or an active admin.
 * - Non-owners / unauthorized callers receive 404 (not 403) to prevent campaign enumeration / IDOR attacks.
 */

import prisma from "@/lib/db";
import { AppError } from "@/lib/errors";
import { Actor, normalizeActor } from "@/lib/authz";
import {
  aggregateCampaignFinance,
  extractAvailableFYs,
  generateCampaignFinanceCsv,
  type CampaignFinanceReportData,
  type RawFinanceDeal,
} from "@/lib/campaign-finance";
import {
  GST_STANDARD_RATE_PERCENT_STRING,
  GST_DEAL_EXEMPT_THRESHOLD_RUPEES,
  TDS_194O_RATE_PERCENT_STRING,
} from "@/constants/tax";

export class CampaignFinanceService {
  /**
   * Retrieves full financial accounting, deal ledger, and tax status for a campaign.
   */
  public static async getCampaignFinance(
    campaignId: string,
    caller: Actor | string,
    legacyIsAdminOrFy?: boolean | string | null,
    optionalFy?: string | null
  ): Promise<CampaignFinanceReportData> {
    let fy: string | null = null;
    let legacyIsAdmin = false;
    if (typeof legacyIsAdminOrFy === "boolean") {
      legacyIsAdmin = legacyIsAdminOrFy;
      fy = optionalFy || null;
    } else if (typeof legacyIsAdminOrFy === "string") {
      fy = legacyIsAdminOrFy;
    } else if (typeof optionalFy === "string") {
      fy = optionalFy;
    }

    const actor = normalizeActor(caller, legacyIsAdmin);

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        title: true,
        status: true,
        totalBudget: true,
        targetCategories: true,
        brandId: true,
        brand: {
          select: {
            id: true,
            userId: true,
            companyName: true,
          },
        },
      },
    });

    if (!campaign) {
      throw AppError.notFound("Campaign not found");
    }

    const isOwner = campaign.brand?.userId === actor.id;
    if (!isOwner && !actor.isActiveAdmin) {
      // 404 to avoid revealing campaign existence to attackers
      throw AppError.notFound("Campaign not found");
    }

    // Parallel fetch deals and brand tax compliance
    const [deals, taxCompliance] = await Promise.all([
      prisma.deal.findMany({
        where: { campaignId },
        select: {
          id: true,
          campaignId: true,
          influencerId: true,
          status: true,
          amount: true,
          platformFee: true,
          gatewayFee: true,
          influencerPayout: true,
          tdsDeducted: true,
          grossPayout: true,
          netPayout: true,
          createdAt: true,
          completedAt: true,
          influencer: {
            select: {
              displayName: true,
              instagramHandle: true,
            },
          },
        },
        orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
      }),
      campaign.brand?.userId
        ? prisma.indiaTaxCompliance.findUnique({
            where: { userId: campaign.brand.userId },
            select: {
              panLast4: true,
              gstinLast4: true,
              status: true,
              gstRegistrationType: true,
            },
          })
        : null,
    ]);

    const rawDeals: RawFinanceDeal[] = deals.map((d) => ({
      id: d.id,
      campaignId: d.campaignId,
      influencerId: d.influencerId,
      influencerName: d.influencer.displayName,
      influencerHandle: d.influencer.instagramHandle,
      status: d.status,
      amount: d.amount,
      platformFee: d.platformFee,
      gatewayFee: d.gatewayFee,
      influencerPayout: d.influencerPayout,
      tdsDeducted: d.tdsDeducted,
      grossPayout: d.grossPayout,
      netPayout: d.netPayout,
      createdAt: d.createdAt,
      completedAt: d.completedAt,
    }));

    const availableFys = extractAvailableFYs(rawDeals);
    const { summary, calculatedDeals } = aggregateCampaignFinance({
      budgetTotalPaise: campaign.totalBudget,
      deals: rawDeals,
      selectedFy: fy ?? null,
    });

    const taxAdvisories: string[] = [];
    if (!taxCompliance?.panLast4) {
      taxAdvisories.push("Brand PAN verification is pending. Verify PAN in settings for GST invoice compliance.");
    }
    if (!taxCompliance?.gstinLast4) {
      taxAdvisories.push("No GSTIN registered. Platform service fees will carry uncredited 18% CGST/SGST.");
    }

    return {
      campaign: {
        id: campaign.id,
        title: campaign.title,
        status: campaign.status,
        brandName: campaign.brand?.companyName || "Brand Partner",
        targetCategories: campaign.targetCategories,
      },
      selectedFy: fy || null,
      availableFys,
      summary,
      taxSummary: {
        gstRatePercentString: GST_STANDARD_RATE_PERCENT_STRING,
        gstExemptThresholdRupees: GST_DEAL_EXEMPT_THRESHOLD_RUPEES,
        tdsRatePercentString: TDS_194O_RATE_PERCENT_STRING,
        tdsStatutorySection: "Section 393(1) / Section 194-O",
        brandGstin: taxCompliance?.gstinLast4 ? `****${taxCompliance.gstinLast4}` : null,
        brandPan: taxCompliance?.panLast4 ? `****${taxCompliance.panLast4}` : null,
        taxReadinessStatus: taxCompliance?.status === "READY" ? "READY" : "ACTION_REQUIRED",
        advisories: taxAdvisories,
      },
      deals: calculatedDeals,
    };
  }

  /**
   * Generates formula-safe CSV string of campaign financial ledger.
   */
  public static async exportCampaignFinanceCsv(
    campaignId: string,
    caller: Actor | string,
    legacyIsAdminOrFy?: boolean | string | null,
    optionalFy?: string | null
  ): Promise<string> {
    const reportData = await this.getCampaignFinance(campaignId, caller, legacyIsAdminOrFy, optionalFy);
    return generateCampaignFinanceCsv(reportData);
  }
}
