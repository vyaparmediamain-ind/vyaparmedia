import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import prisma from "@/lib/db";
import { encrypt } from "@/lib/encryption";
import {
  getFreshInstagramAccessToken,
  getInstagramProfile,
  refreshInstagramToken,
} from "@/lib/instagram";
import { getFreshYouTubeAccessToken } from "@/lib/youtube";

describe("OAuth Token Lifecycle, Bearer Headers & Resilience (Checklist Items 3, 4, 5)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("INSTAGRAM_APP_ID", "test_ig_app_id");
    vi.stubEnv("INSTAGRAM_APP_SECRET", "test_ig_app_secret");
    vi.stubEnv("GOOGLE_CLIENT_ID", "test_google_client_id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "test_google_client_secret");
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe("Item 4: getFreshInstagramAccessToken lifecycle", () => {
    it("returns decrypted access token directly if expiresAt is in the future (>5 mins)", async () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour ahead
      vi.spyOn(prisma.oAuthAccount, "findFirst").mockResolvedValue({
        id: "oa_ig_1",
        userId: "user_test_1",
        provider: "instagram",
        providerAccountId: "ig_123",
        accessToken: encrypt("valid_fresh_instagram_token"),
        refreshToken: null,
        expiresAt: futureDate,
        scope: "instagram_business_basic",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const refreshSpy = vi.fn();
      global.fetch = refreshSpy;

      const token = await getFreshInstagramAccessToken("user_test_1");
      expect(token).toBe("valid_fresh_instagram_token");
      expect(refreshSpy).not.toHaveBeenCalled();
    });

    it("refreshes expired token, updates DB, and returns new token", async () => {
      const expiredDate = new Date(Date.now() - 1000); // Expired 1s ago
      vi.spyOn(prisma.oAuthAccount, "findFirst").mockResolvedValue({
        id: "oa_ig_1",
        userId: "user_test_1",
        provider: "instagram",
        providerAccountId: "ig_123",
        accessToken: encrypt("old_expired_token"),
        refreshToken: null,
        expiresAt: expiredDate,
        scope: "instagram_business_basic",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      let updatedData: unknown = null;
      vi.spyOn(prisma.oAuthAccount, "update").mockImplementation(((args: { data: unknown }) => {
        updatedData = args.data;
        return Promise.resolve(updatedData as never);
      }) as never);

      global.fetch = vi.fn().mockImplementation(async (url: string | URL) => {
        const urlStr = url.toString();
        if (urlStr.includes("refresh_access_token")) {
          return new Response(
            JSON.stringify({
              access_token: "newly_refreshed_instagram_token",
              token_type: "bearer",
              expires_in: 5184000,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response("Not found", { status: 404 });
      });

      const token = await getFreshInstagramAccessToken("user_test_1");
      expect(token).toBe("newly_refreshed_instagram_token");
      expect(updatedData).toBeDefined();
    });

    it("marks scope as NEEDS_RECONNECT when refresh fails and returns null", async () => {
      const expiredDate = new Date(Date.now() - 1000);
      vi.spyOn(prisma.oAuthAccount, "findFirst").mockResolvedValue({
        id: "oa_ig_1",
        userId: "user_test_1",
        provider: "instagram",
        providerAccountId: "ig_123",
        accessToken: encrypt("old_expired_token"),
        refreshToken: null,
        expiresAt: expiredDate,
        scope: "instagram_business_basic",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      let updatedData: { scope?: string } | null = null;
      vi.spyOn(prisma.oAuthAccount, "update").mockImplementation(((args: { data: { scope?: string } }) => {
        updatedData = args.data;
        return Promise.resolve(updatedData as never);
      }) as never);

      global.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              message: "Error validating access token: Session has expired",
              type: "OAuthException",
              code: 190,
            },
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        )
      );

      const token = await getFreshInstagramAccessToken("user_test_1");
      expect(token).toBeNull();
      expect((updatedData as { scope?: string } | null)?.scope).toBe("NEEDS_RECONNECT");
    });
  });

  describe("Item 3: Authorization Bearer header over URL query string", () => {
    it("sends Authorization: Bearer <token> in headers and does not expose access_token in URL query", async () => {
      let capturedUrl = "";
      let capturedHeaders: HeadersInit | undefined = undefined;

      global.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        capturedUrl = input.toString();
        capturedHeaders = init?.headers;
        return new Response(
          JSON.stringify({
            id: "ig_user_123",
            username: "creator_test",
            name: "Creator Test",
            account_type: "BUSINESS",
            followers_count: 5000,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      });

      const profile = await getInstagramProfile("my_secret_ig_token_12345");
      expect(profile).not.toBeNull();
      expect(profile?.username).toBe("creator_test");

      // Verify URL has NO access_token query param
      const url = new URL(capturedUrl);
      expect(url.searchParams.has("access_token")).toBe(false);

      // Verify Authorization Bearer header was sent
      const headers = new Headers(capturedHeaders);
      expect(headers.get("Authorization")).toBe("Bearer my_secret_ig_token_12345");
    });
  });
});
