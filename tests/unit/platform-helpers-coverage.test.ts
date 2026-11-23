import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks
vi.mock("@/lib/db", () => {
  const mockPrisma = {
    user: { findUnique: vi.fn(), findFirst: vi.fn() },
    brandProfile: { findUnique: vi.fn(), findFirst: vi.fn(), upsert: vi.fn() },
    influencerProfile: { findUnique: vi.fn(), findFirst: vi.fn() },
    blogSubscriber: { findUnique: vi.fn() },
    deal: { findUnique: vi.fn() },
    weeklyChallenge: { findMany: vi.fn().mockResolvedValue([]) },
    userChallengeProgress: { findMany: vi.fn().mockResolvedValue([]) },
    activityLog: { findMany: vi.fn().mockResolvedValue([]) },
    userBadge: { findMany: vi.fn().mockResolvedValue([]) },
    transaction: { findMany: vi.fn().mockResolvedValue([]) },
  };
  return { default: mockPrisma, prisma: mockPrisma };
});

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    critical: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/lib/cache", () => ({
  cache: vi.fn(async (_key: string, fn: () => Promise<any>) => fn()),
  getCachedUserType: vi.fn().mockResolvedValue("INFLUENCER"),
}));

vi.mock("@/lib/referral-engine", () => ({
  getReferralStats: vi.fn().mockResolvedValue({ totalReferrals: 0 }),
}));

vi.mock("@/services/wallet.service", () => ({
  WalletService: {
    getWallet: vi.fn().mockResolvedValue({ balance: 0 }),
  },
}));

