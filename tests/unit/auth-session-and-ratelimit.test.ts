import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import prisma from "@/lib/db";
import { handleExistingJwtSession, verifyActiveSessionToken } from "@/lib/auth/session";
import { redis } from "@/lib/redis";

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

      const res = await POST(req, { params: Promise.resolve({ nextauth: ["callback", "credentials"] }) });
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

      const res = await GET(req, { params: Promise.resolve({ nextauth: ["callback", "google"] }) });
      expect(res.status).toBe(429);
      const data = await res.json();
      expect(data.error).toBe("RateLimitExceeded");
    });

    it("does not rate limit non-mutating session check requests", async () => {
      const rateLimitSpy = vi.spyOn(rateLimitModule, "rateLimit");

      const req = new NextRequest("http://localhost:3000/api/auth/session", {
        method: "GET",
      });

      await GET(req, { params: Promise.resolve({ nextauth: ["session"] }) });
      expect(rateLimitSpy).not.toHaveBeenCalled();
    });
  });

  describe("verifyActiveSessionToken concurrency grace window", () => {
    it("returns true when current token matches activeToken in redis", async () => {
      vi.spyOn(redis, "get").mockResolvedValue("token_match_123");
      const isValid = await verifyActiveSessionToken("user_1", "token_match_123");
      expect(isValid).toBe(true);
    });

    it("returns true when token was replaced by activeToken and replacement is within 15s grace window", async () => {
      vi.spyOn(redis, "get").mockResolvedValue("replacement_token_456");
      vi.spyOn(prisma.refreshToken, "findUnique")
        .mockResolvedValueOnce({ replacedByToken: "replacement_token_456" } as never)
        .mockResolvedValueOnce({ createdAt: new Date(Date.now() - 5_000) } as never); // replacement token created 5s ago

      const isValid = await verifyActiveSessionToken("user_1", "old_token_123");
      expect(isValid).toBe(true);
    });

    it("returns false when token was replaced by activeToken but replacement was created > 15s ago", async () => {
      vi.spyOn(redis, "get").mockResolvedValue("replacement_token_456");
      vi.spyOn(prisma.refreshToken, "findUnique")
        .mockResolvedValueOnce({ replacedByToken: "replacement_token_456" } as never)
        .mockResolvedValueOnce({ createdAt: new Date(Date.now() - 20_000) } as never); // replacement token created 20s ago

      const isValid = await verifyActiveSessionToken("user_1", "old_token_123");
      expect(isValid).toBe(false);
    });

    it("returns false when old token does not have activeToken as replacement", async () => {
      vi.spyOn(redis, "get").mockResolvedValue("unrelated_active_token");
      vi.spyOn(prisma.refreshToken, "findUnique").mockResolvedValueOnce(null as never);

      const isValid = await verifyActiveSessionToken("user_1", "old_token_123");
      expect(isValid).toBe(false);
    });
  });
});
