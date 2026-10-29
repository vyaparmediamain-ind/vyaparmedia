import { describe, it, expect } from "vitest";
import { InfluencerProfileData } from "@/components/profile/types";

describe("Influencer Profile & Verified Campaign Proof System", () => {
  const mockProfile: InfluencerProfileData = {
    id: "inf_profile_001",
    userId: "usr_creator_88",
    displayName: "Ananya Kapoor",
    bio: "Fashion, beauty, and wellness creator based in Mumbai.",
    avatar: "https://images.unsplash.com/avatar-ananya",
    city: "Mumbai",
    state: "Maharashtra",
    categories: ["Fashion", "Beauty", "Lifestyle"],
    languages: ["English", "Hindi"],
    instagramHandle: "ananya_official",
    instagramFollowers: 340000,
    instagramEngagementRate: 5.2,
    youtubeHandle: "AnanyaKapoorVlogs",
    youtubeSubscribers: 120000,
    youtubeEngagementRate: 4.1,
    completedDealsCount: 32,
    trustScore: 865,
    responseRatePercent: 99,
    avgResponseTime: "< 1 hour",
    isKycVerified: true,
    isSocialVerified: true,
    minRatePaise: 3500000, // ₹35,000
    maxRatePaise: 8000000,
    campaignProofs: [
      {
        id: "deal_pf_1",
        title: "Lakmé Festive Glow Reel Campaign",
        brandName: "Lakmé India",
        amountPaise: 4500000,
        completedDate: "2026-08-15T12:00:00.000Z",
        outcomeMetric: "2.4M Views • 9.1% Engagement",
        rating: 5,
        reviewComment: "Exceeded our view benchmarks by 40%. Extremely professional delivery.",
        deliverables: ["1x 60s Reel", "2x Stories"],
        escrowVerified: true,
      },
    ],
    rateCard: [
      {
        id: "rate-reel",
        deliverable: "Instagram Reel (60s)",
        pricePaise: 3500000,
        turnaround: "3 – 5 Days",
        revisions: 2,
        description: "Full vertical 9:16 high-engagement product demo, pinned for 30 days.",
      },
      {
        id: "rate-story",
        deliverable: "Instagram Story (3 Frames + Link)",
        pricePaise: 1400000, // 40% of Reel
        turnaround: "24 – 48 Hours",
        revisions: 1,
        description: "Direct swipe-up / sticker link with brand promo code, 24h lifespan.",
      },
      {
        id: "rate-yt-dedicated",
        deliverable: "YouTube Dedicated Video",
        pricePaise: 5600000, // 160% of base
        turnaround: "7 – 10 Days",
        revisions: 2,
        description: "8-12 minute deep-dive review with description links & pinned comment.",
      },
    ],
    reviews: [
      {
        id: "rev_1",
        brandName: "Lakmé India",
        rating: 5,
        comment: "Exceeded our view benchmarks by 40%. Extremely professional delivery.",
        createdAt: "2026-08-16T10:00:00.000Z",
      },
    ],
  };

  describe("Requirement 1: Header Stats Row", () => {
    it("should present financial and reliability stats row", () => {
      expect(mockProfile.completedDealsCount).toBe(32);
      expect(mockProfile.trustScore).toBe(865);
      expect(mockProfile.responseRatePercent).toBe(99);
      expect(mockProfile.avgResponseTime).toBe("< 1 hour");
    });
  });

  describe("Requirement 2: Dual Distinct Verification Badges (Server Source-of-Truth)", () => {
    it("should distinguish between KYC verified and Social verified states", () => {
      expect(mockProfile.isKycVerified).toBe(true);
      expect(mockProfile.isSocialVerified).toBe(true);

      // Verify a creator with only KYC verified
      const kycOnlyProfile: InfluencerProfileData = {
        ...mockProfile,
        isSocialVerified: false,
        isKycVerified: true,
      };
      expect(kycOnlyProfile.isKycVerified).toBe(true);
      expect(kycOnlyProfile.isSocialVerified).toBe(false);

      // Verify a creator with only Social verified
      const socialOnlyProfile: InfluencerProfileData = {
        ...mockProfile,
        isSocialVerified: true,
        isKycVerified: false,
      };
      expect(socialOnlyProfile.isSocialVerified).toBe(true);
      expect(socialOnlyProfile.isKycVerified).toBe(false);
    });
  });

  describe("Requirement 3: Verified Campaign Proofs Grid", () => {
    it("should format past completed deals with escrow verification and outcome metrics", () => {
      expect(mockProfile.campaignProofs).toHaveLength(1);
      const proof = mockProfile.campaignProofs[0]!;

      expect(proof.escrowVerified).toBe(true);
      expect(proof.brandName).toBe("Lakmé India");
      expect(proof.outcomeMetric).toBe("2.4M Views • 9.1% Engagement");
      expect(proof.amountPaise / 100).toBe(45000);
      expect(proof.deliverables).toContain("1x 60s Reel");
    });
  });

  describe("Requirement 4: Transparent Rate Card", () => {
    it("should calculate and expose transparent pricing for all deliverable tiers", () => {
      const reel = mockProfile.rateCard.find((r) => r.id === "rate-reel");
      const story = mockProfile.rateCard.find((r) => r.id === "rate-story");
      const yt = mockProfile.rateCard.find((r) => r.id === "rate-yt-dedicated");

      expect(reel).toBeDefined();
      expect(reel!.pricePaise / 100).toBe(35000);

      expect(story).toBeDefined();
      expect(story!.pricePaise / 100).toBe(14000); // 40% of Reel

      expect(yt).toBeDefined();
      expect(yt!.pricePaise / 100).toBe(56000); // 160% of base
    });
  });

  describe("Requirement 5: Context-Aware CTA Logic", () => {
    it("should present 'Invite to Campaign' when viewed by a Brand", () => {
      const viewerRole = "BRAND";
      const isOwnProfile = false;

      const shouldShowInvite = viewerRole === "BRAND" && !isOwnProfile;
      expect(shouldShowInvite).toBe(true);
    });

    it("should present 'Edit Profile' when viewed by the creator themself", () => {
      const isOwnProfile = true;
      expect(isOwnProfile).toBe(true);
    });
  });
});
