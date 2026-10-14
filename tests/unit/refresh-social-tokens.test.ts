import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/cron/refresh-social-tokens/route";
import prisma from "@/lib/db";
import * as instagram from "@/lib/instagram";
import { NotificationService } from "@/services/notification.service";
import { encrypt } from "@/lib/encryption";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/app/api/cron/guard", () => ({
  validateCronSecret: vi.fn(),
}));

vi.mock("@/lib/lock", () => ({
  acquireDistributedLock: vi.fn().mockResolvedValue("mock_lock_token"),
  releaseDistributedLock: vi.fn().mockResolvedValue(true),
}));

describe("O1-T3: refresh-social-tokens Cron with Fake Clock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.spyOn(prisma.activityLog, "create").mockResolvedValue({} as never);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("refreshes Instagram tokens expiring within 10 days and older than 24 hours", async () => {
    const fixedNow = new Date("2026-10-15T12:00:00Z");
    vi.setSystemTime(fixedNow);

    // Account with token created 3 days ago, expiring in 5 days
    const mockExpiringAccount = {
      id: "oauth_1",
      userId: "user_influencer_1",
      provider: "instagram",
      providerAccountId: "ig_user_1",
      accessToken: encrypt("old_plain_token_123"),
      refreshToken: null,
      expiresAt: new Date(fixedNow.getTime() + 5 * 86400 * 1000), // in 5 days
      createdAt: new Date(fixedNow.getTime() - 3 * 86400 * 1000), // 3 days ago (>24h)
      updatedAt: new Date(fixedNow.getTime() - 3 * 86400 * 1000),
      scope: "instagram_business_basic",
    };

    vi.spyOn(prisma.oAuthAccount, "findMany").mockResolvedValue([mockExpiringAccount as never]);
    const updateSpy = vi.spyOn(prisma.oAuthAccount, "update").mockResolvedValue({} as never);

    // Mock refreshInstagramToken success
    const refreshSpy = vi.spyOn(instagram, "refreshInstagramToken").mockResolvedValue({
      accessToken: "fresh_refreshed_token_456",
      expiresIn: 5184000, // 60 days
    });

    const req = new NextRequest("https://app.vyaparmedia.in/api/cron/refresh-social-tokens");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.refreshed).toBe(1);
    expect(body.failed).toBe(0);
    expect(refreshSpy).toHaveBeenCalledWith("old_plain_token_123");
    expect(updateSpy).toHaveBeenCalledTimes(1);

    const firstUpdateCall = updateSpy.mock.calls[0];
    expect(firstUpdateCall).toBeDefined();
    const updateData = firstUpdateCall![0].data;
    expect(updateData.expiresAt).toEqual(new Date(fixedNow.getTime() + 5184000 * 1000));
  });

  it("marks account as NEEDS_RECONNECT and notifies user when refresh fails", async () => {
    const fixedNow = new Date("2026-10-15T12:00:00Z");
    vi.setSystemTime(fixedNow);

    const mockFailingAccount = {
      id: "oauth_2",
      userId: "user_influencer_2",
      provider: "instagram",
      providerAccountId: "ig_user_2",
      accessToken: encrypt("stale_token_789"),
      refreshToken: null,
      expiresAt: new Date(fixedNow.getTime() + 2 * 86400 * 1000), // in 2 days
      createdAt: new Date(fixedNow.getTime() - 5 * 86400 * 1000), // 5 days ago
      updatedAt: new Date(fixedNow.getTime() - 5 * 86400 * 1000),
      scope: "instagram_business_basic",
    };

    vi.spyOn(prisma.oAuthAccount, "findMany").mockResolvedValue([mockFailingAccount as never]);
    const updateSpy = vi.spyOn(prisma.oAuthAccount, "update").mockResolvedValue({} as never);
    const notifySpy = vi.spyOn(NotificationService, "createNotification").mockResolvedValue({} as never);

    // Mock refreshInstagramToken returns null (token revoked or expired on Meta side)
    vi.spyOn(instagram, "refreshInstagramToken").mockResolvedValue(null);

    const req = new NextRequest("https://app.vyaparmedia.in/api/cron/refresh-social-tokens");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.refreshed).toBe(0);
    expect(body.failed).toBe(1);

    // Account must be marked NEEDS_RECONNECT with accessToken nulled out
    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: "oauth_2" },
      data: {
        accessToken: null,
        scope: "NEEDS_RECONNECT",
      },
    });

    // User must be proactively notified
    expect(notifySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_influencer_2",
        type: "security_alert",
      })
    );
  });
});
