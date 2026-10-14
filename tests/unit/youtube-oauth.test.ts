import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { getRecentVideos, getUploadsPlaylistId } from "@/lib/youtube";
import redis from "@/lib/redis";

describe("O2-T1 (OA-08): YouTube getRecentVideos PlaylistItems Optimization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Grep test: src/lib/youtube.ts must NEVER contain /search endpoint", () => {
    const youtubeFilePath = path.resolve(process.cwd(), "src/lib/youtube.ts");
    const content = fs.readFileSync(youtubeFilePath, "utf-8");
    const searchRegex = /\/search\b/i;
    expect(searchRegex.test(content)).toBe(false);
  });

  it("fetches uploads playlist id from channels.list and caches in Redis", async () => {
    const channelId = "UC_test_channel_123";
    const uploadsPlaylistId = "UU_test_channel_123";

    vi.spyOn(redis, "get").mockResolvedValue(null);
    const setSpy = vi.spyOn(redis, "set").mockResolvedValue("OK" as never);

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const urlStr = url.toString();
      if (urlStr.includes("/channels")) {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                id: channelId,
                contentDetails: {
                  relatedPlaylists: {
                    uploads: uploadsPlaylistId,
                  },
                },
              },
            ],
          }),
        } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    });

    const result = await getUploadsPlaylistId(channelId, "mock_token");
    expect(result).toBe(uploadsPlaylistId);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/channels"),
      expect.anything(),
    );
    expect(setSpy).toHaveBeenCalledWith(
      `yt:uploads:${channelId}`,
      uploadsPlaylistId,
      "EX",
      30 * 86400,
    );
  });

  it("uses cached uploads playlist id without calling channels.list", async () => {
    const channelId = "UC_cached_channel";
    const cachedUploadsId = "UU_cached_channel";

    vi.spyOn(redis, "get").mockResolvedValue(cachedUploadsId);
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await getUploadsPlaylistId(channelId);
    expect(result).toBe(cachedUploadsId);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("retrieves recent videos via playlistItems.list and videos.list (cost 2-3 units vs 100)", async () => {
    const channelId = "UC_active_creator";
    const uploadsPlaylistId = "UU_active_creator";

    vi.spyOn(redis, "get").mockResolvedValue(uploadsPlaylistId);

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const urlStr = url.toString();
      if (urlStr.includes("/playlistItems")) {
        expect(urlStr).toContain(`playlistId=${uploadsPlaylistId}`);
        return {
          ok: true,
          json: async () => ({
            items: [
              { contentDetails: { videoId: "video_1" } },
              { contentDetails: { videoId: "video_2" } },
            ],
          }),
        } as Response;
      }

      if (urlStr.includes("/videos")) {
        expect(urlStr).toContain("id=video_1%2Cvideo_2");
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                id: "video_1",
                snippet: {
                  title: "Video One",
                  description: "Desc One",
                  thumbnails: { high: { url: "https://thumb/1.jpg" } },
                  publishedAt: "2026-10-10T10:00:00Z",
                },
                statistics: { viewCount: "1000", likeCount: "100", commentCount: "10" },
                contentDetails: { duration: "PT5M" },
                status: { privacyStatus: "public" },
              },
              {
                id: "video_2",
                snippet: {
                  title: "Video Two",
                  description: "Desc Two",
                  thumbnails: { high: { url: "https://thumb/2.jpg" } },
                  publishedAt: "2026-10-11T10:00:00Z",
                },
                statistics: { viewCount: "2000", likeCount: "200", commentCount: "20" },
                contentDetails: { duration: "PT10M" },
                status: { privacyStatus: "public" },
              },
            ],
          }),
        } as Response;
      }

      return { ok: false, json: async () => ({}) } as Response;
    });

    const videos = await getRecentVideos(channelId, 10, "creator_access_token");
    expect(videos).toHaveLength(2);
    expect(videos[0]?.id).toBe("video_1");
    expect(videos[0]?.title).toBe("Video One");
    expect(videos[0]?.viewCount).toBe(1000);
    expect(videos[1]?.id).toBe("video_2");
    expect(videos[1]?.viewCount).toBe(2000);

    // Verify Authorization header was passed with accessToken
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/playlistItems"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer creator_access_token",
        }),
      }),
    );
  });
});
