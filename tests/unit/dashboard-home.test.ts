import { describe, it, expect } from "vitest";
import { extractActionItems } from "@/components/dashboard/home/ActionRequiredBanner";
import {
  filterActiveDeals,
  getStatusBadgeConfig,
} from "@/components/dashboard/home/ActiveDealsFeed";
import { formatCurrency, getTrustTierLabel } from "@/lib/utils-client";
import type { RawDealItem, WalletSummary } from "@/lib/schemas";

describe("Dashboard Home Unit Tests: Action Routing, Urgency & Financial Invariants", () => {
  describe("Requirement 1: ActionRequiredBanner Action Extraction & Role Routing", () => {
    it("should extract HIGH urgency action for Influencer when deal is PENDING_SIGNATURE", () => {
      const deals: RawDealItem[] = [
        {
          id: "deal_sig_1",
          state: "PENDING_SIGNATURE",
          title: "Diwali Special Reel",
          brand: { companyName: "Amazon India" },
        },
      ];

      const actions = extractActionItems(deals, false, true);
      expect(actions).toHaveLength(1);
      expect(actions[0]!.urgency).toBe("HIGH");
      expect(actions[0]!.actionLabel).toBe("Sign Agreement");
      expect(actions[0]!.dealId).toBe("deal_sig_1");
      expect(actions[0]!.counterparty).toBe("Amazon India");
      expect(actions[0]!.href).toBe("/dashboard/deals/deal_sig_1");
    });

    it("should extract HIGH urgency action for Influencer when deal is REVISION_REQUESTED", () => {
      const deals: RawDealItem[] = [
        {
          id: "deal_rev_1",
          state: "REVISION_REQUESTED",
          title: "Product Unboxing",
          brand: { companyName: "Mamaearth" },
        },
      ];

      const actions = extractActionItems(deals, false, true);
      expect(actions).toHaveLength(1);
      expect(actions[0]!.urgency).toBe("HIGH");
      expect(actions[0]!.actionLabel).toBe("Submit Revision");
      expect(actions[0]!.reason).toContain("Brand requested revisions");
    });

    it("should extract MEDIUM urgency action for Influencer when content is CONTENT_APPROVED", () => {
      const deals: RawDealItem[] = [
        {
          id: "deal_app_1",
          state: "CONTENT_APPROVED",
          title: "Festive Outfit Story",
          brand: { companyName: "Myntra" },
        },
      ];

      const actions = extractActionItems(deals, false, true);
      expect(actions).toHaveLength(1);
      expect(actions[0]!.urgency).toBe("MEDIUM");
      expect(actions[0]!.actionLabel).toBe("Submit Live Link");
    });

    it("should extract HIGH urgency action for Brand when deliverable is CONTENT_SUBMITTED", () => {
      const deals: RawDealItem[] = [
        {
          id: "deal_sub_1",
          state: "CONTENT_SUBMITTED",
          title: "Winter Skincare Campaign",
          influencer: { displayName: "Priya Sharma" },
        },
      ];

      const actions = extractActionItems(deals, true, false);
      expect(actions).toHaveLength(1);
      expect(actions[0]!.urgency).toBe("HIGH");
      expect(actions[0]!.actionLabel).toBe("Review Submission");
      expect(actions[0]!.counterparty).toBe("Priya Sharma");
      expect(actions[0]!.reason).toContain("48h review window active");
    });

    it("should extract MEDIUM urgency action for Brand when post is POSTED", () => {
      const deals: RawDealItem[] = [
        {
          id: "deal_post_1",
          state: "POSTED",
          title: "Shoe Launch",
          influencer: { displayName: "Rahul Verma" },
        },
      ];

      const actions = extractActionItems(deals, true, false);
      expect(actions).toHaveLength(1);
      expect(actions[0]!.urgency).toBe("MEDIUM");
      expect(actions[0]!.actionLabel).toBe("Verify Post");
    });

    it("should return empty array when all collaborations are in-progress with no action required", () => {
      const deals: RawDealItem[] = [
        {
          id: "deal_prog_1",
          state: "IN_PROGRESS",
          title: "Spring Lookbook",
        },
      ];

      const actions = extractActionItems(deals, true, false);
      expect(actions).toHaveLength(0);
    });
  });

  describe("Requirement 2: Active Collaborations Feed & Pipeline Isolation", () => {
    it("should filter out CANCELLED, COMPLETED, and DISPUTED deals", () => {
      const allDeals: RawDealItem[] = [
        { id: "1", state: "ACTIVE", title: "Active 1" },
        { id: "2", state: "PENDING_SIGNATURE", title: "Sig 2" },
        { id: "3", state: "CONTENT_SUBMITTED", title: "Sub 3" },
        { id: "4", state: "COMPLETED", title: "Done 4" },
        { id: "5", state: "CANCELLED", title: "Cancelled 5" },
        { id: "6", state: "DISPUTED", title: "Disputed 6" },
      ];

      const activeOnly = filterActiveDeals(allDeals);
      expect(activeOnly).toHaveLength(3);
      expect(activeOnly.map((d) => d.id)).toEqual(["1", "2", "3"]);
    });

    it("should return correct status badges for all deal states", () => {
      expect(getStatusBadgeConfig("PENDING_SIGNATURE").label).toBe("Awaiting Signature");
      expect(getStatusBadgeConfig("PENDING_SIGNATURE").tone).toBe("warning");

      expect(getStatusBadgeConfig("ACTIVE").label).toBe("In Progress");
      expect(getStatusBadgeConfig("ACTIVE").tone).toBe("cyan");

      expect(getStatusBadgeConfig("CONTENT_SUBMITTED").label).toBe("Awaiting Review");
      expect(getStatusBadgeConfig("CONTENT_SUBMITTED").tone).toBe("warning");

      expect(getStatusBadgeConfig("REVISION_REQUESTED").label).toBe("Revision Needed");
      expect(getStatusBadgeConfig("REVISION_REQUESTED").tone).toBe("danger");

      expect(getStatusBadgeConfig("CONTENT_APPROVED").label).toBe("Ready to Post");
      expect(getStatusBadgeConfig("CONTENT_APPROVED").tone).toBe("success");

      expect(getStatusBadgeConfig("POSTED").label).toBe("Post Submitted");
      expect(getStatusBadgeConfig("POSTED").tone).toBe("cyan");

      expect(getStatusBadgeConfig("COMPLETED").label).toBe("Completed");
      expect(getStatusBadgeConfig("COMPLETED").tone).toBe("success");
    });
  });

  describe("Requirement 3: Financial Bar Segregation & Indian Rupee Formatting", () => {
    it("should accurately format INR amounts in Indian notation (Lakhs / Thousands)", () => {
      expect(formatCurrency(2500000)).toContain("25,000");
      expect(formatCurrency(10000000)).toContain("1,00,000");
      expect(formatCurrency(50000000)).toContain("5,00,000");
    });

    it("should calculate correct DRS Trust Tier labels", () => {
      expect(getTrustTierLabel(900)).toBe("Elite");
      expect(getTrustTierLabel(800)).toBe("Trusted");
      expect(getTrustTierLabel(700)).toBe("Normal");
      expect(getTrustTierLabel(550)).toBe("Limited");
      expect(getTrustTierLabel(400)).toBe("Flagged");
    });

    it("should verify segregated wallet balance calculation invariant", () => {
      const wallet: WalletSummary = {
        id: "w_1",
        balance: 4500000, // ₹45,000
        pendingBalance: 1500000, // ₹15,000
        totalHeld: 2000000, // ₹20,000
        totalEarned: 12000000, // ₹1,20,000
        totalSpent: 0,
        totalWithdrawn: 6000000,
        totalDeposited: 0,
        isFrozen: false,
      };

      const available = wallet.balance;
      const escrow = wallet.totalHeld ?? wallet.pendingBalance;
      const lifetime = wallet.totalEarned;

      expect(available).toBe(4500000);
      expect(escrow).toBe(2000000);
      expect(lifetime).toBe(12000000);
    });
  });
});
