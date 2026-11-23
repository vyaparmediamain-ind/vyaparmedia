import prisma from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireActiveAdmin, type AdminSessionUser } from "@/lib/admin-auth";
import { createAuditLog } from "@/lib/audit";
import {
  aggregateAdminCampaignAudit,
  type RawAdminDeal,
  type RawAdminDispute,
  type RawAdminContactLeakMessage,
  type AdminCampaignAuditOverview,
} from "@/lib/admin-campaign-audit";

export interface AdminCampaignDetailResponse {
  campaign: {
    id: string;
    title: string;
    description: string;
    status: string;
    totalBudget: number;
    perInfluencerBudget: number | null;
    fundedAmount: number;
    requiresProduct: boolean;
    productName: string | null;
    postingDeadline: Date;
    createdAt: Date;
    brand: {
      id: string;
      companyName: string;
      website: string | null;
      user: {
        id: string;
        email: string;
      } | null;
    } | null;
    dealsCount: number;
  };
  audit: AdminCampaignAuditOverview;
}

export class AdminCampaignService {
  /**
   * Fetch campaign operational details & run security and financial audits.
   *
   * Enforces:
   * 1. requireActiveAdmin authentication.
   * 2. Audit log creation with actionType: "ADMIN_CAMPAIGN_FINANCE_VIEW", entityType: "CAMPAIGN".
   * 3. Zero raw message content selected in queries (strictly counts & deal links).
   */
  static async getAdminCampaignDetails(
    campaignId: string,
    adminUser: AdminSessionUser | null | undefined,
    ipAddress?: string
  ): Promise<AdminCampaignDetailResponse> {
    const adminIdentity = await requireActiveAdmin(adminUser);

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        brand: {
          select: {
            id: true,
            companyName: true,
            website: true,
            user: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!campaign) {
      throw AppError.notFound("Campaign not found");
    }

    // Parallel fetch: Deals, Disputes on campaign deals, Contact leak messages
    const [deals, disputes, messages] = await Promise.all([
      prisma.deal.findMany({
        where: { campaignId, deletedAt: null },
        select: {
          id: true,
          campaignId: true,
          influencerId: true,
          status: true,
          amount: true,
          platformFee: true,
          gatewayFee: true,
          postingDeadline: true,
          signDeadline: true,
          completedAt: true,
          createdAt: true,
          influencer: {
            select: {
              id: true,
              displayName: true,
              instagramHandle: true,
              followerAuthenticityScore: true,
              instagramFollowers: true,
              instagramEngagementRate: true,
              metricSnapshots: {
                take: 1,
                orderBy: { capturedAt: "desc" },
                select: {
                  followers: true,
                  engagementRateBps: true,
                  flagsJson: true,
                },
              },
            },
          },
          engagementSnapshots: {
            take: 1,
            orderBy: { createdAt: "desc" },
            select: {
              views: true,
              isEstimated: true,
            },
          },
        },
      }),
      prisma.dispute.findMany({
        where: {
          deal: { campaignId },
          deletedAt: null,
        },
        select: {
          id: true,
          dealId: true,
          type: true,
          status: true,
          description: true,
          tier: true,
          createdAt: true,
          resolvedAt: true,
        },
      }),
      // STRICT PRIVACY: Zero raw message content query
      prisma.message.findMany({
        where: {
          deal: { campaignId },
          OR: [{ isBlocked: true }, { hasWarning: true }],
        },
        select: {
          id: true,
          dealId: true,
          senderId: true,
          isBlocked: true,
          hasWarning: true,
          metadata: true,
          createdAt: true,
          sender: {
            select: {
              id: true,
              email: true,
              userType: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Map deals to RawAdminDeal
    const rawDeals: RawAdminDeal[] = deals.map((d) => {
      const latestSnapshot = d.engagementSnapshots[0];
      const influencer = d.influencer;
      const latestMetric = influencer?.metricSnapshots?.[0];

      return {
        id: d.id,
        campaignId: d.campaignId,
        influencerId: d.influencerId,
        influencerName: influencer?.displayName ?? null,
        influencerHandle: influencer?.instagramHandle ?? null,
        followerAuthenticityScore: influencer?.followerAuthenticityScore ?? null,
        followers: influencer?.instagramFollowers ?? latestMetric?.followers ?? null,
        engagementRate:
          influencer?.instagramEngagementRate ??
          (latestMetric?.engagementRateBps ? latestMetric.engagementRateBps / 100 : null),
        status: d.status,
        amount: d.amount,
        platformFee: d.platformFee,
        gatewayFee: d.gatewayFee,
        postingDeadline: d.postingDeadline,
        signDeadline: d.signDeadline,
        completedAt: d.completedAt,
        createdAt: d.createdAt,
        views: latestSnapshot?.views,
        isEstimated: latestSnapshot?.isEstimated,
      };
    });

    const rawDisputes: RawAdminDispute[] = disputes.map((disp) => ({
      id: disp.id,
      dealId: disp.dealId,
      type: disp.type,
      status: disp.status,
      description: disp.description,
      tier: disp.tier,
      createdAt: disp.createdAt,
      resolvedAt: disp.resolvedAt,
    }));

    const rawMessages: RawAdminContactLeakMessage[] = messages.map((m) => ({
      id: m.id,
      dealId: m.dealId,
      senderId: m.senderId,
      senderEmail: m.sender?.email ?? null,
      senderUserType: m.sender?.userType ?? null,
      isBlocked: m.isBlocked,
      hasWarning: m.hasWarning,
      metadata: m.metadata,
      createdAt: m.createdAt,
    }));

    const audit = aggregateAdminCampaignAudit({
      campaignId,
      deals: rawDeals,
      disputes: rawDisputes,
      messages: rawMessages,
    });

    // Write audit log entry on view access
    await createAuditLog({
      actorId: adminIdentity.id,
      actionType: "ADMIN_CAMPAIGN_FINANCE_VIEW",
      entityType: "CAMPAIGN",
      entityId: campaignId,
      afterJSON: {
        netPlatformRevenuePaise: audit.revenue.netPlatformRevenuePaise,
        grossPlatformFeePaise: audit.revenue.grossPlatformFeePaise,
        gatewayCostPaise: audit.revenue.gatewayCostPaise,
        completedDealsCount: audit.revenue.completedDealsCount,
        dealsAtRiskCount: audit.deadlineRisks.length,
        disputesCount: audit.disputes.total,
        contactLeaksCount: audit.contactLeaks.totalCount,
        fraudFlagsCount: audit.fraudFlags.length,
        creatorMetricAnomaliesCount: audit.creatorMetricAnomalies.length,
        apiViewsShareBps: audit.dataQualityShare.apiViewsShareBps,
      },
      ...(ipAddress ? { ipAddress } : {}),
    });

    return {
      campaign: {
        id: campaign.id,
        title: campaign.title,
        description: campaign.description,
        status: campaign.status,
        totalBudget: campaign.totalBudget,
        perInfluencerBudget: campaign.perInfluencerBudget,
        fundedAmount: campaign.fundedAmount,
        requiresProduct: campaign.requiresProduct,
        productName: campaign.productName,
        postingDeadline: campaign.postingDeadline,
        createdAt: campaign.createdAt,
        brand: campaign.brand
          ? {
              id: campaign.brand.id,
              companyName: campaign.brand.companyName,
              website: campaign.brand.website,
              user: campaign.brand.user,
            }
          : null,
        dealsCount: deals.length,
      },
      audit,
    };
  }

  /**
   * List all campaigns for administrative monitoring and governance
   */
  static async listAdminCampaigns(
    adminUser: AdminSessionUser | null | undefined,
    options?: { page?: number | undefined; limit?: number | undefined; status?: string | undefined; search?: string | undefined }
  ) {
    await requireActiveAdmin(adminUser);

    const page = Math.max(1, options?.page ?? 1);
    const limit = Math.min(50, Math.max(1, options?.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (options?.status) {
      where.status = options.status;
    }
    if (options?.search) {
      where.OR = [
        { title: { contains: options.search, mode: "insensitive" } },
        { brand: { companyName: { contains: options.search, mode: "insensitive" } } },
      ];
    }

    const [total, campaigns] = await Promise.all([
      prisma.campaign.count({ where }),
      prisma.campaign.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          totalBudget: true,
          fundedAmount: true,
          postingDeadline: true,
          createdAt: true,
          brand: {
            select: {
              id: true,
              companyName: true,
              user: {
                select: {
                  email: true,
                },
              },
            },
          },
          _count: {
            select: {
              deals: true,
              applications: true,
            },
          },
        },
      }),
    ]);

    return {
      campaigns,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
