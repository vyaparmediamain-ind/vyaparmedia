import { describe, it, expect } from "vitest";
import { FAQ_DATA, filterFaqs, type FaqCategory } from "@/components/help/HelpCenterClient";
import { formatCreatorProfileData } from "@/lib/creator-profile";

describe("Missing Pages Flow & Business Invariants", () => {
  describe("1. FAQ / Help Center (/help) Categorization & Search", () => {
    it("should contain FAQ entries for all 4 required operational categories", () => {
      const categories: FaqCategory[] = [
        "GETTING_STARTED",
        "PAYMENTS_ESCROW",
        "DISPUTES_REVISIONS",
        "KYC_SECURITY",
      ];

      categories.forEach((cat) => {
        const matching = FAQ_DATA.filter((item) => item.category === cat);
        expect(matching.length).toBeGreaterThanOrEqual(2);
      });
    });

    it("should filter items correctly when category tab is selected", () => {
      const escrowFaqs = filterFaqs(FAQ_DATA, "PAYMENTS_ESCROW", "");
      expect(escrowFaqs.length).toBeGreaterThanOrEqual(3);
      expect(escrowFaqs.every((f) => f.category === "PAYMENTS_ESCROW")).toBe(true);

      const allFaqs = filterFaqs(FAQ_DATA, "ALL", "");
      expect(allFaqs.length).toBe(FAQ_DATA.length);
    });

    it("should perform case-insensitive keyword search across question and answer", () => {
      const resultsByKeyword = filterFaqs(FAQ_DATA, "ALL", "arbitration");
      expect(resultsByKeyword.length).toBeGreaterThanOrEqual(1);
      const firstResult = resultsByKeyword[0]!;
      expect(firstResult.question.toLowerCase() + firstResult.answer.toLowerCase()).toContain("arbitration");

      const emptyResults = filterFaqs(FAQ_DATA, "ALL", "nonexistent_term_xyz_123");
      expect(emptyResults).toHaveLength(0);
    });

    it("should include dispute and escrow guarantees in help center dataset", () => {
      const disputeFaq = FAQ_DATA.find((f) => f.id === "dr-3");
      expect(disputeFaq).toBeDefined();
      expect(disputeFaq?.answer).toContain("48-hour mutual resolution");
      expect(disputeFaq?.answer).toContain("binding settlement");
    });
  });

  describe("2. Public Creator Profile (/creator/[username]) Security & Sanitization", () => {
    it("should strictly redact sensitive PII (email, phone, PAN, GST, bank details) from public profile", () => {
      const rawMockInfluencer = {
        id: "inf_999",
        userId: "usr_999",
        displayName: "Aarav Sharma",
        bio: "Tech & Lifestyle Creator in Bengaluru",
        city: "Bengaluru",
        state: "Karnataka",
        categories: "Technology, Lifestyle",
        languages: "English, Hindi",
        instagramHandle: "aaravtech",
        youtubeHandle: "aaravtech_in",
        minRate: 1500000,
        completedDeals: 28,
        rating: 4.95,
        email: "aarav.personal@gmail.com",
        phoneNumber: "+919876543210",
        panNumber: "ABCDE1234F",
        gstNumber: "29ABCDE1234F1Z5",
        bankAccountNumber: "987654321098",
        user: {
          trustScore: 840,
        },
      };

      const formatted = formatCreatorProfileData(rawMockInfluencer as never);

      // Verify sensitive PII is absent
      expect((formatted as unknown as Record<string, unknown>).email).toBeUndefined();
      expect((formatted as unknown as Record<string, unknown>).phoneNumber).toBeUndefined();
      expect((formatted as unknown as Record<string, unknown>).panNumber).toBeUndefined();
      expect((formatted as unknown as Record<string, unknown>).gstNumber).toBeUndefined();
      expect((formatted as unknown as Record<string, unknown>).bankAccountNumber).toBeUndefined();

      // Verify public-facing fields are preserved
      expect(formatted.displayName).toBe("Aarav Sharma");
      expect(formatted.city).toBe("Bengaluru");
      expect(formatted.instagramHandle).toBe("aaravtech");
      expect(formatted.trustScore).toBe(840);
      expect(formatted.rateCard.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("3. Onboarding Wizard & Guard Business Logic", () => {
    function isOnboardingComplete(user: {
      userType: "INFLUENCER" | "BRAND";
      influencerProfile?: { city?: string | null; categories?: string | null } | null;
      brandProfile?: { companyName?: string | null; city?: string | null } | null;
    }): boolean {
      if (user.userType === "INFLUENCER") {
        return Boolean(
          user.influencerProfile?.city &&
          user.influencerProfile?.categories &&
          user.influencerProfile?.categories !== "General"
        );
      }
      return Boolean(user.brandProfile?.companyName && user.brandProfile?.city);
    }

    it("should identify newly registered influencer with default values as incomplete", () => {
      const freshUser = {
        userType: "INFLUENCER" as const,
        influencerProfile: {
          city: "",
          categories: "General",
        },
      };

      expect(isOnboardingComplete(freshUser)).toBe(false);
    });

    it("should identify influencer who completed onboarding as complete", () => {
      const completedInfluencer = {
        userType: "INFLUENCER" as const,
        influencerProfile: {
          city: "Mumbai",
          categories: "Fashion, Lifestyle",
        },
      };

      expect(isOnboardingComplete(completedInfluencer)).toBe(true);
    });

    it("should identify newly registered brand without company name or city as incomplete", () => {
      const freshBrand = {
        userType: "BRAND" as const,
        brandProfile: {
          companyName: "",
          city: "",
        },
      };

      expect(isOnboardingComplete(freshBrand)).toBe(false);
    });

    it("should identify brand with company name and city as complete", () => {
      const completedBrand = {
        userType: "BRAND" as const,
        brandProfile: {
          companyName: "Acme D2C Ltd",
          city: "New Delhi",
        },
      };

      expect(isOnboardingComplete(completedBrand)).toBe(true);
    });
  });
});
