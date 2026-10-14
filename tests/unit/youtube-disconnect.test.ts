import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/auth/youtube/disconnect/route";
import prisma from "@/lib/db";
import { encrypt } from "@/lib/encryption";
import * as youtube from "@/lib/youtube";
import * as audit from "@/lib/audit";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

describe("O2-T4 (OA-10): YouTube Disconnect & Token Revocation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(prisma, "$transaction").mockImplementation(async (cb: unknown) => {
      if (typeof cb === "function") {
        return (cb as (p: typeof prisma) => Promise<unknown>)(prisma);
      }
      return Promise.all(cb as Promise<unknown>[]);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls Google revoke endpoint with refresh token, deletes DB rows, and writes ActivityLog", async () => {
    const { auth } = await import("@/lib/auth");
    (auth as unknown as { mockResolvedValue: (val: unknown) => void }).mockResolvedValue({
      user: { id: "user_disconnect_123" },
    });

    const plainRefreshToken = "valid_google_refresh_token_abc";
    vi.spyOn(prisma.oAuthAccount, "findFirst").mockResolvedValue({
      id: "oauth_yt_1",
      userId: "user_disconnect_123",
      provider: "youtube",
      accessToken: encrypt("access_token_123"),
      refreshToken: encrypt(plainRefreshToken),
    } as never);

    const revokeSpy = vi.spyOn(youtube, "revokeYouTubeToken").mockResolvedValue(true);
    const deleteSpy = vi.spyOn(prisma.oAuthAccount, "deleteMany").mockResolvedValue({ count: 1 });
    const profileSpy = vi.spyOn(prisma.influencerProfile, "updateMany").mockResolvedValue({ count: 1 });
    const auditSpy = vi.spyOn(audit, "createActivityLog").mockResolvedValue({} as never);

    const req = new NextRequest("https://vyaparmedia.in/api/auth/youtube/disconnect", { method: "POST" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.revokedWithGoogle).toBe(true);
    expect(revokeSpy).toHaveBeenCalledWith(plainRefreshToken);
    expect(deleteSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user_disconnect_123", provider: "youtube" },
      }),
    );
    expect(profileSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user_disconnect_123" },
        data: expect.objectContaining({
          youtubeHandle: null,
          youtubeSubscribers: 0,
          youtubeEngagementRate: 0,
        }),
      }),
    );
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "OAUTH_DISCONNECT",
        userId: "user_disconnect_123",
        metadata: expect.objectContaining({ provider: "youtube", revokedWithGoogle: true }),
      }),
      expect.anything(),
    );
  });

  it("still deletes locally and advises user if Google revoke endpoint fails", async () => {
    const { auth } = await import("@/lib/auth");
    (auth as unknown as { mockResolvedValue: (val: unknown) => void }).mockResolvedValue({
      user: { id: "user_disconnect_fail" },
    });

    vi.spyOn(prisma.oAuthAccount, "findFirst").mockResolvedValue({
      id: "oauth_yt_2",
      userId: "user_disconnect_fail",
      provider: "youtube",
      accessToken: encrypt("access_token_456"),
      refreshToken: null,
    } as never);

    vi.spyOn(youtube, "revokeYouTubeToken").mockResolvedValue(false);
    const deleteSpy = vi.spyOn(prisma.oAuthAccount, "deleteMany").mockResolvedValue({ count: 1 });
    vi.spyOn(prisma.influencerProfile, "updateMany").mockResolvedValue({ count: 1 });
    vi.spyOn(audit, "createActivityLog").mockResolvedValue({} as never);

    const req = new NextRequest("https://vyaparmedia.in/api/auth/youtube/disconnect", { method: "POST" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.revokedWithGoogle).toBe(false);
    expect(data.manualRevokeUrl).toContain("myaccount.google.com");
    expect(deleteSpy).toHaveBeenCalled();
  });
});
