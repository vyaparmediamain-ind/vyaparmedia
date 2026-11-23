import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  calculatePlatformRevenue,
  detectDeadlineRisks,
  summarizeDisputes,
  sanitizeContactLeakFlags,
  aggregateFraudFlags,
  detectCreatorMetricAnomalies,
  calculateEstimatedVsApiShare,
  type RawAdminDeal,
  type RawAdminDispute,
  type RawAdminContactLeakMessage,
} from "@/lib/admin-campaign-audit";
import { AdminCampaignService } from "@/services/admin-campaign.service";
import prisma from "@/lib/db";
import * as auditModule from "@/lib/audit";
import * as adminAuthModule from "@/lib/admin-auth";
import { AppError } from "@/lib/errors";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe("Admin Campaign Operations & Financial Audit Engine", () => {
  const fixedNow = new Date("2026-11-23T12:00:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. PLATFORM REVENUE FIXTURES
  // =========================================================================
  describe("1. Platform Revenue Calculation", () => {
    it("sums Deal.platformFee on completed deals minus gatewayFee", () => {
      const deals: RawAdminDeal[] = [
        {
          id: "deal_1",
          campaignId: "camp_1",
          influencerId: "inf_1",
          status: "COMPLETED",
          amount: 1000000, // ₹10,000
          platformFee: 100000, // ₹1,000 gross platform fee
          gatewayFee: 20000, // ₹200 processor fee
          postingDeadline: new Date("2026-11-20T12:00:00Z"),
          createdAt: new Date("2026-11-10T12:00:00Z"),
        },
        {
          id: "deal_2",
          campaignId: "camp_1",
          influencerId: "inf_2",
          status: "COMPLETED",
          amount: 500000, // ₹5,000
          platformFee: 50000, // ₹500 gross platform fee
          gatewayFee: 10000, // ₹100 processor fee
          postingDeadline: new Date("2026-11-21T12:00:00Z"),
          createdAt: new Date("2026-11-11T12:00:00Z"),
        },
        {
          id: "deal_active",
          campaignId: "camp_1",
          influencerId: "inf_3",
          status: "ACTIVE",
          amount: 2000000, // ₹20,000 (not completed, must not be recognized)
          platformFee: 200000,
          gatewayFee: 40000,
          postingDeadline: new Date("2026-11-25T12:00:00Z"),
          createdAt: new Date("2026-11-12T12:00:00Z"),
        },
      ];

      const revenue = calculatePlatformRevenue(deals);

      // Gross: 100000 + 50000 = 150000 paise (₹1,500)
      expect(revenue.grossPlatformFeePaise).toBe(150000);
      expect(revenue.grossPlatformFeeRupees).toBe("1500.00");

      // Gateway: 20000 + 10000 = 30000 paise (₹300)
      expect(revenue.gatewayCostPaise).toBe(30000);
      expect(revenue.gatewayCostRupees).toBe("300.00");

      // Net: 150000 - 30000 = 120000 paise (₹1,200)
      expect(revenue.netPlatformRevenuePaise).toBe(120000);
      expect(revenue.netPlatformRevenueRupees).toBe("1200.00");
      expect(revenue.completedDealsCount).toBe(2);
    });

    it("clamps negative net revenue to 0 if gateway fees exceed platform fees", () => {
      const deals: RawAdminDeal[] = [
        {
          id: "deal_loss",
          campaignId: "camp_1",
          influencerId: "inf_1",
          status: "COMPLETED",
          amount: 100000,
          platformFee: 5000,
          gatewayFee: 15000,
          postingDeadline: new Date(),
          createdAt: new Date(),
        },
      ];

      const revenue = calculatePlatformRevenue(deals);
      expect(revenue.grossPlatformFeePaise).toBe(5000);
      expect(revenue.gatewayCostPaise).toBe(15000);
      expect(revenue.netPlatformRevenuePaise).toBe(0);
    });
  });

  // =========================================================================
  // 2. DEADLINE RISKS (OVERDUE & IMMINENT <48H)
  // =========================================================================
  describe("2. Deadline Risk Detection", () => {
    it("flags deals overdue, sign overdue, and imminent (<48h)", () => {
      const deals: RawAdminDeal[] = [
        {
          id: "deal_overdue",
          campaignId: "camp_1",
          influencerId: "inf_1",
          influencerName: "Aarav Patel",
          status: "ACTIVE",
          amount: 500000,
          platformFee: 50000,
          gatewayFee: 10000,
          // 4 hours past deadline
          postingDeadline: new Date("2026-11-23T08:00:00.000Z"),
          createdAt: new Date("2026-11-15T00:00:00.000Z"),
        },
        {
          id: "deal_imminent",
          campaignId: "camp_1",
          influencerId: "inf_2",
          influencerName: "Sneha Rao",
          status: "ACTIVE",
          amount: 500000,
          platformFee: 50000,
          gatewayFee: 10000,
          // 24 hours remaining (within 48h)
          postingDeadline: new Date("2026-11-24T12:00:00.000Z"),
          createdAt: new Date("2026-11-15T00:00:00.000Z"),
        },
        {
          id: "deal_sign_overdue",
          campaignId: "camp_1",
          influencerId: "inf_3",
          influencerName: "Kavita Verma",
          status: "PENDING_SIGNATURE",
          amount: 500000,
          platformFee: 50000,
          gatewayFee: 10000,
          postingDeadline: new Date("2026-11-30T12:00:00.000Z"),
          signDeadline: new Date("2026-11-22T12:00:00.000Z"), // 24h past sign deadline
          createdAt: new Date("2026-11-15T00:00:00.000Z"),
        },
        {
          id: "deal_safe",
          campaignId: "camp_1",
          influencerId: "inf_4",
          status: "ACTIVE",
          amount: 500000,
          platformFee: 50000,
          gatewayFee: 10000,
          // 5 days remaining (>48h)
          postingDeadline: new Date("2026-11-28T12:00:00.000Z"),
          createdAt: new Date("2026-11-15T00:00:00.000Z"),
        },
        {
          id: "deal_completed_past_deadline",
          campaignId: "camp_1",
          influencerId: "inf_5",
          status: "COMPLETED",
          amount: 500000,
          platformFee: 50000,
          gatewayFee: 10000,
          postingDeadline: new Date("2026-11-20T12:00:00.000Z"),
          completedAt: new Date("2026-11-20T11:00:00.000Z"),
          createdAt: new Date("2026-11-15T00:00:00.000Z"),
        },
      ];

      const risks = detectDeadlineRisks(deals, fixedNow);

      expect(risks).toHaveLength(3);
      expect(risks.some((r) => r.dealId === "deal_overdue" && r.riskSeverity === "OVERDUE")).toBe(true);
      expect(risks.some((r) => r.dealId === "deal_imminent" && r.riskSeverity === "IMMINENT_48H")).toBe(true);
      expect(risks.some((r) => r.dealId === "deal_sign_overdue" && r.riskSeverity === "SIGN_OVERDUE")).toBe(true);
      expect(risks.some((r) => r.dealId === "deal_safe")).toBe(false);
      expect(risks.some((r) => r.dealId === "deal_completed_past_deadline")).toBe(false);
    });
  });

  // =========================================================================
  // 3. DISPUTE TRACKING
  // =========================================================================
  describe("3. Dispute Summarization", () => {
    it("categorizes open and resolved disputes accurately", () => {
      const disputes: RawAdminDispute[] = [
        {
          id: "disp_1",
          dealId: "deal_1",
          type: "DELIVERABLE_NON_COMPLIANT",
          status: "OPEN",
          description: "Missing product link",
          tier: 1,
          createdAt: new Date("2026-11-18T10:00:00Z"),
        },
        {
          id: "disp_2",
          dealId: "deal_2",
          type: "FRAUD",
          status: "RESOLVED",
          description: "Resolution reached amicably",
          tier: 2,
          createdAt: new Date("2026-11-19T10:00:00Z"),
          resolvedAt: new Date("2026-11-20T10:00:00Z"),
        },
      ];

      const summary = summarizeDisputes(disputes);
      expect(summary.total).toBe(2);
      expect(summary.open).toBe(1);
      expect(summary.resolved).toBe(1);
      expect(summary.items[0]?.id).toBe("disp_1");
    });
  });

  // =========================================================================
  // 4. CONTACT LEAK FLAGS (STRICT: NO RAW MESSAGE DUMPS)
  // =========================================================================
  describe("4. Contact Leak Flags Sanitization", () => {
    it("returns counts and deal links with strictly NO raw message content", () => {
      const messages: RawAdminContactLeakMessage[] = [
        {
          id: "msg_leak_1",
          dealId: "deal_100",
          senderId: "usr_inf_1",
          senderEmail: "creator@gmail.com",
          senderUserType: "INFLUENCER",
          isBlocked: true,
          hasWarning: true,
          metadata: { type: "PHONE_NUMBER_DETECTED" },
          createdAt: new Date("2026-11-21T14:00:00Z"),
        },
        {
          id: "msg_normal",
          dealId: "deal_100",
          senderId: "usr_brand_1",
          isBlocked: false,
          hasWarning: false,
          createdAt: new Date("2026-11-21T15:00:00Z"),
        },
      ];

      const leaks = sanitizeContactLeakFlags(messages);
      expect(leaks.totalCount).toBe(1);
      const leakItem = leaks.items[0];
      expect(leakItem).toBeDefined();
      if (leakItem) {
        expect(leakItem).toEqual({
          messageId: "msg_leak_1",
          dealId: "deal_100",
          senderId: "usr_inf_1",
          senderEmail: "creator@gmail.com",
          senderUserType: "INFLUENCER",
          flagType: "PHONE_NUMBER_DETECTED",
          createdAt: "2026-11-21T14:00:00.000Z",
          dealLink: "/dashboard/deals/deal_100",
        });

        // Verify no 'content' or 'text' property exists on the returned item
        expect("content" in leakItem).toBe(false);
        expect("text" in leakItem).toBe(false);
      }
    });
  });

  // =========================================================================
  // 5. FRAUD & ANOMALY FLAGS (P06)
  // =========================================================================
  describe("5. Fraud & Creator Metric Anomaly Detection", () => {
    it("flags creators with low authenticity score (<50) and fraud disputes", () => {
      const deals: RawAdminDeal[] = [
        {
          id: "deal_auth_risk",
          campaignId: "camp_1",
          influencerId: "inf_synthetic",
          influencerHandle: "suspicious_user",
          followerAuthenticityScore: 35, // High risk (<50)
          status: "ACTIVE",
          amount: 500000,
          platformFee: 50000,
          gatewayFee: 10000,
          postingDeadline: new Date(),
          createdAt: new Date(),
        },
      ];

      const disputes: RawAdminDispute[] = [
        {
          id: "disp_fraud",
          dealId: "deal_auth_risk",
          type: "FRAUD",
          status: "OPEN",
          description: "Suspected synthetic engagement boost",
          tier: 3,
          createdAt: new Date(),
        },
      ];

      const fraudFlags = aggregateFraudFlags({
        campaignId: "camp_1",
        deals,
        disputes,
      });

      expect(fraudFlags).toHaveLength(2);
      expect(fraudFlags[0]?.flag).toBe("LOW_AUTHENTICITY_SCORE");
      expect(fraudFlags[0]?.severity).toBe("HIGH");
      expect(fraudFlags[1]?.flag).toBe("FRAUD_DISPUTE_FILED");
    });

    it("detects creator metric anomalies (P06) such as small sample size ('Data kam hai')", () => {
      const deals: RawAdminDeal[] = [
        {
          id: "deal_small_sample",
          campaignId: "camp_1",
          influencerId: "inf_new",
          influencerName: "New Creator",
          influencerHandle: "new_creator",
          followers: 10000,
          engagementRate: 3.5,
          views: 500, // < 1,000 views on completed deal -> insufficient sample size
          status: "COMPLETED",
          amount: 500000,
          platformFee: 50000,
          gatewayFee: 10000,
          postingDeadline: new Date(),
          createdAt: new Date(),
        },
      ];

      const anomalies = detectCreatorMetricAnomalies(deals);
      expect(anomalies.some((a) => a.rule === "INSUFFICIENT_SAMPLE_SIZE")).toBe(true);
      expect(anomalies.find((a) => a.rule === "INSUFFICIENT_SAMPLE_SIZE")?.severity).toBe("LOW");
    });
  });

  // =========================================================================
  // 6. ESTIMATED VS API DATA SHARE
  // =========================================================================
  describe("6. Estimated vs API Data Share", () => {
    it("computes accurate basis points and percentage share", () => {
      const deals: RawAdminDeal[] = [
        {
          id: "deal_api",
          campaignId: "camp_1",
          influencerId: "inf_1",
          status: "COMPLETED",
          amount: 500000,
          platformFee: 50000,
          gatewayFee: 10000,
          postingDeadline: new Date(),
          createdAt: new Date(),
          views: 75000,
          isEstimated: false, // API verified
        },
        {
          id: "deal_est",
          campaignId: "camp_1",
          influencerId: "inf_2",
          status: "COMPLETED",
          amount: 500000,
          platformFee: 50000,
          gatewayFee: 10000,
          postingDeadline: new Date(),
          createdAt: new Date(),
          views: 25000,
          isEstimated: true, // Estimated heuristic
        },
      ];

      const share = calculateEstimatedVsApiShare(deals);
      expect(share.totalViews).toBe(100000);
      expect(share.verifiedViews).toBe(75000);
      expect(share.estimatedViews).toBe(25000);
      expect(share.apiViewsShareBps).toBe(7500); // 75.00%
      expect(share.apiSharePercent).toBe(75);
      expect(share.estimatedSharePercent).toBe(25);
      expect(share.dataQuality).toBe("ESTIMATED"); // Mixed dataset contains estimates
    });
  });

  // =========================================================================
  // 7. SERVICE INTEGRATION & AUDIT LOGGING (requireActiveAdmin & createAuditLog)
  // =========================================================================
  describe("7. AdminCampaignService Integration", () => {
    const mockAdmin = {
      id: "usr_admin_42",
      email: "chief_compliance@vyaparmedia.in",
      userType: "ADMIN",
    };

    const mockNonAdmin = {
      id: "usr_brand_12",
      email: "brand@company.com",
      userType: "BRAND",
    };

    it("throws 403 Forbidden when a non-admin attempts to view campaign operations", async () => {
      vi.spyOn(adminAuthModule, "requireActiveAdmin").mockRejectedValueOnce(
        AppError.forbidden("Unauthorized: Admin access required")
      );

      await expect(
        AdminCampaignService.getAdminCampaignDetails("camp_any", mockNonAdmin)
      ).rejects.toThrow("Unauthorized: Admin access required");
    });

    it("throws 404 NotFound when campaign does not exist in database", async () => {
      vi.spyOn(adminAuthModule, "requireActiveAdmin").mockResolvedValueOnce({
        id: mockAdmin.id,
        email: mockAdmin.email,
      });

      vi.spyOn(prisma.campaign, "findUnique").mockResolvedValueOnce(null);

      await expect(
        AdminCampaignService.getAdminCampaignDetails("camp_non_existent", mockAdmin)
      ).rejects.toThrow("Campaign not found");
    });

    it("writes ADMIN_CAMPAIGN_FINANCE_VIEW audit entry when admin accesses campaign details", async () => {
      vi.spyOn(adminAuthModule, "requireActiveAdmin").mockResolvedValueOnce({
        id: mockAdmin.id,
        email: mockAdmin.email,
      });

      const auditSpy = vi.spyOn(auditModule, "createAuditLog").mockResolvedValueOnce({
        id: "audit_1",
        actorId: mockAdmin.id,
        actionType: "ADMIN_CAMPAIGN_FINANCE_VIEW",
        entityType: "CAMPAIGN",
        entityId: "camp_100",
        beforeJSON: null,
        afterJSON: null,
        ipAddress: "103.21.244.2",
        createdAt: new Date(),
      } as unknown as import("@prisma/client").AuditLog);

      vi.spyOn(prisma.campaign, "findUnique").mockResolvedValueOnce({
        id: "camp_100",
        title: "Monsoon Brand Launch",
        description: "Pan-India influencer blitz",
        status: "ACTIVE",
        totalBudget: 5000000,
        perInfluencerBudget: 500000,
        fundedAmount: 5000000,
        requiresProduct: true,
        productName: "Organic Tea Pack",
        postingDeadline: new Date("2026-11-30T12:00:00Z"),
        createdAt: new Date("2026-11-01T10:00:00Z"),
        brand: {
          id: "brand_prof_1",
          companyName: "Tea Organics Ltd",
          website: "https://teaorganics.in",
          user: {
            id: "usr_brand_1",
            email: "partner@teaorganics.in",
          },
        },
      } as unknown as import("@prisma/client").Campaign & {
        brand: {
          id: string;
          companyName: string;
          website: string | null;
          user: { id: string; email: string } | null;
        } | null;
      });

      vi.spyOn(prisma.deal, "findMany").mockResolvedValueOnce([
        {
          id: "deal_1",
          campaignId: "camp_100",
          influencerId: "inf_1",
          status: "COMPLETED",
          amount: 1000000,
          platformFee: 100000,
          gatewayFee: 20000,
          postingDeadline: new Date("2026-11-20T12:00:00Z"),
          signDeadline: null,
          completedAt: new Date("2026-11-20T10:00:00Z"),
          createdAt: new Date("2026-11-10T12:00:00Z"),
          influencer: {
            id: "inf_1",
            displayName: "Pooja Hegde",
            instagramHandle: "pooja_influencer",
            followerAuthenticityScore: 92,
            instagramFollowers: 150000,
            instagramEngagementRate: 2.8,
            metricSnapshots: [],
          },
          engagementSnapshots: [
            {
              views: 45000,
              isEstimated: false,
            },
          ],
        },
      ] as unknown as Array<
        import("@prisma/client").Deal & {
          influencer: {
            id: string;
            displayName: string;
            instagramHandle: string | null;
            followerAuthenticityScore: number;
            instagramFollowers: number | null;
            instagramEngagementRate: number | null;
            metricSnapshots: Array<{
              followers: number;
              engagementRateBps: number | null;
              flagsJson: import("@prisma/client").Prisma.JsonValue;
            }>;
          } | null;
          engagementSnapshots: Array<{ views: number; isEstimated: boolean }>;
        }
      >);

      vi.spyOn(prisma.dispute, "findMany").mockResolvedValueOnce([]);
      vi.spyOn(prisma.message, "findMany").mockResolvedValueOnce([]);

      const result = await AdminCampaignService.getAdminCampaignDetails(
        "camp_100",
        mockAdmin,
        "103.21.244.2"
      );

      expect(result.campaign.id).toBe("camp_100");
      expect(result.campaign.title).toBe("Monsoon Brand Launch");
      expect(result.audit.revenue.grossPlatformFeePaise).toBe(100000);
      expect(result.audit.revenue.netPlatformRevenuePaise).toBe(80000);

      // Verify createAuditLog invocation
      expect(auditSpy).toHaveBeenCalledTimes(1);
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: mockAdmin.id,
          actionType: "ADMIN_CAMPAIGN_FINANCE_VIEW",
          entityType: "CAMPAIGN",
          entityId: "camp_100",
          ipAddress: "103.21.244.2",
          afterJSON: expect.objectContaining({
            netPlatformRevenuePaise: 80000,
            grossPlatformFeePaise: 100000,
            gatewayCostPaise: 20000,
            completedDealsCount: 1,
            dealsAtRiskCount: 0,
            disputesCount: 0,
            contactLeaksCount: 0,
          }),
        })
      );
    });

    it("listAdminCampaigns enforces active admin role and paginates campaigns", async () => {
      const mockAdmin = {
        id: "admin_master_1",
        email: "superadmin@vyaparmedia.in",
        role: "ADMIN",
        userType: "ADMIN",
      };

      vi.spyOn(adminAuthModule, "requireActiveAdmin").mockResolvedValueOnce({
        id: mockAdmin.id,
        email: mockAdmin.email,
      });

      vi.spyOn(prisma.campaign, "count").mockResolvedValueOnce(25);
      vi.spyOn(prisma.campaign, "findMany").mockResolvedValueOnce([
        {
          id: "camp_list_1",
          title: "Winter Sale Campaign",
          status: "ACTIVE",
          totalBudget: 5000000,
          fundedAmount: 5000000,
          postingDeadline: new Date("2026-12-01"),
          createdAt: new Date("2026-11-20"),
          brand: {
            id: "brand_1",
            companyName: "Acme Corp",
            user: { email: "acme@brand.com" },
          },
          _count: { deals: 5, applications: 12 },
        } as unknown as import("@prisma/client").Campaign,
      ]);

      const result = await AdminCampaignService.listAdminCampaigns(mockAdmin, {
        page: 1,
        limit: 10,
        status: "ACTIVE",
        search: "Winter",
      });

      expect(result.campaigns).toHaveLength(1);
      expect(result.campaigns[0]?.title).toBe("Winter Sale Campaign");
      expect(result.pagination.total).toBe(25);
      expect(result.pagination.totalPages).toBe(3);
    });
  });
});
