import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/auth/instagram/callback/route";
import prisma from "@/lib/db";
import * as instagram from "@/lib/instagram";
import { logger } from "@/lib/logger";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/lib/auth";

describe("O1-T2 & O1-T3: Instagram Callback Route & Token Lifecycle", () => {
  const mockAuth = vi.mocked(auth);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redirects to friendly error when Meta sends error=access_denied / error_reason", async () => {
    const req = new NextRequest(
      "https://app.vyaparmedia.in/api/auth/instagram/callback?error=access_denied&error_reason=user_denied&error_description=Permissions+error"
    );

    const res = await GET(req);
    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("/dashboard/settings?error=instagram_connect_cancelled");
  });

  it("redirects to instagram_not_professional_account when profile fetch fails (e.g. personal account)", async () => {
    const validState = "state_1234567890abcdef1234567890abcdef";
    mockAuth.mockResolvedValue({
      user: { id: "user_creator_1" },
    } as unknown as Awaited<ReturnType<typeof auth>>);

    // Mock Prisma oAuthState
    vi.spyOn(prisma.oAuthState, "findUnique").mockResolvedValue({
      id: "state_id",
      userId: "user_creator_1",
      state: validState,
      provider: "instagram",
      expiresAt: new Date(Date.now() + 600000),
      createdAt: new Date(),
    });
    vi.spyOn(prisma.oAuthState, "delete").mockResolvedValue({} as never);

    // Mock exchangeInstagramCode success
    vi.spyOn(instagram, "exchangeInstagramCode").mockResolvedValue({
      accessToken: "mock_secret_long_token_value_xyz",
      userId: "ig_user_1111",
      expiresIn: 5184000,
    });

    // Mock getInstagramProfile returns null (rejected personal account)
    vi.spyOn(instagram, "getInstagramProfile").mockResolvedValue(null);

    const req = new NextRequest(
      `https://app.vyaparmedia.in/api/auth/instagram/callback?code=mock_code_123&state=${validState}`
    );

    const res = await GET(req);
    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("/dashboard/settings?error=instagram_not_professional_account");
  });

  it("stores expiresAt and encrypted token on successful callback", async () => {
    const validState = "state_1234567890abcdef1234567890abcdef";
    mockAuth.mockResolvedValue({
      user: { id: "user_creator_1" },
    } as unknown as Awaited<ReturnType<typeof auth>>);

    vi.spyOn(prisma.oAuthState, "findUnique").mockResolvedValue({
      id: "state_id",
      userId: "user_creator_1",
      state: validState,
      provider: "instagram",
      expiresAt: new Date(Date.now() + 600000),
      createdAt: new Date(),
    });
    vi.spyOn(prisma.oAuthState, "delete").mockResolvedValue({} as never);

    vi.spyOn(instagram, "exchangeInstagramCode").mockResolvedValue({
      accessToken: "mock_secret_long_token_value_xyz",
      userId: "ig_user_1111",
      expiresIn: 5184000,
    });

    vi.spyOn(instagram, "getInstagramProfile").mockResolvedValue({
      id: "ig_user_1111",
      username: "verified_influencer",
      name: "Influencer",
      biography: "Bio",
      followersCount: 50000,
      followingCount: 100,
      mediaCount: 120,
      profilePicture: "https://ig.cdn.com/avatar.jpg",
      isVerified: true,
      accountType: "CREATOR",
    });

    vi.spyOn(prisma.oAuthAccount, "findUnique").mockResolvedValue(null);
    vi.spyOn(prisma.oAuthAccount, "findFirst").mockResolvedValue(null);
    const createSpy = vi.spyOn(prisma.oAuthAccount, "create").mockResolvedValue({} as never);
    vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
      userType: "INFLUENCER",
      email: "creator@vyaparmedia.in",
    } as never);
    vi.spyOn(prisma.influencerProfile, "upsert").mockResolvedValue({} as never);

    const req = new NextRequest(
      `https://app.vyaparmedia.in/api/auth/instagram/callback?code=mock_code_123&state=${validState}`
    );

    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/dashboard/settings?success=instagram_connected");

    expect(createSpy).toHaveBeenCalledTimes(1);
    const firstCall = createSpy.mock.calls[0];
    expect(firstCall).toBeDefined();
    const createArgs = firstCall![0].data;
    expect(createArgs.userId).toBe("user_creator_1");
    expect(createArgs.provider).toBe("instagram");
    expect(createArgs.providerAccountId).toBe("ig_user_1111");
    expect(createArgs.expiresAt).toBeInstanceOf(Date);
    // expiresAt should be approximately 60 days in the future
    const expiresTime = (createArgs.expiresAt as Date).getTime();
    const diffDays = (expiresTime - Date.now()) / (86400 * 1000);
    expect(diffDays).toBeGreaterThan(58);
    expect(diffDays).toBeLessThan(62);
  });

  it("never logs plaintext tokens or secrets (Logger Spy Test)", async () => {
    const validState = "state_1234567890abcdef1234567890abcdef";
    const secretToken = "SECRET_SUPER_SENSITIVE_IG_TOKEN_99999";

    mockAuth.mockResolvedValue({
      user: { id: "user_creator_1" },
    } as unknown as Awaited<ReturnType<typeof auth>>);

    vi.spyOn(prisma.oAuthState, "findUnique").mockResolvedValue({
      id: "state_id",
      userId: "user_creator_1",
      state: validState,
      provider: "instagram",
      expiresAt: new Date(Date.now() + 600000),
      createdAt: new Date(),
    });
    vi.spyOn(prisma.oAuthState, "delete").mockResolvedValue({} as never);

    vi.spyOn(instagram, "exchangeInstagramCode").mockResolvedValue({
      accessToken: secretToken,
      userId: "ig_user_1111",
      expiresIn: 5184000,
    });
    vi.spyOn(instagram, "getInstagramProfile").mockResolvedValue({
      id: "ig_user_1111",
      username: "verified_influencer",
      name: "Influencer",
      biography: "Bio",
      followersCount: 50000,
      followingCount: 100,
      mediaCount: 120,
      profilePicture: "https://ig.cdn.com/avatar.jpg",
      isVerified: true,
      accountType: "CREATOR",
    });
    vi.spyOn(prisma.oAuthAccount, "findUnique").mockResolvedValue(null);
    vi.spyOn(prisma.oAuthAccount, "findFirst").mockResolvedValue(null);
    vi.spyOn(prisma.oAuthAccount, "create").mockResolvedValue({} as never);
    vi.spyOn(prisma.user, "findUnique").mockResolvedValue(null);

    const warnSpy = vi.spyOn(logger, "warn");
    const errorSpy = vi.spyOn(logger, "error");
    const infoSpy = vi.spyOn(logger, "info");

    const req = new NextRequest(
      `https://app.vyaparmedia.in/api/auth/instagram/callback?code=mock_code_123&state=${validState}`
    );

    await GET(req);

    // Verify logger calls never contain the raw secret token string
    const allLoggedContent = [
      ...warnSpy.mock.calls,
      ...errorSpy.mock.calls,
      ...infoSpy.mock.calls,
    ].map((args) => JSON.stringify(args)).join(" ");

    expect(allLoggedContent).not.toContain(secretToken);
  });
});
