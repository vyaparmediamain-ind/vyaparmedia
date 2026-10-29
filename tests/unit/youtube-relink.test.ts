import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/auth/youtube/callback/route";
import prisma from "@/lib/db";
import * as youtube from "@/lib/youtube";
import * as oauthCallbackHelper from "@/lib/oauth-callback-helper";
import redis from "@/lib/redis";
import { NotificationService } from "@/services/notification.service";
import * as audit from "@/lib/audit";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

describe("O2-T5 (OA-11): YouTube Ownership Re-link Rate Limit & Audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("notifies previous owner and logs ActivityLog when channel ownership moves to new user", async () => {
    const channelId = "UC_relink_channel_123";
    const previousOwnerId = "user_previous_owner";
    const newOwnerId = "user_new_owner";

    vi.spyOn(oauthCallbackHelper, "validateAndConsumeOAuthState").mockResolvedValue({
      storedState: { userId: newOwnerId } as never,
      errorRedirect: null,
    });

    vi.spyOn(youtube, "exchangeYouTubeCode").mockResolvedValue({
      accessToken: "mock_token_abc",
      refreshToken: "mock_refresh_abc",
      expiresAt: new Date(Date.now() + 3600000),
      scope: "https://www.googleapis.com/auth/youtube.readonly",
    });

    vi.spyOn(youtube, "getYouTubeChannelByToken").mockResolvedValue({
      id: channelId,
      title: "Contested Channel",
      description: "Channel Desc",
      customUrl: "@contested",
      thumbnail: "https://thumb/1.jpg",
      subscriberCount: 20000,
      videoCount: 50,
      viewCount: 100000,
      publishedAt: "2021-01-01T00:00:00Z",
    });

    // Existing link with different owner
    vi.spyOn(prisma.oAuthAccount, "findUnique").mockResolvedValue({
      userId: previousOwnerId,
    } as never);

    vi.spyOn(redis, "incr").mockResolvedValue(1);
    vi.spyOn(redis, "expire").mockResolvedValue(1 as never);

    vi.spyOn(prisma, "$transaction").mockImplementation(async (cb: unknown) => {
      if (typeof cb === "function") {
        return (cb as (p: typeof prisma) => Promise<unknown>)(prisma);
      }
      return Promise.all(cb as Promise<unknown>[]);
    });

    vi.spyOn(prisma.oAuthAccount, "delete").mockResolvedValue({} as never);
    vi.spyOn(prisma.influencerProfile, "updateMany").mockResolvedValue({ count: 1 });
    vi.spyOn(prisma.oAuthAccount, "create").mockResolvedValue({} as never);
    vi.spyOn(prisma.user, "findUnique").mockResolvedValue(null);

    const notifSpy = vi.spyOn(NotificationService, "createNotification").mockResolvedValue({} as never);
    const auditSpy = vi.spyOn(audit, "createActivityLog").mockResolvedValue({} as never);

    const req = new NextRequest("https://vyaparmedia.in/api/auth/youtube/callback?code=mock_code&state=12345678901234567890123456789012");
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("success=youtube_connected");

    expect(notifSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: previousOwnerId,
        title: "YouTube Channel Unlinked",
        message: expect.stringContaining("dusre account se link hua"),
      }),
    );

    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "OAUTH_RELINK",
        entityId: channelId,
        metadata: expect.objectContaining({
          previousOwnerId,
          newOwnerId,
          channelId,
        }),
      }),
      expect.anything(),
    );
  });

  it("rate limits relinking when channel has already been relinked >3 times in 24 hours", async () => {
    const channelId = "UC_rapid_relink_456";
    const previousOwnerId = "user_victim";
    const newOwnerId = "user_attacker";

    vi.spyOn(oauthCallbackHelper, "validateAndConsumeOAuthState").mockResolvedValue({
      storedState: { userId: newOwnerId } as never,
      errorRedirect: null,
    });

    vi.spyOn(youtube, "exchangeYouTubeCode").mockResolvedValue({
      accessToken: "mock_token_abc",
      scope: "https://www.googleapis.com/auth/youtube.readonly",
    });

    vi.spyOn(youtube, "getYouTubeChannelByToken").mockResolvedValue({
      id: channelId,
      title: "Bouncing Channel",
      description: "Desc",
      customUrl: "@bouncing",
      thumbnail: "https://thumb/1.jpg",
      subscriberCount: 1000,
      videoCount: 10,
      viewCount: 5000,
      publishedAt: "2021-01-01T00:00:00Z",
    });

    vi.spyOn(prisma.oAuthAccount, "findUnique").mockResolvedValue({
      userId: previousOwnerId,
    } as never);

    // Redis returns 4 (exceeds limit of 3)
    vi.spyOn(redis, "incr").mockResolvedValue(4);

    const req = new NextRequest("https://vyaparmedia.in/api/auth/youtube/callback?code=mock_code&state=12345678901234567890123456789012");
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("error=youtube_relink_rate_limited");
  });
});
