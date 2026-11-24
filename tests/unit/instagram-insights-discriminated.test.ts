/**
 * Tests for Instagram Insights Discriminated Union & Pure Error Classifier
 *
 * Requirements:
 * - Pure classifier `classifyInstagramInsightsError(httpStatus, errorBody)`
 * - Discriminated union return type for `getMediaInsights`
 * - Tested with recorded fixtures in `tests/fixtures/instagram/`
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  classifyInstagramInsightsError,
  getMediaInsights,
  IG_API_VERSION,
  IG_GRAPH_BASE_URL,
} from "@/lib/instagram";
import { instagramInsightsRequestsTotal } from "@/lib/metrics";
import * as killSwitchModule from "@/lib/kill-switch";

function loadFixture(name: string): unknown {
  const filePath = path.resolve(process.cwd(), "tests/fixtures/instagram", name);
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

describe("Instagram Insights Error Classifier & Discriminated Union", () => {
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

  describe("1. Pure Error Classifier: classifyInstagramInsightsError", () => {
    it("classifies code 10 with permission message as PERMISSION_DENIED", () => {
      const fixture = loadFixture("permission-denied-code-10.json");
      const classification = classifyInstagramInsightsError(400, fixture);
      expect(classification.status).toBe("PERMISSION_DENIED");
    });

    it("classifies code 10 with 'not enough viewers' as NOT_ENOUGH_VIEWERS", () => {
      const fixture = loadFixture("not-enough-viewers-code-10.json");
      const classification = classifyInstagramInsightsError(400, fixture);
      expect(classification.status).toBe("NOT_ENOUGH_VIEWERS");
    });

    it("classifies code 200 as PERMISSION_DENIED", () => {
      const fixture = loadFixture("permission-denied-code-200.json");
      const classification = classifyInstagramInsightsError(403, fixture);
      expect(classification.status).toBe("PERMISSION_DENIED");
    });

    it("classifies code 190 as TOKEN_INVALID", () => {
      const fixture = loadFixture("invalid-token-code-190.json");
      const classification = classifyInstagramInsightsError(401, fixture);
      expect(classification.status).toBe("TOKEN_INVALID");
    });

    it("classifies code 100 with unsupported metric as METRIC_UNSUPPORTED", () => {
      const fixture = loadFixture("unsupported-metric-code-100.json");
      const classification = classifyInstagramInsightsError(400, fixture);
      expect(classification.status).toBe("METRIC_UNSUPPORTED");
    });

    it("classifies album / carousel child media as UNSUPPORTED_MEDIA", () => {
      const fixture = loadFixture("album-child.json");
      const classification = classifyInstagramInsightsError(400, fixture);
      expect(classification.status).toBe("UNSUPPORTED_MEDIA");
    });

    it("classifies rate limit code 80002 as RATE_LIMITED", () => {
      const fixture = loadFixture("rate-limit-code-80002.json");
      const classification = classifyInstagramInsightsError(429, fixture);
      expect(classification.status).toBe("RATE_LIMITED");
    });

    it("classifies unknown HTTP 500 as ERROR", () => {
      const classification = classifyInstagramInsightsError(500, { error: { message: "Internal Server Error", code: 2 } });
      expect(classification.status).toBe("ERROR");
    });

    it("classifies code 100 with non-metric parameter errors as ERROR instead of METRIC_UNSUPPORTED", () => {
      const classification = classifyInstagramInsightsError(400, {
        error: { message: "Invalid parameter syntax", code: 100 },
      });
      expect(classification.status).toBe("ERROR");
    });
  });

  describe("2. getMediaInsights Discriminated Union Return", () => {
    it("returns OK with parsed values on success fixture", async () => {
      const fixture = loadFixture("success.json");
      global.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify(fixture), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      );

      const result = await getMediaInsights("test_token", "media_101", "REELS");
      expect(result).not.toBeNull();
      expect(result?.status).toBe("OK");
      if (result?.status === "OK") {
        expect(result.values.views).toBe(15400);
        expect(result.values.reach).toBe(11200);
        expect(result.values.likes).toBe(840);
        expect(result.values.comments).toBe(92);
        expect(result.values.shares).toBe(145);
        expect(result.values.saved).toBe(310);
        expect(result.values.totalInteractions).toBe(1387);
      }
    });

    it("returns OK with undefined optional metrics on partial-success fixture", async () => {
      const fixture = loadFixture("partial-success.json");
      global.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify(fixture), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      );

      const result = await getMediaInsights("test_token", "media_102", "FEED");
      expect(result?.status).toBe("OK");
      if (result?.status === "OK") {
        expect(result.values.views).toBe(4500);
        expect(result.values.reach).toBe(3800);
        expect(result.values.likes).toBeUndefined();
      }
    });

    it("returns EMPTY on empty-data-array fixture", async () => {
      const fixture = loadFixture("empty-data-array.json");
      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(fixture), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const result = await getMediaInsights("test_token", "media_103", "FEED");
      expect(result?.status).toBe("EMPTY");
    });

    it("returns NOT_ENOUGH_VIEWERS on not-enough-viewers code 10", async () => {
      const fixture = loadFixture("not-enough-viewers-code-10.json");
      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(fixture), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        })
      );

      const result = await getMediaInsights("test_token", "story_media_104", "STORY");
      expect(result?.status).toBe("NOT_ENOUGH_VIEWERS");
    });

    it("returns PERMISSION_DENIED on permission-denied code 10 (NEVER quality API)", async () => {
      const fixture = loadFixture("permission-denied-code-10.json");
      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(fixture), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        })
      );

      const result = await getMediaInsights("test_token", "media_105", "REELS");
      expect(result?.status).toBe("PERMISSION_DENIED");
    });

    it("returns PERMISSION_DENIED on permission-denied code 200", async () => {
      const fixture = loadFixture("permission-denied-code-200.json");
      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(fixture), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        })
      );

      const result = await getMediaInsights("test_token", "media_106", "REELS");
      expect(result?.status).toBe("PERMISSION_DENIED");
    });

    it("returns TOKEN_INVALID on code 190", async () => {
      const fixture = loadFixture("invalid-token-code-190.json");
      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(fixture), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        })
      );

      const result = await getMediaInsights("test_token", "media_107", "REELS");
      expect(result?.status).toBe("TOKEN_INVALID");
    });

    it("returns UNSUPPORTED_MEDIA on album-child fixture", async () => {
      const fixture = loadFixture("album-child.json");
      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(fixture), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        })
      );

      const result = await getMediaInsights("test_token", "child_media_108", "FEED");
      expect(result?.status).toBe("UNSUPPORTED_MEDIA");
    });

    it("returns RATE_LIMITED on code 80002", async () => {
      const fixture = loadFixture("rate-limit-code-80002.json");
      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(fixture), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        })
      );

      const result = await getMediaInsights("test_token", "media_109", "REELS");
      expect(result?.status).toBe("RATE_LIMITED");
    });
  });

  describe("3. Pinned Graph API Version Invariant", () => {
    it("pins supported Meta Graph API version segment in IG_GRAPH_BASE_URL", () => {
      expect(IG_API_VERSION).toBeDefined();
      expect(IG_API_VERSION).toMatch(/^v\d+\.\d+$/);
      expect(IG_GRAPH_BASE_URL).toContain(`https://graph.instagram.com/${IG_API_VERSION}`);
    });
  });

  describe("4. Metrics Counter per Status Union Member", () => {
    it("increments instagramInsightsRequestsTotal with status label matching outcome", async () => {
      const incSpy = vi.spyOn(instagramInsightsRequestsTotal, "inc");
      const fixture = loadFixture("success.json");
      global.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify(fixture), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      );

      await getMediaInsights("test_token", "media_200", "REELS");
      expect(incSpy).toHaveBeenCalledWith({ status: "OK" });
    });
  });
});
