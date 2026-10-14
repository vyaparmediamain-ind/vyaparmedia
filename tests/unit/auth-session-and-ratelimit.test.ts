import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import prisma from "@/lib/db";
import { handleExistingJwtSession } from "@/lib/auth/session";

vi.mock("@/lib/auth", () => ({
  handlers: {
    GET: vi.fn().mockImplementation(async () => new Response(JSON.stringify({ status: "ok" }), { status: 200 })),
    POST: vi.fn().mockImplementation(async () => new Response(JSON.stringify({ status: "ok" }), { status: 200 })),
  },
}));

import { GET, POST } from "@/app/api/auth/[...nextauth]/route";
import { NextRequest } from "next/server";
import * as rateLimitModule from "@/lib/rate-limit";

describe("O3-T7 / O3-T9: JWT Status Refresh Check & Auth Route Rate Limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("O3-T7: Banned/Suspended/Deleted check on JWT refresh and active session", () => {
    it("marks session as AccountBlocked when user status changes to BANNED on token rotation", async () => {
      const expiredToken = {
        id: "user_banned_123",
        refreshToken: "refresh_token_valid",
        accessTokenExpires: Date.now() - 1000, // Token expired, triggers rotateSessionToken
        lastCheckedStatus: Date.now(), // Even if lastCheckedStatus is recent
      };

      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: "user_banned_123",
        status: "BANNED",
      } as never);

      const result = await handleExistingJwtSession(expiredToken);

      expect(result.error).toBe("AccountBlocked");
      expect(result.status).toBe("BANNED");
    });

    it("marks session as AccountBlocked when user status changes to SUSPENDED on token rotation", async () => {
      const expiredToken = {
        id: "user_suspended_123",
        refreshToken: "refresh_token_valid",
        accessTokenExpires: Date.now() - 1000,
        lastCheckedStatus: Date.now(),
      };

      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: "user_suspended_123",
        status: "SUSPENDED",
      } as never);

      const result = await handleExistingJwtSession(expiredToken);

      expect(result.error).toBe("AccountBlocked");
      expect(result.status).toBe("SUSPENDED");
    });

    it("marks session as AccountBlocked when user status changes to DELETED on token rotation", async () => {
      const expiredToken = {
        id: "user_deleted_123",
        refreshToken: "refresh_token_valid",
        accessTokenExpires: Date.now() - 1000,
        lastCheckedStatus: Date.now(),
      };

      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: "user_deleted_123",
        status: "DELETED",
      } as never);

      const result = await handleExistingJwtSession(expiredToken);

      expect(result.error).toBe("AccountBlocked");
      expect(result.status).toBe("DELETED");
    });
  });

  describe("O3-T9: Auth handler rate limiting for credentials sign-in and OAuth callbacks", () => {
    it("returns HTTP 429 when credentials sign-in is rate-limited", async () => {
      vi.spyOn(rateLimitModule, "rateLimit").mockResolvedValue({
        success: false,
        limit: 10,
        remaining: 0,
        reset: Math.floor(Date.now() / 1000) + 60,
      });

      const req = new NextRequest("http://localhost:3000/api/auth/callback/credentials", {
        method: "POST",
        headers: {
          "x-forwarded-for": "198.51.100.1",
        },
      });

      const res = await POST(req);
      expect(res.status).toBe(429);
      const data = await res.json();
      expect(data.error).toBe("RateLimitExceeded");
    });

    it("returns HTTP 429 when OAuth callback is rate-limited", async () => {
      vi.spyOn(rateLimitModule, "rateLimit").mockResolvedValue({
        success: false,
        limit: 20,
        remaining: 0,
        reset: Math.floor(Date.now() / 1000) + 45,
      });

      const req = new NextRequest("http://localhost:3000/api/auth/callback/google?code=auth_code_xyz", {
        method: "GET",
        headers: {
          "x-forwarded-for": "198.51.100.2",
        },
      });

      const res = await GET(req);
      expect(res.status).toBe(429);
      const data = await res.json();
      expect(data.error).toBe("RateLimitExceeded");
    });

    it("does not rate limit non-mutating session check requests", async () => {
      const rateLimitSpy = vi.spyOn(rateLimitModule, "rateLimit");

      const req = new NextRequest("http://localhost:3000/api/auth/session", {
        method: "GET",
      });

      await GET(req);
      expect(rateLimitSpy).not.toHaveBeenCalled();
    });
  });
});
