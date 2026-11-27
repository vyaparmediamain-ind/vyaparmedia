import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks
vi.mock("@/lib/db", () => {
  const mockPrisma = {
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    brandProfile: { findUnique: vi.fn() },
    influencerProfile: { findUnique: vi.fn() },
    verificationDocument: { findMany: vi.fn() },
    application: { count: vi.fn() },
    deal: { count: vi.fn() },
    userViolation: { findFirst: vi.fn(), create: vi.fn() },
    refreshToken: {
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => cb(mockPrisma)),
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

vi.mock("@/services/notification.service", () => ({
  NotificationService: {
    createNotifications: vi.fn().mockResolvedValue(true),
  },
}));

// Imports
import prisma from "@/lib/db";
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getPermissions,
  isAdmin,
  isBrand,
  isInfluencer,
  isScout,
  type Permission,
} from "@/lib/rbac";
import { stripHtml, sanitizeHtml } from "@/lib/sanitize";
import {
  checkEnterpriseApplicationGate,
  getWithdrawalSpeed,
  isEligibleForReferralEarnings,
} from "@/lib/enterprise-trust-guard";
import {
  TIER_LIMITS,
  checkVerificationTierForAmount,
  tierErrorResponse,
  getTierDescription,
} from "@/lib/verification-tiers";
import { generateRefreshToken, rotateRefreshToken } from "@/lib/tokens";

describe("Security and Trust Coverage Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. RBAC Tests
  // =========================================================================
  describe("rbac.ts", () => {
    it("verifies role helper predicates", () => {
      expect(isAdmin("ADMIN")).toBe(true);
      expect(isAdmin("BRAND")).toBe(false);

      expect(isBrand("BRAND")).toBe(true);
      expect(isBrand("INFLUENCER")).toBe(false);

      expect(isInfluencer("INFLUENCER")).toBe(true);
      expect(isInfluencer("ADMIN")).toBe(false);

      expect(isScout("SCOUT")).toBe(true);
      expect(isScout("BRAND")).toBe(false);

      expect(isAdmin(null)).toBe(false);
      expect(isBrand(undefined)).toBe(false);
    });

    const testMatrix: { role: string; allowed: Permission[]; denied: Permission[] }[] = [
      {
        role: "ADMIN",
        allowed: ["VIEW_DASHBOARD", "MANAGE_USERS", "SYSTEM_ADMIN", "APPROVE_KYC", "RESOLVE_DISPUTE"],
        denied: ["CREATE_CAMPAIGN" as Permission, "SUBMIT_CONTENT" as Permission],
      },
      {
        role: "BRAND",
        allowed: ["CREATE_CAMPAIGN", "VIEW_CAMPAIGNS", "MANAGE_DEALS", "REVIEW_CONTENT"],
        denied: ["SYSTEM_ADMIN", "SUBMIT_CONTENT", "APPROVE_KYC"],
      },
      {
        role: "INFLUENCER",
        allowed: ["APPLY_CAMPAIGN", "SUBMIT_CONTENT", "WITHDRAW_FUNDS", "SUBMIT_VERIFICATION"],
        denied: ["CREATE_CAMPAIGN", "MANAGE_USERS", "SYSTEM_ADMIN", "APPROVE_KYC"],
      },
      {
        role: "SCOUT",
        allowed: ["VIEW_DASHBOARD", "VIEW_OWN_FINANCE", "WITHDRAW_FUNDS"],
        denied: ["CREATE_CAMPAIGN", "APPLY_CAMPAIGN", "MANAGE_USERS"],
      },
    ];

    for (const { role, allowed, denied } of testMatrix) {
      it(`enforces permission matrix for role ${role}`, () => {
        for (const perm of allowed) {
          expect(hasPermission(role, perm)).toBe(true);
        }
        for (const perm of denied) {
          expect(hasPermission(role, perm)).toBe(false);
        }
      });
    }

    it("hasAnyPermission and hasAllPermissions evaluate combinations", () => {
      expect(hasAnyPermission("BRAND", ["CREATE_CAMPAIGN", "SYSTEM_ADMIN"])).toBe(true);
      expect(hasAnyPermission("BRAND", ["SYSTEM_ADMIN", "APPROVE_KYC"])).toBe(false);

      expect(hasAllPermissions("BRAND", ["CREATE_CAMPAIGN", "VIEW_CAMPAIGNS"])).toBe(true);
      expect(hasAllPermissions("BRAND", ["CREATE_CAMPAIGN", "SYSTEM_ADMIN"])).toBe(false);

      expect(hasAnyPermission(null, ["VIEW_DASHBOARD"])).toBe(false);
      expect(hasAllPermissions(null, ["VIEW_DASHBOARD"])).toBe(false);
    });

    it("getPermissions returns empty array for null/unknown roles", () => {
      expect(getPermissions(null)).toEqual([]);
      expect(getPermissions("UNKNOWN_ROLE")).toEqual([]);
      expect(getPermissions("ADMIN").length).toBeGreaterThan(15);
    });
  });

  // =========================================================================
  // 2. Input Sanitization Tests
  // =========================================================================
  describe("sanitize.ts", () => {
    it("stripHtml removes standard tags and script blocks with content", () => {
      const input = "<h1>Title</h1><p>Hello <script>alert('xss')</script>World</p>";
      expect(stripHtml(input)).toBe("TitleHello World");
    });

    it("stripHtml defends against nested tag evasion", () => {
      const input = "<scr<script>ipt>alert(1)</script>";
      expect(stripHtml(input)).not.toContain("<script>");
      expect(stripHtml(input)).not.toContain("alert(1)");
    });

    it("stripHtml strips dangerous protocols and obfuscation", () => {
      expect(stripHtml("javascript:alert(1)")).toContain("[removed]");
      expect(stripHtml("vbscript:msgbox(1)")).toContain("[removed]");
      expect(stripHtml("j a v a s c r i p t :alert(1)")).toContain("[removed]");
      expect(stripHtml("data:text/html,<script>")).toContain("[removed]");
    });

    it("stripHtml strips CSS expressions and inline event handlers", () => {
      const input = '<div onclick="alert(1)" style="width: expression(alert(1))">Test</div>';
      const result = stripHtml(input);
      expect(result).not.toContain("onclick");
      expect(result).toContain("Test");
    });

    it("stripHtml handles null bytes and non-string inputs", () => {
      expect(stripHtml("Hello\0World")).toBe("HelloWorld");
      expect(stripHtml(null as any)).toBe("");
      expect(stripHtml(undefined as any)).toBe("");
    });

    it("sanitizeHtml preserves safe formatting while stripping dangerous scripts", () => {
      const dirty = '<p>Safe <strong>bold</strong> <script>alert(1)</script><a href="https://example.com" onclick="steal()">Link</a></p>';
      const clean = sanitizeHtml(dirty);
      expect(clean).toContain("<p>");
      expect(clean).toContain("<strong>bold</strong>");
      expect(clean).toContain('href="https://example.com" target="_blank" rel="noopener noreferrer"');
      expect(clean).not.toContain("<script>");
      expect(clean).not.toContain("onclick");
    });

    it("sanitizeHtml removes dangerous javascript href in anchor tags", () => {
      const dirty = '<a href="javascript:alert(1)">Click Me</a>';
      const clean = sanitizeHtml(dirty);
      expect(clean).not.toContain("javascript:");
      expect(clean).toBe("<a>Click Me</a>");
    });
  });

  // =========================================================================
  // 3. Enterprise Trust Guard Tests
  // =========================================================================
  describe("enterprise-trust-guard.ts", () => {
    it("returns user not found when userId is invalid", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
      const res = await checkEnterpriseApplicationGate("missing-user", 1000);
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe("User not found");
    });

    it("enforces 3 applications per day limit for new accounts (< 30 days old)", async () => {
      const newAccountDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 days old
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        createdAt: newAccountDate,
        trustScore: 700,
        influencerProfile: { id: "inf-new", completedDeals: 0 },
      } as any);

      vi.mocked(prisma.application.count).mockResolvedValueOnce(3); // Already 3 today

      const res = await checkEnterpriseApplicationGate("new-user-1", 100000);
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain("limited to 3 applications per day");
    });

    it("enforces 5,000 INR (500,000 paise) cap for first deal of new accounts", async () => {
      const newAccountDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        createdAt: newAccountDate,
        trustScore: 700,
        influencerProfile: { id: "inf-new", completedDeals: 0 },
      } as any);

      vi.mocked(prisma.application.count).mockResolvedValueOnce(1); // 1 today

      // Proposing 6,000 INR = 600,000 paise
      const res = await checkEnterpriseApplicationGate("new-user-1", 600000);
      expect(res.allowed).toBe(false);
      expect(res.maxAmountCap).toBe(500000);
      expect(res.reason).toContain("maximum allowed request is 5,000");
    });

    it("triggers velocity violation and warning record if deal count > 10 and trustScore < 750", async () => {
      const matureDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days old
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        createdAt: matureDate,
        trustScore: 650, // Low trust (< 750)
        influencerProfile: { id: "inf-fast", completedDeals: 15 },
      } as any);

      vi.mocked(prisma.deal.count).mockResolvedValueOnce(12); // 12 deals this week
      vi.mocked(prisma.userViolation.findFirst).mockResolvedValueOnce(null); // No alert today yet
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([{ id: "admin-1" }] as any);

      const res = await checkEnterpriseApplicationGate("inf-fast", 100000);
      expect(res.allowed).toBe(true);
      expect(prisma.userViolation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "inf-fast",
          type: "SPAM",
          action: "WARNING",
        }),
      });
    });

    it("calculates withdrawal speed tiers correctly", () => {
      expect(getWithdrawalSpeed(900)).toBe("INSTANT");
      expect(getWithdrawalSpeed(850)).toBe("INSTANT");
      expect(getWithdrawalSpeed(800)).toBe("24_HOURS");
      expect(getWithdrawalSpeed(750)).toBe("24_HOURS");
      expect(getWithdrawalSpeed(650)).toBe("72_HOURS");
      expect(getWithdrawalSpeed(600)).toBe("72_HOURS");
      expect(getWithdrawalSpeed(550)).toBe("MANUAL_REVIEW");
    });

    it("verifies referral earnings eligibility", () => {
      expect(isEligibleForReferralEarnings(600)).toBe(true);
      expect(isEligibleForReferralEarnings(750)).toBe(true);
      expect(isEligibleForReferralEarnings(599)).toBe(false);
    });
  });

  // =========================================================================
  // 4. Verification Tiers Tests
  // =========================================================================
  describe("verification-tiers.ts", () => {
    it("defines standard tier limits in paise", () => {
      expect(TIER_LIMITS.TIER_1_MAX_MONTHLY).toBe(5_000_000);
      expect(TIER_LIMITS.TIER_2_MAX_MONTHLY).toBe(10_000_000);
      expect(TIER_LIMITS.TIER_3_MAX_MONTHLY).toBe(Infinity);
    });

    it("blocks unverified users at Tier 0 when phone or email is not verified", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        emailVerified: null,
        phoneVerified: false,
      } as any);

      const res = await checkVerificationTierForAmount("u-unverified", "INFLUENCER", 100000);
      expect(res.allowed).toBe(false);
      expect(res.tier).toBe(0);
      expect(res.reason).toContain("Please verify your email address");
    });

    it("formats tier error response correctly", () => {
      const err = tierErrorResponse({
        allowed: false,
        tier: 1,
        monthlyUsed: 4_500_000,
        monthlyLimit: 5_000_000,
        reason: "Tier limit exceeded",
        requiredDocs: ["PAN_CARD", "BANK_STATEMENT"],
      });
      expect(err.code).toBe("VERIFICATION_REQUIRED");
      expect(err.tier).toBe(1);
      expect(err.requiredDocs).toContain("PAN_CARD");
      expect(err.upgradeUrl).toContain("verification");
    });

    it("returns correct tier description for Influencers, Brands, and Scouts", () => {
      expect(getTierDescription(1, "INFLUENCER")).toContain("Basic");
      expect(getTierDescription(2, "INFLUENCER")).toContain("Standard — Unlimited");
      expect(getTierDescription(1, "SCOUT")).toContain("Basic Onboarding");
      expect(getTierDescription(2, "SCOUT")).toContain("Campus Partner — Full royalty withdrawal");
      expect(getTierDescription(2, "BRAND")).toContain("Standard — Up to ₹1,00,000");
      expect(getTierDescription(3, "BRAND")).toContain("Premium — Unlimited");
      expect(getTierDescription(0, "BRAND")).toContain("Unverified");
    });
  });

  // =========================================================================
  // 5. Refresh Tokens & Rotation Tests
  // =========================================================================
  describe("tokens.ts", () => {
    it("generates refresh token revoking existing tokens first", async () => {
      vi.mocked(prisma.refreshToken.create).mockResolvedValueOnce({
        id: "tok-1",
        token: "random-token-hex",
        userId: "user-1",
        expiresAt: new Date(),
        revoked: false,
      } as any);

      const res = await generateRefreshToken("user-1");
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: "user-1", revoked: false },
        data: { revoked: true },
      });
      expect(res.id).toBe("tok-1");
    });

    it("rotateRefreshToken detects token theft when revoked token is reused", async () => {
      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValueOnce({
        id: "compromised-tok",
        token: "old-stolen-token",
        userId: "victim-user",
        revoked: true,
        replacedByToken: null,
      } as any);

      const res = await rotateRefreshToken("old-stolen-token");
      expect(res).toBeNull();
      // Entire family revoked
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: "victim-user" },
        data: { revoked: true },
      });
    });

    it("rotateRefreshToken permits race condition grace period for replacedByToken", async () => {
      const recentDate = new Date(Date.now() - 2000); // 2 seconds ago (< 10s)
      vi.mocked(prisma.refreshToken.findUnique)
        .mockResolvedValueOnce({
          id: "old-tok",
          token: "racing-token",
          userId: "race-user",
          revoked: true,
          replacedByToken: "new-valid-token",
        } as any)
        .mockResolvedValueOnce({
          id: "new-tok-id",
          token: "new-valid-token",
          createdAt: recentDate,
        } as any);

      const res = await rotateRefreshToken("racing-token");
      expect(res).toBeDefined();
      expect(res?.token).toBe("new-valid-token");
    });

    it("rotateRefreshToken returns null for non-existent token", async () => {
      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValueOnce(null);
      const res = await rotateRefreshToken("non-existent");
      expect(res).toBeNull();
    });
  });
});
