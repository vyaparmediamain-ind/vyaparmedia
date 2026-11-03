import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateAscidisclosure } from "@/lib/contract-engine";
import { runVerificationRules } from "@/lib/fraud-detection/social";
import { crawlInstagramPublicPost, crawlYouTubePublicPost } from "@/lib/fraud-detection/public-post-crawler";
import { VerifiedPostData, PostVerificationParams, FraudFlag } from "@/lib/fraud-detection/types";

describe("ASCI & CCPA 2024 Advertising Compliance Suite", () => {
  describe("Option 2: ASCI 2024 Prominence & Position Parser", () => {
    it("approves compliant post with #ad above the fold (within first 150 chars)", () => {
      const caption =
        "Check out this awesome new moisturiser from @biotique! #ad #collab Best for dry winter skin. Get 20% off with my code.";
      const result = validateAscidisclosure(caption);

      expect(result.isCompliant).toBe(true);
      expect(result.prominenceCompliant).toBe(true);
      expect(result.matchedTags).toContain("#ad");
      expect(result.detectionMethod).toBe("CAPTION_ABOVE_FOLD");
    });

    it("approves post with native Paid Partnership label even without caption tags", () => {
      const caption = "My daily morning skincare routine featuring my favourite essentials.";
      const result = validateAscidisclosure(caption, true);

      expect(result.isCompliant).toBe(true);
      expect(result.prominenceCompliant).toBe(true);
      expect(result.detectionMethod).toBe("NATIVE_PAID_PARTNERSHIP");
    });

    it("REJECTS post when #ad is buried below the fold (>150 chars)", () => {
      const caption =
        "Here are my top 10 tips for healthy morning routines! Make sure to drink water, meditate for 15 minutes, go for a run, eat protein rich breakfast, plan your day in advance, avoid screen time, write in your gratitude journal, and take your vitamins! P.S. Big thanks to the brand team for sending this over #ad";

      const result = validateAscidisclosure(caption, false);

      expect(result.isCompliant).toBe(false);
      expect(result.prominenceCompliant).toBe(false);
      expect(result.detectionMethod).toBe("CAPTION_BELOW_FOLD");
      expect(result.missingRequirement).toContain("PROMINENCE_VIOLATION");
    });

    it("REJECTS post when disclosure tag is completely missing", () => {
      const caption = "Loving this gorgeous sunset in Goa with my besties! #travel #goa #vacation";
      const result = validateAscidisclosure(caption, false);

      expect(result.isCompliant).toBe(false);
      expect(result.detectionMethod).toBe("NONE");
      expect(result.missingRequirement).toContain("must include an ASCI/CCPA compliant disclosure tag");
    });

    it("flags prohibited ambiguous abbreviations like #sp, #spon, #pr", () => {
      const caption = "Unboxing this new luxury perfume! #sp #pr Loving the fragrance so far.";
      const result = validateAscidisclosure(caption, false);

      expect(result.isCompliant).toBe(false);
      expect(result.prohibitedTagsDetected).toContain("#sp");
      expect(result.prohibitedTagsDetected).toContain("#pr");
      expect(result.missingRequirement).toContain("Prohibited abbreviation(s) detected");
    });
  });

  describe("Option 1: Pre-Submission Hard Gate (Fraud Detection Integration)", () => {
    it("flags CRITICAL severity and produces high risk score on missing #ad disclosure", () => {
      const flags: FraudFlag[] = [];
      const verifiedPostData: VerifiedPostData = {
        isPublic: true,
        caption: "Non-sponsored looking post with no disclosure tags at all.",
        isPaidPartnership: false,
        hashtags: ["routine", "skincare"],
        mentions: ["brandname"],
        postTimestamp: new Date(),
      };

      const params: PostVerificationParams = {
        dealId: "deal_asci_1",
        influencerUserId: "inf_user_1",
        postUrl: "https://instagram.com/p/test1234",
        requiredTags: ["brandname"],
        requiredHashtags: ["skincare"],
        postingDeadline: new Date(Date.now() + 86400000),
      };

      const riskScore = runVerificationRules(verifiedPostData, params, flags);

      // NO_AD_DISCLOSURE should be CRITICAL and contribute 85 points
      const adFlag = flags.find((f) => f.rule === "NO_AD_DISCLOSURE");
      expect(adFlag).toBeDefined();
      expect(adFlag?.severity).toBe("CRITICAL");
      expect(riskScore).toBeGreaterThanOrEqual(80); // Triggers BLOCK
    });

    it("passes cleanly when #ad is prominently placed above the fold", () => {
      const flags: FraudFlag[] = [];
      const verifiedPostData: VerifiedPostData = {
        isPublic: true,
        caption: "Excited to partner with @brandname! #ad Check out their new line #skincare",
        isPaidPartnership: false,
        hashtags: ["ad", "skincare"],
        mentions: ["brandname"],
        postTimestamp: new Date(),
      };

      const params: PostVerificationParams = {
        dealId: "deal_asci_2",
        influencerUserId: "inf_user_2",
        postUrl: "https://instagram.com/p/test5678",
        requiredTags: ["brandname"],
        requiredHashtags: ["skincare"],
        postingDeadline: new Date(Date.now() + 86400000),
      };

      const riskScore = runVerificationRules(verifiedPostData, params, flags);

      const adFlag = flags.find((f) => f.rule === "NO_AD_DISCLOSURE");
      expect(adFlag).toBeUndefined();
      expect(riskScore).toBe(0);
    });
  });

  describe("Option 3: Public Headless Live Link Crawler Fallback", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("extracts caption, hashtags and mentions via public oEmbed fallback", async () => {
      const mockOembedResponse = {
        title: "#ad Loved testing this new vegan protein shake from @fitlife! #fitness #vegan",
        author_name: "fitness_creator",
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockOembedResponse,
      });

      const result = await crawlInstagramPublicPost("https://www.instagram.com/p/C3XYZ123456/");

      expect(result.status).toBe("FOUND");
      if (result.status === "FOUND") {
        expect(result.data.caption).toContain("#ad");
        expect(result.data.hashtags).toContain("fitness");
        expect(result.data.hashtags).toContain("vegan");
        expect(result.data.mentions).toContain("fitlife");
        expect(result.data.isPaidPartnership).toBe(true);
      }
    });

    it("extracts video caption and tags via YouTube public oEmbed fallback", async () => {
      const mockYtResponse = {
        title: "Ultimate Desk Setup Guide 2026 #ad #collab with @logitech",
        author_name: "TechGuru",
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockYtResponse,
      });

      const result = await crawlYouTubePublicPost("https://www.youtube.com/watch?v=dQw4w9WgXcQ");

      expect(result.status).toBe("FOUND");
      if (result.status === "FOUND") {
        expect(result.data.caption).toContain("#ad");
        expect(result.data.hashtags).toContain("collab");
        expect(result.data.mentions).toContain("logitech");
      }
    });
  });
});
