import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import prisma from "@/lib/db";
import { purgeOrRefreshStaleYouTubeData } from "@/lib/youtube-retention";
import * as youtube from "@/lib/youtube";

describe("O2-T6: YouTube 30-Day API Data Retention Compliance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("purges stored YouTube metrics when older than 30 days and user has no active OAuth connection", async () => {
    const fixedNow = new Date("2026-10-15T12:00:00Z");
    const fortyDaysAgo = new Date(fixedNow.getTime() - 40 * 86400 * 1000);

    const staleProfile = {
      id: "profile_stale_1",
      userId: "user_disconnected_creator",
      youtubeHandle: "@oldcreator",
      youtubeSubscribers: 25000,
      youtubeEngagementRate: 4.5,
      updatedAt: fortyDaysAgo,
    };

    vi.spyOn(prisma.influencerProfile, "findMany").mockResolvedValue([staleProfile as never]);
    vi.spyOn(prisma.oAuthAccount, "findFirst").mockResolvedValue(null); // No active OAuth connection

    const updateSpy = vi.spyOn(prisma.influencerProfile, "update").mockResolvedValue({} as never);

    const result = await purgeOrRefreshStaleYouTubeData(fixedNow);

    expect(result.purged).toBe(1);
    expect(result.refreshed).toBe(0);
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "profile_stale_1" },
        data: expect.objectContaining({
          youtubeSubscribers: 0,
          youtubeEngagementRate: 0,
        }),
      }),
    );
  });

  it("refreshes stored YouTube metrics when older than 30 days if user has valid OAuth token", async () => {
    const fixedNow = new Date("2026-10-15T12:00:00Z");
    const thirtyFiveDaysAgo = new Date(fixedNow.getTime() - 35 * 86400 * 1000);

    const staleProfile = {
      id: "profile_active_2",
      userId: "user_connected_creator",
      youtubeHandle: "@activecreator",
      youtubeSubscribers: 50000,
      youtubeEngagementRate: 5.0,
      updatedAt: thirtyFiveDaysAgo,
    };

    vi.spyOn(prisma.influencerProfile, "findMany").mockResolvedValue([staleProfile as never]);
    vi.spyOn(prisma.oAuthAccount, "findFirst").mockResolvedValue({
      id: "oauth_yt_active",
      userId: "user_connected_creator",
      provider: "youtube",
    } as never);

    vi.spyOn(youtube, "getFreshYouTubeAccessToken").mockResolvedValue("fresh_access_token_123");
    vi.spyOn(youtube, "getYouTubeChannelByToken").mockResolvedValue({
      id: "UC_channel_123",
      title: "Active Channel",
      description: "Desc",
      customUrl: "@activecreator",
      thumbnail: "https://thumb/1.jpg",
      subscriberCount: 52000,
      videoCount: 100,
      viewCount: 200000,
      publishedAt: "2020-01-01T00:00:00Z",
    });

    const updateSpy = vi.spyOn(prisma.influencerProfile, "update").mockResolvedValue({} as never);

    const result = await purgeOrRefreshStaleYouTubeData(fixedNow);

    expect(result.refreshed).toBe(1);
    expect(result.purged).toBe(0);
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "profile_active_2" },
        data: expect.objectContaining({
          youtubeSubscribers: 52000,
        }),
      }),
    );
  });
});