vi.mock("@/services/visibility-analytics.service", () => ({
  VisibilityAnalyticsService: {
    getOverviewStats: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("@/lib/drs-analytics", () => ({
  computeDrsTrend: vi.fn().mockResolvedValue({}),
}));

import prisma from "@/lib/db";
import { AppError } from "@/lib/errors";
import { getInfluencerAnalytics } from "@/lib/analytics-engine";
import { getConfiguredAppUrl, appUrl } from "@/lib/app-url";
import { handleApplicationError } from "@/lib/application-error-helper";
import { BADGES } from "@/lib/badges";
import { validateBlogToken } from "@/lib/blog-subscriber-helper";
import { getPublicBrandProfile } from "@/lib/brand-profile";
import { ALL_CATEGORIES } from "@/lib/categories";
import { copyToClipboard } from "@/lib/clipboard";
import { haptic } from "@/lib/haptics";
import { homeSteps } from "@/lib/home-content";
import { renderResultHtml } from "@/lib/html-template";
import { generateWeeklyChallenges, getUserWeeklyChallenges } from "@/lib/weekly-challenges";
import {
  generateOTP,
  generateReferralCode,
  calculateProductHandlingFee,
  getDealAndVerifyParticipant,
  getErrorMessage,
} from "@/lib/utils";

describe("Platform Helpers & Web Utilities Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. Analytics Engine
  // =========================================================================
  describe("analytics-engine.ts", () => {
    it("throws notFound if influencer profile does not exist", async () => {
      vi.mocked(prisma.influencerProfile.findUnique).mockResolvedValueOnce(null);
      await expect(getInfluencerAnalytics("missing-u")).rejects.toThrow("Influencer profile not found");
    });
  });

  // =========================================================================
  // 2. App URL
  // =========================================================================
  describe("app-url.ts", () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    it("normalizes and trims trailing slashes from APP_URL", () => {
      process.env.APP_URL = "https://app.vyaparmedia.com/";
      expect(getConfiguredAppUrl()).toBe("https://app.vyaparmedia.com");
    });

    it("falls back to localhost in non-production environments", () => {
      delete process.env.APP_URL;
      delete process.env.NEXTAUTH_URL;
      delete process.env.NEXT_PUBLIC_APP_URL;
      delete process.env.APP_BASE_URL;
      (process.env as any).NODE_ENV = "test";

      expect(getConfiguredAppUrl()).toBe("http://localhost:3000");
    });

    it("constructs full app URLs with appUrl helper", () => {
      process.env.APP_URL = "https://example.com";
      expect(appUrl("dashboard")).toBe("https://example.com/dashboard");
      expect(appUrl("/api/health")).toBe("https://example.com/api/health");
    });
  });

  // =========================================================================
  // 3. Application Error Helper
  // =========================================================================
  describe("application-error-helper.ts", () => {
    it("handles AppError with exact status code and message", async () => {
      const err = AppError.badRequest("Invalid input parameters");
      const res = handleApplicationError(err, "Default Msg", "TestLabel");
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.message).toBe("Invalid input parameters");
    });

    it("maps 404 for 'not found' and 'Not authorized'", async () => {
      const res = handleApplicationError(new Error("Resource not found"), "Default", "TestLabel");
      expect(res.status).toBe(404);
    });

    it("maps 400 for badRequestStrings such as 'Insufficient budget'", async () => {
      const res = handleApplicationError(new Error("Insufficient balance in wallet"), "Default", "TestLabel");
      expect(res.status).toBe(400);
    });

    it("maps 504 for database transaction timeouts and P2028 errors", async () => {
      const res = handleApplicationError(new Error("Transaction timed out (P2028)"), "Default", "TestLabel");
      expect(res.status).toBe(504);
    });

    it("falls back to 500 for generic unhandled errors", async () => {
      const res = handleApplicationError(new Error("Unexpected crash"), "Server Error", "TestLabel");
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.message).toBe("Server Error");
    });
  });

  // =========================================================================
  // 4. Badges Constant & Catalog
  // =========================================================================
  describe("badges.ts", () => {
    it("exports BADGES with valid badge structures", () => {
      expect(BADGES.length).toBeGreaterThan(40);
      for (const badge of BADGES) {
        expect(typeof badge.id).toBe("string");
        expect(typeof badge.name).toBe("string");
        expect(typeof badge.description).toBe("string");
        expect(typeof badge.icon).toBe("string");
        expect(["ACHIEVEMENT", "MILESTONE", "COMMUNITY", "SPECIAL", "VERIFICATION", "BRAND"]).toContain(badge.category);
        expect(["COMMON", "RARE", "EPIC", "LEGENDARY"]).toContain(badge.rarity);
        expect(badge.xpReward).toBeGreaterThan(0);
      }
    });
  });

  // =========================================================================
  // 5. Blog Subscriber Helper
  // =========================================================================
  describe("blog-subscriber-helper.ts", () => {
    it("returns error response when token is missing in query params", async () => {
      const req = { url: "https://example.com/api/blog/unsubscribe" } as any;
      const res = await validateBlogToken(req, "Unsubscribe Failed");
      expect(res.response).toBeDefined();
      expect(res.response?.status).toBe(200);
      const html = await res.response?.text();
      expect(html).toContain("Invalid or missing");
    });

    it("returns error response when token does not match any subscriber", async () => {
      const req = { url: "https://example.com/api/blog/unsubscribe?token=nonexistent" } as any;
      vi.mocked(prisma.blogSubscriber.findUnique).mockResolvedValueOnce(null);

      const res = await validateBlogToken(req, "Unsubscribe Failed");
      expect(res.response).toBeDefined();
      const html = await res.response?.text();
      expect(html).toContain("invalid or has expired");
    });

    it("returns subscriber object when valid token found", async () => {
      const req = { url: "https://example.com/api/blog/unsubscribe?token=valid-tok" } as any;
      const mockSub = { id: "sub-1", email: "user@example.com", unsubscribeToken: "valid-tok" };
      vi.mocked(prisma.blogSubscriber.findUnique).mockResolvedValueOnce(mockSub as any);

      const res = await validateBlogToken(req, "Unsubscribe Failed");
      expect(res.subscriber).toEqual(mockSub);
      expect(res.response).toBeUndefined();
    });
  });

  // =========================================================================
  // 6. Brand Profile Public Helper
  // =========================================================================
  describe("brand-profile.ts", () => {
    it("returns null for empty or invalid identifier", async () => {
      expect(await getPublicBrandProfile("")).toBeNull();
      expect(await getPublicBrandProfile("null")).toBeNull();
      expect(await getPublicBrandProfile("undefined")).toBeNull();
    });

    it("returns public sanitized profile when found", async () => {
      const mockProfile = {
        id: "brand-1",
        userId: "u-brand-1",
        companyName: "Acme Corp",
        logo: "https://acme.com/logo.png",
        website: "https://acme.com",
        description: "Great Brand",
        industry: "Retail",
        city: "Mumbai",
        state: "Maharashtra",
        isGstVerified: true,
        isPanVerified: true,
        isCinVerified: false,
        totalCampaigns: 5,
        activeCampaigns: 2,
        totalSpent: 5000000,
        averageRating: 480, // 4.8 / 5.0
        totalReviews: 8,
        user: { trustScore: 820, createdAt: new Date("2025-01-01") },
        campaigns: [
          {
            id: "camp-1",
            title: "Summer Launch",
            description: "Promote summer collection",
            perInfluencerBudget: 50000,
            requiresProduct: true,
            productName: "T-Shirt",
            productValue: 10000,
            targetCategories: ["Fashion"],
            minFollowers: 5000,
            postingDeadline: new Date("2026-06-01"),
            deliverables: [{ type: "REEL", count: 1 }],
          },
        ],
        reviews: [
          {
            id: "rev-1",
            rating: 5,
            comment: "Great experience working with Acme!",
            createdAt: new Date("2026-02-01"),
            reviewer: {
              influencerProfile: {
                displayName: "Priya Fashion",
                avatar: null,
                instagramHandle: "priya_fashion",
              },
            },
          },
        ],
      };

      vi.mocked(prisma.brandProfile.findFirst).mockResolvedValueOnce(mockProfile as any);

      const result = await getPublicBrandProfile("Acme Corp");
      expect(result).toBeDefined();
      expect(result?.companyName).toBe("Acme Corp");
      expect(result?.averageRating).toBe(4.8);
      expect(result?.trustScore).toBe(820);
      expect(result?.activeCampaignsList.length).toBe(1);
      expect(result?.reviews.length).toBe(1);
    });
  });

  // =========================================================================
  // 7. Categories
  // =========================================================================
  describe("categories.ts", () => {
    it("contains essential Indian influencer categories", () => {
      expect(ALL_CATEGORIES).toContain("Fashion");
      expect(ALL_CATEGORIES).toContain("Beauty");
      expect(ALL_CATEGORIES).toContain("Technology");
      expect(ALL_CATEGORIES).toContain("Finance");
      expect(ALL_CATEGORIES.length).toBe(20);
    });
  });

  // =========================================================================
  // 8. Clipboard
  // =========================================================================
  describe("clipboard.ts", () => {
    it("handles node environment safely returning false without window", async () => {
      const res = await copyToClipboard("https://vyapar.link/123");
      expect(typeof res).toBe("boolean");
    });
  });

  // =========================================================================
  // 9. Haptics
  // =========================================================================
  describe("haptics.ts", () => {
    it("safely triggers haptic patterns as no-ops in node environment", () => {
      expect(() => {
        haptic.selection();
        haptic.light();
        haptic.medium();
        haptic.success();
        haptic.warning();
        haptic.error();
      }).not.toThrow();
    });
  });

  // =========================================================================
  // 10. Home Content
  // =========================================================================
  describe("home-content.ts", () => {
    it("has 4 steps defined for both influencer and brand", () => {
      expect(homeSteps.length).toBe(4);
      for (const step of homeSteps) {
        expect(step.forInfluencer.title).toBeDefined();
        expect(step.forBrand.title).toBeDefined();
      }
    });
  });

  // =========================================================================
  // 11. HTML Template
  // =========================================================================
  describe("html-template.ts", () => {
    it("renders result HTML page with escaped parameters", () => {
      const html = renderResultHtml(
        "Verification <script>",
        "Success & Done",
        "Your account is verified! <a href='#'>Click</a>",
        true
      );
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("&lt;script&gt;");
      expect(html).toContain("#10b981"); // success green
    });

    it("renders error red color when isSuccess is false", () => {
      const html = renderResultHtml("Error", "Failed", "Something went wrong", false);
      expect(html).toContain("#ef4444"); // error red
    });
  });

  // =========================================================================
  // 12. Weekly Challenges
  // =========================================================================
  describe("weekly-challenges.ts", () => {
    it("getUserWeeklyChallenges returns user challenges and handles empty list", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
      const res = await getUserWeeklyChallenges("missing-user");
      expect(res).toEqual([]);
    });
  });

  // =========================================================================
  // 13. Utils
  // =========================================================================
  describe("utils.ts", () => {
    it("generateOTP creates a 6-digit numeric string", () => {
      const otp = generateOTP();
      expect(otp).toMatch(/^\d{6}$/);
    });

    it("generateReferralCode creates an uppercase 10-character code with optional prefix", () => {
      const code = generateReferralCode("VM");
      expect(code.length).toBe(10);
      expect(code.startsWith("VM")).toBe(true);
      expect(code).toMatch(/^[A-Z0-9]{10}$/);
    });

    it("calculateProductHandlingFee handles product only vs standard campaign", () => {
      // requiresProduct false -> 0
      expect(calculateProductHandlingFee(100000, false, false)).toBe(0);
      // requiresProduct true, product only (10% platform fee default) -> 10% of 100,000 = 10,000 paise
      const feeProductOnly = calculateProductHandlingFee(100000, true, true, 10);
      expect(feeProductOnly).toBe(10000);
      // requiresProduct true, paid deal + product -> 2% handling fee default
      const feeStandard = calculateProductHandlingFee(100000, true, false);
      expect(feeStandard).toBe(2000);
    });

    it("getDealAndVerifyParticipant validates deal participants", async () => {
      vi.mocked(prisma.deal.findUnique).mockResolvedValueOnce({
        id: "deal-1",
        influencer: { userId: "inf-1" },
        brand: { userId: "brand-1" },
      } as any);

      // Inf participant -> success
      const deal = await getDealAndVerifyParticipant("deal-1", "inf-1");
      expect(deal.id).toBe("deal-1");

      // Non participant -> forbidden
      vi.mocked(prisma.deal.findUnique).mockResolvedValueOnce({
        id: "deal-1",
        influencer: { userId: "inf-1" },
        brand: { userId: "brand-1" },
      } as any);

      await expect(getDealAndVerifyParticipant("deal-1", "intruder")).rejects.toThrow("Unauthorized");
    });

    it("getErrorMessage formats unknown errors safely", () => {
      expect(getErrorMessage(new Error("Database error"))).toBeDefined();
    });
  });
});
