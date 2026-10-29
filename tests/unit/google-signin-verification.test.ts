import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import prisma from "@/lib/db";
import { handleGoogleOAuthSignIn } from "@/lib/auth/helpers";

vi.mock("@/lib/tokens", () => ({
  generateRefreshToken: vi.fn().mockResolvedValue({ token: "test_refresh_token_xyz" }),
  rotateRefreshToken: vi.fn().mockResolvedValue({ token: "new_refresh_token_xyz" }),
  revokeRefreshToken: vi.fn().mockResolvedValue(true),
}));

describe("O3-T2 / O3-T3 / O3-T4 / O3-T5: Google OAuth Sign-In Verification & Security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const baseUserArg = {
    email: "creator@vyaparmedia.in",
    id: "user_creator_123",
  };

  const baseAccountArg = {
    provider: "google",
    providerAccountId: "google_sub_987654321",
    access_token: "ya29.sample_google_access_token_should_not_be_persisted",
  };

  describe("O3-T2: Email verification matrix", () => {
    it("rejects sign-in when Google profile email_verified is false", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: "user_creator_123",
        email: "creator@vyaparmedia.in",
        status: "ACTIVE",
        emailVerified: true,
        isTwoFactorEnabled: false,
      } as never);

      const result = await handleGoogleOAuthSignIn(
        baseUserArg,
        baseAccountArg,
        { email_verified: false }
      );

      expect(result).toBe("/login?error=EmailNotVerified");
    });

    it("rejects sign-in when local DB user emailVerified is false", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: "user_creator_123",
        email: "creator@vyaparmedia.in",
        status: "ACTIVE",
        emailVerified: false,
        isTwoFactorEnabled: false,
      } as never);

      const result = await handleGoogleOAuthSignIn(
        baseUserArg,
        baseAccountArg,
        { email_verified: true }
      );

      expect(result).toBe("/login?error=EmailNotVerified");
    });

    it("rejects sign-in when both Google and local email are unverified", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: "user_creator_123",
        email: "creator@vyaparmedia.in",
        status: "ACTIVE",
        emailVerified: false,
        isTwoFactorEnabled: false,
      } as never);

      const result = await handleGoogleOAuthSignIn(
        baseUserArg,
        baseAccountArg,
        { email_verified: false }
      );

      expect(result).toBe("/login?error=EmailNotVerified");
    });

    it("allows sign-in when both Google and local email are verified", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: "user_creator_123",
        email: "creator@vyaparmedia.in",
        status: "ACTIVE",
        emailVerified: true,
        isTwoFactorEnabled: false,
      } as never);

      vi.spyOn(prisma.oAuthAccount, "findUnique").mockResolvedValue(null);
      const upsertSpy = vi.spyOn(prisma.oAuthAccount, "upsert").mockResolvedValue({} as never);

      const result = await handleGoogleOAuthSignIn(
        baseUserArg,
        baseAccountArg,
        { email_verified: true }
      );

      expect(result).toBe(true);
      expect(upsertSpy).toHaveBeenCalled();
    });
  });

  describe("O3-T3: Two-Factor Authentication requirement", () => {
    it("redirects to 2FA verification step when user has isTwoFactorEnabled === true", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: "user_creator_123",
        email: "creator@vyaparmedia.in",
        status: "ACTIVE",
        emailVerified: true,
        isTwoFactorEnabled: true,
      } as never);

      const result = await handleGoogleOAuthSignIn(
        baseUserArg,
        baseAccountArg,
        { email_verified: true }
      );

      expect(result).toBe("/login?step=2fa&email=creator%40vyaparmedia.in");
    });
  });

  describe("O3-T4: Token storage privacy", () => {
    it("stores only provider + providerAccountId and nulls accessToken in oAuthAccount", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: "user_creator_123",
        email: "creator@vyaparmedia.in",
        status: "ACTIVE",
        emailVerified: true,
        isTwoFactorEnabled: false,
      } as never);

      vi.spyOn(prisma.oAuthAccount, "findUnique").mockResolvedValue(null);
      const upsertSpy = vi.spyOn(prisma.oAuthAccount, "upsert").mockResolvedValue({} as never);

      await handleGoogleOAuthSignIn(
        baseUserArg,
        baseAccountArg,
        { email_verified: true }
      );

      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            userId: "user_creator_123",
            provider: "google",
            providerAccountId: "google_sub_987654321",
            accessToken: null,
          }),
          update: expect.objectContaining({
            accessToken: null,
          }),
        })
      );
    });
  });

  describe("O3-T5: Account-linking safety", () => {
    it("rejects sign-in if providerAccountId is already linked to another user", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: "user_creator_123",
        email: "creator@vyaparmedia.in",
        status: "ACTIVE",
        emailVerified: true,
        isTwoFactorEnabled: false,
      } as never);

      // Already linked to someone else!
      vi.spyOn(prisma.oAuthAccount, "findUnique").mockResolvedValue({
        id: "oauth_existing_456",
        userId: "different_user_999",
        provider: "google",
        providerAccountId: "google_sub_987654321",
      } as never);

      const result = await handleGoogleOAuthSignIn(
        baseUserArg,
        baseAccountArg,
        { email_verified: true }
      );

      expect(result).toBe("/login?error=OAuthAccountNotLinked");
    });
  });
});
