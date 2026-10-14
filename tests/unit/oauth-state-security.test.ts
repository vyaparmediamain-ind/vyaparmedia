import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { initiateOAuthFlow } from "@/lib/oauth-helper";
import { validateAndConsumeOAuthState } from "@/lib/oauth-callback-helper";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/lib/auth";

describe("OAuth State Security, Trusted Redirect URI & Idempotent Callbacks", () => {
  const mockAuth = vi.mocked(auth);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("APP_URL", "https://app.vyaparmedia.in");
    vi.stubEnv("NEXTAUTH_URL", "https://app.vyaparmedia.in");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe("Checklist Item 1 & 2: initiateOAuthFlow state generation & trusted redirect_uri", () => {
    it("generates random hex state >= 32 bytes (64 hex characters) and 10 min TTL", async () => {
      mockAuth.mockResolvedValue({
        user: { id: "user_test_1" },
      } as unknown as Awaited<ReturnType<typeof auth>>);

      let createdState: { userId: string; state: string; provider: string; expiresAt: Date } | null = null;
      vi.spyOn(prisma.oAuthState, "create").mockImplementation((async (args: { data: unknown }) => {
        createdState = args.data as typeof createdState;
        return createdState as never;
      }) as never);

      const req = new NextRequest("https://app.vyaparmedia.in/api/auth/instagram/authorize");
      const res = await initiateOAuthFlow(req, "instagram", (state, redirectUri) => {
        return `https://www.instagram.com/oauth/authorize?state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`;
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.url).toBeDefined();

      expect(createdState).not.toBeNull();
      expect(createdState!.userId).toBe("user_test_1");
      expect(createdState!.provider).toBe("instagram");
      // 32 bytes hex = 64 characters
      expect(createdState!.state).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(createdState!.state)).toBe(true);

      // ~10 min TTL (600 seconds)
      const diffMs = createdState!.expiresAt.getTime() - Date.now();
      expect(diffMs).toBeGreaterThan(9 * 60 * 1000);
      expect(diffMs).toBeLessThanOrEqual(10 * 60 * 1000 + 2000);
    });

    it("builds redirect_uri strictly from trusted APP_URL, ignoring spoofed Host header", async () => {
      mockAuth.mockResolvedValue({
        user: { id: "user_test_1" },
      } as unknown as Awaited<ReturnType<typeof auth>>);

      vi.spyOn(prisma.oAuthState, "create").mockResolvedValue({} as never);

      // Attacker sends request with spoofed Host header
      const req = new NextRequest("http://attacker-controlled.site/api/auth/youtube/authorize", {
        headers: {
          host: "attacker-controlled.site",
          "x-forwarded-host": "attacker-controlled.site",
        },
      });

      const res = await initiateOAuthFlow(req, "youtube", (state, redirectUri) => {
        return `https://accounts.google.com/o/oauth2/v2/auth?state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`;
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      const authUrl = new URL(json.url);
      const redirectUriParam = authUrl.searchParams.get("redirect_uri");

      // redirect_uri must point to trusted APP_URL (https://app.vyaparmedia.in) and NOT attacker site
      expect(redirectUriParam).toBe("https://app.vyaparmedia.in/api/auth/youtube/callback");
      expect(redirectUriParam).not.toContain("attacker");
    });
  });

  describe("Checklist Item 1 & 7: validateAndConsumeOAuthState", () => {
    it("validates state with constant-time equality and consumes it immediately", async () => {
      const validState = "a".repeat(64);
      mockAuth.mockResolvedValue({
        user: { id: "user_owner_1" },
      } as unknown as Awaited<ReturnType<typeof auth>>);

      vi.spyOn(prisma.oAuthState, "findUnique").mockResolvedValue({
        id: "state_1",
        userId: "user_owner_1",
        state: validState,
        provider: "instagram",
        expiresAt: new Date(Date.now() + 500000),
        createdAt: new Date(),
      });

      const deleteSpy = vi.spyOn(prisma.oAuthState, "delete").mockResolvedValue({} as never);

      const req = new NextRequest(`https://app.vyaparmedia.in/api/auth/instagram/callback?code=mock_code&state=${validState}`);
      const result = await validateAndConsumeOAuthState(
        req,
        "mock_code",
        validState,
        null,
        "instagram",
        "/dashboard/settings?error=",
        "instagram_connect_cancelled"
      );

      expect(result.errorRedirect).toBeNull();
      expect(result.storedState?.userId).toBe("user_owner_1");
      expect(deleteSpy).toHaveBeenCalledWith({ where: { state: validState } });
    });

    it("rejects when provider does not match", async () => {
      const state = "b".repeat(64);
      mockAuth.mockResolvedValue({
        user: { id: "user_owner_1" },
      } as unknown as Awaited<ReturnType<typeof auth>>);

      vi.spyOn(prisma.oAuthState, "findUnique").mockResolvedValue({
        id: "state_2",
        userId: "user_owner_1",
        state,
        provider: "instagram", // Stored for instagram
        expiresAt: new Date(Date.now() + 500000),
        createdAt: new Date(),
      });

      // But callback is for youtube
      const req = new NextRequest(`https://app.vyaparmedia.in/api/auth/youtube/callback?code=mock_code&state=${state}`);
      const result = await validateAndConsumeOAuthState(
        req,
        "mock_code",
        state,
        null,
        "youtube",
        "/dashboard/settings?error=",
        "youtube_connect_cancelled"
      );

      expect(result.storedState).toBeNull();
      expect(result.errorRedirect?.headers.get("location")).toContain("invalid_state");
    });

    it("rejects and cleans up state when user session does not match state owner", async () => {
      const state = "c".repeat(64);
      mockAuth.mockResolvedValue({
        user: { id: "attacker_user_2" }, // Different user
      } as unknown as Awaited<ReturnType<typeof auth>>);

      vi.spyOn(prisma.oAuthState, "findUnique").mockResolvedValue({
        id: "state_3",
        userId: "victim_user_1",
        state,
        provider: "instagram",
        expiresAt: new Date(Date.now() + 500000),
        createdAt: new Date(),
      });

      const deleteSpy = vi.spyOn(prisma.oAuthState, "delete").mockResolvedValue({} as never);

      const req = new NextRequest(`https://app.vyaparmedia.in/api/auth/instagram/callback?code=mock_code&state=${state}`);
      const result = await validateAndConsumeOAuthState(
        req,
        "mock_code",
        state,
        null,
        "instagram",
        "/dashboard/settings?error=",
        "instagram_connect_cancelled"
      );

      expect(result.storedState).toBeNull();
      expect(result.errorRedirect?.headers.get("location")).toContain("invalid_session");
      expect(deleteSpy).toHaveBeenCalledWith({ where: { state } });
    });

    it("rejects and deletes state when state is expired", async () => {
      const state = "d".repeat(64);
      mockAuth.mockResolvedValue({
        user: { id: "user_owner_1" },
      } as unknown as Awaited<ReturnType<typeof auth>>);

      vi.spyOn(prisma.oAuthState, "findUnique").mockResolvedValue({
        id: "state_4",
        userId: "user_owner_1",
        state,
        provider: "instagram",
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        createdAt: new Date(),
      });

      const deleteSpy = vi.spyOn(prisma.oAuthState, "delete").mockResolvedValue({} as never);

      const req = new NextRequest(`https://app.vyaparmedia.in/api/auth/instagram/callback?code=mock_code&state=${state}`);
      const result = await validateAndConsumeOAuthState(
        req,
        "mock_code",
        state,
        null,
        "instagram",
        "/dashboard/settings?error=",
        "instagram_connect_cancelled"
      );

      expect(result.storedState).toBeNull();
      expect(result.errorRedirect?.headers.get("location")).toContain("state_expired");
      expect(deleteSpy).toHaveBeenCalledWith({ where: { state } });
    });

    it("Item 7 (Idempotency): returns friendly already_linked redirect on callback replay / double-click if account already linked", async () => {
      const alreadyConsumedState = "e".repeat(64);
      mockAuth.mockResolvedValue({
        user: { id: "user_owner_1" },
      } as unknown as Awaited<ReturnType<typeof auth>>);

      // State is already deleted/consumed by first click
      vi.spyOn(prisma.oAuthState, "findUnique").mockResolvedValue(null);

      // User already has an active linked account for this provider
      vi.spyOn(prisma.oAuthAccount, "findFirst").mockResolvedValue({
        id: "oa_1",
        userId: "user_owner_1",
        provider: "instagram",
        providerAccountId: "ig_account_123",
        accessToken: "encrypted_token",
        refreshToken: null,
        expiresAt: new Date(Date.now() + 1000000),
        scope: "instagram_business_basic",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const req = new NextRequest(`https://app.vyaparmedia.in/api/auth/instagram/callback?code=mock_code&state=${alreadyConsumedState}`);
      const result = await validateAndConsumeOAuthState(
        req,
        "mock_code",
        alreadyConsumedState,
        null,
        "instagram",
        "/dashboard/settings?error=",
        "instagram_connect_cancelled"
      );

      expect(result.storedState).toBeNull();
      expect(result.errorRedirect).not.toBeNull();
      const location = result.errorRedirect?.headers.get("location");
      expect(location).toContain("/dashboard/settings");
      expect(location).toContain("notice=already_linked");
    });
  });
});
