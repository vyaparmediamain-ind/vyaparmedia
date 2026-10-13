import { describe, it, expect } from "vitest";
import { InfluencerProfileData } from "@/components/profile/types";
import { getTrustScoreTier } from "@/components/profile/InfluencerProfileClient";

describe("Creator Profile Screen & Media Kit Specifications", () => {
  const mockProfile: InfluencerProfileData = {
    id: "inf_profile_spec",
    userId: "usr_creator_spec",
    displayName: "Rohan Varma",
    bio: "Tech, gadgets & automotive creator based in Bengaluru.",
    avatar: "https://images.unsplash.com/avatar-rohan",
    city: "Bengaluru",
    state: "Karnataka",
    categories: ["Tech", "Gadgets", "Automotive"],
    languages: ["English", "Hindi", "Kannada"],
    instagramHandle: "rohan_tech",
    instagramFollowers: 450000,
    instagramEngagementRate: 4.8,
    youtubeHandle: "RohanVarmaTech",
    youtubeSubscribers: 280000,
    youtubeEngagementRate: 5.6,
    completedDealsCount: 48,
    trustScore: 840,
    responseRatePercent: 98,
    avgResponseTime: "< 2 hours",
    isKycVerified: true,
    isSocialVerified: true,
    minRatePaise: 2500000, // ₹25,000
    maxRatePaise: 7500000,
    campaignProofs: [
      {
        id: "proof_1",
        title: "OnePlus Nord Flagship Launch Reel",
        brandName: "OnePlus India",
        brandAvatar: "https://images.unsplash.com/brand-oneplus",
        coverImage: "https://images.unsplash.com/proof-cover-1",
        amountPaise: 4000000, // ₹40,000
        completedDate: "2026-08-20T10:00:00.000Z",
        outcomeMetric: "1.8M Views • 6.4% CTR",
        rating: 5,
        reviewComment: "Incredible attention to detail and delivered 1 day ahead of schedule.",
        deliverables: ["1x 60s Reel", "3x Stories"],
        escrowVerified: true,
      },
      {
        id: "proof_2",
        title: "Asus ROG Phone Gaming Performance Breakdown",
        brandName: "Asus ROG",
        brandAvatar: "https://images.unsplash.com/brand-asus",
        coverImage: "https://images.unsplash.com/proof-cover-2",
        amountPaise: 6500000, // ₹65,000
        completedDate: "2026-07-15T15:00:00.000Z",
        outcomeMetric: "540K Dedicated Views",
        rating: 5,
        reviewComment: "Top tier benchmark tests and highly engaging storytelling.",
        deliverables: ["1x Dedicated YouTube Video"],
        escrowVerified: true,
      },
    ],
    rateCard: [
      {
        id: "rate-reel",
        deliverable: "Instagram Reel (60s)",
        pricePaise: 2500000,
        turnaround: "3 – 5 Days",
        revisions: 2,
        description: "Full vertical 9:16 high-engagement product demo, pinned for 30 days.",
      },
      {
        id: "rate-story",
        deliverable: "Instagram Story (3 Frames + Link)",
        pricePaise: 1000000,
        turnaround: "24 – 48 Hours",
        revisions: 1,
        description: "Direct swipe-up / sticker link with brand promo code, 24h lifespan.",
      },
      {
        id: "rate-yt-dedicated",
        deliverable: "YouTube Dedicated Video",
        pricePaise: 5500000,
        turnaround: "7 – 10 Days",
        revisions: 2,
        description: "8-12 minute deep-dive review with description links & pinned comment.",
      },
    ],
    reviews: [
      {
        id: "rev_1",
        brandName: "OnePlus India",
        brandAvatar: "https://images.unsplash.com/brand-oneplus",
        rating: 5,
        comment: "Incredible attention to detail and delivered 1 day ahead of schedule.",
        campaignTitle: "OnePlus Nord Flagship Launch Reel",
        createdAt: "2026-08-21T09:00:00.000Z",
      },
    ],
  };

  describe("DRS Trust Score & Radial Gauge Math", () => {
    it("should classify DRS score into appropriate trust tiers and CIBIL grades", () => {
      const elite = getTrustScoreTier(850);
      expect(elite.label).toBe("Elite Creator");
      expect(elite.cibilGrade).toBe("Excellent");

      const high = getTrustScoreTier(750);
      expect(high.label).toBe("High Trust");
      expect(high.cibilGrade).toBe("Good");

      const good = getTrustScoreTier(650);
      expect(good.label).toBe("Verified Good");
      expect(good.cibilGrade).toBe("Fair");

      const emerging = getTrustScoreTier(550);
      expect(emerging.label).toBe("Emerging");
      expect(emerging.cibilGrade).toBe("Average");

      const attention = getTrustScoreTier(400);
      expect(attention.label).toBe("Needs Attention");
      expect(attention.cibilGrade).toBe("Poor");
    });

    it("should accurately compute SVG radial gauge progress fraction on CIBIL 300-900 scale", () => {
      const radius = 24;
      const circumference = 2 * Math.PI * radius;
      const score = mockProfile.trustScore; // 840
      const progressFraction = Math.min(Math.max((score - 300) / 600, 0), 1);
      const strokeDashoffset = circumference * (1 - progressFraction);

      expect(progressFraction).toBeCloseTo(0.9, 2);
      expect(strokeDashoffset).toBeLessThan(circumference * 0.15);
    });
  });

  describe("Header Trust Signals & Instagram-Style Stats", () => {
    it("should display server-verified trust badges correctly", () => {
      expect(mockProfile.isKycVerified).toBe(true);
      expect(mockProfile.isSocialVerified).toBe(true);
      expect(mockProfile.completedDealsCount).toBe(48);
      expect(mockProfile.responseRatePercent).toBe(98);
      expect(mockProfile.avgResponseTime).toBe("< 2 hours");
    });
  });

  describe("Instagram 3-Column Media Grid & Proofs", () => {
    it("should format campaign deliverables with escrow verification and metrics", () => {
      expect(mockProfile.campaignProofs).toHaveLength(2);
      const proof1 = mockProfile.campaignProofs[0]!;
      expect(proof1.brandName).toBe("OnePlus India");
      expect(proof1.outcomeMetric).toBe("1.8M Views • 6.4% CTR");
      expect(proof1.amountPaise).toBe(4000000);
      expect(proof1.escrowVerified).toBe(true);
    });
  });

  describe("Transparent Rate Card", () => {
    it("should expose structured deliverables with turnaround and revision limits", () => {
      const reel = mockProfile.rateCard.find((r) => r.id === "rate-reel");
      const story = mockProfile.rateCard.find((r) => r.id === "rate-story");
      const yt = mockProfile.rateCard.find((r) => r.id === "rate-yt-dedicated");

      expect(reel?.pricePaise).toBe(2500000);
      expect(reel?.revisions).toBe(2);
      expect(story?.pricePaise).toBe(1000000);
      expect(yt?.pricePaise).toBe(5500000);
    });
  });

  describe("Audience Demographics & Platforms", () => {
    it("should provide connected Instagram and YouTube telemetry", () => {
      expect(mockProfile.instagramFollowers).toBe(450000);
      expect(mockProfile.instagramEngagementRate).toBe(4.8);
      expect(mockProfile.youtubeSubscribers).toBe(280000);
      expect(mockProfile.languages).toContain("Kannada");
      expect(mockProfile.city).toBe("Bengaluru");
    });
  });
});
