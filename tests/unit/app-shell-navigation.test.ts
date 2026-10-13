import { describe, it, expect } from "vitest";
import {
  getNavigationItems,
  getCreateActionConfig,
  isRouteAllowedForRole,
  calculateDealProgress,
  INFLUENCER_NAV_ITEMS,
  BRAND_NAV_ITEMS,
} from "@/config/navigation";

describe("App Shell Navigation & Role-Based System", () => {
  describe("Requirement 1: Mobile Bottom Tab Bar (Max 5 items per role)", () => {
    it("should return exactly 5 navigation items for INFLUENCER role", () => {
      const items = getNavigationItems("INFLUENCER");
      expect(items).toHaveLength(5);

      const labels = items.map((i) => i.label);
      expect(labels).toEqual(["Home", "Discover", "Deals", "Messages", "Profile"]);

      const paths = items.map((i) => i.href);
      expect(paths).toEqual([
        "/dashboard",
        "/dashboard/campaigns",
        "/dashboard/deals",
        "/dashboard/messages",
        "/dashboard/settings",
      ]);
    });

    it("should return exactly 5 navigation items for BRAND role", () => {
      const items = getNavigationItems("BRAND");
      expect(items).toHaveLength(5);

      const labels = items.map((i) => i.label);
      expect(labels).toEqual(["Home", "Creators", "Campaigns", "Messages", "Profile"]);

      const paths = items.map((i) => i.href);
      expect(paths).toEqual([
        "/dashboard",
        "/dashboard/influencers",
        "/dashboard/campaigns",
        "/dashboard/messages",
        "/dashboard/settings",
      ]);
    });

    it("should ensure every navigation item has descriptive ARIA labels for screen readers", () => {
      [...INFLUENCER_NAV_ITEMS, ...BRAND_NAV_ITEMS].forEach((item) => {
        expect(item.ariaLabel).toBeDefined();
        expect(item.ariaLabel.length).toBeGreaterThan(10);
      });
    });
  });

  describe("Requirement 4: Context-Aware Center-Elevated Create Action", () => {
    it("should configure 'New Campaign' creation for BRAND users", () => {
      const action = getCreateActionConfig("BRAND");
      expect(action.actionType).toBe("create-campaign");
      expect(action.label).toBe("New Campaign");
      expect(action.shortLabel).toBe("Create");
      expect(action.href).toBe("/dashboard/campaigns/create");
    });

    it("should configure 'Submit Content' action for INFLUENCER users", () => {
      const action = getCreateActionConfig("INFLUENCER");
      expect(action.actionType).toBe("submit-content");
      expect(action.label).toBe("Submit Content");
      expect(action.shortLabel).toBe("Submit");
      expect(action.href).toBe("/dashboard/deals?action=submit");
    });
  });

  describe("Requirement 5: Escrow Status Stories Bar & Deal Completion Calculations", () => {
    it("should accurately calculate progress percentage and colors across deal lifecycle stages", () => {
      // Draft & Application
      expect(calculateDealProgress("DRAFT").percentage).toBe(10);
      expect(calculateDealProgress("APPLIED").percentage).toBe(25);
      expect(calculateDealProgress("ACCEPTED").percentage).toBe(40);

      // Escrow Locked
      const escrowState = calculateDealProgress("PAYMENT_HELD");
      expect(escrowState.percentage).toBe(55);
      expect(escrowState.stageName).toBe("Escrow Locked");
      expect(escrowState.ringColorClass).toBe("text-escrow");

      // Content Submitted / In Review
      const reviewState = calculateDealProgress("CONTENT_SUBMITTED");
      expect(reviewState.percentage).toBe(75);
      expect(reviewState.stageName).toBe("In Review");
      expect(reviewState.ringColorClass).toBe("text-pending");

      // Approved / Completed
      const approvedState = calculateDealProgress("CONTENT_APPROVED");
      expect(approvedState.percentage).toBe(90);
      expect(approvedState.stageName).toBe("Approved");
      expect(approvedState.ringColorClass).toBe("text-verified");

      const completedState = calculateDealProgress("COMPLETED");
      expect(completedState.percentage).toBe(100);
      expect(completedState.stageName).toBe("Completed");

      // Disputed
      const disputedState = calculateDealProgress("DISPUTED");
      expect(disputedState.isDisputed).toBe(true);
      expect(disputedState.stageName).toBe("Disputed");
      expect(disputedState.ringColorClass).toBe("text-disputed");
    });
  });

  describe("Requirement 6: Route-Based Role Guards (Client & Server)", () => {
    it("should allow common routes for both BRAND and INFLUENCER", () => {
      expect(isRouteAllowedForRole("/dashboard", "BRAND")).toBe(true);
      expect(isRouteAllowedForRole("/dashboard", "INFLUENCER")).toBe(true);
      expect(isRouteAllowedForRole("/dashboard/messages", "BRAND")).toBe(true);
      expect(isRouteAllowedForRole("/dashboard/messages", "INFLUENCER")).toBe(true);
      expect(isRouteAllowedForRole("/dashboard/settings", "BRAND")).toBe(true);
      expect(isRouteAllowedForRole("/dashboard/settings", "INFLUENCER")).toBe(true);
    });

    it("should restrict Brand-only routes to BRAND and block INFLUENCER", () => {
      // Campaign creation
      expect(isRouteAllowedForRole("/dashboard/campaigns/create", "BRAND")).toBe(true);
      expect(isRouteAllowedForRole("/dashboard/campaigns/create", "INFLUENCER")).toBe(false);

      // Influencer Discovery Directory
      expect(isRouteAllowedForRole("/dashboard/influencers", "BRAND")).toBe(true);
      expect(isRouteAllowedForRole("/dashboard/influencers", "INFLUENCER")).toBe(false);
    });

    it("should restrict Influencer-only routes to INFLUENCER and block BRAND", () => {
      expect(isRouteAllowedForRole("/dashboard/applications", "INFLUENCER")).toBe(true);
      expect(isRouteAllowedForRole("/dashboard/applications", "BRAND")).toBe(false);
    });

    it("should always allow ADMIN to access any route", () => {
      expect(isRouteAllowedForRole("/dashboard/campaigns/create", "ADMIN")).toBe(true);
      expect(isRouteAllowedForRole("/dashboard/influencers", "ADMIN")).toBe(true);
      expect(isRouteAllowedForRole("/dashboard/applications", "ADMIN")).toBe(true);
      expect(isRouteAllowedForRole("/admin", "ADMIN")).toBe(true);
      expect(isRouteAllowedForRole("/admin", "INFLUENCER")).toBe(false);
      expect(isRouteAllowedForRole("/admin", "BRAND")).toBe(false);
    });
  });
});
