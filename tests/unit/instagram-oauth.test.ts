import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getInstagramOAuthUrl,
  exchangeInstagramCode,
  getInstagramProfile,
  findPostByUrlDetailed,
} from "@/lib/instagram";

describe("O1-T1: Instagram API with Instagram Login Endpoints", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubEnv("INSTAGRAM_APP_ID", "test_ig_client_id_123");
    vi.stubEnv("INSTAGRAM_APP_SECRET", "test_ig_client_secret_xyz");
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("generates authorization URL targeting https://www.instagram.com/oauth/authorize with instagram_business_basic scope", () => {
    const validHexState = "0123456789abcdef0123456789abcdef";
    const redirectUri = "https://app.vyaparmedia.in/api/auth/instagram/callback";

    const urlStr = getInstagramOAuthUrl(redirectUri, validHexState);
    const url = new URL(urlStr);

    expect(url.origin).toBe("https://www.instagram.com");
    expect(url.pathname).toBe("/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("test_ig_client_id_123");
    expect(url.searchParams.get("redirect_uri")).toBe(redirectUri);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("instagram_business_basic");
    expect(url.searchParams.get("state")).toBe(validHexState);
  });

  it("exchanges short-lived code via api.instagram.com and exchanges for long-lived token via graph.instagram.com", async () => {
    const mockFetch = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();

      // Step 1: POST https://api.instagram.com/oauth/access_token
      if (url === "https://api.instagram.com/oauth/access_token") {
        expect(init?.method).toBe("POST");
        const body = init?.body as URLSearchParams;
        expect(body.get("grant_type")).toBe("authorization_code");
        expect(body.get("client_id")).toBe("test_ig_client_id_123");
        expect(body.get("client_secret")).toBe("test_ig_client_secret_xyz");
        expect(body.get("code")).toBe("mock_auth_code");
        expect(body.get("redirect_uri")).toBe("https://app.vyaparmedia.in/api/auth/instagram/callback");

        return new Response(
          JSON.stringify({
            access_token: "short_lived_token_abc",
            user_id: "ig_user_id_9999",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // Step 2: GET https://graph.instagram.com/access_token?grant_type=ig_exchange_token...
      if (url.startsWith("https://graph.instagram.com/access_token")) {
        const parsed = new URL(url);
        expect(parsed.searchParams.get("grant_type")).toBe("ig_exchange_token");
        expect(parsed.searchParams.get("client_secret")).toBe("test_ig_client_secret_xyz");
        expect(parsed.searchParams.get("access_token")).toBe("short_lived_token_abc");

        return new Response(
          JSON.stringify({
            access_token: "long_lived_token_xyz_60days",
            token_type: "bearer",
            expires_in: 5184000,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    global.fetch = mockFetch;

    const result = await exchangeInstagramCode("mock_auth_code", "https://app.vyaparmedia.in/api/auth/instagram/callback");

    expect(result).not.toBeNull();
    expect(result?.accessToken).toBe("long_lived_token_xyz_60days");
    expect(result?.userId).toBe("ig_user_id_9999");
    expect(result?.expiresIn).toBe(5184000);
  });

  it("fetches profile from graph.instagram.com/me and rejects personal accounts", async () => {
    const mockFetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.startsWith("https://graph.instagram.com/me")) {
        return new Response(
          JSON.stringify({
            user_id: "ig_user_id_9999",
            username: "vyapar_creator",
            name: "Vyapar Creator",
            biography: "Fashion & Lifestyle",
            followers_count: 25000,
            follows_count: 150,
            media_count: 85,
            profile_picture_url: "https://ig.cdn.com/avatar.jpg",
            account_type: "CREATOR",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    global.fetch = mockFetch;

    const profile = await getInstagramProfile("long_lived_token_xyz");
    expect(profile).not.toBeNull();
    expect(profile?.id).toBe("ig_user_id_9999");
    expect(profile?.username).toBe("vyapar_creator");
    expect(profile?.followersCount).toBe(25000);
    expect(profile?.accountType).toBe("CREATOR");
  });

  it("returns null or throws for PERSONAL account_type", async () => {
    const mockFetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.startsWith("https://graph.instagram.com/me")) {
        return new Response(
          JSON.stringify({
            user_id: "ig_user_id_personal",
            username: "personal_user",
            account_type: "PERSONAL",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    global.fetch = mockFetch;

    const profile = await getInstagramProfile("personal_token");
    expect(profile).toBeNull();
  });

  describe("O1-T4: Permalink Matching & Post Verification", () => {
    it("matches posts regardless of /p/ vs /reel/ vs /tv/, trailing slashes, and utm query parameters", async () => {
      const mockFetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();

        if (url.startsWith("https://graph.instagram.com/me/media")) {
          return new Response(
            JSON.stringify({
              data: [
                {
                  id: "post_111",
                  media_type: "REELS",
                  permalink: "https://www.instagram.com/reel/C_X9abcDEF123/",
                  caption: "Promoted campaign reel #ad",
                  timestamp: "2026-10-10T12:00:00Z",
                  like_count: 500,
                  comments_count: 42,
                  is_paid_partnership: true,
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        throw new Error(`Unexpected fetch URL: ${url}`);
      });

      global.fetch = mockFetch;

      // Search using a /p/ URL with tracking params and uppercase letters
      const userSubmittedUrl = "https://instagram.com/p/C_X9abcDEF123?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA==";
      const result = await findPostByUrlDetailed("valid_token", userSubmittedUrl);

      expect(result.status).toBe("FOUND");
      if (result.status === "FOUND") {
        expect(result.post.id).toBe("post_111");
        expect(result.post.likeCount).toBe(500);
      }
    });

    it("returns NOT_FOUND when post is not in the recent 150 media", async () => {
      const mockFetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();

        if (url.startsWith("https://graph.instagram.com/me/media")) {
          return new Response(
            JSON.stringify({
              data: [
                {
                  id: "other_post",
                  media_type: "IMAGE",
                  permalink: "https://www.instagram.com/p/DIFFERENT_CODE/",
                  caption: "Other post",
                  timestamp: "2026-10-10T12:00:00Z",
                  like_count: 10,
                  comments_count: 1,
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        throw new Error(`Unexpected fetch URL: ${url}`);
      });

      global.fetch = mockFetch;

      const result = await findPostByUrlDetailed("valid_token", "https://www.instagram.com/p/TARGET_NOT_HERE/");
      expect(result.status).toBe("NOT_FOUND");
    });

    it("returns API_ERROR distinct from NOT_FOUND on network or Graph API failure", async () => {
      const mockFetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();

        if (url.startsWith("https://graph.instagram.com/me/media")) {
          return new Response(
            JSON.stringify({
              error: {
                message: "Error validating access token: Session has expired",
                code: 190,
                type: "OAuthException",
              },
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        throw new Error(`Unexpected fetch URL: ${url}`);
      });

      global.fetch = mockFetch;

      const result = await findPostByUrlDetailed("expired_token", "https://www.instagram.com/p/ANY_URL/");
      expect(result.status).toBe("API_ERROR");
      if (result.status === "API_ERROR") {
        expect(result.error).toContain("190");
      }
    });
  });
});
