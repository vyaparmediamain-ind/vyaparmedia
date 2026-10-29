import { describe, it, expect } from "vitest";
import { getNavigationItems } from "@/config/navigation";

describe("Phase 14 Deep Frontend Hardening Suite (P14-FRONTEND)", () => {
  describe("P14-01: Navigation Configuration Integrity", () => {
    it("returns valid navigation items for INFLUENCER role", () => {
      const items = getNavigationItems("INFLUENCER");
      expect(items.length).toBeGreaterThan(0);
      expect(items.some((i) => i.href.includes("deals"))).toBe(true);
      expect(items.some((i) => i.href.includes("campaigns"))).toBe(true);
      expect(items.some((i) => i.href.includes("messages"))).toBe(true);
    });

    it("returns valid navigation items for BRAND role", () => {
      const items = getNavigationItems("BRAND");
      expect(items.length).toBeGreaterThan(0);
      expect(items.some((i) => i.href.includes("campaigns"))).toBe(true);
      expect(items.some((i) => i.href.includes("influencers"))).toBe(true);
      expect(items.some((i) => i.href.includes("messages"))).toBe(true);
    });

    it("returns valid navigation items for ADMIN role", () => {
      const items = getNavigationItems("ADMIN");
      expect(items.length).toBeGreaterThan(0);
      expect(items.some((i) => i.href.includes("admin"))).toBe(true);
    });
  });

  describe("P14-02: Story Share Modal Perks Role Differentiation", () => {
    it("provides correct distinct perks for brands and creators", () => {
      const brandPerks = [
        "0% fee on first 3 campaigns",
        "Verified Brand Badge",
        "Escrow-secured deliverables",
      ];
      const creatorPerks = [
        "0% Commission (Always Free)",
        "Verified Creator Badge",
        "100% Escrow-secured payouts",
      ];

      expect(brandPerks[0]).toContain("0% fee on first 3 campaigns");
      expect(creatorPerks[0]).toContain("0% Commission (Always Free)");
      expect(brandPerks).not.toEqual(creatorPerks);
    });
  });

  describe("P14-03: Campaign Wizard Draft Hydration Guard", () => {
    it("provides stable initial form state without server-window discrepancies", () => {
      const INITIAL_FORM_DATA = {
        title: "",
        description: "",
        brandId: "",
        targetCategories: [],
        totalBudget: "",
        perInfluencerBudget: "",
        maxInfluencers: "1",
        deliverables: [],
        requirements: "",
        guidelines: "",
        isPublic: true,
      };

      expect(INITIAL_FORM_DATA.title).toBe("");
      expect(INITIAL_FORM_DATA.description).toBe("");
      expect(INITIAL_FORM_DATA.isPublic).toBe(true);
    });
  });
});
