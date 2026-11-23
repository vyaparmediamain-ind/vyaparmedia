import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/lib/db";
import { redis } from "@/lib/redis";
import { resolveActor } from "@/lib/authz";
import { invalidateAdminCache } from "@/lib/admin-auth";
import { AdminService } from "@/services/admin.service";
import { FairPriceService } from "@/services/fair-price.service";
import { MarketRangeReportService } from "@/services/market-range-report.service";
import { CampaignMetricsService } from "@/services/campaign-metrics.service";
import { CampaignFinanceService } from "@/services/campaign-finance.service";
import { AppError } from "@/lib/errors";

describe("Active Admin Authorization Hardening (IDOR Defense for Demoted/Banned Admins)", () => {
  const adminId = "admin_user_001";
  const adminEmail = "admin@vyaparmedia.com";

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(redis, "get").mockResolvedValue(null);
    vi.spyOn(redis, "set").mockResolvedValue("OK");
    vi.spyOn(redis, "del").mockResolvedValue(1);
  });

  describe("1. resolveActor(session)", () => {
    it("resolves an active admin with isActiveAdmin: true when DB status is ACTIVE", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValueOnce({
        id: adminId,
        email: adminEmail,
        userType: "ADMIN",
        status: "ACTIVE",
        deletedAt: null,
      } as any);

      const actor = await resolveActor({
        user: { id: adminId, email: adminEmail, userType: "ADMIN" },
      });

      expect(actor.id).toBe(adminId);
      expect(actor.role).toBe("ADMIN");
      expect(actor.isActiveAdmin).toBe(true);
    });

    it("resolves isActiveAdmin: false when admin user is SUSPENDED in DB", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValueOnce({
        id: adminId,
        email: adminEmail,
        userType: "ADMIN",
        status: "SUSPENDED",
        deletedAt: null,
      } as any);

      const actor = await resolveActor({
        user: { id: adminId, email: adminEmail, userType: "ADMIN" },
      });

      expect(actor.id).toBe(adminId);
      expect(actor.isActiveAdmin).toBe(false);
    });

    it("resolves isActiveAdmin: false when admin user is soft-deleted (deletedAt not null)", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValueOnce({
        id: adminId,
        email: adminEmail,
        userType: "ADMIN",
        status: "ACTIVE",
        deletedAt: new Date(),
      } as any);

      const actor = await resolveActor({
        user: { id: adminId, email: adminEmail, userType: "ADMIN" },
      });

      expect(actor.isActiveAdmin).toBe(false);
    });

    it("resolves isActiveAdmin: false when admin user has been demoted to BRAND in DB", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValueOnce({
        id: adminId,
        email: adminEmail,
        userType: "BRAND",
        status: "ACTIVE",
        deletedAt: null,
      } as any);

      const actor = await resolveActor({
        user: { id: adminId, email: adminEmail, userType: "ADMIN" },
      });

      expect(actor.isActiveAdmin).toBe(false);
    });
  });

  describe("2. FairPriceService.verifyRelationshipOrOwnership", () => {
    const targetInfluencerId = "influencer_target_999";

    it("allows active admin to evaluate any influencer profile", async () => {
      const activeAdminActor = {
        id: adminId,
        role: "ADMIN",
        isActiveAdmin: true,
      };

      await expect(
        FairPriceService.verifyRelationshipOrOwnership(activeAdminActor, targetInfluencerId)
      ).resolves.toBeUndefined();
    });

    it("rejects demoted/suspended admin (isActiveAdmin: false) with 404 on unowned influencer", async () => {
      const demotedAdminActor = {
        id: adminId,
        role: "ADMIN",
        isActiveAdmin: false,
      };

      // Mock DB: Not creator profile, not brand profile
      vi.spyOn(prisma.influencerProfile, "findUnique").mockResolvedValue(null);
      vi.spyOn(prisma.brandProfile, "findUnique").mockResolvedValue(null);

      await expect(
        FairPriceService.verifyRelationshipOrOwnership(demotedAdminActor, targetInfluencerId)
      ).rejects.toThrowError(AppError);

      try {
        await FairPriceService.verifyRelationshipOrOwnership(demotedAdminActor, targetInfluencerId);
      } catch (err: any) {
        expect(err.statusCode).toBe(404);
        expect(err.message).toBe("Influencer profile not found");
      }
    });
  });

  describe("3. MarketRangeReportService.generateReport", () => {
    const targetInfluencerId = "influencer_target_999";

    it("rejects demoted/suspended admin (isActiveAdmin: false) with 404 on unowned creator report", async () => {
      const demotedAdminActor = {
        id: adminId,
        role: "ADMIN",
        userType: "ADMIN",
        email: adminEmail,
        isActiveAdmin: false,
      };

      vi.spyOn(prisma.influencerProfile, "findUnique").mockResolvedValueOnce({
        id: targetInfluencerId,
        userId: "different_creator_id", // not owned by caller
        user: { email: "creator@example.com" },
      } as any);

      await expect(
        MarketRangeReportService.generateReport(demotedAdminActor, targetInfluencerId)
      ).rejects.toThrowError(AppError);

      try {
        await MarketRangeReportService.generateReport(demotedAdminActor, targetInfluencerId);
      } catch (err: any) {
        expect(err.statusCode).toBe(404);
        expect(err.message).toBe("Influencer profile not found");
      }
    });
  });

  describe("4. CampaignMetricsService.getCampaignAnalyticsOverview", () => {
    const campaignId = "campaign_target_777";

    it("rejects demoted/suspended admin (isActiveAdmin: false) with 404 on unowned campaign", async () => {
      const demotedAdminActor = {
        id: adminId,
        role: "ADMIN",
        isActiveAdmin: false,
      };

      vi.spyOn(prisma.campaign, "findUnique").mockResolvedValueOnce({
        id: campaignId,
        brand: { userId: "different_brand_user_id", companyName: "Other Brand" },
        deals: [],
      } as any);

      await expect(
        CampaignMetricsService.getCampaignAnalyticsOverview(campaignId, demotedAdminActor)
      ).rejects.toThrowError(AppError);

      try {
        await CampaignMetricsService.getCampaignAnalyticsOverview(campaignId, demotedAdminActor);
      } catch (err: any) {
        expect(err.statusCode).toBe(404);
        expect(err.message).toBe("Campaign not found");
      }
    });
  });

  describe("5. CampaignFinanceService.exportCampaignFinanceCsv & getCampaignFinance", () => {
    const campaignId = "campaign_target_777";

    it("rejects demoted/suspended admin (isActiveAdmin: false) with 404 on unowned campaign finance", async () => {
      const demotedAdminActor = {
        id: adminId,
        role: "ADMIN",
        isActiveAdmin: false,
      };

      vi.spyOn(prisma.campaign, "findUnique").mockResolvedValueOnce({
        id: campaignId,
        title: "Test Campaign",
        status: "ACTIVE",
        totalBudget: 1000000,
        targetCategories: ["Fashion"],
        brandId: "brand_profile_1",
        brand: { id: "brand_profile_1", userId: "different_brand_user_id", companyName: "Other Brand" },
      } as any);

      await expect(
        CampaignFinanceService.getCampaignFinance(campaignId, demotedAdminActor)
      ).rejects.toThrowError(AppError);

      try {
        await CampaignFinanceService.getCampaignFinance(campaignId, demotedAdminActor);
      } catch (err: any) {
        expect(err.statusCode).toBe(404);
        expect(err.message).toBe("Campaign not found");
      }
    });
  });

  describe("6. Cached-admin invalidation on ban/suspension/demotion", () => {
    it("calls invalidateAdminCache and deletes the Redis key admin_verified:<userId>", async () => {
      const delSpy = vi.spyOn(redis, "del").mockResolvedValue(1);

      await invalidateAdminCache(adminId);

      expect(delSpy).toHaveBeenCalledWith(`admin_verified:${adminId}`);
    });

    it("AdminService.updateUserStatus invalidates admin cache when banning a user", async () => {
      const delSpy = vi.spyOn(redis, "del").mockResolvedValue(1);

      (vi.spyOn(prisma.user, "findUnique") as any).mockImplementation(async ({ where }: any) => {
        if (where.id === "super_admin_id") {
          return {
            id: "super_admin_id",
            email: "super@vyaparmedia.in",
            userType: "ADMIN",
            status: "ACTIVE",
            deletedAt: null,
          } as any;
        }
        return {
          id: adminId,
          email: adminEmail,
          userType: "ADMIN",
          status: "ACTIVE",
          trustScore: 800,
          deletedAt: null,
        } as any;
      });

      vi.spyOn(prisma, "$transaction").mockImplementation(async (cb: any) => {
        return cb({
          user: {
            update: vi.fn().mockResolvedValue({
              id: adminId,
              email: adminEmail,
              userType: "ADMIN",
              status: "BANNED",
            }),
          },
          userViolation: {
            create: vi.fn().mockResolvedValue({ id: "viol_1" }),
          },
          notification: {
            create: vi.fn().mockResolvedValue({ id: "notif_1" }),
          },
        });
      });

      await AdminService.updateUserStatus(
        { id: "super_admin_id", email: "super@vyaparmedia.in", userType: "ADMIN" },
        adminId,
        { action: "ban", reason: "Compromised account detected" }
      );

      // Verify that admin_verified:<userId> was invalidated
      expect(delSpy).toHaveBeenCalledWith(`admin_verified:${adminId}`);
    });
  });
});
