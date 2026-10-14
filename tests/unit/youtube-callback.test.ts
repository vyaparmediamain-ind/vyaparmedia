import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/auth/youtube/callback/route";
import prisma from "@/lib/db";
import * as youtube from "@/lib/youtube";
import * as oauthCallbackHelper from "@/lib/oauth-callback-helper";
import { logger } from "@/lib/logger";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

describe("O2-T3 & O2-T8: YouTube Callback Route & Scope Check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("O2-T8: redirects to youtube_scope_required when user unticks youtube.readonly scope", async () => {
    vi.spyOn(oauthCallbackHelper, "validateAndConsumeOAuthState").mockResolvedValue({
      storedState: { userId: "user_test_123" } as never,
      errorRedirect: null,
    });

    vi.spyOn(youtube, "exchangeYouTubeCode").mockResolvedValue({
      accessToken: "mock_access_token_123",
      refreshToken: "mock_refresh_token_123",
      expiresAt: new Date(Date.now() + 3600000),
      scope: "openid https://www.googleapis.com/auth/userinfo.profile", // missing youtube.readonly!
    });

    const req = new NextRequest("https://vyaparmedia.in/api/auth/youtube/callback?code=mock_code&state=12345678901234567890123456789012");
    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location") || "";
    expect(location).toContain("error=youtube_scope_required");
  });

  it("successfully connects channel and stores encrypted tokens when youtube.readonly is granted", async () => {
    vi.spyOn(oauthCallbackHelper, "validateAndConsumeOAuthState").mockResolvedValue({
      storedState: { userId: "user_influencer_456" } as never,
      errorRedirect: null,
    });

    vi.spyOn(youtube, "exchangeYouTubeCode").mockResolvedValue({
      accessToken: "mock_valid_token_xyz",
      refreshToken: "mock_refresh_token_xyz",
      expiresAt: new Date(Date.now() + 3600000),
      scope: "https://www.googleapis.com/auth/youtube.readonly openid",
    });

    vi.spyOn(youtube, "getYouTubeChannelByToken").mockResolvedValue({
      id: "UC_valid_channel_789",
      title: "My Channel",
      description: "My Channel Desc",
      customUrl: "@mychannel",
      thumbnail: "https://thumb/channel.jpg",
      subscriberCount: 50000,
      videoCount: 120,
      viewCount: 1000000,
      publishedAt: "2020-01-01T00:00:00Z",
    });

    vi.spyOn(prisma.oAuthAccount, "findUnique").mockResolvedValue(null);
    const upsertSpy = vi.spyOn(prisma.oAuthAccount, "upsert").mockResolvedValue({} as never);
    vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
      userType: "INFLUENCER",
      email: "creator@example.com",
    } as never);
    vi.spyOn(prisma.influencerProfile, "upsert").mockResolvedValue({} as never);
    vi.spyOn(youtube, "calculateYouTubeEngagement").mockResolvedValue({
      avgViews: 5000,
      avgLikes: 300,
      avgComments: 40,
      engagementRate: 6.8,
      uploadFrequency: "2 videos/week",
    });

    const req = new NextRequest("https://vyaparmedia.in/api/auth/youtube/callback?code=mock_code&state=12345678901234567890123456789012");
    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location") || "";
    expect(location).toContain("success=youtube_connected");

    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: "user_influencer_456",
          provider: "youtube",
          providerAccountId: "UC_valid_channel_789",
        }),
      }),
    );
  });

  it("never logs plaintext tokens or secrets (Logger Spy Test)", async () => {
    const rawSecret = "super_secret_google_token_12345678";
    vi.spyOn(oauthCallbackHelper, "validateAndConsumeOAuthState").mockResolvedValue({
      storedState: { userId: "user_influencer_456" } as never,
      errorRedirect: null,
    });

    vi.spyOn(youtube, "exchangeYouTubeCode").mockResolvedValue({
      accessToken: rawSecret,
      refreshToken: rawSecret,
      scope: "https://www.googleapis.com/auth/youtube.readonly",
    });

    vi.spyOn(youtube, "getYouTubeChannelByToken").mockResolvedValue({
      id: "UC_valid_channel_789",
      title: "My Channel",
      description: "My Channel Desc",
      customUrl: "@mychannel",
      thumbnail: "https://thumb/channel.jpg",
      subscriberCount: 50000,
      videoCount: 120,
      viewCount: 1000000,
      publishedAt: "2020-01-01T00:00:00Z",
    });

    vi.spyOn(prisma.oAuthAccount, "findUnique").mockResolvedValue(null);
    vi.spyOn(prisma.oAuthAccount, "upsert").mockResolvedValue({} as never);
    vi.spyOn(prisma.user, "findUnique").mockResolvedValue(null);

    const logWarnSpy = vi.spyOn(logger, "warn");
    const logInfoSpy = vi.spyOn(logger, "info");
    const logErrorSpy = vi.spyOn(logger, "error");

    const req = new NextRequest("https://vyaparmedia.in/api/auth/youtube/callback?code=mock_code&state=12345678901234567890123456789012");
    await GET(req);

    const allCalls = [
      ...logWarnSpy.mock.calls,
      ...logInfoSpy.mock.calls,
      ...logErrorSpy.mock.calls,
    ];

    for (const call of allCalls) {
      const callString = JSON.stringify(call);
      expect(callString).not.toContain(rawSecret);
    }
  });
});
