import { describe, it, expect } from "vitest";
import {
  buildCampaignQueryParams,
  mapRawCampaigns,
} from "@/app/dashboard/campaigns/CampaignsClient";
import type { RawCampaignApiItem } from "@/lib/schemas";

describe("Campaigns Screen Unit Tests: Query Building & Data Transformation", () => {
  describe("Requirement 1: buildCampaignQueryParams Parameter Isolation", () => {
    it("should set scope=mine and status=ALL for brand users", () => {
      const qs = buildCampaignQueryParams(true, "All", "", "newest", 1);
      const params = new URLSearchParams(qs);
      expect(params.get("scope")).toBe("mine");
      expect(params.get("status")).toBe("ALL");
      expect(params.get("page")).toBe("1");
      expect(params.get("limit")).toBe("12");
      expect(params.has("category")).toBe(false);
      expect(params.has("search")).toBe(false);
    });

    it("should set status=ACTIVE and omit scope for creator users", () => {
      const qs = buildCampaignQueryParams(false, "All", "", "newest", 2);
      const params = new URLSearchParams(qs);
      expect(params.has("scope")).toBe(false);
      expect(params.get("status")).toBe("ACTIVE");
      expect(params.get("page")).toBe("2");
    });

    it("should include category and search params when specified", () => {
      const qs = buildCampaignQueryParams(false, "Tech & Gadgets", "iPhone 16", "newest", 1);
      const params = new URLSearchParams(qs);
      expect(params.get("category")).toBe("Tech & Gadgets");
      expect(params.get("search")).toBe("iPhone 16");
    });

    it("should apply correct sorting keys for budget_high, budget_low, and deadline", () => {
      const qsHigh = buildCampaignQueryParams(false, "All", "", "budget_high", 1);
      const paramsHigh = new URLSearchParams(qsHigh);
      expect(paramsHigh.get("sortBy")).toBe("perInfluencerBudget");
      expect(paramsHigh.get("sortOrder")).toBe("desc");

      const qsLow = buildCampaignQueryParams(false, "All", "", "budget_low", 1);
      const paramsLow = new URLSearchParams(qsLow);
      expect(paramsLow.get("sortBy")).toBe("perInfluencerBudget");
      expect(paramsLow.get("sortOrder")).toBe("asc");

      const qsDeadline = buildCampaignQueryParams(false, "All", "", "deadline", 1);
      const paramsDeadline = new URLSearchParams(qsDeadline);
      expect(paramsDeadline.get("sortBy")).toBe("applicationDeadline");
      expect(paramsDeadline.get("sortOrder")).toBe("asc");
    });
  });

  describe("Requirement 2: mapRawCampaigns Transformation & Deliverable Normalization", () => {
    it("should map raw campaign API item to DashboardCampaign with default fallbacks", () => {
      const raw: RawCampaignApiItem[] = [
        {
          id: "camp_1",
          title: "Festive Tech Launch",
          description: "Promote new wireless earbuds",
          perInfluencerBudget: 3500000,
          minFollowers: 15000,
          postingDeadline: "2026-10-31T18:30:00.000Z",
          targetCategories: ["Tech & Gadgets"],
          totalApplications: 12,
          maxInfluencers: 5,
          applications: [
            { id: "app_1", status: "ACCEPTED" },
            { id: "app_2", status: "ACCEPTED" },
          ],
          brand: {
            companyName: "SoundCore India",
            avgRating: 480,
          },
          deliverables: [
            { type: "INSTAGRAM_REEL", count: 1 },
            { type: "INSTAGRAM_STORY", count: 2 },
          ],
        },
      ];

      const mapped = mapRawCampaigns(raw);
      expect(mapped).toHaveLength(1);
      expect(mapped[0]!.id).toBe("camp_1");
      expect(mapped[0]!.title).toBe("Festive Tech Launch");
      expect(mapped[0]!.perInfluencerBudget).toBe(3500000);
      expect(mapped[0]!.acceptedCount).toBe(2);
      expect(mapped[0]!.maxInfluencers).toBe(5);
      expect(mapped[0]!.brand.avgRating).toBe(4.8);
      expect(mapped[0]!.brand.companyName).toBe("SoundCore India");
      expect(mapped[0]!.deliverables).toHaveLength(2);
    });
  });
});
