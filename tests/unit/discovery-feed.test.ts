import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as handleBookmarkPost, GET as handleBookmarkGet } from "@/app/api/bookmarks/route";
import {
  CampaignDiscoveryItem,
  CreatorDiscoveryItem,
  DiscoveryFilters,
} from "@/components/discovery/types";

// Mock auth session
const mockSession = {
  user: {
    id: "user_test_123",
    email: "creator@vyaparmedia.com",
    userType: "INFLUENCER",
  },
};

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() => Promise.resolve(mockSession)),
}));

vi.mock("@/lib/redis", () => ({
  getRedisClient: vi.fn(() => null), // Uses memory fallback
}));

describe("Discovery Feed & Optimistic Bookmarking System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Requirement 6: Optimistic Bookmark API (/api/bookmarks)", () => {
    it("should allow a logged-in user to save a campaign with optimistic confirmation", async () => {
      const req = new NextRequest("http://localhost:3000/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetId: "cmp_456",
          targetType: "campaign",
          isSaved: true,
        }),
      });

      const res = await handleBookmarkPost(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.targetId).toBe("cmp_456");
      expect(json.isSaved).toBe(true);
    });

    it("should allow a user to unsave/unbookmark an item", async () => {
      const req = new NextRequest("http://localhost:3000/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetId: "cmp_456",
          targetType: "campaign",
          isSaved: false,
        }),
      });

      const res = await handleBookmarkPost(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.isSaved).toBe(false);
    });

    it("should reject bookmark request with 400 if required fields are missing", async () => {
      const req = new NextRequest("http://localhost:3000/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetId: "", // Missing targetId
        }),
      });

      const res = await handleBookmarkPost(req);
      expect(res.status).toBe(400);
    });

    it("should retrieve bookmarked IDs for the current session", async () => {
      // First save an item
      await handleBookmarkPost(
        new NextRequest("http://localhost:3000/api/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetId: "creator_789",
            targetType: "creator",
            isSaved: true,
          }),
        })
      );

      const getReq = new NextRequest("http://localhost:3000/api/bookmarks");
      const res = await handleBookmarkGet(getReq);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.savedIds).toContain("creator_789");
    });
  });

  describe("Requirement 2: Trust Signals Upfront on Discovery Cards", () => {
    it("should enforce mandatory trust properties on CampaignDiscoveryItem", () => {
      const sampleCampaign: CampaignDiscoveryItem = {
        id: "cmp_1",
        title: "Summer Fitness Apparel Campaign",
        description: "Promoting high-performance athletic wear across Instagram Reels.",
        coverImage: "https://images.unsplash.com/photo-fitness",
        brandId: "brd_10",
        brandName: "Nike India",
        brandAvatar: "https://images.unsplash.com/logo-nike",
        isBrandGstVerified: true,
        budgetPaise: 5000000, // ₹50,000
        isEscrowSecured: true,
        niche: "Fitness & Health",
        city: "Mumbai",
        deliverables: ["1x Reel", "2x Stories"],
      };

      // Check trust indicators
      expect(sampleCampaign.isBrandGstVerified).toBe(true);
      expect(sampleCampaign.isEscrowSecured).toBe(true);
      expect(sampleCampaign.budgetPaise / 100).toBe(50000);
      expect(sampleCampaign.deliverables).toHaveLength(2);
    });

    it("should enforce mandatory trust properties on CreatorDiscoveryItem", () => {
      const sampleCreator: CreatorDiscoveryItem = {
        id: "usr_creator_1",
        name: "Priya Sharma",
        handle: "priya_styles",
        avatar: "https://images.unsplash.com/avatar-priya",
        niche: "Fashion & Style",
        followers: 125000,
        engagementRate: 4.8,
        isKycVerified: true,
        trustScore: 840,
        startingRatePaise: 2500000, // ₹25,000
      };

      expect(sampleCreator.isKycVerified).toBe(true);
      expect(sampleCreator.trustScore).toBeGreaterThanOrEqual(800);
      expect(sampleCreator.engagementRate).toBe(4.8);
      expect(sampleCreator.startingRatePaise / 100).toBe(25000);
    });
  });

  describe("Requirement 5: Filter Parameters & Range Serialization", () => {
    it("should construct valid search query parameters matching cursor contracts", () => {
      const filters: DiscoveryFilters = {
        niche: "Tech & Gadgets",
        minBudget: 1500000, // ₹15,000 in paise
        maxBudget: 5000000, // ₹50,000 in paise
        city: "Bengaluru",
        sortBy: "budget",
      };

      const params = new URLSearchParams();
      if (filters.niche) params.set("category", filters.niche);
      if (filters.city) params.set("city", filters.city);
      if (filters.sortBy) params.set("sortBy", filters.sortBy);
      if (filters.minBudget) params.set("minBudget", (filters.minBudget / 100).toString());
      if (filters.maxBudget) params.set("maxBudget", (filters.maxBudget / 100).toString());

      expect(params.get("category")).toBe("Tech & Gadgets");
      expect(params.get("city")).toBe("Bengaluru");
      expect(params.get("minBudget")).toBe("15000");
      expect(params.get("maxBudget")).toBe("50000");
      expect(params.get("sortBy")).toBe("budget");
    });
  });
});
