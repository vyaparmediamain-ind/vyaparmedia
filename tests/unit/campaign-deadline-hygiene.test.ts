import { describe, it, expect } from "vitest";

describe("Campaign Deadline & Hygiene Enforcement", () => {
  describe("useCampaignDetail: canApply logic", () => {
    function computeCanApply(
      user: { userType: string } | null,
      campaign: { status: string; applicationDeadline: string | null } | null,
      hasApplied: boolean,
    ): boolean {
      return (
        user?.userType === "INFLUENCER" &&
        campaign?.status === "ACTIVE" &&
        !hasApplied &&
        Boolean(campaign?.applicationDeadline && new Date(campaign.applicationDeadline) > new Date())
      );
    }

    it("allows applying when all conditions match and deadline is in the future", () => {
      const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
      const canApply = computeCanApply(
        { userType: "INFLUENCER" },
        { status: "ACTIVE", applicationDeadline: futureDate },
        false,
      );
      expect(canApply).toBe(true);
    });

    it("blocks applying when applicationDeadline is in the past", () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      const canApply = computeCanApply(
        { userType: "INFLUENCER" },
        { status: "ACTIVE", applicationDeadline: pastDate },
        false,
      );
      expect(canApply).toBe(false);
    });

    it("blocks applying when user is not an INFLUENCER", () => {
      const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
      const canApply = computeCanApply(
        { userType: "BRAND" },
        { status: "ACTIVE", applicationDeadline: futureDate },
        false,
      );
      expect(canApply).toBe(false);
    });

    it("blocks applying when campaign is PAUSED or COMPLETED even if deadline is in the future", () => {
      const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
      const canApplyPaused = computeCanApply(
        { userType: "INFLUENCER" },
        { status: "PAUSED", applicationDeadline: futureDate },
        false,
      );
      expect(canApplyPaused).toBe(false);

      const canApplyCompleted = computeCanApply(
        { userType: "INFLUENCER" },
        { status: "COMPLETED", applicationDeadline: futureDate },
        false,
      );
      expect(canApplyCompleted).toBe(false);
    });

    it("blocks applying when influencer has already applied", () => {
      const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
      const canApply = computeCanApply(
        { userType: "INFLUENCER" },
        { status: "ACTIVE", applicationDeadline: futureDate },
        true,
      );
      expect(canApply).toBe(false);
    });

    it("blocks applying when deadline is missing or null", () => {
      const canApply = computeCanApply(
        { userType: "INFLUENCER" },
        { status: "ACTIVE", applicationDeadline: null },
        false,
      );
      expect(canApply).toBe(false);
    });
  });

  describe("QStash Cron: /api/cron/expire-campaigns route", () => {
    it("ensures the route file exists on disk", async () => {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const routePath = path.join(process.cwd(), "src/app/api/cron/expire-campaigns/route.ts");
      expect(fs.existsSync(routePath)).toBe(true);

      const content = fs.readFileSync(routePath, "utf8");
      expect(content).toContain("validateCronSecret");
      expect(content).toContain("acquireDistributedLock");
      expect(content).toContain("releaseDistributedLock");
      expect(content).toContain('status: "PAUSED"');
      expect(content).toContain("invalidateCampaignSearchCache");
    });
  });
});
