import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getInstagramOAuthUrl,
  instagramCapabilities,
  getMediaInsights,
  type InstagramMediaInsightsResult,
} from "@/lib/instagram";
import { KILL_SWITCH_FEATURES } from "@/lib/kill-switch";
import * as killSwitchModule from "@/lib/kill-switch";
import { logger } from "@/lib/logger";

describe("Instagram Insights & Capabilities (v3 Standard)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubEnv("INSTAGRAM_APP_ID", "test_app_id_123");
    vi.stubEnv("INSTAGRAM_APP_SECRET", "test_app_secret_xyz");
    vi.spyOn(killSwitchModule, "isKillSwitchActive").mockResolvedValue(false);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe("1. Scope Parsing & instagramCapabilities", () => {
    it("returns all false for null or undefined account", () => {
      expect(instagramCapabilities(null)).toEqual({
        basic: false,
        insights: false,
        needsReconnect: false,
      });
      expect(instagramCapabilities(undefined)).toEqual({
        basic: false,
        insights: false,
        needsReconnect: false,
      });
    });

    it("identifies basic scope without insights", () => {
      const caps = instagramCapabilities({
        scope: "instagram_business_basic",
        grantedScopes: ["instagram_business_basic"],
        accessToken: "encrypted_token_123",
      });
      expect(caps).toEqual({
        basic: true,
        insights: false,
        needsReconnect: false,
      });
    });

    it("identifies active insights when grantedScopes contains instagram_business_manage_insights", () => {
      const caps = instagramCapabilities({
        scope: "instagram_business_basic",
        grantedScopes: [
          "instagram_business_basic",
          "instagram_business_manage_insights",
        ],
        accessToken: "encrypted_token_123",
      });
      expect(caps).toEqual({
        basic: true,
        insights: true,
        needsReconnect: false,
      });
    });

    it("maintains backward compatibility with legacy scope string containing insights", () => {
      const caps = instagramCapabilities({
        scope: "instagram_business_basic,instagram_business_manage_insights",
        grantedScopes: [],
        accessToken: "encrypted_token_123",
      });
      expect(caps).toEqual({
        basic: true,
        insights: true,
        needsReconnect: false,
      });
    });

    it("prioritizes NEEDS_RECONNECT over grantedScopes", () => {
      const caps = instagramCapabilities({
        scope: "NEEDS_RECONNECT",
        grantedScopes: [
          "instagram_business_basic",
          "instagram_business_manage_insights",
        ],
        accessToken: null,
      });
      expect(caps).toEqual({
        basic: false,
        insights: false,
        needsReconnect: true,
      });
    });

    it("flags needsReconnect when accessToken is missing and not pending approval", () => {
      const caps = instagramCapabilities({
        scope: "instagram_business_basic",
        grantedScopes: ["instagram_business_basic"],
        accessToken: null,
      });
      expect(caps).toEqual({
        basic: false,
        insights: false,
        needsReconnect: true,
      });
    });
  });

  describe("2. getInstagramOAuthUrl Flag-Gated Scopes", () => {
    const validHexState = "0123456789abcdef0123456789abcdef";
    const redirectUri = "https://app.vyaparmedia.in/api/auth/instagram/callback";

    it("requests only instagram_business_basic by default or when requestInsights is false", () => {
      const url = new URL(getInstagramOAuthUrl(redirectUri, validHexState));
      expect(url.searchParams.get("scope")).toBe("instagram_business_basic");

      const url2 = new URL(
        getInstagramOAuthUrl(redirectUri, validHexState, { requestInsights: false }),
      );
      expect(url2.searchParams.get("scope")).toBe("instagram_business_basic");
    });

    it("requests both basic and insights when requestInsights is true", () => {
      const url = new URL(
        getInstagramOAuthUrl(redirectUri, validHexState, { requestInsights: true }),
      );
      expect(url.searchParams.get("scope")).toBe(
        "instagram_business_basic,instagram_business_manage_insights",
      );
    });
  });

  describe("3. getMediaInsights Parsing & Invariants", () => {
    it("parses full metrics dataset into typed result with quality API", async () => {
      const mockResponse = {
        data: [
          { name: "views", values: [{ value: 12500 }] },
          { name: "reach", total_value: { value: 9800 } },
          { name: "likes", values: [{ value: 650 }] },
          { name: "comments", values: [{ value: 85 }] },
          { name: "shares", total_value: { value: 120 } },
          { name: "saved", total_value: { value: 240 } },
          { name: "total_interactions", total_value: { value: 1095 } },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await getMediaInsights("valid_token", "media_12345", "REELS");

      expect(result).toEqual({
        views: 12500,
        reach: 9800,
        likes: 650,
        comments: 85,
        shares: 120,
        saved: 240,
        totalInteractions: 1095,
        quality: "API",
      });
    });

    it("leaves missing metrics as undefined rather than 0", async () => {
      const mockResponse = {
        data: [
          { name: "views", values: [{ value: 4200 }] },
          // reach, shares, saved are missing from dataset
        ],
      };

      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await getMediaInsights("valid_token", "media_5678", "FEED");

      expect(result?.views).toBe(4200);
      expect(result?.reach).toBeUndefined();
      expect(result?.shares).toBeUndefined();
      expect(result?.saved).toBeUndefined();
      expect(result?.quality).toBe("API");
    });

    it("returns quality API with undefined metrics when Meta returns empty dataset []", async () => {
      const mockResponse = {
        data: [],
      };

      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await getMediaInsights("valid_token", "media_empty", "FEED");

      expect(result).toEqual({ quality: "API" });
      expect(result?.views).toBeUndefined();
    });

    it("handles Story error code 10 (<5 viewers) gracefully without throwing", async () => {
      const mockErrorResponse = {
        error: {
          message: "(#10) Not enough viewers to show insights",
          type: "OAuthException",
          code: 10,
        },
      };

      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockErrorResponse), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await getMediaInsights("valid_token", "story_media_1", "STORY");

      expect(result).toEqual({ quality: "API" });
      expect(result?.views).toBeUndefined();
    });

    it("handles media inside carousel album without throwing", async () => {
      const mockAlbumErrorResponse = {
        error: {
          message: "Carousel children do not support insights",
          type: "IGApiException",
          code: 100,
        },
      };

      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockAlbumErrorResponse), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await getMediaInsights("valid_token", "album_child_media", "FEED");

      expect(result).toEqual({ quality: "API" });
      expect(result?.views).toBeUndefined();
    });
  });

  describe("4. Operational Kill Switch & Security Invariants", () => {
    it("returns null when SOCIAL_INSTAGRAM kill switch is active without calling external fetch", async () => {
      vi.spyOn(killSwitchModule, "isKillSwitchActive").mockResolvedValue(true);
      const fetchSpy = vi.fn();
      global.fetch = fetchSpy;

      const result = await getMediaInsights("valid_token", "media_killswitched", "REELS");

      expect(result).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("never logs the access token when HTTP error occurs", async () => {
      const sensitiveToken = "EAAGm0PX4ZB94BOSECRET_TOKEN_DO_NOT_LOG";
      const warnSpy = vi.spyOn(logger, "warn");

      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: "Internal Meta Error", code: 500 } }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await getMediaInsights(sensitiveToken, "media_fail", "FEED");

      for (const call of warnSpy.mock.calls) {
        const loggedString = JSON.stringify(call);
        expect(loggedString).not.toContain(sensitiveToken);
      }
    });
  });
});
