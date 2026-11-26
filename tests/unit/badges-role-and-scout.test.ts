import { describe, it, expect } from "vitest";
import { BADGES, getBadgesForRole } from "@/lib/badges";

describe("Role-Based Badges Filtering & Scout Restriction", () => {
  it("filters badges for BRAND role correctly", () => {
    const brandBadges = getBadgesForRole("BRAND");

    // All brand badges should have role BRAND or ALL
    expect(brandBadges.length).toBeGreaterThan(0);
    brandBadges.forEach((b) => {
      expect(["BRAND", "ALL"]).toContain(b.role);
    });

    // Should include brand-specific badges
    const badgeIds = brandBadges.map((b) => b.id);
    expect(badgeIds).toContain("first_campaign");
    expect(badgeIds).toContain("campaign_master");
    expect(badgeIds).toContain("fast_approver");
    expect(badgeIds).toContain("roi_master");

    // Should include shared badges
    expect(badgeIds).toContain("verified_identity");
    expect(badgeIds).toContain("profile_complete");
    expect(badgeIds).toContain("first_5_star");
    expect(badgeIds).toContain("first_referral");

    // MUST NOT include influencer-only badges
    expect(badgeIds).not.toContain("verified_pro"); // "Pro Influencer"
    expect(badgeIds).not.toContain("first_deal");
    expect(badgeIds).not.toContain("five_deals");
    expect(badgeIds).not.toContain("earn_1lakh");
    expect(badgeIds).not.toContain("speed_demon");
    expect(badgeIds).not.toContain("no_revisions");
    expect(badgeIds).not.toContain("creative_genius");
    expect(badgeIds).not.toContain("night_owl");
  });

  it("filters badges for INFLUENCER role correctly", () => {
    const influencerBadges = getBadgesForRole("INFLUENCER");

    // All influencer badges should have role INFLUENCER or ALL
    expect(influencerBadges.length).toBeGreaterThan(0);
    influencerBadges.forEach((b) => {
      expect(["INFLUENCER", "ALL"]).toContain(b.role);
    });

    // Should include influencer-specific badges
    const badgeIds = influencerBadges.map((b) => b.id);
    expect(badgeIds).toContain("verified_pro");
    expect(badgeIds).toContain("first_deal");
    expect(badgeIds).toContain("ten_deals");
    expect(badgeIds).toContain("earn_50k");
    expect(badgeIds).toContain("earn_1lakh");
    expect(badgeIds).toContain("speed_demon");

    // Should include shared badges
    expect(badgeIds).toContain("verified_identity");
    expect(badgeIds).toContain("profile_complete");
    expect(badgeIds).toContain("first_5_star");

    // MUST NOT include brand-only badges
    expect(badgeIds).not.toContain("first_campaign");
    expect(badgeIds).not.toContain("campaign_master");
    expect(badgeIds).not.toContain("fast_approver");
    expect(badgeIds).not.toContain("roi_master");
    expect(badgeIds).not.toContain("partnership_pro");
    expect(badgeIds).not.toContain("big_spender");
    expect(badgeIds).not.toContain("mega_campaign");
    expect(badgeIds).not.toContain("fair_payer");
  });

  it("returns empty badge list for SCOUT role", () => {
    const scoutBadges = getBadgesForRole("SCOUT");
    expect(scoutBadges).toEqual([]);
  });

  it("returns all badges for ADMIN role", () => {
    const adminBadges = getBadgesForRole("ADMIN");
    expect(adminBadges.length).toBe(BADGES.length);
  });
});
